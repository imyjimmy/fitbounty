// Simple in-memory storage for now - replace with actual database later
class PenaltyBetModel {
  constructor() {
    this.penaltyBets = new Map();
    this.userChallenges = new Map(); // Map user pubkey to their active challenges
  }

  /**
   * Create a new penalty bet
   */
  async create(challengeData) {
    const id = this.generateId();
    const penaltyBet = {
      id,
      userPubkey: challengeData.userPubkey,
      originalEventId: challengeData.originalEventId,
      exercise: challengeData.exercise,
      duration: challengeData.duration,
      penalty: challengeData.penalty,
      status: 'pending_payment', // pending_payment, active, completed, failed, expired
      paymentRequest: null, // Lightning invoice for escrow
      paymentHash: null,
      escrowPaid: false,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      dailyProgress: new Map(), // day -> { completed: boolean, videoHash?: string, timestamp: string }
      metadata: {
        relayUrl: challengeData.relayUrl,
        originalContent: challengeData.originalContent
      }
    };

    this.penaltyBets.set(id, penaltyBet);
    
    // Track user's active challenge
    if (this.userChallenges.has(challengeData.userPubkey)) {
      // User already has active challenge - we might want to handle this
      console.warn(`User ${challengeData.userPubkey} already has active challenge`);
    }
    this.userChallenges.set(challengeData.userPubkey, id);

    return penaltyBet;
  }

  /**
   * Get penalty bet by ID
   */
  async findById(id) {
    return this.penaltyBets.get(id) || null;
  }

  /**
   * Get penalty bet by user pubkey
   */
  async findByUserPubkey(userPubkey) {
    const challengeId = this.userChallenges.get(userPubkey);
    if (!challengeId) return null;
    return this.penaltyBets.get(challengeId);
  }

  /**
   * Update penalty bet
   */
  async update(id, updates) {
    const penaltyBet = this.penaltyBets.get(id);
    if (!penaltyBet) return null;

    const updated = { ...penaltyBet, ...updates, updatedAt: new Date().toISOString() };
    this.penaltyBets.set(id, updated);
    return updated;
  }

  /**
   * Mark escrow as paid and activate challenge
   */
  async activateChallenge(id, paymentHash) {
    const penaltyBet = this.penaltyBets.get(id);
    if (!penaltyBet) return null;

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + penaltyBet.duration.days);

    const updated = {
      ...penaltyBet,
      status: 'active',
      escrowPaid: true,
      paymentHash,
      startedAt: now.toISOString(),
      duration: {
        ...penaltyBet.duration,
        startDate: now.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    this.penaltyBets.set(id, updated);
    return updated;
  }

  /**
   * Record daily progress
   */
  async recordDailyProgress(id, day, completed, videoHash = null) {
    const penaltyBet = this.penaltyBets.get(id);
    if (!penaltyBet) return null;

    penaltyBet.dailyProgress.set(day, {
      completed,
      videoHash,
      timestamp: new Date().toISOString()
    });

    this.penaltyBets.set(id, penaltyBet);
    return penaltyBet;
  }

  /**
   * Get all active penalty bets (for monitoring)
   */
  async getActiveChallenges() {
    const active = [];
    for (const [id, penaltyBet] of this.penaltyBets) {
      if (penaltyBet.status === 'active') {
        active.push(penaltyBet);
      }
    }
    return active;
  }

  /**
   * Get challenges that should be checked for completion
   */
  async getChallengesNeedingCheck() {
    const needingCheck = [];
    const now = new Date();

    for (const [id, penaltyBet] of this.penaltyBets) {
      if (penaltyBet.status === 'active' && penaltyBet.duration.endDate) {
        const endDate = new Date(penaltyBet.duration.endDate);
        
        // Check if challenge period has ended
        if (now > endDate) {
          needingCheck.push(penaltyBet);
        }
      }
    }

    return needingCheck;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Delete penalty bet
   */
  async delete(id) {
    const penaltyBet = this.penaltyBets.get(id);
    if (penaltyBet) {
      this.userChallenges.delete(penaltyBet.userPubkey);
      this.penaltyBets.delete(id);
      return true;
    }
    return false;
  }
}

export default PenaltyBetModel;