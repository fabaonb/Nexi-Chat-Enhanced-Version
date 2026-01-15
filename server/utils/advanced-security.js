// 高级安全防护模块 - 多层防御系统
const crypto = require('crypto');

/**
 * 请求指纹识别 - 检测异常行为
 */
class RequestFingerprint {
    constructor() {
        this.fingerprints = new Map();
        this.suspiciousIPs = new Set();
        this.cleanupInterval = 3600000; // 1小时清理一次
        
        setInterval(() => this.cleanup(), this.cleanupInterval);
    }
    
    /**
     * 生成请求指纹
     */
    generate(req) {
        const components = [
            req.headers['user-agent'] || '',
            req.headers['accept-language'] || '',
            req.headers['accept-encoding'] || '',
            this.getIP(req)
        ];
        
        return crypto
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }
    
    /**
     * 获取真实IP
     */
    getIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               'unknown';
    }
    
    /**
     * 记录请求
     */
    track(req) {
        const fingerprint = this.generate(req);
        const ip = this.getIP(req);
        const now = Date.now();
        
        if (!this.fingerprints.has(fingerprint)) {
            this.fingerprints.set(fingerprint, {
                ip,
                requests: [],
                firstSeen: now,
                suspicious: false
            });
        }
        
        const data = this.fingerprints.get(fingerprint);
        data.requests.push({
            timestamp: now,
            path: req.path,
            method: req.method
        });
        
        // 保留最近100个请求
        if (data.requests.length > 100) {
            data.requests = data.requests.slice(-100);
        }
        
        return this.analyze(fingerprint);
    }
    
    /**
     * 分析请求模式
     */
    analyze(fingerprint) {
        const data = this.fingerprints.get(fingerprint);
        if (!data) return { suspicious: false };
        
        const recentRequests = data.requests.filter(
            r => Date.now() - r.timestamp < 60000 // 最近1分钟
        );
        
        // 检测异常模式
        const patterns = {
            // 高频请求
            highFrequency: recentRequests.length > 60,
            // 扫描行为（访问大量不同路径）
            scanning: new Set(recentRequests.map(r => r.path)).size > 20,
            // 暴力破解（大量登录尝试）
            bruteForce: recentRequests.filter(r => 
                r.path.includes('/login') || r.path.includes('/register')
            ).length > 5
        };
        
        const suspicious = Object.values(patterns).some(v => v);
        
        if (suspicious) {
            data.suspicious = true;
            this.suspiciousIPs.add(data.ip);
        }
        
        return {
            suspicious,
            patterns,
            requestCount: recentRequests.length
        };
    }
    
    /**
     * 检查IP是否可疑
     */
    isSuspicious(req) {
        const ip = this.getIP(req);
        return this.suspiciousIPs.has(ip);
    }
    
    /**
     * 清理过期数据
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 3600000; // 1小时
        
        for (const [fingerprint, data] of this.fingerprints.entries()) {
            if (now - data.firstSeen > maxAge) {
                this.fingerprints.delete(fingerprint);
            }
        }
    }
}

/**
 * 加密通信保护
 */
class EncryptionManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
    }
    
    /**
     * 生成密钥
     */
    generateKey() {
        return crypto.randomBytes(this.keyLength);
    }
    
    /**
     * 加密数据
     */
    encrypt(data, key) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    
    /**
     * 解密数据
     */
    decrypt(encrypted, key, iv, authTag) {
        const decipher = crypto.createDecipheriv(
            this.algorithm,
            key,
            Buffer.from(iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }
    
    /**
     * 生成安全令牌
     */
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * 哈希敏感数据
     */
    hash(data, salt = null) {
        if (!salt) {
            salt = crypto.randomBytes(16).toString('hex');
        }
        
        const hash = crypto
            .pbkdf2Sync(data, salt, 100000, 64, 'sha512')
            .toString('hex');
        
        return { hash, salt };
    }
}

/**
 * 输入深度验证
 */
class InputValidator {
    /**
     * 深度验证对象
     */
    static validateDeep(obj, schema) {
        const errors = [];
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = obj[key];
            
            // 必填验证
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${key} 是必填项`);
                continue;
            }
            
            if (value === undefined || value === null) continue;
            
            // 类型验证
            if (rules.type && typeof value !== rules.type) {
                errors.push(`${key} 类型错误`);
                continue;
            }
            
            // 字符串验证
            if (rules.type === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${key} 长度不能少于 ${rules.minLength}`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${key} 长度不能超过 ${rules.maxLength}`);
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${key} 格式不正确`);
                }
            }
            
            // 数字验证
            if (rules.type === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${key} 不能小于 ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`${key} 不能大于 ${rules.max}`);
                }
            }
            
            // 自定义验证
            if (rules.custom && typeof rules.custom === 'function') {
                const result = rules.custom(value);
                if (result !== true) {
                    errors.push(result || `${key} 验证失败`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 检测恶意模式
     */
    static detectMaliciousPatterns(input) {
        if (typeof input !== 'string') return false;
        
        const patterns = [
            // XSS
            /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe/gi,
            // SQL注入
            /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/gi,
            /(--|\;|\/\*|\*\/)/g,
            // 命令注入
            /[;&|`$(){}[\]<>]/g,
            // 路径遍历
            /\.\.[\/\\]/g,
            /%2e%2e/gi,
            // LDAP注入
            /[()&|!]/g,
            // XML注入
            /<!ENTITY/gi,
            /<!\[CDATA\[/gi
        ];
        
        return patterns.some(pattern => pattern.test(input));
    }
}

/**
 * 会话管理
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.maxSessions = 10000;
        this.sessionTimeout = 3600000; // 1小时
        
        setInterval(() => this.cleanup(), 300000); // 5分钟清理一次
    }
    
    /**
     * 创建会话
     */
    create(userId, metadata = {}) {
        const sessionId = crypto.randomBytes(32).toString('hex');
        
        this.sessions.set(sessionId, {
            userId,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            metadata
        });
        
        // 限制会话数量
        if (this.sessions.size > this.maxSessions) {
            this.cleanupOldest();
        }
        
        return sessionId;
    }
    
    /**
     * 验证会话
     */
    validate(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return { valid: false, reason: '会话不存在' };
        }
        
        const now = Date.now();
        
        // 检查超时
        if (now - session.lastActivity > this.sessionTimeout) {
            this.sessions.delete(sessionId);
            return { valid: false, reason: '会话已过期' };
        }
        
        // 更新活动时间
        session.lastActivity = now;
        
        return {
            valid: true,
            session
        };
    }
    
    /**
     * 销毁会话
     */
    destroy(sessionId) {
        return this.sessions.delete(sessionId);
    }
    
    /**
     * 清理过期会话
     */
    cleanup() {
        const now = Date.now();
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
            }
        }
    }
    
    /**
     * 清理最旧的会话
     */
    cleanupOldest() {
        let oldest = null;
        let oldestTime = Infinity;
        
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.lastActivity < oldestTime) {
                oldest = sessionId;
                oldestTime = session.lastActivity;
            }
        }
        
        if (oldest) {
            this.sessions.delete(oldest);
        }
    }
}

/**
 * API密钥管理
 */
class APIKeyManager {
    constructor() {
        this.keys = new Map();
    }
    
    /**
     * 生成API密钥
     */
    generate(userId, permissions = []) {
        const key = 'sk_' + crypto.randomBytes(32).toString('hex');
        
        this.keys.set(key, {
            userId,
            permissions,
            createdAt: Date.now(),
            lastUsed: null,
            usageCount: 0
        });
        
        return key;
    }
    
    /**
     * 验证API密钥
     */
    validate(key, requiredPermission = null) {
        const keyData = this.keys.get(key);
        
        if (!keyData) {
            return { valid: false, reason: '无效的API密钥' };
        }
        
        // 检查权限
        if (requiredPermission && !keyData.permissions.includes(requiredPermission)) {
            return { valid: false, reason: '权限不足' };
        }
        
        // 更新使用信息
        keyData.lastUsed = Date.now();
        keyData.usageCount++;
        
        return {
            valid: true,
            userId: keyData.userId
        };
    }
    
    /**
     * 撤销API密钥
     */
    revoke(key) {
        return this.keys.delete(key);
    }
}

/**
 * 威胁检测系统
 */
class ThreatDetector {
    constructor() {
        this.threats = new Map();
        this.threshold = 10; // 威胁分数阈值
    }
    
    /**
     * 评估威胁
     */
    assess(req, analysis) {
        const ip = this.getIP(req);
        let score = 0;
        const reasons = [];
        
        // 高频请求
        if (analysis.patterns?.highFrequency) {
            score += 5;
            reasons.push('高频请求');
        }
        
        // 扫描行为
        if (analysis.patterns?.scanning) {
            score += 7;
            reasons.push('扫描行为');
        }
        
        // 暴力破解
        if (analysis.patterns?.bruteForce) {
            score += 10;
            reasons.push('暴力破解');
        }
        
        // 恶意User-Agent
        const ua = req.headers['user-agent'] || '';
        if (this.isMaliciousUA(ua)) {
            score += 8;
            reasons.push('恶意User-Agent');
        }
        
        // 缺少必要头部
        if (!req.headers['accept'] || !req.headers['accept-language']) {
            score += 3;
            reasons.push('缺少必要头部');
        }
        
        // 记录威胁
        if (score > 0) {
            if (!this.threats.has(ip)) {
                this.threats.set(ip, {
                    score: 0,
                    incidents: []
                });
            }
            
            const threat = this.threats.get(ip);
            threat.score += score;
            threat.incidents.push({
                timestamp: Date.now(),
                score,
                reasons,
                path: req.path
            });
        }
        
        return {
            score,
            reasons,
            blocked: score >= this.threshold
        };
    }
    
    /**
     * 检测恶意User-Agent
     */
    isMaliciousUA(ua) {
        const malicious = [
            /sqlmap/i,
            /nikto/i,
            /nmap/i,
            /masscan/i,
            /nessus/i,
            /openvas/i,
            /acunetix/i,
            /burp/i,
            /metasploit/i,
            /havij/i
        ];
        
        return malicious.some(pattern => pattern.test(ua));
    }
    
    /**
     * 获取IP
     */
    getIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               'unknown';
    }
    
    /**
     * 检查IP威胁等级
     */
    getThreatLevel(ip) {
        const threat = this.threats.get(ip);
        if (!threat) return 0;
        return threat.score;
    }
}

// 创建全局实例
const fingerprint = new RequestFingerprint();
const encryption = new EncryptionManager();
const sessionManager = new SessionManager();
const apiKeyManager = new APIKeyManager();
const threatDetector = new ThreatDetector();

/**
 * 高级安全中间件
 */
function advancedSecurityMiddleware(req, res, next) {
    // 请求指纹追踪
    const analysis = fingerprint.track(req);
    
    // 威胁评估
    const threat = threatDetector.assess(req, analysis);
    
    // 阻止高威胁请求
    if (threat.blocked) {
        console.warn('阻止威胁请求:', {
            ip: fingerprint.getIP(req),
            score: threat.score,
            reasons: threat.reasons
        });
        
        return res.status(403).json({
            error: '请求被拒绝'
        });
    }
    
    // 添加安全头
    res.setHeader('X-Request-ID', crypto.randomBytes(16).toString('hex'));
    
    next();
}

module.exports = {
    RequestFingerprint,
    EncryptionManager,
    InputValidator,
    SessionManager,
    APIKeyManager,
    ThreatDetector,
    fingerprint,
    encryption,
    sessionManager,
    apiKeyManager,
    threatDetector,
    advancedSecurityMiddleware
};
