import { LN } from "@getalby/sdk";

class PaymentHandler {
  constructor(nwcConnectionString) {
    if (!nwcConnectionString) {
      throw new Error('NWC_CONNECTION_STRING is required');
    }
    
    this.ln = new LN(nwcConnectionString);
    this.activeInvoices = new Map(); // Track pending invoices
    this.escrowFunds = new Map(); // Track escrowed funds by challenge ID
    
    console.log('💰 Payment handler initialized with NWC');
  }

  // Create invoice for bounty/penalty escrow
  async createEscrowInvoice(challengeId, amountSats, type, description) {
    try {
      console.log(`💸 Creating ${type} invoice: ${amountSats} sats for challenge ${challengeId}`);
      
      const invoice = await this.ln.receive({
        satoshi: amountSats,
        description: `FitBounty ${type}: ${description}`
      });

      // Store invoice details
      this.activeInvoices.set(invoice.paymentRequest, {
        challengeId,
        amountSats,
        type, // 'bounty' or 'penalty'
        description,
        createdAt: Date.now()
      });

      // Set up payment listener
      invoice.onPaid(() => {
        this.handleEscrowPayment(invoice.paymentRequest, challengeId, amountSats, type);
      });

      console.log(`✅ Invoice created: ${invoice.paymentRequest.slice(0, 20)}...`);
      
      return {
        invoice: invoice.paymentRequest,
        paymentHash: invoice.paymentHash,
        challengeId,
        amountSats
      };

    } catch (error) {
      console.error(`💥 Failed to create invoice:`, error);
      throw error;
    }
  }

  // Handle when escrow invoice gets paid
  handleEscrowPayment(invoice, challengeId, amountSats, type) {
    console.log(`✅ ${type} payment received: ${amountSats} sats for challenge ${challengeId}`);
    
    // Move to escrow
    if (!this.escrowFunds.has(challengeId)) {
      this.escrowFunds.set(challengeId, {
        bounties: [],
        penalties: [],
        totalBounty: 0,
        totalPenalty: 0
      });
    }

    const escrow = this.escrowFunds.get(challengeId);
    
    if (type === 'bounty') {
      escrow.bounties.push({ amountSats, paidAt: Date.now() });
      escrow.totalBounty += amountSats;
    } else if (type === 'penalty') {
      escrow.penalties.push({ amountSats, paidAt: Date.now() });
      escrow.totalPenalty += amountSats;
    }

    // Clean up invoice tracking
    this.activeInvoices.delete(invoice);
    
    console.log(`🏦 Escrow updated for ${challengeId}: ${escrow.totalBounty} bounty sats, ${escrow.totalPenalty} penalty sats`);
  }

  // Payout bounties when challenge is completed successfully
  async payoutBounties(challengeId, recipientInvoice) {
    const escrow = this.escrowFunds.get(challengeId);
    if (!escrow || escrow.totalBounty === 0) {
      throw new Error(`No bounty funds in escrow for challenge ${challengeId}`);
    }

    try {
      console.log(`💰 Paying out ${escrow.totalBounty} sats to challenge winner`);
      
      const payment = await this.ln.pay(recipientInvoice);
      
      console.log(`✅ Bounty payout successful: ${escrow.totalBounty} sats`);
      
      // Return penalty funds to challenger (they succeeded)
      if (escrow.totalPenalty > 0) {
        console.log(`🔄 Returning ${escrow.totalPenalty} penalty sats to challenger`);
        // TODO: Need challenger's invoice for refund
      }

      // Clear escrow
      this.escrowFunds.delete(challengeId);
      
      return {
        success: true,
        amountPaid: escrow.totalBounty,
        paymentHash: payment.paymentHash
      };

    } catch (error) {
      console.error(`💥 Bounty payout failed:`, error);
      throw error;
    }
  }

  // Execute penalty when challenge fails
  async executePenalty(challengeId, penaltyRecipientInvoice) {
    const escrow = this.escrowFunds.get(challengeId);
    if (!escrow || escrow.totalPenalty === 0) {
      throw new Error(`No penalty funds in escrow for challenge ${challengeId}`);
    }

    try {
      console.log(`💸 Executing penalty: ${escrow.totalPenalty} sats`);
      
      const payment = await this.ln.pay(penaltyRecipientInvoice);
      
      console.log(`✅ Penalty executed: ${escrow.totalPenalty} sats sent`);
      
      // Return bounty funds to bounty setters
      if (escrow.totalBounty > 0) {
        console.log(`🔄 Returning ${escrow.totalBounty} bounty sats to contributors`);
        // TODO: Need bounty setters' invoices for refunds
      }

      // Clear escrow
      this.escrowFunds.delete(challengeId);
      
      return {
        success: true,
        amountPaid: escrow.totalPenalty,
        paymentHash: payment.paymentHash
      };

    } catch (error) {
      console.error(`💥 Penalty execution failed:`, error);
      throw error;
    }
  }

  // Get escrow status for a challenge
  getEscrowStatus(challengeId) {
    const escrow = this.escrowFunds.get(challengeId);
    if (!escrow) {
      return { totalBounty: 0, totalPenalty: 0, bountyCount: 0, penaltyCount: 0 };
    }

    return {
      totalBounty: escrow.totalBounty,
      totalPenalty: escrow.totalPenalty,
      bountyCount: escrow.bounties.length,
      penaltyCount: escrow.penalties.length,
      bounties: escrow.bounties,
      penalties: escrow.penalties
    };
  }

  // Clean up expired invoices
  cleanupExpiredInvoices() {
    const now = Date.now();
    const expireTime = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [invoice, data] of this.activeInvoices.entries()) {
      if (now - data.createdAt > expireTime) {
        console.log(`🧹 Cleaning up expired invoice for challenge ${data.challengeId}`);
        this.activeInvoices.delete(invoice);
      }
    }
  }
}

export default PaymentHandler;