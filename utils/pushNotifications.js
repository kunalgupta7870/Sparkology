const { Expo } = require('expo-server-sdk');
const DeviceToken = require('../models/DeviceToken');

// Create a new Expo SDK client
let expo = new Expo();

// Send push notification to a single device
const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  try {
    // Check that the token is a valid Expo push token
    if (!Expo.isExpoPushToken(expoPushToken)) {
      console.error(`Push token ${expoPushToken} is not a valid Expo push token`);
      return { success: false, error: 'Invalid push token' };
    }

    // Construct the notification message
    const message = {
      to: expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      badge: 1, // iOS badge count
      priority: 'high',
      channelId: 'default', // Android notification channel
    };

    // Send the notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];
    
    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
        return { success: false, error: error.message };
      }
    }

    // Check for errors in tickets
    for (let ticket of tickets) {
      if (ticket.status === 'error') {
        console.error('Push notification error:', ticket.message);
        // If the token is invalid, mark it as inactive
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          await DeviceToken.removeToken(expoPushToken);
        }
        return { success: false, error: ticket.message };
      }
    }

    return { success: true, tickets };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
};

// Send push notifications to multiple users
const sendPushNotificationsToUsers = async (userIds, userModel, title, body, data = {}) => {
  try {
    // Get all active device tokens for the users
    const deviceTokens = await DeviceToken.find({
      userId: { $in: userIds },
      userModel: userModel,
      isActive: true
    });

    if (deviceTokens.length === 0) {
      console.log('No device tokens found for users');
      return { success: true, sent: 0 };
    }

    const expoPushTokens = deviceTokens.map(token => token.expoPushToken);
    
    // Filter out invalid tokens
    const validTokens = expoPushTokens.filter(token => Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      console.log('No valid push tokens found');
      return { success: true, sent: 0 };
    }

    // Construct messages
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      badge: 1,
      priority: 'high',
      channelId: 'default',
    }));

    // Send notifications in chunks
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    
    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    // Check for errors and clean up invalid tokens
    let sentCount = 0;
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = validTokens[i];
      
      if (ticket.status === 'error') {
        console.error('Push notification error for token:', token, ticket.message);
        // If the token is invalid, mark it as inactive
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          await DeviceToken.removeToken(token);
        }
      } else {
        sentCount++;
      }
    }

    return { success: true, sent: sentCount, total: validTokens.length };
  } catch (error) {
    console.error('Error sending push notifications to users:', error);
    return { success: false, error: error.message };
  }
};

// Send push notification to a single user (student or teacher)
const sendPushNotificationToUser = async (userId, userModel, title, body, data = {}) => {
  try {
    const deviceTokens = await DeviceToken.getUserTokens(userId, userModel);
    
    if (deviceTokens.length === 0) {
      console.log(`No device tokens found for user ${userId}`);
      return { success: true, sent: 0 };
    }

    const results = await Promise.all(
      deviceTokens.map(token => 
        sendPushNotification(token.expoPushToken, title, body, data)
      )
    );

    const sentCount = results.filter(r => r.success).length;
    
    return { 
      success: true, 
      sent: sentCount, 
      total: deviceTokens.length 
    };
  } catch (error) {
    console.error('Error sending push notification to user:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPushNotification,
  sendPushNotificationsToUsers,
  sendPushNotificationToUser
};

