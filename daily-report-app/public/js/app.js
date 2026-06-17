// ============================================
// 日报与周报管理工具 v1.1
// 前端交互逻辑
// ============================================

// ===== 工具函数 =====
function formatDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function todayStr() { return formatDate(new Date()); }
function escapeHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function calcHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em)) return 0;
  const m = (eh*60+em) - (sh*60+sm);
  return m <= 0 ? 0 : Math.round(m / 60 * 100) / 100;
}

function getWeekMonday(d) {
  const wd = new Date(d); const day = wd.getDay();
  wd.setDate(wd.getDate() - (day === 0 ? 6 : day - 1)); return wd;
}
function getWeekEnd(m) { const e = new Date(m); e.setDate(e.getDate() + 5); return e; }

function weekLabel(m) {
  const s = m, e = getWeekEnd(m);
  return s.getFullYear()+'年第'+getWeekNumber(s)+'周 ('+(s.getMonth()+1)+'.'+s.getDate()+'-'+(e.getMonth()+1)+'.'+e.getDate()+')';
}
function getWeekNumber(d) { const s = new Date(d.getFullYear(),0,1); return Math.ceil(((d-s)/86400000 + s.getDay() + 1) / 7); }

function statusClass(st) {
  const m = { '已完成':'status-completed','开展中':'status-progress','部分完成':'status-partial','未完成':'status-incomplete','暂停':'status-paused','取消':'status-cancelled','不处理':'status-cancelled' };
  return m[st]||'status-default';
}

// ===== API =====
async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  return res.json();
}

// ===== Tab 切换（1秒滑入滑出） =====
var tabOrder = ['entry','daily','weekly','text','settings'];
var tabSwitching = false;
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    if (tabSwitching) return;
    var tabName = btn.dataset.tab;
    var newView = document.getElementById('view-' + tabName);
    if (!newView || newView.classList.contains('active')) return;

    var oldView = document.querySelector('.tab-content.active');
    tabSwitching = true;

    // 计算滑出方向（向前还是向后）
    var oldIdx = -1;
    if (oldView) {
      var oldTab = oldView.id.replace('view-', '');
      oldIdx = tabOrder.indexOf(oldTab);
    }
    var newIdx = tabOrder.indexOf(tabName);
    var forward = newIdx > oldIdx;

    // 1) 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');

    // 2) 旧界面滑出（向前滑左，向后滑右）
    if (oldView) {
      oldView.classList.remove('tab-slide-in-right', 'tab-slide-in-left');
      if (forward) {
        oldView.classList.add('tab-slide-out-left');
      } else {
        oldView.classList.add('tab-slide-out-right');
      }

      // 从日报填写切走时，今日记录立即隐藏
      if (oldView.id === 'view-entry') {
        var tc = document.getElementById('todayRecordCard');
        if (tc) tc.style.display = 'none';
      }
    }

    // 3) 1 秒后隐藏旧界面，新界面滑入
    setTimeout(function() {
      if (oldView) {
        oldView.style.display = 'none';
        oldView.classList.remove('active', 'tab-slide-out-left', 'tab-slide-out-right');
      }

      newView.style.display = 'block';
      newView.classList.add('active');
      if (forward) {
        newView.classList.add('tab-slide-in-right');
      } else {
        newView.classList.add('tab-slide-in-left');
      }

      // 4) 加载新界面的数据
      if (tabName === 'daily') renderDailySummary();
      else if (tabName === 'weekly') renderWeeklySummary();
      else if (tabName === 'text') renderTextReport();
      else if (tabName === 'entry') { loadEntryRecords(); loadProjects(); loadCategories();
        var tc = document.getElementById('todayRecordCard');
        if (tc) tc.style.display = ''; }

      // 5) 1 秒后清除滑入 class
      setTimeout(function() {
        newView.classList.remove('tab-slide-in-right', 'tab-slide-in-left');
        tabSwitching = false;
      }, 1000);
    }, 1000);
  });
});

function updateHeaderDate() {
  const n = new Date();
  document.getElementById('headerDate').textContent = n.toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}
