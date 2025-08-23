import { nip19 } from 'nostr-tools';
import { EXERCISE_TYPES, NLP_PATTERNS, DEFAULT_VALUES } from '../utils/constants.js';

class NLPProcessor {
  constructor() {
    this.patterns = NLP_PATTERNS;
    this.exerciseTypes = EXERCISE_TYPES;
    this.defaults = DEFAULT_VALUES;
  }

  /**
   * Main processing function - converts natural language to core API command
   * @param {string} content - Message content
   * @param {Array} tags - NOSTR tags
   * @returns {Object|null} - Core API command or null
   */
  processMessage(content, tags = []) {
    const normalizedContent = content.toLowerCase().trim();
    
    // Check if message mentions @fitbounty
    if (!this.mentionsFitBounty(content)) {
      return null;
    }

    // Classify intent
    const intent = this.classifyIntent(normalizedContent);
    if (!intent) return null;

    // Extract entities based on intent
    const entities = this.extractEntities(normalizedContent, tags, intent);
    
    // Convert to core API command
    return this.mapToAPICommand(intent, entities, content, tags);
  }

  /**
   * Classify user's intent from their message
   */
  classifyIntent(content) {
    for (const [intent, patterns] of Object.entries(this.patterns.intents)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return intent;
        }
      }
    }
    return null;
  }

  /**
   * Extract relevant entities from the message
   */
  extractEntities(content, tags, intent) {
    const entities = {
      exercise: null,
      exerciseCount: null,
      exerciseType: null,
      duration: this.defaults.DURATION_DAYS,
      penaltyAmount: null,
      penaltyRecipient: null,
      penaltyRecipientPubkey: null,
      bountyAmount: null,
      challengeId: null,
      mentionedUsers: []
    };

    // Extract exercise and count
    if (intent === 'penalty_bet' || intent === 'bounty_challenge') {
      const exerciseMatch = content.match(this.patterns.entities.exercise_count);
      if (exerciseMatch) {
        entities.exerciseCount = parseInt(exerciseMatch[1]);
        entities.exerciseType = this.normalizeExercise(exerciseMatch[2].trim());
        entities.exercise = `${entities.exerciseCount} ${entities.exerciseType}`;
      } else {
        // Try to extract casual exercise description
        const casualMatch = content.match(this.patterns.entities.casual_exercise);
        if (casualMatch) {
          entities.exercise = casualMatch[1].trim();
          entities.exerciseType = this.normalizeExercise(entities.exercise);
        }
      }
    }

    // Extract duration
    const durationMatch = content.match(this.patterns.entities.duration_days);
    if (durationMatch) {
      entities.duration = parseInt(durationMatch[1]);
    }

    // Extract penalty/bounty amount
    const amountMatch = content.match(this.patterns.entities.penalty_amount);
    if (amountMatch) {
      const amount = parseInt(amountMatch[1]);
      if (intent === 'penalty_bet') {
        entities.penaltyAmount = amount;
      } else if (intent === 'set_bounty') {
        entities.bountyAmount = amount;
      }
    }

    // Extract mentioned users from content and tags
    entities.mentionedUsers = this.extractMentionedUsers(content, tags);
    
    // For penalty bets, find the penalty recipient
    if (intent === 'penalty_bet' && entities.mentionedUsers.length > 0) {
      // Usually the first mentioned user (other than fitbounty) is the penalty recipient
      const recipient = entities.mentionedUsers.find(user => !user.username.includes('fitbounty'));
      if (recipient) {
        entities.penaltyRecipient = recipient.username;
        entities.penaltyRecipientPubkey = recipient.pubkey;
      }
    }

    return entities;
  }

  /**
   * Extract mentioned users from message
   */
  extractMentionedUsers(content, tags) {
    const users = [];
    const matches = content.matchAll(this.patterns.entities.user_mention);
    
    for (const match of matches) {
      const username = match[1];
      
      // Try to find corresponding pubkey in tags
      let pubkey = null;
      if (username.startsWith('npub')) {
        try {
          const decoded = nip19.decode(username);
          pubkey = decoded.data;
        } catch (e) {
          console.warn(`Invalid npub: ${username}`);
        }
      } else {
        // Look for pubkey in p tags (limited capability)
        pubkey = this.findPubkeyInTags(username, tags);
      }

      users.push({
        username: username,
        pubkey: pubkey,
        isNpub: username.startsWith('npub')
      });
    }

    return users;
  }

  /**
   * Find pubkey for username in NOSTR tags
   */
  findPubkeyInTags(username, tags) {
    // This is limited - we can only find pubkeys of explicitly tagged users
    // In real implementation, would need name resolution service
    for (const tag of tags) {
      if (tag[0] === 'p' && tag.length > 1) {
        return tag[1]; // Return first p tag pubkey for now
      }
    }
    return null;
  }

  /**
   * Normalize exercise names to standard types
   */
  normalizeExercise(exercise) {
    const normalizedInput = exercise.toLowerCase().trim();
    
    for (const [standard, variants] of Object.entries(this.exerciseTypes)) {
      if (variants.some(variant => normalizedInput.includes(variant))) {
        return standard;
      }
    }
    
    // Return original if no match found
    return exercise;
  }

  /**
   * Map classified intent and entities to core API command
   */
  mapToAPICommand(intent, entities, originalContent, originalTags) {
    const baseCommand = {
      originalContent,
      originalTags,
      timestamp: new Date().toISOString()
    };

    switch (intent) {
      case 'penalty_bet':
        if (!entities.exercise || !entities.penaltyAmount || !entities.penaltyRecipient) {
          return {
            ...baseCommand,
            command: 'error',
            error: 'Missing required information for penalty bet',
            missing: {
              exercise: !entities.exercise,
              penaltyAmount: !entities.penaltyAmount,
              penaltyRecipient: !entities.penaltyRecipient
            }
          };
        }

        return {
          ...baseCommand,
          command: 'create_penalty_challenge',
          params: {
            exercise: entities.exercise,
            exerciseType: entities.exerciseType,
            exerciseCount: entities.exerciseCount,
            duration: entities.duration,
            penaltyAmount: entities.penaltyAmount,
            penaltyRecipient: entities.penaltyRecipient,
            penaltyRecipientPubkey: entities.penaltyRecipientPubkey
          }
        };

      case 'bounty_challenge':
        if (!entities.exercise) {
          return {
            ...baseCommand,
            command: 'error',
            error: 'Missing exercise description for challenge'
          };
        }

        return {
          ...baseCommand,
          command: 'create_bounty_challenge',
          params: {
            exercise: entities.exercise,
            exerciseType: entities.exerciseType,
            exerciseCount: entities.exerciseCount,
            duration: entities.duration
          }
        };

      case 'set_bounty':
        if (!entities.bountyAmount) {
          return {
            ...baseCommand,
            command: 'error',
            error: 'Missing bounty amount'
          };
        }

        return {
          ...baseCommand,
          command: 'set_bounty',
          params: {
            amount: entities.bountyAmount,
            challengeId: entities.challengeId // Will be determined from context
          }
        };

      case 'status_query':
        return {
          ...baseCommand,
          command: 'get_status',
          params: {
            challengeId: entities.challengeId
          }
        };

      case 'leaderboard':
        return {
          ...baseCommand,
          command: 'get_leaderboard',
          params: {}
        };

      case 'help':
        return {
          ...baseCommand,
          command: 'show_help',
          params: {}
        };

      default:
        return {
          ...baseCommand,
          command: 'unknown',
          error: `Unknown intent: ${intent}`
        };
    }
  }

  /**
   * Check if message mentions @fitbounty
   */
  mentionsFitBounty(content) {
    return /(@fitbounty|@fit.?bounty)/i.test(content);
  }

  /**
   * Validate entities for a given intent
   */
  validateCommand(command) {
    const errors = [];

    switch (command.command) {
      case 'create_penalty_challenge':
        const { exercise, duration, penaltyAmount, penaltyRecipient } = command.params;
        
        if (!exercise) errors.push('Exercise description is required');
        if (!duration || duration < this.defaults.MIN_DURATION) {
          errors.push(`Duration must be at least ${this.defaults.MIN_DURATION} day(s)`);
        }
        if (duration > this.defaults.MAX_DURATION) {
          errors.push(`Duration cannot exceed ${this.defaults.MAX_DURATION} days`);
        }
        if (!penaltyAmount || penaltyAmount < this.defaults.MIN_PENALTY) {
          errors.push(`Penalty must be at least ${this.defaults.MIN_PENALTY} sats`);
        }
        if (penaltyAmount > this.defaults.MAX_PENALTY) {
          errors.push(`Penalty cannot exceed ${this.defaults.MAX_PENALTY} sats`);
        }
        if (!penaltyRecipient) {
          errors.push('Penalty recipient must be specified (e.g., @username)');
        }
        break;

      case 'create_bounty_challenge':
        if (!command.params.exercise) {
          errors.push('Exercise description is required');
        }
        if (command.params.duration < this.defaults.MIN_DURATION) {
          errors.push(`Duration must be at least ${this.defaults.MIN_DURATION} day(s)`);
        }
        break;

      case 'set_bounty':
        if (!command.params.amount || command.params.amount < 1) {
          errors.push('Bounty amount must be at least 1 sat');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default NLPProcessor;