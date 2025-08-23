import 'dotenv/config';
import NostrClient from './nostr-client.js';
import SmartParser from './smart-parser.js';
import CoreAPI from './core-api.js';
import PenaltyBetModel from '../database/models/penalty-bet.js';
import PaymentHandler from './payment-handler.js';

// Configuration from environment
const config = {
  nostr: {
    privateKey: process.env.NOSTR_PRIVATE_KEY,
    relays: process.env.NOSTR_RELAYS?.split(',') || [
      'wss://relay.damus.io',
      'wss://nos.social', 
      'wss://relay.primal.net',
      'wss://nostr.wine'
    ]
  },
  nwc: {
    connectionString: process.env.NWC_CONNECTION_STRING
  },
  bot: {
    name: process.env.BOT_NAME || 'FitBounty',
    version: '1.0.0'
  }
};

// Validate required environment variables
if (!config.nostr.privateKey) {
  console.error('❌ NOSTR_PRIVATE_KEY is required! Set it in your .env file');
  process.exit(1);
}

if (!config.nwc.connectionString) {
  console.error('❌ NWC_CONNECTION_STRING is required! Set it in your .env file');
  process.exit(1);
}

class FitBountyBot {
  constructor() {
    this.nostrClient = new NostrClient(config.nostr.privateKey, config.nostr.relays);
    this.smartParser = new SmartParser();
    this.penaltyBetModel = new PenaltyBetModel();
    this.paymentHandler = new PaymentHandler(config.nwc.connectionString);
    this.coreAPI = new CoreAPI(this.penaltyBetModel, this.paymentHandler, this.nostrClient);
    this.isRunning = false;
    
    // Bind event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Handle mentions from NOSTR
    this.nostrClient.on('mention', async (mentionData) => {
      await this.handleMention(mentionData);
    });

    // Handle process termination gracefully
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  async start() {
    console.log(`🚀 Starting ${config.bot.name} v${config.bot.version}...`);
    
    try {
      // Connect to NOSTR relays
      const connected = await this.nostrClient.connect();
      
      if (!connected) {
        throw new Error('Failed to connect to any NOSTR relays');
      }

      this.isRunning = true;
      console.log(`✅ ${config.bot.name} is running and listening for mentions!`);
      
      // Post startup message (optional)
      await this.postStartupMessage();
      
    } catch (error) {
      console.error(`💥 Failed to start bot:`, error.message);
      process.exit(1);
    }
  }

  async handleMention(mentionData) {
    const { event, user, content, relay } = mentionData;
    
    console.log(`\n🎯 NEW MENTION RECEIVED`);
    console.log(`👤 User: ${user.npub}`);
    console.log(`📝 Message: "${content}"`);
    console.log(`🔗 Relay: ${relay}`);
    console.log(`⏰ Time: ${new Date(event.created_at * 1000).toISOString()}`);

    try {
      // Parse the message using advanced pattern matching
      const parsedCommand = this.smartParser.parseMessage(content, event.tags);
      
      if (parsedCommand) {
        console.log(`🧠 Parsed command: ${parsedCommand.command}`);
        console.log(`🎯 Confidence: ${Math.round(parsedCommand.confidence * 100)}%`);
        
        // Execute the parsed command
        const response = await this.coreAPI.executeCommand(parsedCommand, { event, user, relay });
        
        if (response.shouldReply) {
          await this.nostrClient.publishReply(event, response.message);
          console.log(`✅ Replied to ${user.npub}`);
        }
        
        return;
      }
      
      // If parsing failed, provide helpful error feedback
      const parsingErrors = this.smartParser.getParsingErrors(content);
      if (parsingErrors.length > 0) {
        const errorResponse = this.formatParsingErrorResponse(parsingErrors);
        await this.nostrClient.publishReply(event, errorResponse);
        console.log(`📝 Sent parsing error help to ${user.npub}`);
        return;
      }
      
      // Fall back to existing response logic if no patterns matched
      const response = await this.generateResponse(content, user);
      
      if (response) {
        await this.nostrClient.publishReply(event, response);
        console.log(`✅ Replied to ${user.npub}`);
      }
      
    } catch (error) {
      console.error(`💥 Error handling mention:`, error.message);
      
      // Send error message to user
      try {
        await this.nostrClient.publishReply(
          event, 
          "🤖 Oops! I encountered an error processing your request. Please try again or contact support."
        );
      } catch (replyError) {
        console.error(`💥 Failed to send error reply:`, replyError.message);
      }
    }
  }

  async generateResponse(content, user) {
    // Keep your existing fallback logic but add a note about the new parsing
    const lowerContent = content.toLowerCase();
    
    // Check for help request
    if (lowerContent.includes('help') || lowerContent.includes('how')) {
      return this.getHelpMessage();
    }
    
    // Check for general fitness mentions
    if (lowerContent.includes('challenge') || lowerContent.includes('pushup') || 
        lowerContent.includes('squat') || lowerContent.includes('workout')) {
      return `🤖 I can help you create fitness challenges! Try a format like:

  "I have to do 20 pushups for 7 days OR I owe @friend 1000 sats @fitbounty"

  Or reply with "@fitbounty help" for more examples.`;
    }
    
    // Default response
    return this.getDefaultResponse(user);
  }

  getHelpMessage() {
    return `🤖 **FitBounty Help**

I help you create fitness challenges with Lightning Network rewards! Here's how:

**📈 Bounty Challenges:**
"I want to do 20 pushups daily for 7 days @fitbounty"
Friends can then add bounties: "bounty 1000 sats"

**💸 Penalty Bets:**  
"I have to do 50 pushups for 10 days OR I owe @friend 2000 sats @fitbounty"

**📊 Commands:**
• "status" - Check your active challenges
• "leaderboard" - See top performers
• "help" - Show this message

Ready to get fit and earn sats? 💪⚡`;
  }

  getChallengeResponse(content, user) {
    // TODO: Parse challenge details properly
    return `🎯 **Challenge Detected!**

Hey ${user.npub.slice(0, 12)}..., I see you want to create a fitness challenge!

📝 Content: "${content}"

🚧 **Coming Soon:** Full challenge parsing and Lightning integration!

For now, reply with "help" to see available commands.`;
  }

  getBountyResponse(content, user) {
    return `💰 **Bounty Detected!**

I see you want to add a bounty! 

🚧 **Coming Soon:** Lightning payment processing for bounties.

Stay tuned! ⚡`;
  }

  getPenaltyBetResponse(content, user) {
    return `💸 **Penalty Bet Detected!**

Penalty bets are a great way to stay accountable!

📝 Format detected: "${content}"

🚧 **Coming Soon:** Automatic escrow and payment processing.

Get ready to put your sats where your squats are! 💪`;
  }

  getDefaultResponse(user) {
    return `👋 Hey ${user.npub.slice(0, 12)}...!

I'm FitBounty - your fitness accountability bot powered by Lightning Network! ⚡💪

Try saying:
• "I want to do 20 pushups for 7 days @fitbounty"  
• "help" for more commands

Let's get fit and earn some sats! 🚀`;
  }

  formatParsingErrorResponse(errors) {
  const baseMessage = "❌ **I couldn't understand your request.**\n\n";
  const errorList = errors.map(error => `• ${error}`).join('\n');
  
  return baseMessage + 
    `**Issues found:**\n${errorList}\n\n` +
    `**Examples of valid formats:**\n` +
    `• "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty"\n` +
    `• "If I don't do 30 squats daily for a week, @bob gets 500 sats @fitbounty"\n` +
    `• "Challenge: 50 burpees daily for 5 days @fitbounty"\n\n` +
    `Reply with "@fitbounty help" for more examples.`;
}

  async postStartupMessage() {
    // Optional: Post a status message when bot starts
    // For now, just log that we're ready
    console.log(`📢 Bot is ready to receive mentions!`);
    
    // TODO: Could post to a specific relay or send to admin
  }

  async shutdown() {
    console.log(`\n🛑 Shutting down ${config.bot.name}...`);
    
    this.isRunning = false;
    
    try {
      await this.nostrClient.disconnect();
      console.log(`👋 ${config.bot.name} stopped gracefully`);
    } catch (error) {
      console.error(`💥 Error during shutdown:`, error.message);
    }
    
    process.exit(0);
  }

  getStatus() {
    const nostrStatus = this.nostrClient.getStatus();
    
    return {
      bot: {
        name: config.bot.name,
        version: config.bot.version,
        running: this.isRunning
      },
      nostr: nostrStatus
    };
  }
}

// Start the bot
async function main() {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║            🏋️  FITBOUNTY  ⚡           ║
  ║     Fitness Challenges + Lightning     ║
  ╚═══════════════════════════════════════╝
  `);

  const bot = new FitBountyBot();
  
  // Add status endpoint for debugging
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const status = bot.getStatus();
      console.log(`\n📊 Bot Status: Running=${status.bot.running}, NOSTR=${status.nostr.connected}, Relays=${status.nostr.relays.connected}/${status.nostr.relays.total}`);
    }, 30000); // Every 30 seconds
  }
  
  await bot.start();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('💥 Failed to start application:', error);
  process.exit(1);
});

export default FitBountyBot;