// 前端增强安全模块

/**
 * 请求签名验证
 */
class RequestSigner {
    constructor() {
        this.nonce = this.generateNonce();
    }
    
    /**
     * 生成随机数
     */
    generateNonce() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * 生成时间戳
     */
    getTimestamp() {
        return Date.now();
    }
    
    /**
     * 为请求添加安全头
     */
    addSecurityHeaders(headers = {}) {
        return {
            ...headers,
            'X-Request-Nonce': this.generateNonce(),
            'X-Request-Timestamp': this.getTimestamp().toString(),
            'X-Client-Version': '1.0.0'
        };
    }
}

/**
 * 本地数据加密
 */
class LocalEncryption {
    /**
     * 简单加密（Base64 + 混淆）
     */
    static encrypt(data) {
        try {
            const json = JSON.stringify(data);
            const encoded = btoa(unescape(encodeURIComponent(json)));
            // 添加混淆
            const obfuscated = this.obfuscate(encoded);
            return obfuscated;
        } catch (error) {
            console.error('加密失败:', error);
            return null;
        }
    }
    
    /**
     * 简单解密
     */
    static decrypt(encrypted) {
        try {
            // 移除混淆
            const deobfuscated = this.deobfuscate(encrypted);
            const decoded = decodeURIComponent(escape(atob(deobfuscated)));
            return JSON.parse(decoded);
        } catch (error) {
            console.error('解密失败:', error);
            return null;
        }
    }
    
    /**
     * 混淆字符串
     */
    static obfuscate(str) {
        return str.split('').reverse().join('');
    }
    
    /**
     * 去混淆
     */
    static deobfuscate(str) {
        return str.split('').reverse().join('');
    }
}

/**
 * 安全的 LocalStorage 包装
 */
const SecureLocalStorage = {
    setItem: function(key, value) {
        try {
            const encrypted = LocalEncryption.encrypt(value);
            if (encrypted) {
                localStorage.setItem(key, encrypted);
                return true;
            }
            return false;
        } catch (error) {
            console.error('存储失败:', error);
            return false;
        }
    },
    
    getItem: function(key) {
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            return LocalEncryption.decrypt(encrypted);
        } catch (error) {
            console.error('读取失败:', error);
            return null;
        }
    },
    
    removeItem: function(key) {
        localStorage.removeItem(key);
    },
    
    clear: function() {
        localStorage.clear();
    }
};

/**
 * 防调试保护
 */
class AntiDebug {
    constructor() {
        this.enabled = false; // 默认关闭，避免影响开发
    }
    
    /**
     * 启用防调试
     */
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        
        // 检测开发者工具
        this.detectDevTools();
        
        // 禁用右键菜单
        this.disableContextMenu();
        
        // 禁用特定快捷键
        this.disableShortcuts();
    }
    
    /**
     * 检测开发者工具
     */
    detectDevTools() {
        const threshold = 160;
        let devtoolsOpen = false;
        
        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                if (!devtoolsOpen) {
                    devtoolsOpen = true;
                    // 可以在这里添加警告或其他处理
                }
            } else {
                devtoolsOpen = false;
            }
        }, 1000);
    }
    
    /**
     * 禁用右键菜单
     */
    disableContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
    }
    
    /**
     * 禁用特定快捷键
     */
    disableShortcuts() {
        document.addEventListener('keydown', (e) => {
            // F12
            if (e.keyCode === 123) {
                e.preventDefault();
                return false;
            }
            
            // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
            if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
                e.preventDefault();
                return false;
            }
            
            // Ctrl+U (查看源代码)
            if (e.ctrlKey && e.keyCode === 85) {
                e.preventDefault();
                return false;
            }
        });
    }
}

/**
 * 内容完整性验证
 */
class IntegrityChecker {
    constructor() {
        this.checksums = new Map();
    }
    
