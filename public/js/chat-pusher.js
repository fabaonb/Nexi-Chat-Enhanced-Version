// ============ Pusher 配置 ============
const currentUser = checkLogin();
if (!currentUser) {
    window.location.href = 'login.html';
}

// 从后端获取 Pusher 配置
let pusher = null;

async function initializePusher() {
    try {
        const response = await fetch('/api/pusher/config');
        const config = await response.json();
        
        // 初始化 Pusher（只使用公开的 Key）
        pusher = new Pusher(config.key, {
            cluster: config.cluster,
            authEndpoint: '/api/pusher/auth',
            auth: {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            }
        });

        console.log('Pusher 初始化成功');

        // Pusher 连接状态监听
        pusher.connection.bind('connected', () => {
            console.log('Pusher 连接成功');
        });

        pusher.connection.bind('disconnected', () => {
            console.log('Pusher 连接断开');
            showNotification('网络连接已断开，正在尝试重新连接...', 'warning');
        });

        pusher.connection.bind('error', (error) => {
            console.error('Pusher 连接错误:', error);
            showNotification('连接服务器时出错', 'error');
        });

        pusher.connection.bind('state_change', (states) => {
            console.log('Pusher 状态变化:', states.previous, '->', states.current);
            if (states.current === 'connected' && states.previous === 'connecting') {
                showNotification('网络连接已恢复', 'success');
            }
        });
        
        return true;
    } catch (error) {
        console.error('初始化 Pusher 失败:', error);
        showNotification('初始化连接失败', 'error');
        return false;
    }
}

let currentChannel = '';
let currentPusherChannel = null; // 当前订阅的 Pusher 频道

let currentReplyTo = null;

let hasMicrophone = false;
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let isRecordingTimeout = false;
const MAX_RECORDING_DURATION = 60;

async function checkMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        hasMicrophone = true;
        stream.getTracks().forEach(track => track.stop());
        console.log('麦克风检测成功');
    } catch (error) {
        hasMicrophone = false;
        console.log('麦克风检测失败:', error);
    }
    return hasMicrophone;
}

async function startRecording() {
    try {
        console.log('浏览器API支持情况:');
        console.log('navigator.mediaDevices:', navigator.mediaDevices);
        console.log('navigator.mediaDevices.getUserMedia:', navigator.mediaDevices ? navigator.mediaDevices.getUserMedia : '未定义');
        console.log('window.MediaRecorder:', window.MediaRecorder);
        
        if (!navigator.mediaDevices) {
            console.error('不支持 navigator.mediaDevices API');
            showNotification('您的浏览器不支持语音录制功能，请升级到最新版本', 'error');
            return;
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            console.error('不支持 navigator.mediaDevices.getUserMedia API');
            showNotification('您的浏览器不支持语音录制功能，请升级到最新版本', 'error');
            return;
        }
        
        if (!window.MediaRecorder) {
            console.error('不支持 window.MediaRecorder API');
            showNotification('您的浏览器不支持语音录制功能，请升级到最新版本', 'error');
            return;
        }
        
        if (typeof MediaRecorder.isTypeSupported !== 'function') {
            console.warn('浏览器不支持MediaRecorder.isTypeSupported方法，将使用默认MIME类型');
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let mimeType = 'audio/webm;codecs=opus';
        const supportedMimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];
        
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            for (const type of supportedMimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    console.log('使用支持的MIME类型:', mimeType);
                    break;
                }
            }
        } else {
            console.log('使用默认MIME类型:', mimeType);
        }
        
        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType });
        } catch (error) {
            console.warn('使用指定MIME类型失败，使用默认设置:', error);
            mediaRecorder = new MediaRecorder(stream);
        }
        
        mediaRecorder._stream = stream;
        
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            console.log('MediaRecorder stop event triggered');
            if (mediaRecorder._stream) {
                mediaRecorder._stream.getTracks().forEach(track => track.stop());
                console.log('释放麦克风资源');
            }
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.remove('recording');
            voiceBtn.textContent = '🎤';
            if (isRecordingTimeout) {
                showNotification('录制已达最大时长60秒，已自动停止', 'info');
                isRecordingTimeout = false;
            }
            if (audioChunks.length > 0) {
                processRecordedAudio();
            }
        };
        
        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder错误:', event.error);
            showNotification('录制过程中发生错误', 'error');
            stopRecording();
        };
        
        mediaRecorder.start();
        console.log('开始录制语音');
        
        recordingTimer = setTimeout(() => {
            console.log('录制时长已达60秒，自动停止');
            isRecordingTimeout = true;
            stopRecording();
        }, MAX_RECORDING_DURATION * 1000);
        
        const voiceBtn = document.getElementById('voiceBtn');
        voiceBtn.classList.add('recording');
        voiceBtn.textContent = '⏺️';
        
    } catch (error) {
        console.error('录制语音失败:', error);
        if (error.name === 'NotAllowedError') {
            showNotification('请允许访问麦克风', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('未找到麦克风设备', 'error');
        } else if (error.name === 'NotReadableError') {
            showNotification('麦克风被占用', 'error');
        } else {
            showNotification('无法开始录制语音', 'error');
        }
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log('停止录制语音');
    }
    if (recordingTimer) {
        clearTimeout(recordingTimer);
        recordingTimer = null;
    }
}

