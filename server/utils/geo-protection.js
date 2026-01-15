// 地理位置防护模块
const crypto = require('crypto');

/**
 * 地理位置分析器
 */
class GeoAnalyzer {
    constructor() {
        this.suspiciousCountries = new Set();
        this.vpnRanges = this.loadVPNRanges();
        this.accessPatterns = new Map();
    }
    
    /**
     * 加载VPN/代理IP范围
     */
    loadVPNRanges() {
        // 常见VPN/代理服务的IP范围特征
        return {
            // 检测特征而非具体IP
            patterns: [
                /^10\./,  // 私有网络
                /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 私有网络
                /^192\.168\./,  // 私有网络
            ]
        };
    }
    
    /**
     * 分析地理位置
     */
    analyze(req) {
        const geo = this.extractGeo(req);
        const ip = this.getIP(req);
        
        // 记录访问模式
        this.recordAccess(ip, geo);
        
        // 检测异常
        const anomalies = this.detectAnomalies(ip, geo);
        
        return {
            geo,
            suspicious: anomalies.length > 0,
            anomalies
        };
    }
    
    /**
     * 提取地理信息
     */
    extractGeo(req) {
        return {
            country: req.headers['x-vercel-ip-country'] || 
                    req.headers['cf-ipcountry'] || 
                    'unknown',
            region: req.headers['x-vercel-ip-country-region'] || 'unknown',
            city: req.headers['x-vercel-ip-city'] || 'unknown',
            timezone: req.headers['x-vercel-ip-timezone'] || 'unknown'
        };
    }
    
    /**
     * 记录访问
     */
    recordAccess(ip, geo) {
        if (!this.accessPatterns.has(ip)) {
            this.accessPatterns.set(ip, {
                locations: [],
                firstSeen: Date.now()
            });
        }
        
        const pattern = this.accessPatterns.get(ip);
        pattern.locations.push({
            ...geo,
            timestamp: Date.now()
        });
        
        // 只保留最近10个位置
        if (pattern.locations.length > 10) {
            pattern.locations = pattern.locations.slice(-10);
        }
    }
    
    /**
     * 检测异常
     */
    detectAnomalies(ip, geo) {
        const anomalies = [];
        const pattern = this.accessPatterns.get(ip);
        
        if (!pattern || pattern.locations.length < 2) {
            return anomalies;
        }
        
        // 检测地理位置跳跃
        const recentLocations = pattern.locations.slice(-5);
        const uniqueCountries = new Set(recentLocations.map(l => l.country));
        
        if (uniqueCountries.size > 3) {
            anomalies.push('location_hopping');
        }
        
        // 检测不可能的旅行
        const lastTwo = recentLocations.slice(-2);
        if (lastTwo.length === 2) {
            const timeDiff = lastTwo[1].timestamp - lastTwo[0].timestamp;
            if (timeDiff < 3600000 && lastTwo[0].country !== lastTwo[1].country) {
                // 1小时内跨国
                anomalies.push('impossible_travel');
            }
        }
        
        return anomalies;
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
 * VPN/代理检测器
 */
class ProxyDetector {
    /**
     * 检测VPN/代理
     */
    static detect(req) {
        const indicators = {
            // 检查代理相关头部
            hasProxyHeaders: this.checkProxyHeaders(req),
            
            // 检查X-Forwarded-For链
            suspiciousForwarding: this.checkForwardingChain(req),
            
            // 检查端口
            suspiciousPort: this.checkPort(req)
        };
        
        const score = Object.values(indicators).filter(Boolean).length;
        
        return {
            isProxy: score >= 2,
            score,
            indicators
        };
    }
    
    /**
     * 检查代理头部
     */
    static checkProxyHeaders(req) {
        const proxyHeaders = [
            'via',
            'x-forwarded-for',
            'x-forwarded-host',
            'x-forwarded-proto',
            'forwarded',
            'x-real-ip',
            'x-proxy-id',
            'x-proxy-connection'
        ];
        
        let count = 0;
        for (const header of proxyHeaders) {
            if (req.headers[header]) count++;
        }
        
        return count > 3;
    }
    
    /**
     * 检查转发链
     */
    static checkForwardingChain(req) {
        const xff = req.headers['x-forwarded-for'];
        if (!xff) return false;
        
        const ips = xff.split(',').map(ip => ip.trim());
        
        // 转发链过长可疑
        return ips.length > 3;
    }
    
    /**
     * 检查端口
     */
    static checkPort(req) {
        const port = req.connection?.remotePort;
        if (!port) return false;
        
        // 常见代理端口
        const proxyPorts = [8080, 3128, 8888, 1080, 9050];
        return proxyPorts.includes(port);
    }
}

/**
 * 时区验证器
 */
class TimezoneValidator {
    /**
     * 验证时区一致性
     */
    static validate(req, clientTimezone) {
        const serverTimezone = req.headers['x-vercel-ip-timezone'];
        
        if (!serverTimezone || !clientTimezone) {
            return { valid: true }; // 无法验证
        }
        
        // 检查时区是否匹配
        const match = serverTimezone === clientTimezone;
        
        return {
            valid: match,
            serverTimezone,
            clientTimezone,
            mismatch: !match
        };
    }
}

// 创建全局实例
const geoAnalyzer = new GeoAnalyzer();

/**
 * 地理位置防护中间件
 */
function geoProtectionMiddleware(req, res, next) {
    // 地理位置分析
    const analysis = geoAnalyzer.analyze(req);
    
    if (analysis.suspicious) {
        // 不明确说明原因
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // VPN/代理检测
    const proxyCheck = ProxyDetector.detect(req);
    
    if (proxyCheck.isProxy && proxyCheck.score >= 3) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
}

module.exports = {
    GeoAnalyzer,
    ProxyDetector,
    TimezoneValidator,
    geoAnalyzer,
    geoProtectionMiddleware
};
