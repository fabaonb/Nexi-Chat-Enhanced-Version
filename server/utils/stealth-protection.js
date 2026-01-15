// 隐蔽防护模块 - 不对外公开的安全措施
const crypto = require('crypto');

/**
 * 蜜罐陷阱
 */
class HoneyPot {
    constructor() {
        this.trapped = new Set();
        this.traps = new Map();
        this.initTraps();
    }
    
    /**
     * 初始化陷阱
     */
    initTraps() {
        // 常见的攻击路径
        const commonPaths = [
            '/admin',
            '/.env',
            '/config',
            '/backup',
            '/.git',
            '/phpMyAdmin',
            '/wp-admin',
            '/administrator',
            '/.aws',
            '/api/admin',
            '/api/config',
            '/api/debug',
            '/api/test',
            '/.htaccess',
            '/web.config'
        ];
        
        commonPaths.forEach(path => {
            this.traps.set(path, {
                hits: 0,
                lastHit: null
            });
        });
    }
    
    /**
     * 检查是否触发陷阱
     */
    check(req) {
        const path = req.path.toLowerCase();
        const ip = this.getIP(req);
        
        for (const [trapPath, data] of this.traps.entries()) {
            if (path.includes(trapPath)) {
                data.hits++;
                data.lastHit = Date.now();
                this.trapped.add(ip);
                
                // 记录但不暴露
                this.logSilently(ip, path);
                
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 检查IP是否已被捕获
     */
    isTrapped(req) {
        const ip = this.getIP(req);
        return this.trapped.has(ip);
    }
    
    /**
     * 静默记录
     */
    logSilently(ip, path) {
        // 不输出到控制台，只内部记录
        const entry = {
            t: Date.now(),
            i: this.hashIP(ip),
            p: path
        };
        // 可以发送到外部监控系统
    }
    
    /**
     * 哈希IP
     */
    hashIP(ip) {
        return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
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
}

/**
 * 行为分析
 */
class BehaviorAnalyzer {
    constructor() {
        this.profiles = new Map();
        this.suspiciousPatterns = this.initPatterns();
    }
    
    /**
     * 初始化可疑模式
     */
    initPatterns() {
        return {
            // 快速连续请求不同端点
            scanning: (profile) => {
                const uniquePaths = new Set(profile.requests.map(r => r.path));
                return uniquePaths.size > 20 && profile.requests.length > 30;
            },
            
            // 尝试多种HTTP方法
            methodProbing: (profile) => {
                const methods = new Set(profile.requests.map(r => r.method));
                return methods.size > 4;
            },
            
            // 异常User-Agent模式
            botPattern: (profile) => {
                const ua = profile.userAgent || '';
                return !ua || ua.length < 10 || /bot|crawler|spider|scraper/i.test(ua);
            },
            
            // 缺少常见浏览器头
            missingHeaders: (profile) => {
                return !profile.hasAccept || !profile.hasAcceptLanguage;
            },
            
            // 时间模式异常
            timePattern: (profile) => {
                if (profile.requests.length < 5) return false;
                const intervals = [];
                for (let i = 1; i < profile.requests.length; i++) {
                    intervals.push(profile.requests[i].time - profile.requests[i-1].time);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                return avgInterval < 100; // 平均间隔小于100ms
            }
        };
    }
    
    /**
     * 分析请求
     */
    analyze(req) {
        const ip = this.getIP(req);
        
        if (!this.profiles.has(ip)) {
            this.profiles.set(ip, {
                requests: [],
                userAgent: req.headers['user-agent'],
                hasAccept: !!req.headers['accept'],
                hasAcceptLanguage: !!req.headers['accept-language'],
                score: 0
            });
        }
        
        const profile = this.profiles.get(ip);
        profile.requests.push({
            time: Date.now(),
            path: req.path,
            method: req.method
        });
        
        // 只保留最近100个请求
        if (profile.requests.length > 100) {
            profile.requests = profile.requests.slice(-100);
        }
        
        // 计算可疑分数
        let score = 0;
        for (const [name, check] of Object.entries(this.suspiciousPatterns)) {
            if (check(profile)) {
                score += 1;
            }
        }
        
        profile.score = score;
        
        return {
            suspicious: score >= 2,
            score,
            profile
        };
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
}

/**
 * 响应混淆
 */
class ResponseObfuscator {
    /**
     * 混淆错误响应
     */
    static obfuscateError(error, req) {
        // 对可疑请求返回通用错误
        const genericErrors = [
            'Request failed',
            'Invalid request',
            'Bad request',
            'Not found',
            'Access denied'
        ];
        
        return genericErrors[Math.floor(Math.random() * genericErrors.length)];
    }
    
    /**
     * 添加随机延迟
     */
    static async addRandomDelay(min = 100, max = 500) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    
    /**
     * 移除敏感响应头
     */
    static sanitizeHeaders(res) {
        // 移除可能泄露信息的头
        res.removeHeader('X-Powered-By');
        res.removeHeader('Server');
        res.removeHeader('X-AspNet-Version');
        res.removeHeader('X-AspNetMvc-Version');
    }
}

/**
 * 请求指纹增强
 */
class AdvancedFingerprint {
    /**
     * 生成高级指纹
     */
    static generate(req) {
        const components = [
            req.headers['user-agent'] || '',
            req.headers['accept'] || '',
            req.headers['accept-language'] || '',
            req.headers['accept-encoding'] || '',
            this.getTLSFingerprint(req),
            this.getTimingFingerprint(req)
        ];
        
        return crypto
            .createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }
    
    /**
     * TLS指纹
     */
    static getTLSFingerprint(req) {
        const cipher = req.connection?.getCipher?.();
        return cipher ? `${cipher.name}-${cipher.version}` : '';
    }
    
    /**
     * 时序指纹
     */
    static getTimingFingerprint(req) {
        return Date.now().toString(36);
    }
}

/**
 * 自适应防护
 */
class AdaptiveProtection {
    constructor() {
        this.threatLevel = 0; // 0-10
        this.adjustInterval = 60000; // 1分钟调整一次
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            suspiciousRequests: 0
        };
        
        setInterval(() => this.adjust(), this.adjustInterval);
    }
    
    /**
     * 记录指标
     */
    recordMetric(type) {
        this.metrics.totalRequests++;
        if (type === 'blocked') {
            this.metrics.blockedRequests++;
        } else if (type === 'suspicious') {
            this.metrics.suspiciousRequests++;
        }
    }
    
    /**
     * 自动调整威胁等级
     */
    adjust() {
        const { totalRequests, blockedRequests, suspiciousRequests } = this.metrics;
        
        if (totalRequests === 0) return;
        
        const blockRate = blockedRequests / totalRequests;
        const suspiciousRate = suspiciousRequests / totalRequests;
        
        // 根据比率调整威胁等级
        if (blockRate > 0.1 || suspiciousRate > 0.2) {
            this.threatLevel = Math.min(10, this.threatLevel + 1);
        } else if (blockRate < 0.01 && suspiciousRate < 0.05) {
            this.threatLevel = Math.max(0, this.threatLevel - 1);
        }
        
        // 重置指标
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            suspiciousRequests: 0
        };
    }
    
    /**
     * 获取当前防护级别
     */
    getProtectionLevel() {
        if (this.threatLevel >= 8) return 'maximum';
        if (this.threatLevel >= 5) return 'high';
        if (this.threatLevel >= 3) return 'medium';
        return 'normal';
    }
    
    /**
     * 根据威胁等级调整限制
     */
    getAdjustedLimits() {
        const level = this.getProtectionLevel();
        
        const limits = {
            normal: { requests: 100, window: 60000 },
            medium: { requests: 50, window: 60000 },
            high: { requests: 30, window: 60000 },
            maximum: { requests: 10, window: 60000 }
        };
        
        return limits[level];
    }
}

/**
 * 隐蔽日志
 */
class StealthLogger {
    constructor() {
        this.buffer = [];
        this.maxBuffer = 1000;
    }
    
    /**
     * 记录事件（不输出到控制台）
     */
    log(event, data) {
        this.buffer.push({
            t: Date.now(),
            e: event,
            d: this.sanitize(data)
        });
        
        if (this.buffer.length > this.maxBuffer) {
            this.buffer.shift();
        }
    }
    
    /**
     * 清理敏感数据
     */
    sanitize(data) {
        if (typeof data === 'string') {
            return data.substring(0, 100);
        }
        return data;
    }
    
    /**
     * 获取日志（仅内部使用）
     */
    getLogs(filter = null) {
        if (filter) {
            return this.buffer.filter(log => log.e === filter);
        }
        return this.buffer;
    }
}

/**
 * 请求验证增强
 */
class RequestValidator {
    /**
     * 验证请求合法性
     */
    static validate(req) {
        const checks = [
            this.checkHeaders(req),
            this.checkMethod(req),
            this.checkPath(req),
            this.checkBody(req)
        ];
        
        return checks.every(check => check.valid);
    }
    
    /**
     * 检查请求头
     */
    static checkHeaders(req) {
        // 检查必要的头部
        const required = ['host'];
        const missing = required.filter(h => !req.headers[h]);
        
        if (missing.length > 0) {
            return { valid: false, reason: 'missing_headers' };
        }
        
        // 检查异常头部
        const suspicious = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
        const hasSuspicious = suspicious.some(h => req.headers[h]);
        
        if (hasSuspicious) {
            return { valid: false, reason: 'suspicious_headers' };
        }
        
        return { valid: true };
    }
    
    /**
     * 检查HTTP方法
     */
    static checkMethod(req) {
        const allowed = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        
        if (!allowed.includes(req.method)) {
            return { valid: false, reason: 'invalid_method' };
        }
        
        return { valid: true };
    }
    
    /**
     * 检查路径
     */
    static checkPath(req) {
        const path = req.path;
        
        // 检查路径长度
        if (path.length > 2048) {
            return { valid: false, reason: 'path_too_long' };
        }
        
        // 检查空字节
        if (path.includes('\0')) {
            return { valid: false, reason: 'null_byte' };
        }
        
        return { valid: true };
    }
    
    /**
     * 检查请求体
     */
    static checkBody(req) {
        if (!req.body) return { valid: true };
        
        // 检查嵌套深度
        const depth = this.getObjectDepth(req.body);
        if (depth > 10) {
            return { valid: false, reason: 'deep_nesting' };
        }
        
        return { valid: true };
    }
    
    /**
     * 获取对象深度
     */
    static getObjectDepth(obj, current = 0) {
        if (typeof obj !== 'object' || obj === null) {
            return current;
        }
        
        const depths = Object.values(obj).map(v => 
            this.getObjectDepth(v, current + 1)
        );
        
        return Math.max(current, ...depths);
    }
}

// 创建全局实例
const honeyPot = new HoneyPot();
const behaviorAnalyzer = new BehaviorAnalyzer();
const adaptiveProtection = new AdaptiveProtection();
const stealthLogger = new StealthLogger();

/**
 * 隐蔽防护中间件
 */
function stealthProtectionMiddleware(req, res, next) {
    // 蜜罐检查
    if (honeyPot.check(req)) {
        adaptiveProtection.recordMetric('blocked');
        stealthLogger.log('honeypot', { path: req.path });
        
        // 返回看似正常的404
        return res.status(404).json({ error: 'Not found' });
    }
    
    // 检查是否已被捕获
    if (honeyPot.isTrapped(req)) {
        adaptiveProtection.recordMetric('blocked');
        // 添加延迟，消耗攻击者时间
        return setTimeout(() => {
            res.status(404).json({ error: 'Not found' });
        }, 3000);
    }
    
    // 行为分析
    const analysis = behaviorAnalyzer.analyze(req);
    if (analysis.suspicious) {
        adaptiveProtection.recordMetric('suspicious');
        stealthLogger.log('suspicious', { 
            score: analysis.score,
            path: req.path 
        });
        
        // 高分直接阻止
        if (analysis.score >= 4) {
            adaptiveProtection.recordMetric('blocked');
            return res.status(429).json({ error: 'Too many requests' });
        }
    }
    
    // 请求验证
    if (!RequestValidator.validate(req)) {
        adaptiveProtection.recordMetric('blocked');
        return res.status(400).json({ error: 'Bad request' });
    }
    
    // 清理响应头
    ResponseObfuscator.sanitizeHeaders(res);
    
    // 记录正常请求
    adaptiveProtection.recordMetric('normal');
    
    next();
}

module.exports = {
    HoneyPot,
    BehaviorAnalyzer,
    ResponseObfuscator,
    AdvancedFingerprint,
    AdaptiveProtection,
    StealthLogger,
    RequestValidator,
    honeyPot,
    behaviorAnalyzer,
    adaptiveProtection,
    stealthLogger,
    stealthProtectionMiddleware
};