async function isAudioSilent(audioBlob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.decodeAudioData(e.target.result, (buffer) => {
                const channelData = buffer.getChannelData(0);
                
                let sum = 0;
                for (let i = 0; i < channelData.length; i++) {
                    sum += Math.abs(channelData[i]);
                }
                const average = sum / channelData.length;
                
                const silenceThreshold = 0.01;
                resolve(average < silenceThreshold);
            }, () => {
                resolve(false);
            });
        };
        reader.readAsArrayBuffer(audioBlob);
    });
}

async function processRecordedAudio() {
    try {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        
        const isSilent = await isAudioSilent(audioBlob);
        if (isSilent) {
            showNotification('未检测到声音，请重新录制', 'warning');
            return;
        }
        
        await sendVoiceMessage(audioBlob);
        
    } catch (error) {
        console.error('处理音频失败:', error);
        showNotification('处理语音消息失败', 'error');
    }
}

async function sendVoiceMessage(audioBlob) {
    try {
        uploadProgress.textContent = '上传中...';
        
        let fileExtension = 'webm';
        if (audioBlob.type.includes('ogg')) {
            fileExtension = 'ogg';
        }
        
        const formData = new FormData();
        formData.append('voice', audioBlob, `voice.${fileExtension}`);
        formData.append('userId', currentUser.id);
        
        const response = await fetch('/api/upload/voice', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // 使用 Pusher API 发送消息
            await sendMessageViaPusher({
                userId: currentUser.id,
                channel: currentChannel,
                content: null,
                voice: data.voice,
                reply_to: currentReplyTo
            });
            
            uploadProgress.textContent = '上传成功';
            setTimeout(() => {
                uploadProgress.textContent = '';
            }, 1000);
            
            cancelReply();
        } else {
            uploadProgress.textContent = '上传失败';
            setTimeout(() => {
                uploadProgress.textContent = '';
            }, 1000);
        }
    } catch (error) {
        console.error('发送语音消息失败:', error);
        showNotification('发送语音消息失败', 'error');
        uploadProgress.textContent = '上传失败';
        setTimeout(() => {
            uploadProgress.textContent = '';
        }, 1000);
    }
}

// ============ Pusher 消息发送函数 ============
async function sendMessageViaPusher(messageData) {
    try {
        const response = await fetch('/api/pusher/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(messageData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '发送消息失败');
        }
        
        console.log('消息发送成功:', result);
        
    } catch (error) {
        console.error('发送消息失败:', error);
        showNotification('发送消息失败: ' + error.message, 'error');
    }
}

let notificationSettings = {
    soundEnabled: true,
    selectedChannels: ['General', 'Technology', 'Gaming', 'Music', 'Random', 'Channel105']
};

function loadNotificationSettings() {
    console.log('=== loadNotificationSettings 函数被调用 ===');
    console.log('当前时间:', new Date().toISOString());
    
    const savedSettings = localStorage.getItem('notificationSettings');
    console.log('从本地存储获取的设置:', savedSettings);
    
    if (savedSettings) {
        try {
            notificationSettings = JSON.parse(savedSettings);
            console.log('成功从本地存储加载设置:', JSON.stringify(notificationSettings));
            
            if (notificationSettings.soundEnabled === undefined) {
                console.log('soundEnabled 未定义，设置默认值为 true');
                notificationSettings.soundEnabled = true;
            }
            
            if (!Array.isArray(notificationSettings.selectedChannels)) {
                console.log('selectedChannels 不是数组，设置默认值');
                notificationSettings.selectedChannels = ['General', 'Technology', 'Gaming', 'Music', 'Random', 'Channel105'];
            }
            
            saveNotificationSettings();
        } catch (error) {
            console.error('加载通知设置失败:', error);
            console.log('使用默认设置');
            notificationSettings = {
                soundEnabled: true,
                selectedChannels: ['General', 'Technology', 'Gaming', 'Music', 'Random', 'Channel105']
            };
            saveNotificationSettings();
        }
    } else {
        console.log('本地存储中没有设置，使用默认值并保存');
        notificationSettings = {
            soundEnabled: true,
            selectedChannels: ['General', 'Technology', 'Gaming', 'Music', 'Random', 'Channel105']
        };
        saveNotificationSettings();
    }
    
    updateNotificationSettingsUI();
    
    console.log('当前 notificationSettings:', JSON.stringify(notificationSettings));
}

