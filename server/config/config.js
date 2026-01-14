/**
 * 服务器配置文件
 * 所有敏感信息必须通过环境变量配置
 */

// 加载环境变量
require('dotenv').config();

// 验证必需的环境变量
const requiredEnvVars = ['JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('❌ 缺少必需的环境变量:', missingEnvVars.join(', '));
    console.error('请在 .env 文件中配置这些变量');
    process.exit(1);
}

module.exports = {
    // 服务器端口
    PORT: process.env.PORT || 3000,
    FRONTEND_PORT: process.env.FRONTEND_PORT || 3001,
    
    // JWT 密钥（生产环境必须通过环境变量配置）
    JWT_SECRET: process.env.JWT_SECRET || (() => {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET 必须在生产环境中配置');
        }
        return 'dev-secret-key-change-in-production';
    })(),
    
    // 管理员凭证（生产环境必须通过环境变量配置）
    ADMIN_CREDENTIALS: {
        username: process.env.ADMIN_USERNAME || (() => {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('ADMIN_USERNAME 必须在生产环境中配置');
            }
            return 'admin';
        })(),
        password: process.env.ADMIN_PASSWORD || (() => {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('ADMIN_PASSWORD 必须在生产环境中配置');
            }
            return 'admin123';
        })()
    },
    
    // 频道配置
    CHANNELS: ['General', 'Technology', 'Gaming', 'Music', 'Random', 'Channel105'],
    
    // 功能开关
    REGISTRATION_ENABLED: process.env.REGISTRATION_ENABLED !== 'false',
    
    // 版本信息
    VERSION: 'beta v 1',
    
    // CORS 配置（从环境变量读取，支持多个源）
    CORS_ORIGINS: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
        : [
            'http://localhost:3001',
            'https://localhost:3001'
        ],
    
    // 文件上传配置
    UPLOAD: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        ALLOWED_AUDIO_TYPES: ['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg']
    }
};
