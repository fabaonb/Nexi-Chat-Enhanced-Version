const express = require('express');
const https = require('https');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const db = require('./utils/db-adapter'); // 使用数据库适配器
const logger = require('./utils/log');
const badWordsFilter = require('./utils/badwords');
const pusher = require('./config/pusher'); // 引入 Pusher

const app = express();
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'cert.key')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.crt'))
};
const server = https.createServer(sslOptions, app);

// 从环境变量或配置文件读取所有敏感配置
const config = require('./config/config');
const PORT = config.PORT;
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
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb', parameterLimit: 1000000 }));
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

// 静默模式：减少不必要的日志输出
const SILENT_MODE = process.env.SILENT_MODE !== 'false';
// 数据库连接成功（静默）
const defaultAvatarPath = path.join(__dirname, '..', 'public', 'images', 'default.png');
if (!fs.existsSync(defaultAvatarPath)) {
    sharp({ 
        create: { 
            width: 100, 
            height: 100, 
            channels: 4, 
            background: { r: 150, g: 150, b: 150, alpha: 1 } 
        } 
    })
    .png()
    .toFile(defaultAvatarPath, (err) => {
        if (err) console.error('Error creating default avatar:', err);
    });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'public', 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage
});

app.get('/api/registration-status', (req, res) => {
    res.json({ enabled: REGISTRATION_ENABLED });
});

app.get('/api/version', (req, res) => {
    res.json({ version: VERSION });
});

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

app.get('/api/channel/:channel/access/:userId', async (req, res) => {
    const { channel, userId } = req.params;

    const channelData = await db.getChannelByName(channel);
    if (!channelData || !channelData.password) {
        return res.json({ hasAccess: true });
    }
    const hasAccess = await db.isChannelMember(channel, parseInt(userId));
    return res.json({ hasAccess });
});
app.post('/api/register', async (req, res) => {
    if (!REGISTRATION_ENABLED) {
        return res.status(403).json({ error: '注册功能已关闭' });
    }
    
    const { username, password, email, nickname } = req.body;
    
    // 调试日志
    if (!SILENT_MODE) {
        console.log('注册请求:', { username, hasPassword: !!password, email, nickname });
    }
    
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    
    try {
        const existingUser = await db.getUserByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        if (email) {
            const existingEmail = await db.getUserByEmail(email);
            if (existingEmail) {
                return res.status(400).json({ error: '邮箱已被使用' });
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
        res.status(500).json({ error: 'Server error' });
    }
});

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
        res.status(500).json({ error: 'Server error' });
    }
});
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

app.put('/api/admin/password', authenticateAdmin, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (currentPassword !== ADMIN_CREDENTIALS.password) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    ADMIN_CREDENTIALS.password = newPassword;
    res.json({ success: true, message: 'Admin password updated successfully' });
});

app.get('/api/channel/:channel/members', authenticateAdmin, async (req, res) => {
    const { channel } = req.params;
    const channelData = await db.getChannelByName(channel);
    if (!channelData || !channelData.password) {
        return res.status(400).json({ error: 'Not a private channel' });
    }
    const memberIds = await db.getChannelMembers(channel);
    const memberPromises = memberIds.map(async userId => {
        const user = await db.getUserById(userId);
        return user ? { id: user.id, username: user.username } : null;
    });
    
    const members = (await Promise.all(memberPromises)).filter(member => member !== null);
    
    res.json(members);
});

app.delete('/api/channel/:channel/members/:userId', authenticateAdmin, async (req, res) => {
    const { channel, userId } = req.params;
    const parsedUserId = parseInt(userId);

    const channelData = await db.getChannelByName(channel);
    if (!channelData || !channelData.password) {
        return res.status(400).json({ error: 'Not a private channel' });
    }
    const success = await db.removeChannelMember(channel, parsedUserId);
    if (success) {
        res.json({ success: true, message: 'User removed from channel' });
    } else {
        res.status(404).json({ error: 'User not found in channel' });
    }
});

app.put('/api/channel/:channel/password', authenticateAdmin, async (req, res) => {
    const { channel } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
    }
    
    const channelData = await db.getChannelByName(channel);
    if (!channelData || !channelData.password) {
        return res.status(400).json({ error: 'Not a private channel' });
    }

    const success = await db.updateChannelPassword(channel, newPassword);
    if (success) {
        res.json({ success: true, message: 'Channel password updated successfully' });
    } else {
        res.status(500).json({ error: 'Failed to update password' });
    }
});
app.get('/api/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    
    const user = await db.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
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
});
app.put('/api/profile/:userId', async (req, res) => {
    const { userId } = req.params;
    const { bio, gender, email, nickname } = req.body;
    if (email) {
        const existingUser = await db.getUserByEmail(email);
        if (existingUser && existingUser.id != userId) {
            return res.status(400).json({ error: 'Email already exists' });
        }
    }
    const updatedUser = await db.updateUser(userId, { bio, gender, email, nickname });
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
});
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
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token', success: false });
        }
        res.status(500).json({ error: 'Server error', success: false });
    }
});

