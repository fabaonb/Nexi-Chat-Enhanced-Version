@echo off
chcp 65001 >nul 2>&1

REM 检查并结束占用端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :12345 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :23456 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 等待端口释放
timeout /t 2 /nobreak >nul 2>&1

REM 启动服务
npm run start-all --silent
