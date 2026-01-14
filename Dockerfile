# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装必要的系统依赖（sharp 需要）
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装项目依赖
RUN npm ci --only=production

# 复制项目文件
COPY . .

# 创建必要的目录
RUN mkdir -p server/data server/logs server/cert public/uploads

# 设置目录权限
RUN chmod -R 755 server/data server/logs server/cert public/uploads

# 暴露端口
EXPOSE 3000 3001

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV FRONTEND_PORT=3001

# 启动命令
CMD ["npm", "run", "start-all"]
