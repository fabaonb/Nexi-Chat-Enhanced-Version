/**
 * Vercel Serverless API
 * 用于 Vercel 部署的入口文件
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const db = require('../server/utils/db-adapter');
const logger = require('../server/utils/log');
const badWordsFilter = require('../server/utils/badwords');
const pusher = require('../server/config/pusher');

const app = express();

// 从环境变量或配置文件读取所有敏感配置
const config = require('../server/config/config');
const JWT_SECRET = config.JWT_SECRET;
const CHANNELS = config.CHANNELS;
const REGISTRATION_ENABLED = config.REGISTRATION_ENABLED;
const VERSION = config.VERSION;
const ADMIN_CREDENTIALS = config.ADMIN_CREDENTIALS;

app.use(cors({
    origin: config.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 认证中间件
const authenticateUser = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        next();
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        next();
    }
};

const authenticateAdmin = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Admin token required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.admin) {
            next();
        } else {
            res.status(403).json({ error: 'Not authorized as admin' });
        }
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// 文件上传配置（使用内存存储，因为 Vercel 文件系统是只读的）
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ============ API 路由 ============

// 注册状态
app.get('/api/registration-status', (req, res) => {
    res.json({ enabled: REGISTRATION_ENABLED });
});

// 版本信息
app.get('/api/version', (req, res) => {
    res.json({ version: VERSION });
});

// 频道密码验证
app.post('/api/channel/verify-password', async (req, res) => {
    const { channel, password, userId } = req.body;
    
    const channelData = await db.getChannelByName(channel);
    if (!channelData || !channelData.password) {
        return res.status(400).json({ error: 'Not a private channel' });
    }
    
    if (channelData.password === password) {
        await db.addChannelMember(channel, userId);
        return res.json({ success: true, message: 'Password verified successfully' });
    } else {
        return res.status(401).json({ error: 'Invalid password' });
    }
});

// 检查频道访问权限
app.get('/api/channel/:channel/access/:userId', async (req, res) => {
    const { channel, userId } = req.params;

    const channelData = await db.getChannelByName(channel);
    if (!channelData || !channelData.password) {
        return res.json({ hasAccess: true });
    }
    
    const hasAccess = await db.isChannelMember(channel, parseInt(userId));
    return res.json({ hasAccess });
});

// 用户注册
app.post('/api/register', async (req, res) => {
    if (!REGISTRATION_ENABLED) {
        return res.status(403).json({ error: '注册功能已关闭' });
    }
    
    const { username, password, email, nickname } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        if (email) {
            const existingEmail = await db.getUserByEmail(email);
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already exists' });
            }
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = await db.insertUser({
            username,
            password: hashedPassword,
            email,
            nickname
        });
        
        const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '24h' });
        logger.auditLog('user_register', newUser.id, { username: newUser.username });
        
        res.status(201).json({ 
            token, 
            userId: newUser.id, 
            username: newUser.username, 
            nickname: newUser.nickname 
        });
        
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        const user = await db.getUserByUsername(username);
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });
        
        logger.auditLog('user_login', user.id, { username: user.username });
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ 
            token, 
            userId: user.id, 
            username: user.username,
            nickname: user.nickname,
            avatar: user.avatar,
            bio: user.bio,
            gender: user.gender
        });
        
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, admin: true });
    } else {
        res.status(401).json({ error: 'Invalid admin credentials' });
    }
});

// 获取用户资料
app.get('/api/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const user = await db.getUserById(parseInt(userId));
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const userProfile = {
            id: user.id,
            username: user.username,
            nickname: user.nickname || user.username,
            avatar: user.avatar,
            bio: user.bio,
            gender: user.gender,
            email: user.email,
            created_at: user.created_at
        };
        
        res.json(userProfile);
    } catch (error) {
        console.error('获取用户资料失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 更新用户资料
app.put('/api/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    const { bio, gender, email, nickname } = req.body;
    
    try {
        if (email) {
            const existingUser = await db.getUserByEmail(email);
            if (existingUser && existingUser.id != userId) {
                return res.status(400).json({ error: 'Email already exists' });
            }
        }
        
        const updatedUser = await db.updateUser(userId, { bio, gender, email, nickname });
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        
        res.json({ success: true });
    } catch (error) {
        console.error('更新用户资料失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 修改密码
app.post('/api/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Authorization token required' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId;
        
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Current password is incorrect', success: false });
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedUser = await db.updateUser(userId, { password: hashedPassword });
        
        if (!updatedUser) {
            return res.status(500).json({ error: 'Failed to update password', success: false });
        }
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('修改密码失败:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token', success: false });
        }
        res.status(500).json({ error: 'Server error', success: false });
    }
});

// 上传头像（使用 Supabase Storage）
app.post('/api/upload/avatar', upload.single('avatar'), async (req, res) => {
    const { userId } = req.body;
    
    if (!req.file || !userId) {
        return res.status(400).json({ error: 'File and user ID are required' });
    }
    
    try {
        // 使用 Sharp 处理图片
        const processedBuffer = await sharp(req.file.buffer)
            .resize(200, 200, { fit: 'cover' })
            .png({ quality: 80 })
            .toBuffer();
        
        // 上传到 Supabase Storage（如果使用 Supabase）
        if (process.env.DB_TYPE === 'supabase') {
            const avatarUrl = await db.uploadAvatar(userId, processedBuffer, req.file.originalname);
            const updatedUser = await db.updateUser(userId, { avatar: avatarUrl });
            
            if (!updatedUser) return res.status(404).json({ error: 'User not found' });
            
            res.json({ success: true, avatar: avatarUrl });
        } else {
            // JSON 模式下返回错误（Vercel 不支持本地文件存储）
            res.status(501).json({ error: 'File upload requires Supabase Storage' });
        }
    } catch (error) {
        console.error('上传头像失败:', error);
        res.status(500).json({ error: 'Image processing error' });
    }
});

// 上传聊天图片
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
    }
    
    try {
        const processedBuffer = await sharp(req.file.buffer)
            .resize(600, 450, { fit: 'inside' })
            .png({ quality: 85 })
            .toBuffer();
        
        if (process.env.DB_TYPE === 'supabase') {
            const imageUrl = await db.uploadChatImage(processedBuffer, req.file.originalname);
            res.json({ success: true, image: imageUrl });
        } else {
            res.status(501).json({ error: 'File upload requires Supabase Storage' });
        }
    } catch (error) {
        console.error('上传图片失败:', error);
        res.status(500).json({ error: 'Image processing error' });
    }
});

// 上传语音
app.post('/api/upload/voice', upload.single('voice'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'File is required' });
    }
    
    try {
        if (process.env.DB_TYPE === 'supabase') {
            const voiceUrl = await db.uploadVoiceMessage(req.file.buffer, req.file.originalname);
            res.json({ success: true, voice: voiceUrl });
        } else {
            res.status(501).json({ error: 'File upload requires Supabase Storage' });
        }
    } catch (error) {
        console.error('上传语音失败:', error);
        res.status(500).json({ error: 'Voice upload error' });
    }
});

// 获取频道消息
app.get('/api/messages/:channel', authenticateUser, async (req, res) => {
    const { channel } = req.params;
    
    if (!CHANNELS.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
    }
    
    try {
        let messages = await db.getMessagesByChannel(channel);
        
        // 过滤被屏蔽的消息
        if (req.userId) {
            messages = messages.filter(msg => {
                return !msg.is_blocked || msg.user_id === parseInt(req.userId);
            });
        } else {
            messages = messages.filter(msg => !msg.is_blocked);
        }
        
        // 添加用户信息
        const messagesWithUserInfo = await Promise.all(messages.map(async (msg) => {
            const user = await db.getUserById(msg.user_id);
            
            const messageData = {
                ...msg,
                username: user?.username || 'Unknown',
                nickname: user?.nickname || user?.username || 'Unknown',
                avatar: user?.avatar || 'images/default.png',
                reply_info: null
            };
            
            if (msg.reply_to) {
                const repliedMessage = await db.getMessageById(msg.reply_to);
                if (repliedMessage) {
                    const repliedUser = await db.getUserById(repliedMessage.user_id);
                    messageData.reply_info = {
                        message_id: repliedMessage.id,
                        username: repliedUser?.username || 'Unknown',
                        nickname: repliedUser?.nickname || repliedUser?.username || 'Unknown',
                        content: repliedMessage.content,
                        image: repliedMessage.image,
                        voice: repliedMessage.voice
                    };
                }
            }
            
            return messageData;
        }));
        
        res.json(messagesWithUserInfo);
    } catch (error) {
        console.error('获取消息失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Pusher 配置
app.get('/api/pusher/config', (req, res) => {
    res.json({
        key: process.env.PUSHER_KEY || 'your-key',
        cluster: process.env.PUSHER_CLUSTER || 'ap3'
    });
});

// 发送消息
app.post('/api/pusher/send-message', authenticateUser, async (req, res) => {
    try {
        const { userId, channel, content, image, voice, reply_to } = req.body;
        
        const containsBadWords = badWordsFilter.containsBadWords(content);
        
        const messageType = image ? 'image' : (voice ? 'voice' : 'text');
        logger.chatLog(channel, userId, content, messageType, {
            image,
            voice,
            reply_to,
            is_blocked: containsBadWords
        });
        
        if (containsBadWords) {
            logger.auditLog('message_blocked', userId, {
                channel,
                content,
                messageType
            });
        }
        
        const newMessage = await db.insertMessage({
            user_id: userId,
            channel,
            content,
            image,
            voice,
            reply_to,
            is_blocked: containsBadWords
        });
        
        const user = await db.getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const messageData = {
            id: newMessage.id,
            user_id: userId,
            channel: channel,
            content: content,
            image: image,
            voice: newMessage.voice,
            created_at: newMessage.created_at,
            username: user.username,
            nickname: user.nickname || user.username,
            avatar: user.avatar,
            reply_to: newMessage.reply_to,
            reply_info: null,
            is_blocked: newMessage.is_blocked,
            blocked_at: newMessage.blocked_at
        };
        
        if (newMessage.reply_to) {
            const repliedMessage = await db.getMessageById(newMessage.reply_to);
            if (repliedMessage) {
                const repliedUser = await db.getUserById(repliedMessage.user_id);
                messageData.reply_info = {
                    message_id: repliedMessage.id,
                    username: repliedUser?.username || 'Unknown',
                    nickname: repliedUser?.nickname || repliedUser?.username || 'Unknown',
                    content: repliedMessage.content,
                    image: repliedMessage.image,
                    is_blocked: repliedMessage.is_blocked
                };
            }
        }
        
        // 使用 Pusher 发送消息
        if (newMessage.is_blocked) {
            await pusher.trigger(`private-user-${userId}`, 'message-received', messageData);
            await pusher.trigger(`private-user-${userId}`, 'message-blocked', {
                messageId: newMessage.id,
                reason: '消息包含屏蔽词',
                content: content
            });
        } else {
            await pusher.trigger(`presence-${channel}`, 'message-received', messageData);
        }
        
        res.json({ success: true, message: messageData });
        
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// 撤回消息
app.post('/api/pusher/recall-message', authenticateUser, async (req, res) => {
    try {
        const { messageId, channel } = req.body;
        
        const message = await db.getMessageById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        
        const messageTime = new Date(message.created_at);
        const now = new Date();
        const timeDiff = (now - messageTime) / (1000 * 60);
        
        if (timeDiff <= 2) {
            const updatedMessage = await db.updateMessage(messageId, {
                content: '[此消息已撤回]',
                image: null,
                voice: null,
                is_recalled: true,
                recalled_at: new Date().toISOString()
            });
            
            if (updatedMessage) {
                logger.auditLog('message_recall', message.user_id, {
                    messageId,
                    channel,
                    originalContent: message.content
                });
                
                await pusher.trigger(`presence-${channel}`, 'message-recalled', {
                    messageId,
                    channel,
                    content: '[此消息已撤回]',
                    image: null,
                    voice: null,
                    is_recalled: true,
                    recalled_at: updatedMessage.recalled_at
                });
                
                res.json({ success: true, message: updatedMessage });
            } else {
                res.status(500).json({ error: 'Failed to recall message' });
            }
        } else {
            res.status(400).json({ error: '消息已超过2分钟撤回时限' });
        }
        
    } catch (error) {
        console.error('撤回消息失败:', error);
        res.status(500).json({ error: 'Failed to recall message' });
    }
});

// Pusher 认证
app.post('/api/pusher/auth', authenticateUser, async (req, res) => {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    const userId = req.userId;
    
    // 检查私密频道访问权限
    if (channel.startsWith('presence-Channel105')) {
        const channelName = 'Channel105';
        const channelData = await db.getChannelByName(channelName);
        if (channelData && channelData.password) {
            const hasAccess = await db.isChannelMember(channelName, parseInt(userId));
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
    }
    
    // 为在线频道提供用户信息
    if (channel.startsWith('presence-')) {
        const user = await db.getUserById(userId);
        const presenceData = {
            user_id: userId,
            user_info: {
                username: user?.username || 'Unknown',
                nickname: user?.nickname || user?.username || 'Unknown',
                avatar: user?.avatar || 'images/default.png'
            }
        };
        
        const auth = pusher.authorizeChannel(socketId, channel, presenceData);
        res.send(auth);
    } else {
        const auth = pusher.authorizeChannel(socketId, channel);
        res.send(auth);
    }
});

// 管理员 API
app.get('/api/channel/:channel/members', authenticateAdmin, async (req, res) => {
    const { channel } = req.params;
    
    try {
        const channelData = await db.getChannelByName(channel);
        if (!channelData || !channelData.password) {
            return res.status(400).json({ error: 'Not a private channel' });
        }
        
        const memberIds = await db.getChannelMembers(channel);
        const members = await Promise.all(memberIds.map(async (userId) => {
            const user = await db.getUserById(userId);
            return user ? { id: user.id, username: user.username } : null;
        }));
        
        res.json(members.filter(m => m !== null));
    } catch (error) {
        console.error('获取频道成员失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/channel/:channel/members/:userId', authenticateAdmin, async (req, res) => {
    const { channel, userId } = req.params;
    
    try {
        const success = await db.removeChannelMember(channel, parseInt(userId));
        if (success) {
            res.json({ success: true, message: 'User removed from channel' });
        } else {
            res.status(404).json({ error: 'User not found in channel' });
        }
    } catch (error) {
        console.error('移除频道成员失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/channel/:channel/password', authenticateAdmin, async (req, res) => {
    const { channel } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
    }
    
    try {
        const success = await db.updateChannelPassword(channel, newPassword);
        if (success) {
            res.json({ success: true, message: 'Channel password updated successfully' });
        } else {
            res.status(400).json({ error: 'Not a private channel' });
        }
    } catch (error) {
        console.error('更新频道密码失败:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vercel Serverless Function 导出
module.exports = app;
