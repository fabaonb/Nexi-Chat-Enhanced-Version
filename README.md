# NEXI CHAT

一个基于 Pusher 实时通信的多频道局域网聊天系统，采用 Apple 风格设计。

## 项目简介

NEXI CHAT 是一个功能完善的实时聊天应用，支持多频道通信、用户认证、消息管理、文件上传等功能。项目采用前后端分离架构，使用 Pusher 提供实时消息推送能力。

## 开源作者

- **作者**：JiafeeJF
- **个人博客**：https://hambg5.cn
- **GitHub 仓库**：https://github.com/JiafeeJF/NEXI-CHAT

## 核心功能

### 用户系统
- 用户注册与登录（支持开关控制）
- JWT 令牌认证
- 个人资料管理（头像、昵称、签名、性别、邮箱）
- 密码修改
- 管理员后台

### 聊天功能
- 多频道支持（6个频道，包含1个私密频道）
- 实时消息推送（基于 Pusher）
- 消息回复功能
- 消息撤回（2分钟内）
- 图片上传与预览
- 语音消息发送
- Emoji 表情支持
- 敏感词过滤（自动屏蔽24小时后删除）

### 频道管理
- 公开频道：General、Technology、Gaming、Music、Random
- 私密频道：Channel105（需要密码访问）
- 频道成员管理
- 在线状态显示

### 通知系统
- 消息提示音开关
- 分频道通知设置
- 桌面通知支持

## 技术栈

### 后端
- **Node.js** + **Express** - 服务器框架
- **Pusher** - 实时通信服务
- **JWT** - 用户认证
- **bcryptjs** - 密码加密
- **Sharp** - 图片处理
- **Multer** - 文件上传

### 前端
- 原生 JavaScript
- Pusher.js - 实时通信客户端
- Font Awesome - 图标库
- CSS3 - Apple 风格界面

### 数据存储
- **JSON 文件**（本地/VPS/Docker 部署）
- **Supabase**（Vercel 云部署）

## 快速开始

### 环境要求
- Node.js >= 14.x
- npm 或 yarn

### 安装步骤

1. 克隆项目
```bash
git clone <repository-url>
cd lan-chat-website
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
# 复制环境变量模板
copy .env.example .env

# 编辑 .env 文件，配置必要参数
# 必须配置：PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET
```

4. 启动服务

**方式一：使用批处理脚本（Windows）**
```bash
start.bat
```

**方式二：使用 npm 脚本**
```bash
# 同时启动后端和前端
npm run start-all

# 或分别启动
npm start              # 后端服务（端口 3000）
npm run frontend       # 前端服务（端口 3001）
```

**方式三：使用 PM2（生产环境推荐）**
```bash
npm run pm2:start      # 启动服务
npm run pm2:logs       # 查看日志
npm run pm2:stop       # 停止服务
npm run pm2:restart    # 重启服务
```

**方式四：使用 Docker**
```bash
npm run docker:build   # 构建镜像
npm run docker:up      # 启动容器
npm run docker:logs    # 查看日志
npm run docker:down    # 停止容器
```

5. 访问应用
- 前端界面：https://localhost:3001
- 后端 API：https://localhost:3000
- 管理后台：https://localhost:3001/admin-login.html

## 环境变量说明

### 必需配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `PUSHER_APP_ID` | Pusher 应用 ID | `123456` |
| `PUSHER_KEY` | Pusher 公钥 | `your-key` |
| `PUSHER_SECRET` | Pusher 密钥 | `your-secret` |
| `PUSHER_CLUSTER` | Pusher 集群 | `ap3` |

### 可选配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 后端服务端口 | `3000` |
| `FRONTEND_PORT` | 前端服务端口 | `3001` |
| `JWT_SECRET` | JWT 密钥 | `your-secret-key-change-in-production` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码 | `admin123` |
| `REGISTRATION_ENABLED` | 是否开放注册 | `true` |
| `CHANNEL105_PASSWORD` | 私密频道密码 | `change-this-password` |
| `DB_TYPE` | 数据库类型 | `json` |
| `NODE_ENV` | 运行环境 | `development` |

## 部署方式

### 本地部署
使用 JSON 文件存储，无需额外数据库配置。

### VPS 部署
1. 使用 PM2 进程管理
2. 配置 Nginx 反向代理
3. 使用 systemd 服务（参考 `nexi-chat.service.example`）

### Docker 部署
```bash
docker-compose up -d
```

### Vercel 部署
1. 设置 `DB_TYPE=supabase`
2. 配置 Supabase 数据库（执行 `supabase-schema.sql`）
3. 设置环境变量
4. 部署到 Vercel

## 项目结构

```
lan-chat-website/
├── api/                    # Vercel API 路由
├── public/                 # 前端静态文件
│   ├── css/               # 样式文件
│   ├── js/                # JavaScript 文件
│   ├── images/            # 图片资源
│   ├── uploads/           # 用户上传文件
│   ├── index.html         # 主页面
│   ├── login.html         # 登录页面
│   ├── register.html      # 注册页面
│   ├── admin-login.html   # 管理员登录
│   └── admin.html         # 管理后台
├── server/                # 后端服务
│   ├── config/            # 配置文件
│   ├── data/              # JSON 数据存储
│   ├── logs/              # 日志文件
│   ├── utils/             # 工具函数
│   ├── cert/              # SSL 证书
│   ├── server.js          # 后端主服务
│   └── frontend-server.js # 前端静态服务
├── .env                   # 环境变量
├── package.json           # 项目配置
├── ecosystem.config.js    # PM2 配置
├── docker-compose.yml     # Docker 配置
├── Dockerfile             # Docker 镜像
└── supabase-schema.sql    # 数据库结构
```

## 管理功能

### 管理员后台
访问 `/admin-login.html` 使用管理员账号登录，可以：
- 查看系统日志
- 管理私密频道成员
- 修改频道密码
- 查看用户活动

### 日志系统
- 聊天日志：记录所有消息
- 审计日志：记录用户操作
- 错误日志：记录系统错误
- PM2 日志：进程管理日志

## 安全特性

- HTTPS 加密通信
- JWT 令牌认证
- 密码 bcrypt 加密
- CORS 跨域保护
- 敏感词过滤
- 文件上传限制
- SQL 注入防护

## 常见问题

### 1. Pusher 连接失败
检查 `.env` 文件中的 Pusher 配置是否正确，确保 `PUSHER_KEY`、`PUSHER_SECRET`、`PUSHER_APP_ID` 已正确设置。

### 2. 无法访问私密频道
确保已在 `.env` 中设置 `CHANNEL105_PASSWORD`，并使用正确的密码访问。

### 3. 图片上传失败
检查 `public/uploads` 目录是否存在且有写入权限。

### 4. 局域网无法访问
在 `.env` 的 `CORS_ORIGINS` 中添加局域网 IP 地址，例如：
```
CORS_ORIGINS=http://192.168.1.100:3001,https://192.168.1.100:3001
```

## 开发指南

### 开发模式
```bash
npm run dev              # 后端热重载
npm run dev-frontend     # 前端热重载
```

### 数据库切换
修改 `.env` 中的 `DB_TYPE`：
- `json` - 本地 JSON 文件
- `supabase` - Supabase 云数据库

### 添加新频道
1. 在 `server/config/config.js` 的 `CHANNELS` 数组中添加频道名
2. 在前端 `public/index.html` 中添加频道 UI
3. 如需私密频道，在数据库中设置密码

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 联系方式

如有问题或建议，请通过 Issue 反馈。
