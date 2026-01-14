const { createClient } = require('@supabase/supabase-js');

// Supabase 配置
// 请在 https://supabase.com/ 创建项目并获取凭证
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

// 只有在配置有效且不是默认值时才创建客户端
let supabase = null;

if (supabaseUrl && supabaseKey && 
    supabaseUrl !== 'your-supabase-url' && 
    supabaseKey !== 'your-supabase-anon-key') {
    // 创建 Supabase 客户端
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('⚠️  警告: Supabase 配置未设置或使用默认值，Supabase 功能将不可用');
}

module.exports = supabase;