let notificationAudio = null;

function initNotificationAudio() {
    try {
        const audioPath = 'audio/ts.mp3';
        notificationAudio = new Audio(audioPath);
        notificationAudio.volume = 1.0;
        notificationAudio.preload = 'auto';
        
        notificationAudio.loop = false;
        
        notificationAudio.addEventListener('loadeddata', () => {
            console.log('提示音音频加载完成');
        });
        
        notificationAudio.addEventListener('error', (e) => {
            console.error('提示音音频加载错误:', e);
            console.error('错误代码:', e.target.error.code);
            notificationAudio = null;
        });
        
        console.log('提示音音频对象初始化成功');
    } catch (error) {
        console.error('初始化提示音音频对象失败:', error);
        notificationAudio = null;
    }
}

function playNotificationSound() {
    console.log('=== playNotificationSound 函数被调用 ===');
    console.log('当前时间:', new Date().toISOString());
    console.log('notificationSettings 对象:', JSON.stringify(notificationSettings));
    console.log('soundEnabled 状态:', notificationSettings.soundEnabled);
    
    if (!notificationSettings.soundEnabled) {
        console.log('提示音未启用，不播放');
        return;
    }
    
    try {
        if (!notificationAudio) {
            console.log('音频对象不存在，立即初始化');
            initNotificationAudio();
        }
        
        if (notificationAudio) {
            notificationAudio.currentTime = 0;
            
            console.log('正在尝试播放音频');
            notificationAudio.play().then(() => {
                console.log('音频播放成功！');
            }).catch(error => {
                console.error('播放提示音失败:', error);
                console.error('错误类型:', error.name);
                console.error('错误消息:', error.message);
                
                if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
                    console.log('浏览器阻止了自动播放，请求用户交互');
                    showNotification('请先与页面交互以启用通知声音', 'info');
                } else if (error.name === 'NetworkError') {
                    console.error('网络错误导致音频无法加载');
                    showNotification('音频文件加载失败，请检查网络连接', 'error');
                    notificationAudio = null;
                } else if (error.name === 'AbortError') {
                    console.error('音频播放被中止');
                }
            });
        }
    } catch (error) {
        console.error('播放提示音时发生错误:', error);
        notificationAudio = null;
    }
}

function preloadAudioAndRequestPermission() {
    try {
        initNotificationAudio();
        
        if (notificationAudio) {
            notificationAudio.volume = 0;
            
            notificationAudio.play().then(() => {
                console.log('获得音频播放权限');
                notificationAudio.pause();
                notificationAudio.currentTime = 0;
                notificationAudio.volume = 1.0;
            }).catch(error => {
                console.log('需要用户交互来获得音频播放权限:', error.message);
                notificationAudio.volume = 1.0;
            });
        }
        
        console.log('音频预加载完成');
    } catch (error) {
        console.error('预加载音频失败:', error);
    }
}

function showBrowserNotification(title, message) {
    if (!('Notification' in window)) {
        console.log('浏览器不支持通知功能');
        return;
    }
    
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: 'images/logo.png',
            requireInteraction: false,
            tag: 'chat-notification'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: 'images/logo.png',
                    requireInteraction: false,
                    tag: 'chat-notification'
                });
            }
        });
    }
}

function saveNotificationSettings() {
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
}

function updateNotificationSettingsUI() {
    const notificationSoundCheckbox = document.getElementById('notificationSound');
    if (notificationSoundCheckbox) {
        notificationSoundCheckbox.checked = notificationSettings.soundEnabled;
    }
    
    const channelCheckboxes = document.querySelectorAll('.channel-notification-item input[type="checkbox"]');
    channelCheckboxes.forEach(checkbox => {
        checkbox.checked = notificationSettings.selectedChannels.includes(checkbox.value);
    });
}

// DOM 元素
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageUpload = document.getElementById('imageUpload');
const uploadProgress = document.getElementById('uploadProgress');
const channelItems = document.querySelectorAll('.channel-item');
const currentChannelName = document.getElementById('currentChannelName');
const currentChannelIcon = document.getElementById('currentChannelIcon');
const settingsBtn = document.getElementById('settingsBtn');
const closeSettings = document.getElementById('closeSettings');
const settingsPanel = document.getElementById('settingsPanel');
const userAvatar = document.getElementById('userAvatar');
const username = document.getElementById('username');
const userBio = document.getElementById('userBio');
const logoutBtn = document.getElementById('logoutBtn');
const avatarInput = document.getElementById('avatarInput');
const avatarPreview = document.getElementById('avatarPreview');
const settingsUsername = document.getElementById('settingsUsername');
const settingsNickname = document.getElementById('settingsNickname');
const settingsBio = document.getElementById('settingsBio');
const settingsGender = document.getElementById('settingsGender');
const settingsEmail = document.getElementById('settingsEmail');
const saveSettings = document.getElementById('saveSettings');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.querySelector('.emoji-grid');

