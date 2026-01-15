// XSS 防护工具模块
const xss = require('xss');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

// 创建 DOMPurify 实例（服务器端）
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * XSS 过滤选项配置
 */
const xssOptions = {
    whiteList: {
        // 只允许安全的 HTML 标签
        a: ['href', 'title', 'target'],
        b: [],
        strong: [],
        i: [],
        em: [],
        u: [],
        br: [],
        p: [],
        span: ['style'],
        div: ['style']
    },
    stripIgnoreTag: true, // 过滤所有非白名单标签
    stripIgnoreTagBody: ['script', 'style'], // 过滤 script 和 style 标签的内容
    css: {
        whiteList: {
            'color': true,
            'background-color': true,
            'font-size': true,
            'font-weight': true
        }
    }
};

/**
 * 清理用户输入的文本内容（用于聊天消息等）
 * @param {string} input - 用户输入的内容
 * @returns {string} - 清理后的安全内容
 */
function sanitizeText(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // 使用 xss 库进行清理
    return xss(input, xssOptions);
}

/**
 * 清理 HTML 内容（更严格的清理）
 * @param {string} html - HTML 内容
 * @returns {string} - 清理后的安全 HTML
 */
function sanitizeHtml(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }
    
    // 使用 DOMPurify 进行清理
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'title'],
        ALLOW_DATA_ATTR: false
    });
}

/**
 * 转义 HTML 特殊字符（最严格的处理）
 * @param {string} text - 文本内容
 * @returns {string} - 转义后的文本
 */
function escapeHtml(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * 清理用户名（只允许字母、数字、下划线、中文）
 * @param {string} username - 用户名
 * @returns {string} - 清理后的用户名
 */
function sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
        return '';
    }
    
    // 移除所有特殊字符，只保留字母、数字、下划线、中文
    return username.replace(/[^\w\u4e00-\u9fa5]/g, '');
}

/**
 * 清理邮箱地址
 * @param {string} email - 邮箱地址
 * @returns {string} - 清理后的邮箱
 */
function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
        return '';
    }
    
    // 基本的邮箱格式验证和清理
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleaned = email.trim().toLowerCase();
    
    return emailRegex.test(cleaned) ? cleaned : '';
}

/**
 * 清理 URL（防止 javascript: 等危险协议）
 * @param {string} url - URL 地址
 * @returns {string} - 清理后的安全 URL
 */
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    
    const cleaned = url.trim();
    
    // 检查是否包含危险协议
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = cleaned.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
            return '';
        }
    }
    
    // 只允许 http、https 和相对路径
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('/')) {
        return cleaned;
    }
    
    return '';
}

/**
 * 清理对象中的所有字符串字段
 * @param {Object} obj - 要清理的对象
 * @param {Array} fields - 需要清理的字段列表
 * @returns {Object} - 清理后的对象
 */
function sanitizeObject(obj, fields) {
    if (!obj || typeof obj !== 'object') {
        return {};
    }
    
    const sanitized = { ...obj };
    
    for (const field of fields) {
        if (sanitized[field] && typeof sanitized[field] === 'string') {
            sanitized[field] = sanitizeText(sanitized[field]);
        }
    }
    
    return sanitized;
}

/**
 * 验证和清理文件名
 * @param {string} filename - 文件名
 * @returns {string} - 清理后的文件名
 */
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        return '';
    }
    
    // 移除路径遍历字符和特殊字符
    return filename
        .replace(/\.\./g, '')
        .replace(/[\/\\]/g, '')
        .replace(/[<>:"|?*]/g, '')
        .trim();
}

/**
 * 中间件：清理请求体中的所有字符串字段
 */
function sanitizeRequestBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeText(req.body[key]);
            }
        }
    }
    next();
}

/**
 * 设置安全响应头
 */
function setSecurityHeaders(req, res, next) {
    // 防止 XSS 攻击
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // 防止 MIME 类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // 内容安全策略
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.pusher.com https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' https://cdnjs.cloudflare.com; " +
        "connect-src 'self' https: wss:; " +
        "media-src 'self';"
    );
    
    next();
}

module.exports = {
    sanitizeText,
    sanitizeHtml,
    escapeHtml,
    sanitizeUsername,
    sanitizeEmail,
    sanitizeUrl,
    sanitizeObject,
    sanitizeFilename,
    sanitizeRequestBody,
    setSecurityHeaders
};
