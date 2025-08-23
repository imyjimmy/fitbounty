export const EXERCISE_TYPES = {
  'pushup': ['pushup', 'pushups', 'push-up', 'push-ups', 'push up', 'push ups', 'puships', 'pushes', 'press ups'],
  'squat': ['squat', 'squats', 'air squat', 'air squats', 'bodyweight squat', 'body weight squats', 'squads'],
  'pullup': ['pullup', 'pullups', 'pull-up', 'pull-ups', 'pull up', 'pull ups', 'chin up', 'chin ups', 'chinups'],
  'burpee': ['burpee', 'burpees', 'burpies'],
  'situp': ['situp', 'situps', 'sit-up', 'sit-ups', 'sit up', 'sit ups', 'crunches', 'crunch'],
  'plank': ['plank', 'planks', 'planking', 'plank hold'],
  'jumping jack': ['jumping jack', 'jumping jacks', 'jumpingjack', 'jumpingjacks', 'star jumps'],
  'mountain climber': ['mountain climber', 'mountain climbers', 'mountainclimber', 'mountain climbs'],
  'lunge': ['lunge', 'lunges', 'walking lunge', 'walking lunges'],
  'run': ['run', 'running', 'jog', 'jogging', 'sprint', 'sprinting'],
  'walk': ['walk', 'walking', 'steps', 'step']
};

export const DURATION_SYNONYMS = {
  'days': ['day', 'days', 'd'],
  'weeks': ['week', 'weeks', 'wk', 'wks', 'w'],
  'months': ['month', 'months', 'mo', 'mos', 'm']
};

export const PENALTY_SYNONYMS = {
  'owe': ['owe', 'owes', 'pay', 'pays', 'send', 'sends', 'give', 'gives', 'gets', 'receives'],
  'sats': ['sat', 'sats', 'satoshi', 'satoshis', 'bitcoin', 'btc']
};

export const ADVANCED_PATTERNS = {
  // Core penalty bet patterns - multiple variations
  penaltyBets: [
    // "I have to do X Y for Z days OR I owe @friend N sats"
    /(?:i\s+(?:have\s+to|need\s+to|must|will|gonna)\s+do\s+)(\d+)\s+([a-z\s-]+?)\s+(?:for\s+|daily\s+for\s+|every\s+day\s+for\s+)(\d+)\s+(day|days|week|weeks|wk|wks)\s+(?:or|otherwise)\s+i\s+(?:owe|pay|send|give)\s+(@\w+|@npub[\w\d]+)\s+(\d+)\s+(sats?|satoshis?)/i,
    
    // "If I don't do X Y for Z days, @friend gets N sats"
    /(?:if\s+i\s+(?:don'?t|do\s+not|fail\s+to)\s+do\s+)(\d+)\s+([a-z\s-]+?)\s+(?:for\s+|daily\s+for\s+)(\d+)\s+(day|days|week|weeks|wk|wks)\s*,?\s*(@\w+|@npub[\w\d]+)\s+(?:gets|receives)\s+(\d+)\s+(sats?|satoshis?)/i,
    
    // "X Y daily for Z days or @friend gets N sats"
    /(\d+)\s+([a-z\s-]+?)\s+(?:daily|every\s+day)\s+for\s+(\d+)\s+(day|days|week|weeks|wk|wks)\s+(?:or|otherwise)\s+(@\w+|@npub[\w\d]+)\s+(?:gets|receives)\s+(\d+)\s+(sats?|satoshis?)/i,
    
    // "X Y daily for a week/month or @friend gets N sats" - NEW PATTERN
    /(\d+)\s+([a-z\s-]+?)\s+daily\s+for\s+(?:a\s+)?(week|month)\s+or\s+(@\w+|@npub[\w\d]+)\s+(?:gets|receives)\s+(\d+)\s+(sats?|satoshis?)/i,
    
    // "X Y for Z days, penalty N sats to @friend"
    /(\d+)\s+([a-z\s-]+?)\s+for\s+(\d+)\s+(day|days|week|weeks|wk|wks)\s*,?\s*(?:penalty|fine|cost)\s+(\d+)\s+(sats?|satoshis?)\s+(?:to|for)\s+(@\w+|@npub[\w\d]+)/i,
    
    // Flexible catch-all pattern
    /(\d+)\s+(\w+(?:\s+\w+)?)\s+.*?(\d+)\s+(day|days|week|weeks)\s+.*?(@\w+|@npub[\w\d]+)\s+.*?(\d+)\s+(sats?|satoshis?)/i
  ],

  // Bounty challenge patterns
  bountyChallenges: [
    // "@fitbounty challenge: X Y for Z days"
    /@fitbounty\s+challenge:?\s*(\d+)\s+([a-z\s-]+?)\s+(?:for\s+|daily\s+for\s+)(\d+)\s+(day|days|week|weeks)/i,
    
    // "I want to do X Y for Z days @fitbounty"
    /(?:i\s+(?:want\s+to|will|gonna)\s+do\s+)(\d+)\s+([a-z\s-]+?)\s+(?:for\s+|daily\s+for\s+)(\d+)\s+(day|days|week|weeks)\s+.*?@fitbounty/i,
    
    // "Challenge: X Y daily for Z days"
    /challenge:?\s*(\d+)\s+([a-z\s-]+?)\s+(?:daily|every\s+day)\s+for\s+(\d+)\s+(day|days|week|weeks)/i,
    
    // "X Y daily for Z days, who wants to bet?"
    /(\d+)\s+([a-z\s-]+?)\s+(?:daily|every\s+day)\s+for\s+(\d+)\s+(day|days|week|weeks).*?(?:bet|bounty|pledge)/i
  ],

  // Bounty setting patterns  
  setBounty: [
    /@fitbounty\s+bounty\s+(\d+)\s+(sats?|satoshis?)/i,
    /(?:i'll\s+(?:put|bet|pledge)|bounty)\s+(\d+)\s+(sats?|satoshis?)/i,
    /(?:i\s+bet|betting)\s+(\d+)\s+(sats?|satoshis?)/i
  ],

  // Status and utility patterns
  status: [
    /@fitbounty\s+status/i,
    /(?:how'?s?\s+my\s+challenge|show\s+(?:my\s+)?(?:challenge\s+)?(?:status|progress))/i,
    /(?:what'?s\s+my\s+progress|check\s+my\s+challenge)/i
  ],

  leaderboard: [
    /@fitbounty\s+leaderboard/i,
    /(?:show\s+)?(?:the\s+)?leaderboard/i,
    /top\s+performers/i
  ],

  help: [
    /@fitbounty\s+help/i,
    /(?:how\s+do\s+i\s+use|what\s+(?:can\s+you\s+do|commands))/i,
    /(?:help|instructions)/i
  ]
};

export const DEFAULT_VALUES = {
  DURATION_DAYS: 3,
  MIN_PENALTY: 1,
  MAX_PENALTY: 100000,
  MIN_DURATION: 1,
  MAX_DURATION: 365,
  INVOICE_EXPIRY: 3600 // 1 hour
};