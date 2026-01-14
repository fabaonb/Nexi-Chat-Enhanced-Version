// PM2 生态系统配置文件
// 使用方法: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'nexi-chat-backend',
      script: './server/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './server/logs/pm2-backend-error.log',
      out_file: './server/logs/pm2-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000
    },
    {
      name: 'nexi-chat-frontend',
      script: './server/frontend-server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        FRONTEND_PORT: 3001
      },
      error_file: './server/logs/pm2-frontend-error.log',
      out_file: './server/logs/pm2-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      listen_timeout: 3000,
      kill_timeout: 5000
    }
  ]
};
