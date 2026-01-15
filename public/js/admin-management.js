


const logoutBtn = document.getElementById('logoutBtn');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const channel105Members = document.getElementById('channel105Members');
const adminPasswordForm = document.getElementById('adminPasswordForm');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmNewPassword = document.getElementById('confirmNewPassword');
const channelPasswordForm = document.getElementById('channelPasswordForm');
const channelNewPassword = document.getElementById('channelNewPassword');



window.addEventListener('DOMContentLoaded', async () => {
    
    const adminToken = localStorage.getItem('adminToken');
    const isAdmin = localStorage.getItem('isAdmin');
    
    if (!adminToken || !isAdmin) {
        
        window.location.href = '/admin-login.html';
        return;
    }
    
    
    await fetchChannelMembers('Channel105', channel105Members);
    
    
    adminPasswordForm.addEventListener('submit', handleAdminPasswordChange);
    channelPasswordForm.addEventListener('submit', handleChannelPasswordChange);
});


logoutBtn.addEventListener('click', () => {
    
    localStorage.removeItem('adminToken');
    localStorage.removeItem('isAdmin');
    
    
    window.location.href = '/admin-login.html';
});


async function fetchChannelMembers(channel, container) {
    try {
        const adminToken = localStorage.getItem('adminToken');
        
        const response = await fetch(`/api/channel/${channel}/members`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('获取成员列表失败');
        }
        
        const members = await response.json();
        
        
        renderMembers(members, container, channel);
        
    } catch (error) {
        showError(`获取${channel}成员列表失败: ${error.message}`);
    }
}


function renderMembers(members, container, channel) {
    if (members.length === 0) {
        container.innerHTML = '<div class="no-members">当前频道暂无成员</div>';
        return;
    }
    
    container.innerHTML = members.map(member => {
        // 使用 XSS 防护清理用户数据
        const safeUsername = escapeHtml(member.username);
        const safeInitial = escapeHtml(member.username.charAt(0).toUpperCase());
        
        return `
        <div class="member-item" data-user-id="${member.id}">
            <div class="member-info">
                <div class="member-avatar">${safeInitial}</div>
                <span class="member-username">${safeUsername}</span>
            </div>
            <button class="remove-btn" onclick="removeMember(${member.id}, '${escapeHtml(channel)}')">移除</button>
        </div>
    `;
    }).join('');
}


async function removeMember(userId, channel) {
    if (!confirm('确定要将该用户从频道中移除吗？')) {
        return;
    }
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        
        const response = await fetch(`/api/channel/${channel}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '移除成员失败');
        }
        
        
        await fetchChannelMembers(channel, 
            channel === 'Channel105' ? channel105Members : null);
        
        showSuccess('成员移除成功');
        
    } catch (error) {
        showError(`移除成员失败: ${error.message}`);
    }
}


function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
    
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}


function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
    
    
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 3000);
}


async function handleAdminPasswordChange(e) {
    e.preventDefault();
    
    
    if (newPassword.value !== confirmNewPassword.value) {
        showError('新密码和确认密码不匹配');
        return;
    }
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        
        const response = await fetch('/api/admin/password', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                currentPassword: currentPassword.value,
                newPassword: newPassword.value
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '更改密码失败');
        }
        
        const result = await response.json();
        
        
        showSuccess(result.message);
        
        
        adminPasswordForm.reset();
        
    } catch (error) {
        showError(`更改密码失败: ${error.message}`);
    }
}


async function handleChannelPasswordChange(e) {
    e.preventDefault();
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        
        const response = await fetch('/api/channel/Channel105/password', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newPassword: channelNewPassword.value
            })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '更改频道密码失败');
        }
        
        const result = await response.json();
        
        
        showSuccess(result.message);
        
        
        channelPasswordForm.reset();
        
    } catch (error) {
        showError(`更改频道密码失败: ${error.message}`);
    }
}




const logFileSelect = document.getElementById('logFileSelect');
const logSearchInput = document.getElementById('logSearchInput');
const logSearchBtn = document.getElementById('logSearchBtn');
const logList = document.getElementById('logList');
const logPrevPage = document.getElementById('logPrevPage');
const logNextPage = document.getElementById('logNextPage');
const logTotal = document.getElementById('logTotal');
const logCurrentPage = document.getElementById('logCurrentPage');
const logTotalPages = document.getElementById('logTotalPages');


let currentLogState = {
    filename: '',
    search: '',
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
};


async function loadLogFiles() {
    try {
        const adminToken = localStorage.getItem('adminToken');
        
        const response = await fetch('/api/admin/logs/list', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '加载日志文件列表失败');
        }
        
        const result = await response.json();
        
        
        logFileSelect.innerHTML = '';
        
        if (result.logFiles.length === 0) {
            logFileSelect.innerHTML = '<option value="">暂无日志文件</option>';
            return;
        }
        
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '请选择日志文件';
        logFileSelect.appendChild(defaultOption);
        
        
        result.logFiles.forEach(file => {
            const option = document.createElement('option');
            option.value = file.filename;
            option.textContent = `${file.filename} (${formatFileSize(file.size)})`;
            logFileSelect.appendChild(option);
        });
        
    } catch (error) {
        showError(`加载日志文件列表失败: ${error.message}`);
        logFileSelect.innerHTML = '<option value="">加载失败，请刷新页面重试</option>';
    }
}


function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}


async function searchLogs() {
    const filename = logFileSelect.value;
    const search = logSearchInput.value;
    
    if (!filename) {
        showError('请选择日志文件');
        return;
    }
    
    
    currentLogState.filename = filename;
    currentLogState.search = search;
    currentLogState.page = 1;
    
    
    logList.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d; font-style: italic;">加载中...</div>';
    
    try {
        const adminToken = localStorage.getItem('adminToken');
        const params = new URLSearchParams({
            search: search,
            page: currentLogState.page,
            limit: currentLogState.limit
        });
        
        const response = await fetch(`/api/admin/logs/content/${filename}?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || '查询日志失败');
        }
        
        const result = await response.json();
        
        
        currentLogState.total = result.total;
        currentLogState.totalPages = result.totalPages;
        currentLogState.page = result.page;
        
        
        renderLogList(result.logs);
        
        
        updatePagination();
        
    } catch (error) {
        showError(`查询日志失败: ${error.message}`);
        logList.innerHTML = `<div style="text-align: center; padding: 40px; color: #dc3545; font-style: italic;">${error.message}</div>`;
    }
}


