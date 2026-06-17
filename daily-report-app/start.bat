@echo off
cd /d "%~dp0"
echo ========================================
echo   日报与周报管理工具 v1.2
echo   正在启动服务器...
echo ========================================
start /MIN "" "D:\Soft\node.exe" server.js
timeout /T 2 /NOBREAK >nul
start "" "http://localhost:3456"
echo 服务器已启动，正在打开浏览器...
echo 关闭此窗口即可停止服务器
pause
taskkill /F /IM node.exe >nul 2>&1
