// 安全配置验证和管理模块
const crypto = require('crypto');

/**
 * 安全配置验证器
 */
class SecurityConfigValidator {
    /**
     * 验证所有安全配置
     */
    static validateAll() {
        const results = {
            valid: true,
            warnings: [],
            errors: [],
            recommendations: []
        };
        
        // 验证 JWT 密钥
        this.validateJWTSecret(results);
        
        // 验证管理员密码
        this.validateAdminPassword(results);
        
        // 验证 CORS 配置
        this.validateCORS(results);
        
        // 验证数据库配置
        this.validateDatabase(results);
        
        // 验证 Pusher 配置
        this.validatePusher(results);
        
        // 验证环境变量
        this.validateEnvironment(results);
        
        return results;
    }
    
    /**
     * 验证 JWT 密钥强度
     */
    static validateJWTSecret(results) {
        const secret = process.env.JWT_SECRET;
        
        if (!secret) {
            results.errors.push('JWT_SECRET 未设置');
            results.valid = false;
            return;
        }
        
        // 检查是否使用默认值
        const defaultSecrets = [
            'your-secret-key-change-in-production',
            'secret',
            'jwt-secret',
            '123456'
        ];
        
        if (defaultSecrets.includes(secret)) {
            results.errors.push('JWT_SECRET 使用默认值，必须修改');
            results.valid = false;
            return;
        }
        
        // 检查长度
        if (secret.length < 32) {
            results.warnings.push('JWT_SECRET 长度建议至少 32 个字符');
        }
        
        // 检查复杂度
        const hasUpperCase = /[A-Z]/.test(secret);
        const hasLowerCase = /[a-z]/.test(secret);
        const hasNumbers = /[0-9]/.test(secret);
        const hasSpecial = /[^A-Za-z0-9]/.test(secret);
        
        const complexity = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecial].filter(Boolean).length;
        
        if (complexity < 3) {
            results.warnings.push('JWT_SECRET 复杂度不足，建议包含大小写字母、数字和特殊字符');
        }
    }
    
    /**
     * 验证管理员密码
     */
    static validateAdminPassword(results) {
        const password = process.env.ADMIN_PASSWORD;
        
        if (!password) {
            results.errors.push('ADMIN_PASSWORD 未设置');
            results.valid = false;
            return;
        }
        
        // 检查默认密码
        const defaultPasswords = [
            'admin123',
            'admin',
            'password',
            '123456',
            'admin@123'
        ];
        
        if (defaultPasswords.includes(password)) {
            results.errors.push('ADMIN_PASSWORD 使用默认值，必须修改');
            results.valid = false;
            return;
        }
        
        // 检查密码强度
        if (password.length < 8) {
            results.warnings.push('ADMIN_PASSWORD 长度建议至少 8 个字符');
        }
        
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);
        
        const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecial].filter(Boolean).length;
        
        if (strength < 3) {
            results.warnings.push('ADMIN_PASSWORD 强度不足，建议包含大小写字母、数字和特殊字符');
        }
    }
    
    /**
     * 验证 CORS 配置
     */
    static validateCORS(results) {
        const origins = process.env.CORS_ORIGINS;
        
        if (!origins) {
            results.warnings.push('CORS_ORIGINS 未设置，将使用默认配置');
            return;
        }
        
        // 检查是否允许所有来源
        if (origins.includes('*')) {
            results.warnings.push('CORS_ORIGINS 允许所有来源，生产环境建议限制');
        }
        
        // 检查是否包含 localhost（生产环境）
        if (process.env.NODE_ENV === 'production' && origins.includes('localhost')) {
            results.warnings.push('生产环境 CORS_ORIGINS 包含 localhost');
        }
    }
    
    /**
     * 验证数据库配置
     */
    static validateDatabase(results) {
        const dbType = process.env.DB_TYPE;
        
        if (!dbType) {
            results.warnings.push('DB_TYPE 未设置，将使用默认值');
            return;
        }
        
        if (dbType === 'supabase') {
            // 验证 Supabase 配置
            if (!process.env.SUPABASE_URL) {
                results.errors.push('SUPABASE_URL 未设置');
                results.valid = false;
            }
            
            if (!process.env.SUPABASE_ANON_KEY) {
                results.errors.push('SUPABASE_ANON_KEY 未设置');
                results.valid = false;
            }
            
            if (!process.env.SUPABASE_SERVICE_KEY) {
                results.warnings.push('SUPABASE_SERVICE_KEY 未设置，某些功能可能受限');
            }
        }
    }
    
    /**
     * 验证 Pusher 配置
     */
    static validatePusher(results) {
        const required = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'];
        
        for (const key of required) {
            if (!process.env[key]) {
                results.errors.push(`${key} 未设置`);
                results.valid = false;
            }
        }
        
        // 检查是否使用默认值
        if (process.env.PUSHER_KEY === 'your-pusher-key') {
            results.errors.push('PUSHER_KEY 使用默认值，必须修改');
            results.valid = false;
        }
    }
    
    /**
     * 验证环境变量
     */
    static validateEnvironment(results) {
        const nodeEnv = process.env.NODE_ENV;
        
        if (!nodeEnv) {
            results.warnings.push('NODE_ENV 未设置');
            return;
        }
        
        // 生产环境检查
        if (nodeEnv === 'production') {
            // 检查调试模式
            if (process.env.DEBUG === 'true') {
                results.warnings.push('生产环境启用了调试模式');
            }
            
            // 检查详细错误
            if (process.env.SHOW_ERROR_DETAILS === 'true') {
                results.warnings.push('生产环境显示详细错误信息');
            }
        }
    }
    
    /**
     * 生成安全报告
     */
    static generateReport() {
        const validation = this.validateAll();
        
        console.log('\n========== 安全配置检查报告 ==========\n');
        
        if (validation.valid && validation.warnings.length === 0) {
            console.log('✅ 所有安全配置检查通过\n');
        } else {
            if (validation.errors.length > 0) {
                console.log('❌ 错误:');
                validation.errors.forEach(error => console.log(`  - ${error}`));
                console.log('');
            }
            
            if (validation.warnings.length > 0) {
                console.log('⚠️  警告:');
                validation.warnings.forEach(warning => console.log(`  - ${warning}`));
                console.log('');
            }
        }
        
        if (validation.recommendations.length > 0) {
            console.log('💡 建议:');
            validation.recommendations.forEach(rec => console.log(`  - ${rec}`));
            console.log('');
        }
        
        console.log('======================================\n');
        
        return validation;
    }
}

