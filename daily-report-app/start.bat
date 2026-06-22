@echo off
cd /d "%~dp0"

echo ========================================
echo   Daily Report Tool v1.2
echo   Starting server...
echo ========================================

:: Use VBS to launch node in background (hidden, no window, no parent dependency)
set "VBS=%TEMP%\daily_report_node.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS%"
echo WshShell.CurrentDirectory = "%~dp0" >> "%VBS%"
echo WshShell.Run "D:\Soft\node.exe server.js", 0, False >> "%VBS%"
cscript //nologo "%VBS%" >nul 2>&1
del "%VBS%" >nul 2>&1

timeout /T 2 /NOBREAK >nul

start "" "http://localhost:3456"

echo.
echo Server started, opening browser...
echo This window will close in 5 seconds, server runs in background.
echo To stop the server, run stop.bat or kill node.exe in Task Manager.
timeout /T 5 /NOBREAK >nul