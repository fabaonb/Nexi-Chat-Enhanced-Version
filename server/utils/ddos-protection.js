// DDoS 防护模块
const crypto = require('crypto');

/**
 * 分布式拒绝服务攻击防护
 */
class DDoSProtection {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000; // 1分钟窗口
        this.maxRequests = options.maxRequests || 100;
        this.banDuration = options.banDuration || 3600000; // 1小时封禁
        
        this.requests = new Map(); // IP -> 请求记录
        this.banned = new Map(); // IP -> 封禁时间
        this.whitelist = new Set(options.whitelist || []);
        
        // 定期清理
        setInterval(() => this.cleanup(), 60000);
    }
    
    /**
     * 检查请求
     */
    check(req) {
        const ip = this.getIP(req);
        
        // 白名单检查
        if (this.whitelist.has(ip)) {
            return { allowed: true };
        }
        
        // 封禁检查
        if (this.isBanned(ip)) {
            return {
                allowed: false,
                reason: '您的IP已被临时封禁',
                retryAfter: this.getBanTimeRemaining(ip)
            };
        }
        
        // 请求频率检查
        const now = Date.now();
        
        if (!this.requests.has(ip)) {
            this.requests.set(ip, []);
        }
        
        const ipRequests = this.requests.get(ip);
        
        // 移除过期请求
        const validRequests = ipRequests.filter(
            timestamp => now - timestamp < this.windowMs
        );
        
        // 检查是否超过限制
        if (validRequests.length >= this.maxRequests) {
            this.ban(ip);
            return {
                allowed: false,
                reason: '请求频率超过限制',
                retryAfter: this.banDuration / 1000
            };
        }
        
        // 记录请求
        validRequests.push(now);
        this.requests.set(ip, validRequests);
        
        return {
            allowed: true,
            remaining: this.maxRequests - validRequests.length
        };
    }
    
    /**
     * 封禁IP
     */
    ban(ip) {
        const until = Date.now() + this.banDuration;
        this.banned.set(ip, until);
        console.warn(`IP ${ip} 已被封禁至 ${new Date(until).toISOString()}`);
    }
    
    /**
     * 检查是否被封禁
     */
    isBanned(ip) {
        const banUntil = this.banned.get(ip);
        if (!banUntil) return false;
        
        if (Date.now() > banUntil) {
            this.banned.delete(ip);
            return false;
        }
        
        return true;
    }
    
    /**
     * 获取封禁剩余时间
     */
    getBanTimeRemaining(ip) {
        const banUntil = this.banned.get(ip);
        if (!banUntil) return 0;
        
        const remaining = banUntil - Date.now();
        return Math.max(0, Math.ceil(remaining / 1000));
    }
    
    /**
     * 解除封禁
     */
    unban(ip) {
        return this.banned.delete(ip);
    }
    
    /**
     * 添加到白名单
     */
    addToWhitelist(ip) {
        this.whitelist.add(ip);
    }
    
    /**
     * 从白名单移除
     */
    removeFromWhitelist(ip) {
        this.whitelist.delete(ip);
    }
    
    /**
     * 获取IP地址
     */
    getIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               'unknown';
    }
    
    /**
     * 清理过期数据
     */
    cleanup() {
        const now = Date.now();
        
        // 清理过期的请求记录
        for (const [ip, requests] of this.requests.entries()) {
            const validRequests = requests.filter(
                timestamp => now - timestamp < this.windowMs
            );
            
            if (validRequests.length === 0) {
                this.requests.delete(ip);
            } else {
                this.requests.set(ip, validRequests);
            }
        }
        
        // 清理过期的封禁
        for (const [ip, banUntil] of this.banned.entries()) {
            if (now > banUntil) {
                this.banned.delete(ip);
            }
        }
    }
    
    /**
     * 获取统计信息
     */
    getStats() {
        return {
            activeIPs: this.requests.size,
            bannedIPs: this.banned.size,
            whitelistedIPs: this.whitelist.size
        };
    }
}

/**
 * 连接限制器
 */
class ConnectionLimiter {
    constructor(maxConnections = 1000) {
        this.maxConnections = maxConnections;
        this.connections = new Map(); // IP -> 连接数
    }
    
