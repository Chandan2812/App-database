const { Expo } = require('expo-server-sdk');

// Initialize Expo SDK client
let expo = new Expo();

// Function to send a push notification
const sendPushNotification = async (pushToken, message) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error("Invalid Expo push token");
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title: 'New Message',
    body: message,
  }];

  try {
    const response = await expo.sendPushNotificationsAsync(messages);
    console.log("Push notification sent:", response);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

module.exports = sendPushNotification;
