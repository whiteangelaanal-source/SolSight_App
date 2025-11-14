const {
  connection,
  serverKeypair,
  sendSOL,
  validateWalletAddress,
  getTransactionStatus,
  REPUTATION_PROGRAM_ID,
  createReputationAccount,
  updateReputationOnChain
} = require('../config/blockchain');
const {
  getUser,
  updateUser,
  createCall,
  updateCall,
  getUserByEmail
} = require('../config/database');
const { BlockchainError, ValidationError, NotFoundError } = require('../utils/errors');
const config = require('../config/server');
const { logBlockchainTransaction } = require('../utils/logger');

class BlockchainService {
  constructor() {
    this.transactionQueue = [];
    this.isProcessingQueue = false;
    this.failedTransactions = new Map(); // transactionId -> retry count
    this.maxRetries = 3;
  }

  // Initialize user reputation on blockchain
  async initializeUserReputation(userId) {
    try {
      const user = await getUser(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      if (!user.walletAddress) {
        throw new ValidationError('User must have a wallet address');
      }

      if (!validateWalletAddress(user.walletAddress)) {
        throw new ValidationError('Invalid wallet address');
      }

      // Create on-chain reputation account
      const result = await createReputationAccount(user.walletAddress);

      // Update user record
      await updateUser(userId, {
        reputationInitialized: true,
        reputationInitializedAt: new Date().toISOString(),
      });

      logBlockchainTransaction('reputation_initialized', result.account, null, user.walletAddress, 0);

      return {
        success: true,
        account: result.account,
        message: 'User reputation initialized on blockchain',
      };
    } catch (error) {
      logBlockchainTransaction('reputation_init_failed', null, null, userId, 0);
      throw error;
    }
  }

  // Update user reputation on blockchain
  async updateUserReputation(userId, newScore, reason = 'Reputation update') {
    try {
      const user = await getUser(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      if (!user.walletAddress) {
        throw new ValidationError('User must have a wallet address');
      }

      // Update on-chain reputation
      const result = await updateReputationOnChain(user.walletAddress, newScore);

      // Update database record
      await updateUser(userId, {
        reputationScore: newScore,
        reputationUpdatedAt: new Date().toISOString(),
        reputationUpdateReason: reason,
      });

      logBlockchainTransaction('reputation_updated', result.account, null, user.walletAddress, newScore);

      return {
        success: true,
        newScore,
        previousScore: user.reputationScore,
        message: 'Reputation updated successfully',
      };
    } catch (error) {
      logBlockchainTransaction('reputation_update_failed', null, null, userId, newScore);
      throw error;
    }
  }

  // Calculate reward amount based on call
  calculateRewardAmount(callData) {
    const { durationSeconds, rating, helpCategory, responseTimeMs } = callData;
    let reward = 0;

    // Base reward by duration
    if (durationSeconds <= 1800) { // Up to 30 minutes
      reward = config.rewards.shortCall;
    } else if (durationSeconds <= 3600) { // Up to 60 minutes
      reward = config.rewards.mediumCall;
    } else { // Over 60 minutes
      reward = config.rewards.longCall;
    }

    // Bonuses
    if (rating === 5) {
      reward += config.rewards.perfectRating;
    }

    if (responseTimeMs && responseTimeMs < 30000) { // Less than 30 seconds
      reward += config.rewards.quickResponse;
    }

    return reward;
  }

  // Calculate milestone rewards
  async calculateMilestoneReward(userId) {
    try {
      const user = await getUser(userId);
      if (!user || user.userType !== 'volunteer') {
        return 0;
      }

      const { totalCalls } = user;
      let milestoneReward = 0;
      let milestoneReason = '';

      if (totalCalls === 10) {
        milestoneReward = config.rewards.calls10;
        milestoneReason = '10 calls milestone';
      } else if (totalCalls === 50) {
        milestoneReward = config.rewards.calls50;
        milestoneReason = '50 calls milestone';
      } else if (totalCalls === 100) {
        milestoneReward = config.rewards.calls100;
        milestoneReason = '100 calls milestone';
      } else if (totalCalls === 500) {
        milestoneReward = config.rewards.calls500;
        milestoneReason = '500 calls milestone';
      } else if (totalCalls === 1000) {
        milestoneReward = config.rewards.calls1000;
        milestoneReason = '1000 calls milestone';
      }

      return { reward: milestoneReward, reason: milestoneReason };
    } catch (error) {
      throw error;
    }
  }

  // Queue reward transaction
  async queueRewardTransaction(userId, amount, reason, callId = null, type = 'call_completion') {
    try {
      const user = await getUser(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      if (!user.walletAddress) {
        throw new ValidationError('User must have a wallet address');
      }

      if (!validateWalletAddress(user.walletAddress)) {
        throw new ValidationError('Invalid wallet address');
      }

      if (amount <= 0) {
        throw new ValidationError('Reward amount must be positive');
      }

      const transaction = {
        id: `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        walletAddress: user.walletAddress,
        amount,
        reason,
        callId,
        type,
        status: 'queued',
        createdAt: Date.now(),
        retryCount: 0,
      };

      this.transactionQueue.push(transaction);

      // Start processing queue if not already running
      this.processTransactionQueue();

      logBlockchainTransaction('reward_queued', transaction.id, null, user.walletAddress, amount);

      return {
        success: true,
        transactionId: transaction.id,
        amount,
        status: 'queued',
        message: 'Reward transaction queued',
      };
    } catch (error) {
      logBlockchainTransaction('reward_queue_failed', null, null, userId, amount);
      throw error;
    }
  }

  // Process transaction queue
  async processTransactionQueue() {
    if (this.isProcessingQueue || !serverKeypair) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.transactionQueue.length > 0) {
        const transaction = this.transactionQueue.shift();

        try {
          // Get server wallet balance
          const balance = await connection.getBalance(serverKeypair.publicKey);
          const balanceSOL = balance / 1e9;

          // Check if enough SOL for transaction
          if (balanceSOL < transaction.amount + 0.002) { // Add buffer for fees
            // Re-queue for later
            transaction.retryCount++;
            if (transaction.retryCount < this.maxRetries) {
              this.transactionQueue.push(transaction);
              await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
            } else {
              this.failedTransactions.set(transaction.id, transaction);
              logBlockchainTransaction('reward_failed_insufficient_balance', transaction.id, null, transaction.walletAddress, transaction.amount);
            }
            continue;
          }

          // Send SOL to user
          const signature = await sendSOL(transaction.walletAddress, transaction.amount);

          // Update transaction status
          transaction.status = 'completed';
          transaction.signature = signature;
          transaction.completedAt = Date.now();

          // Record transaction in database
          const { db } = require('../config/database');
          await db.collection('transactions').add({
            userId: transaction.userId,
            transactionHash: signature,
            transactionType: 'reward',
            amount: transaction.amount,
            reason: transaction.reason,
            callId: transaction.callId,
            status: 'confirmed',
            createdAt: new Date(transaction.createdAt).toISOString(),
            completedAt: new Date(transaction.completedAt).toISOString(),
          });

          // Update user rewards
          const { db: firestore } = require('../config/database');
          await firestore.collection('rewards').add({
            userId: transaction.userId,
            rewardType: transaction.type,
            amount: transaction.amount,
            reason: transaction.reason,
            transactionHash: signature,
            isDistributed: true,
            createdAt: new Date().toISOString(),
          });

          logBlockchainTransaction('reward_sent', signature, serverKeypair.publicKey.toString(), transaction.walletAddress, transaction.amount);

        } catch (error) {
          transaction.retryCount++;
          transaction.lastError = error.message;

          if (transaction.retryCount < this.maxRetries) {
            // Re-queue for retry
            this.transactionQueue.push(transaction);
            logBlockchainTransaction('reward_retry', transaction.id, null, transaction.walletAddress, transaction.amount);
          } else {
            this.failedTransactions.set(transaction.id, transaction);
            logBlockchainTransaction('reward_failed', transaction.id, null, transaction.walletAddress, transaction.amount);
          }
        }

        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Process completed call and distribute rewards
  async processCompletedCall(callId) {
    try {
      const { db } = require('../config/database');
      const callsRef = db.collection('calls');
      const callDoc = await callsRef.doc(callId).get();

      if (!callDoc.exists) {
        throw new NotFoundError('Call');
      }

      const callData = { id: callDoc.id, ...callDoc.data() };

      if (callData.status !== 'completed') {
        throw new ValidationError('Call must be completed to process rewards');
      }

      // Queue call completion reward
      const rewardAmount = this.calculateRewardAmount(callData);
      await this.queueRewardTransaction(
        callData.volunteerUserId,
        rewardAmount,
        `Completed ${Math.ceil(callData.durationSeconds / 60)}-minute call`,
        callId,
        'call_completion'
      );

      // Check for milestone rewards
      const milestoneReward = await this.calculateMilestoneReward(callData.volunteerUserId);
      if (milestoneReward.reward > 0) {
        await this.queueRewardTransaction(
          callData.volunteerUserId,
          milestoneReward.reward,
          milestoneReward.reason,
          callId,
          'milestone'
        );
      }

      // Update volunteer statistics
      const { updateUser } = require('../config/database');
      await updateUser(callData.volunteerUserId, {
        totalCalls: callData.totalCalls + 1,
        totalHelpMinutes: callData.totalHelpMinutes + Math.ceil(callData.durationSeconds / 60),
        lastActiveCall: callId,
      });

      // Update reputation
      const newReputation = callData.reputationScore + 10; // Base reputation for completed call
      await this.updateUserReputation(
        callData.volunteerUserId,
        newReputation,
        `Completed call: ${callId}`
      );

      return {
        success: true,
        rewards: {
          callCompletion: rewardAmount,
          milestone: milestoneReward.reward,
          total: rewardAmount + milestoneReward.reward,
        },
        reputation: {
          previous: callData.reputationScore,
          new: newReputation,
          increase: 10,
        },
        message: 'Call rewards processed successfully',
      };
    } catch (error) {
      logBlockchainTransaction('call_processing_failed', null, null, callId, 0);
      throw error;
    }
  }

  // Get transaction status
  async getTransactionStatus(transactionId) {
    try {
      const { db } = require('../config/database');
      const transactionsRef = db.collection('transactions');
      const query = await transactionsRef.where('transactionHash', '==', transactionId).limit(1).get();

      if (query.empty) {
        return null;
      }

      const transaction = { id: query.docs[0].id, ...query.docs[0].data() };

      // Get blockchain confirmation status if needed
      if (transaction.status === 'pending' && transaction.transactionHash) {
        try {
          const blockchainStatus = await getTransactionStatus(transaction.transactionHash);
          if (blockchainStatus.value.err === null) {
            transaction.status = 'confirmed';
            await transactionsRef.doc(transaction.id).update({ status: 'confirmed' });
          }
        } catch (error) {
          // Couldn't verify, keep pending
        }
      }

      return transaction;
    } catch (error) {
      throw error;
    }
  }

  // Get user transaction history
  async getUserTransactionHistory(userId, limit = 20) {
    try {
      const { db } = require('../config/database');
      const transactionsRef = db.collection('transactions');
      const query = await transactionsRef
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }

  // Get user rewards
  async getUserRewards(userId, limit = 20) {
    try {
      const { db } = require('../config/database');
      const rewardsRef = db.collection('rewards');
      const query = await rewardsRef
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      throw error;
    }
  }

  // Get queue status
  getQueueStatus() {
    return {
      queuedTransactions: this.transactionQueue.length,
      isProcessing: this.isProcessingQueue,
      failedTransactions: this.failedTransactions.size,
      pendingTransactions: this.transactionQueue.filter(tx => tx.status === 'queued').length,
    };
  }

  // Retry failed transactions
  async retryFailedTransactions() {
    const retryableTransactions = Array.from(this.failedTransactions.values())
      .filter(tx => tx.retryCount < this.maxRetries);

    for (const transaction of retryableTransactions) {
      this.failedTransactions.delete(transaction.id);
      transaction.retryCount = 0;
      this.transactionQueue.push(transaction);
    }

    this.processTransactionQueue();

    return {
      retriedCount: retryableTransactions.length,
      message: `Retrying ${retryableTransactions.length} failed transactions`,
    };
  }
}

// Start blockchain service
const blockchainService = new BlockchainService();

// Periodically process queue
setInterval(() => {
  blockchainService.processTransactionQueue();
}, 30000); // Every 30 seconds

// Periodically retry failed transactions
setInterval(() => {
  blockchainService.retryFailedTransactions();
}, 60000); // Every minute

module.exports = blockchainService;