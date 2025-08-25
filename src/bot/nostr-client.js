import { relayInit, getPublicKey, getEventHash, signEvent, nip19 } from 'nostr-tools';
import { WebSocket } from 'ws';

// Polyfill WebSocket for nostr-tools
global.WebSocket = WebSocket;

class NostrClient {
  constructor(privateKey, relays = []) {
    if (privateKey.startsWith('nsec')) {
      const decoded = nip19.decode(privateKey);
      this.privateKey = decoded.data; // This is already the hex string
    } else {
      this.privateKey = privateKey;
    }
    this.publicKey = getPublicKey(this.privateKey);
    this.relays = relays.map(url => ({ url, relay: null, connected: false }));
    this.eventHandlers = new Map();
    this.isConnected = false;
    this.seenEvents = new Set();

    console.log(`🤖 FitBounty Bot initialized`);
    console.log(`📍 Public Key: ${nip19.npubEncode(this.publicKey)}`);
  }

  // Connect to all relays
  async connect() {
    console.log(`🔌 Connecting to ${this.relays.length} NOSTR relays...`);
    
    const connectionPromises = this.relays.map(async (relayInfo) => {
      try {
        console.log(`⚡ Connecting to ${relayInfo.url}`);
        const relay = relayInit(relayInfo.url);
        
        relay.on('connect', () => {
          console.log(`✅ Connected to ${relayInfo.url}`);
          relayInfo.connected = true;
          this.checkConnectionStatus();
        });

        relay.on('error', () => {
          console.log(`❌ Failed to connect to ${relayInfo.url}`);
          relayInfo.connected = false;
        });

        relay.on('disconnect', () => {
          console.log(`🔌 Disconnected from ${relayInfo.url}`);
          relayInfo.connected = false;
          // Auto-reconnect after 5 seconds
          setTimeout(() => this.reconnectRelay(relayInfo), 5000);
        });

        await relay.connect();
        relayInfo.relay = relay;
        
        // Subscribe to mentions immediately after connection
        this.subscribeToMentions(relay);
        
      } catch (error) {
        console.error(`💥 Error connecting to ${relayInfo.url}:`, error.message);
        relayInfo.connected = false;
      }
    });

    await Promise.allSettled(connectionPromises);
    return this.isConnected;
  }

  // Check if we have at least one connected relay
  checkConnectionStatus() {
    const connectedCount = this.relays.filter(r => r.connected).length;
    const wasConnected = this.isConnected;
    this.isConnected = connectedCount > 0;
    
    if (this.isConnected && !wasConnected) {
      console.log(`🚀 FitBounty Bot is LIVE! (${connectedCount}/${this.relays.length} relays connected)`);
    }
  }

  // Reconnect to a specific relay
  async reconnectRelay(relayInfo) {
    console.log(`🔄 Attempting to reconnect to ${relayInfo.url}`);
    try {
      // Create a new relay instance if it doesn't exist
      if (!relayInfo.relay) {
        relayInfo.relay = relayInit(relayInfo.url);
        
        // Re-setup event handlers
        relayInfo.relay.on('connect', () => {
          console.log(`✅ Reconnected to ${relayInfo.url}`);
          relayInfo.connected = true;
          this.checkConnectionStatus();
          this.subscribeToMentions(relayInfo.relay);
        });

        relayInfo.relay.on('error', () => {
          console.log(`❌ Reconnection failed for ${relayInfo.url}`);
          relayInfo.connected = false;
        });

        relayInfo.relay.on('disconnect', () => {
          console.log(`🔌 Disconnected from ${relayInfo.url}`);
          relayInfo.connected = false;
          setTimeout(() => this.reconnectRelay(relayInfo), 5000);
        });
      }
      
      await relayInfo.relay.connect();
    } catch (error) {
      console.error(`💥 Reconnection failed for ${relayInfo.url}:`, error?.message || 'Unknown error');
      // Try again in 10 seconds instead of 5
      setTimeout(() => this.reconnectRelay(relayInfo), 10000);
    }
  }

