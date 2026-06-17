﻿const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_DIR = process.env.DATA_DIR || 'D:\\ReportData';
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = 3456;

// 初始化
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===== 分类管理 =====
const CATEGORIES_FILE = path.join(DATA_DIR, '_categories.json');
const DEFAULT_CATEGORIES = ['处理反馈问题', '总结和文档', '会议', '重点工作', '其他'];
const PROJECTS_FILE = path.join(DATA_DIR, '_projects.json');
const DEFAULT_PROJECTS = ['JM', '公司内部'];

function loadCategories() {
  try { return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf8')).categories || DEFAULT_CATEGORIES; }
  catch { return DEFAULT_CATEGORIES; }
}
function saveCategories(cats) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify({ categories: cats }, null, 2), 'utf8');
}
function loadProjects() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')).projects || DEFAULT_PROJECTS; }
  catch { return DEFAULT_PROJECTS; }
}
function saveProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects }, null, 2), 'utf8');
}
function getAllCategoriesFromRecords() {
  const cats = new Set();
  try {
    fs.readdirSync(DATA_DIR).forEach(f => {
      if (f.endsWith('.json') && !f.startsWith('_')) {
        try { JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')).forEach(r => { if (r.category) cats.add(r.category); }); }
        catch {}
      }
    });
  } catch {}
  return cats;
}
function getAllProjectsFromRecords() {
  const projects = new Set();
  try {
    fs.readdirSync(DATA_DIR).forEach(f => {
      if (f.endsWith('.json') && !f.startsWith('_')) {
        try { JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')).forEach(r => { if (r.project) projects.add(r.project); }); }
        catch {}
      }
    });
  } catch {}
  return projects;
}

// ===== 推送模块 =====
const PUSH_CONFIG_FILE = path.join(DATA_DIR, '_push_config.json');

function loadPushConfig() {
  try { return JSON.parse(fs.readFileSync(PUSH_CONFIG_FILE, 'utf8')); }
  catch { return { channel:'serverchan', serverchanKey:'', wecomWebhook:'', enabled:false }; }
}
function savePushConfig(cfg) {
  fs.writeFileSync(PUSH_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function normalizePushResult(channel, raw, httpStatus) {
  const code = raw && (raw.code !== undefined ? raw.code : raw.errcode);
  const ok = httpStatus >= 200 && httpStatus < 300 && (code === 0 || code === '0');
  const message = raw && (raw.message || raw.errmsg || raw.error);
  return {
    success: ok,
    channel,
    message: ok ? '推送成功' : (message || ('推送失败，HTTP 状态码: ' + httpStatus)),
    raw
  };
}

function requestJson(options, payload, channel) {
  return new Promise(resolve => {
    const d = JSON.stringify(payload);
    const r = https.request({ ...options,
      headers:{ 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(d) },
      timeout: 15000
    }, res => {
      let b='';
      res.on('data', c => b += c);
      res.on('end', () => {
        let raw;
        try { raw = JSON.parse(b || '{}'); }
        catch { raw = { code:-1, message:b || '推送服务返回了非 JSON 内容' }; }
        resolve(normalizePushResult(channel, raw, res.statusCode || 0));
      });
    });
    r.on('timeout', () => { r.destroy(new Error('推送请求超时')); });
    r.on('error', err => resolve({ success:false, channel, message:err.message || '推送请求失败', raw:null }));
    r.write(d);
    r.end();
  });
}

function pushServerChan(sendkey, title, content) {
  const key = String(sendkey || '').trim();
  return requestJson({
    hostname:'sctapi.ftqq.com',
    port:443,
    path:'/' + encodeURIComponent(key) + '.send',
    method:'POST'
  }, { title, desp:content }, 'serverchan');
}

function pushWecomBot(wh, title, content) {
  let u;
  try { u = new URL(String(wh || '').trim()); }
  catch { return Promise.resolve({ success:false, channel:'wecom', message:'企微 Webhook URL 格式不正确', raw:null }); }
  if (u.protocol !== 'https:') {
    return Promise.resolve({ success:false, channel:'wecom', message:'企微 Webhook 必须是 https 地址', raw:null });
  }
  return requestJson({
    hostname:u.hostname,
    port:u.port ? Number(u.port) : 443,
    path:u.pathname + u.search,
    method:'POST'
  }, { msgtype:'markdown', markdown:{ content:'## ' + title + '\n' + content } }, 'wecom');
}

async function sendPush(cfg, title, content) {
  const c = cfg || loadPushConfig();
  if (!c.enabled) return { success:false, channel:c.channel || '', message:'推送未启用', raw:null };
  if (c.channel === 'serverchan') {
    if (!String(c.serverchanKey || '').trim()) return { success:false, channel:'serverchan', message:'Server酱 SendKey 未配置', raw:null };
    return await pushServerChan(c.serverchanKey, title, content);
  } else if (c.channel === 'wecom') {
    if (!String(c.wecomWebhook || '').trim()) return { success:false, channel:'wecom', message:'企微 Webhook URL 未配置', raw:null };
    return await pushWecomBot(c.wecomWebhook, title, content);
  }
  return { success:false, channel:c.channel || '', message:'不支持的推送通道', raw:null };
}

function formatDailyForPush(dateStr, summary, grandTotal) {
  const d = new Date(dateStr);
  const label = (d.getMonth()+1)+'月'+d.getDate()+'日';
  let c = '> **总用时**: '+grandTotal+' 小时\n> **项目数**: '+summary.length+' 项\n\n';
  c += '| 工作分类 | 用时(h) | 进展 |\n|---------|--------|------|\n';
  summary.forEach(s => { c += '| '+s.category+' | '+s.totalHours+' | '+s.statuses.join(', ')+' |\n'; });
  c += '\n**工作明细:**\n';
  summary.forEach(s => { s.items.forEach(item => { c += '- '+s.category+': '+item+'\n'; }); });
  return { title:label+' 工作日报', content:c };
}

// ===== 数据读写 =====
function getDatePath(dateStr) { return path.join(DATA_DIR, dateStr + '.json'); }
function readRecords(dateStr) { try { return JSON.parse(fs.readFileSync(getDatePath(dateStr), 'utf8')); } catch { return []; } }
function writeRecords(dateStr, records) { fs.writeFileSync(getDatePath(dateStr), JSON.stringify(records, null, 2), 'utf8'); }

function getWeekNumber(d){var s=new Date(d.getFullYear(),0,1);return Math.ceil(((d-s)/86400000+s.getDay()+1)/7);}

function formatDate(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function parseBody(req) {
  return new Promise(resolve => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{resolve(JSON.parse(b))}catch{resolve({})} }); });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Access-Control-Allow-Origin':'*' });
  res.end(JSON.stringify(data));
}

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh,sm] = start.split(':').map(Number); const [eh,em] = end.split(':').map(Number);
  if (isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em)) return 0;
  const m = (eh*60+em) - (sh*60+sm); return m <= 0 ? 0 : Math.round(m/60*100)/100;
}

