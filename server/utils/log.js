const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const AUDIT_LOG_FILE = path.join(LOG_DIR, 'audit.log');
const CHAT_LOG_FILE = path.join(LOG_DIR, 'chat.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(filePath, logData) {
    const logLine = JSON.stringify(logData) + '\n';
    fs.appendFileSync(filePath, logLine, 'utf8');
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