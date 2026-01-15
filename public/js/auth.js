// 通用 API 请求函数，自动处理认证错误
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // 添加认证头
    if (token && !options.headers) {
        options.headers = {};
    }
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        // 检查认证错误
        if (response.status === 401 && (data.code === 'USER_NOT_FOUND' || data.code === 'INVALID_TOKEN')) {
            alert('登录已失效，请重新登录');
            logout();
            return null;
        }
        
        return { response, data };
    } catch (error) {
        console.error('API 请求失败:', error);
        throw error;
    }
}


if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 获取并清理输入
        const username = sanitizeUsername(document.getElementById('username').value);
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        
        if (!username || !password) {
            errorMessage.textContent = '用户名和密码不能为空';
            return;
        }
        
        // 显示加载状态
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '登录中...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 先保存数据
                localStorage.setItem('user', JSON.stringify({
                    id: data.userId,
                    username: data.username,
                    nickname: data.nickname,
                    avatar: data.avatar,
                    bio: data.bio,
                    gender: data.gender
                }));
                localStorage.setItem('token', data.token);
                
                // 立即跳转，不等待
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = escapeHtml(data.error || '登录失败，请重试');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        } catch (error) {
            errorMessage.textContent = '网络错误，请检查连接';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}


if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 获取并清理输入
        const username = sanitizeUsername(document.getElementById('username').value);
        const nickname = sanitizeInput(document.getElementById('nickname').value);
        const password = document.getElementById('password').value;
        const email = sanitizeEmail(document.getElementById('email').value);
        const errorMessage = document.getElementById('errorMessage');
        
        // 验证用户名
        if (!username || username.length < 3 || username.length > 20) {
            errorMessage.textContent = '用户名长度必须在3-20个字符之间';
            return;
        }
        
        // 验证密码
        if (!password || password.length < 6) {
            errorMessage.textContent = '密码长度至少6个字符';
            return;
        }
        
        // 显示加载状态
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '注册中...';
        submitBtn.disabled = true;
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password, email, nickname })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 先保存数据
                localStorage.setItem('user', JSON.stringify({
                    id: data.userId,
                    username: username,
                    nickname: nickname || username,
                    avatar: 'default.png',
                    bio: '',
                    gender: 'other'
                }));
                localStorage.setItem('token', data.token);
                
                // 立即跳转，不等待
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = escapeHtml(data.error || '注册失败，请重试');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        } catch (error) {
            errorMessage.textContent = '网络错误，请检查连接';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}




function checkLogin() {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!user || !token) {
        
        window.location.href = 'login.html';
        return null;
    }
    
    return JSON.parse(user);
}


function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}


function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}