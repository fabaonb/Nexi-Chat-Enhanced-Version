// 前端 XSS 防护工具模块

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 要转义的文本
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
 * 清理用户输入的文本（移除危险字符）
 * @param {string} input - 用户输入
 * @returns {string} - 清理后的文本
 */
function sanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    
    // 移除 script 标签和事件处理器
    let cleaned = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
        .replace(/javascript:/gi, '');
    
    return cleaned;
}

/**
 * 安全地设置元素的文本内容
 * @param {HTMLElement} element - DOM 元素
 * @param {string} text - 要设置的文本
 */
function setTextContent(element, text) {
    if (!element) return;
    
    // 使用 textContent 而不是 innerHTML 来防止 XSS
    element.textContent = text || '';
}

/**
 * 安全地设置元素的 HTML 内容（经过清理）
 * @param {HTMLElement} element - DOM 元素
 * @param {string} html - 要设置的 HTML
 */
function setHtmlContent(element, html) {
    if (!element) return;
    
    // 清理 HTML 后再设置
    const cleaned = sanitizeInput(html);
    element.innerHTML = escapeHtml(cleaned);
}

/**
 * 创建安全的文本节点
 * @param {string} text - 文本内容
 * @returns {Text} - 文本节点
 */
function createSafeTextNode(text) {
    return document.createTextNode(text || '');
}

/**
 * 安全地设置属性值
 * @param {HTMLElement} element - DOM 元素
 * @param {string} attr - 属性名
 * @param {string} value - 属性值
 */
function setSafeAttribute(element, attr, value) {
    if (!element || !attr) return;
    
    // 对于 href 和 src 等属性，检查是否包含危险协议
    if (attr === 'href' || attr === 'src') {
        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:'];
        const lowerValue = (value || '').toLowerCase().trim();
        
        for (const protocol of dangerousProtocols) {
            if (lowerValue.startsWith(protocol)) {
                return;
            }
        }
    }
    
    element.setAttribute(attr, value || '');
}

/**
 * 清理 URL（防止 XSS）
 * @param {string} url - URL 地址
 * @returns {string} - 清理后的 URL
 */
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }
    
    const cleaned = url.trim();
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    const lowerUrl = cleaned.toLowerCase();
    
    for (const protocol of dangerousProtocols) {
        if (lowerUrl.startsWith(protocol)) {
            return '';
        }
    }
    
    return cleaned;
}

/**
 * 验证和清理用户名
 * @param {string} username - 用户名
 * @returns {string} - 清理后的用户名
 */
function sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
        return '';
    }
    
    // 只保留字母、数字、下划线、中文
    return username.replace(/[^\w\u4e00-\u9fa5]/g, '');
}

/**
 * 验证和清理邮箱
 * @param {string} email - 邮箱地址
 * @returns {string} - 清理后的邮箱
 */
function sanitizeEmail(email) {
    if (!email || typeof email !== 'string') {
        return '';
    }
    
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const cleaned = email.trim().toLowerCase();
    
    return emailRegex.test(cleaned) ? cleaned : '';
}

/**
 * 安全地创建带有用户内容的 DOM 元素
 * @param {string} tag - 标签名
 * @param {string} text - 文本内容
 * @param {Object} attributes - 属性对象
 * @returns {HTMLElement} - 创建的元素
 */
function createSafeElement(tag, text, attributes = {}) {
    const element = document.createElement(tag);
    
    // 设置文本内容（安全）
    if (text) {
        element.textContent = text;
    }
    
    // 设置属性（安全）
    for (const [key, value] of Object.entries(attributes)) {
        setSafeAttribute(element, key, value);
    }
    
    return element;
}

/**
 * 从 HTML 字符串创建安全的 DOM 元素
 * @param {string} htmlString - HTML 字符串
 * @returns {DocumentFragment} - 文档片段
 */
function createSafeFragment(htmlString) {
    const template = document.createElement('template');
    const cleaned = sanitizeInput(htmlString);
    template.innerHTML = escapeHtml(cleaned);
    return template.content;
}

/**
 * 验证输入长度
 * @param {string} input - 输入内容
 * @param {number} maxLength - 最大长度
 * @returns {boolean} - 是否有效
 */
function validateLength(input, maxLength) {
    if (!input || typeof input !== 'string') {
        return false;
    }
    return input.length <= maxLength;
}

/**
 * 清理对象中的所有字符串字段
 * @param {Object} obj - 要清理的对象
 * @returns {Object} - 清理后的对象
 */
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
        return {};
    }
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeInput(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    
    return sanitized;
}

// 导出函数（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        sanitizeInput,
        setTextContent,
        setHtmlContent,
        createSafeTextNode,
        setSafeAttribute,
        sanitizeUrl,
        sanitizeUsername,
        sanitizeEmail,
        createSafeElement,
        createSafeFragment,
        validateLength,
        sanitizeObject
    };
}