    /**
     * 检查连接
     */
    check(req) {
        const ip = this.getIP(req);
        const current = this.connections.get(ip) || 0;
        
        if (current >= this.maxConnections) {
            return {
                allowed: false,
                reason: '连接数超过限制'
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * 添加连接
     */
    add(req) {
        const ip = this.getIP(req);
        const current = this.connections.get(ip) || 0;
        this.connections.set(ip, current + 1);
    }
    
    /**
     * 移除连接
     */
    remove(req) {
        const ip = this.getIP(req);
        const current = this.connections.get(ip) || 0;
        
        if (current > 0) {
            this.connections.set(ip, current - 1);
        }
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
 * 慢速攻击防护
 */
class SlowlorisProtection {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000; // 30秒超时
        this.maxHeaderSize = options.maxHeaderSize || 8192; // 8KB
        this.maxBodySize = options.maxBodySize || 10485760; // 10MB
    }
    
    /**
     * 创建超时中间件
     */
    middleware() {
        return (req, res, next) => {
            // 设置请求超时
            req.setTimeout(this.timeout, () => {
                res.status(408).json({ error: '请求超时' });
            });
            
            // 检查头部大小
            const headerSize = JSON.stringify(req.headers).length;
            if (headerSize > this.maxHeaderSize) {
                return res.status(413).json({ error: '请求头过大' });
            }
            
            // 检查请求体大小
            const contentLength = parseInt(req.headers['content-length'] || '0');
            if (contentLength > this.maxBodySize) {
                return res.status(413).json({ error: '请求体过大' });
            }
            
            next();
        };
    }
}

/**
 * 流量整形器
 */
class TrafficShaper {
    constructor(options = {}) {
        this.bandwidth = options.bandwidth || 1048576; // 1MB/s
        this.buckets = new Map(); // IP -> 令牌桶
    }
    
    /**
     * 检查流量
     */
    check(req, size) {
        const ip = this.getIP(req);
        const now = Date.now();
        
        if (!this.buckets.has(ip)) {
            this.buckets.set(ip, {
                tokens: this.bandwidth,
                lastRefill: now
            });
        }
        
        const bucket = this.buckets.get(ip);
        
        // 补充令牌
        const elapsed = now - bucket.lastRefill;
        const refill = (elapsed / 1000) * this.bandwidth;
        bucket.tokens = Math.min(this.bandwidth, bucket.tokens + refill);
        bucket.lastRefill = now;
        
        // 检查是否有足够令牌
        if (bucket.tokens < size) {
            return {
                allowed: false,
                reason: '流量超过限制',
                retryAfter: Math.ceil((size - bucket.tokens) / this.bandwidth)
            };
        }
        
        // 消耗令牌
        bucket.tokens -= size;
        
        return { allowed: true };
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
 * 请求验证器
 */
class RequestValidator {
    /**
     * 验证HTTP方法
     */
    static validateMethod(req, allowedMethods) {
        if (!allowedMethods.includes(req.method)) {
            return {
                valid: false,
                error: '不支持的HTTP方法'
            };
        }
        return { valid: true };
    }
    
    /**
     * 验证Content-Type
     */
    static validateContentType(req, allowedTypes) {
        const contentType = req.headers['content-type'];
        
        if (!contentType) {
            return { valid: true }; // GET请求可能没有Content-Type
        }
        
        const matches = allowedTypes.some(type => 
            contentType.includes(type)
        );
        
        if (!matches) {
            return {
                valid: false,
                error: '不支持的Content-Type'
            };
        }
        
        return { valid: true };
    }
    
    /**
     * 验证Origin
     */
    static validateOrigin(req, allowedOrigins) {
        const origin = req.headers['origin'];
        
        if (!origin) {
            return { valid: true }; // 同源请求可能没有Origin
        }
        
        if (!allowedOrigins.includes(origin) && !allowedOrigins.includes('*')) {
            return {
                valid: false,
                error: '不允许的Origin'
            };
        }
        
        return { valid: true };
    }
}

// 创建全局实例
const ddosProtection = new DDoSProtection({
    windowMs: 60000,
    maxRequests: 100,
    banDuration: 3600000
});

const connectionLimiter = new ConnectionLimiter(1000);
const slowlorisProtection = new SlowlorisProtection();
const trafficShaper = new TrafficShaper();

/**
 * DDoS防护中间件
 */
function ddosProtectionMiddleware(req, res, next) {
    const check = ddosProtection.check(req);
    
    if (!check.allowed) {
        return res.status(429).json({
            error: check.reason,
            retryAfter: check.retryAfter
        });
    }
    
    // 设置剩余请求数头部
    if (check.remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', check.remaining);
    }
    
    next();
}

/**
 * 连接限制中间件
 */
function connectionLimitMiddleware(req, res, next) {
    const check = connectionLimiter.check(req);
    
    if (!check.allowed) {
        return res.status(503).json({ error: check.reason });
    }
    
    connectionLimiter.add(req);
    
    res.on('finish', () => {
        connectionLimiter.remove(req);
    });
    
    next();
}

module.exports = {
    DDoSProtection,
    ConnectionLimiter,
    SlowlorisProtection,
    TrafficShaper,
    RequestValidator,
    ddosProtection,
    connectionLimiter,
    slowlorisProtection,
    trafficShaper,
    ddosProtectionMiddleware,
    connectionLimitMiddleware
};
