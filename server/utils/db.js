const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultUsers = [
    {
        id: 1,
        username: 'admin',
        password: '$2b$10$E5aN3v8h3t5f8k9j1L2Q3R4T5Y6U7I8O9P0A1S2D3F4G5H6J7K8L9M0N',
        nickname: '管理员',
        email: 'admin@example.com',
        avatar: null,
        bio: '系统管理员',
        gender: 'male',
        created_at: new Date().toISOString()
    }
];

const defaultMessages = [];

// 从环境变量读取私密频道密码
const defaultChannels = {
    Channel105: {
        password: process.env.CHANNEL105_PASSWORD || '123456',
        members: []
    }
};

function loadData() {
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    }
    const usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    
    if (!fs.existsSync(MESSAGES_FILE)) {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(defaultMessages, null, 2));
    }
    const messagesData = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    
    if (!fs.existsSync(CHANNELS_FILE)) {
        fs.writeFileSync(CHANNELS_FILE, JSON.stringify(defaultChannels, null, 2));
    }
    const channelsData = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
    
    return { usersData, messagesData, channelsData };
}

function saveData() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
}

let users, messages, channels;
let { usersData, messagesData, channelsData } = loadData();
users = usersData;
messages = messagesData;
channels = channelsData;

// 用户操作（改为异步以匹配 Supabase 接口）
async function getUserById(id) {
    return users.find(user => user.id === parseInt(id));
}

async function getUserByUsername(username) {
    return users.find(user => user.username === username);
}

async function getUserByEmail(email) {
    return users.find(user => user.email === email);
}

async function insertUser(userData) {
    const newUser = {
        id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
        username: userData.username,
        password: userData.password,
        email: userData.email || null,
        nickname: userData.nickname || userData.username,
        avatar: null,
        bio: null,
        gender: null,
        created_at: new Date().toISOString()
    };
    users.push(newUser);
    saveData();
    return newUser;
}

async function updateUser(id, userData) {
    const userId = parseInt(id);
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) return null;
    
    users[userIndex] = { ...users[userIndex], ...userData };
    saveData();
    return users[userIndex];
}

// 消息操作（改为异步）
async function getMessagesByChannel(channel) {
    return messages.filter(msg => msg.channel === channel);
}

async function getMessageById(id) {
    return messages.find(msg => msg.id === parseInt(id));
}

async function insertMessage(messageData) {
    const newMessage = {
        id: messages.length > 0 ? Math.max(...messages.map(m => m.id)) + 1 : 1,
        user_id: messageData.user_id,
        channel: messageData.channel,
        content: messageData.content || '',
        image: messageData.image || null,
        voice: messageData.voice || null,
        reply_to: messageData.reply_to || null,
        is_blocked: messageData.is_blocked || false,
        blocked_at: messageData.is_blocked ? new Date().toISOString() : null,
        is_recalled: false,
        recalled_at: null,
        created_at: new Date().toISOString()
    };
    messages.push(newMessage);
    saveData();
    return newMessage;
}

async function updateMessage(id, messageData) {
    const messageId = parseInt(id);
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return null;
    
    if (messageData.is_recalled) {
        messageData.image = null;
        messageData.voice = null;
    }
    
    messages[messageIndex] = { ...messages[messageIndex], ...messageData };
    saveData();
    return messages[messageIndex];
}

async function deleteMessage(id) {
    const messageId = parseInt(id);
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return false;
    
    messages.splice(messageIndex, 1);
    saveData();
    return true;
}

// 频道操作（新增以匹配 Supabase 接口）
async function getChannelByName(name) {
    if (!channels[name]) return null;
    return {
        name: name,
        password: channels[name].password
    };
}

async function getChannelMembers(channelName) {
    if (!channels[channelName]) return [];
    return channels[channelName].members || [];
}

async function addChannelMember(channelName, userId) {
    if (!channels[channelName]) return false;
    if (!channels[channelName].members.includes(parseInt(userId))) {
        channels[channelName].members.push(parseInt(userId));
        saveData();
    }
    return true;
}

async function removeChannelMember(channelName, userId) {
    if (!channels[channelName]) return false;
    const memberIndex = channels[channelName].members.indexOf(parseInt(userId));
    if (memberIndex !== -1) {
        channels[channelName].members.splice(memberIndex, 1);
        saveData();
    }
    return true;
}

async function isChannelMember(channelName, userId) {
    if (!channels[channelName]) return false;
    return channels[channelName].members.includes(parseInt(userId));
}

async function updateChannelPassword(channelName, newPassword) {
    if (!channels[channelName]) return false;
    channels[channelName].password = newPassword;
    saveData();
    return true;
}

module.exports = {
    // 用户操作
    getUserById,
    getUserByUsername,
    getUserByEmail,
    insertUser,
    updateUser,
    
    // 消息操作
    getMessagesByChannel,
    getMessageById,
    insertMessage,
    updateMessage,
    deleteMessage,
    
    // 频道操作
    getChannelByName,
    getChannelMembers,
    addChannelMember,
    removeChannelMember,
    isChannelMember,
    updateChannelPassword,
    
    // 保留旧接口（向后兼容）
    saveData
};
