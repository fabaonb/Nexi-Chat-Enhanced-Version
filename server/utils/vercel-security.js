// Vercel 部署环境安全防护模块

/**
 * Vercel Edge 函数安全配置
 */
class VercelSecurity {
    /**
     * 验证 Vercel 环境变量
     */
    static validateEnvironment() {
        const requiredEnvVars = [
            'PUSHER_APP_ID',
            'PUSHER_KEY',
            'PUSHER_SECRET',
            'JWT_SECRET',
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY'
        ];
        
        const missing = [];
        
        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                missing.push(envVar);
            }
        }
        
        if (missing.length > 0) {
            console.error('缺少必需的环境变量:', missing);
            return {
                valid: false,
                missing
            };
        }
        
        return { valid: true };
    }
    
    /**
     * 验证 Vercel 请求来源
     */
    static validateVercelRequest(req) {
        // 检查 Vercel 特定的头
        const vercelHeaders = [
            'x-vercel-id',
            'x-vercel-deployment-url'
        ];
        
        // 在 Vercel 环境中，这些头应该存在
        if (process.env.VERCEL === '1') {
            const hasVercelHeaders = vercelHeaders.some(header => req.headers[header]);
            
            if (!hasVercelHeaders) {
                console.warn('可疑请求：缺少 Vercel 头');
                return { valid: false, reason: '缺少 Vercel 头' };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * 获取真实 IP 地址（考虑 Vercel 代理）
     */
    static getRealIP(req) {
        // Vercel 使用这些头传递真实 IP
        return req.headers['x-real-ip'] || 
               req.headers['x-forwarded-for']?.split(',')[0] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress;
    }
    
    /**
     * 验证地理位置（Vercel Edge 提供）
     */
    static validateGeoLocation(req) {
        const geo = {
            country: req.headers['x-vercel-ip-country'],
            region: req.headers['x-vercel-ip-country-region'],
            city: req.headers['x-vercel-ip-city']
        };
        
        // 可以根据地理位置实施访问控制
        // 例如：阻止某些国家/地区的访问
        const blockedCountries = process.env.BLOCKED_COUNTRIES?.split(',') || [];
        
        if (geo.country && blockedCountries.includes(geo.country)) {
            return {
                allowed: false,
                reason: `来自 ${geo.country} 的访问被阻止`
            };
        }
        
        return { allowed: true, geo };
    }
    
    /**
     * Vercel 函数超时保护
     */
    static createTimeoutWrapper(handler, timeout = 10000) {
        return async (req, res) => {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('请求超时')), timeout);
            });
            
            try {
                await Promise.race([
                    handler(req, res),
                    timeoutPromise
                ]);
            } catch (error) {
                if (error.message === '请求超时') {
                    res.status(504).json({ error: '请求处理超时' });
                } else {
                    throw error;
                }
            }
        };
    }
    
    /**
     * Vercel 边缘缓存控制
     */
    static setCacheHeaders(res, options = {}) {
        const {
            maxAge = 0,
            sMaxAge = 0,
            staleWhileRevalidate = 0,
            public: isPublic = false
        } = options;
        
        const cacheControl = [];
        
        if (isPublic) {
            cacheControl.push('public');
        } else {
            cacheControl.push('private');
        }
        
        if (maxAge > 0) {
            cacheControl.push(`max-age=${maxAge}`);
        }
        
        if (sMaxAge > 0) {
            cacheControl.push(`s-maxage=${sMaxAge}`);
        }
        
        if (staleWhileRevalidate > 0) {
            cacheControl.push(`stale-while-revalidate=${staleWhileRevalidate}`);
        }
        
        res.setHeader('Cache-Control', cacheControl.join(', '));
    }
    
    /**
     * 防止 Vercel 函数冷启动攻击
     */
    static warmupProtection(req, res, next) {
        // 检测是否是预热请求
        if (req.headers['x-vercel-warmup'] === 'true') {
            return res.status(200).json({ status: 'warm' });
        }
        
        next();
    }
}

/**
 * Vercel 环境检测
 */
function isVercelEnvironment() {
    return process.env.VERCEL === '1' || 
           process.env.VERCEL_ENV !== undefined;
}

/**
 * Vercel 部署环境类型
 */
function getVercelEnvironment() {
    return process.env.VERCEL_ENV || 'development';
}

/**
 * Vercel 区域检测
 */
