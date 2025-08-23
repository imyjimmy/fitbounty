import FitBountyBot from '../../src/bot/index.js';
import NostrClient from '../../src/bot/nostr-client.js';

// Mock NOSTR client for integration tests
jest.mock('../../src/bot/nostr-client.js');

describe('FitBounty Bot Integration', () => {
  let bot;
  let mockNostrClient;

  beforeEach(() => {
    mockNostrClient = {
      publishReply: jest.fn().mockResolvedValue(true),
      connect: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(true),
      on: jest.fn(),
      getStatus: jest.fn().mockReturnValue({
        connected: true,
        relays: { connected: 1, total: 1 }
      })
    };

    NostrClient.mockImplementation(() => mockNostrClient);
    bot = new FitBountyBot();
  });

  describe('End-to-End Message Handling', () => {
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

    test.each(e2eTestCases)('should handle $name correctly', async ({ mentionData, expectedResponse }) => {
      await bot.handleMention(mentionData);
      
      expect(mockNostrClient.publishReply).toHaveBeenCalledWith(
        mentionData.event,
        expect.stringMatching(expectedResponse)
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle parsing errors gracefully', async () => {
      const mentionData = {
        event: { 
          id: 'test-event-error', 
          content: "I want to exercise @fitbounty", // Vague, should fail parsing
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
      
      expect(mockNostrClient.publishReply).toHaveBeenCalledWith(
        mentionData.event,
        expect.stringMatching(/❌.*couldn't understand/)
      );
    });
  });
});