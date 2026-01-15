# NEXI CHAT

一个现代化的多频道实时聊天应用，采用 Apple 风格设计，支持文本、图片、语音消息，提供流畅的用户体验。

## 开源作者

- **作者**：JiafeeJF
- **个人博客**：https://hambg5.cn
- **GitHub 仓库**：https://github.com/JiafeeJF/NEXI-CHAT

## 主要特性

- 🎨 **现代化界面** - Apple 风格设计，简洁优雅
- 💬 **多频道支持** - 支持多个公开和私密频道
- 📸 **多媒体消息** - 支持文本、图片、语音消息
- 🔐 **用户认证** - 完整的注册登录系统
- 👤 **个人资料** - 自定义头像、昵称、个性签名
- 🔔 **实时通知** - 基于 Pusher 的实时消息推送
- 🛡️ **安全防护** - 多层安全防护机制
- 📱 **响应式设计** - 完美适配各种设备

## 技术栈

### 后端
- Node.js + Express
- Pusher (实时通信)
- Supabase / JSON (数据存储)
- JWT (身份认证)
- bcryptjs (密码加密)

### 前端
- 原生 JavaScript
- Pusher.js (实时通信)
- Font Awesome (图标)
- CSS3 (样式)

## 快速开始

### 环境要求

- Node.js >= 14.x
- npm 或 yarn
- Pusher 账号（用于实时通信）
- Supabase 账号（可选，用于云数据库）

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/JiafeeJF/NEXI-CHAT.git
cd NEXI-CHAT
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**

复制 `.env` 文件并修改配置：
```bash
cp .env .env.local
```

必须配置的环境变量：
```env
# 服务端口
PORT=12345
FRONTEND_PORT=23456

# JWT 密钥（必须修改）
JWT_SECRET=your-secret-key-change-in-production

# Pusher 配置（必须配置）
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
PUSHER_CLUSTER=ap3

# 数据库类型：json 或 supabase
DB_TYPE=json

# 管理员账号
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# 105 频道密码
CHANNEL105_PASSWORD=change-this-password
```

4. **启动服务**

开发模式：
```bash
npm run start-all
```

生产模式：
```bash
npm start
```

5. **访问应用**

- 前端地址：`https://localhost:23456`
- 后端 API：`https://localhost:12345`

## 使用 Docker 部署

1. **构建镜像**
```bash
npm run docker:build
```

2. **启动容器**
```bash
npm run docker:up
```

3. **查看日志**
```bash
npm run docker:logs
```

4. **停止容器**
```bash
npm run docker:down
```

## 使用 PM2 部署

1. **启动服务**
```bash
npm run pm2:start
```

2. **查看状态**
```bash
npm run pm2:monit
```

3. **查看日志**
```bash
npm run pm2:logs
```

4. **重启服务**
```bash
npm run pm2:restart
```

## Supabase 数据库配置

如果使用 Supabase 作为数据库：

1. 在 Supabase 创建新项目
2. 执行 `supabase-schema.sql` 创建表结构
3. 执行 `supabase-rls-policies.sql` 配置安全策略
4. 在 `.env` 中配置 Supabase 连接信息：

```env
DB_TYPE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

## 功能说明

### 频道系统
- 支持多个公开频道（频道1-5）
- 支持私密频道（105专用频道）
- 私密频道需要密码验证

### 用户系统
- 用户注册和登录
- 个人资料编辑
- 头像上传和裁剪
- 密码修改

### 消息功能
- 文本消息
- 图片消息（支持 JPG、PNG、GIF、WebP）
- 语音消息（支持 WebM、OGG、WAV、MP3）
- 消息回复
- 实时消息推送

### 管理功能
- 管理员登录
- 频道成员管理
- 频道密码修改
- 系统日志查看

## 开发脚本

```bash
# 开发模式（自动重启）
npm run dev

# 启动前端服务
npm run frontend

# 启动后端服务
npm start

# 同时启动前后端
npm run start-all

# 安全检查
npm run security-check

# 生成安全配置
npm run security-generate
```

## 常见问题

### 1. Pusher 连接失败
确保 `.env` 中的 Pusher 配置正确，并且网络可以访问 Pusher 服务。

### 2. 证书错误
开发环境使用自签名证书，浏览器会提示不安全，点击"继续访问"即可。

### 3. 文件上传失败
检查 `public/uploads` 目录是否存在且有写入权限。

### 4. 数据库连接失败
如果使用 Supabase，检查 URL 和密钥是否正确；如果使用 JSON，检查 `server/data` 目录权限。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 作者：JiafeeJF
- 博客：https://hambg5.cn
- GitHub：https://github.com/JiafeeJF

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
