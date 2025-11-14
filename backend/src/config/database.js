const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    logger.info('Firebase Admin initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

const db = admin.firestore();

// Configure Firestore settings
db.settings({
  timestampsInSnapshots: true,
});

// Helper functions for common database operations
const createUser = async (userData) => {
  try {
    const userRef = await db.collection('users').add({
      ...userData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`User created with ID: ${userRef.id}`);
    return { id: userRef.id, ...userData };
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

const getUser = async (userId) => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    logger.error('Error getting user:', error);
    throw error;
  }
};

const getUserByEmail = async (email) => {
  try {
    const usersRef = db.collection('users');
    const query = await usersRef.where('email', '==', email).limit(1).get();

    if (query.empty) {
      return null;
    }

    const userDoc = query.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    logger.error('Error getting user by email:', error);
    throw error;
  }
};

const updateUser = async (userId, updateData) => {
  try {
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`User ${userId} updated successfully`);
    return true;
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

const createCall = async (callData) => {
  try {
    const callRef = await db.collection('calls').add({
      ...callData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Call created with ID: ${callRef.id}`);
    return { id: callRef.id, ...callData };
  } catch (error) {
    logger.error('Error creating call:', error);
    throw error;
  }
};

const updateCall = async (callId, updateData) => {
  try {
    const callRef = db.collection('calls').doc(callId);
    await callRef.update(updateData);

    logger.info(`Call ${callId} updated successfully`);
    return true;
  } catch (error) {
    logger.error('Error updating call:', error);
    throw error;
  }
};

const getActiveVolunteers = async () => {
  try {
    const usersRef = db.collection('users');
    const query = await usersRef
      .where('userType', '==', 'volunteer')
      .where('isActive', '==', true)
      .where('isAvailable', '==', true)
      .orderBy('reputationScore', 'desc')
      .get();

    return query.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logger.error('Error getting active volunteers:', error);
    throw error;
  }
};

module.exports = {
  db,
  admin,
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  createCall,
  updateCall,
  getActiveVolunteers,
};