updateHeaderDate();

// ===== 分类管理 =====
async function loadProjects() {
  try {
    const d = await api('/api/projects');
    const dl = document.getElementById('projectList');
    dl.innerHTML = d.projects.map(p => '<option value="' + escapeHtml(p) + '">').join('');
  } catch(e) { console.log(e); }
}

async function loadCategories() {
  try {
    const d = await api('/api/categories');
    const dl = document.getElementById('categoryList');
    dl.innerHTML = d.categories.map(c => '<option value="' + escapeHtml(c) + '">').join('');
  } catch(e) { console.log(e); }
}

document.getElementById('btnAddProject').addEventListener('click', async () => {
  const inp = document.getElementById('inputProject');
  const project = inp.value.trim();
  if (!project) return;
  try {
    const d = await api('/api/projects', { method:'POST', body: JSON.stringify({ project }) });
    if (d.success) {
      await loadProjects();
      inp.value = project;
    }
  } catch(e) { console.log(e); }
});

document.getElementById('btnAddCategory').addEventListener('click', async () => {
  const inp = document.getElementById('inputCategory');
  const cat = inp.value.trim();
  if (!cat) return;
  try {
    const d = await api('/api/categories', { method:'POST', body: JSON.stringify({ category: cat }) });
    if (d.success) {
      await loadCategories();
      // 重新设置输入值
      inp.value = cat;
    }
  } catch(e) { console.log(e); }
});

// ===== 时间自动计算 =====
function updateHoursDisplay() {
  const start = document.getElementById('inputStart').value;
  const end = document.getElementById('inputEnd').value;
  const h = calcHours(start, end);
  document.getElementById('inputHoursDisplay').textContent = h + ' h';
}
document.getElementById('inputStart').addEventListener('change', updateHoursDisplay);
document.getElementById('inputEnd').addEventListener('change', updateHoursDisplay);

// ===== 日报填写 =====
let entryDate = todayStr();
const entryInput = document.getElementById('entryDate');
entryInput.value = entryDate;

document.getElementById('entryPrevDay').addEventListener('click', () => {
  const d = new Date(entryInput.value); d.setDate(d.getDate() - 1);
  entryInput.value = formatDate(d); entryDate = entryInput.value;
  loadEntryRecords();
});
document.getElementById('entryNextDay').addEventListener('click', () => {
  const d = new Date(entryInput.value); d.setDate(d.getDate() + 1);
  entryInput.value = formatDate(d); entryDate = entryInput.value;
  loadEntryRecords();
});
document.getElementById('entryToday').addEventListener('click', () => {
  entryInput.value = todayStr(); entryDate = entryInput.value;
  loadEntryRecords();
});
entryInput.addEventListener('change', () => { entryDate = entryInput.value; loadEntryRecords(); });

async function loadEntryRecords() {
  try {
    const d = await api('/api/records?date=' + entryDate);
    const list = document.getElementById('entryRecordList');
    document.getElementById('entryCount').textContent = d.records.length + ' 条记录';
    if (d.records.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="icon">??</div><p>暂无记录，在上方添加吧</p></div>';
      return;
    }
    list.innerHTML = d.records.map(r => {
      const timeStr = r.startTime && r.endTime ? r.startTime + ' - ' + r.endTime : '';
      const st = r.status ? '<span class="record-status ' + statusClass(r.status) + '">' + escapeHtml(r.status) + '</span>' : '';
      const project = r.project ? '<span class="record-project">' + escapeHtml(r.project) + '</span>' : '';
      const category = r.category ? '<span class="record-category">' + escapeHtml(r.category) + '</span>' : '';
      const note = r.note ? '<div style="font-size:11px;color:#ff9500;margin-top:2px">?? ' + escapeHtml(r.note) + '</div>' : '';
      return '<div class="record-item" data-id="' + r.id + '">' +
        '<div class="record-time">' + timeStr + '</div>' +
        '<div class="record-body">' +
          '<div class="record-title">' + project + category + '</div>' +
          '<div class="record-content">' + escapeHtml(r.content) + '</div>' +
          '<div class="record-meta">' +
            '<span class="record-hours">' + r.hours + 'h</span>' + st +
          '</div>' + note +
        '</div>' +
        '<div class="record-actions">' +
          '<button class="btn-icon" onclick="editRecord(\'' + r.id + '\')" title="编辑">&#9998;</button>' +
          '<button class="btn-icon danger" onclick="deleteRecord(\'' + r.id + '\')" title="删除">&#10005;</button>' +
        '</div></div>';
    }).join('');
  } catch(e) { console.log(e); }
}

