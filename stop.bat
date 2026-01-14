@echo off
chcp 65001 >nul
echo 正在停止 NEXI CHAT 服务...

REM 查找并终止占用端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":12345" ^| findstr "LISTENING"') do (
    echo 终止后端进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":23456" ^| findstr "LISTENING"') do (
    echo 终止前端进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo 终止后端进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo 终止前端进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
)

REM 终止所有 node 进程（谨慎使用）
REM taskkill /F /IM node.exe >nul 2>&1

echo.
echo ✓ 所有服务已停止
timeout /t 2 >nul
