// Supabase 数据库安全防护模块
const validator = require('validator');

/**
 * Supabase RLS（行级安全）策略辅助函数
 */
class SupabaseSecurity {
    /**
     * 验证 Supabase 查询参数
     */
    static validateQueryParams(params) {
        const errors = [];
        
        // 检查是否包含危险的操作符
        const dangerousOperators = ['$', '_', 'or(', 'and(', 'not('];
        
        for (const [key, value] of Object.entries(params)) {
            // 检查键名
            if (dangerousOperators.some(op => key.includes(op))) {
                errors.push(`危险的查询键: ${key}`);
            }
            
            // 检查值
            if (typeof value === 'string') {
                // 检查 SQL 注入模式
                if (this.containsSQLInjection(value)) {
                    errors.push(`可疑的查询值: ${key}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 检测 SQL 注入模式
     */
    static containsSQLInjection(input) {
        const sqlPatterns = [
            /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/gi,
            /(--|\;|\/\*|\*\/)/g,
            /(\bUNION\b|\bEXEC\b|\bEXECUTE\b)/gi,
            /('|(\\')|(--)|(\#)|(%23)|(\/\*))/g
        ];
        
        return sqlPatterns.some(pattern => pattern.test(input));
    }
    
    /**
     * 清理 Supabase 查询参数
     */
    static sanitizeQueryParams(params) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(params)) {
            // 只保留安全的键
            if (!/^[a-zA-Z0-9_]+$/.test(key)) {
                continue;
            }
            
            // 清理值
            if (typeof value === 'string') {
                sanitized[key] = validator.escape(value);
            } else if (typeof value === 'number') {
                sanitized[key] = value;
            } else if (typeof value === 'boolean') {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * 验证 Supabase 过滤器
     */
    static validateFilter(filter) {
        // 允许的过滤操作符
        const allowedOperators = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'];
        
        if (typeof filter !== 'object') {
            return { valid: false, error: '过滤器必须是对象' };
        }
        
        for (const [key, value] of Object.entries(filter)) {
            // 检查操作符
            const parts = key.split('.');
            if (parts.length > 1) {
                const operator = parts[parts.length - 1];
                if (!allowedOperators.includes(operator)) {
                    return { valid: false, error: `不允许的操作符: ${operator}` };
                }
            }
        }
        
        return { valid: true };
    }
    
    /**
     * 限制查询结果数量
     */
    static limitQueryResults(limit, maxLimit = 1000) {
        const parsedLimit = parseInt(limit);
        
        if (isNaN(parsedLimit) || parsedLimit < 1) {
            return 100; // 默认限制
        }
        
        return Math.min(parsedLimit, maxLimit);
    }
    
    /**
     * 验证排序参数
     */
    static validateOrderBy(orderBy) {
        // 只允许字母、数字、下划线和点
        if (!/^[a-zA-Z0-9_.]+$/.test(orderBy)) {
            return { valid: false, error: '无效的排序字段' };
        }
        
        return { valid: true };
    }
    
    /**
     * 防止批量操作滥用
     */
    static validateBatchSize(items, maxSize = 100) {
        if (!Array.isArray(items)) {
            return { valid: false, error: '批量操作必须是数组' };
        }
        
        if (items.length > maxSize) {
            return { valid: false, error: `批量操作最多 ${maxSize} 条记录` };
        }
        
        return { valid: true };
    }
    
    /**
     * 验证 UUID 格式
     */
    static validateUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
    
    /**
     * 清理 JSON 数据
     */
    static sanitizeJSON(data) {
        if (typeof data !== 'object' || data === null) {
            return data;
        }
        
        const sanitized = Array.isArray(data) ? [] : {};
        
        for (const [key, value] of Object.entries(data)) {
            // 移除危险的键
            if (key.startsWith('$') || key.startsWith('_') || key.includes('__')) {
                continue;
            }
            
            // 递归清理
            if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeJSON(value);
            } else if (typeof value === 'string') {
                sanitized[key] = validator.escape(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    /**
     * 验证时间戳
     */
    static validateTimestamp(timestamp) {
        const date = new Date(timestamp);
        
        // 检查是否是有效日期
        if (isNaN(date.getTime())) {
            return { valid: false, error: '无效的时间戳' };
        }
        
        // 检查是否在合理范围内（不能是未来时间，不能太久远）
        const now = Date.now();
        const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
        const dateTime = date.getTime();
        
        if (dateTime > now) {
            return { valid: false, error: '时间戳不能是未来时间' };
        }
        
        if (dateTime < oneYearAgo) {
            return { valid: false, error: '时间戳过于久远' };
        }
        
        return { valid: true };
    }
}

/**
 * Supabase 连接池管理
 */
class SupabaseConnectionManager {
    constructor() {
        this.activeConnections = new Map();
        this.maxConnectionsPerUser = 5;
    }
    
    /**
     * 检查用户连接数
     */
    checkConnectionLimit(userId) {
        const userConnections = this.activeConnections.get(userId) || 0;
        
        if (userConnections >= this.maxConnectionsPerUser) {
            return {
                allowed: false,
                error: '连接数超过限制'
            };
        }
        
        return { allowed: true };
    }
    
    /**
     * 添加连接
     */
    addConnection(userId) {
        const current = this.activeConnections.get(userId) || 0;
        this.activeConnections.set(userId, current + 1);
    }
    
    /**
     * 移除连接
     */
    removeConnection(userId) {
        const current = this.activeConnections.get(userId) || 0;
        if (current > 0) {
            this.activeConnections.set(userId, current - 1);
        }
    }
    
    /**
     * 清理空闲连接
     */
    cleanup() {
        for (const [userId, count] of this.activeConnections.entries()) {
            if (count === 0) {
                this.activeConnections.delete(userId);
            }
        }
    }
}

/**
 * Supabase 查询审计
 */
class SupabaseQueryAuditor {
    constructor() {
        this.queryLog = [];
        this.maxLogSize = 1000;
    }
    
    /**
     * 记录查询
     */
    logQuery(userId, query, params) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            userId,
            query,
            params,
            ip: null // 在中间件中设置
        };
        
        this.queryLog.push(logEntry);
        
        // 限制日志大小
        if (this.queryLog.length > this.maxLogSize) {
            this.queryLog.shift();
        }
        
        // 检测可疑模式
        this.detectSuspiciousPattern(userId);
    }
    
    /**
     * 检测可疑查询模式
     */
    detectSuspiciousPattern(userId) {
        const recentQueries = this.queryLog
            .filter(log => log.userId === userId)
            .slice(-10);
        
        // 检测短时间内大量查询
        if (recentQueries.length >= 10) {
            const timeSpan = new Date(recentQueries[recentQueries.length - 1].timestamp) - 
                           new Date(recentQueries[0].timestamp);
            
            if (timeSpan < 1000) { // 1 秒内 10 次查询
                console.warn(`可疑查询模式检测: 用户 ${userId} 在短时间内执行大量查询`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * 获取用户查询历史
     */
    getUserQueryHistory(userId, limit = 10) {
        return this.queryLog
            .filter(log => log.userId === userId)
            .slice(-limit);
    }
}

/**
 * Supabase 数据验证中间件
 */
function supabaseValidationMiddleware(req, res, next) {
    // 验证查询参数
    if (req.query && Object.keys(req.query).length > 0) {
        const validation = SupabaseSecurity.validateQueryParams(req.query);
        if (!validation.valid) {
            return res.status(400).json({
                error: '无效的查询参数',
                details: validation.errors
            });
        }
    }
    
    // 清理请求体
    if (req.body && typeof req.body === 'object') {
        req.body = SupabaseSecurity.sanitizeJSON(req.body);
    }
    
    next();
}

/**
 * Supabase 连接限制中间件
 */
const connectionManager = new SupabaseConnectionManager();

function supabaseConnectionLimitMiddleware(req, res, next) {
    const userId = req.userId || req.user?.id;
    
    if (userId) {
        const check = connectionManager.checkConnectionLimit(userId);
        if (!check.allowed) {
            return res.status(429).json({ error: check.error });
        }
        
        connectionManager.addConnection(userId);
        
        // 请求结束时移除连接
        res.on('finish', () => {
            connectionManager.removeConnection(userId);
        });
    }
    
    next();
}

// 定期清理连接
setInterval(() => {
    connectionManager.cleanup();
}, 60000); // 每分钟清理一次

/**
 * Supabase 查询审计中间件
 */
const queryAuditor = new SupabaseQueryAuditor();

function supabaseAuditMiddleware(req, res, next) {
    const userId = req.userId || req.user?.id;
    
    if (userId && req.method !== 'GET') {
        queryAuditor.logQuery(userId, req.path, req.body);
    }
    
    next();
}

module.exports = {
    SupabaseSecurity,
    SupabaseConnectionManager,
    SupabaseQueryAuditor,
    supabaseValidationMiddleware,
    supabaseConnectionLimitMiddleware,
    supabaseAuditMiddleware,
    connectionManager,
    queryAuditor
};