document.getElementById('btnAddRecord').addEventListener('click', async () => {
  const start = document.getElementById('inputStart').value;
  const end = document.getElementById('inputEnd').value;
  const project = document.getElementById('inputProject').value.trim();
  const category = document.getElementById('inputCategory').value.trim();
  const content = document.getElementById('inputContent').value.trim();
  const status = document.getElementById('inputStatus').value;
  const note = document.getElementById('inputNote').value.trim();
  const summary = document.getElementById('inputSummary').value.trim();

  if (!project) { alert('请输入工作项目'); return; }
  if (!category) { alert('请输入工作分类'); return; }
  if (!content) { alert('请输入工作内容'); return; }
  if (calcHours(start, end) <= 0) { alert('请检查开始/结束时间'); return; }
  if (!summary) { alert('请输入项目概括'); return; }

  try {
    await api('/api/records', { method:'POST', body: JSON.stringify({
      date: entryInput.value, startTime: start, endTime: end,
      project, category, content, status, note, summary
    })});
    document.getElementById('inputContent').value = '';
    document.getElementById('inputSummary').value = '';
    document.getElementById('inputNote').value = '';
    await loadEntryRecords();
    await loadProjects();
    await loadCategories();
  } catch(e) { alert('添加失败'); }
});

async function deleteRecord(id) {
  if (!confirm('确定删除？')) return;
  try {
    await api('/api/records', { method:'DELETE', body: JSON.stringify({ id, date: entryDate }) });
    await loadEntryRecords();
  } catch(e) { alert('删除失败'); }
}

function editRecord(id) {
  const el = document.querySelector('.record-item[data-id="' + id + '"]');
  if (!el) return;
  const timeTxt = el.querySelector('.record-time').textContent;
  const parts = timeTxt.split(' - ');
  if (parts.length === 2) {
    document.getElementById('inputStart').value = parts[0].trim();
    document.getElementById('inputEnd').value = parts[1].trim();
  }
  const projectEl = el.querySelector('.record-project');
  const categoryEl = el.querySelector('.record-category');
  document.getElementById('inputProject').value = projectEl ? projectEl.textContent : '';
  document.getElementById('inputCategory').value = categoryEl ? categoryEl.textContent : '';
  document.getElementById('inputContent').value = el.querySelector('.record-content').textContent;
  const hEl = el.querySelector('.record-hours');
  if (hEl) {
    const h = parseFloat(hEl.textContent);
    if (!isNaN(h)) { /* keep time for reference */ }
  }
  updateHoursDisplay();
  deleteRecord(id);
  document.querySelector('.card-header .card-title').scrollIntoView({ behavior:'smooth' });
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key === 'Enter') document.getElementById('btnAddRecord').click();
});

// ===== 日报统计 =====
let dailyDate = todayStr();
const dailyInput = document.getElementById('dailyDate');
dailyInput.value = dailyDate;

document.getElementById('dailyPrevDay').addEventListener('click', () => {
  const d = new Date(dailyInput.value); d.setDate(d.getDate() - 1);
  dailyInput.value = formatDate(d); dailyDate = dailyInput.value;
  renderDailySummary('left');
});
document.getElementById('dailyNextDay').addEventListener('click', () => {
  const d = new Date(dailyInput.value); d.setDate(d.getDate() + 1);
  dailyInput.value = formatDate(d); dailyDate = dailyInput.value;
  renderDailySummary('right');
});
document.getElementById('dailyToday').addEventListener('click', () => {
  dailyInput.value = todayStr(); dailyDate = dailyInput.value;
  renderDailySummary();
});
dailyInput.addEventListener('change', () => { dailyDate = dailyInput.value; renderDailySummary(); });

