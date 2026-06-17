const http = require('http');
const fs = require('fs');
const path = 'C:\Users\JZFC\Documents\Report\daily-report-app\debug.log';
fs.writeFileSync(path, 'Starting...\n');
const s = http.createServer((req, res) => { res.end('ok'); });
s.listen(3456, () => { fs.appendFileSync(path, 'OK\n'); });
s.on('error', (e) => { fs.appendFileSync(path, 'ERR: ' + e.message + '\n'); });