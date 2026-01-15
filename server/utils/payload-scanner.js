// 载荷扫描器 - 深度检测恶意载荷
const crypto = require('crypto');

/**
 * 恶意载荷检测器
 */
class PayloadScanner {
    constructor() {
        this.signatures = this.loadSignatures();
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5分钟缓存
    }
    
    /**
     * 加载攻击签名库
     */
    loadSignatures() {
        return {
            // XSS变种
            xss: [
                /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<iframe/gi,
                /eval\s*\(/gi,
                /expression\s*\(/gi,
                /vbscript:/gi,
                /data:text\/html/gi,
                /<embed/gi,
                /<object/gi
            ],
            
            // SQL注入变种
            sql: [
                /(\bUNION\b.*\bSELECT\b)/gi,
                /(\bSELECT\b.*\bFROM\b.*\bWHERE\b)/gi,
                /(;\s*DROP\s+TABLE)/gi,
                /(;\s*DELETE\s+FROM)/gi,
                /(\bEXEC\b|\bEXECUTE\b)\s*\(/gi,
                /(\bINSERT\b.*\bINTO\b.*\bVALUES\b)/gi,
                /(0x[0-9a-f]+)/gi,
                /(\bOR\b\s+1\s*=\s*1)/gi,
                /(\bAND\b\s+1\s*=\s*1)/gi
            ],
            
            // NoSQL注入
            nosql: [
                /\$where/gi,
                /\$ne/gi,
                /\$gt/gi,
                /\$regex/gi,
                /\{\s*\$.*\}/g
            ],
            
            // 命令注入
            command: [
                /[;&|`]\s*(ls|cat|wget|curl|nc|bash|sh|cmd|powershell)/gi,
                /\$\(.*\)/g,
                /`.*`/g,
                /\|\s*\w+/g
            ],
            
            // LDAP注入
            ldap: [
                /\(\|/g,
                /\(&/g,
                /\(!/g,
                /\*\)/g
            ],
            
            // XML注入
            xml: [
                /<!ENTITY/gi,
                /<!DOCTYPE/gi,
                /<!\[CDATA\[/gi,
                /&\w+;/g
            ],
            
            // 路径遍历
            traversal: [
                /\.\.[\/\\]/g,
                /%2e%2e[\/\\]/gi,
                /\.\.%2f/gi,
                /\.\.%5c/gi
            ],
            
            // SSRF
            ssrf: [
                /file:\/\//gi,
                /gopher:\/\//gi,
                /dict:\/\//gi,
                /localhost/gi,
                /127\.0\.0\.1/g,
                /0\.0\.0\.0/g,
                /169\.254\./g
            ]
        };
    }
    
    /**
     * 扫描载荷
     */
    scan(input, type = 'all') {
        if (!input) return { malicious: false };
        
        // 检查缓存
        const cacheKey = this.getCacheKey(input);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.cacheTimeout) {
                return cached.result;
            }
        }
        
        const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
        const findings = [];
        
        // 选择要检查的签名类型
        const typesToCheck = type === 'all' 
            ? Object.keys(this.signatures)
            : [type];
        
        for (const sigType of typesToCheck) {
            const patterns = this.signatures[sigType];
            if (!patterns) continue;
            
            for (const pattern of patterns) {
                if (pattern.test(inputStr)) {
                    findings.push({
                        type: sigType,
                        pattern: pattern.toString()
                    });
                }
            }
        }
        
        const result = {
            malicious: findings.length > 0,
            findings,
            confidence: this.calculateConfidence(findings)
        };
        
        // 缓存结果
        this.cache.set(cacheKey, {
            result,
            time: Date.now()
        });
        
        return result;
    }
    
    /**
     * 计算置信度
     */
    calculateConfidence(findings) {
        if (findings.length === 0) return 0;
        if (findings.length >= 3) return 1.0;
        return findings.length * 0.4;
    }
    
    /**
     * 生成缓存键
     */
    getCacheKey(input) {
        const str = typeof input === 'string' ? input : JSON.stringify(input);
        return crypto.createHash('md5').update(str).digest('hex');
    }
    
    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
    }
}

/**
 * 编码检测器
 */
class EncodingDetector {
    /**
     * 检测多重编码
     */
    static detect(input) {
        if (typeof input !== 'string') return { encoded: false };
        
        const encodings = [];
        
        // URL编码
        if (/%[0-9a-f]{2}/i.test(input)) {
            encodings.push('url');
        }
        
        // HTML实体编码
        if (/&#?\w+;/.test(input)) {
            encodings.push('html');
        }
        
        // Base64
        if (/^[A-Za-z0-9+/]+=*$/.test(input) && input.length % 4 === 0) {
            encodings.push('base64');
        }
        
        // Unicode编码
        if (/\\u[0-9a-f]{4}/i.test(input)) {
            encodings.push('unicode');
        }
        
        // 十六进制
        if (/0x[0-9a-f]+/i.test(input)) {
            encodings.push('hex');
        }
        
        return {
            encoded: encodings.length > 0,
            encodings,
            suspicious: encodings.length > 2 // 多重编码可疑
        };
    }
    
    /**
     * 尝试解码
     */
    static decode(input) {
        let decoded = input;
        let iterations = 0;
        const maxIterations = 5;
        
        while (iterations < maxIterations) {
            const before = decoded;
            
            // URL解码
            try {
                decoded = decodeURIComponent(decoded);
            } catch (e) {}
            
            // HTML解码
            decoded = decoded.replace(/&#(\d+);/g, (match, dec) => 
                String.fromCharCode(dec)
            );
            decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => 
                String.fromCharCode(parseInt(hex, 16))
            );
            
            if (decoded === before) break;
            iterations++;
        }
        
        return {
            decoded,
            iterations,
            suspicious: iterations > 2
        };
    }
}

/**
 * 模糊测试检测器
 */
class FuzzDetector {
    /**
     * 检测模糊测试模式
     */
    static detect(input) {
        if (typeof input !== 'string') return { fuzzing: false };
        
        const patterns = {
            // 长字符串
            longString: input.length > 10000,
            
            // 重复字符
            repeating: /(.)\1{50,}/.test(input),
            
            // 格式字符串
            formatString: /%[sdxnp]/g.test(input),
            
            // 边界值
            boundary: /2147483647|4294967295|9223372036854775807/.test(input),
            
            // 特殊字符密集
            specialChars: (input.match(/[^a-zA-Z0-9\s]/g) || []).length > input.length * 0.5
        };
        
        const detected = Object.entries(patterns)
            .filter(([_, value]) => value)
            .map(([key]) => key);
        
        return {
            fuzzing: detected.length > 0,
            patterns: detected
        };
    }
}

/**
 * 载荷清理器
 */
class PayloadSanitizer {
    /**
     * 清理恶意载荷
     */
    static sanitize(input) {
        if (typeof input !== 'string') return input;
        
        let cleaned = input;
        
        // 移除脚本标签
        cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // 移除事件处理器
        cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
        cleaned = cleaned.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
        
        // 移除危险协议
        cleaned = cleaned.replace(/javascript:/gi, '');
        cleaned = cleaned.replace(/vbscript:/gi, '');
        cleaned = cleaned.replace(/data:text\/html/gi, '');
        
        // 移除SQL关键字
        cleaned = cleaned.replace(/(\bUNION\b|\bSELECT\b|\bDROP\b|\bDELETE\b)/gi, '');
        
        return cleaned;
    }
}

// 创建全局实例
const payloadScanner = new PayloadScanner();

/**
 * 载荷扫描中间件
 */
function payloadScanMiddleware(req, res, next) {
    // 扫描所有输入
    const inputs = [
        ...Object.values(req.query || {}),
        ...Object.values(req.body || {}),
        ...Object.values(req.params || {})
    ];
    
    for (const input of inputs) {
        // 扫描载荷
        const scanResult = payloadScanner.scan(input);
        
        if (scanResult.malicious && scanResult.confidence > 0.6) {
            // 不暴露检测到的具体内容
            return res.status(400).json({ error: 'Invalid input' });
        }
        
        // 检测编码
        const encoding = EncodingDetector.detect(input);
        if (encoding.suspicious) {
            return res.status(400).json({ error: 'Invalid input' });
        }
        
        // 检测模糊测试
        const fuzzing = FuzzDetector.detect(input);
        if (fuzzing.fuzzing) {
            return res.status(400).json({ error: 'Invalid input' });
        }
    }
    
    next();
}

module.exports = {
    PayloadScanner,
    EncodingDetector,
    FuzzDetector,
    PayloadSanitizer,
    payloadScanner,
    payloadScanMiddleware
};
