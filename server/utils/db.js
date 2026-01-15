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

// 防抖保存 - 避免频繁写入文件
let saveTimeout = null;
const SAVE_DELAY = 500; // 500ms 延迟

function saveData() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
            fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
            fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
        } catch (error) {
            console.error('保存数据失败:', error);
        }
    }, SAVE_DELAY);
}

// 立即保存（用于关键操作）
function saveDataImmediate() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
        fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

let users, messages, channels;
let { usersData, messagesData, channelsData } = loadData();
users = usersData;
messages = messagesData;
channels = channelsData;

// 用户操作（改为异步以匹配 Supabase 接口）
function getUserById(id) {
    return users.find(user => user.id === parseInt(id));
}

function getUserByUsername(username) {
    return users.find(user => user.username === username);
}

function getUserByEmail(email) {
    return users.find(user => user.email === email);
}

function insertUser(userData) {
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
    saveDataImmediate(); // 用户注册立即保存
    return newUser;
}

function updateUser(id, userData) {
    const userId = parseInt(id);
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) return null;
    
    users[userIndex] = { ...users[userIndex], ...userData };
    saveData(); // 用户更新延迟保存
    return users[userIndex];
}

// 消息操作（改为异步）
function getMessagesByChannel(channel) {
    return messages.filter(msg => msg.channel === channel);
}

function getMessageById(id) {
    return messages.find(msg => msg.id === parseInt(id));
}

function insertMessage(messageData) {
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
    saveData(); // 消息延迟保存
    return newMessage;
}

function updateMessage(id, messageData) {
    const messageId = parseInt(id);
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return null;
    
    if (messageData.is_recalled) {
        messageData.image = null;
        messageData.voice = null;
    }
    
    messages[messageIndex] = { ...messages[messageIndex], ...messageData };
    saveData(); // 消息更新延迟保存
    return messages[messageIndex];
}

function deleteMessage(id) {
    const messageId = parseInt(id);
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return false;
    
    messages.splice(messageIndex, 1);
    saveData(); // 消息删除延迟保存
    return true;
}

// 频道操作（新增以匹配 Supabase 接口）
function getChannelByName(name) {
    if (!channels[name]) return null;
    return {
        name: name,
        password: channels[name].password
    };
}

function getChannelMembers(channelName) {
    if (!channels[channelName]) return [];
    return channels[channelName].members || [];
}

function addChannelMember(channelName, userId) {
    if (!channels[channelName]) return false;
    if (!channels[channelName].members.includes(parseInt(userId))) {
        channels[channelName].members.push(parseInt(userId));
        saveData(); // 频道成员延迟保存
    }
    return true;
}

function removeChannelMember(channelName, userId) {
    if (!channels[channelName]) return false;
    const memberIndex = channels[channelName].members.indexOf(parseInt(userId));
    if (memberIndex !== -1) {
        channels[channelName].members.splice(memberIndex, 1);
        saveData(); // 频道成员延迟保存
    }
    return true;
}

function isChannelMember(channelName, userId) {
    if (!channels[channelName]) return false;
    return channels[channelName].members.includes(parseInt(userId));
}

function updateChannelPassword(channelName, newPassword) {
    if (!channels[channelName]) return false;
    channels[channelName].password = newPassword;
    saveDataImmediate(); // 密码修改立即保存
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
    saveData,
    saveDataImmediate
};

// 进程退出时立即保存
process.on('SIGINT', () => {
    saveDataImmediate();
    process.exit(0);
});

process.on('SIGTERM', () => {
    saveDataImmediate();
    process.exit(0);
});