    /**
     * 计算简单校验和
     */
    async calculateChecksum(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * 验证内容完整性
     */
    async verify(key, content) {
        const checksum = await this.calculateChecksum(content);
        const stored = this.checksums.get(key);
        
        if (!stored) {
            this.checksums.set(key, checksum);
            return true;
        }
        
        return checksum === stored;
    }
}

/**
 * 安全的 Fetch 增强版
 */
class SecureFetch {
    constructor() {
        this.signer = new RequestSigner();
        this.retryCount = 3;
        this.retryDelay = 1000;
    }
    
    /**
     * 执行安全请求
     */
    async request(url, options = {}) {
        // 添加安全头
        const headers = this.signer.addSecurityHeaders(options.headers || {});
        
        // 添加认证令牌
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const secureOptions = {
            ...options,
            headers,
            credentials: 'same-origin'
        };
        
        // 重试机制
        for (let i = 0; i < this.retryCount; i++) {
            try {
                const response = await fetch(url, secureOptions);
                
                // 处理速率限制
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || this.retryDelay / 1000;
                    await this.sleep(retryAfter * 1000);
                    continue;
                }
                
                // 处理服务不可用
                if (response.status === 503) {
                    await this.sleep(this.retryDelay * (i + 1));
                    continue;
                }
                
                return response;
            } catch (error) {
                if (i === this.retryCount - 1) {
                    throw error;
                }
                await this.sleep(this.retryDelay * (i + 1));
            }
        }
    }
    
    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 表单防重放
 */
class FormReplayProtection {
    constructor() {
        this.submittedForms = new Set();
        this.expiryTime = 300000; // 5分钟
    }
    
    /**
     * 生成表单令牌
     */
    generateToken(formId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        return `${formId}-${timestamp}-${random}`;
    }
    
    /**
     * 检查是否可以提交
     */
    canSubmit(token) {
        if (this.submittedForms.has(token)) {
            return false;
        }
        
        this.submittedForms.add(token);
        
        // 设置过期清理
        setTimeout(() => {
            this.submittedForms.delete(token);
        }, this.expiryTime);
        
        return true;
    }
}

/**
 * 客户端日志记录（安全）
 */
class SecureLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
    }
    
    /**
     * 记录日志
     */
    log(level, message, data = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data: this.sanitizeData(data)
        };
        
        this.logs.push(entry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // 控制台输出
        if (level === 'error') {
            console.error(message, data);
        } else if (level === 'warn') {
            console.warn(message, data);
        } else {
            console.log(message, data);
        }
    }
    
    /**
     * 清理敏感数据
     */
    sanitizeData(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        
        const sanitized = {};
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey'];
        
        for (const [key, value] of Object.entries(data)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                sanitized[key] = this.sanitizeData(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * 获取日志
     */
    getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return this.logs;
    }
}

// 创建全局实例
const secureFetch = new SecureFetch();
const antiDebug = new AntiDebug();
const integrityChecker = new IntegrityChecker();
const formReplayProtection = new FormReplayProtection();
const secureLogger = new SecureLogger();

/**
 * 初始化增强安全
 */
function initEnhancedSecurity() {
    // 注意：防调试功能默认关闭，避免影响开发
    // 生产环境可以启用：antiDebug.enable();
    
    // 显示安全警告
    console.log('%c⚠️ 安全警告', 'color: red; font-size: 20px; font-weight: bold;');
    console.log('%c请勿在此处粘贴任何代码！这可能导致账户被盗。', 'font-size: 14px;');
}

// 页面加载时初始化
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEnhancedSecurity);
    } else {
        initEnhancedSecurity();
    }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        RequestSigner,
        LocalEncryption,
        SecureLocalStorage,
        AntiDebug,
        IntegrityChecker,
        SecureFetch,
        FormReplayProtection,
        SecureLogger,
        secureFetch,
        antiDebug,
        integrityChecker,
        formReplayProtection,
        secureLogger
    };
}
