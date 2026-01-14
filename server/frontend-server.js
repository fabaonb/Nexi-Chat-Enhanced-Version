const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const app = express();
const proxy = require('express-http-proxy');

// 加载环境变量
require('dotenv').config();

// 静默模式：只在出错时输出日志
const SILENT_MODE = process.env.SILENT_MODE !== 'false';

const PORT = process.env.FRONTEND_PORT || 23456;
const BACKEND_PORT = process.env.PORT || 12345;

const apiProxy = proxy(`https://localhost:${BACKEND_PORT}`, {
    proxyReqPathResolver: (req) => {
        return req.originalUrl;
    },
    onError: (err, req, res) => {
        if (!SILENT_MODE) console.error('代理错误:', err.message);
        res.status(500).send('代理错误: ' + err.message);
    },
    filter: (req, res) => {
        return req.path.startsWith('/api');
    },
    proxyReqOptDecorator: function(proxyReqOpts) {
        proxyReqOpts.rejectUnauthorized = false;
        return proxyReqOpts;
    }
});

const publicDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(publicDir)) {
    console.error('❌ 公共目录不存在:', publicDir);
    process.exit(1);
}

app.use(apiProxy);

app.use(express.static(publicDir));

app.get('/', (req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('index.html not found');
    }
});

app.get('/login', (req, res) => {
    const loginPath = path.join(publicDir, 'login.html');
    if (fs.existsSync(loginPath)) {
        res.sendFile(loginPath);
    } else {
        res.status(404).send('login.html not found');
    }
});

app.get('/register', (req, res) => {
    const registerPath = path.join(publicDir, 'register.html');
    if (fs.existsSync(registerPath)) {
        res.sendFile(registerPath);
    } else {
        res.status(404).send('register.html not found');
    }
});

app.get('*', (req, res) => {
    const filePath = path.join(publicDir, req.path);
    
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Not found');
    }
});

const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'cert', 'cert.key')),
    cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.crt'))
};
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);
const os = require('os');
const networkInterfaces = os.networkInterfaces();
let lanIp = null;

for (const ifaceName in networkInterfaces) {
    const interfaces = networkInterfaces[ifaceName];
    for (const iface of interfaces) {
        if (!iface.internal && iface.family === 'IPv4') {
            lanIp = iface.address;
            break;
        }
    }
    if (lanIp) break;
}

httpsServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ 前端服务已启动: https://localhost:${PORT}`);
    if (lanIp) {
        console.log(`✓ 局域网访问: https://${lanIp}:${PORT}`);
    }
    console.log(`\n🚀 服务运行中，按 Ctrl+C 停止\n`);
});

process.on('SIGINT', () => {
    if (!SILENT_MODE) console.log('\n正在停止前端服务...');
    process.exit(0);
});