const changePasswordBtn = document.getElementById('changePasswordBtn');
const passwordChangePanel = document.getElementById('passwordChangePanel');
const closePasswordPanel = document.getElementById('closePasswordPanel');
const cancelPasswordChange = document.getElementById('cancelPasswordChange');
const passwordChangeForm = document.getElementById('passwordChangeForm');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');

console.log('密码更改相关DOM元素获取结果:');
console.log('changePasswordBtn:', changePasswordBtn);
console.log('passwordChangePanel:', passwordChangePanel);
console.log('closePasswordPanel:', closePasswordPanel);
console.log('cancelPasswordChange:', cancelPasswordChange);
console.log('passwordChangeForm:', passwordChangeForm);

console.log('DOM元素获取结果:');
console.log('settingsPanel:', settingsPanel);
console.log('closeSettings:', closeSettings);
console.log('settingsBtn:', settingsBtn);

function showNotification(message, type = 'info', duration = 3000) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `<p class="message">${message}</p>`;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}


// ============ Pusher 频道订阅和消息处理 ============

function subscribeToPusherChannel(channelName) {
    // 取消订阅之前的频道
    if (currentPusherChannel) {
        currentPusherChannel.unbind_all();
        pusher.unsubscribe(currentPusherChannel.name);
        console.log('取消订阅频道:', currentPusherChannel.name);
    }
    
    // 订阅新频道（使用 presence 频道以支持在线状态）
    const pusherChannelName = `presence-${channelName}`;
    currentPusherChannel = pusher.subscribe(pusherChannelName);
    
    console.log('订阅 Pusher 频道:', pusherChannelName);
    
    // 监听订阅成功事件
    currentPusherChannel.bind('pusher:subscription_succeeded', (members) => {
        console.log('频道订阅成功:', pusherChannelName);
        console.log('当前在线成员数:', members.count);
    });
    
    // 监听订阅错误
    currentPusherChannel.bind('pusher:subscription_error', (error) => {
        console.error('频道订阅失败:', error);
        showNotification('加入频道失败，请检查权限', 'error');
    });
    
    // 监听新消息
    currentPusherChannel.bind('message-received', (data) => {
        console.log('收到新消息:', data);
        addMessageToDOM(data);
        
        // 播放提示音（如果不是自己发送的消息）
        if (data.user_id !== currentUser.id && notificationSettings.selectedChannels.includes(channelName)) {
            playNotificationSound();
            showBrowserNotification('新消息', `${data.nickname}: ${data.content || '[图片/语音]'}`);
        }
    });
    
    // 监听消息被屏蔽
    currentPusherChannel.bind('message-blocked', (data) => {
        console.log('消息被屏蔽:', data);
        showNotification(data.reason, 'warning');
    });
    
    // 监听消息撤回
    currentPusherChannel.bind('message-recalled', (data) => {
        console.log('消息被撤回:', data);
        updateRecalledMessage(data);
    });
    
    // 监听消息删除
    currentPusherChannel.bind('message-deleted', (data) => {
        console.log('消息被删除:', data);
        removeMessageFromDOM(data.messageId);
    });
    
    // 监听成员加入
    currentPusherChannel.bind('pusher:member_added', (member) => {
        console.log('成员加入:', member);
    });
    
    // 监听成员离开
    currentPusherChannel.bind('pusher:member_removed', (member) => {
        console.log('成员离开:', member);
    });
}

function updateRecalledMessage(data) {
    const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
    if (messageElement) {
        const messageText = messageElement.querySelector('.message-text');
        if (messageText) {
            messageText.textContent = data.content;
            messageText.style.fontStyle = 'italic';
            messageText.style.color = '#999';
        }
        
        // 移除图片和语音
        const messageImage = messageElement.querySelector('.message-image');
        if (messageImage) messageImage.remove();
        
        const messageVoice = messageElement.querySelector('.message-voice');
        if (messageVoice) messageVoice.remove();
        
        // 移除撤回按钮
        const recallBtn = messageElement.querySelector('.recall-btn');
        if (recallBtn) recallBtn.remove();
    }
}

function removeMessageFromDOM(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
}

