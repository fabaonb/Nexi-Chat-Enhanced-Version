// 客户端防护盾 - 隐蔽防护
(function() {
    'use strict';
    
    /**
     * 环境检测
     */
    const EnvDetector = {
        // 检测开发者工具
        checkDevTools: function() {
            const threshold = 160;
            const widthCheck = window.outerWidth - window.innerWidth > threshold;
            const heightCheck = window.outerHeight - window.innerHeight > threshold;
            return widthCheck || heightCheck;
        },
        
        // 检测调试器
        checkDebugger: function() {
            const start = performance.now();
            debugger;
            const end = performance.now();
            return (end - start) > 100;
        },
        
        // 检测自动化工具
        checkAutomation: function() {
            return !!(
                window.navigator.webdriver ||
                window.document.__selenium_unwrapped ||
                window.document.__webdriver_evaluate ||
                window.document.__driver_evaluate
            );
        }
    };
    
    /**
     * 请求保护
     */
    const RequestProtector = {
        // 添加客户端指纹
        addFingerprint: function(headers) {
            const fp = this.generateFingerprint();
            return {
                ...headers,
                'X-Client-FP': fp,
                'X-Client-TS': Date.now().toString()
            };
        },
        
        // 生成指纹
        generateFingerprint: function() {
            const components = [
                navigator.userAgent,
                navigator.language,
                screen.width + 'x' + screen.height,
                new Date().getTimezoneOffset(),
                !!window.sessionStorage,
                !!window.localStorage
            ];
            
            return btoa(components.join('|')).substring(0, 32);
        }
    };
    
    /**
     * 输入监控
     */
    const InputMonitor = {
        suspiciousPatterns: [
            /<script/gi,
            /javascript:/gi,
            /on\w+=/gi,
            /\bUNION\b.*\bSELECT\b/gi,
            /\.\.[\/\\]/g
        ],
        
        // 检查输入
        check: function(input) {
            if (typeof input !== 'string') return false;
            
            for (const pattern of this.suspiciousPatterns) {
                if (pattern.test(input)) {
                    return true;
                }
            }
            
            return false;
        }
    };
    
    /**
     * 行为监控
     */
    const BehaviorMonitor = {
        actions: [],
        maxActions: 100,
        
        // 记录行为
        record: function(action) {
            this.actions.push({
                type: action,
                time: Date.now()
            });
            
            if (this.actions.length > this.maxActions) {
                this.actions.shift();
            }
            
            // 检测异常行为
            this.detectAnomalies();
        },
        
        // 检测异常
        detectAnomalies: function() {
            if (this.actions.length < 10) return;
            
            const recent = this.actions.slice(-10);
            const timeSpan = recent[recent.length - 1].time - recent[0].time;
            
            // 检测过快操作
            if (timeSpan < 1000) {
                // 可疑行为
                this.handleSuspicious();
            }
        },
        
        // 处理可疑行为
        handleSuspicious: function() {
            // 静默处理，不提示用户
        }
    };
    
    /**
     * 初始化防护
     */
    function initShield() {
        // 监控环境
        setInterval(function() {
            if (EnvDetector.checkAutomation()) {
                // 检测到自动化工具
            }
        }, 5000);
        
        // 拦截 fetch
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            options.headers = RequestProtector.addFingerprint(options.headers || {});
            return originalFetch(url, options);
        };
        
        // 监控表单提交
        document.addEventListener('submit', function(e) {
            const form = e.target;
            const inputs = form.querySelectorAll('input, textarea');
            
            for (const input of inputs) {
                if (InputMonitor.check(input.value)) {
                    e.preventDefault();
                    return false;
                }
            }
            
            BehaviorMonitor.record('form_submit');
        });
        
        // 监控点击
        document.addEventListener('click', function() {
            BehaviorMonitor.record('click');
        });
    }
    
    // 页面加载时初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShield);
    } else {
        initShield();
    }
    
})();