async function renderDailySummary(slideDir) {
  try {
    const d = await api('/api/daily-summary?date=' + dailyDate);
    const c = document.getElementById('dailySummary');
    if (!d.summary || d.summary.length === 0) {
      c.innerHTML = '<div class="empty-state" style="animation:fadeInUp 0.4s ease"><div class="icon">??</div><p>该日期暂无工作记录</p></div>';
      return;
    }
    const dateLabel = new Date(dailyDate).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
    const total = d.grandTotal;
    const count = d.summary.length;
    let html = '<div class="daily-stats-container">' +
      '<div class="daily-stats-bar">' +
        '<div class="stat-block"><span class="stat-label">总用时</span><span class="stat-value">' + total + '</span><span class="stat-unit">h</span></div>' +
        '<div class="stat-divider"></div>' +
        '<div class="stat-block"><span class="stat-label">工作分类</span><span class="stat-value">' + count + '</span><span class="stat-unit">项</span></div>' +
      '</div>' +
      '<table class="daily-stats-table">' +
        '<thead><tr>' +
          '<th>工作分类</th>' +
          '<th class="col-hours">总用时</th>' +
          '<th class="col-status">进展</th>' +
          '<th class="col-content">工作内容</th>' +
        '</tr></thead><tbody>';
    d.summary.forEach((s, i) => {
      const preview = (s.items && s.items[0]) ? s.items[0] : '';
      const statusHtml = s.statuses.map(st => '<span class="record-status ' + statusClass(st) + '">' + escapeHtml(st) + '</span> ').join('');
      html += '<tr style="animation-delay:' + (i * 0.04) + 's">' +
        '<td><strong>' + escapeHtml(s.category) + '</strong></td>' +
        '<td class="cell-hours">' + s.totalHours + 'h</td>' +
        '<td class="cell-status">' + statusHtml + '</td>' +
        '<td class="cell-content">' + (preview ? escapeHtml(preview) : '') + '</td></tr>';
    });
    html += '</tbody></table>' +
      '<div class="daily-stats-total">' +
        '总计 <span class="total-value">' + total + '</span><span class="total-unit">h</span>' +
        '<span class="total-count">' + count + ' 项</span>' +
      '</div></div>';

    if (slideDir) {
      const exitClass = slideDir === 'left' ? 'slide-exit-left' : 'slide-exit-right';
      const enterClass = slideDir === 'left' ? 'slide-enter-right' : 'slide-enter-left';
      c.style.animation = 'none';
      c.classList.add(exitClass);
      setTimeout(() => {
        c.classList.remove(exitClass);
        c.innerHTML = html;
        c.classList.add(enterClass);
        setTimeout(() => c.classList.remove(enterClass), 350);
      }, 200);
    } else {
      c.innerHTML = html;
    }
  } catch(e) { console.log(e); }
}

// ===== 周报统计 =====
let weeklyMonday = getWeekMonday(new Date());
weeklyMonday.setDate(weeklyMonday.getDate() - 7);

document.getElementById('weeklyThisWeek').addEventListener('click', () => {
  weeklyMonday = getWeekMonday(new Date());
  renderWeeklySummary();
});
document.getElementById('weeklyLastWeek').addEventListener('click', () => {
  weeklyMonday = getWeekMonday(new Date());
  weeklyMonday.setDate(weeklyMonday.getDate() - 7);
  renderWeeklySummary();
});
document.getElementById('weeklyPrev').addEventListener('click', () => {
  weeklyMonday.setDate(weeklyMonday.getDate() - 7);
  renderWeeklySummary();
});
document.getElementById('weeklyNext').addEventListener('click', () => {
  weeklyMonday.setDate(weeklyMonday.getDate() + 7);
  renderWeeklySummary();
});