function initPage() {
    settingsPanel.classList.remove('open');
    
    updateUserInfo();
    
    preloadAudioAndRequestPermission();
    
    messagesContainer.innerHTML = `
        <div style="
            text-align: center;
            padding: 80px 30px;
            color: #6e6e73;
            font-size: 24px;
            font-weight: 600;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 10px;
            background: linear-gradient(135deg, rgba(240,242,245,0.5) 0%, rgba(255,255,255,1) 100%);
        ">
            <div style="
                position: relative;
                display: inline-block;
            ">
                <img id="emptyPageImage" 
                    src="images/logo2.png" 
                    alt="NEXI CHAT Logo" 
                    style="
                        width: 300px;
                        height: 300px;
                        object-fit: contain;
                        display: block;
                        visibility: visible;
                        opacity: 1;
                        border: none;
                        outline: none;
                        box-shadow: none;
                        background: transparent;
                    "
                >
                <div style="
                    content: '';
                    position: absolute;
                    top: 40%;
                    left: 0;
                    width: 100%;
                    height: 80%;
                    background-image: url('images/logo2.png');
                    background-size: contain;
                    background-repeat: no-repeat;
                    background-position: center;
                    transform: scaleY(-1);
                    opacity: 0.8;
                    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
                    -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
                    animation: reflectionFadeIn 1.5s ease-out forwards;
                "></div>
            </div>
            <style>
                @keyframes reflectionFadeIn {
                    0% {
                        top: 0%;
                        height: 100%;
                        opacity: 0;
                    }
                    100% {
                        top: 40%;
                        height: 80%;
                        opacity: 0.8;
                    }
                }
            </style>
            <div style="
                max-width: 400px;
                line-height: 1.6;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="font-size: 34px; color: #333; font-weight: 700; letter-spacing: -0.5px;">欢迎使用 NEXI CHAT</div>
                <div style="margin-top: 10px; font-size: 18px; color: #8e8e93; font-weight: 400;">请从左侧选择一个频道开始聊天</div>
            </div>
        </div>
    `;
    
    currentChannelName.textContent = '请选择频道';
    currentChannelIcon.textContent = '';
    
    const messageInputContainer = document.querySelector('.message-input-container');
    messageInputContainer.style.display = 'none';
    
    loadNotificationSettings();
    
    setupNotificationEventListeners();
    
    setupVoiceButtonEventListeners();
}

function setupNotificationEventListeners() {
    const notificationSoundCheckbox = document.getElementById('notificationSound');
    if (notificationSoundCheckbox) {
        notificationSoundCheckbox.addEventListener('change', (e) => {
            notificationSettings.soundEnabled = e.target.checked;
            saveNotificationSettings();
        });
    }
    
    const channelCheckboxes = document.querySelectorAll('.channel-notification-item input[type="checkbox"]');
    channelCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const channel = e.target.value;
            if (e.target.checked) {
                if (!notificationSettings.selectedChannels.includes(channel)) {
                    notificationSettings.selectedChannels.push(channel);
                }
            } else {
                notificationSettings.selectedChannels = notificationSettings.selectedChannels.filter(c => c !== channel);
            }
            saveNotificationSettings();
        });
    });
}

function setupVoiceButtonEventListeners() {
    const voiceBtn = document.getElementById('voiceBtn');
    if (!voiceBtn) return;
    
    voiceBtn.addEventListener('mousedown', async (e) => {
        e.preventDefault();
        try {
            await startRecording();
        } catch (error) {
            console.error('录制失败:', error);
            showNotification('无法开始录制，请检查麦克风权限', 'error');
        }
    });
    
    voiceBtn.addEventListener('mouseup', () => {
        stopRecording();
    });
    
    voiceBtn.addEventListener('mouseleave', () => {
        stopRecording();
    });
    
    voiceBtn.addEventListener('touchstart', async (e) => {
        e.preventDefault();
        try {
            await startRecording();
        } catch (error) {
            console.error('录制失败:', error);
            showNotification('无法开始录制，请检查麦克风权限', 'error');
        }
    });
    
    voiceBtn.addEventListener('touchend', () => {
        stopRecording();
    });
}

function updateUserInfo() {
    if (!currentUser) {
        console.error('currentUser is not defined');
        return;
    }
    
    if (username) {
        username.textContent = currentUser.nickname || currentUser.username;
    }
    
    if (userBio) {
        userBio.textContent = currentUser.bio ? currentUser.bio : '这个人很懒，什么也没留下';
    }
    
    if (userAvatar) {
        const avatarUrl = currentUser.avatar || 'images/default.png';
        userAvatar.src = avatarUrl;
    }
    
    if (settingsUsername) {
        settingsUsername.value = currentUser.username;
    }
    if (settingsNickname) {
        settingsNickname.value = currentUser.nickname || currentUser.username;
    }
    if (settingsBio) {
        settingsBio.value = currentUser.bio || '';
    }
    if (settingsGender) {
        settingsGender.value = currentUser.gender || 'other';
    }
    if (settingsEmail) {
        settingsEmail.value = currentUser.email || '';
    }
    if (avatarPreview) {
        const avatarUrl = currentUser.avatar || 'images/default.png';
        avatarPreview.src = avatarUrl;
    }
    
    console.log('User info updated:', {
        username: currentUser.username,
        bio: currentUser.bio,
        avatar: currentUser.avatar,
        gender: currentUser.gender
    });
}