function getVercelRegion() {
    return process.env.VERCEL_REGION || 'unknown';
}

/**
 * Vercel 请求验证中间件
 */
function vercelRequestValidation(req, res, next) {
    // 只在 Vercel 环境中验证
    if (!isVercelEnvironment()) {
        return next();
    }
    
    // 验证请求来源
    const validation = VercelSecurity.validateVercelRequest(req);
    if (!validation.valid) {
        console.warn('Vercel 请求验证失败:', validation.reason);
        // 不阻止请求，只记录警告
    }
    
    // 获取真实 IP
    req.realIP = VercelSecurity.getRealIP(req);
    
    // 验证地理位置
    const geoValidation = VercelSecurity.validateGeoLocation(req);
    if (!geoValidation.allowed) {
        return res.status(403).json({ error: geoValidation.reason });
    }
    
    req.geo = geoValidation.geo;
    
    next();
}

/**
 * Vercel 边缘函数优化中间件
 */
function vercelEdgeOptimization(req, res, next) {
    // 设置 Vercel 特定的响应头
    res.setHeader('X-Powered-By', 'Vercel');
    
    // 对于静态资源，设置缓存
    if (req.path.match(/\.(jpg|jpeg|png|gif|css|js|ico|svg|woff|woff2|ttf)$/)) {
        VercelSecurity.setCacheHeaders(res, {
            maxAge: 31536000, // 1 年
            public: true
        });
    }
    
    next();
}

/**
 * Vercel 无服务器函数内存监控
 */
class VercelMemoryMonitor {
    constructor() {
        this.threshold = 0.9; // 90% 内存使用率
    }
    
    checkMemoryUsage() {
        if (typeof process.memoryUsage !== 'function') {
            return { ok: true };
        }
        
        const usage = process.memoryUsage();
        const heapUsedPercent = usage.heapUsed / usage.heapTotal;
        
        if (heapUsedPercent > this.threshold) {
            console.warn('内存使用率过高:', {
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
                percent: Math.round(heapUsedPercent * 100) + '%'
            });
            
            return {
                ok: false,
                usage: heapUsedPercent
            };
        }
        
        return { ok: true };
    }
    
    middleware() {
        return (req, res, next) => {
            const check = this.checkMemoryUsage();
            
            if (!check.ok) {
                // 内存不足时拒绝新请求
                return res.status(503).json({
                    error: '服务暂时不可用，请稍后重试'
                });
            }
            
            next();
        };
    }
}

/**
 * Vercel 日志优化
 */
class VercelLogger {
    static log(level, message, meta = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            environment: getVercelEnvironment(),
            region: getVercelRegion(),
            ...meta
        };
        
        // Vercel 会自动收集 stdout/stderr
        console.log(JSON.stringify(logEntry));
    }
    
    static info(message, meta) {
        this.log('info', message, meta);
    }
    
    static warn(message, meta) {
        this.log('warn', message, meta);
    }
    
    static error(message, meta) {
        this.log('error', message, meta);
    }
    
    static security(message, meta) {
        this.log('security', message, meta);
    }
}

/**
 * Vercel 环境变量加密存储建议
 */
function getSecureEnvVar(key) {
    const value = process.env[key];
    
    if (!value) {
        VercelLogger.warn(`环境变量 ${key} 未设置`);
        return null;
    }
    
    // 在 Vercel 中，环境变量已经加密存储
    // 这里只是获取和验证
    return value;
}

/**
 * Vercel 部署钩子
 */
function onVercelDeploy() {
    // 验证环境变量
    const envValidation = VercelSecurity.validateEnvironment();
    if (!envValidation.valid) {
        VercelLogger.error('环境变量验证失败', {
            missing: envValidation.missing
        });
    }
    
    // 记录部署信息
    VercelLogger.info('应用已部署', {
        environment: getVercelEnvironment(),
        region: getVercelRegion(),
        nodeVersion: process.version
    });
}

// 如果在 Vercel 环境中，执行部署钩子
if (isVercelEnvironment()) {
    onVercelDeploy();
}

module.exports = {
    VercelSecurity,
    VercelMemoryMonitor,
    VercelLogger,
    isVercelEnvironment,
    getVercelEnvironment,
    getVercelRegion,
    vercelRequestValidation,
    vercelEdgeOptimization,
    getSecureEnvVar
};
