import SmartParser from '../../src/bot/smart-parser.js';

describe('SmartParser', () => {
  let parser;

  beforeEach(() => {
    parser = new SmartParser();
  });

  describe('Penalty Bet Parsing', () => {
    const penaltyBetTestCases = [
      // Basic penalty bets
      {
        input: "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 20,
          exerciseType: 'pushup',
          duration: 7,
          penaltyAmount: 1000,
          penaltyRecipient: 'alice'
        }
      },
      {
        input: "I must do 50 squats for 10 days or I owe @bob 2000 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 50,
          exerciseType: 'squat',
          duration: 10,
          penaltyAmount: 2000,
          penaltyRecipient: 'bob'
        }
      },
      {
        input: "I will do 30 burpees daily for 5 days or I owe @charlie 500 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 30,
          exerciseType: 'burpee',
          duration: 5,
          penaltyAmount: 500,
          penaltyRecipient: 'charlie'
        }
      },

      // Alternative formats
      {
        input: "If I don't do 15 pullups for 2 weeks, @dave gets 3000 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 15,
          exerciseType: 'pullup',
          duration: 14, // 2 weeks = 14 days
          penaltyAmount: 3000,
          penaltyRecipient: 'dave'
        }
      },
      {
        input: "25 situps daily for 7 days or @eve gets 1500 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 25,
          exerciseType: 'situp',
          duration: 7,
          penaltyAmount: 1500,
          penaltyRecipient: 'eve'
        }
      },
      {
        input: "100 jumping jacks for 3 days, penalty 800 sats to @frank @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 100,
          exerciseType: 'jumping jack',
          duration: 3,
          penaltyAmount: 800,
          penaltyRecipient: 'frank'
        }
      },

      // With typos and variations
      {
        input: "I have to do 40 puships for 5 days or i owe @greg 1200 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 40,
          exerciseType: 'pushup', // Should normalize "puships" to "pushup"
          duration: 5,
          penaltyAmount: 1200,
          penaltyRecipient: 'greg'
        }
      },
      {
        input: "30 squads daily for a week or @helen receives 900 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 30,
          exerciseType: 'squat', // Should normalize "squads" to "squat"
          duration: 7, // "a week" should be 7 days
          penaltyAmount: 900,
          penaltyRecipient: 'helen'
        }
      },

      // Duration variations
      {
        input: "I must do 10 pullups for 2 weeks OR I owe @ivan 4000 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 10,
          exerciseType: 'pullup',
          duration: 14, // 2 weeks = 14 days
          penaltyAmount: 4000,
          penaltyRecipient: 'ivan'
        }
      },
      {
        input: "20 lunges daily for 1 month or @jane gets 10000 sats @fitbounty",
        expected: {
          command: 'create_penalty_challenge',
          exerciseCount: 20,
          exerciseType: 'lunge',
          duration: 30, // 1 month = 30 days
          penaltyAmount: 10000,
          penaltyRecipient: 'jane'
        }
      }
    ];

    test.each(penaltyBetTestCases)('should parse penalty bet: $input', ({ input, expected }) => {
      const result = parser.parseMessage(input, []);
      
      expect(result).not.toBeNull();
      expect(result.command).toBe(expected.command);
      expect(result.params.exerciseCount).toBe(expected.exerciseCount);
      expect(result.params.exerciseType).toBe(expected.exerciseType);
      expect(result.params.duration).toBe(expected.duration);
      expect(result.params.penaltyAmount).toBe(expected.penaltyAmount);
      expect(result.params.penaltyRecipient).toBe(expected.penaltyRecipient);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Bounty Challenge Parsing', () => {
    const bountyChallengeTestCases = [
      {
        input: "I want to do 50 pushups daily for 10 days @fitbounty",
        expected: {
          command: 'create_bounty_challenge',
          exerciseCount: 50,
          exerciseType: 'pushup',
          duration: 10
        }
      },
      {
        input: "@fitbounty challenge: 75 squats for 2 weeks",
        expected: {
          command: 'create_bounty_challenge',
          exerciseCount: 75,
          exerciseType: 'squat',
          duration: 14
        }
      },
      {
        input: "Challenge: 100 burpees daily for 5 days @fitbounty",
        expected: {
          command: 'create_bounty_challenge',
          exerciseCount: 100,
          exerciseType: 'burpee',
          duration: 5
        }
      }
    ];

    test.each(bountyChallengeTestCases)('should parse bounty challenge: $input', ({ input, expected }) => {
      const result = parser.parseMessage(input, []);
      
      expect(result).not.toBeNull();
      expect(result.command).toBe(expected.command);
      expect(result.params.exerciseCount).toBe(expected.exerciseCount);
      expect(result.params.exerciseType).toBe(expected.exerciseType);
      expect(result.params.duration).toBe(expected.duration);
    });
  });

  describe('Other Commands', () => {
    const otherCommandTestCases = [
      {
        input: "@fitbounty status",
        expected: { command: 'get_status' }
      },
      {
        input: "how's my challenge going? @fitbounty",
        expected: { command: 'get_status' }
      },
      {
        input: "@fitbounty leaderboard",
        expected: { command: 'get_leaderboard' }
      },
      {
        input: "show me the leaderboard @fitbounty",
        expected: { command: 'get_leaderboard' }
      },
      {
        input: "@fitbounty help",
        expected: { command: 'show_help' }
      },
      {
        input: "@fitbounty bounty 1000 sats",
        expected: { 
          command: 'set_bounty',
          amount: 1000
        }
      }
    ];

    test.each(otherCommandTestCases)('should parse command: $input', ({ input, expected }) => {
      const result = parser.parseMessage(input, []);
      
      expect(result).not.toBeNull();
      expect(result.command).toBe(expected.command);
      
      if (expected.amount) {
        expect(result.params.amount).toBe(expected.amount);
      }
    });
  });

  describe('Invalid Inputs', () => {
    const invalidTestCases = [
      "Just a regular message without mentions",
      "I like to exercise @fitbounty", // Too vague
      "@fitbounty challenge", // Missing details
      "I want to do pushups @fitbounty", // Missing count and duration
      "I owe someone money @fitbounty", // No exercise
    ];

    test.each(invalidTestCases)('should return null for invalid input: %s', (input) => {
      const result = parser.parseMessage(input, []);
      expect(result).toBeNull();
    });
  });

  describe('Error Detection', () => {
    test('should provide helpful parsing errors', () => {
      const input = "I want to exercise @fitbounty";
      const errors = parser.getParsingErrors(input);
      
      expect(errors).toContain('Missing numbers (exercise count, duration, or penalty amount)');
      expect(errors).toContain('Missing duration (e.g., "7 days", "2 weeks")');
    });

    // test('should detect missing @fitbounty mention', () => {
    //   const input = "I have to do 20 pushups for 7 days";
    //   const errors = parser.getParsingErrors(input);
      
    //   expect(errors).toContain('Message must mention @fitbounty');
    // });
  });
});