// ============ 消息显示和处理 ============

function addMessageToDOM(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.user_id === currentUser.id ? 'sent' : 'received'}`;
    messageElement.dataset.messageId = message.id;
    
    const isCurrentUser = message.user_id === currentUser.id;
    const now = new Date();
    const messageTime = new Date(message.created_at);
    const timeDiff = (now - messageTime) / (1000 * 60);
    
    const messageAvatar = message.avatar || 'images/default.png';
    let messageContent = `
        <div class="avatar-container">
            <img src="${messageAvatar}" alt="Avatar" class="avatar" onclick="openUserProfile(${message.user_id})">
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${message.nickname || message.username}</span>
            </div>
    `;
    
    if (message.reply_info) {
        const repliedContent = message.reply_info.content || '图片消息';
        messageContent += `<div class="message-reply" style="
            background-color: rgba(0, 113, 227, 0.05);
            border-left: 3px solid #0071e3;
            padding: 6px 10px;
            border-radius: 8px;
            margin-bottom: 6px;
            font-size: 13px;
        ">
            <span style="font-weight: bold; color: #0071e3;">@${message.reply_info.nickname || message.reply_info.username}</span>: ${repliedContent.length > 30 ? repliedContent.substring(0, 30) + '...' : repliedContent}
        </div>`;
    }
    
    if (message.content) {
        messageContent += `<div class="message-text">${message.content}</div>`;
    }
    
    if (message.image && !message.is_recalled) {
        messageContent += `<img src="${message.image}" alt="Chat image" class="message-image" onclick="viewImage(this)">`;
    }
    
    if (message.voice && !message.is_recalled) {
        const audioType = message.voice.endsWith('.ogg') ? 'audio/ogg' : 'audio/webm;codecs=opus';
        messageContent += `<div class="message-voice bubble">
            <div class="custom-audio-player" data-message-id="${message.id}">
                <audio id="audio-${message.id}" class="voice-player" preload="metadata">
                    <source src="${message.voice}" type="${audioType}">
                    您的浏览器不支持音频播放
                </audio>
                <div class="audio-controls">
                    <button class="play-btn" data-audio-id="${message.id}">
                        <span class="play-icon">▶</span>
                        <span class="pause-icon">⏸</span>
                    </button>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    <div class="time-display">
                        <span class="current-time">0:00</span>
                    </div>
                </div>
            </div>
        </div>`;
    }
    
    const actionButtons = [];
    
    actionButtons.push(`<button class="reply-btn" data-message-id="${message.id}" style="
        background: none;
        border: none;
        color: #0071e3;
        font-size: 14px;
        cursor: pointer;
        margin-top: 5px;
        padding: 2px 6px;
        border-radius: 10px;
        transition: all 0.3s ease;
        opacity: 0.7;
    ">💬</button>`);
    
    if (isCurrentUser && timeDiff <= 2 && !message.is_recalled) {
        actionButtons.push(`<button class="recall-btn" data-message-id="${message.id}" data-channel="${message.channel}" style="
            background: none;
            border: none;
            color: #ff3b30;
            font-size: 14px;
            cursor: pointer;
            margin-top: 5px;
            padding: 2px 6px;
            border-radius: 10px;
            transition: all 0.3s ease;
            opacity: 0.7;
        ">撤回</button>`);
    }
    
    if (actionButtons.length > 0) {
        messageContent += `<div class="message-actions">${actionButtons.join('')}</div>`;
    }
    
    messageContent += `</div>`;
    messageElement.innerHTML = messageContent;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // 绑定回复按钮事件
    const replyBtn = messageElement.querySelector('.reply-btn');
    if (replyBtn) {
        replyBtn.addEventListener('click', () => {
            replyToMessage(message.id, message.nickname || message.username, message.content || '[图片/语音]');
        });
    }
    
    // 绑定撤回按钮事件
    const recallBtn = messageElement.querySelector('.recall-btn');
    if (recallBtn) {
        recallBtn.addEventListener('click', async () => {
            await recallMessage(message.id, message.channel);
        });
    }
    
    // 绑定音频播放器事件
    const playBtn = messageElement.querySelector('.play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            toggleAudioPlayback(message.id);
        });
    }
}

function replyToMessage(messageId, username, content) {
    currentReplyTo = messageId;
    
    const replyIndicator = document.getElementById('replyIndicator');
    if (replyIndicator) {
        replyIndicator.style.display = 'flex';
        replyIndicator.querySelector('.reply-to-text').textContent = `回复 @${username}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`;
    }
    
    messageInput.focus();
}

function cancelReply() {
    currentReplyTo = null;
    const replyIndicator = document.getElementById('replyIndicator');
    if (replyIndicator) {
        replyIndicator.style.display = 'none';
    }
}

