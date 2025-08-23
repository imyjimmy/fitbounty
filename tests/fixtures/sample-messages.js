// Sample messages for manual testing and development
export const SAMPLE_MESSAGES = {
  penaltyBets: [
    "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty",
    "I must do 50 squats for 10 days or I owe @bob 2000 sats @fitbounty",
    "If I don't do 15 pullups for 2 weeks, @charlie gets 3000 sats @fitbounty",
    "30 burpees daily for 5 days or @dave gets 1500 sats @fitbounty",
    "100 jumping jacks for 3 days, penalty 800 sats to @eve @fitbounty"
  ],

  bountyCreation: [
    "I want to do 50 pushups daily for 10 days @fitbounty",
    "@fitbounty challenge: 75 squats for 2 weeks",
    "Challenge: 100 burpees daily for 5 days @fitbounty"
  ],

  commands: [
    "@fitbounty status",
    "@fitbounty leaderboard", 
    "@fitbounty help",
    "@fitbounty bounty 1000 sats"
  ],

  edgeCases: [
    "I have to do 40 puships for 5 days or i owe @greg 1200 sats @fitbounty", // Typos
    "30 squads daily for a week or @helen receives 900 sats @fitbounty", // Variations
    "I must do 10 pullups for 2 weeks OR I owe @ivan 4000 sats @fitbounty" // Weeks
  ],

  invalid: [
    "Just a regular message",
    "I like to exercise @fitbounty",
    "@fitbounty challenge",
    "I want to do pushups @fitbounty"
  ],

  testCases: [
    // Basic penalty bets
    "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty",
    "I must do 50 squats for 10 days or I owe @bob 2000 sats @fitbounty",
    "I will do 30 burpees daily for 5 days or I owe @charlie 500 sats @fitbounty",
    
    // Alternative formats
    "If I don't do 15 pullups for 2 weeks, @dave gets 3000 sats @fitbounty",
    "25 situps daily for 7 days or @eve gets 1500 sats @fitbounty",
    "100 jumping jacks for 3 days, penalty 800 sats to @frank @fitbounty",
    
    // With typos and variations
    "I have to do 40 puships for 5 days or i owe @greg 1200 sats @fitbounty",
    "30 squads daily for a week or @helen receives 900 sats @fitbounty",
    
    // Week/month durations
    "I must do 10 pullups for 2 weeks OR I owe @ivan 4000 sats @fitbounty",
    "20 lunges daily for 1 month or @jane gets 10000 sats @fitbounty",
    
    // Bounty challenges
    "I want to do 50 pushups daily for 10 days @fitbounty",
    "@fitbounty challenge: 75 squats for 2 weeks",
    "Challenge: 100 burpees daily for 5 days @fitbounty",
    
    // Commands
    "@fitbounty status",
    "how's my challenge going? @fitbounty",
    "@fitbounty leaderboard",
    "@fitbounty help"
  ]
};