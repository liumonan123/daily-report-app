// Settings module

async function loadSettings() {
  try {
    var d = await api('/api/push/config');
    document.getElementById('pushServerchanKey').value = d.serverchanKey || '';
    document.getElementById('pushWecomWebhook').value = d.wecomWebhook || '';
    document.getElementById('pushChannel').value = d.channel || 'serverchan';
    document.getElementById('pushEnabled').checked = !!d.enabled;
    togglePushChannel();
    document.getElementById('pushStatus').textContent = '';
  } catch(e) {
    document.getElementById('pushStatus').textContent = '设置加载失败: ' + e.message;
  }
  generateSchedulerCommand();
}

function togglePushChannel() {
  var ch = document.getElementById('pushChannel').value;
  document.getElementById('serverchanConfig').style.display = ch === 'serverchan' ? 'block' : 'none';
  document.getElementById('wecomConfig').style.display = ch === 'wecom' ? 'block' : 'none';
}
document.getElementById('pushChannel').addEventListener('change', togglePushChannel);

document.getElementById('btnSavePush').addEventListener('click', async function() {
  var status = document.getElementById('pushStatus');
  status.textContent = '';
  var cfg = {
    channel: document.getElementById('pushChannel').value,
    serverchanKey: document.getElementById('pushServerchanKey').value.trim(),
    wecomWebhook: document.getElementById('pushWecomWebhook').value.trim(),
    enabled: document.getElementById('pushEnabled').checked
  };
  if (cfg.enabled && cfg.channel === 'serverchan' && !cfg.serverchanKey) {
    status.textContent = '请先填写 Server酱 SendKey';
    return;
  }
  if (cfg.enabled && cfg.channel === 'wecom' && !cfg.wecomWebhook) {
    status.textContent = '请先填写企微机器人 Webhook URL';
    return;
  }
  try {
    var r = await api('/api/push/config', { method: 'POST', body: JSON.stringify(cfg) });
    if (r.success) {
      status.textContent = '设置已保存';
      generateSchedulerCommand();
    } else {
      status.textContent = '保存失败: ' + (r.message || r.error || JSON.stringify(r));
    }
  } catch(e) {
    status.textContent = '保存失败: ' + e.message;
  }
});

document.getElementById('btnTestPush').addEventListener('click', async function() {
  var btn = document.getElementById('btnTestPush');
  var status = document.getElementById('pushStatus');
  try {
    var saved = await api('/api/push/config');
    if (!saved.enabled) {
      status.textContent = '请先保存并启用推送设置';
      return;
    }
    if (saved.channel === 'serverchan' && !saved.serverchanKey) {
      status.textContent = '请先保存 Server酱 SendKey';
      return;
    }
    if (saved.channel === 'wecom' && !saved.wecomWebhook) {
      status.textContent = '请先保存企微机器人 Webhook URL';
      return;
    }
  } catch(e) {
    status.textContent = '读取推送设置失败: ' + e.message;
    return;
  }
  btn.textContent = '发送中...';
  btn.disabled = true;
  status.textContent = '';
  try {
    var r = await api('/api/push/test', { method: 'POST' });
    if (r.success) {
      status.textContent = '测试消息已发送，请查看微信';
    } else {
      status.textContent = '发送失败: ' + (r.message || r.error || JSON.stringify(r));
    }
  } catch(e) {
    status.textContent = '发送异常: ' + e.message;
  }
  btn.textContent = '发送测试';
  btn.disabled = false;
});