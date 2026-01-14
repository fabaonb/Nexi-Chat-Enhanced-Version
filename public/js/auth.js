
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');
        
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
                
                localStorage.setItem('user', JSON.stringify({
                    id: data.userId,
                    username: data.username,
                    nickname: data.nickname,
                    avatar: data.avatar,
                    bio: data.bio,
                    gender: data.gender
                }));
                localStorage.setItem('token', data.token);
                
                
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = data.error || '登录失败，请重试';
            }
        } catch (error) {
            errorMessage.textContent = '网络错误，请检查连接';
        }
    });
}


if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const nickname = document.getElementById('nickname').value;
        const password = document.getElementById('password').value;
        const email = document.getElementById('email').value;
        const errorMessage = document.getElementById('errorMessage');
        
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
                
                localStorage.setItem('user', JSON.stringify({
                    id: data.userId,
                    username: username,
                    nickname: nickname || username,
                    avatar: 'default.png',
                    bio: '',
                    gender: 'other'
                }));
                localStorage.setItem('token', data.token);
                
                
                window.location.href = 'index.html';
            } else {
                errorMessage.textContent = data.error || '注册失败，请重试';
            }
        } catch (error) {
            errorMessage.textContent = '网络错误，请检查连接';
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