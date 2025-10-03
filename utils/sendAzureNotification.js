const { NotificationHubsClient } = require("@azure/notification-hubs");

const client = new NotificationHubsClient(
  process.env.AZURE_NOTIFICATION_HUB_CONNECTION_STRING,
  process.env.AZURE_NOTIFICATION_HUB_NAME
);

const sendAzureNotification = async (message) => {
  const notification = {
    body: JSON.stringify({
      notification: {
        title: message.notification.title,
        body: message.notification.body,
      },
      data: message.data,
    }),
  };

  try {
    const result = await client.sendNotification(notification, {
      tagExpression: `userId:${message.topic}`, // Assuming you use topics as user IDs
    });
    console.log("Azure Notification sent: ", result);
    return result;
  } catch (error) {
    console.error("Azure Notification Error:", error);
    throw error;
  }
};

module.exports = sendAzureNotification;
