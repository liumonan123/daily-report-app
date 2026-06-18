# 周报推送脚本（每周一 9:00 自动运行）
try {
    $r = (New-Object Net.WebClient).DownloadString('http://localhost:3456/api/push/weekly')
    $time = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content "$PSScriptRoot\..\server.log" "[$time] PUSH-WEEKLY: $r"
} catch { Add-Content "$PSScriptRoot\..\server.log" "[$time] PUSH-WEEKLY ERROR: $_" }