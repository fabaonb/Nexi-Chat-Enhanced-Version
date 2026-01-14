-- NEXI CHAT 数据库表结构
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    nickname VARCHAR(50),
    avatar TEXT,
    bio TEXT,
    gender VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 消息表
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    content TEXT,
    image TEXT,
    voice TEXT,
    reply_to BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_at TIMESTAMP WITH TIME ZONE,
    is_recalled BOOLEAN DEFAULT FALSE,
    recalled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 频道表
CREATE TABLE IF NOT EXISTS channels (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 频道成员表
CREATE TABLE IF NOT EXISTS channel_members (
    id BIGSERIAL PRIMARY KEY,
    channel_id BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel_id ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);

-- 插入默认频道
INSERT INTO channels (name, password) VALUES
    ('General', NULL),
    ('Technology', NULL),
    ('Gaming', NULL),
    ('Music', NULL),
    ('Random', NULL),
    ('Channel105', '123456')
ON CONFLICT (name) DO NOTHING;

-- 启用 Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略（允许所有操作，因为我们在后端控制权限）
CREATE POLICY "允许所有用户操作" ON users FOR ALL USING (true);
CREATE POLICY "允许所有消息操作" ON messages FOR ALL USING (true);
CREATE POLICY "允许所有频道操作" ON channels FOR ALL USING (true);
CREATE POLICY "允许所有频道成员操作" ON channel_members FOR ALL USING (true);

-- 创建存储桶（用于文件上传）
-- 注意：这需要在 Supabase Storage 界面手动创建，或使用 Supabase CLI
-- 存储桶名称：
-- 1. avatars - 用户头像
-- 2. chat-images - 聊天图片
-- 3. voice-messages - 语音消息