  // Subscribe to mentions of our bot
  subscribeToMentions(relay) {
    // 1. Query for recent historical mentions
    const historicalFilter = {
      kinds: [1],
      '#p': [this.publicKey],
      // since: Math.floor(Date.now() / 1000) - 86400, // Last hour
      // limit: 50
      ids: ["be9d514db815524eef5a6f54d91c46c3f16f1d26e58c63415353218360cf16a0"], // Target specific post
      limit: 1
    };

    console.log(`🔍 Querying historical mentions on ${relay.url}`);
    const historicalSub = relay.sub([historicalFilter]);
    
    historicalSub.on('event', (event) => {
      console.log(`📨 Historical event found:`, event.content);
      this.handleMentionEvent(event, relay.url);
    });

    historicalSub.on('eose', () => {
      console.log(`📚 Historical query complete on ${relay.url}`);
      historicalSub.unsub(); // Close the historical subscription
    });

    // 2. Subscribe to new mentions going forward
    const liveFilter = {
      kinds: [1],
      '#p': [this.publicKey],
    };

    console.log(`👂 Subscribing to live mentions on ${relay.url}`);
    const liveSub = relay.sub([liveFilter]);

    liveSub.on('event', (event) => {
      console.log(`📨 Live event received:`, event.content);
      this.handleMentionEvent(event, relay.url);
    });

    liveSub.on('eose', () => {
      console.log(`📡 Live subscription established on ${relay.url}`);
    });
  }

  // Handle incoming mention events
  async handleMentionEvent(event, relayUrl) {
    try {
      // Add deduplication check first
      if (this.seenEvents.has(event.id)) {
        return; // Skip duplicate events silently
      }

      // Verify event signature
      if (!this.verifyEvent(event)) {
        console.log(`⚠️  Invalid event signature from ${event.pubkey}`);
        return;
      }

      this.seenEvents.add(event.id);

      console.log(`🎯 Mention detected from ${nip19.npubEncode(event.pubkey)}`);
      console.log(`📝 Content: ${event.content}`);
      console.log(`🔗 Relay: ${relayUrl}`);

      // Extract user info
      const userInfo = {
        pubkey: event.pubkey,
        npub: nip19.npubEncode(event.pubkey),
        relayUrl: relayUrl
      };

      // Emit mention event for handling
      this.emit('mention', {
        event,
        user: userInfo,
        content: event.content,
        tags: event.tags,
        relay: relayUrl
      });

    } catch (error) {
      console.error(`💥 Error handling mention event:`, error);
    }
  }

  // Verify event signature
  verifyEvent(event) {
    const eventHash = getEventHash(event);
    return event.id === eventHash;
  }

  // Publish a reply to NOSTR
  async publishReply(originalEvent, content, extraTags = []) {
    if (!this.isConnected) {
      throw new Error('Not connected to any relays');
    }

    // Build reply event
    const replyEvent = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', originalEvent.id, '', 'reply'], // Reply to original event
        ['p', originalEvent.pubkey], // Mention original author
        ...extraTags
      ],
      content: content,
      pubkey: this.publicKey,
    };

    // Add event hash and signature
    replyEvent.id = getEventHash(replyEvent);
    replyEvent.sig = signEvent(replyEvent, this.privateKey);
    console.log('about to publish: ', replyEvent);

    // Publish to all connected relays
    // const publishPromises = this.relays
    //   .filter(r => r.connected && r.relay)
    //   .map(async (relayInfo) => {
    //     try {
    //       await relayInfo.relay.publish(replyEvent);
    //       console.log(`📤 Reply published to ${relayInfo.url}`);
    //       return { url: relayInfo.url, success: true };
    //     } catch (error) {
    //       console.error(`💥 Failed to publish to ${relayInfo.url}:`, error.message);
    //       return { url: relayInfo.url, success: false, error: error.message };
    //     }
    //   });

    // const results = await Promise.allSettled(publishPromises);
    // const successful = results.filter(r => r.value?.success).length;
    
    // console.log(`✅ Reply published to ${successful}/${this.relays.length} relays`);
    // return { successful, total: this.relays.length, results };
  }

  // Event emitter functionality
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`💥 Error in event handler for '${event}':`, error);
      }
    });
  }

  // Get connection status
  getStatus() {
    const connected = this.relays.filter(r => r.connected).length;
    const total = this.relays.length;
    
    return {
      connected: this.isConnected,
      relays: {
        connected,
        total,
        list: this.relays.map(r => ({
          url: r.url,
          connected: r.connected
        }))
      },
      publicKey: this.publicKey,
      npub: nip19.npubEncode(this.publicKey)
    };
  }

  // Disconnect from all relays
  async disconnect() {
    console.log(`🔌 Disconnecting from all relays...`);
    
    const disconnectPromises = this.relays
      .filter(r => r.relay)
      .map(async (relayInfo) => {
        try {
          relayInfo.relay.close();
          relayInfo.connected = false;
        } catch (error) {
          console.error(`Error disconnecting from ${relayInfo.url}:`, error.message);
        }
      });

    await Promise.allSettled(disconnectPromises);
    this.isConnected = false;
    console.log(`👋 Disconnected from all relays`);
  }
}

export default NostrClient;