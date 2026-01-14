/**
 * 数据库适配器
 * 根据环境变量 DB_TYPE 选择使用 JSON 文件存储或 Supabase
 */

require('dotenv').config();

const DB_TYPE = process.env.DB_TYPE || 'json';

let db;

if (DB_TYPE === 'supabase') {
    console.log('✓ 使用 Supabase 数据库');
    db = require('./db-supabase');
} else {
    console.log('✓ 使用 JSON 文件存储');
    // JSON 数据库的同步方法需要包装成异步
    const jsonDb = require('./db');
    
    // 包装同步方法为异步
    db = {
        getUserById: async (id) => jsonDb.getUserById(id),
        getUserByUsername: async (username) => jsonDb.getUserByUsername(username),
        getUserByEmail: async (email) => jsonDb.getUserByEmail(email),
        insertUser: async (userData) => jsonDb.insertUser(userData),
        updateUser: async (id, userData) => jsonDb.updateUser(id, userData),
        
        getMessagesByChannel: async (channel) => jsonDb.getMessagesByChannel(channel),
        getMessageById: async (id) => jsonDb.getMessageById(id),
        insertMessage: async (messageData) => jsonDb.insertMessage(messageData),
        updateMessage: async (id, messageData) => jsonDb.updateMessage(id, messageData),
        deleteMessage: async (id) => jsonDb.deleteMessage(id),
        
        getChannelByName: async (name) => jsonDb.getChannelByName(name),
        getChannelMembers: async (channelName) => jsonDb.getChannelMembers(channelName),
        addChannelMember: async (channelName, userId) => jsonDb.addChannelMember(channelName, userId),
        removeChannelMember: async (channelName, userId) => jsonDb.removeChannelMember(channelName, userId),
        isChannelMember: async (channelName, userId) => jsonDb.isChannelMember(channelName, userId),
        updateChannelPassword: async (channelName, newPassword) => jsonDb.updateChannelPassword(channelName, newPassword),
        
        channels: jsonDb.channels,
        saveData: () => jsonDb.saveData()
    };
}

module.exports = db;
