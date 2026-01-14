const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const AUDIT_LOG_FILE = path.join(LOG_DIR, 'audit.log');
const CHAT_LOG_FILE = path.join(LOG_DIR, 'chat.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

// 检测是否在只读文件系统环境（如 Vercel）
let isReadOnlyFS = false;

try {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    // 测试写入权限
    const testFile = path.join(LOG_DIR, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
} catch (error) {
    isReadOnlyFS = true;
    console.warn('⚠️  检测到只读文件系统，日志将输出到控制台');
}

function writeLog(filePath, logData) {
    if (isReadOnlyFS) {
        // 在只读环境下输出到控制台
        console.log(JSON.stringify(logData));
    } else {
        // 正常环境写入文件
        const logLine = JSON.stringify(logData) + '\n';
        fs.appendFileSync(filePath, logLine, 'utf8');
    }
}

function auditLog(action, userId, details = {}) {
    const logData = {
        timestamp: new Date().toISOString(),
        action,
        userId,
        details
    };
    writeLog(AUDIT_LOG_FILE, logData);
}

function chatLog(channel, userId, content, messageType, details = {}) {
    const logData = {
        timestamp: new Date().toISOString(),
        channel,
        userId,
        content,
        messageType,
        details
    };
    writeLog(CHAT_LOG_FILE, logData);
}

function errorLog(error, context = {}) {
    const logData = {
        timestamp: new Date().toISOString(),
        error: {
            message: error.message,
            stack: error.stack
        },
        context
    };
    writeLog(ERROR_LOG_FILE, logData);
    console.error('Error:', error);
    console.error('Context:', context);
}
module.exports = {
    auditLog,
    chatLog,
    errorLog
};