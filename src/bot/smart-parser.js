import { nip19 } from 'nostr-tools';
import { EXERCISE_TYPES, DURATION_SYNONYMS, PENALTY_SYNONYMS, ADVANCED_PATTERNS, DEFAULT_VALUES } from '../utils/constants.js';

class SmartParser {
  constructor() {
    this.patterns = ADVANCED_PATTERNS;
    this.exerciseTypes = EXERCISE_TYPES;
    this.durationMap = DURATION_SYNONYMS;
    this.penaltyMap = PENALTY_SYNONYMS;
    this.defaults = DEFAULT_VALUES;
  }

  /**
   * Main parsing function - converts natural language to structured command
   * @param {string} content - Message content
   * @param {Array} tags - NOSTR tags
   * @returns {Object|null} - Parsed command or null
   */
  parseMessage(content, tags = []) {
    const normalizedContent = this.normalizeContent(content);
    
    console.log('🔍 DEBUGGING TEST CASE:');
    console.log('Original content:', content);
    console.log('Normalized content:', normalizedContent);

    // Try penalty bet patterns first (highest priority)
    const penaltyBet = this.parsePenaltyBet(normalizedContent, tags);
    if (penaltyBet) return penaltyBet;

    // Try bounty challenge patterns
    const bountyChallenge = this.parseBountyChallenge(normalizedContent, tags);
    if (bountyChallenge) return bountyChallenge;

    // Try other command patterns
    const otherCommand = this.parseOtherCommands(normalizedContent, tags);
    if (otherCommand) return otherCommand;

    return null;
  }

