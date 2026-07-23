(function () {
  const sendMessage =
    (typeof ApertureUI !== 'undefined' && ApertureUI.sendMessage) ||
    function (msg) {
      const api = typeof browser !== 'undefined' ? browser : chrome;
      return api.runtime.sendMessage(msg);
    };
  const showToast =
    (typeof ApertureUI !== 'undefined' && ApertureUI.showToast) ||
    function (t) {
      console.log(t);
    };

  let state = { cases: [], history: [], playbooks: [], session: {} };

  async function load() {
    const data = await sendMessage({ action: 'getDashboardData' });
    state.cases = data.cases || [];
    state.history = data.history || [];
    state.playbooks = data.playbooks || [];
    state.session = data.session || {};
    render();
  }

  function render() {
    const sel = document.getElementById('sp-case');
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Select case…';
    sel.appendChild(opt0);
    state.cases.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.id + ' · ' + c.name;
      if (state.session.caseId === c.id) opt.selected = true;
      sel.appendChild(opt);
    });

    const sess = document.getElementById('sp-session');
    if (state.session.caseId) {
      sess.textContent =
        state.session.caseId +
        (state.session.paused ? ' · paused' : ' · capturing');
    } else {
      sess.textContent = 'No active session';
    }

    const list = document.getElementById('sp-recent');
    list.innerHTML = '';
    state.history.slice(0, 20).forEach((h) => {
      const row = document.createElement('div');
      row.className = 'sp-row';
      const val = document.createElement('div');
      val.className = 'ioc-val';
      val.textContent = h.ioc;
      const meta = document.createElement('div');
      meta.className = 'ioc-meta';
      meta.textContent = IOCUtils.typeLabel(h.type) + ' · ' + (h.verdict || 'unknown');
      row.appendChild(val);
      row.appendChild(meta);
      row.addEventListener('click', () => {
        document.getElementById('sp-ioc').value = h.ioc;
      });
      list.appendChild(row);
    });
  }

  document.getElementById('sp-start').addEventListener('click', async () => {
    const caseId = document.getElementById('sp-case').value;
    if (!caseId) {
      showToast('Select a case');
      return;
    }
    await sendMessage({ action: 'setSession', caseId, paused: false });
    showToast('Session started');
    load();
  });

  document.getElementById('sp-pause').addEventListener('click', async () => {
    await sendMessage({
      action: 'setSession',
      caseId: state.session.caseId,
      paused: !state.session.paused
    });
    load();
  });

  document.getElementById('sp-clear').addEventListener('click', async () => {
    await sendMessage({ action: 'clearSession' });
    load();
  });

  document.getElementById('sp-run').addEventListener('click', async () => {
    const raw = document.getElementById('sp-ioc').value.trim();
    if (!raw) return;
    const type = IOCUtils.detectIOCType(raw);
    const pb = IOCUtils.playbookForType(type, state.playbooks);
    if (!pb) {
      showToast('No playbook');
      return;
    }
    const res = await sendMessage({
      action: 'runPlaybook',
      ioc: raw,
      playbookId: pb.id
    });
    showToast(res && res.success ? 'Opened ' + (res.opened || 0) + ' tabs' : 'Failed');
    load();
  });

  document.getElementById('sp-dash').addEventListener('click', () => {
    sendMessage({ action: 'openDashboard', screen: 'overview' });
  });

  load();
})();