async function renderWeeklySummary(slideDir) {
  const start = formatDate(weeklyMonday);
  const end = formatDate(getWeekEnd(weeklyMonday));
  document.getElementById('weekLabel').textContent = weekLabel(weeklyMonday);

  try {
    const d = await api('/api/weekly-summary?start=' + start + '&end=' + end);
    const c = document.getElementById('weeklySummary');
    if (!d.report || d.report.length === 0) {
      c.innerHTML = '<div class="empty-state" style="animation:fadeInUp 0.4s ease"><div class="icon">??</div><p>该周暂无工作记录</p></div>';
      return;
    }
    let html = '<div class="summary-bar">' +
      '<div class="summary-item"><div class="value">' + d.grandTotal + '</div><div class="label">周总用时 (h)</div></div>' +
      '<div class="summary-item"><div class="value">' + d.report.length + '</div><div class="label">工作分类数</div></div>' +
      '</div>';
    html += '<div style="overflow-x:auto"><table class="stats-table"><thead><tr><th>工作分类</th>';
    d.dayLabels.forEach(l => { html += '<th class="num">' + l + '</th>'; });
    html += '<th class="num">总计(h)</th><th>进展</th></tr></thead><tbody>';
    d.report.forEach((r, i) => {
      html += '<tr style="animation:fadeInUp 0.3s ease both;animation-delay:' + (i * 0.04) + 's"><td><strong>' + escapeHtml(r.category) + '</strong></td>';
      r.dayHours.forEach(h => { html += '<td class="num">' + (h > 0 ? h : '-') + '</td>'; });
      html += '<td class="num" style="font-weight:700;color:var(--accent)">' + r.totalHours + '</td>';
      html += '<td>' + r.statuses.map(st => '<span class="record-status ' + statusClass(st) + '">' + escapeHtml(st) + '</span> ').join('') + '</td></tr>';
    });
    html += '<tr class="total-row"><td><strong>日总计</strong></td>';
    d.dailyTotals.forEach(t => { html += '<td class="num"><strong>' + t + '</strong></td>'; });
    html += '<td class="num"><strong>' + d.grandTotal + '</strong></td><td></td></tr>';
    html += '</tbody></table></div>';

    if (slideDir) {
      const exitClass = slideDir === 'left' ? 'slide-exit-left' : 'slide-exit-right';
      const enterClass = slideDir === 'left' ? 'slide-enter-right' : 'slide-enter-left';
      c.classList.add(exitClass);
      setTimeout(() => {
        c.classList.remove(exitClass);
        c.innerHTML = html;
        c.classList.add(enterClass);
        setTimeout(() => c.classList.remove(enterClass), 350);
      }, 200);
    } else {
      c.innerHTML = html;
    }
  } catch(e) { console.log(e); }
}

// ===== 初始化 =====
loadEntryRecords();
loadProjects();
loadCategories();

// Edit mode
var eid=null;
var eel=null;
editRecord=function(id){populateEdit(id);};

function populateEdit(id){
var el=document.querySelector('.record-item[data-id='+String.fromCharCode(34)+id+String.fromCharCode(34)+']');
if(!el)return;
var tt=el.querySelector('.record-time').textContent;
var p=tt.split(' - ');
if(p.length===2){document.getElementById('inputStart').value=p[0].trim();document.getElementById('inputEnd').value=p[1].trim();}
var projectEl=el.querySelector('.record-project');
var categoryEl=el.querySelector('.record-category');
document.getElementById('inputProject').value=projectEl?projectEl.textContent:'';
document.getElementById('inputCategory').value=categoryEl?categoryEl.textContent:'';
document.getElementById('inputContent').value=el.querySelector('.record-content').textContent;
updateHoursDisplay();eid=id;eel=el;
document.getElementById('btnAddRecord').disabled=true;
document.getElementById('btnModifyRecord').style.display='';
document.getElementById('btnCancelEdit').style.display='';
document.querySelector('.card-header').scrollIntoView({behavior:'smooth'});
}
function cancelEdit(){
eid=null;eel=null;
document.getElementById('inputContent').value='';
document.getElementById('inputProject').value='';
document.getElementById('inputNote').value='';
document.getElementById('btnAddRecord').disabled=false;
document.getElementById('btnModifyRecord').style.display='none';
document.getElementById('btnCancelEdit').style.display='none';
}

