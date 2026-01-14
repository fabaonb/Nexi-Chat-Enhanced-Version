const Pusher = require('pusher');

// Pusher 配置
// 请在 https://dashboard.pusher.com/ 注册并获取你的凭证
const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID || 'your-app-id',
    key: process.env.PUSHER_KEY || 'your-key',
    secret: process.env.PUSHER_SECRET || 'your-secret',
    cluster: process.env.PUSHER_CLUSTER || 'ap3', // 亚太区域
    useTLS: true
});

module.exports = pusher;