  /**
   * Normalize content for better pattern matching
   */
  normalizeContent(content) {
    return content
      .toLowerCase()
      .trim()
      // Normalize common contractions
      .replace(/won't/g, 'will not')
      .replace(/don't/g, 'do not')
      .replace(/can't/g, 'cannot')
      .replace(/i'll/g, 'i will')
      .replace(/i'm/g, 'i am')
      // Normalize spacing
      .replace(/\s+/g, ' ')
      // Normalize punctuation
      .replace(/[,;]/g, ',')
      .replace(/[.!?]+/g, '.');
  }

  /**
   * Parse penalty bet patterns
   */
  parsePenaltyBet(content, tags) {
    for (const pattern of this.patterns.penaltyBets) {
      // console.log('Testing pattern:', pattern.source);
      const match = content.match(pattern);
      // console.log('Match result:', match);
      if (match) {
        const parsed = this.extractPenaltyBetData(match, pattern, tags);
        console.log('PARSED FITNESS CHALLENGE: ', parsed);
        if (parsed && this.validatePenaltyBet(parsed)) {
          return {
            command: 'create_penalty_challenge',
            params: parsed,
            confidence: this.calculateConfidence(match, pattern),
            originalMatch: match[0]
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract penalty bet data from regex match
   */
  extractPenaltyBetData(match, pattern, tags) {
    console.log('🔧 EXTRACTING DATA:');
    console.log('Match array:', match);
    console.log('Pattern source snippet:', pattern.source.substring(0, 50));

    let exerciseCount, exerciseType, frequency, frequencyDesc, duration, durationUnit, penaltyRecipient, penaltyAmount, penaltyCurrency;

    // Handle different pattern structures based on the match groups
    // For the "per day" pattern specifically
    if (pattern.source.includes('per\\s+.*\\s+for')) {
      // Pattern: (exerciseCount, exerciseType, frequency, duration, durationUnit, penaltyAmount, penaltyCurrency, nprofile)
      [, exerciseCount, exerciseType, frequency, duration, durationUnit, penaltyAmount, penaltyCurrency, penaltyRecipient] = match;
      frequencyDesc = frequency === 'day' ? 'daily' : 
                    frequency === 'week' ? 'weekly' : 
                    frequency === 'month' ? 'monthly' : frequency;
      console.log('hey:', duration, durationUnit);
    } else if (match.length === 7 && pattern.source.includes('daily\\s+for\\s+(?:a\\s+)?')) {
      // "X exercise daily for a week/month or @friend receives N sats"
      // console.log('Using "daily for a week/month" extraction logic');
      [, exerciseCount, exerciseType, durationUnit, penaltyRecipient, penaltyAmount, penaltyCurrency] = match;
      duration = 1; // Will be converted by convertToDays()
      console.log('Extracted:', { exerciseCount, exerciseType, durationUnit, penaltyRecipient, penaltyAmount });
    } else if (match.length === 8 && pattern.source.includes('daily\\s+for\\s+')) {
      // "X exercise daily for N days/weeks or @friend receives N sats"  
      [, exerciseCount, exerciseType, duration, durationUnit, penaltyRecipient, penaltyAmount, penaltyCurrency] = match;
      console.log('Extracted:', { exerciseCount, exerciseType, durationUnit, penaltyRecipient, penaltyAmount });
    } else if (pattern.source.includes('have\\s+to')) {
      // "I have to do X Y for Z days OR I owe @friend N sats"
      [, exerciseCount, exerciseType, frequency, duration, durationUnit, penaltyAmount, penaltyCurrency, penaltyRecipient ] = match;
      console.log('Extracted!!:', { exerciseCount, exerciseType, durationUnit, penaltyAmount, penaltyCurrency, penaltyRecipient });
    } else if (pattern.source.includes('don')) {
      // "If I don't do X Y for Z days, @friend gets N sats"
      [, exerciseCount, exerciseType, duration, durationUnit, penaltyRecipient, penaltyAmount, penaltyCurrency] = match;
      console.log('Extracted:', { exerciseCount, exerciseType, durationUnit, penaltyRecipient, penaltyAmount });
    } else if (pattern.source.includes('penalty')) {
      // "X Y for Z days, penalty N sats to @friend"
      [, exerciseCount, exerciseType, duration, durationUnit, penaltyAmount, penaltyCurrency, penaltyRecipient] = match;
      console.log('Extracted:', { exerciseCount, exerciseType, durationUnit, penaltyRecipient, penaltyAmount });
    } else {
      // Flexible pattern - try to extract in order
      const groups = match.slice(1).filter(Boolean); // Remove full match and filter out undefined
      exerciseCount = groups[0];
      exerciseType = groups[1];
      duration = groups[2] || '1';
      durationUnit = groups[3] || 'day';
      penaltyRecipient = groups[4];
      penaltyAmount = groups[5];
      penaltyCurrency = groups[6];
      console.log('Extracted:', { exerciseCount, exerciseType, durationUnit, penaltyRecipient, penaltyAmount });
    }
    

    // Clean and validate extracted data
    const cleanExerciseType = this.normalizeExercise(exerciseType);
    const cleanRecipient = penaltyRecipient?.replace('@', '');
    const recipientPubkey = this.findRecipientPubkey(cleanRecipient, tags);
    console.log('duration was: ', duration, durationUnit );
    const durationInDays = this.convertToDays(parseInt(duration || 1), durationUnit); // Fixed: was convertTodays

    return {
      exercise: `${exerciseCount} ${cleanExerciseType}`,
      exerciseType: cleanExerciseType,
      exerciseCount: parseInt(exerciseCount),
      frequency: frequencyDesc || 'daily',
      duration: durationInDays,
      penaltyAmount: parseInt(penaltyAmount),
      penaltyRecipient: cleanRecipient,
      penaltyRecipientPubkey: recipientPubkey,
      fullDescription: `${exerciseCount} ${cleanExerciseType} daily for ${durationInDays} days`
    };
  }

  /**
   * Parse bounty challenge patterns
   */
  parseBountyChallenge(content, tags) {
    for (const pattern of this.patterns.bountyChallenges) {
      const match = content.match(pattern);
      if (match) {
        const parsed = this.extractBountyChallengeData(match);
        if (parsed && this.validateBountyChallenge(parsed)) {
          return {
            command: 'create_bounty_challenge',
            params: parsed,
            confidence: this.calculateConfidence(match, pattern),
            originalMatch: match[0]
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract bounty challenge data from regex match
   */
  extractBountyChallengeData(match) {
    const [, exerciseCount, exerciseType, duration, durationUnit] = match;
    
    const cleanExerciseType = this.normalizeExercise(exerciseType);
    const durationInDays = this.convertToDays(parseInt(duration), durationUnit);

    return {
      exercise: `${exerciseCount} ${cleanExerciseType}`,
      exerciseType: cleanExerciseType,
      exerciseCount: parseInt(exerciseCount),
      duration: durationInDays,
      fullDescription: `${exerciseCount} ${cleanExerciseType} daily for ${durationInDays} days`
    };
  }

  /**
   * Parse other commands (status, leaderboard, help, bounty setting)
   */
  parseOtherCommands(content, tags) {
    // Check bounty setting
    for (const pattern of this.patterns.setBounty) {
      const match = content.match(pattern);
      if (match) {
        return {
          command: 'set_bounty',
          params: {
            amount: parseInt(match[1])
          },
          confidence: 0.9,
          originalMatch: match[0]
        };
      }
    }

    // Check status queries
    for (const pattern of this.patterns.status) {
      if (pattern.test(content)) {
        return {
          command: 'get_status',
          params: {},
          confidence: 0.9,
          originalMatch: content
        };
      }
    }

    // Check leaderboard
    for (const pattern of this.patterns.leaderboard) {
      if (pattern.test(content)) {
        return {
          command: 'get_leaderboard',
          params: {},
          confidence: 0.9,
          originalMatch: content
        };
      }
    }

    // Check help
    for (const pattern of this.patterns.help) {
      if (pattern.test(content)) {
        return {
          command: 'show_help',
          params: {},
          confidence: 0.9,
          originalMatch: content
        };
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
    
    // Return cleaned original if no match found
    return exercise.replace(/s$/, ''); // Remove trailing 's'
  }

  /**
   * Convert weeks/months to days
   */
  convertToDays(duration, unit) {
    const unitLower = unit.toLowerCase();
    
    if (['week', 'weeks', 'wk', 'wks', 'w'].includes(unitLower)) {
      return duration * 7;
    }
    
    if (['month', 'months', 'mo', 'mos', 'm'].includes(unitLower)) {
      return duration * 30;
    }
    
    // Default to days
    return duration;
  }

  /**
   * Find recipient's pubkey from NOSTR tags
   */
  findRecipientPubkey(recipient, tags) {
    if (recipient.startsWith('npub')) {
      try {
        const decoded = nip19.decode(recipient);
        return decoded.data;
      } catch (e) {
        console.warn(`Invalid npub: ${recipient}`);
        return null;
      }
    }

    // Look through p tags for mentioned users
    for (const tag of tags) {
      if (tag[0] === 'p' && tag.length > 1) {
        // This is limited - we can only find pubkeys of explicitly tagged users
        return tag[1];
      }
    }

    return null;
  }

  /**
   * Calculate confidence score for pattern match
   */
  calculateConfidence(match, pattern) {
    let confidence = 0.7; // Base confidence
    
    // Higher confidence for longer matches
    if (match[0].length > 50) confidence += 0.1;
    
    // Higher confidence if all key elements present
    if (match.filter(Boolean).length > 5) confidence += 0.1;
    
    // Higher confidence for specific patterns vs flexible patterns
    if (!pattern.source.includes('.*?')) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Validate penalty bet data
   */
  validatePenaltyBet(parsed) {
    return (
      parsed.exerciseCount > 0 &&
      parsed.duration >= this.defaults.MIN_DURATION &&
      parsed.duration <= this.defaults.MAX_DURATION &&
      parsed.penaltyAmount >= this.defaults.MIN_PENALTY &&
      parsed.penaltyAmount <= this.defaults.MAX_PENALTY &&
      parsed.penaltyRecipient
    );
  }

  /**
   * Validate bounty challenge data
   */
  validateBountyChallenge(parsed) {
    return (
      parsed.exerciseCount > 0 &&
      parsed.duration >= this.defaults.MIN_DURATION &&
      parsed.duration <= this.defaults.MAX_DURATION
    );
  }

  /**
   * Get detailed parsing errors for user feedback
   */
  getParsingErrors(content) {
    const errors = [];

    // Check for common missing elements
    if (!/\d+/.test(content)) {
      errors.push('Missing numbers (exercise count, duration, or penalty amount)');
    }
    
    if (!/day|week|month/i.test(content)) {
      errors.push('Missing duration (e.g., "7 days", "2 weeks")');
    }
    
    if (!/sat|bitcoin/i.test(content) && /owe|pay|gets/i.test(content)) {
      errors.push('Missing penalty amount in sats');
    }
    
    if (/@\w+/.test(content) === false && /owe|pay|gets/i.test(content)) {
      errors.push('Missing friend mention (@username)');
    }

    return errors;
  }
}

export default SmartParser;