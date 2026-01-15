-- Supabase 行级安全（RLS）策略
-- 这些策略提供额外的数据库层安全防护

-- ============================================
-- 用户表（users）安全策略
-- ============================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的完整信息
CREATE POLICY "用户可以查看自己的信息"
ON users FOR SELECT
USING (auth.uid()::text = id::text);

-- 用户只能更新自己的信息
CREATE POLICY "用户可以更新自己的信息"
ON users FOR UPDATE
USING (auth.uid()::text = id::text);

-- 禁止用户删除自己的账户（需要管理员操作）
CREATE POLICY "禁止用户删除账户"
ON users FOR DELETE
USING (false);

-- 用户可以查看其他用户的公开信息（用于显示头像、昵称等）
CREATE POLICY "用户可以查看其他用户的公开信息"
ON users FOR SELECT
USING (true);

-- ============================================
-- 消息表（messages）安全策略
-- ============================================

-- 启用 RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 用户可以查看所有频道的消息（除非被屏蔽）
CREATE POLICY "用户可以查看消息"
ON messages FOR SELECT
USING (
    NOT is_blocked OR 
    (is_blocked AND auth.uid()::text = user_id::text)
);

-- 用户只能插入自己的消息
CREATE POLICY "用户可以发送消息"
ON messages FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

-- 用户只能更新自己的消息（用于撤回）
CREATE POLICY "用户可以撤回自己的消息"
ON messages FOR UPDATE
USING (
    auth.uid()::text = user_id::text AND
    (EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) <= 2
);

-- 用户不能删除消息（只能撤回）
CREATE POLICY "禁止删除消息"
ON messages FOR DELETE
USING (false);

-- ============================================
-- 频道成员表（channel_members）安全策略
-- ============================================

-- 启用 RLS
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己加入的频道
CREATE POLICY "用户可以查看自己的频道成员资格"
ON channel_members FOR SELECT
USING (auth.uid()::text = user_id::text);

-- 禁止用户直接插入频道成员（需要通过 API）
CREATE POLICY "禁止直接插入频道成员"
ON channel_members FOR INSERT
WITH CHECK (false);

-- 禁止用户删除频道成员
CREATE POLICY "禁止删除频道成员"
ON channel_members FOR DELETE
USING (false);

-- ============================================
-- 频道表（channels）安全策略
-- ============================================

-- 启用 RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- 所有用户可以查看频道列表
CREATE POLICY "用户可以查看频道列表"
ON channels FOR SELECT
USING (true);

-- 禁止用户修改频道
CREATE POLICY "禁止修改频道"
ON channels FOR UPDATE
USING (false);

-- 禁止用户创建频道
CREATE POLICY "禁止创建频道"
ON channels FOR INSERT
WITH CHECK (false);

-- 禁止用户删除频道
CREATE POLICY "禁止删除频道"
ON channels FOR DELETE
USING (false);

-- ============================================
-- 数据库函数：安全的消息查询
-- ============================================

-- 创建安全的消息查询函数
CREATE OR REPLACE FUNCTION get_channel_messages(
    p_channel TEXT,
    p_user_id TEXT,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id INTEGER,
    user_id INTEGER,
    channel TEXT,
    content TEXT,
    image TEXT,
    voice TEXT,
    created_at TIMESTAMP,
    is_blocked BOOLEAN,
    is_recalled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.user_id,
        m.channel,
        m.content,
        m.image,
        m.voice,
        m.created_at,
        m.is_blocked,
        m.is_recalled
    FROM messages m
    WHERE m.channel = p_channel
        AND (
            NOT m.is_blocked 
            OR (m.is_blocked AND m.user_id::text = p_user_id)
        )
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 1000); -- 最多返回 1000 条
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 数据库触发器：自动清理过期的被屏蔽消息
-- ============================================

-- 创建清理函数
CREATE OR REPLACE FUNCTION cleanup_blocked_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM messages
    WHERE is_blocked = true
        AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建定时任务（需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-blocked-messages', '0 * * * *', 'SELECT cleanup_blocked_messages()');

-- ============================================
-- 数据库触发器：防止消息内容篡改
-- ============================================

-- 创建触发器函数
CREATE OR REPLACE FUNCTION prevent_message_tampering()
RETURNS TRIGGER AS $$
BEGIN
    -- 只允许更新 is_recalled 字段
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        IF NEW.is_recalled = false THEN
            RAISE EXCEPTION '不允许修改消息内容';
        END IF;
    END IF;
    
    -- 检查撤回时间限制
    IF NEW.is_recalled = true AND OLD.is_recalled = false THEN
        IF EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / 60 > 2 THEN
            RAISE EXCEPTION '消息已超过 2 分钟撤回时限';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER check_message_tampering
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION prevent_message_tampering();

-- ============================================
-- 数据库视图：安全的用户公开信息
-- ============================================

-- 创建用户公开信息视图
CREATE OR REPLACE VIEW user_public_info AS
SELECT 
    id,
    username,
    nickname,
    avatar,
    bio,
    gender,
    created_at
FROM users;

-- 授予查看权限
GRANT SELECT ON user_public_info TO authenticated;

-- ============================================
-- 数据库索引：优化查询性能
-- ============================================

-- 消息表索引
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_blocked ON messages(is_blocked) WHERE is_blocked = true;

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 频道成员表索引
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel);

-- ============================================
-- 数据库约束：数据完整性
-- ============================================

-- 确保用户名唯一
ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username);

-- 确保邮箱唯一（如果不为空）
CREATE UNIQUE INDEX unique_email ON users(email) WHERE email IS NOT NULL;

-- 消息内容长度限制
ALTER TABLE messages ADD CONSTRAINT check_content_length 
CHECK (LENGTH(content) <= 5000);

-- 用户名长度限制
ALTER TABLE users ADD CONSTRAINT check_username_length 
CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 20);

-- ============================================
-- 审计日志表
-- ============================================

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 只有管理员可以查看审计日志
CREATE POLICY "只有管理员可以查看审计日志"
ON audit_logs FOR SELECT
USING (false); -- 需要通过服务端 API 访问

-- 创建审计日志函数
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id INTEGER,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id INTEGER,
    p_old_data JSONB,
    p_new_data JSONB,
    p_ip_address TEXT,
    p_user_agent TEXT
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, action, table_name, record_id, 
        old_data, new_data, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_table_name, p_record_id,
        p_old_data, p_new_data, p_ip_address, p_user_agent
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 速率限制表（数据库层）
-- ============================================

-- 创建速率限制表
CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    ip_address TEXT,
    action TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_action ON rate_limits(ip_address, action, window_start);

-- 清理过期的速率限制记录
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 注释说明
-- ============================================

COMMENT ON TABLE users IS '用户表，存储用户基本信息';
COMMENT ON TABLE messages IS '消息表，存储聊天消息';
COMMENT ON TABLE channels IS '频道表，存储频道信息';
COMMENT ON TABLE channel_members IS '频道成员表，存储用户与频道的关系';
COMMENT ON TABLE audit_logs IS '审计日志表，记录所有重要操作';
COMMENT ON TABLE rate_limits IS '速率限制表，用于数据库层的速率控制';
