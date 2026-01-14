const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
// 请在 https://supabase.com/ 创建项目并获取凭证
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  警告: Supabase 配置未设置，请在 .env 文件中配置 SUPABASE_URL 和 SUPABASE_ANON_KEY');
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
