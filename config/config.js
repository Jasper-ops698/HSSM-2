require('dotenv').config();

module.exports = {
    notificationHub: {
        connectionString: process.env.NOTIFICATION_HUB_CONNECTION_STRING,
        hubName: process.env.NOTIFICATION_HUB_NAME
    }
};