async function recallMessage(messageId, channel) {
    try {
        const response = await fetch('/api/pusher/recall-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ messageId, channel })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '撤回失败');
        }
        
        showNotification('消息已撤回', 'success');
        
    } catch (error) {
        console.error('撤回消息失败:', error);
        showNotification(error.message, 'error');
    }
}

function toggleAudioPlayback(audioId) {
    const audio = document.getElementById(`audio-${audioId}`);
    const playBtn = document.querySelector(`[data-audio-id="${audioId}"]`);
    
    if (!audio || !playBtn) return;
    
    if (audio.paused) {
        audio.play();
        playBtn.classList.add('playing');
    } else {
        audio.pause();
        playBtn.classList.remove('playing');
    }
    
    audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        const progressFill = playBtn.closest('.custom-audio-player').querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        const currentTimeDisplay = playBtn.closest('.custom-audio-player').querySelector('.current-time');
        if (currentTimeDisplay) {
            const minutes = Math.floor(audio.currentTime / 60);
            const seconds = Math.floor(audio.currentTime % 60);
            currentTimeDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    });
    
    audio.addEventListener('ended', () => {
        playBtn.classList.remove('playing');
        const progressFill = playBtn.closest('.custom-audio-player').querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }
    });
}

function viewImage(imgElement) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = imgElement.src;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
    `;
    
    modal.appendChild(img);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function openUserProfile(userId) {
    fetch(`/api/profile/${userId}`)
        .then(response => response.json())
        .then(user => {
            const modal = document.createElement('div');
            modal.className = 'user-profile-modal';
            modal.innerHTML = `
                <div class="user-profile-content">
                    <button class="close-profile-btn">×</button>
                    <img src="${user.avatar || 'images/default.png'}" alt="Avatar" class="profile-avatar">
                    <h2>${user.nickname || user.username}</h2>
                    <p class="profile-username">@${user.username}</p>
                    <p class="profile-bio">${user.bio || '这个人很懒，什么也没留下'}</p>
                    <div class="profile-info">
                        <p><strong>性别:</strong> ${user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : '其他'}</p>
                        <p><strong>邮箱:</strong> ${user.email || '未设置'}</p>
                        <p><strong>加入时间:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('.close-profile-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });
        })
        .catch(error => {
            console.error('获取用户资料失败:', error);
            showNotification('获取用户资料失败', 'error');
        });
}

// ============ 频道切换 ============

channelItems.forEach(item => {
    item.addEventListener('click', async () => {
        const channel = item.dataset.channel;
        const channelIcon = item.querySelector('.channel-icon').textContent;
        const channelName = item.querySelector('.channel-name').textContent;
        
        // 检查私有频道访问权限
        if (channel === 'Channel105') {
            try {
                const response = await fetch(`/api/channel/${channel}/access/${currentUser.id}`);
                const data = await response.json();
                
                if (!data.hasAccess) {
                    const password = prompt('请输入频道密码:');
                    if (!password) return;
                    
                    const verifyResponse = await fetch('/api/channel/verify-password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            channel,
                            password,
                            userId: currentUser.id
                        })
                    });
                    
                    const verifyData = await verifyResponse.json();
                    
                    if (!verifyResponse.ok) {
                        showNotification(verifyData.error || '密码错误', 'error');
                        return;
                    }
                }
            } catch (error) {
                console.error('验证频道访问权限失败:', error);
                showNotification('验证频道访问权限失败', 'error');
                return;
            }
        }
        
        // 切换频道
        currentChannel = channel;
        currentChannelName.textContent = channelName;
        currentChannelIcon.textContent = channelIcon;
        
        // 更新频道选中状态
        channelItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // 显示消息输入区域
        const messageInputContainer = document.querySelector('.message-input-container');
        messageInputContainer.style.display = 'flex';
        
        // 清空消息容器
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">加载中...</div>';
        
        // 订阅 Pusher 频道
        subscribeToPusherChannel(channel);
        
        // 加载历史消息
        await loadMessages(channel);
    });
});

