// 综合安全中间件模块
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const validator = require('validator');

/**
 * 速率限制配置 - 防止暴力破解和 DDoS 攻击
 */

// 通用 API 速率限制
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 100, // 限制 100 个请求
    message: '请求过于频繁，请稍后再试',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: '请求过于频繁，请稍后再试',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// 登录接口严格限制 - 防止暴力破解
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 5, // 只允许 5 次尝试
    skipSuccessfulRequests: true, // 成功的请求不计入限制
    message: '登录尝试次数过多，请 15 分钟后再试',
    handler: (req, res) => {
        res.status(429).json({
            error: '登录尝试次数过多，请 15 分钟后再试',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// 注册接口限制 - 防止批量注册
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 小时
    max: 3, // 只允许 3 次注册
    message: '注册次数过多，请 1 小时后再试',
    handler: (req, res) => {
        res.status(429).json({
            error: '注册次数过多，请 1 小时后再试',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// 消息发送限制 - 防止消息轰炸
const messageLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 分钟
    max: 30, // 每分钟最多 30 条消息
    message: '发送消息过快，请稍后再试',
    handler: (req, res) => {
        res.status(429).json({
            error: '发送消息过快，请稍后再试',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// 文件上传限制 - 防止上传攻击
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 20, // 最多 20 次上传
    message: '上传次数过多，请稍后再试',
    handler: (req, res) => {
        res.status(429).json({
            error: '上传次数过多，请稍后再试',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// 管理员操作限制
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 50, // 管理员操作限制
    message: '管理操作过于频繁，请稍后再试'
});

/**
 * HTTP 参数污染防护
 */
const hppProtection = hpp({
    whitelist: ['channel', 'userId'] // 允许重复的参数
});

/**
 * SQL 注入防护 - 验证输入
 */
function sqlInjectionProtection(req, res, next) {
    const suspiciousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
        /(--|\;|\/\*|\*\/|xp_|sp_)/gi,
        /('|(\\')|(--)|(\#)|(%23)|(\/\*))/gi
    ];
    
    // 检查所有输入
    const checkInput = (obj) => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(obj[key])) {
                        return true;
                    }
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (checkInput(obj[key])) {
                    return true;
                }
            }
        }
        return false;
    };
    
    if (checkInput(req.body) || checkInput(req.query) || checkInput(req.params)) {
        return res.status(400).json({ error: '检测到非法输入' });
    }
    
    next();
}

/**
 * NoSQL 注入防护
 */
function noSqlInjectionProtection(req, res, next) {
    const sanitize = (obj) => {
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object') {
                // 检查是否包含 MongoDB 操作符
                if (key.startsWith('$') || key.startsWith('_')) {
                    delete obj[key];
                } else {
                    sanitize(obj[key]);
                }
            }
        }
    };
    
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    
    next();
}

/**
 * 路径遍历攻击防护
 */
function pathTraversalProtection(req, res, next) {
    const pathTraversalPatterns = [
        /\.\./g,
        /\.\\/g,
        /\.\//g,
        /%2e%2e/gi,
        /%252e%252e/gi,
        /\.\.%2f/gi,
        /\.\.%5c/gi
    ];
    
    const checkPath = (str) => {
        if (typeof str !== 'string') return false;
        return pathTraversalPatterns.some(pattern => pattern.test(str));
    };
    
    // 检查所有输入
    const inputs = [
        ...Object.values(req.params || {}),
        ...Object.values(req.query || {}),
        ...Object.values(req.body || {})
    ];
    
    for (const input of inputs) {
        if (checkPath(input)) {
            return res.status(400).json({ error: '检测到路径遍历攻击' });
        }
    }
    
    next();
}

/**
 * 命令注入防护
 */
function commandInjectionProtection(req, res, next) {
    const commandPatterns = [
        /[;&|`$(){}[\]<>]/g,
        /\n|\r/g
    ];
    
    const checkCommand = (str) => {
        if (typeof str !== 'string') return false;
        return commandPatterns.some(pattern => pattern.test(str));
    };
    
    const inputs = [
        ...Object.values(req.params || {}),
        ...Object.values(req.query || {}),
        ...Object.values(req.body || {})
    ];
    
    for (const input of inputs) {
        if (checkCommand(input)) {
            return res.status(400).json({ error: '检测到命令注入攻击' });
        }
    }
    
    next();
}

/**
 * 文件上传安全验证
 */
function fileUploadValidation(req, res, next) {
    if (!req.file && !req.files) {
        return next();
    }
    
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
        return next();
    }
    
    // 允许的 MIME 类型
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'audio/webm',
        'audio/ogg',
        'audio/wav',
        'audio/mpeg'
    ];
    
    // 允许的文件扩展名
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.webm', '.ogg', '.wav', '.mp3'];
    
    // 检查 MIME 类型
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ error: '不支持的文件类型' });
    }
    
    // 检查文件扩展名
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/);
    if (!ext || !allowedExtensions.includes(ext[0])) {
        return res.status(400).json({ error: '不支持的文件扩展名' });
    }
    
    // 检查文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ error: '文件大小超过限制（最大 10MB）' });
    }
    
    // 检查文件名中的危险字符
    const dangerousChars = /[<>:"|?*\x00-\x1f]/g;
    if (dangerousChars.test(file.originalname)) {
        return res.status(400).json({ error: '文件名包含非法字符' });
    }
    
    next();
}

/**
 * 请求体大小限制
 */
function requestSizeLimit(req, res, next) {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
        return res.status(413).json({ error: '请求体过大' });
    }
    
    next();
}

/**
 * IP 黑名单检查
 */
const ipBlacklist = new Set();

function addToBlacklist(ip, duration = 3600000) { // 默认 1 小时
    ipBlacklist.add(ip);
    setTimeout(() => {
        ipBlacklist.delete(ip);
    }, duration);
}

function ipBlacklistCheck(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (ipBlacklist.has(ip)) {
        return res.status(403).json({ error: '您的 IP 已被暂时封禁' });
    }
    
    next();
}

/**
 * 用户代理验证 - 防止机器人
 */
function userAgentValidation(req, res, next) {
    const userAgent = req.headers['user-agent'];
    
    if (!userAgent) {
        return res.status(400).json({ error: '缺少 User-Agent' });
    }
    
    // 检测常见的恶意爬虫
    const maliciousBots = [
        /sqlmap/i,
        /nikto/i,
        /nmap/i,
        /masscan/i,
        /nessus/i,
        /openvas/i,
        /acunetix/i,
        /burpsuite/i
    ];
    
    for (const pattern of maliciousBots) {
        if (pattern.test(userAgent)) {
            const ip = req.ip || req.connection.remoteAddress;
            addToBlacklist(ip, 24 * 3600000); // 封禁 24 小时
            return res.status(403).json({ error: '检测到恶意行为' });
        }
    }
    
    next();
}

/**
 * 请求方法验证
 */
function methodValidation(allowedMethods) {
    return (req, res, next) => {
        if (!allowedMethods.includes(req.method)) {
            return res.status(405).json({ error: '不支持的请求方法' });
        }
        next();
    };
}

/**
 * 敏感信息泄露防护
 */
function sanitizeErrorResponse(err, req, res, next) {
    // 不向客户端暴露详细的错误信息
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    console.error('服务器错误:', err);
    
    res.status(err.status || 500).json({
        error: isDevelopment ? err.message : '服务器内部错误',
        ...(isDevelopment && { stack: err.stack })
    });
}

/**
 * 日志记录可疑活动
 */
function logSuspiciousActivity(req, type, details) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date().toISOString();
    
    console.warn(`[安全警告] ${timestamp}`);
    console.warn(`类型: ${type}`);
    console.warn(`IP: ${ip}`);
    console.warn(`User-Agent: ${userAgent}`);
    console.warn(`详情:`, details);
}

module.exports = {
    // 速率限制
    apiLimiter,
    loginLimiter,
    registerLimiter,
    messageLimiter,
    uploadLimiter,
    adminLimiter,
    
    // 注入防护
    sqlInjectionProtection,
    noSqlInjectionProtection,
    pathTraversalProtection,
    commandInjectionProtection,
    
    // 其他防护
    hppProtection,
    fileUploadValidation,
    requestSizeLimit,
    ipBlacklistCheck,
    userAgentValidation,
    methodValidation,
    sanitizeErrorResponse,
    
    // 工具函数
    addToBlacklist,
    logSuspiciousActivity
};
