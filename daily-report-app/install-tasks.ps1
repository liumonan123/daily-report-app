# Install scheduled tasks
schtasks /create /tn DailyReportPush /tr 'curl.exe -s http://localhost:3456/api/push/daily' /sc daily /st 08:30 /f
schtasks /create /tn WeeklyReportPush /tr 'curl.exe -s http://localhost:3456/api/push/weekly' /sc weekly /d MON /st 09:00 /f
