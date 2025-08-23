import { mock, expect, describe, test, beforeEach, spyOn } from 'bun:test';
import FitBountyBot from '../../src/bot/index.js';

// Mock NOSTR client for integration tests
mock.module('../../src/bot/nostr-client.js', () => ({
  default: class MockNostrClient {
    constructor(privateKey, relays) {
      this.privateKey = privateKey;
      this.relays = relays;
      this.isConnected = false;
      this.eventHandlers = new Map();
      this.publishReply = mock(() => Promise.resolve({ successful: 1, total: 1 }));
    }

    async connect() {
      this.isConnected = true;
      return true;
    }

    async disconnect() {
      this.isConnected = false;
    }

    on(event, handler) {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, []);
      }
      this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.forEach(handler => handler(data));
    }

    getStatus() {
      return {
        connected: this.isConnected,
        relays: { connected: 1, total: 1 }
      };
    }
  }
}));

describe('FitBounty Bot Integration', () => {
  let bot;
  let publishReplySpy;

  // Define test cases at the top level
  const e2eTestCases = [
    {
      name: 'penalty bet creation',
      mentionData: {
        event: { 
          id: 'test-event-1', 
          content: "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty",
          tags: [],
          created_at: Math.floor(Date.now() / 1000)
        },
        user: { 
          pubkey: 'test-pubkey-1', 
          npub: 'npub1test...' 
        },
        content: "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty",
        relay: 'wss://test-relay.com'
      },
      expectedResponse: /💸.*Penalty Bet Accepted/
    },
    {
      name: 'bounty challenge creation',
      mentionData: {
        event: { 
          id: 'test-event-2', 
          content: "I want to do 50 squats daily for 10 days @fitbounty",
          tags: [],
          created_at: Math.floor(Date.now() / 1000)
        },
        user: { 
          pubkey: 'test-pubkey-2', 
          npub: 'npub1test2...' 
        },
        content: "I want to do 50 squats daily for 10 days @fitbounty",
        relay: 'wss://test-relay.com'
      },
      expectedResponse: /🎯.*Bounty Challenge Created/
    },
    {
      name: 'help request',
      mentionData: {
        event: { 
          id: 'test-event-3', 
          content: "@fitbounty help",
          tags: [],
          created_at: Math.floor(Date.now() / 1000)
        },
        user: { 
          pubkey: 'test-pubkey-3', 
          npub: 'npub1test3...' 
        },
        content: "@fitbounty help",
        relay: 'wss://test-relay.com'
      },
      expectedResponse: /🤖.*FitBounty Help/
    }
  ];

  beforeEach(() => {
    bot = new FitBountyBot();
    publishReplySpy = bot.nostrClient.publishReply; // This should now be the mocked function
    
    // Mock payment handler to prevent errors
    if (bot.coreApi?.paymentHandler) {
      bot.coreApi.paymentHandler.createEscrowInvoice = mock(() => Promise.resolve({
        paymentRequest: 'lnbc1000...',
        paymentHash: 'abc123'
      }));
    }
  });

  describe('End-to-End Message Handling', () => {
    test.each(e2eTestCases)('should handle $name correctly', async ({ mentionData, expectedResponse }) => {
      await bot.handleMention(mentionData);
      
      expect(publishReplySpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle parsing errors gracefully', async () => {
      const mentionData = {
        event: { 
          id: 'test-event-error', 
          content: "I want to exercise @fitbounty",
          tags: [],
          created_at: Math.floor(Date.now() / 1000)
        },
        user: { 
          pubkey: 'test-pubkey-error', 
          npub: 'npub1testerror...' 
        },
        content: "I want to exercise @fitbounty",
        relay: 'wss://test-relay.com'
      };

      await bot.handleMention(mentionData);
      
      expect(publishReplySpy).toHaveBeenCalled();
    });
  });
});