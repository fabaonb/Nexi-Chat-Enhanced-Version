// 前端安全防护模块

/**
 * CSRF Token 管理
 */
let csrfToken = null;

function generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function getCSRFToken() {
    if (!csrfToken) {
        csrfToken = sessionStorage.getItem('csrf_token');
        if (!csrfToken) {
            csrfToken = generateCSRFToken();
            sessionStorage.setItem('csrf_token', csrfToken);
        }
    }
    return csrfToken;
}

/**
 * 安全的 Fetch 请求封装
 */
async function secureFetch(url, options = {}) {
    // 添加 CSRF Token
    const headers = {
        ...options.headers,
        'X-CSRF-Token': getCSRFToken()
    };
    
    // 添加认证 Token
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 合并选项
    const secureOptions = {
        ...options,
        headers,
        credentials: 'same-origin' // 防止 CSRF
    };
    
    try {
        const response = await fetch(url, secureOptions);
        
        // 处理速率限制
        if (response.status === 429) {
            const data = await response.json();
            throw new Error(data.error || '请求过于频繁，请稍后再试');
        }
        
        return response;
    } catch (error) {
        console.error('请求失败:', error);
        throw error;
    }
}

/**
 * 防止点击劫持
 */
function preventClickjacking() {
    if (window.top !== window.self) {
        // 检测是否在 iframe 中
        window.top.location = window.self.location;
    }
}

/**
 * 安全的本地存储
 */
const SecureStorage = {
    // 加密存储（简单的 Base64 编码，实际应用中应使用更强的加密）
    setItem: function(key, value) {
        try {
            const encoded = btoa(JSON.stringify(value));
            localStorage.setItem(key, encoded);
        } catch (error) {
            console.error('存储失败:', error);
        }
    },
    
    getItem: function(key) {
        try {
            const encoded = localStorage.getItem(key);
            if (!encoded) return null;
            return JSON.parse(atob(encoded));
        } catch (error) {
            console.error('读取失败:', error);
            return null;
        }
    },
    
    removeItem: function(key) {
        localStorage.removeItem(key);
    },
    
    clear: function() {
        localStorage.clear();
    }
};

/**
 * 输入验证
 */
const InputValidator = {
    // 验证用户名
    validateUsername: function(username) {
        if (!username || typeof username !== 'string') {
            return { valid: false, error: '用户名不能为空' };
        }
        
        if (username.length < 3 || username.length > 20) {
            return { valid: false, error: '用户名长度必须在 3-20 个字符之间' };
        }
        
        if (!/^[\w\u4e00-\u9fa5]+$/.test(username)) {
            return { valid: false, error: '用户名只能包含字母、数字、下划线和中文' };
        }
        
        return { valid: true };
    },
    
    // 验证密码
    validatePassword: function(password) {
        if (!password || typeof password !== 'string') {
            return { valid: false, error: '密码不能为空' };
        }
        
        if (password.length < 6 || password.length > 50) {
            return { valid: false, error: '密码长度必须在 6-50 个字符之间' };
        }
        
        return { valid: true };
    },
    
    // 验证邮箱
    validateEmail: function(email) {
        if (!email) {
            return { valid: true }; // 邮箱是可选的
        }
        
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: '邮箱格式不正确' };
        }
        
        return { valid: true };
    },
    
    // 验证消息内容
    validateMessage: function(content) {
        if (!content || typeof content !== 'string') {
            return { valid: false, error: '消息内容不能为空' };
        }
        
        if (content.length > 5000) {
            return { valid: false, error: '消息长度不能超过 5000 个字符' };
        }
        
        return { valid: true };
    }
};

/**
 * 防止重复提交
 */
const SubmitGuard = {
    submitting: new Set(),
    
    canSubmit: function(key) {
        return !this.submitting.has(key);
    },
    
    startSubmit: function(key) {
        this.submitting.add(key);
    },
    
    endSubmit: function(key) {
        this.submitting.delete(key);
    }
};

/**
 * 安全的表单提交
 */
async function secureFormSubmit(formId, url, data, onSuccess, onError) {
    const submitKey = `${formId}-${url}`;
    
    // 防止重复提交
    if (!SubmitGuard.canSubmit(submitKey)) {
        console.warn('请勿重复提交');
        return;
    }
    
    SubmitGuard.startSubmit(submitKey);
    
    try {
        const response = await secureFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (onSuccess) onSuccess(result);
        } else {
            if (onError) onError(result.error || '操作失败');
        }
    } catch (error) {
        if (onError) onError(error.message);
    } finally {
        SubmitGuard.endSubmit(submitKey);
    }
}

/**
 * 内容安全策略违规报告
 */
if (typeof document !== 'undefined') {
    document.addEventListener('securitypolicyviolation', (e) => {
        console.warn('CSP 违规:', {
            blockedURI: e.blockedURI,
            violatedDirective: e.violatedDirective,
            originalPolicy: e.originalPolicy
        });
    });
}

/**
 * 防止控制台注入攻击
 */
function preventConsoleInjection() {
    const consoleWarning = `
%c⚠️ 警告！
%c如果有人让你在这里复制粘贴内容，请立即停止！
这可能会让攻击者访问你的账户。
    `;
    
    console.log(consoleWarning, 
        'color: red; font-size: 24px; font-weight: bold;',
        'color: black; font-size: 16px;'
    );
}

/**
 * 监控可疑活动
 */
function monitorSuspiciousActivity() {
    // 基础安全监控
    let devtoolsOpen = false;
    const threshold = 160;
    
    setInterval(() => {
        if (window.outerWidth - window.innerWidth > threshold || 
            window.outerHeight - window.innerHeight > threshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
            }
        } else {
            devtoolsOpen = false;
        }
    }, 1000);
}

/**
 * 初始化安全防护
 */
function initClientSecurity() {
    // 防止点击劫持
    preventClickjacking();
    
    // 显示控制台警告
    preventConsoleInjection();
    
    // 监控可疑活动
    monitorSuspiciousActivity();
}

// 页面加载时初始化
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClientSecurity);
    } else {
        initClientSecurity();
    }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        secureFetch,
        SecureStorage,
        InputValidator,
        secureFormSubmit,
        getCSRFToken
    };
}
