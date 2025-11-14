const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } = require('@solana/web3.js');
const logger = require('../utils/logger');

// Solana network configuration
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;

const getNetworkUrl = () => {
  switch (SOLANA_NETWORK) {
    case 'mainnet-beta':
      return 'https://api.mainnet-beta.solana.com';
    case 'testnet':
      return 'https://api.testnet.solana.com';
    case 'devnet':
      return 'https://api.devnet.solana.com';
    default:
      return 'https://api.devnet.solana.com';
  }
};

// Initialize Solana connection
const connection = new Connection(getNetworkUrl(), 'confirmed');

// Initialize server wallet (for reward distribution)
let serverKeypair = null;

try {
  if (SOLANA_PRIVATE_KEY) {
    const privateKeyArray = JSON.parse(SOLANA_PRIVATE_KEY);
    serverKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    logger.info('Server wallet initialized successfully');
  } else {
    logger.warn('No SOLANA_PRIVATE_KEY provided. Blockchain transactions will be disabled.');
  }
} catch (error) {
  logger.error('Failed to initialize server wallet:', error);
}

// Helper functions
const getWalletBalance = async (publicKey) => {
  try {
    const balance = await connection.getBalance(new PublicKey(publicKey));
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    logger.error('Error getting wallet balance:', error);
    throw error;
  }
};

const sendSOL = async (toPublicKey, amountSOL) => {
  if (!serverKeypair) {
    throw new Error('Server wallet not initialized');
  }

  try {
    const toPubkey = new PublicKey(toPublicKey);
    const lamports = amountSOL * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: serverKeypair.publicKey,
        toPubkey: toPubkey,
        lamports,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [serverKeypair]);

    logger.info(`SOL transfer completed: ${amountSOL} SOL to ${toPublicKey}, signature: ${signature}`);
    return signature;
  } catch (error) {
    logger.error('Error sending SOL:', error);
    throw error;
  }
};

const validateWalletAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

const getTransactionStatus = async (signature) => {
  try {
    const status = await connection.confirmTransaction(signature, 'confirmed');
    return status.value;
  } catch (error) {
    logger.error('Error getting transaction status:', error);
    throw error;
  }
};

// Reputation Program configuration (placeholder for future implementation)
const REPUTATION_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // System program for now

const createReputationAccount = async (userPublicKey) => {
  // Placeholder for future reputation system implementation
  logger.info(`Creating reputation account for ${userPublicKey}`);
  return { success: true, account: userPublicKey };
};

const updateReputationOnChain = async (userPublicKey, newScore) => {
  // Placeholder for future reputation system implementation
  logger.info(`Updating reputation for ${userPublicKey} to ${newScore}`);
  return { success: true, newScore };
};

module.exports = {
  connection,
  serverKeypair,
  getNetworkUrl,
  getWalletBalance,
  sendSOL,
  validateWalletAddress,
  getTransactionStatus,
  REPUTATION_PROGRAM_ID,
  createReputationAccount,
  updateReputationOnChain,
};