async function loadMessages(channel) {
    try {
        const response = await fetch(`/api/messages/${channel}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const messages = await response.json();
        
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">暂无消息</div>';
        } else {
            messages.forEach(message => {
                addMessageToDOM(message);
            });
        }
        
    } catch (error) {
        console.error('加载消息失败:', error);
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #f00;">加载消息失败</div>';
    }
}

// ============ 发送消息 ============

sendBtn.addEventListener('click', async () => {
    const content = messageInput.value.trim();
    
    if (!content && !currentReplyTo) {
        return;
    }
    
    if (!currentChannel) {
        showNotification('请先选择一个频道', 'warning');
        return;
    }
    
    await sendMessageViaPusher({
        userId: currentUser.id,
        channel: currentChannel,
        content: content,
        image: null,
        voice: null,
        reply_to: currentReplyTo
    });
    
    messageInput.value = '';
    cancelReply();
});

messageInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// ============ 图片上传 ============

imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!currentChannel) {
        showNotification('请先选择一个频道', 'warning');
        return;
    }
    
    uploadProgress.textContent = '上传中...';
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            await sendMessageViaPusher({
                userId: currentUser.id,
                channel: currentChannel,
                content: messageInput.value.trim() || null,
                image: data.image,
                voice: null,
                reply_to: currentReplyTo
            });
            
            messageInput.value = '';
            cancelReply();
            uploadProgress.textContent = '上传成功';
        } else {
            uploadProgress.textContent = '上传失败';
        }
    } catch (error) {
        console.error('上传图片失败:', error);
        uploadProgress.textContent = '上传失败';
    }
    
    setTimeout(() => {
        uploadProgress.textContent = '';
    }, 2000);
    
    imageUpload.value = '';
});

// ============ 设置面板 ============

settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.add('open');
});

closeSettings.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
});

logoutBtn.addEventListener('click', () => {
    if (confirm('确定要退出登录吗？')) {
        logout();
    }
});

avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', currentUser.id);
    
    try {
        const response = await fetch('/api/upload/avatar', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser.avatar = data.avatar;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateUserInfo();
            showNotification('头像更新成功', 'success');
        } else {
            showNotification('头像更新失败', 'error');
        }
    } catch (error) {
        console.error('上传头像失败:', error);
        showNotification('上传头像失败', 'error');
    }
});

saveSettings.addEventListener('click', async () => {
    const bio = settingsBio.value;
    const gender = settingsGender.value;
    const email = settingsEmail.value;
    const nickname = settingsNickname.value;
    
    try {
        const response = await fetch(`/api/profile/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ bio, gender, email, nickname })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser.bio = bio;
            currentUser.gender = gender;
            currentUser.email = email;
            currentUser.nickname = nickname;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateUserInfo();
            showNotification('设置保存成功', 'success');
        } else {
            showNotification(data.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存设置失败:', error);
        showNotification('保存设置失败', 'error');
    }
});

// ============ 密码修改 ============

if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
        passwordChangePanel.classList.add('open');
    });
}

if (closePasswordPanel) {
    closePasswordPanel.addEventListener('click', () => {
        passwordChangePanel.classList.remove('open');
    });
}

if (cancelPasswordChange) {
    cancelPasswordChange.addEventListener('click', () => {
        passwordChangePanel.classList.remove('open');
    });
}

if (passwordChangeForm) {
    passwordChangeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const current = currentPassword.value;
        const newPass = newPassword.value;
        const confirm = confirmPassword.value;
        
        if (newPass !== confirm) {
            showNotification('两次输入的密码不一致', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword: current,
                    newPassword: newPass
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('密码修改成功', 'success');
                passwordChangePanel.classList.remove('open');
                passwordChangeForm.reset();
            } else {
                showNotification(data.error || '密码修改失败', 'error');
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            showNotification('修改密码失败', 'error');
        }
    });
}

// ============ Emoji 选择器 ============

function initEmojiPicker() {
    if (!emojiBtn || !emojiPicker || !emojiGrid) return;
    
    // 常用emoji列表
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
        '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
        '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
        '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
        '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
        '🤢', '🤮', '🤧', '🥵', '🥶', '😵', '🤯', '🤠',
        '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
        '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
        '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
        '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
        '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
        '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
        '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
        '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️',
        '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉'
    ];
    
    // 填充emoji网格
    emojiGrid.innerHTML = emojis.map(emoji => 
        `<span class="emoji-item">${emoji}</span>`
    ).join('');
    
    // 点击emoji按钮显示/隐藏选择器
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('show');
    });
    
    // 点击emoji插入到输入框
    emojiGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('emoji-item')) {
            const emoji = e.target.textContent;
            messageInput.value += emoji;
            messageInput.focus();
            emojiPicker.classList.remove('show');
        }
    });
    
    // 点击其他地方关闭emoji选择器
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.remove('show');
        }
    });
}

// ============ 回复功能 ============

function initReplyFeature() {
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');
    if (cancelReplyBtn) {
        cancelReplyBtn.addEventListener('click', cancelReply);
    }
}

// ============ 初始化 ============

window.addEventListener('DOMContentLoaded', async () => {
    // 初始化 Pusher 连接
    const pusherInitialized = await initializePusher();
    if (!pusherInitialized) {
        showNotification('无法连接到服务器，请刷新页面重试', 'error');
        return;
    }
    
    // 初始化页面
    initPage();
    
    // 初始化emoji选择器
    initEmojiPicker();
    
    // 初始化回复功能
    initReplyFeature();
});