function updateRecord(){
if(!eid)return;
var st=document.getElementById('inputStart').value;
var et=document.getElementById('inputEnd').value;
var project=document.getElementById('inputProject').value.trim();
var cat=document.getElementById('inputCategory').value.trim();
var ct=document.getElementById('inputContent').value.trim();
var sts=document.getElementById('inputStatus').value;
var nt=document.getElementById('inputNote').value.trim();
if(!project){alert('请输入工作项目');return}
if(!cat){alert('请输入工作分类');return}
if(!ct){alert('input ct');return}
api('/api/records',{method:'PUT',body:JSON.stringify({id:eid,date:entryDate,startTime:st,endTime:et,project:project,category:cat,content:ct,status:sts,note:nt})}).then(function(){cancelEdit();loadEntryRecords();loadProjects();loadCategories();});
}

document.getElementById('btnModifyRecord').addEventListener('click',updateRecord);
document.getElementById('btnCancelEdit').addEventListener('click',cancelEdit);
document.getElementById('entryRecordList').addEventListener('click',function(e){
if(e.target.closest('button'))return;
var b=e.target.closest('.record-body');
if(b){var item=b.closest('.record-item');if(item&&item.dataset.id)populateEdit(item.dataset.id);}
});

// Text report
var textMonday=getWeekMonday(new Date());textMonday.setDate(textMonday.getDate()-7);
document.getElementById('textThisWeek').addEventListener('click',function(){textMonday=getWeekMonday(new Date());renderTextReport();});
document.getElementById('textLastWeek').addEventListener('click',function(){textMonday=getWeekMonday(new Date());textMonday.setDate(textMonday.getDate()-7);renderTextReport();});
document.getElementById('textPrev').addEventListener('click',function(){textMonday.setDate(textMonday.getDate()-7);renderTextReport();});
document.getElementById('textNext').addEventListener('click',function(){textMonday.setDate(textMonday.getDate()+7);renderTextReport();});
async function renderTextReport(){
var start=formatDate(textMonday);var end=formatDate(getWeekEnd(textMonday));
document.getElementById('textLabel').textContent=weekLabel(textMonday);
try{var d=await api('/api/weekly-text?start='+start+'&end='+end);document.getElementById('textContent').value=d.text||'暂无记录';}catch(e){document.getElementById('textContent').value='加载失败';}
}
document.getElementById('btnCopyText').addEventListener('click',function(){var ta=document.getElementById('textContent');ta.select();ta.setSelectionRange(0,99999);navigator.clipboard.writeText(ta.value);var btn=this;btn.textContent='已复制';setTimeout(function(){btn.textContent='复制';},2000);});

// Summary fix for edit
var _pe=populateEdit;
populateEdit=async function(id){_pe(id);try{var d=await api('/api/records?date='+entryDate);var rec=d.records.find(function(r){return r.id===id;});if(rec){document.getElementById('inputSummary').value=rec.summary||'';document.getElementById('inputStatus').value=rec.status||'已完成';document.getElementById('inputNote').value=rec.note||'';}}catch(e){}};
updateRecord=function(){var st=document.getElementById('inputStart').value;var et=document.getElementById('inputEnd').value;var pj=document.getElementById('inputProject').value.trim();var cat=document.getElementById('inputCategory').value.trim();var ct=document.getElementById('inputContent').value.trim();var sts=document.getElementById('inputStatus').value;var nt=document.getElementById('inputNote').value.trim();var sum=document.getElementById('inputSummary').value.trim();if(!pj){alert('请输入工作项目');return}if(!cat){alert('请输入工作分类');return}if(!ct){alert('请输入工作内容');return}if(!sum){alert('请输入项目概括');return}api('/api/records',{method:'PUT',body:JSON.stringify({id:eid,date:entryDate,startTime:st,endTime:et,project:pj,category:cat,content:ct,status:sts,note:nt,summary:sum})}).then(function(){cancelEdit();loadEntryRecords();loadProjects();loadCategories();});};
