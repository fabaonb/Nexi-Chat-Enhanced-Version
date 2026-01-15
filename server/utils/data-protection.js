// 数据保护和隐私模块
const crypto = require('crypto');

/**
 * 敏感数据脱敏
 */
class DataMasking {
    /**
     * 脱敏邮箱
     */
    static maskEmail(email) {
        if (!email || typeof email !== 'string') return '';
        
        const [local, domain] = email.split('@');
        if (!local || !domain) return '';
        
        const maskedLocal = local.length > 2
            ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
            : local[0] + '*';
        
        return `${maskedLocal}@${domain}`;
    }
    
    /**
     * 脱敏手机号
     */
    static maskPhone(phone) {
        if (!phone || typeof phone !== 'string') return '';
        
        if (phone.length < 7) return phone;
        
        return phone.slice(0, 3) + '****' + phone.slice(-4);
    }
    
    /**
     * 脱敏IP地址
     */
    static maskIP(ip) {
        if (!ip || typeof ip !== 'string') return '';
        
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.***.**`;
        }
        
        // IPv6
        const ipv6Parts = ip.split(':');
        if (ipv6Parts.length > 2) {
            return `${ipv6Parts[0]}:${ipv6Parts[1]}:****:****`;
        }
        
        return ip;
    }
    
    /**
     * 脱敏用户名
     */
    static maskUsername(username) {
        if (!username || typeof username !== 'string') return '';
        
        if (username.length <= 2) return username;
        
        return username[0] + '*'.repeat(username.length - 2) + username[username.length - 1];
    }
    
    /**
     * 通用脱敏
     */
    static mask(value, type = 'default') {
        switch (type) {
            case 'email':
                return this.maskEmail(value);
            case 'phone':
                return this.maskPhone(value);
            case 'ip':
                return this.maskIP(value);
            case 'username':
                return this.maskUsername(value);
            default:
                if (typeof value === 'string' && value.length > 4) {
                    return value.slice(0, 2) + '***' + value.slice(-2);
                }
                return value;
        }
    }
}

/**
 * 数据加密存储
 */
class SecureStorage {
    constructor(encryptionKey) {
        this.algorithm = 'aes-256-gcm';
        this.key = encryptionKey || this.generateKey();
    }
    
    /**
     * 生成加密密钥
     */
    generateKey() {
        return crypto.randomBytes(32);
    }
    
    /**
     * 加密数据
     */
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            data: encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    
    /**
     * 解密数据
     */
    decrypt(encrypted, iv, authTag) {
        const decipher = crypto.createDecipheriv(
            this.algorithm,
            this.key,
            Buffer.from(iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }
    
    /**
     * 哈希敏感数据（单向）
     */
    hash(data) {
        return crypto
            .createHash('sha256')
            .update(data)
            .digest('hex');
    }
}

/**
 * 数据泄露检测
 */
class LeakDetector {
    constructor() {
        this.sensitivePatterns = [
            // API密钥
            /sk_[a-zA-Z0-9]{32,}/g,
            /pk_[a-zA-Z0-9]{32,}/g,
            // JWT令牌
            /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
            // 密码模式
            /password["\s:=]+[^\s"]+/gi,
            /pwd["\s:=]+[^\s"]+/gi,
            // 数据库连接字符串
            /mongodb:\/\/[^\s]+/gi,
            /postgres:\/\/[^\s]+/gi,
            /mysql:\/\/[^\s]+/gi,
            // AWS密钥
            /AKIA[0-9A-Z]{16}/g,
            // 私钥
            /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
            // 信用卡号
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
            // 身份证号
            /\b\d{17}[\dXx]\b/g
        ];
    }
    
    /**
     * 检测敏感数据
     */
    detect(content) {
        if (typeof content !== 'string') {
            content = JSON.stringify(content);
        }
        
        const findings = [];
        
        for (const pattern of this.sensitivePatterns) {
            const matches = content.match(pattern);
            if (matches) {
                findings.push({
                    pattern: pattern.toString(),
                    count: matches.length,
                    samples: matches.slice(0, 3) // 只记录前3个样本
                });
            }
        }
        
        return {
            detected: findings.length > 0,
            findings
        };
    }
    
    /**
     * 清理敏感数据
     */
    sanitize(content) {
        if (typeof content !== 'string') {
            content = JSON.stringify(content);
        }
        
        let sanitized = content;
        
        for (const pattern of this.sensitivePatterns) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        
        return sanitized;
    }
}

/**
 * 数据访问审计
 */
class DataAccessAuditor {
    constructor() {
        this.accessLog = [];
        this.maxLogSize = 10000;
    }
    
    /**
     * 记录数据访问
     */
    log(userId, action, resource, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            userId,
            action,
            resource,
            metadata,
            ip: metadata.ip || 'unknown'
        };
        
        this.accessLog.push(entry);
        
        // 限制日志大小
        if (this.accessLog.length > this.maxLogSize) {
            this.accessLog.shift();
        }
        
        // 检测异常访问
        this.detectAnomalies(userId);
    }
    
    /**
     * 检测异常访问模式
     */
    detectAnomalies(userId) {
        const userLogs = this.accessLog
            .filter(log => log.userId === userId)
            .slice(-20);
        
        if (userLogs.length < 10) return;
        
        // 检测短时间内大量访问
        const recentLogs = userLogs.filter(log => {
            const logTime = new Date(log.timestamp).getTime();
            return Date.now() - logTime < 60000; // 最近1分钟
        });
        
        if (recentLogs.length > 15) {
            console.warn(`异常数据访问: 用户 ${userId} 在短时间内访问大量数据`);
            return true;
        }
        
        // 检测访问敏感资源
        const sensitiveAccess = recentLogs.filter(log =>
            log.resource.includes('password') ||
            log.resource.includes('token') ||
            log.resource.includes('secret')
        );
        
        if (sensitiveAccess.length > 5) {
            console.warn(`异常数据访问: 用户 ${userId} 频繁访问敏感资源`);
            return true;
        }
        
        return false;
    }
    
    /**
     * 获取用户访问历史
     */
    getUserHistory(userId, limit = 50) {
        return this.accessLog
            .filter(log => log.userId === userId)
            .slice(-limit);
    }
    
    /**
     * 获取资源访问历史
     */
    getResourceHistory(resource, limit = 50) {
        return this.accessLog
            .filter(log => log.resource === resource)
            .slice(-limit);
    }
}

/**
 * 数据最小化
 */
class DataMinimizer {
    /**
     * 移除敏感字段
     */
    static removeSensitiveFields(obj, sensitiveFields = []) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const defaultSensitive = [
            'password',
            'token',
            'secret',
            'apiKey',
            'privateKey',
            'creditCard',
            'ssn',
            'idCard'
        ];
        
        const allSensitive = [...defaultSensitive, ...sensitiveFields];
        const cleaned = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            // 检查是否是敏感字段
            const isSensitive = allSensitive.some(field =>
                key.toLowerCase().includes(field.toLowerCase())
            );
            
            if (isSensitive) {
                continue; // 跳过敏感字段
            }
            
            // 递归处理嵌套对象
            if (value && typeof value === 'object') {
                cleaned[key] = this.removeSensitiveFields(value, sensitiveFields);
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }
    
    /**
     * 只保留必要字段
     */
    static keepOnlyFields(obj, allowedFields) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const filtered = {};
        
        for (const field of allowedFields) {
            if (obj.hasOwnProperty(field)) {
                filtered[field] = obj[field];
            }
        }
        
        return filtered;
    }
}

/**
 * 响应数据清理
 */
class ResponseSanitizer {
    /**
     * 清理响应数据
     */
    static sanitize(data, options = {}) {
        const {
            removeSensitive = true,
            maskPII = true,
            removeNull = false
        } = options;
        
        if (!data) return data;
        
        let sanitized = data;
        
        // 移除敏感字段
        if (removeSensitive) {
            sanitized = DataMinimizer.removeSensitiveFields(sanitized);
        }
        
        // 脱敏个人信息
        if (maskPII && typeof sanitized === 'object') {
            sanitized = this.maskPIIFields(sanitized);
        }
        
        // 移除null值
        if (removeNull) {
            sanitized = this.removeNullValues(sanitized);
        }
        
        return sanitized;
    }
    
    /**
     * 脱敏PII字段
     */
    static maskPIIFields(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const masked = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (key.toLowerCase().includes('email')) {
                masked[key] = DataMasking.maskEmail(value);
            } else if (key.toLowerCase().includes('phone')) {
                masked[key] = DataMasking.maskPhone(value);
            } else if (key.toLowerCase().includes('ip')) {
                masked[key] = DataMasking.maskIP(value);
            } else if (value && typeof value === 'object') {
                masked[key] = this.maskPIIFields(value);
            } else {
                masked[key] = value;
            }
        }
        
        return masked;
    }
    
    /**
     * 移除null值
     */
    static removeNullValues(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        
        const cleaned = Array.isArray(obj) ? [] : {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                continue;
            }
            
            if (typeof value === 'object') {
                cleaned[key] = this.removeNullValues(value);
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }
}

/**
 * 数据保留策略
 */
class DataRetentionPolicy {
    constructor() {
        this.policies = new Map();
    }
    
    /**
     * 设置保留策略
     */
    setPolicy(dataType, retentionDays) {
        this.policies.set(dataType, retentionDays);
    }
    
    /**
     * 检查是否应该删除
     */
    shouldDelete(dataType, createdAt) {
        const policy = this.policies.get(dataType);
        if (!policy) return false;
        
        const age = Date.now() - new Date(createdAt).getTime();
        const maxAge = policy * 24 * 60 * 60 * 1000;
        
        return age > maxAge;
    }
    
    /**
     * 获取过期数据
     */
    getExpiredData(dataType, dataList) {
        return dataList.filter(item =>
            this.shouldDelete(dataType, item.created_at || item.createdAt)
        );
    }
}

// 创建全局实例
const leakDetector = new LeakDetector();
const dataAccessAuditor = new DataAccessAuditor();
const dataRetentionPolicy = new DataRetentionPolicy();

// 设置默认保留策略
dataRetentionPolicy.setPolicy('messages', 90); // 消息保留90天
dataRetentionPolicy.setPolicy('logs', 30); // 日志保留30天
dataRetentionPolicy.setPolicy('sessions', 7); // 会话保留7天

/**
 * 数据保护中间件
 */
function dataProtectionMiddleware(req, res, next) {
    // 拦截响应
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
        // 检测数据泄露
        const leakCheck = leakDetector.detect(data);
        if (leakCheck.detected) {
            console.error('检测到敏感数据泄露:', leakCheck.findings);
            data = leakDetector.sanitize(data);
        }
        
        // 清理响应数据
        const sanitized = ResponseSanitizer.sanitize(data, {
            removeSensitive: true,
            maskPII: false, // 根据需要启用
            removeNull: false
        });
        
        return originalJson(sanitized);
    };
    
    next();
}

module.exports = {
    DataMasking,
    SecureStorage,
    LeakDetector,
    DataAccessAuditor,
    DataMinimizer,
    ResponseSanitizer,
    DataRetentionPolicy,
    leakDetector,
    dataAccessAuditor,
    dataRetentionPolicy,
    dataProtectionMiddleware
};
