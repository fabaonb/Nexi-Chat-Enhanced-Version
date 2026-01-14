const supabase = require('../config/supabase');

/**
 * 用户相关操作
 */

// 根据 ID 获取用户
async function getUserById(id) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('获取用户失败:', error);
        return null;
    }
    return data;
}

// 根据用户名获取用户
async function getUserByUsername(username) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = 未找到记录
        console.error('获取用户失败:', error);
    }
    return data;
}

// 根据邮箱获取用户
async function getUserByEmail(email) {
    if (!email) return null;
    
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('获取用户失败:', error);
    }
    return data;
}

// 插入新用户
async function insertUser(userData) {
    const { data, error } = await supabase
        .from('users')
        .insert([{
            username: userData.username,
            password: userData.password,
            email: userData.email || null,
            nickname: userData.nickname || userData.username,
            avatar: null,
            bio: null,
            gender: null
        }])
        .select()
        .single();
    
    if (error) {
        console.error('插入用户失败:', error);
        throw error;
    }
    return data;
}

// 更新用户信息
async function updateUser(id, userData) {
    const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) {
        console.error('更新用户失败:', error);
        return null;
    }
    return data;
}

/**
 * 消息相关操作
 */

// 根据频道获取消息
async function getMessagesByChannel(channel) {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('获取消息失败:', error);
        return [];
    }
    return data || [];
}

// 根据 ID 获取消息
async function getMessageById(id) {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error('获取消息失败:', error);
        return null;
    }
    return data;
}

// 插入新消息
async function insertMessage(messageData) {
    const { data, error } = await supabase
        .from('messages')
        .insert([{
            user_id: messageData.user_id,
            channel: messageData.channel,
            content: messageData.content || '',
            image: messageData.image || null,
            voice: messageData.voice || null,
            reply_to: messageData.reply_to || null,
            is_blocked: messageData.is_blocked || false,
            blocked_at: messageData.is_blocked ? new Date().toISOString() : null,
            is_recalled: false,
            recalled_at: null
        }])
        .select()
        .single();
    
    if (error) {
        console.error('插入消息失败:', error);
        throw error;
    }
    return data;
}

// 更新消息
async function updateMessage(id, messageData) {
    const { data, error } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) {
        console.error('更新消息失败:', error);
        return null;
    }
    return data;
}

// 删除消息
async function deleteMessage(id) {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('删除消息失败:', error);
        return false;
    }
    return true;
}

/**
 * 频道相关操作
 */

// 获取频道信息
async function getChannelByName(name) {
    const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('name', name)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error('获取频道失败:', error);
    }
    return data;
}

// 获取频道成员
async function getChannelMembers(channelName) {
    // 先获取频道 ID
    const channel = await getChannelByName(channelName);
    if (!channel) return [];
    
    const { data, error } = await supabase
        .from('channel_members')
        .select('user_id')
        .eq('channel_id', channel.id);
    
    if (error) {
        console.error('获取频道成员失败:', error);
        return [];
    }
    return data ? data.map(m => m.user_id) : [];
}

// 添加频道成员
async function addChannelMember(channelName, userId) {
    const channel = await getChannelByName(channelName);
    if (!channel) return false;
    
    const { error } = await supabase
        .from('channel_members')
        .insert([{
            channel_id: channel.id,
            user_id: userId
        }]);
    
    if (error && error.code !== '23505') { // 23505 = 唯一约束冲突（已存在）
        console.error('添加频道成员失败:', error);
        return false;
    }
    return true;
}

// 移除频道成员
async function removeChannelMember(channelName, userId) {
    const channel = await getChannelByName(channelName);
    if (!channel) return false;
    
    const { error } = await supabase
        .from('channel_members')
        .delete()
        .eq('channel_id', channel.id)
        .eq('user_id', userId);
    
    if (error) {
        console.error('移除频道成员失败:', error);
        return false;
    }
    return true;
}

// 检查用户是否是频道成员
async function isChannelMember(channelName, userId) {
    const members = await getChannelMembers(channelName);
    return members.includes(parseInt(userId));
}

// 更新频道密码
async function updateChannelPassword(channelName, newPassword) {
    const { error } = await supabase
        .from('channels')
        .update({ password: newPassword })
        .eq('name', channelName);
    
    if (error) {
        console.error('更新频道密码失败:', error);
        return false;
    }
    return true;
}

/**
 * 文件上传相关操作（Supabase Storage）
 */

// 上传头像
async function uploadAvatar(userId, fileBuffer, fileName) {
    const filePath = `${userId}/${Date.now()}-${fileName}`;
    
    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(filePath, fileBuffer, {
            contentType: 'image/png',
            upsert: false
        });
    
    if (error) {
        console.error('上传头像失败:', error);
        throw error;
    }
    
    // 获取公开 URL
    const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
    
    return urlData.publicUrl;
}

// 上传聊天图片
async function uploadChatImage(fileBuffer, fileName) {
    const filePath = `${Date.now()}-${fileName}`;
    
    const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(filePath, fileBuffer, {
            contentType: 'image/png',
            upsert: false
        });
    
    if (error) {
        console.error('上传图片失败:', error);
        throw error;
    }
    
    const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);
    
    return urlData.publicUrl;
}

// 上传语音消息
async function uploadVoiceMessage(fileBuffer, fileName) {
    const filePath = `${Date.now()}-${fileName}`;
    
    const { data, error } = await supabase.storage
        .from('voice-messages')
        .upload(filePath, fileBuffer, {
            contentType: 'audio/webm',
            upsert: false
        });
    
    if (error) {
        console.error('上传语音失败:', error);
        throw error;
    }
    
    const { data: urlData } = supabase.storage
        .from('voice-messages')
        .getPublicUrl(filePath);
    
    return urlData.publicUrl;
}

module.exports = {
    // 用户操作
    getUserById,
    getUserByUsername,
    getUserByEmail,
    insertUser,
    updateUser,
    
    // 消息操作
    getMessagesByChannel,
    getMessageById,
    insertMessage,
    updateMessage,
    deleteMessage,
    
    // 频道操作
    getChannelByName,
    getChannelMembers,
    addChannelMember,
    removeChannelMember,
    isChannelMember,
    updateChannelPassword,
    
    // 文件上传
    uploadAvatar,
    uploadChatImage,
    uploadVoiceMessage
};
