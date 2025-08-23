class CoreAPI {
  constructor(penaltyBetModel, paymentHandler, nostrClient) {
    this.penaltyBetModel = penaltyBetModel;
    this.paymentHandler = paymentHandler;
    this.nostrClient = nostrClient;
  }

  /**
   * Execute a parsed command
   * @param {Object} parsedCommand - Command from SmartParser
   * @param {Object} context - Context (event, user, relay)
   * @returns {Object} - Response data
   */
  async executeCommand(parsedCommand, context) {
    const { event, user, relay } = context;

    try {
      console.log(`🎯 Executing command: ${parsedCommand.command}`);
      console.log(`📊 Confidence: ${Math.round(parsedCommand.confidence * 100)}%`);

      switch (parsedCommand.command) {
        case 'create_penalty_challenge':
          return await this.createPenaltyChallenge(parsedCommand.params, context);

        case 'create_bounty_challenge':
          return await this.createBountyChallenge(parsedCommand.params, context);

        case 'set_bounty':
          return await this.setBounty(parsedCommand.params, context);

        case 'get_status':
          return await this.getChallengeStatus(parsedCommand.params, context);

        case 'get_leaderboard':
          return await this.getLeaderboard(parsedCommand.params, context);

        case 'show_help':
          return await this.showHelp(parsedCommand.params, context);

        default:
          return {
            type: 'error',
            message: "🤖 I didn't understand that command. Reply with '@fitbounty help' for instructions.",
            shouldReply: true
          };
      }
    } catch (error) {
      console.error(`💥 Error executing command ${parsedCommand.command}:`, error);
      return {
        type: 'error',
        message: "🤖 Sorry, I encountered an error processing your request. Please try again.",
        shouldReply: true
      };
    }
  }

  /**
   * Create penalty bet challenge
   */
  async createPenaltyChallenge(params, context) {
    const { event, user, relay } = context;
    
    console.log(`💸 Creating penalty bet challenge for ${user.npub}`);
    console.log(`📋 Exercise: ${params.exercise}`);
    console.log(`⏰ Duration: ${params.duration} days`);
    console.log(`💰 Penalty: ${params.penaltyAmount} sats to @${params.penaltyRecipient}`);

    // Create penalty bet record
    const challengeData = {
      userPubkey: user.pubkey,
      originalEventId: event.id,
      relayUrl: relay,
      originalContent: event.content,
      exercise: {
        description: params.exercise,
        type: params.exerciseType,
        amount: params.exerciseCount,
        fullDescription: params.fullDescription
      },
      duration: {
        days: params.duration
      },
      penalty: {
        amount: params.penaltyAmount,
        recipient: params.penaltyRecipient,
        recipientPubkey: params.penaltyRecipientPubkey
      },
      status: 'pending_payment'
    };

    const penaltyBet = await this.penaltyBetModel.create(challengeData);

    // Generate Lightning invoice for escrow
    const invoice = await this.paymentHandler.generateEscrowInvoice(
      penaltyBet.penalty.amount,
      `Penalty bet escrow: ${penaltyBet.exercise.fullDescription}`,
      3600 // 1 hour expiry
    );

    // Update penalty bet with payment info
    await this.penaltyBetModel.update(penaltyBet.id, {
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash
    });

    // Start monitoring for payment
    this.monitorEscrowPayment(penaltyBet.id, invoice.paymentHash);

    return {
      type: 'penalty_bet_created',
      penaltyBet,
      invoice,
      message: this.formatPenaltyBetResponse(penaltyBet, invoice),
      shouldReply: true
    };
  }

  /**
   * Create bounty challenge
   */
  async createBountyChallenge(params, context) {
    return {
      type: 'bounty_challenge_created',
      message: `🎯 **Bounty Challenge Created!**

📋 **Challenge:** ${params.fullDescription}
💰 **Bounty Pool:** 0 sats (waiting for pledges)

Friends can now pledge bounties by replying:
"@fitbounty bounty [amount] sats"

🏁 **Challenge starts when you submit your first daily video!**
📹 **Evidence Required:** Daily video proof
⏰ **Duration:** ${params.duration} days

Let's see who believes in you! 💪`,
      shouldReply: true
    };
  }

  /**
   * Set bounty on existing challenge
   */
  async setBounty(params, context) {
    return {
      type: 'bounty_set',
      message: `💰 **Bounty Pledge Received!**

Amount: ${params.amount} sats
Status: Pending payment confirmation

Pay this invoice to lock in your bounty:
\`lnbc${params.amount}u1p...\`

Your sats will be held in escrow until the challenge ends.`,
      shouldReply: true
    };
  }

  /**
   * Get challenge status
   */
  async getChallengeStatus(params, context) {
    const { user } = context;
    const challenge = await this.penaltyBetModel.findByUserPubkey(user.pubkey);
    
    if (!challenge) {
      return {
        type: 'no_challenge',
        message: "📊 You don't have any active challenges. Create one with '@fitbounty' and describe your fitness goal!",
        shouldReply: true
      };
    }

    return {
      type: 'challenge_status',
      challenge,
      message: this.formatChallengeStatus(challenge),
      shouldReply: true
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(params, context) {
    return {
      type: 'leaderboard',
      message: `🏆 **FitBounty Leaderboard**

🥇 **Top Performers This Week:**
1. @alice - 5 challenges completed (15,000 sats earned)
2. @bob - 3 challenges completed (8,500 sats earned)  
3. @charlie - 2 challenges completed (5,000 sats earned)

📈 **Challenge Stats:**
- Total challenges: 42
- Success rate: 73%
- Total sats earned: 156,000

Keep pushing! 💪`,
      shouldReply: true
    };
  }

  /**
   * Show help information
   */
  async showHelp(params, context) {
    return {
      type: 'help',
      message: `🤖 **FitBounty Help**

**🎯 Create Penalty Bet:**
"I have to do [X] [exercise] for [Y] days OR I owe @friend [amount] sats @fitbounty"

**💰 Create Bounty Challenge:**
"I want to do [X] [exercise] daily for [Y] days @fitbounty"
(Friends can then pledge bounties)

**📊 Check Status:**
"@fitbounty status" or "how's my challenge?"

**🏆 Leaderboard:**
"@fitbounty leaderboard"

**Examples:**
- "I have to do 20 pushups for 7 days OR I owe @alice 1000 sats @fitbounty"
- "Going to do 50 squats daily for 5 days @fitbounty"
- "Challenge: 100 burpees for 3 days @fitbounty"

**Advanced Examples:**
- "If I don't do 30 burpees daily for a week, @bob gets 500 sats @fitbounty"
- "25 situps for 5 days or pay @carol 2000 sats @fitbounty"
- "I must do 15 pullups daily for 10 days or @dave receives 1500 sats @fitbounty"

Ready to get fit and earn sats? 💪⚡`,
      shouldReply: true
    };
  }

  /**
   * Format penalty bet response message
   */
  formatPenaltyBetResponse(penaltyBet, invoice) {
    const recipientDisplay = penaltyBet.penalty.recipient.startsWith('npub') 
      ? `@${penaltyBet.penalty.recipient.substring(0, 12)}...`
      : `@${penaltyBet.penalty.recipient}`;

    return `💸 **Penalty Bet Accepted!**
📋 **Challenge:** ${penaltyBet.exercise.fullDescription}
💰 **Penalty:** ${penaltyBet.penalty.amount} sats to ${recipientDisplay}
⏰ **Duration:** ${penaltyBet.duration.days} days from payment

🔒 **To activate your challenge, pay this invoice:**
\`${invoice.paymentRequest}\`

**Your sats will be held in escrow:**
- ✅ Challenge completed: Full refund to you
- ❌ Challenge failed: Payment sent to ${recipientDisplay}
⏱️ Challenge expired: Full refund to you
⚡ Invoice expires in 1 hour
💪 Pay now to start your accountability journey!
Challenge ID: \'${penaltyBet.id}\``;
  }

/**
 * Format challenge status message
*/
formatChallengeStatus(challenge) {
  const progress = Array.from(challenge.dailyProgress.values());
  const completedDays = progress.filter(p => p.completed).length;
  const totalDays = challenge.duration.days;
  
  let statusEmoji = '⏳';
  let statusText = 'Pending Payment';

  if (challenge.status === 'active') {
    statusEmoji = '🏃‍♂️';
    statusText = `Active - Day ${completedDays}/${totalDays}`;
  } else if (challenge.status === 'completed') {
    statusEmoji = '🏆';
    statusText = 'Completed';
  } else if (challenge.status === 'failed') {
    statusEmoji = '❌';
    statusText = 'Failed';
  }

  return `📊 **Challenge Status**
    ${statusEmoji} Status: ${statusText}
    📋 Exercise: ${challenge.exercise.fullDescription}
    💰 Penalty: challenge.penalty.amountsatsto@{challenge.penalty.amount} sats to @
    challenge.penalty.amountsatsto@{challenge.penalty.recipient}

    Progress: completedDays/{completedDays}/
    completedDays/{totalDays} days completed
    ′█′.repeat(completedDays){'█'.repeat(completedDays)}
    ′█′.repeat(completedDays){'░'.repeat(totalDays - completedDays)} ${Math.round(completedDays/totalDays * 100)}%

    ${challenge.status === 'active' ? '📹 Submit your daily video to continue!' : ''}`;
}

/**
 * Monitor escrow payment
*/
async monitorEscrowPayment(challengeId, paymentHash) {
console.log(`👀 Monitoring escrow payment for challenge ${challengeId}`);
  const checkPayment = async () => {
    try {
      const paymentStatus = await this.paymentHandler.checkInvoicePayment(paymentHash);    
      if (paymentStatus.paid) {
        console.log(`💰 Escrow payment received for challenge ${challengeId}`);
        const activatedChallenge = await this.penaltyBetModel.activateChallenge(challengeId, paymentHash);
        
        if (activatedChallenge) {
          console.log(`🎯 Challenge activated: ${challengeId}`);
        }
        return;
      }
        
      if (paymentStatus.expired) {
        console.log(`⏰ Escrow invoice expired for challenge ${challengeId}`);
        await this.penaltyBetModel.update(challengeId, { status: 'expired' });
        return;
      }
        
      setTimeout(checkPayment, 30000);
        
      } catch (error) {
        console.error(`💥 Error monitoring payment for ${challengeId}:`, error);
      }
  };

  setTimeout(checkPayment, 10000);
  }
}

export default CoreAPI;