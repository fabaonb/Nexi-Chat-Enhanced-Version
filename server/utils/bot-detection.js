// 机器人检测模块
const crypto = require('crypto');

/**
 * 机器人检测器
 */
class BotDetector {
    constructor() {
        this.knownBots = this.loadBotSignatures();
        this.suspiciousIPs = new Map();
    }
    
    /**
     * 加载已知机器人签名
     */
    loadBotSignatures() {
        return {
            userAgents: [
                /bot/i, /crawler/i, /spider/i, /scraper/i,
                /curl/i, /wget/i, /python/i, /java/i,
                /go-http/i, /okhttp/i, /axios/i,
                /postman/i, /insomnia/i, /httpie/i
            ],
            headers: {
                missingAccept: (req) => !req.headers['accept'],
                missingAcceptLanguage: (req) => !req.headers['accept-language'],
                missingAcceptEncoding: (req) => !req.headers['accept-encoding'],
                suspiciousConnection: (req) => req.headers['connection'] === 'close'
            }
        };
    }
    
    /**
     * 检测是否为机器人
     */
    detect(req) {
        const score = this.calculateBotScore(req);
        const ip = this.getIP(req);
        
        // 记录可疑IP
        if (score > 5) {
            this.suspiciousIPs.set(ip, {
                score,
                lastSeen: Date.now()
            });
        }
        
        return {
            isBot: score > 7,
            score,
            confidence: Math.min(score / 10, 1)
        };
    }
    
    /**
     * 计算机器人分数
     */
    calculateBotScore(req) {
        let score = 0;
        const ua = req.headers['user-agent'] || '';
        
        // User-Agent检查
        if (!ua) {
            score += 5;
        } else {
            for (const pattern of this.knownBots.userAgents) {
                if (pattern.test(ua)) {
                    score += 3;
                    break;
                }
            }
        }
        
        // 头部检查
        for (const [name, check] of Object.entries(this.knownBots.headers)) {
            if (check(req)) {
                score += 1;
            }
        }
        
        // 请求模式检查
        if (this.checkRequestPattern(req)) {
            score += 2;
        }
        
        return score;
    }
    
    /**
     * 检查请求模式
     */
    checkRequestPattern(req) {
        const ip = this.getIP(req);
        const data = this.suspiciousIPs.get(ip);
        
        if (!data) return false;
        
        // 检查是否在短时间内多次被标记
        const timeSinceLastSeen = Date.now() - data.lastSeen;
        return timeSinceLastSeen < 60000 && data.score > 5;
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
 * 浏览器指纹验证
 */
class BrowserFingerprint {
    /**
     * 验证浏览器指纹
     */
    static verify(req) {
        const checks = {
            hasUserAgent: !!req.headers['user-agent'],
            hasAccept: !!req.headers['accept'],
            hasAcceptLanguage: !!req.headers['accept-language'],
            hasAcceptEncoding: !!req.headers['accept-encoding'],
            hasDNT: req.headers['dnt'] !== undefined,
            hasUpgradeInsecureRequests: req.headers['upgrade-insecure-requests'] !== undefined
        };
        
        const score = Object.values(checks).filter(Boolean).length;
        
        return {
            legitimate: score >= 4,
            score,
            checks
        };
    }
}

/**
 * 自动化工具检测
 */
class AutomationDetector {
    /**
     * 检测自动化工具
     */
    static detect(req) {
        const ua = req.headers['user-agent'] || '';
        
        const tools = {
            selenium: /selenium|webdriver/i.test(ua),
            puppeteer: /puppeteer|headless/i.test(ua),
            playwright: /playwright/i.test(ua),
            phantomjs: /phantom/i.test(ua),
            cypress: /cypress/i.test(ua)
        };
        
        const detected = Object.entries(tools)
            .filter(([_, value]) => value)
            .map(([key]) => key);
        
        return {
            automated: detected.length > 0,
            tools: detected
        };
    }
}

// 创建全局实例
const botDetector = new BotDetector();

/**
 * 机器人检测中间件
 */
function botDetectionMiddleware(req, res, next) {
    // 检测机器人
    const botCheck = botDetector.detect(req);
    
    if (botCheck.isBot) {
        // 不明确告知是机器人检测
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // 验证浏览器指纹
    const fingerprint = BrowserFingerprint.verify(req);
    if (!fingerprint.legitimate) {
        return res.status(400).json({ error: 'Invalid request' });
    }
    
    // 检测自动化工具
    const automation = AutomationDetector.detect(req);
    if (automation.automated) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    next();
}

module.exports = {
    BotDetector,
    BrowserFingerprint,
    AutomationDetector,
    botDetector,
    botDetectionMiddleware
};