/**
 * 生成安全密钥
 */
class KeyGenerator {
    /**
     * 生成强随机密钥
     */
    static generateSecureKey(length = 64) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * 生成 JWT 密钥
     */
    static generateJWTSecret() {
        return this.generateSecureKey(64);
    }
    
    /**
     * 生成强密码
     */
    static generateStrongPassword(length = 16) {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        const all = uppercase + lowercase + numbers + special;
        let password = '';
        
        // 确保包含每种字符
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        // 填充剩余长度
        for (let i = password.length; i < length; i++) {
            password += all[Math.floor(Math.random() * all.length)];
        }
        
        // 打乱顺序
        return password.split('').sort(() => Math.random() - 0.5).join('');
    }
    
    /**
     * 生成完整的环境变量配置
     */
    static generateEnvConfig() {
        console.log('\n========== 生成安全配置 ==========\n');
        console.log('# 将以下配置添加到 .env 文件中\n');
        console.log(`JWT_SECRET=${this.generateJWTSecret()}`);
        console.log(`ADMIN_PASSWORD=${this.generateStrongPassword()}`);
        console.log(`CHANNEL105_PASSWORD=${this.generateStrongPassword()}`);
        console.log('\n====================================\n');
    }
}

/**
 * 安全配置助手
 */
class SecurityConfigHelper {
    /**
     * 检查并提示配置问题
     */
    static checkAndWarn() {
        const validation = SecurityConfigValidator.validateAll();
        
        if (!validation.valid) {
            console.error('\n⚠️  检测到安全配置问题，请立即修复！\n');
            
            if (validation.errors.length > 0) {
                console.error('错误:');
                validation.errors.forEach(error => console.error(`  - ${error}`));
            }
            
            console.error('\n运行以下命令生成安全配置:');
            console.error('  node -e "require(\'./server/utils/security-config\').KeyGenerator.generateEnvConfig()"\n');
            
            // 生产环境下，配置错误应该阻止启动
            if (process.env.NODE_ENV === 'production') {
                console.error('❌ 生产环境配置错误，服务器拒绝启动\n');
                process.exit(1);
            }
        }
        
        return validation;
    }
    
    /**
     * 获取安全建议
     */
    static getSecurityRecommendations() {
        return [
            '定期轮换密钥和密码（建议每 90 天）',
            '启用双因素认证（如果支持）',
            '定期审查访问日志',
            '保持依赖包更新',
            '定期备份数据',
            '监控异常活动',
            '限制管理员账户数量',
            '使用强密码策略',
            '启用 HTTPS',
            '配置防火墙规则'
        ];
    }
}

module.exports = {
    SecurityConfigValidator,
    KeyGenerator,
    SecurityConfigHelper
};