function renderLogList(logs) {
    if (logs.length === 0) {
        logList.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d; font-style: italic;">没有找到匹配的日志记录</div>';
        return;
    }
    
    logList.innerHTML = logs.map(log => {
        // 使用 XSS 防护清理日志数据
        const time = escapeHtml(new Date(log.timestamp).toLocaleString('zh-CN'));
        
        const logType = escapeHtml(log.type || 'unknown');
        const userId = escapeHtml(log.userId || '-');
        const channel = escapeHtml(log.channel || '-');
        
        let content = '';
        if (logType === 'chat') {
            content = log.content || '';
            if (log.messageType === 'image') {
                content = '[图片消息] ' + content;
            } else if (log.messageType === 'voice') {
                content = '[语音消息] ' + content;
            }
        } else {
            content = log.message || log.content || '';
        }
        
        // 清理和截断内容
        const safeContent = escapeHtml(content);
        const truncatedContent = safeContent.length > 100 ? safeContent.substring(0, 100) + '...' : safeContent;
        
        // 清理详细信息
        const details = escapeHtml(JSON.stringify(log, null, 2));
        
        return `
            <div style="display: flex; justify-content: space-between; padding: 10px 15px; border-bottom: 1px solid #dee2e6; font-size: 14px; align-items: flex-start;">
                <div style="width: 15%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${time}</div>
                <div style="width: 10%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${logType}</div>
                <div style="width: 15%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userId}</div>
                <div style="width: 10%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${channel}</div>
                <div style="width: 40%; overflow: hidden; text-overflow: ellipsis; word-break: break-all;">${truncatedContent}</div>
                <div style="width: 10%; text-align: center;">
                    <button onclick="showLogDetails('${details.replace(/'/g, "\\'")}')" style="background: none; border: none; color: #007bff; cursor: pointer; font-size: 12px; padding: 0;">
                        查看
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 显示日志详细信息
function showLogDetails(details) {
    // 使用alert显示详细信息
    alert(details);
}

// 更新分页信息
function updatePagination() {
    logTotal.textContent = currentLogState.total;
    logCurrentPage.textContent = currentLogState.page;
    logTotalPages.textContent = currentLogState.totalPages;
    
    // 禁用/启用分页按钮
    logPrevPage.disabled = currentLogState.page === 1;
    logNextPage.disabled = currentLogState.page === currentLogState.totalPages;
}

// 切换到上一页
function goToPrevPage() {
    if (currentLogState.page > 1) {
        currentLogState.page--;
        searchLogs();
    }
}

// 切换到下一页
function goToNextPage() {
    if (currentLogState.page < currentLogState.totalPages) {
        currentLogState.page++;
        searchLogs();
    }
}

// 初始化日志管理功能
function initLogManagement() {
    // 加载日志文件列表
    loadLogFiles();
    
    // 添加事件监听器
    logSearchBtn.addEventListener('click', searchLogs);
    logPrevPage.addEventListener('click', goToPrevPage);
    logNextPage.addEventListener('click', goToNextPage);
    
    // 按回车键搜索
    logSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchLogs();
        }
    });
    
    // 当选择不同的日志文件时，重置分页并搜索
    logFileSelect.addEventListener('change', () => {
        currentLogState.page = 1;
        searchLogs();
    });
}

// 在页面加载完成后初始化日志管理功能
window.addEventListener('DOMContentLoaded', () => {
    initLogManagement();
});