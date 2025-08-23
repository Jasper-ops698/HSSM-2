const admin = require('firebase-admin');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  const serviceAccount = require('../firebase-admin.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/**
 * Send FCM notification
 * @param {object} message - FCM message object
 * @returns {Promise}
 */
const sendFCMNotification = async (message) => {
  try {
    const response = await admin.messaging().send(message);
    return response;
  } catch (error) {
    console.error('FCM Notification Error:', error);
    throw error;
  }
};

module.exports = sendFCMNotification;
