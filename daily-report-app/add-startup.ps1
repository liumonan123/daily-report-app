# 添加日报管理服务器到开机自启
reg add HKCU\Software\Microsoft\Windows\CurrentVersion\Run /v DailyReportServer /t REG_SZ /d ""D:\Soft\node.exe" "C:\Users\JZFC\Documents\Report\daily-report-app\server.js"" /f
Write-Host '已添加开机自启，下次登录时自动启动服务器'
