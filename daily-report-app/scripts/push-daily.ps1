# 日报推送脚本（每日 8:30 自动运行）
# 推送昨天的日报到微信（Server酱/企微）
try {
    $r = (New-Object Net.WebClient).DownloadString('http://localhost:3456/api/push/daily')
    $time = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content "$PSScriptRoot\..\server.log" "[$time] PUSH-DAILY: $r"
} catch { Add-Content "$PSScriptRoot\..\server.log" "[$time] PUSH-DAILY ERROR: $_" }