app.post('/api/upload/avatar', upload.single('avatar'), async (req, res) => {
    const { userId } = req.body;
    
    if (!req.file || !userId) {
        return res.status(400).json({ error: 'File and user ID are required' });
    }
    
    try {
        const originalExt = path.extname(req.file.originalname).toLowerCase();
        const isGif = originalExt === '.gif';
        
        const optimizedPath = path.join(__dirname, '..', 'public', 'uploads', 'optimized-' + req.file.filename);
        const sharpInstance = sharp(req.file.path)
            .resize(200, 200, { fit: 'cover' });
        
        if (isGif) {
            await sharpInstance.toFile(optimizedPath);
        } else {
            await sharpInstance
                .png({ quality: 80 })
                .toFile(optimizedPath);
        }
        
        fs.unlinkSync(req.file.path);
        
        const avatarUrl = 'uploads/optimized-' + req.file.filename;
        const updatedUser = await db.updateUser(userId, { avatar: avatarUrl });
        
        if (!updatedUser) return res.status(404).json({ error: 'User not found' });
        
        res.json({ success: true, avatar: avatarUrl });
    } catch (error) {
        res.status(500).json({ error: 'Image processing error' });
    }
});

app.post('/api/upload/image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        if (!SILENT_MODE) console.error('上传失败: 未提供文件');
        return res.status(400).json({ error: 'File is required' });
    }
    
    try {
        const originalExt = path.extname(req.file.originalname).toLowerCase();
        const isGif = originalExt === '.gif';
        
        const optimizedPath = path.join(__dirname, '..', 'public', 'uploads', 'chat-' + req.file.filename);
        const sharpInstance = sharp(req.file.path)
            .resize(600, 450, { fit: 'inside' });
        
        if (isGif) {
            await sharpInstance
                .gif()
                .toFile(optimizedPath);
        } else {
            await sharpInstance
                .png({ quality: 85 })
                .toFile(optimizedPath);
        }
        
        try {
            fs.unlinkSync(req.file.path);
        } catch (deleteError) {
            if (!SILENT_MODE) console.error('删除原文件失败:', deleteError);
        }
        
        const imageUrl = 'uploads/chat-' + req.file.filename;
        res.json({ success: true, image: imageUrl });
    } catch (error) {
        if (!SILENT_MODE) console.error('上传失败:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'File size exceeds limit (10MB)' });
        } else {
            res.status(500).json({ error: 'Image processing error' });
        }
    }
});

app.get('/api/admin/logs/list', authenticateAdmin, (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    const logDir = path.join(__dirname, 'logs');
    
    try {
        const files = fs.readdirSync(logDir);
        
        const logFiles = files.filter(file => file.match(/\.(log)$/))
            .map(file => {
                const stats = fs.statSync(path.join(logDir, file));
                return {
                    filename: file,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                };
            })
            .sort((a, b) => b.modifiedAt - a.modifiedAt);
        
        res.json({ logFiles });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get log files: ' + error.message });
    }
});

app.get('/api/admin/logs/content/:filename', authenticateAdmin, (req, res) => {
    const fs = require('fs');
    const path = require('path');
    
    const { filename } = req.params;
    const { search = '', page = 1, limit = 50 } = req.query;
    
    if (!filename.match(/^[a-zA-Z0-9\-_\.]+$/)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const logPath = path.join(__dirname, 'logs', filename);
    
    try {
        const content = fs.readFileSync(logPath, 'utf8');
        
        let logs = content.trim().split('\n')
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null;
                }
            })
            .filter(log => log !== null);
        
        if (search) {
            const searchLower = search.toLowerCase();
            logs = logs.filter(log => {
                return JSON.stringify(log).toLowerCase().includes(searchLower);
            });
        }
        
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedLogs = logs.slice(startIndex, endIndex);
        
        res.json({
            logs: paginatedLogs,
            total: logs.length,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(logs.length / limit)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read log file: ' + error.message });
    }
});

app.post('/api/upload/voice', upload.single('voice'), async (req, res) => {
    if (!req.file) {
        if (!SILENT_MODE) console.error('语音上传失败: 未提供文件');
        return res.status(400).json({ error: 'File is required' });
    }
    
    try {
        const originalExt = path.extname(req.file.originalname).toLowerCase();
        
        const voicePath = path.join(__dirname, '..', 'public', 'uploads', 'voice-' + req.file.filename);
        
        fs.renameSync(req.file.path, voicePath);
        
        const voiceUrl = 'uploads/voice-' + req.file.filename;
        res.json({ success: true, voice: voiceUrl });
    } catch (error) {
        if (!SILENT_MODE) console.error('语音上传失败:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'File size exceeds limit (10MB)' });
        } else {
            res.status(500).json({ error: 'Voice upload error' });
        }
    }
});

