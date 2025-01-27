const admin = require('firebase-admin');
const serviceAccount = require(process.env.FIREBASE_JSON); // Add this line to require the service account key

// Initialize Firebase Admin SDK
// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount), // Use the required service account key
});

const sendFCMNotification = async (message) => {
  try {
    const response = await admin.messaging().send(message);
    console.log('FCM notification sent successfully:', response);
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    throw error;
  }
};

module.exports = { sendFCMNotification };
