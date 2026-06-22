@echo off
echo 正在停止日报服务器...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo 服务器已停止。
) else (
    echo 未检测到运行中的服务器。
)
pause