app.get('/api/messages/:channel', authenticateUser, async (req, res) => {
    const { channel } = req.params;
    
    if (!CHANNELS.includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel' });
    }
    
    let messages = await db.getMessagesByChannel(channel);
    
    if (req.userId) {
        messages = messages.filter(msg => {
            return !msg.is_blocked || msg.user_id === parseInt(req.userId);
        });
    } else {
        messages = messages.filter(msg => !msg.is_blocked);
    }
    
    const messagesWithUserInfo = await Promise.all(messages.map(async msg => {
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
});

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
        res.status(500).json({ error: 'Server error' });
    }
});

// ============ Pusher API 端点 ============

// 获取 Pusher 配置（只返回公开的 Key 和 Cluster）
app.get('/api/pusher/config', (req, res) => {
    res.json({
        key: process.env.PUSHER_KEY || 'your-key',
        cluster: process.env.PUSHER_CLUSTER || 'ap3'
    });
});

// 发送消息 API（替代 Socket.IO 的 sendMessage 事件）
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
        
        // 使用 Pusher 发送消息到频道
        if (newMessage.is_blocked) {
            // 被屏蔽的消息只发送给发送者
            await pusher.trigger(`private-user-${userId}`, 'message-received', messageData);
            await pusher.trigger(`private-user-${userId}`, 'message-blocked', {
                messageId: newMessage.id,
                reason: '消息包含屏蔽词',
                content: content
            });
            
            // 24小时后自动删除
            setTimeout(() => {
                const msg = db.getMessageById(newMessage.id);
                if (msg && msg.is_blocked) {
                    db.deleteMessage(newMessage.id);
                    pusher.trigger(`presence-${channel}`, 'message-deleted', { messageId: newMessage.id });
                }
            }, 24 * 60 * 60 * 1000);
        } else {
            // 正常消息发送到频道
            await pusher.trigger(`presence-${channel}`, 'message-received', messageData);
        }
        
        res.json({ success: true, message: messageData });
        
    } catch (error) {
        console.error('发送消息失败:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// 撤回消息 API（替代 Socket.IO 的 recallMessage 事件）
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
                
                // 使用 Pusher 通知频道内所有用户
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

// Pusher 认证端点（用于私有和在线频道）
app.post('/api/pusher/auth', authenticateUser, async (req, res) => {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    const userId = req.userId;
    
    // 检查私有频道访问权限
    if (channel.startsWith('presence-Channel105')) {
        const channelName = 'Channel105';
        const channelData = await db.getChannelByName(channelName);
        if (channelData && channelData.password) {
            const hasAccess = await db.isChannelMember(channelName, parseInt(userId));
            if (!userId || !hasAccess) {
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
        // 私有频道
        const auth = pusher.authorizeChannel(socketId, channel);
        res.send(auth);
    }
});

// Pusher Webhook 端点（可选，用于接收 Pusher 事件）
app.post('/api/pusher/webhook', (req, res) => {
    const webhook = pusher.webhook(req);
    if (webhook.isValid()) {
        // 处理 Pusher 事件
        res.send('OK');
    } else {
        res.status(401).send('Invalid webhook');
    }
});

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`✓ 后端服务已启动: https://localhost:${PORT}`);
    
    // 清理过期的被屏蔽消息
    const allMessages = [];
    for (const channel of CHANNELS) {
        const channelMessages = await db.getMessagesByChannel(channel);
        if (Array.isArray(channelMessages)) {
            allMessages.push(...channelMessages);
        }
    }
    
    const blockedMessages = allMessages.filter(msg => msg.is_blocked);
    
    blockedMessages.forEach(msg => {
        const messageTime = new Date(msg.created_at);
        const now = new Date();
        const timeDiff = (now - messageTime) / (1000 * 60 * 60);
        
        if (timeDiff < 24) {
            const remainingTime = (24 - timeDiff) * 60 * 60 * 1000;
            
            setTimeout(async () => {
                const updatedMsg = await db.getMessageById(msg.id);
                if (updatedMsg && updatedMsg.is_blocked) {
                    await db.deleteMessage(msg.id);
                    // 使用 Pusher 通知删除
                    await pusher.trigger(`presence-${msg.channel}`, 'message-deleted', { messageId: msg.id });
                }
            }, remainingTime);
        } else {
            db.deleteMessage(msg.id);
        }
    });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

process.on('SIGINT', () => {
    if (!SILENT_MODE) console.log('\n正在停止后端服务...');
    process.exit(0);
});