// ===== 路由 =====
const routes = {
  'GET /api/records': (req, res, parsed) => {
    const ds = parsed.query.date || formatDate(new Date());
    sendJSON(res, { date: ds, records: readRecords(ds) });
  },

  'POST /api/records': async (req, res) => {
    const body = await parseBody(req);
    const dateStr = body.date || formatDate(new Date());
    const records = readRecords(dateStr);
    const st = body.startTime || ''; const et = body.endTime || '';
    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
      startTime: st, endTime: et,
      hours: body.hours !== undefined ? Number(body.hours) : calcHours(st, et),
      project: body.project || '', category: body.category || '', content: body.content || '',
      status: body.status || '', note: body.note || '',
  summary: body.summary || ''
    };
    records.push(record);
    writeRecords(dateStr, records);
    sendJSON(res, { success:true, record }, 201);
  },

  'PUT /api/records': async (req, res) => {
    const body = await parseBody(req);
    const dateStr = body.date || formatDate(new Date());
    const records = readRecords(dateStr);
    const idx = records.findIndex(r => r.id === body.id);
    if (idx === -1) return sendJSON(res, { error:'未找到' }, 404);
    const r = records[idx];
    ['startTime','endTime','project','category','content','status','note','summary'].forEach(f => {
      if (body[f] !== undefined) r[f] = body[f];
    });
    if (body.startTime !== undefined || body.endTime !== undefined) r.hours = calcHours(r.startTime, r.endTime);
    else if (body.hours !== undefined) r.hours = Number(body.hours);
    writeRecords(dateStr, records);
    sendJSON(res, { success:true, record:r });
  },

  'DELETE /api/records': async (req, res) => {
    const body = await parseBody(req);
    const dateStr = body.date || formatDate(new Date());
    const filtered = readRecords(dateStr).filter(r => r.id !== body.id);
    if (filtered.length === readRecords(dateStr).length) return sendJSON(res, { error:'未找到' }, 404);
    writeRecords(dateStr, filtered);
    sendJSON(res, { success:true });
  },

  'GET /api/categories': (req, res) => {
    const saved = loadCategories();
    const fromRecords = getAllCategoriesFromRecords();
    sendJSON(res, { categories:[...new Set([...saved,...fromRecords])], saved });
  },

  'GET /api/projects': (req, res) => {
    const saved = loadProjects();
    const fromRecords = getAllProjectsFromRecords();
    sendJSON(res, { projects:[...new Set([...saved,...fromRecords])], saved });
  },

  'POST /api/categories': async (req, res) => {
    const body = await parseBody(req);
    const cat = (body.category||'').trim();
    if (!cat) return sendJSON(res, { error:'分类名不能为空' }, 400);
    const saved = loadCategories();
    if (!saved.includes(cat)) { saved.push(cat); saveCategories(saved); }
    sendJSON(res, { success:true, categories:saved });
  },

  'POST /api/projects': async (req, res) => {
    const body = await parseBody(req);
    const project = (body.project||'').trim();
    if (!project) return sendJSON(res, { error:'项目名不能为空' }, 400);
    const saved = loadProjects();
    if (!saved.includes(project)) { saved.push(project); saveProjects(saved); }
    sendJSON(res, { success:true, projects:saved });
  },

  'DELETE /api/categories': async (req, res) => {
    const body = await parseBody(req);
    const cat = (body.category||'').trim();
    let saved = loadCategories();
    saved = saved.filter(c => c !== cat);
    saveCategories(saved);
    sendJSON(res, { success:true, categories:saved });
  },

  'DELETE /api/projects': async (req, res) => {
    const body = await parseBody(req);
    const project = (body.project||'').trim();
    let saved = loadProjects();
    saved = saved.filter(p => p !== project);
    saveProjects(saved);
    sendJSON(res, { success:true, projects:saved });
  },

  // === 推送接口 ===
  'GET /api/push/config': (req, res) => { sendJSON(res, loadPushConfig()); },

  'POST /api/push/config': async (req, res) => {
    const body = await parseBody(req);
    const cfg = { channel:body.channel||'serverchan', serverchanKey:body.serverchanKey||'',
      wecomWebhook:body.wecomWebhook||'', enabled:!!body.enabled };
    savePushConfig(cfg);
    sendJSON(res, { success:true, config:cfg });
  },

  'POST /api/push/test': async (req, res) => {
    const cfg = loadPushConfig();
    const result = await sendPush(cfg, '日报推送测试',
      '> 这是一条测试消息\n\n如果你收到这条消息，说明日报推送配置成功。\n\n_日报与周报管理工具 v1.2_');
    sendJSON(res, result);
  },

  // 每日自动推送（供定时任务调用）
  'GET /api/push/daily': async (req, res) => {
    const cfg = loadPushConfig();
    if (!cfg.enabled) return sendJSON(res, { success:false, error:'推送未启用' });
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);
    const records = readRecords(dateStr);
    if (records.length === 0) return sendJSON(res, { success:false, error:dateStr+' 没有工作记录' });

    const groups = {};
    records.forEach(r => {
      const cat = r.category || '(未分类)';
      if (!groups[cat]) groups[cat] = { totalHours:0, items:[], statuses:new Set() };
      groups[cat].totalHours += r.hours;
      const ts = r.startTime&&r.endTime ? r.startTime+'-'+r.endTime : '';
      const project = r.project ? '['+r.project+'] ' : '';
      groups[cat].items.push((ts?ts+' ':'')+project+(r.content||''));
      if (r.status) groups[cat].statuses.add(r.status);
    });
    const summary = Object.entries(groups).map(([cat,d]) => ({
      category:cat, totalHours:Math.round(d.totalHours*100)/100,
      items:d.items.filter(Boolean), statuses:[...d.statuses]
    })).sort((a,b)=>b.totalHours-a.totalHours);
    const grandTotal = summary.reduce((s,g)=>s+g.totalHours,0);
    const { title, content } = formatDailyForPush(dateStr, summary, grandTotal);
    const pushResult = await sendPush(cfg, title, content);
    sendJSON(res, { success:pushResult.success, date:dateStr, summary, grandTotal, message:pushResult.message, pushResult });
  },

  // 日报统计
  'GET /api/daily-summary': (req, res, parsed) => {
    const dateStr = parsed.query.date || formatDate(new Date());
    const records = readRecords(dateStr);
    const groups = {};
    records.forEach(r => {
      const cat = r.category || '(未分类)';
      if (!groups[cat]) groups[cat] = { totalHours:0, items:[], statuses:new Set() };
      groups[cat].totalHours += r.hours;
      const ts = r.startTime&&r.endTime ? r.startTime+'-'+r.endTime : '';
      const project = r.project ? '['+r.project+'] ' : '';
      groups[cat].items.push((ts?ts+' ':'')+project+(r.content||''));
      if (r.status) groups[cat].statuses.add(r.status);
    });
    const summary = Object.entries(groups).map(([cat,d]) => ({
      category:cat, totalHours:Math.round(d.totalHours*100)/100,
      items:d.items.filter(Boolean), statuses:[...d.statuses]
    })).sort((a,b)=>b.totalHours-a.totalHours);
    sendJSON(res, { date:dateStr, summary, grandTotal:Math.round(summary.reduce((s,g)=>s+g.totalHours,0)*100)/100 });
  },

  // 周报统计
  'GET /api/weekly-summary': (req, res, parsed) => {
    const startStr = parsed.query.start||'', endStr = parsed.query.end||'';
    if (!startStr||!endStr) return sendJSON(res, { error:'需要 start 和 end 参数' }, 400);
    const weekDays = []; const byDay = {};
    let cur = new Date(startStr); const endD = new Date(endStr);
    while (cur <= endD) { const ds=formatDate(cur); weekDays.push(ds); byDay[ds]=readRecords(ds); cur.setDate(cur.getDate()+1); }
    const projects = {};
    weekDays.forEach(ds => {
      (byDay[ds]||[]).forEach(r => {
        const cat = r.category||'(未分类)';
        if (!projects[cat]) { projects[cat]={dailyHours:{},statuses:new Set()}; weekDays.forEach(wd=>projects[cat].dailyHours[wd]=0); }
        projects[cat].dailyHours[ds] = (projects[cat].dailyHours[ds]||0)+r.hours;
        if (r.status) projects[cat].statuses.add(r.status);
      });
    });
    const dayLabels = ['周一','周二','周三','周四','周五','周六'];
    const report = Object.entries(projects).map(([cat,d]) => {
      const dayHours = weekDays.map(ds=>Math.round((d.dailyHours[ds]||0)*100)/100);
      return { category:cat, dayHours, totalHours:Math.round(dayHours.reduce((s,h)=>s+h,0)*100)/100, statuses:[...d.statuses] };
    }).sort((a,b)=>b.totalHours-a.totalHours);
    const dailyTotals = weekDays.map((ds,i)=>{let t=0;report.forEach(r=>t+=r.dayHours[i]);return Math.round(t*100)/100;});
    sendJSON(res, { start:startStr, end:endStr, weekDays, dayLabels:dayLabels.slice(0,weekDays.length), report, dailyTotals, grandTotal:Math.round(report.reduce((s,r)=>s+r.totalHours,0)*100)/100 });
  },


  'GET /api/weekly-text': (req, res, parsed) => {
    var ss=parsed.query.start||'',es=parsed.query.end||'';
    if(!ss||!es)return sendJSON(res,{error:'need start and end'},400);
    var wd=[];var bd={};var cur=new Date(ss);var endD=new Date(es);
    while(cur<=endD){var ds=formatDate(cur);wd.push(ds);bd[ds]=readRecords(ds);cur.setDate(cur.getDate()+1);}
    var gp={};
    wd.forEach(function(ds){(bd[ds]||[]).forEach(function(r){
      var k=r.summary||r.category||'(\u672a\u5206\u7c7b)';
      if(!gp[k])gp[k]={hours:0,status:''};
      gp[k].hours+=r.hours;if(r.status)gp[k].status=r.status;
    });});
    var it=Object.entries(gp).map(function(e){
      var k=e[0];var d=e[1];
      return{summary:k,status:d.status,hours:Math.round(d.hours*100)/100};
    }).sort(function(a,b){return b.hours-a.hours;});
    var total=it.reduce(function(s,i){return s+i.hours;},0);
    var dt=new Date(ss);
    var label=(dt.getMonth()+1)+'\u6708\u7b2c'+getWeekNumber(dt)+'\u5468\u5468\u62a5';
    var text=label+'\n\n';
    it.forEach(function(item,i){text+=item.summary+' + '+item.hours+'h + '+item.status+'\n';});
    text+='\n\u603b\u8ba1: '+Math.round(total*100)/100+'h';
    sendJSON(res,{text:text,items:it,total:Math.round(total*100)/100});
  },

  'GET /api/push/weekly': async (req, res) => {
    const cfg = loadPushConfig();
    if (!cfg.enabled) return sendJSON(res, { success:false, error:'\u63a8\u9001\u672a\u542f\u7528' });
    const now = new Date(); const day = now.getDay();
    const lastMon = new Date(now); lastMon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7);
    const lastSat = new Date(lastMon); lastSat.setDate(lastMon.getDate() + 5);
    const startStr = formatDate(lastMon); const endStr = formatDate(lastSat);
    var wd=[];var bd={};var cur=new Date(startStr);
    while(cur<=lastSat){var ds=formatDate(cur);wd.push(ds);bd[ds]=readRecords(ds);cur.setDate(cur.getDate()+1);}
    const gp={};
    wd.forEach(function(ds){(bd[ds]||[]).forEach(function(r){var k=r.summary||r.category||'(\u672a\u5206\u7c7b)';if(!gp[k])gp[k]={h:0,status:''};gp[k].h+=r.hours;if(r.status)gp[k].status=r.status;});});
    var it=Object.entries(gp).map(function(e){var k=e[0];var d=e[1];return{summary:k,status:d.status,hours:Math.round(d.h*100)/100};}).sort(function(a,b){return b.hours-a.hours;});
    const total=it.reduce(function(s,i){return s+i.hours;},0);
    const lb=(lastMon.getMonth()+1)+'\u6708\u7b2c'+getWeekNumber(lastMon)+'\u5468\u5468\u62a5';
    var text=lb+'\n\n';
    it.forEach(function(item,i){text+=item.summary+' + '+item.hours+'h + '+item.status+'\n';});
    text+='\n\u603b\u8ba1: '+Math.round(total*100)/100+'h';
    const title='\ud83d\udccb \u4e0a\u5468\u5468\u62a5\u5df2\u751f\u6210';
    const content='\u70b9\u51fb\u67e5\u770b\uff1a[\u6253\u5f00\u65e5\u62a5\u5de5\u5177](http://localhost:3456)\n\n'+text;
    const pushResult = await sendPush(cfg, title, content);
    sendJSON(res, { success:true, text, pushResult });
  },
  'GET /api/dates': (req, res) => {
    try { sendJSON(res, { dates:fs.readdirSync(DATA_DIR).filter(f=>f.endsWith('.json')&&!f.startsWith('_')).map(f=>f.replace('.json','')).sort() }); }
    catch { sendJSON(res, { dates:[] }); }
  }
};

// ===== 启动 =====
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const rk = req.method + ' ' + parsed.pathname;
  if (routes[rk]) return routes[rk](req, res, parsed);

  let fp = path.join(PUBLIC_DIR, parsed.pathname === '/' ? 'index.html' : parsed.pathname);
  const extMap = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8' };
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404,{'Content-Type':'text/html'}); return res.end('<h1>404</h1>'); }
    res.writeHead(200,{'Content-Type':extMap[path.extname(fp)]||'application/octet-stream'});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('  日报与周报管理工具 v1.2');
  console.log('  http://localhost:' + PORT);
  console.log('  数据: ' + DATA_DIR);
  console.log('========================================');
});
