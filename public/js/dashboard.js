// ATS Dashboard v2.5 — build 20260518
// dashboard.js — ATS Compliance Dashboard

const SERVICES = [
  { key: 'filing_2290',          label: '2290 Filing',           short: '2290',       group: 'annual'   },
  { key: 'filing_ucr',           label: 'UCR Filing',            short: 'UCR',        group: 'annual'   },
  { key: 'filing_ifta_license',  label: 'IFTA License',          short: 'IFTA Lic',   group: 'annual'   },
  { key: 'filing_business_name', label: 'Business Name',         short: 'Biz Name',   group: 'annual'   },
  { key: 'filing_clearinghouse', label: 'Clearinghouse Query',   short: 'Clrhouse',   group: 'annual'   },
  { key: 'filing_nm_permit',     label: 'NM Permit',             short: 'NM Perm',    group: 'annual'   },
  { key: 'filing_irp_cab_card',  label: 'IRP Cab Card',          short: 'IRP Cab',    group: 'annual'   },
  { key: 'filing_mcs150',        label: 'MCS-150',               short: 'MCS-150',    group: 'annual'   },
  { key: 'filing_ky_vehicle',    label: 'KY Vehicle',            short: 'KY Veh',     group: 'annual'   },
  { key: 'ifta_q1_2026',         label: 'IFTA Q1 2026',          short: 'Q1 26',      group: 'ifta'     },
  { key: 'ifta_q2_2026',         label: 'IFTA Q2 2026',          short: 'Q2 26',      group: 'ifta'     },
  { key: 'ifta_q4_2025',         label: 'IFTA Q4 2025',          short: 'Q4 25',      group: 'ifta'     },
  { key: 'ifta_q3_2025',         label: 'IFTA Q3 2025',          short: 'Q3 25',      group: 'ifta'     },
  { key: 'ifta_q2_2025',         label: 'IFTA Q2 2025',          short: 'Q2 25',      group: 'ifta'     },
  { key: 'ifta_q1_2025',         label: 'IFTA Q1 2025',          short: 'Q1 25',      group: 'ifta'     },
  { key: 'ifta_q4_2024',         label: 'IFTA Q4 2024',          short: 'Q4 24',      group: 'ifta'     },
  { key: 'new_company_setup',    label: 'New Company Setup',     short: 'Step 1',     group: 'onboard'  },
  { key: 'prorate_account',      label: 'Prorate IRP/IFTA',      short: 'Step 2',     group: 'onboard'  },
  { key: 'clearinghouse_setup',  label: 'Clearinghouse Setup',   short: 'Step 3',     group: 'onboard'  },
  { key: 'boi_filing',           label: 'BOI Filing',            short: 'BOI',        group: 'other'    },
  { key: 'new_prorate_account',  label: 'New Prorate Account',   short: 'Prorate',    group: 'other'    },
  { key: 'ifta_audit',           label: 'IFTA Audit Support',    short: 'IFTA Audit', group: 'other'    },
];

const COLORS  = ['#00C46A','#1E88E5','#00BCD4','#8B5CF6','#F59E0B','#42A5F5','#EF4444','#E94DD3','#63D471'];
const DEADLINES = [
  { service:'IRP Renewal',    date:'2026-05-31', cadence:'Annual',    note:'State-specific renewal date' },
  { service:'IFTA Q1 Filing', date:'2026-06-30', cadence:'Quarterly', note:'6-state fuel tax' },
  { service:'Form 2290',      date:'2026-07-31', cadence:'Annual',    note:'Heavy vehicle use tax' },
  { service:'UCR Renewal',    date:'2026-08-01', cadence:'Annual',    note:'Unified carrier registration' },
  { service:'IFTA Q2 Filing', date:'2026-09-30', cadence:'Quarterly', note:'Q2 fuel tax return' },
  { service:'Permit Renewal', date:'2026-11-01', cadence:'Annual',    note:'Multi-state permits' },
];

const state = {
  clients:     [],
  filtered:    [],
  filterMode:  'all',
  tagFilter:   'all',
  groupFilter: 'all',
  searchQuery: '',
  currentPage: 'dashboard',
  donutChart:  null,
  activity:    [],
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // ── Immediate background warm-up ─────────────────────────────────────────
  // Fire as soon as page loads — doesn't wait for clients or anything else.
  // Server returns cached data instantly if available; only waits on cold start.
  (function warmUpTasksBoard() {
    fetch('/api/tasks-board')
      .then(r => r.json())
      .then(data => {
        if (data.tasks && data.users) {
          tbState.tasks  = data.tasks;
          tbState.opps   = data.opportunities || [];
          tbState.users  = (data.users || []).filter(u => !u.deleted);
          tbState.loaded = true;
          console.log(`✓ Tasks warm: ${tbState.tasks.length} tasks, ${tbState.opps.length} opps, ${tbState.users.length} staff`);
        }
      })
      .catch(() => {}); // silent — never affects UI
  })();
  setupNav();
  renderDeadlines();
  checkHealth();
  await loadClients();
});

// ─── Nav ──────────────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.page);
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
function navigateTo(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const T = {
    dashboard:    ['Dashboard', '2026 compliance overview'],
    compliance:   ['Compliance Grid', 'Click any cell to update the GHL opportunity'],
    deadlines:    ['Upcoming Deadlines', 'Filing calendar for all clients'],
    'dot-lookup':  ['FMCSA DOT Lookup', 'Search any DOT number and push to GHL'],
    'tasks-board': ['Tasks Board', 'Supervisor view — staff tasks & opportunities'],
    'fmcsa-form':   ['FMCSA Support Form', 'Complete on the call — auto-creates GHL task'],
    'skills-setup': ['Skills Setup', 'Assign service skills to each staff member'],
    'cs-board':    ['CS Task Board', 'Customer service tasks — info gathering & GHL updates'],
  };
  const [title, sub] = T[page] || ['ATS',''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent   = sub;
  // CS Board: try cache first, auto-load if Tasks Board not yet loaded
  if (page === 'cs-board') {
    setTimeout(() => {
      if (tbState.loaded && tbState.users.length) {
        csLoadFromCache();
      } else if (!csState.loading) {
        // Tasks Board not loaded — start CS load automatically
        csLoad(true);
      }
    }, 100);
  }

  // Tasks board — init supervisor tabs and load data
  if (page === 'tasks-board')  { tbInit(); tbLoad(); }
  if (page === 'fmcsa-form')   { ffInit(); }
  if (page === 'skills-setup') { skInit(); }
}



// ─── Stat card click → compliance grid filtered ───────────────────────────────
function statCardFilter(mode) {
  navigateTo('compliance');
  // Reset group to all
  state.groupFilter = 'all';
  document.querySelectorAll('#group-chips .chip').forEach(c => c.classList.remove('active'));
  const allChip = document.querySelector('#group-chips .chip');
  if (allChip) allChip.classList.add('active');
  // Set status filter
  state.filterMode = mode;
  document.querySelectorAll('#filter-chips .chip').forEach(c => c.classList.remove('active'));
  const modeChip = [...document.querySelectorAll('#filter-chips .chip')].find(c =>
    c.textContent.toLowerCase().includes(mode === 'done' ? 'complete' : mode)
  );
  if (modeChip) modeChip.classList.add('active');
  applyFilter();
  renderComplianceTable();
  // Update nav highlight
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const compNav = document.querySelector('.nav-item[data-page="compliance"]');
  if (compNav) compNav.classList.add('active');
}

// ─── Quick nav filters ────────────────────────────────────────────────────────
const QUICK_FILTERS = {
  ifta:    { group: 'ifta',    page: 'compliance', label: 'IRP / IFTA' },
  fmcsa:   { group: 'annual',  page: 'compliance', label: 'FMCSA / MCS-150', tag: 'ct:ats advance service' },
  permits: { group: 'annual',  page: 'compliance', label: 'Permits' },
  annual:  { group: 'annual',  page: 'compliance', label: 'Annual Support' },
};

function quickFilter(type) {
  const f = QUICK_FILTERS[type];
  if (!f) return;
  // Navigate to compliance grid
  navigateTo('compliance');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  // Set group filter
  state.groupFilter = f.group;
  document.querySelectorAll('#group-chips .chip').forEach(c => c.classList.remove('active'));
  const chip = [...document.querySelectorAll('#group-chips .chip')].find(c => c.textContent.trim().toLowerCase().includes(f.group === 'ifta' ? 'ifta' : 'annual'));
  if (chip) chip.classList.add('active');
  applyFilter();
  renderComplianceTable();
}

// ─── Health ───────────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const d = await GHL.health();
    const badge = document.getElementById('ghl-status');
    if (d.ghl_configured && d.location_configured) {
      badge.className = 'ghl-badge connected';
      badge.innerHTML = `<i class="ti ti-plug"></i><span>GHL · ${d.pipelines_loaded} pipelines</span>`;
    } else {
      badge.className = 'ghl-badge disconnected';
      badge.innerHTML = '<i class="ti ti-plug-off"></i><span>GHL not configured</span>';
    }
  } catch {
    const badge = document.getElementById('ghl-status');
    if (badge) badge.innerHTML = '<i class="ti ti-plug-off"></i><span>Connecting...</span>';
  }
}

// ─── Load from GHL ────────────────────────────────────────────────────────────
async function loadClients() {
  showLoading(true);
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      document.getElementById('loading-text').textContent =
        attempt === 1 ? 'Syncing with GoHighLevel...' : `Loading contacts... (attempt ${attempt}/8)`;
      const data = await GHL.getContacts(state.searchQuery);
      const clients = data.clients || [];
      if (clients.length === 0 && attempt < 8) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      state.clients = clients;
      buildTagList();
      applyFilter();
      renderDashboard();
      renderComplianceTable();
      updateUrgentBadge();
      showLoading(false);
      logActivity('sync', `Synced <strong>${state.clients.length}</strong> clients from GoHighLevel`);

      return;
    } catch (err) {
      if (attempt < 8) {
        await new Promise(r => setTimeout(r, 5000));
      } else {
        showLoading(false);
        showError(`Could not load from GHL`);
        state.clients = [];
        applyFilter(); renderDashboard(); renderComplianceTable();
      }
    }
  }
}
async function refreshData() {
  try {
    toast('Refreshing from GHL...');
    await GHL.refresh(); // bust server cache first
    await loadClients(); // then reload
    toast('Synced with GoHighLevel ✓');
  } catch(e) {
    await loadClients();
    toast('Synced with GoHighLevel ✓');
  }
}

// ─── Tag filter ───────────────────────────────────────────────────────────────
function buildTagList() {
  const contactTags = new Set();
  const oppTags = new Set();
  state.clients.forEach(c => {
    (c.tags || []).forEach(t => { if (t) contactTags.add(t); });
    (c.oppTags || []).forEach(t => { if (t) oppTags.add(t); });
  });
  const sel = document.getElementById('tag-filter');
  if (!sel) return;
  let html = `<option value="all">All tags</option>`;
  if (contactTags.size) {
    html += `<optgroup label="── Contact Tags ──">`;
    [...contactTags].sort().forEach(t => { html += `<option value="ct:${t}">${t}</option>`; });
    html += `</optgroup>`;
  }
  if (oppTags.size) {
    html += `<optgroup label="── Service Tags ──">`;
    [...oppTags].sort().forEach(t => { html += `<option value="ot:${t}">${t}</option>`; });
    html += `</optgroup>`;
  }
  sel.innerHTML = html;
}
function setTagFilter(val) {
  state.tagFilter = val;
  applyFilter();
  renderComplianceTable();
  renderDashboard();
}

// ─── Filter ───────────────────────────────────────────────────────────────────
function applyFilter() {
  let list = [...state.clients];
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.mc_number||'').toLowerCase().includes(q) || (c.dot_number||'').toLowerCase().includes(q));
  }
  if (state.tagFilter !== 'all') {
    if (state.tagFilter.startsWith('ct:')) {
      const t = state.tagFilter.slice(3);
      list = list.filter(c => (c.tags||[]).includes(t));
    } else if (state.tagFilter.startsWith('ot:')) {
      const t = state.tagFilter.slice(3);
      list = list.filter(c => (c.oppTags||[]).includes(t));
    } else {
      list = list.filter(c => (c.tags||[]).includes(state.tagFilter));
    }
  }
  if (state.filterMode === 'done')    list = list.filter(c => Object.values(c.cells).length > 0 && Object.values(c.cells).every(v => v === 'done'));
  if (state.filterMode === 'pending') list = list.filter(c => Object.values(c.cells).some(v => v === 'pending'));
  if (state.filterMode === 'urgent')  list = list.filter(c => Object.values(c.cells).some(v => v === 'urgent'));
  state.filtered = list;
}
function setFilter(el, mode) {
  state.filterMode = mode;
  document.querySelectorAll('#filter-chips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  // Update compact inline-styled filter buttons
  const compMap = { all: 'comp-filt-all', urgent: 'comp-filt-urgent', done: 'comp-filt-done' };
  Object.entries(compMap).forEach(([key, id]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (key === mode) {
      btn.style.background = 'var(--primary)';
      btn.style.color = '#0a1a0f';
      btn.style.fontWeight = '700';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--text3)';
      btn.style.fontWeight = '400';
    }
  });
  applyFilter(); renderComplianceTable();
}
function setGroup(el, group) {
  state.groupFilter = group;
  document.querySelectorAll('#group-chips .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderComplianceTable();
}
function handleSearch(q) { state.searchQuery = q; applyFilter(); renderComplianceTable(); }

// ─── Dashboard ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const allCells = state.clients.flatMap(c => Object.values(c.cells));
  document.getElementById('stat-clients').textContent = state.clients.length;
  document.getElementById('stat-done').textContent    = allCells.filter(v => v === 'done').length;
  document.getElementById('stat-pending').textContent = allCells.filter(v => v === 'pending').length;
  document.getElementById('stat-urgent').textContent  = allCells.filter(v => v === 'urgent').length;
  renderDonut();
  renderServiceBars();
}

function renderDonut() {
  const counts = SERVICES.map(s => state.clients.reduce((a, c) => a + (c.cells[s.key] === 'done' ? 1 : 0), 0));
  document.getElementById('donut-total').textContent = SERVICES.length;
  if (state.donutChart) {
    state.donutChart.data.datasets[0].data = counts;
    state.donutChart.update();
  } else {
    state.donutChart = new Chart(document.getElementById('donut-canvas'), {
      type: 'doughnut',
      data: { labels: SERVICES.map(s => s.label), datasets: [{ data: counts, backgroundColor: COLORS, borderColor: '#102018', borderWidth: 2 }] },
      options: { cutout:'68%', responsive:false, maintainAspectRatio:false, plugins:{ legend:{display:false} }, animation:{duration:700} },
    });
  }
  document.getElementById('donut-legend').innerHTML = SERVICES.map((s,i) => {
    const count = counts[i];
    return `<div class="dl-row" onclick="openServiceModal('${s.key}','${s.label}')" style="cursor:pointer;border-radius:6px;padding:3px 4px;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
      <span class="dl-swatch" style="background:${COLORS[i]}"></span>
      <span class="dl-name">${s.label}</span>
      <span class="dl-count" style="color:var(--primary);font-weight:700;cursor:pointer">${count}</span>
    </div>`;
  }).join('');
}

function renderServiceBars() {
  const total = Math.max(state.clients.length, 1);
  document.getElementById('svc-bars').innerHTML = SERVICES.map((s,i) => {
    const count = state.clients.reduce((a,c) => a + (c.cells[s.key] === 'done' ? 1 : 0), 0);
    return `<div class="svc-bar-row" onclick="openServiceModal('${s.key}','${s.label}')" style="cursor:pointer;border-radius:6px;padding:3px 4px;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
      <span class="svc-bar-name">${s.label}</span>
      <div class="svc-bar-track"><div class="svc-bar-fill" style="width:${Math.round(count/total*100)}%;background:${COLORS[i]}"></div></div>
      <span class="svc-bar-count">${count}</span>
    </div>`;
  }).join('');
}

// ─── Service Count Modal ──────────────────────────────────────────────────────
function openServiceModal(serviceKey, serviceLabel) {
  const svc = SERVICES.find(s => s.key === serviceKey);
  const done    = state.clients.filter(c => c.cells[serviceKey] === 'done');
  const pending = state.clients.filter(c => c.cells[serviceKey] === 'pending');
  const urgent  = state.clients.filter(c => c.cells[serviceKey] === 'urgent');
  // Only show "not started" for clients that have an opp but no cell status
  const none    = state.clients.filter(c => !c.cells[serviceKey] && c.oppIndex?.[serviceKey]);

  const renderList = (clients, status, icon, color) => {
    if (!clients.length) return '';
    return `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
        ${icon} ${status} (${clients.length})
      </div>
      ${clients.map(c => {
        const opp = c.oppIndex?.[serviceKey];
        const notes = extractNotes(opp);
        return `<div onclick="openCompanyPanel('${c.id}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;background:var(--bg2);margin-bottom:6px;border:1px solid var(--border);transition:border-color .15s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:32px;height:32px;border-radius:8px;background:${clientColor(c.name)}22;color:${clientColor(c.name)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex-shrink:0">${c.initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
            ${notes ? `<div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${notes}</div>` : ''}
          </div>
          <i class="ti ti-chevron-right" style="color:var(--text3);font-size:14px;flex-shrink:0"></i>
        </div>`;
      }).join('')}
    </div>`;
  };

  document.getElementById('svc-modal-title').textContent = serviceLabel;
  document.getElementById('svc-modal-stats').innerHTML = `
    <span style="color:var(--green)">✓ ${done.length} done</span>
    <span style="color:var(--yellow)">⏱ ${pending.length} pending</span>
    ${urgent.length ? `<span style="color:var(--red)">⚠ ${urgent.length} urgent</span>` : ''}
    ${none.length ? `<span style="color:var(--text3)">— ${none.length} not started</span>` : ''}
  `;
  document.getElementById('svc-modal-body').innerHTML =
    renderList(done, 'Completed', '✓', 'var(--green)') +
    renderList(urgent, 'Urgent', '⚠', 'var(--red)') +
    renderList(pending, 'Pending', '⏱', 'var(--yellow)') +
    renderList(none, 'Not started', '—', 'var(--text3)');

  document.getElementById('svc-modal-overlay').style.display = 'flex';
}

function extractNotes(opp) {
  if (!opp) return '';
  const fields = opp.customFields || [];
  for (const f of fields) {
    if (f.fieldValueString && f.fieldValueString.length > 3) return f.fieldValueString.slice(0, 80);
  }
  return opp.stage || '';
}

function closeSvcModal(e) {
  if (e && e.target !== document.getElementById('svc-modal-overlay')) return;
  document.getElementById('svc-modal-overlay').style.display = 'none';
}


// ─── Service groups for company panel ────────────────────────────────────────
const SERVICE_GROUPS = [
  {
    id: 'annual',
    label: '2026 Annual Compliance',
    icon: 'ti-calendar-check',
    keys: ['filing_2290','filing_ucr','filing_ifta_license','filing_business_name',
           'filing_clearinghouse','filing_nm_permit','filing_irp_cab_card','filing_mcs150','filing_ky_vehicle'],
  },
  {
    id: 'ifta2026',
    label: 'IFTA 2026',
    icon: 'ti-file-invoice',
    keys: ['ifta_q1_2026','ifta_q2_2026'],
    collapsed: false,
  },
  {
    id: 'ifta2025',
    label: 'IFTA 2025',
    icon: 'ti-file-invoice',
    keys: ['ifta_q4_2025','ifta_q3_2025','ifta_q2_2025','ifta_q1_2025'],
    collapsed: true,
  },
  {
    id: 'ifta2024',
    label: 'IFTA 2024',
    icon: 'ti-file-invoice',
    keys: ['ifta_q4_2024'],
    collapsed: true,
  },
  {
    id: 'onboard',
    label: 'Onboarding',
    icon: 'ti-rocket',
    keys: ['new_company_setup','prorate_account','clearinghouse_setup'],
  },
  {
    id: 'other',
    label: 'Other Services',
    icon: 'ti-dots',
    keys: ['boi_filing','new_prorate_account','ifta_audit'],
  },
];

function buildServicesList(client) {
  let html = '';
  for (const group of SERVICE_GROUPS) {
    // Only include services that have activity
    const activeServices = group.keys
      .map(key => ({ key, svc: SERVICES.find(s => s.key === key) }))
      .filter(({ key }) => client.cells[key] || client.oppIndex?.[key]);

    if (!activeServices.length) continue;

    // Determine group-level status
    const statuses = activeServices.map(({ key }) => client.cells[key] || 'none');
    const hasPending = statuses.some(s => s === 'pending');
    const hasUrgent  = statuses.some(s => s === 'urgent');
    const allDone    = statuses.every(s => s === 'done');
    const doneCount  = statuses.filter(s => s === 'done').length;

    const groupStatusIcon = hasUrgent ? '⚠' : hasPending ? '⏱' : allDone ? '✓' : '⏱';
    const groupStatusColor = hasUrgent ? 'var(--red)' : hasPending ? 'var(--yellow)' : 'var(--green)';
    const groupBadge = hasUrgent
      ? `<span style="color:var(--red);font-size:11px;font-weight:700">⚠ Urgent</span>`
      : hasPending
      ? `<span style="color:var(--yellow);font-size:11px;font-weight:700">⏱ ${doneCount}/${activeServices.length}</span>`
      : `<span style="color:var(--green);font-size:11px;font-weight:700">✓ All done</span>`;

    const isCollapsed = group.collapsed !== false && !hasUrgent;
    const groupId = `grp-${client.id}-${group.id}`;

    // Build individual service rows
    const rowsHtml = activeServices.map(({ key, svc }) => {
      const status = client.cells[key] || 'none';
      const opp    = client.oppIndex?.[key];
      const statusColor = { done:'var(--green)', pending:'var(--yellow)', urgent:'var(--red)', none:'var(--text3)' }[status];
      const statusIcon  = { done:'ti-check', pending:'ti-clock', urgent:'ti-alert-triangle', none:'ti-minus' }[status];

      const fields = opp?.customFields || [];
      const fieldItems = fields.map(f => {
        if (f.fieldValueString && f.fieldValueString.trim()) {
          return `<div class="cp-field-item">
            <span class="cp-field-val">${f.fieldValueString}</span>
            <button class="cp-copy-btn" onclick="copyText('${escapeAttr(f.fieldValueString)}')">
              <i class="ti ti-copy"></i> Copy
            </button>
          </div>`;
        }
        if (f.fieldValueArray && f.fieldValueArray.length) {
          return `<div class="cp-field-item"><span class="cp-field-val">${f.fieldValueArray.join(', ')}</span></div>`;
        }
        if (f.fieldValueFiles && f.fieldValueFiles.length) {
          return f.fieldValueFiles.filter(file => !file.deleted).map(file =>
            `<div class="cp-field-item">
              <i class="ti ti-paperclip" style="color:var(--blue);font-size:11px"></i>
              <a href="${file.url}" target="_blank" style="color:var(--blue);font-size:11px;text-decoration:none">${file.meta?.name || 'File'}</a>
            </div>`
          ).join('');
        }
        return '';
      }).filter(Boolean).join('');

      return `<div class="cp-service-row" style="margin-left:12px;margin-bottom:6px">
        <div class="cp-svc-header">
          <div style="display:flex;align-items:center;gap:8px">
            <i class="ti ${statusIcon}" style="color:${statusColor};font-size:13px"></i>
            <span class="cp-svc-name" style="font-size:12px">${svc?.label || key}</span>
            ${opp?.id ? `<span class="cp-opp-id">GHL: ${opp.id.slice(-6)}</span>` : ''}
          </div>
          <span class="cp-svc-status" style="color:${statusColor};background:${statusColor}22;font-size:10px">${status}</span>
        </div>
        ${fieldItems ? `<div class="cp-fields">${fieldItems}</div>` : ''}
      </div>`;
    }).join('');

    html += `
      <div class="cp-group" style="margin-bottom:10px">
        <div class="cp-group-header" onclick="toggleGroup('${groupId}')"
          style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#1a3020;border:1px solid #2a4030;border-radius:10px;cursor:pointer;user-select:none;transition:border-color .15s"
          onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='#2a4030'">
          <div style="display:flex;align-items:center;gap:8px">
            <i class="ti ${group.icon}" style="color:${groupStatusColor};font-size:14px"></i>
            <span style="font-size:13px;font-weight:700;color:var(--text)">${group.label}</span>
            ${groupBadge}
          </div>
          <i class="ti ti-chevron-${isCollapsed ? 'down' : 'up'}" id="${groupId}-icon" style="color:var(--text3);font-size:14px"></i>
        </div>
        <div id="${groupId}" style="display:${isCollapsed ? 'none' : 'block'};padding-top:6px">
          ${rowsHtml}
        </div>
      </div>`;
  }
  return html || '<div style="color:var(--text3);font-size:13px;padding:16px 0">No services recorded yet.</div>';
}

function toggleGroup(groupId) {
  const el   = document.getElementById(groupId);
  const icon = document.getElementById(groupId + '-icon');
  if (!el) return;
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  if (icon) icon.className = `ti ti-chevron-${isHidden ? 'up' : 'down'}`;
}

// ─── Company Detail Panel ─────────────────────────────────────────────────────
function openCompanyPanel(clientId) {
  // close any open service modal first
  document.getElementById('svc-modal-overlay').style.display = 'none';

  const client = state.clients.find(c => c.id === clientId);
  if (!client) return;

  const color = clientColor(client.name);
  const tags = (client.tags || []).filter(t => t);

  // Build services list with IFTA grouping
  const servicesHtml = buildServicesList(client);

  // Contact info section
  const contactInfo = [
    client.phone ? `<div class="cp-info-row"><i class="ti ti-phone"></i><span>${client.phone}</span><button class="cp-copy-btn" onclick="copyText('${client.phone}')"><i class="ti ti-copy"></i></button></div>` : '',
    client.email ? `<div class="cp-info-row"><i class="ti ti-mail"></i><span>${client.email}</span><button class="cp-copy-btn" onclick="copyText('${client.email}')"><i class="ti ti-copy"></i></button></div>` : '',
  ].filter(Boolean).join('');

  const completedCount = SERVICES.filter(s => client.cells[s.key] === 'done').length;
  const pendingCount   = SERVICES.filter(s => client.cells[s.key] === 'pending').length;
  const urgentCount    = SERVICES.filter(s => client.cells[s.key] === 'urgent').length;

  document.getElementById('company-panel').innerHTML = `
    <div class="cp-header">
      <button class="cp-close-btn" onclick="closeCompanyPanel()"><i class="ti ti-x"></i></button>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="width:52px;height:52px;border-radius:14px;background:${color}22;color:${color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0">${client.initials}</div>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">${client.name}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${client.business_name || ''}</div>
        </div>
      </div>
      ${contactInfo}
      ${tags.length || (client.oppTags||[]).length ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:12px">
        ${tags.map(t => `<span class="cp-tag">${t}</span>`).join('')}
        ${(client.oppTags||[]).map(t => `<span class="cp-tag" style="background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#f87171">${t}</span>`).join('')}
        ${client.mcs150MileageYear ? `<span class="cp-tag" style="background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.3);color:var(--yellow)">MCS-150 Year: ${client.mcs150MileageYear}</span>` : ''}
      </div>` : ''}
      <div class="cp-score-row">
        <span style="color:var(--green)"><i class="ti ti-check"></i> ${completedCount} done</span>
        <span style="color:var(--yellow)"><i class="ti ti-clock"></i> ${pendingCount} pending</span>
        ${urgentCount ? `<span style="color:var(--red)"><i class="ti ti-alert-triangle"></i> ${urgentCount} urgent</span>` : ''}
      </div>
    </div>
    <div class="cp-body">
      <div class="cp-section-title">Service Details</div>
      ${servicesHtml || '<div style="color:var(--text3);font-size:13px;padding:16px 0">No services recorded yet.</div>'}
    </div>
  `;

  document.getElementById('company-panel-overlay').classList.add('open');
}

function closeCompanyPanel() {
  document.getElementById('company-panel-overlay').classList.remove('open');
}

function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/"/g, '\\"');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied!')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    toast('Copied!');
  });
}

// ─── Compliance Table ─────────────────────────────────────────────────────────
// ── Compliance new card-list renderer ────────────────────────────────────────
let compExpandedIds = new Set(); // track which cards are expanded
let compSegmentFilter = 'all';   // 'all' | 'advance' | 'recurring'
let compSearchQuery   = '';

function compSearch(q) {
  compSearchQuery = (q || '').toLowerCase().trim();
  applyFilter();
  renderComplianceTable();
}

function setSegmentFilter(btn, seg) {
  compSegmentFilter = seg;
  // Update button styles
  ['all','advance','recurring'].forEach(s => {
    const b = document.getElementById('seg-btn-' + s);
    if (!b) return;
    if (s === seg) { b.style.background = 'var(--primary)'; b.style.color = '#0a1a0f'; b.style.border = 'none'; b.style.fontWeight = '700'; }
    else { b.style.background = 'var(--bg3)'; b.style.color = 'var(--text)'; b.style.border = '1px solid var(--border)'; b.style.fontWeight = '400'; }
  });
  applyFilter();
  renderComplianceTable(); // re-render with new segment filter applied
}

function toggleCompCard(id) {
  if (compExpandedIds.has(id)) compExpandedIds.delete(id);
  else compExpandedIds.add(id);
  const panel  = document.getElementById('comp-expand-' + id);
  const chev   = document.getElementById('comp-chev-' + id);
  if (panel) panel.style.display = compExpandedIds.has(id) ? 'block' : 'none';
  if (chev)  chev.style.transform = compExpandedIds.has(id) ? 'rotate(180deg)' : 'rotate(0deg)';
}

function renderComplianceTable() {
  const visibleServices = state.groupFilter === 'all'
    ? SERVICES
    : SERVICES.filter(s => s.group === state.groupFilter);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const allClients = state.clients || [];
  const advCount  = allClients.filter(c => (c.tags||[]).some(t => /advance/i.test(t))).length;
  const recCount  = allClients.filter(c => (c.tags||[]).some(t => /recurring/i.test(t))).length;

  const setSafe = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  setSafe('seg-count-all',       allClients.length);
  setSafe('seg-count-advance',   advCount);
  setSafe('seg-count-recurring', recCount);

  // Apply segment filter on top of existing state.filtered
  let clients = state.filtered;
  if (compSegmentFilter === 'advance')   clients = clients.filter(c => (c.tags||[]).some(t => /advance/i.test(t)));
  if (compSegmentFilter === 'recurring') clients = clients.filter(c => (c.tags||[]).some(t => /recurring/i.test(t)));
  if (compSearchQuery) clients = clients.filter(c =>
    (c.name||'').toLowerCase().includes(compSearchQuery) ||
    (c.dot_number||'').includes(compSearchQuery) ||
    (c.business_name||'').toLowerCase().includes(compSearchQuery)
  );

  const urgentCount  = clients.filter(c => SERVICES.some(s => c.cells[s.key] === 'urgent')).length;
  const onTrackCount = clients.filter(c => {
    const done = SERVICES.filter(s => c.cells[s.key] === 'done').length;
    return done / SERVICES.length >= 0.5;
  }).length;
  const onTrackPct = clients.length ? Math.round(onTrackCount / clients.length * 100) : 0;

  setSafe('stat-carriers-num', clients.length);
  setSafe('stat-urgent-num',   urgentCount);
  setSafe('stat-ontrack-pct',  onTrackPct + '%');
  setSafe('comp-count',        clients.length + ' of ' + allClients.length + ' contacts');
  const sub = document.getElementById('comp-subtitle');
  if (sub) sub.textContent = allClients.length + ' tracked customers · ' + (state.clients?.length || 0) + ' total in GoHighLevel';

  // ── Client cards ──────────────────────────────────────────────────────────
  const list = document.getElementById('compliance-list');
  if (!list) return;

  if (!clients.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3);font-size:13px">No contacts match current filters</div>';
    return;
  }

  list.innerHTML = clients.map(client => {
    const done      = SERVICES.filter(s => client.cells[s.key] === 'done').length;
    const hasUrgent = SERVICES.some(s => client.cells[s.key] === 'urgent');
    const hasPending = SERVICES.some(s => !client.cells[s.key] || client.cells[s.key] === 'pending');
    const sc        = scoreColor(done, SERVICES.length);
    const color     = clientColor(client.name);
    const isExp     = compExpandedIds.has(client.id);
    const encName   = encodeURIComponent(client.name);
    const tags      = (client.tags||[]).slice(0,3);

    // Status dot color
    const dotColor = hasUrgent ? '#ef4444' : done === SERVICES.length ? 'var(--green)' : '#f59e0b';

    // Helper to make a service pill
    const makePill = (s) => {
      const st  = client.cells[s.key] || 'pending';
      const opp = client.oppIndex?.[s.key];
      const stColors = {
        done:    { bg:'rgba(0,196,106,.12)', col:'var(--green)', bdr:'rgba(0,196,106,.3)' },
        pending: { bg:'rgba(245,158,11,.08)', col:'#f59e0b',     bdr:'rgba(245,158,11,.25)' },
        urgent:  { bg:'rgba(239,68,68,.12)', col:'#ef4444',      bdr:'rgba(239,68,68,.3)' },
      };
      const c2   = stColors[st] || stColors.pending;
      const icon = st==='done' ? '✓' : st==='urgent' ? '⚠' : '○';
      return `<div onclick="event.stopPropagation();openCellModal('${client.id}','${encName}','${s.key}','${s.label}','${st}','${opp?.id||''}')"
        title="${s.label} — ${st}"
        style="background:${c2.bg};border:1px solid ${c2.bdr};color:${c2.col};
               border-radius:7px;padding:5px 10px;font-size:11px;font-weight:600;cursor:pointer;
               display:flex;align-items:center;gap:5px;white-space:nowrap">
        <span style="font-size:10px">${icon}</span>${s.short}
      </div>`;
    };

    // Service categories for card view
    // Onboard (Step1/2/3) removed; Prorate + IFTA Audit in full details only
    const CARD_HIDDEN = new Set(['new_company_setup','prorate_account','clearinghouse_setup','new_prorate_account','ifta_audit']);
    const annualSvcs  = SERVICES.filter(s => s.group === 'annual');
    const iftaSvcs    = SERVICES.filter(s => s.group === 'ifta');
    const otherSvcs   = SERVICES.filter(s => s.group !== 'annual' && s.group !== 'ifta' && !CARD_HIDDEN.has(s.key));

    // IFTA summary badge for the toggle button
    const iftaDone    = iftaSvcs.filter(s => client.cells[s.key] === 'done').length;
    const iftaUrgent  = iftaSvcs.some(s => client.cells[s.key] === 'urgent');
    const iftaBadgeC  = iftaUrgent ? '#ef4444' : iftaDone === iftaSvcs.length ? 'var(--green)' : '#f59e0b';

    const expandedHtml = `
      <!-- Annual services -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${annualSvcs.map(s => makePill(s)).join('')}
      </div>

      <!-- IFTA Quarterly — collapsible -->
      <div style="margin-bottom:10px">
        <button onclick="event.stopPropagation();var p=this.nextElementSibling;p.style.display=p.style.display==='none'?'flex':'none';this.querySelector('.ifta-chev').style.transform=p.style.display!=='none'?'rotate(180deg)':'rotate(0deg)'"
          style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:#f59e0b;
                 border-radius:7px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;
                 display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <i class="ti ti-chart-bar" style="font-size:12px"></i>
          IFTA Quarterly
          <span style="font-size:10px;opacity:.7">${iftaDone}/${iftaSvcs.length}</span>
          <i class="ti ti-chevron-down ifta-chev" style="font-size:12px;transition:transform .2s"></i>
        </button>
        <div style="display:none;flex-wrap:wrap;gap:6px">
          ${iftaSvcs.map(s => makePill(s)).join('')}
        </div>
      </div>

      <!-- Other services (BOI etc) — not onboard/prorate/audit -->
      ${otherSvcs.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${otherSvcs.map(s => makePill(s)).join('')}</div>` : ''}

      <button onclick="event.stopPropagation();openCompanyPanel('${client.id}')"
        style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:7px;
               padding:6px 14px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:5px">
        <i class="ti ti-external-link"></i> View full details
      </button>`;

    return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color .15s"
         onmouseover="this.style.borderColor='rgba(0,196,106,.25)'" onmouseout="this.style.borderColor='var(--border)'">
      <!-- Card header — always visible -->
      <div onclick="toggleCompCard('${client.id}')"
        style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer">
        <div style="width:36px;height:36px;border-radius:10px;background:${color}22;color:${color};
                    font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${client.initials}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${client.name}
            ${hasUrgent ? '<span style="background:#ef4444;color:#fff;border-radius:4px;padding:1px 7px;font-size:9px;font-weight:800;letter-spacing:.04em">DUE</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${client.dot_number ? '<span>DOT# ' + client.dot_number + '</span>' : ''}
            ${tags.map(t => `<span style="background:rgba(0,196,106,.1);color:var(--green);border:1px solid rgba(0,196,106,.2);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;text-transform:uppercase">${t}</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
            <span style="font-size:14px;font-weight:800;color:${sc.col}">${done}/${SERVICES.length}</span>
          </div>
          <i class="ti ti-chevron-down" id="comp-chev-${client.id}"
            style="color:var(--text3);font-size:14px;transition:transform .2s;${isExp?'transform:rotate(180deg)':''}"></i>
        </div>
      </div>
      <!-- Expanded detail -->
      <div id="comp-expand-${client.id}" style="display:${isExp?'block':'none'};padding:12px 16px 14px;border-top:1px solid var(--border);background:var(--bg3)">
        ${expandedHtml}
      </div>
    </div>`;
  }).join('');

  // Also keep hidden tbody for CSV export
  document.getElementById('compliance-tbody').innerHTML = clients.map(client => {
    const allCells = SERVICES.map(s => client.cells[s.key] || 'pending');
    const done = allCells.filter(v => v === 'done').length;
    const sc = scoreColor(done, SERVICES.length);
    return `<tr data-id="${client.id}">
      <td>${client.name}</td>
      <td>${done}/${SERVICES.length}</td>
      ${SERVICES.map(s => `<td>${client.cells[s.key]||'pending'}</td>`).join('')}
    </tr>`;
  }).join('');
}

function badgeClass(s) { return {done:'b-done', pending:'b-pending', urgent:'b-urgent'}[s] || 'b-na'; }
function badgeIcon(s) {
  if (s === 'done')    return '<i class="ti ti-check" style="font-size:12px"></i>';
  if (s === 'pending') return '<i class="ti ti-clock" style="font-size:12px"></i>';
  if (s === 'urgent')  return '<i class="ti ti-alert-triangle" style="font-size:12px"></i>';
  return '—';
}
function scoreColor(done, total) {
  const p = done / total;
  if (p >= 0.8) return { bg:'var(--greenL)', col:'var(--green)' };
  if (p >= 0.5) return { bg:'var(--yellowL)', col:'var(--yellow)' };
  return { bg:'var(--redL)', col:'var(--red)' };
}
const COLOR_POOL = ['#00C46A','#1E88E5','#00BCD4','#8B5CF6','#F59E0B','#42A5F5','#EF4444'];
const colorCache = {};
function clientColor(name) {
  if (!colorCache[name]) colorCache[name] = COLOR_POOL[Object.keys(colorCache).length % COLOR_POOL.length];
  return colorCache[name];
}

// ─── Cell click modal ─────────────────────────────────────────────────────────
let cellCtx = null;
function openCellModal(clientId, encodedName, serviceKey, serviceLabel, currentStatus, oppId) {
  const clientName = decodeURIComponent(encodedName);
  cellCtx = { clientId, clientName, serviceKey, serviceLabel, currentStatus, oppId };
  const isMCS = serviceKey === 'filing_mcs150';
  document.getElementById('cell-modal-title').innerHTML =
    `<i class="ti ti-edit" style="color:var(--orange)"></i>${clientName} — ${serviceLabel}`;
  const oppLink = oppId
    ? `<div style="margin-bottom:12px;font-size:11px;color:var(--text3)">GHL Opp ID: <span style="color:var(--blue);font-family:monospace">${oppId}</span></div>`
    : `<div style="margin-bottom:12px;font-size:11px;color:var(--yellow)"><i class="ti ti-alert-triangle"></i> No GHL opportunity yet — will be created on first update</div>`;
  document.getElementById('cell-modal-body').innerHTML = `
    ${oppLink}
    <button class="status-option opt-done" onclick="updateCellStatus('done')">
      <span class="cell-badge b-done"><i class="ti ti-check" style="font-size:12px"></i></span>
      Mark complete — moves GHL opp to <strong>Won</strong>
    </button>
    <button class="status-option opt-pending" onclick="updateCellStatus('pending')">
      <span class="cell-badge b-pending"><i class="ti ti-clock" style="font-size:12px"></i></span>
      Set pending — moves GHL opp to <strong>Open</strong>
    </button>
    <button class="status-option opt-urgent" onclick="updateCellStatus('urgent')">
      <span class="cell-badge b-urgent"><i class="ti ti-alert-triangle" style="font-size:12px"></i></span>
      Flag urgent — moves GHL opp to <strong>In Progress</strong>
    </button>
    ${isMCS ? `
    <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px">FMCSA Support fields</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);margin-bottom:7px;cursor:pointer">
        <input type="checkbox" id="fmcsa-mileage-outdated"> Mileage Year Outdated
      </label>
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);margin-bottom:10px;cursor:pointer">
        <input type="checkbox" id="fmcsa-form-outdated"> MCS-150 Form Date Outdated
      </label>
      <select id="fmcsa-issues" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:7px 10px;color:var(--text);font-size:12px;font-family:inherit;margin-bottom:10px">
        <option value="">Issues Updating MCS-150</option>
        <option>FMCSA Login Problem</option>
        <option>Mileage Year Outdated</option>
        <option>MCS-150 Form Date Outdated</option>
        <option>ATS Members</option>
        <option>Other</option>
      </select>
      <textarea id="fmcsa-notes" placeholder="MCS-150 Update Latest Notes"
        style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);font-size:12px;font-family:inherit;resize:vertical;min-height:80px"></textarea>
    </div>` : ''}
  `;
  document.getElementById('cell-modal-overlay').style.display = 'flex';
}

async function updateCellStatus(newStatus) {
  if (!cellCtx) return;
  const { clientId, clientName, serviceKey, serviceLabel, currentStatus, oppId } = cellCtx;
  closeCellModal();
  if (newStatus === currentStatus && oppId) return;
  const client = state.clients.find(c => c.id === clientId);
  if (client) { client.cells[serviceKey] = newStatus; applyFilter(); renderComplianceTable(); renderDashboard(); updateUrgentBadge(); }
  try {
    let activeOppId = oppId;
    if (!activeOppId) {
      const created = await GHL.createOpportunity(clientId, serviceKey, clientName, client?.name, client?.dot_number);
      activeOppId = created.opportunity?.id;
      if (client && activeOppId) {
        if (!client.oppIndex) client.oppIndex = {};
        client.oppIndex[serviceKey] = { id: activeOppId, stage: 'Open', status: 'open', tags: [], customFields: [] };
      }
    }
    let notes = '';
    if (serviceKey === 'filing_mcs150') {
      notes = document.getElementById('fmcsa-notes')?.value || '';
      const mileageOutdated = document.getElementById('fmcsa-mileage-outdated')?.checked;
      const formOutdated    = document.getElementById('fmcsa-form-outdated')?.checked;
      const issues          = document.getElementById('fmcsa-issues')?.value;
      if ((mileageOutdated || formOutdated || issues) && activeOppId) {
        await GHL.updateOppFields(activeOppId, serviceKey, { mileage_year_outdated: mileageOutdated, mcs150_form_date_outdated: formOutdated, issues, notes });
      }
    }
    if (activeOppId) await GHL.updateOppStatus(activeOppId, newStatus, serviceKey, notes);
    if (activeOppId) await GHL.addOppNote(activeOppId, `${serviceLabel} updated: "${currentStatus}" → "${newStatus}"`);
    const iconMap = { done:'green', urgent:'red', pending:'orange' };
    logActivity(iconMap[newStatus] || 'blue', `<strong>${clientName}</strong> — ${serviceLabel} → <strong>${newStatus}</strong>`);
    toast(`${serviceLabel} updated in GHL`);
  } catch (err) {
    if (client) { client.cells[serviceKey] = currentStatus; applyFilter(); renderComplianceTable(); }
    showError(`GHL update failed: ${err.message}`);
  }
}
function closeCellModal(e) {
  if (e && e.target !== document.getElementById('cell-modal-overlay')) return;
  document.getElementById('cell-modal-overlay').style.display = 'none';
  cellCtx = null;
}

// ─── Add Client ───────────────────────────────────────────────────────────────
function openAddClient() {
  document.getElementById('modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('f-name').focus(), 50);
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('add-client-form').reset();
}
async function submitAddClient(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i>Creating in GHL...';
  const payload = {
    name: document.getElementById('f-name').value.trim(),
    business_name: document.getElementById('f-biz').value.trim(),
    mc_number: document.getElementById('f-mc').value.trim(),
    dot_number: document.getElementById('f-dot').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    email: document.getElementById('f-email').value.trim(),
  };
  try {
    const newClient = await GHL.createContact(payload);
    state.clients.unshift(newClient);
    buildTagList();
    applyFilter(); renderDashboard(); renderComplianceTable(); updateUrgentBadge();
    closeModal();
    logActivity('blue', `<strong>${payload.name}</strong> added as new GHL contact`);
    toast(`${payload.name} created in GoHighLevel`);
  } catch (err) {
    showError(`Failed to create in GHL: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-brand-hipchat"></i>Create in GoHighLevel';
  }
}

// ─── Deadlines ────────────────────────────────────────────────────────────────
function renderDeadlines() {
  const now = new Date();
  document.getElementById('deadline-cards').innerHTML = DEADLINES.map(d => {
    const due  = new Date(d.date);
    const diff = Math.ceil((due - now) / 86400_000);
    const badgeTxt = diff < 0 ? 'Overdue' : diff === 0 ? 'Due today' : `${diff} days`;
    const badgeStyle = diff <= 14 ? 'background:var(--redL);color:var(--red)'
      : diff <= 45 ? 'background:var(--yellowL);color:var(--yellow)'
      : 'background:var(--greenL);color:var(--green)';
    return `<div class="deadline-card">
      <div class="dc-header">
        <div class="dc-service">${d.service}</div>
        <span class="dc-badge" style="${badgeStyle}">${badgeTxt}</span>
      </div>
      <div class="dc-date"><i class="ti ti-calendar" style="font-size:13px"></i>
        ${due.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
      </div>
      <div class="dc-clients" style="font-size:11px;color:var(--text3)">${d.cadence} · ${d.note}</div>
    </div>`;
  }).join('');
}

// ─── Activity feed ────────────────────────────────────────────────────────────
function logActivity(type, text) {
  const M = { green:{cls:'green',icon:'ti-circle-check'}, orange:{cls:'orange',icon:'ti-edit'},
    red:{cls:'red',icon:'ti-alert-circle'}, blue:{cls:'blue',icon:'ti-user-plus'},
    sync:{cls:'blue',icon:'ti-refresh'}, warning:{cls:'orange',icon:'ti-alert-triangle'} };
  const { cls, icon } = M[type] || M.blue;
  const timeStr = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  state.activity.unshift({ cls, icon, text, time:`Today, ${timeStr}` });
  if (state.activity.length > 12) state.activity.pop();
  const feed = document.getElementById('activity-feed');
  if (feed) {
    feed.innerHTML = state.activity.map(a => `
      <div class="act-item">
        <div class="act-icon ${a.cls}"><i class="ti ${a.icon}"></i></div>
        <div><div class="act-text">${a.text}</div><div class="act-time">${a.time}</div></div>
      </div>`).join('');
  }
}

// ─── Urgent badge ─────────────────────────────────────────────────────────────
function updateUrgentBadge() {
  const count = state.clients.reduce((a,c) => a + Object.values(c.cells).filter(v=>v==='urgent').length, 0);
  const b = document.getElementById('nb-urgent');
  b.textContent = count;
  b.style.display = count > 0 ? '' : 'none';
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportCSV() {
  const header = ['Company','MC Number','DOT Number','Score',...SERVICES.map(s=>s.label),'GHL Opp IDs'];
  const rows = state.clients.map(c => {
    const cells = SERVICES.map(s => c.cells[s.key] || 'pending');
    const done  = cells.filter(v=>v==='done').length;
    const oppIds = SERVICES.map(s => c.oppIndex?.[s.key]?.id || '').join('|');
    return [c.name, c.mc_number, c.dot_number, `${done}/${cells.length}`, ...cells, oppIds].join(',');
  });
  const blob = new Blob([header.join(',')+'\n'+rows.join('\n')],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ats_compliance_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast('Exported to CSV');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function showLoading(show) {
  document.getElementById('loading-screen').style.display = show ? 'flex' : 'none';
  document.getElementById('page-content').style.display   = show ? 'none' : 'block';
}
function showError(msg) {
  const b = document.getElementById('error-banner');
  document.getElementById('error-msg').textContent = msg;
  b.style.display = 'flex';
  setTimeout(()=>{ b.style.display='none'; }, 7000);
}
function toast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.style.display = 'flex';
  clearTimeout(window._tt);
  window._tt = setTimeout(()=>{ t.style.display='none'; }, 2800);
}

// ─── DOT Lookup ───────────────────────────────────────────────────────────────
let dotCurrentInfo  = null;
let dotSelectedGHL  = null;

async function dotLookup() {
  const dot = String(document.getElementById('dot-search-input').value || '').trim().replace(/\D/g,'');
  if (!dot) return;

  const status = document.getElementById('dot-search-status');
  status.textContent = 'Searching FMCSA...';
  status.style.color = 'var(--text3)';
  document.getElementById('dot-result').style.display  = 'none';
  document.getElementById('dot-no-key').style.display  = 'none';

  try {
    const res  = await fetch(`/api/dot/${dot}`);
    const data = await res.json();

    if (!res.ok) {
      if (data.help) {
        document.getElementById('dot-no-key').style.display = 'block';
        status.textContent = '';
      } else {
        status.textContent = `Error: ${data.error}`;
        status.style.color = 'var(--red)';
      }
      return;
    }

    dotCurrentInfo = data.info;

    // Block inactive/revoked carriers
    const inactiveStatuses = ['N', 'I', 'S'];
    if (inactiveStatuses.includes(data.info.operating_status)) {
      const statusLabels = { 'N':'NOT AUTHORIZED', 'I':'INACTIVE', 'S':'OUT OF SERVICE' };
      status.textContent = '';
      document.getElementById('dot-result').style.display = 'none';
      document.getElementById('dot-no-key').style.display = 'block';
      document.getElementById('dot-no-key').innerHTML = `
        <i class="ti ti-ban" style="font-size:28px;color:var(--red);display:block;margin-bottom:8px"></i>
        <div style="font-size:15px;font-weight:700;color:var(--red);margin-bottom:6px">
          Carrier is ${statusLabels[data.info.operating_status] || 'INACTIVE'}
        </div>
        <div style="font-size:13px;color:var(--text2);margin-bottom:8px">
          <strong>${data.info.legal_name}</strong> (DOT# ${data.info.dot_number})
        </div>
        <div style="font-size:12px;color:var(--text3)">
          This carrier's operating authority is not active in FMCSA SAFER.<br>
          No carrier information will be loaded.
        </div>`;
      return;
    }

    renderDotResult(data.info);
    document.getElementById('dot-result').style.display  = 'block';
    // Always show create section as soon as we have FMCSA data
    const createSec = document.getElementById('dot-create-section');
    if (createSec) createSec.style.display = 'block';
    // Show company name that will be created
    const previewEl = document.getElementById('dot-create-preview');
    if (previewEl) previewEl.textContent = data.info.legal_name ? `→ ${data.info.legal_name}  (DOT# ${data.info.dot_number})` : '';
    // Reset push status
    document.getElementById('dot-push-status').innerHTML = '';
    status.textContent = `✓ Found: ${data.info.legal_name}`;
    status.style.color = 'var(--green)';

    // Auto-search GHL for matching contact
    dotSearchGHL(data.info.legal_name);

  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    status.style.color = 'var(--red)';
  }
}

function renderDotResult(info) {
  const field = (label, value, urgent) => {
    if (!value && value !== 0) return '';
    const safeVal = String(value).replace(/'/g, "\\'");
    const color = urgent ? 'var(--red)' : 'var(--text)';
    return `<div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${label}</div>
      <div style="font-size:13px;font-weight:600;color:${color};display:flex;align-items:center;gap:6px">
        ${urgent ? '<i class="ti ti-alert-triangle" style="color:var(--red)"></i>' : ''}
        ${value}
        <button onclick="copyText('${safeVal}')" style="background:none;border:none;cursor:pointer;color:var(--text3);padding:0;font-size:11px" title="Copy">
          <i class="ti ti-copy"></i>
        </button>
      </div>
    </div>`;
  };

  const currentYear = new Date().getFullYear();
  const mileageYear = parseInt(info.mcs150_year) || 0;
  const mileageUrgent = mileageYear && (currentYear - mileageYear) >= 2;

  // Translate status code
  const osLabels = { 'A':'AUTHORIZED', 'N':'NOT AUTHORIZED', 'I':'INACTIVE', 'S':'OUT-OF-SERVICE' };
  const osDisplay = osLabels[info.operating_status] || info.operating_status || 'AUTHORIZED';
  const statusColor = (info.operating_status === 'A' || !info.operating_status) ? 'var(--green)' : 'var(--red)';

  const mcs150OutdatedBadge = info.mcs150_outdated
    ? `<span style="background:rgba(239,68,68,.15);color:var(--red);font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;margin-left:6px">OUTDATED</span>` : '';

  document.getElementById('dot-info-left').innerHTML =
    field('USDOT Number', info.dot_number) +
    field('Legal Name', info.legal_name) +
    field('DBA Name', info.dba_name) +
    field('MC / FF Number', info.mc_number) +
    field('Entity Type', info.entity_type) +
    field('EIN', info.ein) +
    field('Phone', info.phone) +
    field('Email', info.email) +
    field('Mailing Address', info.mailing_address);

  document.getElementById('dot-info-right').innerHTML =
    field('Physical Address', info.physical_address) +
    `<div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Operating Status</div>
      <div style="font-size:13px;font-weight:700;color:${statusColor}">${osDisplay}</div>
    </div>` +
    field('Safety Rating', info.safety_rating) +
    field('Power Units', info.power_units) +
    field('Drivers', info.drivers) +
    field('Total Crashes', info.crash_total) +
    `<div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">MCS-150 Last Update ${mcs150OutdatedBadge}</div>
      <div style="font-size:13px;font-weight:600;color:var(--text)">${info.mcs150_date || '—'}</div>
    </div>` +
    `<div style="margin-bottom:10px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">MCS-150 Mileage Year</div>
      <div style="font-size:13px;font-weight:600;color:${mileageUrgent ? 'var(--red)' : 'var(--text)'}">
        ${info.mcs150_year || '—'}
        ${mileageUrgent ? '<span style="font-size:10px;background:rgba(239,68,68,.15);color:var(--red);padding:2px 6px;border-radius:10px;margin-left:6px">OUTDATED</span>' : ''}
      </div>
    </div>` +
    field('Current Mileage', info.mcs150_mileage ? Number(info.mcs150_mileage).toLocaleString() + ' miles' : '');
}

function dotSearchGHL(query) {
  if (!query || query.length < 2) {
    document.getElementById('dot-ghl-matches').innerHTML = '';
    return;
  }
  const q = query.toLowerCase().replace(/dot#?\s*/i,'');
  const seen = new Set();
  const matches = state.clients.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return c.name.toLowerCase().includes(q) ||
      (c.dot_number || '').includes(q) ||
      (c.business_name || '').toLowerCase().includes(q);
  }).slice(0, 6);

  // Always show create section
  const sec = document.getElementById('dot-create-section');
  if (sec) sec.style.display = 'block';

  if (!matches.length) {
    document.getElementById('dot-ghl-matches').innerHTML =
      '<div style="font-size:11px;color:var(--text3);padding:6px 0">No existing GHL contact found for this DOT.</div>';
    return;
  }

  document.getElementById('dot-ghl-matches').innerHTML = matches.map(c => {
    const isSelected = dotSelectedGHL?.id === c.id;
    // Mismatch detection: compare FMCSA data vs GHL contact data
    const mismatches = [];
    if (dotCurrentInfo) {
      const fmcsaDot  = String(dotCurrentInfo.dot_number || '').trim();
      const ghlDot    = String(c.dot_number || '').trim();
      const fmcsaName = (dotCurrentInfo.legal_name || '').trim().toUpperCase();
      const ghlName   = (c.business_name || c.name || '').trim().toUpperCase();
      const fmcsaPhone = (dotCurrentInfo.phone || '').replace(/\D/g,'');
      const ghlPhone   = (c.phone || '').replace(/\D/g,'');
      const fmcsaEmail = (dotCurrentInfo.email || '').trim().toLowerCase();
      const ghlEmail   = (c.email || '').trim().toLowerCase();
      const fmcsaAddr  = (dotCurrentInfo.mailing_address || '').trim().toUpperCase();
      const ghlAddr    = (c.mailing_address || '').trim().toUpperCase();

      if (fmcsaDot  && ghlDot  && fmcsaDot  !== ghlDot)  mismatches.push({ field:'DOT#',   fmcsa: fmcsaDot,   ghl: ghlDot });
      if (fmcsaName && ghlName && fmcsaName !== ghlName)  mismatches.push({ field:'Name',   fmcsa: fmcsaName,  ghl: ghlName });
      if (fmcsaPhone && ghlPhone && fmcsaPhone !== ghlPhone) mismatches.push({ field:'Phone', fmcsa: dotCurrentInfo.phone, ghl: c.phone });
      if (fmcsaEmail && ghlEmail && fmcsaEmail !== ghlEmail) mismatches.push({ field:'Email', fmcsa: fmcsaEmail, ghl: ghlEmail });
      if (fmcsaAddr  && ghlAddr  && fmcsaAddr  !== ghlAddr)  mismatches.push({ field:'Address', fmcsa: dotCurrentInfo.mailing_address, ghl: c.mailing_address });
    }

    const mismatchBadge = mismatches.length
      ? `<span style="font-size:9px;font-weight:800;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:4px;padding:1px 6px;white-space:nowrap">${mismatches.length} MISMATCH${mismatches.length>1?'ES':''}</span>`
      : `<span style="font-size:9px;font-weight:800;background:rgba(0,196,106,.1);color:var(--green);border:1px solid rgba(0,196,106,.3);border-radius:4px;padding:1px 6px">✓ MATCH</span>`;

    const mismatchDetail = mismatches.length ? `
      <div style="margin-top:6px;padding:8px 10px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:6px">
        <div style="font-size:10px;font-weight:700;color:#ef4444;margin-bottom:4px">⚠ Fields that differ from FMCSA:</div>
        ${mismatches.map(m => `
          <div style="font-size:10px;margin-bottom:3px;display:grid;grid-template-columns:60px 1fr 1fr;gap:4px">
            <span style="color:var(--text3);font-weight:600">${m.field}</span>
            <span style="color:#ef4444" title="GHL value">GHL: ${m.ghl || '—'}</span>
            <span style="color:var(--green)" title="FMCSA value">FMCSA: ${m.fmcsa || '—'}</span>
          </div>`).join('')}
        <button onclick="event.stopPropagation();dotSelectContact('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.dot_number||''}');dotPushToGHL()"
          style="margin-top:6px;width:100%;background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer">
          ↑ Update GHL with FMCSA Data
        </button>
      </div>` : '';

    return `<div onclick="dotSelectContact('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.dot_number||''}')"
      style="padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};background:${isSelected ? 'rgba(0,196,106,.08)' : 'var(--bg3)'};margin-bottom:6px;transition:all .15s"
      id="dot-match-${c.id}">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:30px;height:30px;border-radius:8px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--primary);flex-shrink:0">${c.initials}</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--text)">${c.name}</div>
          ${c.dot_number ? `<div style="font-size:10px;color:var(--text3)">DOT# ${c.dot_number}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${mismatchBadge}
          ${isSelected ? '<i class="ti ti-check" style="color:var(--primary)"></i>' : ''}
        </div>
      </div>
      ${mismatchDetail}
    </div>`;
  }).join('');
}

function dotSelectContact(id, name, dotNumber) {
  dotSelectedGHL = { id, name, dotNumber };
  // Re-render matches to show selection
  dotSearchGHL(document.getElementById('dot-ghl-search').value || name);
  const btn = document.getElementById('dot-push-btn');
  btn.disabled = false;
  btn.style.opacity = '1';
  document.getElementById('dot-push-status').innerHTML =
    `<span style="color:var(--green)">✓ Selected: <strong>${name}</strong></span>`;
}


async function dotCreateContact() {
  if (!dotCurrentInfo) return;
  const btn = event.currentTarget;
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i> Creating...';

  try {
    const res = await fetch(`/api/dot/${dotCurrentInfo.dot_number}/create-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ info: dotCurrentInfo }),
    });
    const data = await res.json();
    if (res.status === 409) {
      // Already exists — show warning but KEEP create section visible
      document.getElementById('dot-push-status').innerHTML = `
        <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px 14px;margin-top:8px">
          <div style="font-size:13px;font-weight:700;color:var(--yellow)"><i class="ti ti-alert-triangle"></i> Contact Already Exists</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">${data.error} — search for them above and use "Update GHL Contact" instead.</div>
        </div>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-user-plus"></i> Create New GHL Contact + Opportunities';
      return;
    }
    if (!res.ok) throw new Error(data.error);

    document.getElementById('dot-push-status').innerHTML = `
      <div style="background:rgba(0,196,106,.1);border:1px solid rgba(0,196,106,.3);border-radius:8px;padding:10px 14px;margin-top:8px">
        <div style="font-size:13px;font-weight:700;color:var(--green)"><i class="ti ti-check"></i> Contact Created Successfully!</div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">
          <strong>${dotCurrentInfo.legal_name}</strong> added to GHL with ${data.opportunitiesCreated?.length || 0} service opportunities
        </div>
      </div>`;

    toast(`${dotCurrentInfo.legal_name} created in GHL ✓`);
    logActivity('blue', `New contact <strong>${dotCurrentInfo.legal_name}</strong> created from DOT# ${dotCurrentInfo.dot_number}`);

    // Auto-create CS intake task for the new contact
    if (data.contactId) {
      await csCreateIntakeTask(data.contactId, dotCurrentInfo.legal_name);
    }

    // Refresh client list
    await GHL.refresh();
    state.clients = [];
    loadClients();
  } catch(err) {
    document.getElementById('dot-push-status').innerHTML =
      `<span style="color:var(--red)">Error: ${err.message}</span>`;
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-user-plus"></i> Create New GHL Contact + Opportunities';
  }
}

async function dotPushToGHL() {
  if (!dotSelectedGHL || !dotCurrentInfo) return;
  const btn = document.getElementById('dot-push-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin .7s linear infinite"></i> Updating...';

  try {
    const res = await fetch(`/api/dot/${dotCurrentInfo.dot_number}/push-to-ghl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId: dotSelectedGHL.id, info: dotCurrentInfo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Update local client data
    const client = state.clients.find(c => c.id === dotSelectedGHL.id);
    if (client) {
      client.dot_number = dotCurrentInfo.dot_number;
      if (dotCurrentInfo.legal_name) client.business_name = dotCurrentInfo.legal_name;
    }

    document.getElementById('dot-push-status').innerHTML =
      `<span style="color:var(--green)"><i class="ti ti-check"></i> Successfully updated <strong>${dotSelectedGHL.name}</strong> in GoHighLevel!</span>`;
    toast(`GHL contact updated with FMCSA data`);
    logActivity('blue', `FMCSA data for DOT# ${dotCurrentInfo.dot_number} pushed to <strong>${dotSelectedGHL.name}</strong>`);
  } catch (err) {
    document.getElementById('dot-push-status').innerHTML =
      `<span style="color:var(--red)">Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-cloud-upload"></i> Update GHL Contact';
    btn.style.opacity = '1';
  }
}

// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// TASKS BOARD — Dynamic supervisor/staff view
// Users pulled live from GHL. Supervisor roles stored in localStorage.
// Mahad Said Q (ghlId: yri669q8Ymx22zdFDPLK) is permanent admin.
// ═══════════════════════════════════════════════════════════════════════════

const TB_ADMIN_ID   = 'yri669q8Ymx22zdFDPLK'; // Mahad Said Q — permanent admin
const LOC_ID_FRONTEND = 'SS9SXQU94ZExykvAta0y'; // ATS GHL location ID, for deep links to GHL
const TB_PASSPHRASE = 'ATS2026admin';           // Change this to your preferred passphrase

// Supervisor color palette — assigned by index
const TB_COLORS = ['#7c3aed','#0891b2','#059669','#d97706','#e11d48','#0284c7','#7c3aed','#b45309'];

let tbState = {
  selectedSup:    null,
  tasks:          [],
  opps:           [],
  users:          [],        // all GHL users
  supervisorIds:  null,      // Set of ghlIds who are supervisors (loaded from storage)
  staffMap:       {},        // supervisorId → [staffGhlIds]
  loaded:         false,
  filterType:     'all',
  filterStatus:   'all',
  searchQuery:    '',
};

// ── Persistence helpers ────────────────────────────────────────────────────
function tbGetSupervisorIds() {
  if (tbState.supervisorIds) return tbState.supervisorIds;
  try {
    const stored = JSON.parse(localStorage.getItem('tb_supervisors') || 'null');
    if (stored) { tbState.supervisorIds = new Set(stored); return tbState.supervisorIds; }
  } catch(e) {}
  // Default: Mahad is always admin/supervisor
  const defaults = new Set([TB_ADMIN_ID]);
  tbSaveSupervisorIds(defaults);
  tbState.supervisorIds = defaults;
  return defaults;
}

function tbSaveSupervisorIds(set) {
  localStorage.setItem('tb_supervisors', JSON.stringify([...set]));
}

function tbGetStaffMap() {
  try { return JSON.parse(localStorage.getItem('tb_staffmap') || '{}'); } catch(e) { return {}; }
}

function tbSaveStaffMap(map) {
  localStorage.setItem('tb_staffmap', JSON.stringify(map));
}

// ── Get supervisor color by index ──────────────────────────────────────────
function tbSupColor(ghlId) {
  const supIds = [...tbGetSupervisorIds()];
  const idx = supIds.indexOf(ghlId);
  return TB_COLORS[idx % TB_COLORS.length] || '#7c3aed';
}

// ── Init: build supervisor dropdown ───────────────────────────────────────
function tbInit() {
  const container = document.getElementById('tb-supervisor-tabs');
  if (!container) return;

  if (!tbState.users.length) {
    container.innerHTML = `<div style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);
      border-radius:10px;padding:10px 14px;font-size:13px;min-width:220px">
      <i class="ti ti-loader" style="animation:spin 1s linear infinite;display:inline-block;margin-right:6px"></i>
      Loading staff...
    </div>`;
    return;
  }

  const supIds = tbGetSupervisorIds();
  const supervisors = tbState.users.filter(u => supIds.has(u.id));
  if (!supervisors.length && tbState.users.length) {
    // No supervisors set yet — show all users as options
    supervisors.push(...tbState.users);
  }

  if (!tbState.selectedSup && supervisors.length) {
    tbState.selectedSup = supervisors[0].id;
  }

  const selSup = tbState.users.find(u => u.id === tbState.selectedSup);
  const color  = tbSupColor(tbState.selectedSup);

  const staffMap   = tbGetStaffMap();
  const staffCount = (staffMap[tbState.selectedSup] || []).length;

  container.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <select onchange="tbSelectSupervisor(this.value)"
        style="background:var(--bg3);border:2px solid ${color};color:var(--text);
               border-radius:10px;padding:10px 36px 10px 14px;font-size:14px;font-weight:600;
               cursor:pointer;appearance:none;min-width:220px;
               background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23aaa%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>');
               background-repeat:no-repeat;background-position:right 12px center">
        ${supervisors.map(s => {
          const sc = (staffMap[s.id] || []).length;
          return `<option value="${s.id}" ${s.id === tbState.selectedSup ? 'selected' : ''}>
            ${s.name} (${sc} staff)
          </option>`;
        }).join('')}
        <option value="__unassigned__" ${'__unassigned__' === tbState.selectedSup ? 'selected' : ''}>
          ⚠ Unassigned (Advance & Recurring)
        </option>
      </select>
      <button onclick="tbOpenAdmin()" title="Admin: manage supervisors"
        style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);
               border-radius:8px;padding:8px 12px;cursor:pointer;font-size:12px;
               display:flex;align-items:center;gap:6px">
        <i class="ti ti-shield-lock"></i> Admin
      </button>
    </div>
    ${selSup ? `<div style="font-size:11px;color:var(--text3);margin-top:6px">
      <span style="color:${color};font-weight:700">${selSup.name}</span>
      · ${staffCount} direct report${staffCount!==1?'s':''} · click Admin to manage access
    </div>` : ''}
  `;
}

// ── Load data from server ─────────────────────────────────────────────────
async function tbLoad(forceRefresh) {
  if (tbState.loaded && !forceRefresh) { tbInit(); tbRender(); return; }
  const loadEl = document.getElementById('tb-loading');
  if (loadEl) loadEl.style.display = 'block';
  document.getElementById('tb-staff-grid').innerHTML = '';

  // Elapsed-time indicator so it doesn't feel frozen during the first slow load
  const startTime = Date.now();
  const subEl = document.getElementById('tb-loading-sub');
  const timer = setInterval(() => {
    if (subEl) {
      const secs = Math.round((Date.now()-startTime)/1000);
      subEl.textContent = secs < 8
        ? 'This can take up to a minute on first load'
        : `Still working... ${secs}s elapsed (pulling tasks from ~1,500 contacts)`;
    }
  }, 1000);

  try {
    const res = await fetch(`/api/tasks-board${forceRefresh ? '?refresh=1' : ''}`);
    if (!res.ok) throw new Error(`Server ${res.status}`);
    const data = await res.json();
    tbState.tasks = data.tasks || [];
    tbState.opps  = data.opportunities || [];
    tbState.users = (data.users || []).filter(u => !u.deleted);
    tbState.loaded = true;
    console.log(`TB loaded: ${tbState.tasks.length} tasks, ${tbState.opps.length} opps, ${tbState.users.length} users`);
    const mahadId = 'yri669q8Ymx22zdFDPLK';
    const mahadOpps = tbState.opps.filter(o => o.assignedTo === mahadId);
    const mahadTasks = tbState.tasks.filter(t => t.assigneeId === mahadId || t.assignedTo === mahadId);
    console.log(`Mahad opps: ${mahadOpps.length}, Mahad tasks: ${mahadTasks.length}`);
    const uniqueOwners = [...new Set(tbState.opps.map(o=>o.assignedTo).filter(Boolean))];
    console.log('Unique opp owner IDs in data:', uniqueOwners);
  } catch(e) {
    if (loadEl) loadEl.innerHTML = `<div style="color:var(--red)">Failed to load: ${e.message}</div>`;
    clearInterval(timer);
    return;
  }
  clearInterval(timer);
  if (loadEl) loadEl.style.display = 'none';
  tbInit();
  tbRender();
}

function tbToggleSection(userId) {
  const sec  = document.getElementById(`tb-sec-${userId}`);
  const chev = document.getElementById(`tb-chev-${userId}`);
  if (!sec) return;
  const collapsed = sec.style.maxHeight === '0px' || sec.style.maxHeight === '';
  sec.style.maxHeight  = collapsed ? '500px' : '0px';
  sec.style.overflow   = collapsed ? 'auto'  : 'hidden';
  if (chev) chev.style.transform = collapsed ? 'rotate(180deg)' : 'rotate(0deg)';
}

function tbSelectSupervisor(supId) {
  tbState.selectedSup = supId;
  tbInit();
  tbRender();
}

function tbApplyFilters() {
  tbState.filterType   = document.getElementById('tb-filter-type').value;
  tbState.filterStatus = document.getElementById('tb-filter-status').value;
  tbState.searchQuery  = (document.getElementById('tb-search')?.value || '').toLowerCase().trim();
  tbRender();
}

// Helper: does item match search query?
function tbItemMatchesSearch(item, isTask) {
  if (!tbState.searchQuery) return true;
  const words = tbState.searchQuery.split(/\s+/).filter(Boolean);
  const fields = isTask
    ? [item.title, item.contact?.name, item.contactName, item.companyName, item.body]
    : [item.name, item.pipelineName, item.contact?.name, item.contactName, item.companyName, item.stageName, item.status];
  const combined = fields.map(f=>(f||'').toLowerCase()).join(' ');
  // Every word in the query must appear somewhere in the combined fields
  return words.every(w => combined.includes(w));
}

async function tbRefresh() {
  tbState.loaded = false;
  tbState.searchQuery = '';
  const searchEl = document.getElementById('tb-search');
  if (searchEl) searchEl.value = '';
  await tbLoad(true);
}

// ── Status helpers ────────────────────────────────────────────────────────
function tbOppIsStale(opp) {
  const created = opp.createdAt || opp.dateAdded || opp.updatedAt;
  if (!created) return false;
  return (Date.now() - new Date(created).getTime()) > 86400000; // > 1 day
}

function tbGetItemStatus(item, isTask) {
  if (isTask) {
    if (item.completed || item.status === 'completed') return 'completed';
    if (item.dueDate && new Date(item.dueDate) < new Date()) return 'overdue';
    return 'open';
  } else {
    const s = (item.status || '').toLowerCase();
    if (s === 'won' || s === 'completed') return 'completed';
    if (s === 'lost') return 'lost';
    if (s === 'open' && tbOppIsStale(item)) return 'overdue';
    return 'open';
  }
}

// ── Render staff cards ────────────────────────────────────────────────────


// ── Portal links — matched against task title keywords ────────────────────────
const PORTAL_LINKS = [
  { keys:['ny filing','new york filing'],                                label:'NY Filing Portal',        url:'https://www.oscar.ny.gov/OSCR/OSCRCarrierHome',                                                                                                                                                                                                                   color:'#3b82f6', fetchNotes:true },
  { keys:['ny permit','ny permits','2026 ny','oscar','new york permit'], label:'NY Oscar Portal',         url:'https://www.oscar.ny.gov/OSCR/OSCRCarrierHome',                                                                                                                                                                                                                   color:'#0076cc', fetchNotes:true },
  { keys:['kyu'],                                                         label:'KY Motor Carrier Portal', url:'https://apps.transportation.ky.gov/motorcarrierportal/Home.aspx?clear',                                                                                                                                                                                          color:'#3b82f6' },
  { keys:['nm permit','nm permits','new mexico permit'],                  label:'NM TAP Portal',           url:'https://tap.state.nm.us/Tap/_/',                                                                                                                                                                                                                                 fetchNotes:true,                                                                                                                                                                                                                                 color:'#8b5cf6' },
  { keys:['ct permit','ct permits','connecticut'],                        label:'CT DRS eServices',        url:'https://drs.ct.gov/eservices/_/#0',                                                                                                                                                                                                                              color:'#06b6d4' },
  { keys:['mn filing','minnesota filing','biz name'],                    label:'MN SOS Business Search',  url:'https://mblsportal.sos.mn.gov/Business/Search',                                                                                                                                                                                                                  color:'#10b981' },
  { keys:['nebraska','ne filing','ne irp','nebraska irp'],                label:'Nebraska SOS eDocs',      url:'https://www.nebraska.gov/apps-sos-edocs/',                                                                                                                                                                                                                       color:'#f59e0b' },
  { keys:['ucr'],                                                         label:'UCR Portal Login',        url:'https://permitting.ucr.gov/login',                                                                                                                                                                                                               color:'#ef4444', creds:{ password:'Safety3165#' } },
  { keys:['motus'],                                                       label:'Motus DOT Portal',        url:'https://motus.dot.gov/',                                                                                                                                                                                                                                         color:'#6366f1' },
  { keys:['clearinghouse','clearing house'],                              label:'FMCSA Clearinghouse',     url:'https://clearinghouse.fmcsa.dot.gov/',                                                                                                                                                                                                                           color:'#0ea5e9' },
  { keys:['ohio irp','oh irp'],                                           label:'Ohio IRP Portal',         url:'https://irp.bmv.dps.ohio.gov/OHEnterprise/',                                                                                                                                                                                                                    color:'#f97316' },
  { keys:['ohio ifta','oh ifta'],                                         label:'Ohio IFTA TAP',           url:'https://myportal.tax.ohio.gov/TAP/_/',                                                                                                                                                                                                                          color:'#f97316' },
  { keys:['irp','ifta'], exclude:['ohio','oh ifta','oh irp'],            label:'MN IRP/IFTA eServices',   url:'https://onlineservices.dps.mn.gov/EServices/Business/_/',                                                                                                                                                                                                        color:'#22c55e' },
  { keys:['dot pin','pin reset','autopin'],                               label:'FMCSA DOT PIN Reset',     url:'https://safer.fmcsa.dot.gov/AutoPin/index.xhtml',                                                                                                                                                                                                               color:'#64748b' },
  { keys:['mc certificate','mc cert'],                                    label:'FMCSA MC Certificate',    url:'https://www.fmcsa.dot.gov/registration/daily-decisionsdaily-fmcsa-registration-decisions-letters-certificates-permits-and?field_document_media_type_target_id%5B22926%5D=22926&field_issue_date_value%5Bmin%5D=07%2F10%2F2024&field_issue_date_value%5Bmax%5D=07%2F11%2F2024', color:'#7c3aed' },
];

function tbGetPortalLinks(title) {
  const t = (title || '').toLowerCase();
  return PORTAL_LINKS.filter(p => {
    const hasKey = p.keys.some(k => t.includes(k));
    const excluded = p.exclude && p.exclude.some(x => t.includes(x));
    return hasKey && !excluded;
  });
}

// ── NEW task badge tracking (localStorage) ──────────────────────────────────
function tbGetViewedTasks() {
  try { return new Set(JSON.parse(localStorage.getItem('ats_viewed_tasks') || '[]')); }
  catch { return new Set(); }
}
function tbMarkTaskViewed(taskId) {
  const viewed = tbGetViewedTasks();
  if (viewed.has(taskId)) return;
  viewed.add(taskId);
  // Keep max 2000 IDs to avoid localStorage bloat
  const arr = [...viewed].slice(-2000);
  localStorage.setItem('ats_viewed_tasks', JSON.stringify(arr));
  // Remove NEW badge from DOM immediately
  const badge = document.getElementById('tb-new-badge-' + taskId);
  if (badge) badge.remove();
}

function tbRender() {
  const grid  = document.getElementById('tb-staff-grid');
  const label = document.getElementById('tb-team-label');
  if (!grid) return;

  // If swimlane view active, render that instead
  if (tbViewMode === 'swimlane') { tbRenderSwimlane(); return; }

  // Special unassigned view
  if (tbState.selectedSup === '__unassigned__') { tbRenderUnassigned(); return; }

  const supUser  = tbState.users.find(u => u.id === tbState.selectedSup);
  const supColor = tbSupColor(tbState.selectedSup);
  const staffMap = tbGetStaffMap();
  const staffIds = staffMap[tbState.selectedSup] || [];
  const staffUsers = tbState.users.filter(u => staffIds.includes(u.id));
  const allMembers = [supUser, ...staffUsers.filter(u => u.id !== tbState.selectedSup)].filter(Boolean);

  if (label) label.textContent = `${supUser?.name?.toUpperCase() || 'TEAM'} — ${allMembers.length} MEMBER${allMembers.length!==1?'S':''}`;

  let totalItems = 0, overdueCount = 0, openCount = 0, doneCount = 0;

  // Build combined items for ALL members with staff name label
  const allItems = [];
  allMembers.forEach(user => {
    const isSuper   = user.id === tbState.selectedSup;
    const userOpps  = tbState.opps.filter(o => o.assignedTo === user.id);
    const userTasks = tbState.tasks.filter(t =>
      t.assigneeId === user.id ||
      t.assignedTo === user.id ||
      t.assignedUserId === user.id ||
      t.userId === user.id
    );
    let items = [];
    if (tbState.filterType !== 'opps')  userTasks.forEach(t => { if(tbItemMatchesSearch(t,true))  items.push({...t, _type:'task', _status:tbGetItemStatus(t,true), _staffName:user.name, _isSuper:isSuper}); });
    if (tbState.filterType !== 'tasks') userOpps.forEach(o  => { if(tbItemMatchesSearch(o,false)) items.push({...o, _type:'opp',  _status:tbGetItemStatus(o,false), _staffName:user.name, _isSuper:isSuper}); });
    if (tbState.filterStatus !== 'all') items = items.filter(i => i._status === tbState.filterStatus);
    items.sort((a,b) => {
      const statusOrder = {overdue:0,open:1,completed:2,lost:3};
      const statusDiff  = (statusOrder[a._status]||1) - (statusOrder[b._status]||1);
      if (statusDiff !== 0) return statusDiff;
      // Newest first within each status group
      const aDate = new Date(a.dueDate || a.createdAt || a.dateAdded || 0).getTime();
      const bDate = new Date(b.dueDate || b.createdAt || b.dateAdded || 0).getTime();
      return bDate - aDate;
    });
    allItems.push({ user, isSuper, items });
    totalItems += items.length;
    overdueCount += items.filter(i=>i._status==='overdue').length;
    openCount    += items.filter(i=>i._status==='open').length;
    doneCount    += items.filter(i=>i._status==='completed').length;
  });

  function renderItem(item) {
    const isTask   = item._type==='task';
    const sc = item._status==='overdue'?'#ef4444':item._status==='completed'?'#34d399':'#60a5fa';
    const si = item._status==='overdue'?'ti-alert-triangle':item._status==='completed'?'ti-circle-check':'ti-clock';
    const taskTitle   = item.title || 'Untitled Task';
    const taskDue     = item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : 'No due date';
    const oppName     = item.name || 'Untitled Opportunity';
    const pipeline    = (item.pipelineName||'').replace(/^\d+\.\s*/,'').replace('2026 ','').trim();
    const oppStage    = item.stageName || item.status || '';
    const created     = item.createdAt||item.dateAdded;
    const ageDays     = created ? Math.floor((Date.now()-new Date(created).getTime())/86400000) : null;
    const title   = isTask ? taskTitle : pipeline || oppName;
    const sub2    = isTask ? `Due: ${taskDue}` : oppStage ? `Stage: ${oppStage}` : '';
    const ageTag  = !isTask && ageDays !== null ? `${ageDays}d open` : '';
    const typeBg  = isTask ? 'rgba(139,92,246,.2)' : 'rgba(245,158,11,.2)';
    const typeClr = isTask ? '#a78bfa' : '#fbbf24';
    const typeLabel = isTask ? '✓ TASK' : '⬡ OPP';
    const itemContactId = item.contactId || item.contact?.id || '';
    const currentUser   = item.assigneeId || item.assignedTo || '';

    // Contact / company display — always show who this is for
    const contactName = item.contact?.name || item.contactName || 'Unknown contact';
    const companyName = item.companyName || item.contact?.companyName || '';

    // Customer tier tag from GHL tags (advance/recurring/basic)
    const tags = (item.customerTags || item.contact?.tags || []).map(t=>String(t).toLowerCase());
    let tierTag = null;
    if (tags.some(t=>t.includes('advance'))) tierTag = { label:'Advanced', color:'#34d399' };
    else if (tags.some(t=>t.includes('recurring'))) tierTag = { label:'Recurring', color:'#60a5fa' };
    else if (tags.some(t=>t.includes('basic'))) tierTag = { label:'Basic', color:'#a3a3a3' };

    // Build a JSON-safe inline data blob for the detail modal (avoid re-fetching)
    const detailData = {
      contactId: itemContactId, contactName, companyName, tags,
      dotNumber: item.dotNumber || '',
      phone: item.contactPhone || '',
      email: item.contactEmail || '',
      title, sub2, type: isTask?'task':'opp', status: item._status,
    };
    const detailJson = JSON.stringify(detailData).replace(/'/g,"&#39;").replace(/"/g,'&quot;');

    const isDone = item._status === 'completed';
    // NEW badge — show for tasks not yet viewed, mark viewed on click
    const isNewTask = isTask && item.id && !tbGetViewedTasks().has(item.id);
    const newBadge  = isNewTask
      ? `<span id="tb-new-badge-${item.id}" style="font-size:9px;background:rgba(0,196,106,.2);color:var(--primary);
           border:1px solid rgba(0,196,106,.5);padding:1px 6px;border-radius:4px;font-weight:800;
           animation:pulse 2s infinite;white-space:nowrap">NEW</span>`
      : '';
    const completeBtn = isDone ? '' : `
            <button onclick="event.stopPropagation();${isTask
              ?`tbCompleteTask('${item.id||''}','${itemContactId}',this)`
              :`tbCompleteOpp('${item.id||''}',this)`}"
              title="${isTask?'Mark task complete':'Mark opportunity as Won'}"
              style="font-size:9px;background:rgba(52,211,153,.12);border:1px solid #34d399;color:#34d399;
                     border-radius:4px;padding:2px 6px;cursor:pointer;margin-top:2px;display:flex;align-items:center;gap:3px">
              <i class="ti ti-check" style="font-size:10px"></i> ${isTask?'Done':'Won'}
            </button>`;

    return `
      <div data-task-id="${isTask ? (item.id||'') : ''}" onclick='tbHandleItemClick(this,${detailJson})'
        style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;
               background:${item._status==='overdue'?'rgba(239,68,68,.05)':'transparent'}"
        onmouseover="this.style.background='var(--bg3)'"
        onmouseout="this.style.background='${item._status==='overdue'?'rgba(239,68,68,.05)':'transparent'}'">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <i class="ti ${si}" style="color:${sc};font-size:14px;margin-top:3px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap">
              <span style="font-size:11px;color:var(--primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                <i class="ti ti-user" style="font-size:10px"></i> ${contactName}
              </span>
              ${companyName?`<span style="font-size:10px;color:var(--text3)"><i class="ti ti-building" style="font-size:10px"></i> ${companyName}</span>`:''}
              ${tierTag?`<span style="font-size:9px;background:${tierTag.color}22;color:${tierTag.color};padding:1px 6px;border-radius:4px;font-weight:700">${tierTag.label}</span>`:''}
            </div>
            ${sub2?`<div style="font-size:10px;color:${item._status==='overdue'?'#ef4444':'var(--text3)'};margin-top:2px">${sub2}</div>`:''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
            <span style="font-size:9px;background:${typeBg};color:${typeClr};padding:2px 7px;border-radius:4px;font-weight:700;white-space:nowrap">${typeLabel}</span>
            ${newBadge}
            ${ageTag?`<span style="font-size:10px;color:${item._status==='overdue'?'#ef4444':'var(--text3)'}">${ageTag}</span>`:''}
            <button onclick="event.stopPropagation();tbShowReassignMenu('${item.id||''}','${isTask?'task':'opp'}','${itemContactId}','${currentUser}',this)"
              style="font-size:9px;background:var(--bg3);border:1px solid var(--border);color:var(--text3);
                     border-radius:4px;padding:2px 6px;cursor:pointer;margin-top:2px">
              ↕ Assign
            </button>
            ${completeBtn}
          </div>
        </div>
      </div>`;
  }

  // ONE card per supervisor — sections per staff member inside
  const totalOver = allItems.reduce((s,m)=>s+m.items.filter(i=>i._status==='overdue').length,0);
  const totalOpen = allItems.reduce((s,m)=>s+m.items.filter(i=>i._status==='open').length,0);
  const totalDone = allItems.reduce((s,m)=>s+m.items.filter(i=>i._status==='completed').length,0);
  const supInitials = supUser?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'??';

  const card = `
    <div style="background:var(--bg2);border:1px solid ${supColor};border-radius:16px;overflow:hidden;grid-column:1/-1">
      <!-- Supervisor header -->
      <div style="padding:16px 20px;display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);background:var(--bg3)">
        <div style="width:48px;height:48px;border-radius:50%;background:${supColor}33;border:2px solid ${supColor};
                    display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${supColor};flex-shrink:0">${supInitials}</div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:15px;font-weight:700;color:var(--text)">${supUser?.name||'Supervisor'}</span>
            <span style="font-size:9px;background:${supColor}22;color:${supColor};padding:2px 8px;border-radius:4px;font-weight:700">SUPERVISOR</span>
          </div>
          <div style="display:flex;gap:8px;margin-top:5px;flex-wrap:wrap">
            ${totalOver?`<span style="font-size:10px;background:rgba(239,68,68,.15);color:#ef4444;padding:2px 8px;border-radius:20px;font-weight:700">${totalOver} overdue</span>`:''}
            ${totalOpen?`<span style="font-size:10px;background:rgba(59,130,246,.15);color:#60a5fa;padding:2px 8px;border-radius:20px;font-weight:700">${totalOpen} open</span>`:''}
            ${totalDone?`<span style="font-size:10px;background:rgba(16,185,129,.15);color:#34d399;padding:2px 8px;border-radius:20px;font-weight:700">${totalDone} done</span>`:''}
            <span style="font-size:10px;color:var(--text3)">${allMembers.length} member${allMembers.length!==1?'s':''} · ${totalItems} total items</span>
          </div>
        </div>
        <div style="font-size:28px;font-weight:800;color:${supColor}">${totalItems}</div>
      </div>

      <!-- Staff sections -->
      ${allItems.length===0 ? `<div style="padding:32px;text-align:center;color:var(--text3)">No team members assigned. Use Admin to assign staff.</div>` :
        allItems.map(({user, isSuper, items}) => {
          const initials = user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const myOver   = items.filter(i=>i._status==='overdue').length;
          const myOpen   = items.filter(i=>i._status==='open').length;
          const myDone   = items.filter(i=>i._status==='completed').length;
          return `
            <!-- Staff section header — click to collapse/expand -->
            <div style="padding:10px 20px;background:${supColor}08;border-bottom:2px solid ${supColor}22;
                        display:flex;align-items:center;gap:10px;cursor:pointer"
              onclick="tbToggleSection('${user.id}')">
              <div style="width:30px;height:30px;border-radius:50%;background:${isSuper?supColor:supColor+'66'}33;
                          border:1.5px solid ${isSuper?supColor:supColor+'88'};
                          display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;
                          color:${isSuper?supColor:supColor+'cc'};flex-shrink:0">${initials}</div>
              <div style="flex:1">
                <span style="font-size:12px;font-weight:700;color:var(--text)">${user.name}</span>
                <span style="font-size:9px;margin-left:6px;background:${isSuper?supColor+'22':'var(--bg3)'};
                             color:${isSuper?supColor:'var(--text3)'};padding:1px 6px;border-radius:4px;font-weight:700">
                  ${isSuper?'SUPERVISOR':'STAFF'}
                </span>
              </div>
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                ${myOver?`<span style="font-size:10px;color:#ef4444;font-weight:700">${myOver} overdue</span>`:''}
                ${myOpen?`<span style="font-size:10px;color:#60a5fa;font-weight:700">${myOpen} open</span>`:''}
                ${myDone?`<span style="font-size:10px;color:#34d399;font-weight:700">${myDone} done</span>`:''}
                ${!items.length?`<span style="font-size:10px;color:var(--text3)">All clear ✓</span>`:''}
              </div>
              <span style="font-size:14px;font-weight:800;color:${items.length?supColor:'var(--text3)'};margin-right:4px">${items.length}</span>
              <i class="ti ti-chevron-down" id="tb-chev-${user.id}" style="color:var(--text3);font-size:13px;transition:transform .25s"></i>
            </div>
            <!-- Scrollable items — max 400px, shows all items -->
            <div id="tb-sec-${user.id}" style="max-height:0px;overflow:hidden;transition:max-height .3s ease">
              ${items.length===0 ? `<div style="padding:16px 20px;text-align:center;font-size:12px;color:var(--text3)">All clear ✓</div>` : items.map(renderItem).join('')}
              ${items.length>0?`<div style="padding:6px 20px;font-size:11px;color:var(--text3);text-align:center;
                border-top:1px solid var(--border);background:var(--bg3)">
                ${items.length} total items — scroll to see all
              </div>`:''}
            </div>
          `;
        }).join('')
      }
    </div>`;

  grid.style.gridTemplateColumns = '1fr';
  grid.innerHTML = card;

  // Stats bar
  // Stats bar
  document.getElementById('tb-stats').innerHTML = [
    {label:'Total Items', value:totalItems,   icon:'ti-list',           color:'var(--primary)'},
    {label:'Overdue',     value:overdueCount,  icon:'ti-alert-triangle', color:'#ef4444'},
    {label:'Open',        value:openCount,     icon:'ti-clock',          color:'#60a5fa'},
    {label:'Completed',   value:doneCount,     icon:'ti-circle-check',   color:'#34d399'},
  ].map(s=>`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px">
      <i class="ti ${s.icon}" style="font-size:22px;color:${s.color}"></i>
      <div><div style="font-size:22px;font-weight:800;color:${s.color}">${s.value}</div>
      <div style="font-size:11px;color:var(--text3)">${s.label}</div></div>
    </div>`).join('');
}

// ── Admin panel — passphrase protected ───────────────────────────────────
function tbOpenAdmin() {
  // Show passphrase modal
  const existing = document.getElementById('tb-admin-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'tb-admin-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;
    display:flex;align-items:center;justify-content:center`;
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;
                padding:32px;width:440px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <i class="ti ti-shield-lock" style="font-size:24px;color:#7c3aed"></i>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Admin Access</div>
          <div style="font-size:12px;color:var(--text3)">Enter passphrase to manage supervisor roles</div>
        </div>
      </div>
      <input id="tb-admin-pass" type="password" placeholder="Enter passphrase..."
        style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
               border-radius:10px;padding:12px 14px;font-size:14px;margin-bottom:12px;box-sizing:border-box"
        onkeydown="if(event.key==='Enter')tbCheckPassphrase()">
      <div id="tb-admin-err" style="color:#ef4444;font-size:12px;margin-bottom:12px;display:none">Incorrect passphrase</div>
      <div style="display:flex;gap:8px">
        <button onclick="tbCheckPassphrase()"
          style="flex:1;background:#7c3aed;color:#fff;border:none;border-radius:10px;
                 padding:12px;font-size:14px;font-weight:700;cursor:pointer">
          Unlock
        </button>
        <button onclick="document.getElementById('tb-admin-modal').remove()"
          style="background:var(--bg3);color:var(--text);border:1px solid var(--border);
                 border-radius:10px;padding:12px 18px;font-size:14px;cursor:pointer">
          Cancel
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('tb-admin-pass')?.focus(), 100);
}

async function tbCheckPassphrase() {
  const val = document.getElementById('tb-admin-pass')?.value;
  if (val === TB_PASSPHRASE) {
    document.getElementById('tb-admin-modal').remove();
    // Ensure user data is loaded before showing admin panel
    if (!tbState.users.length) {
      tbShowAdminLoading();
      await tbLoad();
    }
    tbShowAdminPanel();
  } else {
    const err = document.getElementById('tb-admin-err');
    if (err) { err.style.display='block'; err.textContent='Incorrect passphrase. Try again.'; }
  }
}

function tbShowAdminLoading() {
  const existing = document.getElementById('tb-admin-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'tb-admin-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:32px;text-align:center">
      <i class="ti ti-loader" style="font-size:32px;color:#7c3aed;animation:spin 1s linear infinite;display:block;margin-bottom:12px"></i>
      <div style="color:var(--text);font-weight:700">Loading staff list from GHL...</div>
      <div style="color:var(--text3);font-size:12px;margin-top:6px">This may take up to 30 seconds on first load</div>
    </div>`;
  document.body.appendChild(modal);
}

async function tbRetryAdminLoad() {
  tbShowAdminLoading();
  await tbLoad(true); // force fresh fetch
  tbShowAdminPanel();
}

function tbShowAdminPanel() {
  const existing = document.getElementById('tb-admin-modal');
  if (existing) existing.remove();

  const supIds   = tbGetSupervisorIds();
  const staffMap = tbGetStaffMap();

  const modal = document.createElement('div');
  modal.id = 'tb-admin-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px`;
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;
                padding:28px;width:560px;max-width:95vw;max-height:85vh;overflow-y:auto;
                box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px">
          <i class="ti ti-shield-check" style="font-size:22px;color:#7c3aed"></i>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Supervisor Management</div>
        </div>
        <button onclick="document.getElementById('tb-admin-modal').remove()"
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px">✕</button>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.1em;margin-bottom:10px">
        ALL USERS — TOGGLE SUPERVISOR ACCESS
      </div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:14px">
        <i class="ti ti-info-circle"></i> Mahad Said Q is always a supervisor and cannot be removed.
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">
        ${!tbState.users.length ? `
          <div style="text-align:center;padding:24px;color:var(--text3)">
            <i class="ti ti-alert-circle" style="font-size:28px;display:block;margin-bottom:8px;color:#f59e0b"></i>
            Could not load staff list from GHL.
            <button onclick="tbRetryAdminLoad()" style="display:block;margin:12px auto 0;background:var(--primary);
              color:#0a1a0f;border:none;border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer">
              Retry
            </button>
          </div>` : ''}
        ${tbState.users.map(u => {
          const isSup     = supIds.has(u.id);
          const isAdmin   = u.id === TB_ADMIN_ID;
          const color     = isSup ? tbSupColor(u.id) : 'var(--text3)';
          const initials  = u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
                        background:var(--bg3);border-radius:10px;border:1px solid ${isSup?color:'var(--border)'}">
              <div style="width:36px;height:36px;border-radius:50%;background:${color}22;border:2px solid ${color};
                          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${color}">
                ${initials}
              </div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${u.name}</div>
                <div style="font-size:11px;color:var(--text3)">${u.email||''}</div>
              </div>
              ${isAdmin
                ? `<span style="font-size:10px;background:#7c3aed22;color:#7c3aed;padding:3px 8px;border-radius:6px;font-weight:700">ADMIN</span>`
                : `<button onclick="tbToggleSupervisor('${u.id}')"
                    style="background:${isSup?'rgba(239,68,68,.15)':'rgba(16,185,129,.15)'};
                           color:${isSup?'#ef4444':'#34d399'};border:1px solid ${isSup?'#ef4444':'#34d399'};
                           border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">
                    ${isSup?'Remove Supervisor':'Make Supervisor'}
                  </button>`
              }
            </div>`;
        }).join('')}
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.1em;margin-bottom:10px">
        ASSIGN STAFF TO SUPERVISORS
      </div>
      ${[...supIds].map(supId => {
        const supUser   = tbState.users.find(u=>u.id===supId);
        if (!supUser) return '';
        const myStaff   = staffMap[supId] || [];
        // Any user can be staff under a supervisor — including other supervisors
        const assignable = tbState.users.filter(u => u.id !== supId); // just exclude self
        const color      = tbSupColor(supId);
        return `
          <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;
                      padding:12px;margin-bottom:10px">
            <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:8px">
              ${supUser.name}'s Staff
            </div>
            ${assignable.length===0
              ? `<div style="font-size:11px;color:var(--text3)">All users are supervisors — no staff to assign</div>`
              : assignable.map(u => {
                  const assigned = myStaff.includes(u.id);
                  return `
                    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer">
                      <input type="checkbox" ${assigned?'checked':''} onchange="tbToggleStaff('${supId}','${u.id}',this.checked)"
                        style="width:16px;height:16px;accent-color:${color}">
                      <span style="font-size:12px;color:var(--text)">${u.name}</span>
                    </label>`;
                }).join('')
            }
          </div>`;
      }).join('')}

      <button onclick="document.getElementById('tb-admin-modal').remove();tbInit();tbRender();"
        style="width:100%;background:#7c3aed;color:#fff;border:none;border-radius:10px;
               padding:12px;font-size:14px;font-weight:700;cursor:pointer;margin-top:8px">
        Save & Close
      </button>
    </div>`;
  document.body.appendChild(modal);
}

function tbToggleSupervisor(userId) {
  const supIds = tbGetSupervisorIds();
  if (userId === TB_ADMIN_ID) return;
  if (supIds.has(userId)) supIds.delete(userId);
  else supIds.add(userId);
  tbSaveSupervisorIds(supIds);
  tbState.supervisorIds = supIds;
  tbShowAdminPanel();
}

function tbToggleStaff(supId, staffId, checked) {
  const staffMap = tbGetStaffMap();
  if (!staffMap[supId]) staffMap[supId] = [];
  if (checked) {
    if (!staffMap[supId].includes(staffId)) staffMap[supId].push(staffId);
  } else {
    staffMap[supId] = staffMap[supId].filter(id => id !== staffId);
  }
  tbSaveStaffMap(staffMap);
}

// end tasks board

// ═══════════════════════════════════════════════════════════════════════════
// FMCSA SUPPORT FORM
// ═══════════════════════════════════════════════════════════════════════════

let ffSelectedContact = null;

async function ffInit() {
  const sel = document.getElementById('ff-assignee');
  if (!sel) return;

  let users = tbState.users.length ? tbState.users
    : JSON.parse(localStorage.getItem('tb_cached_users') || '[]');

  if (!users.length) {
    try {
      const res = await fetch('/api/tasks-board');
      const data = await res.json();
      users = (data.users || []).filter(u => !u.deleted);
      tbState.users = users;
      localStorage.setItem('tb_cached_users', JSON.stringify(users));
    } catch(e) { console.log('ffInit user fetch:', e.message); }
  }

  sel.innerHTML = '<option value="">-- Select staff member --</option>' +
    users.filter(u => u.id !== '8261TQ73bG2PCyCaznmh')
         .map(u => '<option value="' + u.id + '">' + u.name + '</option>')
         .join('');

  const chNew = document.getElementById('ff-ch-new-driver');
  if (chNew) chNew.onchange = e => {
    const el = document.getElementById('ff-new-driver-info');
    if (el) el.style.display = e.target.checked ? 'block' : 'none';
  };
}

async function ffSearchContact(query) {
  if (!query || query.length < 2) {
    document.getElementById('ff-contact-results').innerHTML = '';
    return;
  }
  const q = query.toLowerCase();
  const matches = state.clients.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.dot_number||'').includes(q) ||
    (c.business_name||'').toLowerCase().includes(q)
  ).slice(0, 6);

  document.getElementById('ff-contact-results').innerHTML = matches.map(c => `
    <div onclick="ffSelectContact('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.email||''}','${c.phone||''}')"
      style="padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--border);
             background:var(--bg3);margin-bottom:5px;display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:8px;background:var(--bg2);display:flex;align-items:center;
                  justify-content:center;font-size:10px;font-weight:700;color:var(--primary)">
        ${c.initials}
      </div>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--text)">${c.name}</div>
        ${c.dot_number?`<div style="font-size:10px;color:var(--text3)">DOT# ${c.dot_number}</div>`:''}
      </div>
    </div>`).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px">No results found</div>';
}

function ffSelectContact(id, name, email, phone) {
  ffSelectedContact = { id, name, email, phone };
  document.getElementById('ff-contact-results').innerHTML = '';
  document.getElementById('ff-contact-search').value = name;
  document.getElementById('ff-selected-contact').style.display = 'block';
  document.getElementById('ff-selected-name').textContent = name;
  if (email) document.getElementById('ff-email').value = email;
  if (phone) document.getElementById('ff-phone').value = phone;
}

async function ffSubmit() {
  const btn = document.querySelector('#page-fmcsa-form button[onclick="ffSubmit()"]');
  const status = document.getElementById('ff-status');

  if (!ffSelectedContact) {
    status.innerHTML = '<span style="color:#ef4444">⚠ Please select a client first</span>';
    return;
  }

  // Build task description
  const mcs150 = [...document.querySelectorAll('.ff-mcs150:checked')].map(c=>c.value);
  const chSetup     = document.getElementById('ff-ch-setup')?.checked;
  const chNewDriver = document.getElementById('ff-ch-new-driver')?.checked;
  const chAnnual    = document.getElementById('ff-ch-annual')?.checked;
  const newDriverInfo = document.getElementById('ff-new-driver-name')?.value;
  const notes       = document.getElementById('ff-notes')?.value;
  const assigneeId  = document.getElementById('ff-assignee')?.value;
  const email       = document.getElementById('ff-email')?.value;
  const phone       = document.getElementById('ff-phone')?.value;

  const parts = ['FMCSA Support Request'];
  if (email) parts.push(`Email: ${email}`);
  if (phone) parts.push(`Phone: ${phone}`);
  if (mcs150.length) parts.push(`MCS-150 Updates: ${mcs150.join(', ')}`);
  if (chSetup)     parts.push('Clearinghouse Account Setup');
  if (chNewDriver) parts.push(`New Driver Query${newDriverInfo?' — '+newDriverInfo:''}`);
  if (chAnnual)    parts.push('Annual Query Request');
  if (notes)       parts.push(`Notes: ${notes}`);

  const taskTitle = `FMCSA Support — ${ffSelectedContact.name}`;
  const taskBody  = parts.join('\n');

  btn.disabled = true;
  btn.textContent = 'Creating task...';
  status.innerHTML = '';

  try {
    const res = await fetch(`/api/contacts/${ffSelectedContact.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle,
        body:  taskBody,
        assignedTo: assigneeId || undefined,
        dueDate: new Date(Date.now() + 86400000).toISOString(), // due tomorrow
        status: 'open',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create task');

    status.innerHTML = `<span style="color:var(--green)">✓ Task created successfully in GHL for ${ffSelectedContact.name}!</span>`;
    // Reset form
    ffSelectedContact = null;
    document.getElementById('ff-contact-search').value = '';
    document.getElementById('ff-selected-contact').style.display = 'none';
    document.querySelectorAll('.ff-mcs150').forEach(c=>c.checked=false);
    ['ff-ch-setup','ff-ch-new-driver','ff-ch-annual'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    document.getElementById('ff-new-driver-info').style.display='none';
    document.getElementById('ff-notes').value='';
    document.getElementById('ff-email').value='';
    document.getElementById('ff-phone').value='';
    document.getElementById('ff-assignee').value='';
  } catch(e) {
    status.innerHTML = `<span style="color:#ef4444">Error: ${e.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-send"></i> Submit & Create GHL Task';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SKILLS SETUP + AUTO-ASSIGN ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// All service/task types staff can be trained on
// ── ATS Services catalog — categories with sub-services ───────────────────
// Each leaf service has a unique id used for skill matching, task titles, and search.
// Categories with no sub-services (isLeaf:true at category level) are trainable directly.
const SK_CATEGORIES = [
  {
    id: 'fmcsa', label: 'FMCSA Support', color: '#059669',
    children: [
      { id: 'fmcsa_motus_biennial',  label: 'Motus Update — Biennial Update' },
      { id: 'fmcsa_motus_bizinfo',   label: 'Motus Update — Business Info Update' },
      { id: 'fmcsa_motus_operation', label: 'Motus Update — Operation Update' },
      { id: 'fmcsa_motus_users',     label: 'Motus Update — Managed Authorized Users' },
      { id: 'fmcsa_dataq',           label: 'DataQ Challenge' },
      { id: 'fmcsa_inactivate',      label: 'Inactivate USDOT' },
      { id: 'fmcsa_reactivate',      label: 'Reactivate USDOT' },
      { id: 'fmcsa_reapplication',   label: 'Reapplication (after revocation of new entrant)' },
      { id: 'fmcsa_other',           label: 'Other Changes' },
    ],
  },
  {
    id: 'irp', label: 'IRP Support', color: '#e11d48',
    children: [
      { id: 'irp_renewal',    label: 'IRP Renewal Cab Card Registration' },
      { id: 'irp_supplement', label: 'IRP New Supplement' },
    ],
  },
  {
    id: 'ifta', label: 'IFTA Support', color: '#d97706',
    children: [
      { id: 'ifta_license_renewal', label: 'IFTA License Renewal' },
      { id: 'ifta_decals',          label: 'IFTA Decals Request' },
      { id: 'ifta_q1_filing',       label: 'Q1 IFTA Filing' },
      { id: 'ifta_previous_filing', label: 'Previous IFTA Filing' },
      { id: 'ifta_copy_license',    label: 'Copy of IFTA License' },
      { id: 'ifta_insurance',       label: 'Insurance Support IFTA Filing (Last 4 quarters)' },
    ],
  },
  {
    id: 'permits', label: 'Permits Support', color: '#0891b2',
    children: [
      { id: 'permits_ky_setup',  label: 'KY Permit Setup Request' },
      { id: 'permits_ny_setup',  label: 'NY Permit Setup Request' },
      { id: 'permits_nm_setup',  label: 'NM Permit Setup Request' },
      { id: 'permits_ct_setup',  label: 'CT Permit Setup Request' },
      { id: 'permits_ny_decals', label: 'NY Decals Request' },
      { id: 'permits_nm_req',    label: 'NM Permit Request' },
      { id: 'permits_ky_cancel', label: 'KY Account Cancel Request' },
      { id: 'permits_ny_cancel', label: 'NY Account Cancel Request' },
      { id: 'permits_nm_cancel', label: 'NM Account Cancel Request' },
      { id: 'permits_ct_cancel', label: 'CT Account Cancel Request' },
      { id: 'permits_ky_reinstate', label: 'KY Reinstatement (Account Revoked) Request' },
    ],
  },
  {
    id: 'other', label: 'Other Support', color: '#7c3aed',
    children: [
      { id: 'other_amazon',    label: 'Amazon Relay Account Setup' },
      { id: 'other_insurance', label: 'Insurance Support' },
      { id: 'other_factoring', label: 'Factoring Support' },
    ],
  },
];

// Flattened list of every leaf service — used for skills setup, task dropdown, and search
const SK_TYPES = SK_CATEGORIES.flatMap(cat => cat.children.map(child => ({
  id: child.id, label: child.label, color: cat.color, categoryId: cat.id, categoryLabel: cat.label,
})));

// Predefined task titles — directly map 1:1 to SK_TYPES leaf services
const TB_TASK_TITLES = [
  ...SK_TYPES.map(s => ({ skill: s.id, label: `${s.categoryLabel} — ${s.label}` })),
  { skill: null, label: 'Other (custom title)' },
];

// Map free-text task/pipeline names to skill leaf ids — best-effort keyword matching
// (used only as a fallback for items created outside the dropdown, e.g. via GHL directly)
const SK_PIPELINE_MAP = {
  fmcsa_motus_biennial:  ['biennial'],
  fmcsa_motus_bizinfo:   ['business info update'],
  fmcsa_motus_operation: ['operation update'],
  fmcsa_motus_users:     ['authorized users','managed authorized'],
  fmcsa_dataq:           ['dataq'],
  fmcsa_inactivate:      ['inactivate usdot','inactivate dot'],
  fmcsa_reactivate:      ['reactivate usdot','reactivate dot','reactivation'],
  fmcsa_reapplication:   ['reapplication','revocation of new entrant'],
  fmcsa_other:           ['fmcsa other','mcs-150','mcs150'],
  irp_renewal:           ['irp renewal','cab card'],
  irp_supplement:        ['irp supplement','new supplement'],
  ifta_license_renewal:  ['ifta license renewal'],
  ifta_decals:           ['ifta decals'],
  ifta_q1_filing:        ['q1 ifta'],
  ifta_previous_filing:  ['previous ifta'],
  ifta_copy_license:     ['copy of ifta'],
  ifta_insurance:        ['insurance support ifta','ifta insurance'],
  permits_ky_setup:      ['ky permit setup'],
  permits_ny_setup:      ['ny permit setup'],
  permits_nm_setup:      ['nm permit setup'],
  permits_ct_setup:      ['ct permit setup'],
  permits_ny_decals:     ['ny decals'],
  permits_nm_req:        ['nm permit request'],
  permits_ky_cancel:     ['ky account cancel','ky cancel'],
  permits_ny_cancel:     ['ny account cancel','ny cancel'],
  permits_nm_cancel:     ['nm account cancel','nm cancel'],
  permits_ct_cancel:     ['ct account cancel','ct cancel'],
  permits_ky_reinstate:  ['ky reinstat'],
  other_amazon:          ['amazon relay'],
  other_insurance:       ['insurance support'],
  other_factoring:       ['factoring support'],
};

function skGetSkills() {
  try { return JSON.parse(localStorage.getItem('tb_skills') || '{}'); } catch(e) { return {}; }
}
function skSaveSkills(data) { localStorage.setItem('tb_skills', JSON.stringify(data)); }

// Check if a user is trained on a given skill leaf id
function skIsTrained(userId, skillId) {
  const skills = skGetSkills();
  return !!skills[userId]?.[skillId]?.trained;
}

function skGetItemType(item) {
  const isTask = item._type === 'task';
  const text = (isTask
    ? (item.title || '')
    : (item.pipelineName || item.name || '')
  ).toLowerCase();
  for (const [skillId, keywords] of Object.entries(SK_PIPELINE_MAP)) {
    if (keywords.some(k => text.includes(k))) return skillId;
  }
  return null;
}

function skGetQualifiedStaff(skillId, allStaffIds) {
  return allStaffIds.filter(uid => skIsTrained(uid, skillId));
}

// ── Skills Setup page — grouped by category, Basic + Advanced checkboxes ──
function skInit() {
  const grid = document.getElementById('sk-grid');
  if (!grid) return;
  const users = tbState.users.length ? tbState.users
    : JSON.parse(localStorage.getItem('tb_cached_users') || '[]');
  if (!users.length) {
    grid.innerHTML = `<div style="color:var(--text3);padding:40px;text-align:center">
      Please visit the <strong>Tasks Board</strong> page first to load staff, then come back here.
    </div>`;
    return;
  }
  localStorage.setItem('tb_cached_users', JSON.stringify(users));
  const skills = skGetSkills();

  grid.innerHTML = users.filter(u => u.id !== '8261TQ73bG2PCyCaznmh')
    .map(user => {
      const userSkillMap = skills[user.id] || {};
      const trainedCount = Object.values(userSkillMap).filter(e => e.trained).length;
      const initials = user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow:hidden">
          <!-- Staff header -->
          <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;background:var(--bg3);border-bottom:1px solid var(--border)">
            <div style="width:38px;height:38px;border-radius:50%;background:var(--primary)22;border:2px solid var(--primary);
                        display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:var(--primary)">${initials}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700;color:var(--text)">${user.name}</div>
              <div style="font-size:11px;color:var(--text3)" id="sk-count-${user.id}">${trainedCount} service${trainedCount!==1?'s':''} trained</div>
            </div>
          </div>
          <!-- Categories — collapsible, chips inside -->
          <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
            ${SK_CATEGORIES.map(cat => {
              const catTrained = cat.children.filter(c => userSkillMap[c.id]?.trained).length;
              return `
                <div style="border:1px solid ${catTrained?cat.color:'var(--border)'};border-radius:10px;overflow:hidden">
                  <div onclick="skToggleCat('${user.id}','${cat.id}')"
                    style="padding:8px 12px;background:${catTrained?cat.color+'12':'var(--bg3)'};cursor:pointer;
                           display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:12px;font-weight:700;color:${cat.color}">${cat.label}</span>
                      ${catTrained?`<span style="font-size:10px;background:${cat.color}22;color:${cat.color};padding:1px 7px;border-radius:10px;font-weight:700">${catTrained}/${cat.children.length}</span>`:''}
                    </div>
                    <i class="ti ti-chevron-down" id="sk-cat-chev-${user.id}-${cat.id}" style="color:${cat.color};font-size:12px"></i>
                  </div>
                  <!-- Horizontal chip grid — hidden by default -->
                  <div id="sk-cat-${user.id}-${cat.id}" style="display:none;padding:10px 12px">
                    <div style="display:flex;flex-wrap:wrap;gap:6px">
                      ${cat.children.map(child => {
                        const trained = !!userSkillMap[child.id]?.trained;
                        return `
                          <label style="display:flex;align-items:center;gap:5px;padding:5px 10px;
                                       background:${trained?cat.color+'18':'var(--bg3)'};
                                       border:1px solid ${trained?cat.color:'var(--border)'};
                                       border-radius:20px;cursor:pointer;transition:all .15s">
                            <input type="checkbox" ${trained?'checked':''}
                              onchange="skToggleTrained('${user.id}','${child.id}',this.checked,'${cat.id}')"
                              style="accent-color:${cat.color};width:13px;height:13px;flex-shrink:0">
                            <span style="font-size:11px;font-weight:${trained?600:400};
                                         color:${trained?cat.color:'var(--text3)'}">
                              ${child.label}
                            </span>
                          </label>`;
                      }).join('')}
                    </div>
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');
}

function skToggleCat(userId, catId) {
  const el   = document.getElementById(`sk-cat-${userId}-${catId}`);
  const chev = document.getElementById(`sk-cat-chev-${userId}-${catId}`);
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (chev) chev.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

function skToggleTrained(userId, skillId, checked, catId) {
  const skills = skGetSkills();
  if (!skills[userId]) skills[userId] = {};
  skills[userId][skillId] = { trained: checked };
  skSaveSkills(skills);
  // Update chip style instantly
  const label = event?.target?.closest('label');
  const cat   = SK_CATEGORIES.find(c=>c.id===catId);
  if (label && cat) {
    label.style.background   = checked ? cat.color+'18' : 'var(--bg3)';
    label.style.borderColor  = checked ? cat.color : 'var(--border)';
    label.querySelector('span').style.color = checked ? cat.color : 'var(--text3)';
    label.querySelector('span').style.fontWeight = checked ? '600' : '400';
  }
  // Update trained count badge
  const countEl = document.getElementById(`sk-count-${userId}`);
  if (countEl) {
    const allSkills = skGetSkills()[userId] || {};
    const count = Object.values(allSkills).filter(e=>e.trained).length;
    countEl.textContent = `${count} service${count!==1?'s':''} trained`;
  }
}

function skSave() {
  document.getElementById('sk-status').innerHTML =
    '<span style="color:var(--green)">✓ Skills saved successfully!</span>';
  setTimeout(() => { document.getElementById('sk-status').innerHTML = ''; }, 3000);
}

// ── Auto-Assign Engine ────────────────────────────────────────────────────
async function tbAutoAssign() {
  const btn = document.getElementById('tb-auto-assign-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Assigning...'; }

  const staffMap = tbGetStaffMap();
  const staffIds = staffMap[tbState.selectedSup] || [];
  const allIds   = [tbState.selectedSup, ...staffIds].filter(Boolean);
  const skills   = skGetSkills();

  if (allIds.length < 2) {
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-wand"></i> Auto-Assign All'; }
    alert('This supervisor has no staff assigned yet. Use Admin to assign staff before auto-assigning.');
    return;
  }

  // Scope: ONLY items currently assigned to someone on THIS team (selected supervisor + their staff)
  // This prevents accidentally pulling in opportunities/tasks belonging to other teams.
  const teamIdSet = new Set(allIds);
  const teamOpenOpps  = tbState.opps.filter(o => teamIdSet.has(o.assignedTo) && (o.status||'').toLowerCase()==='open');
  const teamOpenTasks = tbState.tasks.filter(t => {
    const owner = t.assigneeId || t.assignedTo;
    return teamIdSet.has(owner) && !t.completed && t.status !== 'completed';
  });

  console.log(`Auto-Assign scope: ${teamOpenOpps.length} open opps, ${teamOpenTasks.length} open tasks for team of ${allIds.length}`);

  if (!teamOpenOpps.length && !teamOpenTasks.length) {
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-wand"></i> Auto-Assign All'; }
    alert('No open tasks or opportunities found for this team to rebalance.');
    return;
  }

  // Current workload snapshot (within this team only)
  const workload = {};
  allIds.forEach(uid => {
    workload[uid] = teamOpenOpps.filter(o => o.assignedTo === uid).length
                  + teamOpenTasks.filter(t => (t.assigneeId===uid||t.assignedTo===uid)).length;
  });

  const assignments = []; // { type:'opp'|'task', id, contactId, newUserId, itemName }

  // Round-robin pick: among staff QUALIFIED for the skill (or all, if nobody trained),
  // pick whoever currently has the fewest items — keeps load balanced as we go.
  function pickStaff(skillId) {
    const qualified = skillId ? allIds.filter(uid => skIsTrained(uid, skillId)) : [];
    const pool = qualified.length ? qualified : allIds; // fallback: nobody trained -> spread across everyone
    return pool.reduce((best, uid) => (workload[uid]||0) < (workload[best]||0) ? uid : best, pool[0]);
  }

  // Assign opportunities (only within this team's open opps)
  for (const opp of teamOpenOpps) {
    const skillId  = skGetItemType({...opp, _type:'opp'});
    const assignTo = pickStaff(skillId);
    if (assignTo && opp.assignedTo !== assignTo) {
      assignments.push({ type:'opp', id:opp.id, newUserId:assignTo, itemName:opp.name||opp.pipelineName||'Opportunity' });
      workload[assignTo] = (workload[assignTo]||0) + 1;
      workload[opp.assignedTo] = Math.max(0, (workload[opp.assignedTo]||0) - 1);
    }
  }

  // Assign tasks (only within this team's open tasks)
  for (const task of teamOpenTasks) {
    const skillId  = skGetItemType({...task, _type:'task'});
    const assignTo = pickStaff(skillId);
    const currentOwner = task.assigneeId || task.assignedTo;
    if (assignTo && currentOwner !== assignTo) {
      assignments.push({ type:'task', id:task.id, contactId:task.contactId, newUserId:assignTo, itemName:task.title||'Task' });
      workload[assignTo] = (workload[assignTo]||0) + 1;
      workload[currentOwner] = Math.max(0, (workload[currentOwner]||0) - 1);
    }
  }

  if (!assignments.length) {
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-wand"></i> Auto-Assign All'; }
    alert('All items for this team are already optimally balanced based on current skills and workload!');
    return;
  }

  // Show preview before applying
  tbShowAutoAssignPreview(assignments, allIds, () => {
    if (btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-wand"></i> Auto-Assign All'; }
  });
}

function tbShowAutoAssignPreview(assignments, allIds, onClose) {
  const existing = document.getElementById('tb-assign-modal');
  if (existing) existing.remove();

  const byUser = {};
  allIds.forEach(uid => { byUser[uid] = []; });
  assignments.forEach(a => { if (byUser[a.newUserId]) byUser[a.newUserId].push(a); });

  const modal = document.createElement('div');
  modal.id = 'tb-assign-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;
                padding:28px;width:600px;max-width:95vw;max-height:85vh;overflow-y:auto;
                box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">Auto-Assign Preview</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${assignments.length} items will be reassigned based on skills + workload</div>
        </div>
        <button onclick="document.getElementById('tb-assign-modal').remove()"
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px">✕</button>
      </div>

      ${allIds.map(uid => {
        const user  = tbState.users.find(u=>u.id===uid);
        const items = byUser[uid]||[];
        if (!items.length) return '';
        const initials = user?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'??';
        return `
          <div style="margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <div style="width:28px;height:28px;border-radius:50%;background:var(--primary)22;border:1.5px solid var(--primary);
                          display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--primary)">${initials}</div>
              <span style="font-size:13px;font-weight:700;color:var(--text)">${user?.name||uid}</span>
              <span style="font-size:11px;color:var(--text3)">(${items.length} items)</span>
            </div>
            ${items.slice(0,5).map(a=>`
              <div style="padding:6px 10px;background:var(--bg3);border-radius:6px;margin-bottom:4px;
                          display:flex;align-items:center;gap:8px;margin-left:36px">
                <span style="font-size:9px;background:${a.type==='task'?'rgba(139,92,246,.2)':'rgba(245,158,11,.2)'};
                             color:${a.type==='task'?'#a78bfa':'#fbbf24'};padding:1px 6px;border-radius:4px;font-weight:700">
                  ${a.type==='task'?'TASK':'OPP'}
                </span>
                <span style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.itemName}</span>
              </div>`).join('')}
            ${items.length>5?`<div style="font-size:11px;color:var(--text3);margin-left:36px">+${items.length-5} more</div>`:''}
          </div>`;
      }).join('')}

      <div style="display:flex;gap:10px;margin-top:20px">
        <button onclick="tbApplyAutoAssign(${JSON.stringify(assignments).replace(/"/g,'&quot;')})"
          style="flex:1;background:var(--primary);color:#0a1a0f;border:none;border-radius:10px;
                 padding:12px;font-size:14px;font-weight:700;cursor:pointer">
          ✓ Apply All Assignments
        </button>
        <button onclick="document.getElementById('tb-assign-modal').remove()"
          style="background:var(--bg3);color:var(--text);border:1px solid var(--border);
                 border-radius:10px;padding:12px 18px;font-size:14px;cursor:pointer">
          Cancel
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function tbApplyAutoAssign(assignments) {
  const modal = document.getElementById('tb-assign-modal');
  if (modal) modal.innerHTML = `
    <div style="background:var(--bg2);border-radius:20px;padding:40px;text-align:center">
      <i class="ti ti-loader" style="font-size:32px;color:var(--primary);animation:spin 1s linear infinite;display:block;margin-bottom:12px"></i>
      <div style="color:var(--text);font-weight:700">Applying ${assignments.length} assignments...</div>
      <div id="tb-assign-progress" style="color:var(--text3);font-size:12px;margin-top:8px">0 / ${assignments.length}</div>
    </div>`;

  let done = 0;
  const errors = [];

  for (const a of assignments) {
    try {
      let res;
      if (a.type === 'opp') {
        res = await fetch(`/api/opportunities/${a.id}/assign`, {
          method: 'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ assignedTo: a.newUserId }),
        });
      } else {
        res = await fetch(`/api/contacts/${a.contactId}/tasks/${a.id}/assign`, {
          method: 'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ assignedTo: a.newUserId }),
        });
      }
      if (!res.ok) {
        const errBody = await res.json().catch(()=>({}));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }
      // Update local state immediately
      if (a.type === 'opp') {
        const opp = tbState.opps.find(o=>o.id===a.id);
        if (opp) opp.assignedTo = a.newUserId;
      } else {
        const task = tbState.tasks.find(t=>t.id===a.id);
        if (task) { task.assignedTo = a.newUserId; task.assigneeId = a.newUserId; }
      }
    } catch(e) { console.log(`Assign failed for ${a.itemName}:`, e.message); errors.push(a.itemName); }
    done++;
    const prog = document.getElementById('tb-assign-progress');
    if (prog) prog.textContent = `${done} / ${assignments.length}`;
  }

  if (modal) modal.remove();
  tbRender();
  const msg = errors.length
    ? `⚠ ${done-errors.length} assigned, ${errors.length} failed`
    : `✓ ${done} items assigned successfully!`;
  alert(msg);
}

// ── Per-item reassign dropdown ────────────────────────────────────────────
// ── Item Detail Modal — contact & company info on click ───────────────────
function tbHandleItemClick(el, data) {
  const taskId = el.dataset.taskId;
  if (taskId) tbMarkTaskViewed(taskId);
  tbShowItemDetail(data);
}

function tbShowItemDetail(data) {
  const existing = document.getElementById('tb-detail-modal');
  if (existing) existing.remove();

  let tierTag = null;
  if (data.tags.some(t=>t.includes('advance'))) tierTag = { label:'Advanced', color:'#34d399' };
  else if (data.tags.some(t=>t.includes('recurring'))) tierTag = { label:'Recurring', color:'#60a5fa' };
  else if (data.tags.some(t=>t.includes('basic'))) tierTag = { label:'Basic', color:'#a3a3a3' };

  const modal = document.createElement('div');
  modal.id = 'tb-detail-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:18px;padding:26px;
                width:460px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px">
        <div>
          <div style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.06em">${data.type==='task'?'TASK':'OPPORTUNITY'} DETAILS</div>
          <div style="font-size:15px;font-weight:700;color:var(--text);margin-top:4px">${data.title}</div>
        </div>
        <button onclick="document.getElementById('tb-detail-modal').remove()"
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px">✕</button>
      </div>

      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary)22;border:2px solid var(--primary);
                      display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--primary)">
            <i class="ti ti-user"></i>
          </div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${data.contactName}</div>
            ${data.companyName?`<div style="font-size:12px;color:var(--text3)">${data.companyName}</div>`:''}
          </div>
          ${tierTag?`<span style="font-size:10px;background:${tierTag.color}22;color:${tierTag.color};padding:3px 8px;border-radius:6px;font-weight:700">${tierTag.label}</span>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text3);padding-top:8px;border-top:1px solid var(--border)">
          ${data.dotNumber?`<div><i class="ti ti-id-badge" style="width:16px"></i> DOT# ${data.dotNumber}</div>`:''}
          ${data.phone?`<div><i class="ti ti-phone" style="width:16px"></i> ${data.phone}</div>`:''}
          ${data.email?`<div><i class="ti ti-mail" style="width:16px"></i> ${data.email}</div>`:''}
          ${!data.dotNumber && !data.phone && !data.email ? '<div style="color:var(--text3)">No additional contact info on file</div>' : ''}
        </div>
      </div>

      <div style="display:flex;gap:8px;font-size:12px;color:var(--text3);margin-bottom:18px">
        ${data.sub2?`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;flex:1">${data.sub2}</div>`:''}
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;
                    color:${data.status==='overdue'?'#ef4444':data.status==='completed'?'#34d399':'#60a5fa'};font-weight:600">
          ${data.status.charAt(0).toUpperCase()+data.status.slice(1)}
        </div>
      </div>

      ${data.contactId ? `
        <a href="https://app.gohighlevel.com/v2/location/${LOC_ID_FRONTEND}/contacts/detail/${data.contactId}" target="_blank"
          style="display:block;text-align:center;background:var(--primary);color:#0a1a0f;border-radius:10px;
                 padding:11px;font-size:13px;font-weight:700;text-decoration:none">
          <i class="ti ti-external-link"></i> Open Contact in GHL
        </a>` : ''}
    </div>`;
  document.body.appendChild(modal);

  // ── Portal links — match task title to relevant compliance portals ─────────
  const matchedPortals = tbGetPortalLinks(data.title);
  if (matchedPortals.length > 0) {
    const portalSection = document.createElement('div');
    portalSection.style.cssText = 'margin-top:14px;display:flex;flex-direction:column;gap:8px';

    matchedPortals.forEach(function(portal) {
      const div = document.createElement('div');
      div.style.cssText = 'border-radius:10px;overflow:hidden;border:1px solid ' + portal.color + '33';

      // NY-specific: show notes section with DOT/EIN/PIN
      if (portal.fetchNotes && data.contactId) {
        div.innerHTML = '<div style="background:' + portal.color + '11;padding:14px">' +
          '<div style="font-size:10px;font-weight:700;color:' + portal.color + ';letter-spacing:.08em;margin-bottom:10px"><i class="ti ti-map-pin" style="margin-right:4px"></i>NY OSCAR ACCOUNT</div>' +
          '<div id="tb-ny-notes-content" style="font-size:12px;color:var(--text3);margin-bottom:10px"><i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Loading account info...</div>' +
          '<a href="' + portal.url + '" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:' + portal.color + ';color:#fff;border-radius:8px;padding:9px 14px;font-size:12px;font-weight:700;text-decoration:none"><i class="ti ti-external-link"></i> ' + portal.label + '</a>' +
          '</div>';
        portalSection.appendChild(div);

        // Fetch credentials from GHL custom fields (not notes)
        const tl = (data.title || '').toLowerCase();
        const isNYFiling = tl.includes('ny filing') || tl.includes('new york filing');
        const isNMPermit = tl.includes('nm permit') || tl.includes('new mexico permit');
        const sectionKey = isNYFiling ? 'nyFiling' : isNMPermit ? 'nmPermit' : 'nyPermit';

        fetch('/api/contacts/' + data.contactId + '/permit-info')
          .then(function(r){ return r.json(); })
          .then(function(res) {
            const el = document.getElementById('tb-ny-notes-content');
            if (!el) return;
            const info = res[sectionKey];
            if (!info || (!info.dot && !info.ein && !info.pin && !info.username && !info.password && !info.email)) {
              el.innerHTML = '<span style="color:var(--text3)">' + (isNYFiling ? 'No NY Filing Login found on this contact.' : 'No NY Permit Login found on this contact.') + '</span>';
              return;
            }
            function credRow(label, value, amber) {
              if (!value) return '';
              const col = amber ? '#f59e0b' : 'var(--text)';
              const bg  = amber ? 'rgba(245,158,11,.08)' : 'var(--bg3)';
              const bdr = amber ? '1px solid rgba(245,158,11,.2)' : '1px solid var(--border)';
              const btnStyle = amber
                ? 'background:none;border:1px solid rgba(245,158,11,.3);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:10px;color:#f59e0b'
                : 'background:none;border:1px solid var(--border);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:10px';
              const safeVal = String(value).replace(/'/g, "\'");
              return '<div style="display:flex;align-items:center;justify-content:space-between;background:' + bg + ';border:' + bdr + ';border-radius:7px;padding:7px 10px">' +
                '<span style="color:' + (amber ? '#f59e0b' : 'var(--text3)') + ';font-size:11px;font-weight:' + (amber ? '700' : '400') + '">' + label + '</span>' +
                '<span style="font-weight:' + (amber ? '800' : '700') + ';color:' + col + ';font-size:13px;display:flex;align-items:center;gap:6px">' + value +
                '<button onclick="navigator.clipboard.writeText(\x27' + safeVal + '\x27);this.textContent=\x27✓\x27;setTimeout(()=>this.textContent=\x27📋\x27,1200)" style="' + btnStyle + '">📋</button>' +
                '</span></div>';
            }
            let html = '<div style="display:flex;flex-direction:column;gap:6px">';
            if (isNYFiling) {
              html += credRow('Account Type', info.type);
              html += credRow('Username', info.username || info.email);
              html += credRow('Password', info.password, true);
            } else if (isNMPermit) {
              html += credRow('Email / Username', info.email || info.username);
              html += credRow('Password', info.password || info.pin, true);
            } else {
              html += credRow('DOT#', info.dot);
              html += credRow('EIN#', info.ein);
              html += credRow('Password PIN', info.pin, true);
            }
            html += '</div>';
            el.innerHTML = html;
          })
          .catch(function(err) {
            const el = document.getElementById('tb-ny-notes-content');
            if (el) { el.style.color = 'var(--red)'; el.textContent = 'Error: ' + (err.message||'failed'); }
          });
      } else {
        // Regular portal — show link button + credentials if any
        let credHtml = '';
        if (portal.creds) {
          credHtml = '<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px 4px">';
          if (portal.creds.username) credHtml += '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg2);border-radius:7px;padding:7px 10px"><span style="color:var(--text3);font-size:11px">Username</span><span style="font-weight:700;color:var(--text);font-size:12px;display:flex;align-items:center;gap:6px">' + portal.creds.username + '<button onclick="navigator.clipboard.writeText(\x27' + portal.creds.username + '\x27);this.textContent=\x27✓\x27;setTimeout(()=>this.textContent=\x27📋\x27,1200)" style="background:none;border:1px solid var(--border);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:10px">📋</button></span></div>';
          if (portal.creds.password) credHtml += '<div style="display:flex;align-items:center;justify-content:space-between;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:7px;padding:7px 10px"><span style="color:#f59e0b;font-size:11px;font-weight:700">Password</span><span style="font-weight:800;color:#f59e0b;font-size:13px;display:flex;align-items:center;gap:6px">' + portal.creds.password + '<button onclick="navigator.clipboard.writeText(\x27' + portal.creds.password + '\x27);this.textContent=\x27✓\x27;setTimeout(()=>this.textContent=\x27📋\x27,1200)" style="background:none;border:1px solid rgba(245,158,11,.3);border-radius:4px;padding:1px 5px;cursor:pointer;font-size:10px;color:#f59e0b">📋</button></span></div>';
          credHtml += '</div>';
        }
        div.style.cssText = 'border-radius:10px;overflow:hidden;border:1px solid ' + portal.color + '33;background:' + portal.color + '08';
        div.innerHTML = credHtml + '<a href="' + portal.url + '" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:8px;background:' + portal.color + ';color:#fff;border-radius:' + (credHtml ? '0 0 9px 9px' : '10px') + ';padding:10px 14px;font-size:12px;font-weight:700;text-decoration:none"><i class="ti ti-external-link"></i> Open ' + portal.label + '</a>';
        portalSection.appendChild(div);
      }
    });

    const modalBox = modal.querySelector('div');
    if (modalBox) modalBox.appendChild(portalSection);

    // ── Fetch & display vehicles for NY/NM permit tasks ────────────────────
    const isPermitTask = matchedPortals.some(p =>
      p.keys.some(k => ['ny permit','ny permits','nm permit','nm permits','oscar'].includes(k))
    );
    if (isPermitTask && data.contactId) {
      const vehSection = document.createElement('div');
      vehSection.style.cssText = 'margin-top:10px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden';
      vehSection.innerHTML = `
        <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.08em"><i class="ti ti-truck" style="color:var(--primary);margin-right:4px"></i>VEHICLES ON FILE</div>
          <div id="tb-veh-count" style="font-size:10px;color:var(--text3)">Loading...</div>
        </div>
        <div id="tb-veh-list" style="padding:10px 14px;font-size:12px;color:var(--text3)">
          <i class="ti ti-loader" style="animation:spin .8s linear infinite"></i>
        </div>`;
      if (modalBox) modalBox.appendChild(vehSection);

      fetch('/api/contacts/' + data.contactId + '/vehicles')
        .then(function(r){ return r.json(); })
        .then(function(res) {
          const vehs = res.vehicles || [];
          const countEl = document.getElementById('tb-veh-count');
          const listEl  = document.getElementById('tb-veh-list');
          if (countEl) countEl.textContent = vehs.length + ' vehicle' + (vehs.length !== 1 ? 's' : '');
          if (!listEl) return;
          if (!vehs.length) {
            listEl.innerHTML = '<span style="color:var(--text3)">No vehicles found for this contact.</span>';
            return;
          }
          listEl.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' +
            vehs.map(function(v, idx) {
              var uid = 'veh-' + idx;
              function cell(label, val) {
                if (!val) return '';
                return '<div style="min-width:80px"><div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">' + label + '</div>' +
                  '<div style="font-weight:700;color:var(--text);font-size:12px;margin-top:1px;display:flex;align-items:center;gap:4px">' + val +
                  '<button onclick="navigator.clipboard.writeText(\x27' + String(val).replace(/'/g,"\\'") + '\x27);this.textContent=\x27✓\x27;setTimeout(()=>this.textContent=\x27📋\x27,1200)" ' +
                  'style="background:none;border:1px solid var(--border);border-radius:3px;padding:0 4px;cursor:pointer;font-size:9px;color:var(--text3);flex-shrink:0">📋</button></div></div>';
              }
              var statusColor = (v.status||'').toLowerCase() === 'active' ? 'var(--green)' : '#f59e0b';
              var vinShort = v.vin ? v.vin.slice(-6) : '';
              var headerLabel = (v.unit ? 'UNIT ' + v.unit : 'VEHICLE') + (vinShort ? '  ···' + vinShort : '');
              return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:9px;overflow:hidden;margin-bottom:0">' +
                '<div onclick="var b=document.getElementById(\x27' + uid + '\x27);var a=document.getElementById(\x27' + uid + '-arr\x27);if(b){var open=b.style.display!==\x27none\x27;b.style.display=open?\x27none\x27:\x27flex\x27;a.textContent=open?\x27›\x27:\x27⌄\x27;}" ' +
                'style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;cursor:pointer;user-select:none">' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="font-size:10px;font-weight:800;color:var(--primary)">' + headerLabel + '</span>' +
                (v.status ? '<span style="font-size:9px;font-weight:700;color:' + statusColor + ';background:rgba(0,196,106,.08);border:1px solid rgba(0,196,106,.2);border-radius:4px;padding:1px 6px">' + v.status + '</span>' : '') +
                (v.type ? '<span style="font-size:9px;color:#94a3b8;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.2);border-radius:4px;padding:1px 6px">' + v.type + '</span>' : '') +
                '</div>' +
                '<span id="' + uid + '-arr" style="color:var(--text3);font-size:16px;line-height:1">›</span>' +
                '</div>' +
                '<div id="' + uid + '" style="display:none;gap:12px;flex-wrap:wrap;padding:8px 12px 10px 12px;border-top:1px solid var(--border)">' +
                cell('VIN', v.vin) +
                cell('Year', v.year) +
                cell('Make', v.make) +
                cell('Model', v.model) +
                cell('Plate', v.plate) +
                cell('State', v.state) +
                '</div></div>';
            }).join('') + '</div>';
        })
        .catch(function() {
          const listEl = document.getElementById('tb-veh-list');
          if (listEl) listEl.innerHTML = '<span style="color:var(--text3)">Could not load vehicles.</span>';
        });
    }
  }
}

// ── Mark task complete ─────────────────────────────────────────────────────
async function tbCompleteTask(taskId, contactId, btn) {
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>';
  try {
    const res = await fetch(`/api/contacts/${contactId}/tasks/${taskId}/complete`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to complete task');
    const task = tbState.tasks.find(t=>t.id===taskId);
    if (task) task.completed = true;
    tbRender();
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-check" style="font-size:10px"></i> Done';
    alert('Failed to mark complete: ' + e.message);
  }
}

// ── Mark opportunity as Won ────────────────────────────────────────────────
async function tbCompleteOpp(oppId, btn) {
  btn.disabled = true;
  btn.innerHTML = '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>';
  try {
    const res = await fetch(`/api/opportunities/${oppId}/win`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to mark opportunity as won');
    const opp = tbState.opps.find(o=>o.id===oppId);
    if (opp) opp.status = 'won';
    tbRender();
  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-check" style="font-size:10px"></i> Won';
    alert('Failed to mark won: ' + e.message);
  }
}

function tbShowReassignMenu(itemId, itemType, contactId, currentUserId, anchorEl) {
  // Remove any existing menu
  document.querySelectorAll('.tb-reassign-menu').forEach(m=>m.remove());

  const staffMap = tbGetStaffMap();
  const allIds   = [tbState.selectedSup, ...(staffMap[tbState.selectedSup]||[])].filter(Boolean);
  const skills   = skGetSkills();

  // Find item to determine skill
  const item = itemType==='opp'
    ? tbState.opps.find(o=>o.id===itemId)
    : tbState.tasks.find(t=>t.id===itemId);
  const skillId = item ? skGetItemType({...item, _type:itemType}) : null;
  const skillLabel = skillId ? SK_TYPES.find(s=>s.id===skillId)?.label : null;

  const menu = document.createElement('div');
  menu.className = 'tb-reassign-menu';
  menu.style.cssText = `position:fixed;background:var(--bg2);border:1px solid var(--border);
    border-radius:12px;padding:8px;min-width:200px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:9998`;

  const rect = anchorEl.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 4) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';

  menu.innerHTML = `
    <div style="font-size:10px;color:var(--text3);padding:4px 8px;font-weight:700;letter-spacing:.08em">
      REASSIGN TO${skillLabel?` · ${skillLabel}`:''}
    </div>
    ${allIds.map(uid => {
      const user      = tbState.users.find(u=>u.id===uid);
      if (!user) return '';
      const trained   = skillId ? skIsTrained(uid, skillId) : true;
      const isCurrent = uid === currentUserId;
      const initials  = user.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return `
        <div onclick="tbReassignItem('${itemId}','${itemType}','${contactId||''}','${uid}','${trained}','${(skillLabel||'').replace(/'/g,"\\'")}',this)"
          style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;cursor:pointer;
                 background:${isCurrent?'var(--primary)11':'transparent'};
                 opacity:${trained||!skillId?1:0.5}"
          onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='${isCurrent?'var(--primary)11':'transparent'}'">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--primary)22;
                      display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:var(--primary)">${initials}</div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:var(--text)">${user.name}</div>
            ${trained&&skillLabel?`<div style="font-size:10px;color:var(--green)">✓ Trained</div>`:''}
            ${!trained&&skillLabel?`<div style="font-size:10px;color:var(--text3)">Not trained</div>`:''}
          </div>
          ${isCurrent?`<i class="ti ti-check" style="color:var(--primary);font-size:12px"></i>`:''}
        </div>`;
    }).join('')}`;

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', function rm(e) {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click',rm); }
  }), 100);
}

// ── Add Task Modal ─────────────────────────────────────────────────────────
let tbAddSelectedContact = null;

function tbOpenAddItem() {
  tbAddSelectedContact = null;
  const existing = document.getElementById('tb-add-modal');
  if (existing) existing.remove();

  const staffMap = tbGetStaffMap();
  const allIds   = [tbState.selectedSup, ...(staffMap[tbState.selectedSup]||[])].filter(Boolean);
  const skills   = skGetSkills();

  const modal = document.createElement('div');
  modal.id = 'tb-add-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:28px;
                width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:16px;font-weight:700;color:var(--text)"><i class="ti ti-plus" style="color:var(--primary)"></i> Add New Task</div>
        <button onclick="document.getElementById('tb-add-modal').remove()"
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px">✕</button>
      </div>

      <!-- Client search -->
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.08em">CLIENT</label>
        <input id="tb-add-contact-search" type="text" placeholder="Search by name or DOT number..."
          oninput="tbAddSearchContact(this.value)"
          style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:13px;margin-top:4px;box-sizing:border-box">
        <div id="tb-add-contact-results" style="margin-top:6px"></div>
        <div id="tb-add-selected" style="display:none;margin-top:6px;padding:8px 12px;
             background:rgba(0,196,106,.08);border:1px solid rgba(0,196,106,.3);border-radius:8px;
             font-size:12px;color:var(--green);font-weight:600"></div>
      </div>

      <!-- Title -->
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.08em">TASK TITLE</label>
        <!-- Hidden select for value tracking — used by tbOnTitleChange/tbCheckAddSkillWarning -->
        <select id="tb-add-title-select" onchange="tbOnTitleChange()" style="display:none">
          <option value="">-- Select task title --</option>
          ${SK_CATEGORIES.map(cat => cat.children.map(child =>
            `<option value="${cat.label} — ${child.label}" data-skill="${child.id}">${child.label}</option>`
          ).join('')).join('')}
          <option value="Other (custom title)" data-skill="">Other (custom title)</option>
        </select>
        <!-- Visible collapsible picker -->
        <div id="tb-title-display" onclick="tbToggleTitlePicker()"
          style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);
                 border-radius:8px;padding:9px 12px;font-size:13px;margin-top:4px;cursor:pointer;
                 display:flex;align-items:center;justify-content:space-between">
          <span id="tb-title-display-text">-- Select task title --</span>
          <i class="ti ti-chevron-down" id="tb-title-chev" style="font-size:13px"></i>
        </div>
        <div id="tb-title-picker" style="display:none;background:var(--bg3);border:1px solid var(--border);
             border-radius:8px;margin-top:4px;overflow:hidden;max-height:280px;overflow-y:auto">
          ${SK_CATEGORIES.map(cat => `
            <div>
              <div onclick="tbToggleCatPicker('${cat.id}')"
                style="padding:8px 12px;background:${cat.color}15;cursor:pointer;display:flex;
                       align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)">
                <span style="font-size:12px;font-weight:700;color:${cat.color}">${cat.label}</span>
                <i class="ti ti-chevron-down" id="tb-cat-chev-${cat.id}" style="color:${cat.color};font-size:11px"></i>
              </div>
              <div id="tb-cat-${cat.id}" style="display:none">
                ${cat.children.map(child => `
                  <div onclick="tbSelectTitle('${cat.label} — ${child.label}','${child.id}')"
                    style="padding:8px 16px;font-size:12px;color:var(--text);cursor:pointer;
                           border-bottom:1px solid var(--border)"
                    onmouseover="this.style.background='var(--bg2)'"
                    onmouseout="this.style.background='transparent'">
                    ${child.label}
                  </div>`).join('')}
              </div>
            </div>`).join('')}
          <div onclick="tbSelectTitle('Other (custom title)','')"
            style="padding:8px 12px;font-size:12px;color:var(--text3);cursor:pointer;font-style:italic"
            onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='transparent'">
            Other (custom title)
          </div>
        </div>
        <input id="tb-add-title" type="text" placeholder="Enter custom task title..."
          style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:13px;margin-top:6px;box-sizing:border-box;display:none">
      </div>

      <!-- Due date -->
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.08em">DUE DATE</label>
        <input id="tb-add-due" type="date"
          style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:13px;margin-top:4px;box-sizing:border-box">
      </div>

      <!-- Assign to -->
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.08em">ASSIGN TO</label>
        <select id="tb-add-assignee" onchange="tbOnAssigneeChange()"
          style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:13px;margin-top:4px">
          <option value="">-- Unassigned --</option>
          ${allIds.map(uid=>{
            const u = tbState.users.find(x=>x.id===uid);
            return u ? `<option value="${uid}">${u.name}</option>` : '';
          }).join('')}
        </select>
        <div id="tb-add-skill-warning" style="display:none;margin-top:8px;padding:8px 12px;
             background:rgba(245,158,11,.12);border:1px solid #f59e0b;border-radius:8px;
             font-size:12px;color:#f59e0b;align-items:center;gap:6px">
          <i class="ti ti-alert-triangle"></i>
          <span id="tb-add-skill-warning-text"></span>
        </div>
      </div>

      <!-- Notes -->
      <div style="margin-bottom:18px">
        <label style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.08em">NOTES (OPTIONAL)</label>
        <textarea id="tb-add-notes" placeholder="Additional details..."
          style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                 border-radius:8px;padding:9px 12px;font-size:13px;margin-top:4px;min-height:60px;
                 resize:vertical;box-sizing:border-box"></textarea>
      </div>

      <div id="tb-add-status" style="margin-bottom:10px;font-size:12px;text-align:center"></div>
      <button onclick="tbSubmitAddItem()"
        style="width:100%;background:var(--primary);color:#0a1a0f;border:none;border-radius:10px;
               padding:12px;font-size:14px;font-weight:700;cursor:pointer">
        Create Task
      </button>
    </div>`;
  document.body.appendChild(modal);

  // Default due date to today
  const dueInput = document.getElementById('tb-add-due');
  if (dueInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm   = String(today.getMonth()+1).padStart(2,'0');
    const dd   = String(today.getDate()).padStart(2,'0');
    dueInput.value = `${yyyy}-${mm}-${dd}`;
  }
}

function tbAddSearchContact(query) {
  if (!query || query.length < 2) {
    document.getElementById('tb-add-contact-results').innerHTML = '';
    return;
  }
  const q = query.toLowerCase();
  const matches = (state.clients||[]).filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.dot_number||'').includes(q) ||
    (c.business_name||'').toLowerCase().includes(q)
  ).slice(0, 6);

  document.getElementById('tb-add-contact-results').innerHTML = matches.map(c => `
    <div onclick="tbAddSelectContact('${c.id}','${(c.name||'').replace(/'/g,"\\'")}')"
      style="padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--border);
             background:var(--bg3);margin-bottom:4px;font-size:12px;color:var(--text)">
      ${c.name}${c.dot_number?` · DOT# ${c.dot_number}`:''}
    </div>`).join('') || '<div style="font-size:12px;color:var(--text3);padding:6px">No results</div>';
}

function tbAddSelectContact(id, name) {
  tbAddSelectedContact = { id, name };
  document.getElementById('tb-add-contact-results').innerHTML = '';
  document.getElementById('tb-add-contact-search').value = name;
  const sel = document.getElementById('tb-add-selected');
  sel.style.display = 'block';
  sel.textContent = `✓ ${name}`;
}

// ── Add Task modal: live skill check ──────────────────────────────────────
function tbToggleTitlePicker() {
  const picker = document.getElementById('tb-title-picker');
  const chev   = document.getElementById('tb-title-chev');
  const open = picker.style.display === 'none';
  picker.style.display = open ? 'block' : 'none';
  if (chev) chev.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

function tbToggleCatPicker(catId) {
  const el   = document.getElementById(`tb-cat-${catId}`);
  const chev = document.getElementById(`tb-cat-chev-${catId}`);
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (chev) chev.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
}

function tbSelectTitle(label, skillId) {
  // Update hidden select
  const sel = document.getElementById('tb-add-title-select');
  for (const opt of sel.options) {
    if (opt.value === label) { sel.value = label; break; }
  }
  // Update visible display
  document.getElementById('tb-title-display-text').textContent = label || '-- Select task title --';
  document.getElementById('tb-title-display').style.color = label ? 'var(--text)' : 'var(--text3)';
  document.getElementById('tb-title-picker').style.display = 'none';
  const chev = document.getElementById('tb-title-chev');
  if (chev) chev.style.transform = 'rotate(0deg)';
  // Show/hide custom input
  const custom = document.getElementById('tb-add-title');
  custom.style.display = label === 'Other (custom title)' ? 'block' : 'none';
  if (label !== 'Other (custom title)') custom.value = label;
  // Trigger skill warning check
  tbCheckAddSkillWarning();
}

function tbOnTitleChange() {
  const sel = document.getElementById('tb-add-title-select');
  const custom = document.getElementById('tb-add-title');
  if (sel.value === 'Other (custom title)') {
    custom.style.display = 'block';
    custom.value = '';
    custom.focus();
  } else {
    custom.style.display = 'none';
    custom.value = sel.value;
  }
  tbCheckAddSkillWarning();
}

function tbOnAssigneeChange() { tbCheckAddSkillWarning(); }

function tbCheckAddSkillWarning() {
  const sel       = document.getElementById('tb-add-title-select');
  const opt       = sel.options[sel.selectedIndex];
  const skillId   = opt?.dataset?.skill || null;
  const assignee  = document.getElementById('tb-add-assignee').value;
  const warnBox   = document.getElementById('tb-add-skill-warning');
  const warnText  = document.getElementById('tb-add-skill-warning-text');

  if (!skillId || !assignee) { warnBox.style.display = 'none'; return; }

  const trained     = skIsTrained(assignee, skillId);
  const user        = tbState.users.find(u=>u.id===assignee);
  const skillLabel  = SK_TYPES.find(s=>s.id===skillId)?.label;

  if (!trained) {
    warnText.textContent = `${user?.name||'This person'} is not trained on ${skillLabel}.`;
    warnBox.style.display = 'flex';
  } else {
    warnBox.style.display = 'none';
  }
}

async function tbSubmitAddItem() {
  const status = document.getElementById('tb-add-status');
  const titleSel = document.getElementById('tb-add-title-select');
  const titleCustom = document.getElementById('tb-add-title');
  const title  = titleSel.value === 'Other (custom title)' ? titleCustom.value.trim() : titleSel.value;
  const due    = document.getElementById('tb-add-due').value;
  const notes  = document.getElementById('tb-add-notes').value.trim();
  const assignee = document.getElementById('tb-add-assignee').value;

  if (!tbAddSelectedContact) { status.innerHTML = '<span style="color:#ef4444">⚠ Please select a client</span>'; return; }
  if (!title) { status.innerHTML = '<span style="color:#ef4444">⚠ Please select or enter a task title</span>'; return; }

  // Skill warning check — use selected skill from dropdown, fallback to text matching for custom titles
  if (assignee) {
    const selOpt  = titleSel.options[titleSel.selectedIndex];
    const skillId = selOpt?.dataset?.skill || skGetItemType({ title, _type:'task' });
    if (skillId) {
      const trained = skIsTrained(assignee, skillId);
      if (!trained) {
        const user = tbState.users.find(u=>u.id===assignee);
        const skillLabel = SK_TYPES.find(s=>s.id===skillId)?.label;
        const proceed = await tbShowSkillWarning(user?.name||'This person', skillLabel);
        if (!proceed) return;
      }
    }
  }

  status.innerHTML = '<span style="color:var(--text3)">Creating task...</span>';
  try {
    const res = await fetch(`/api/contacts/${tbAddSelectedContact.id}/tasks`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        title, body: notes, assignedTo: assignee || undefined,
        dueDate: due ? new Date(due + 'T12:00:00').toISOString() : new Date(Date.now()+86400000).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||'Failed to create task');
    status.innerHTML = '<span style="color:var(--green)">✓ Task created!</span>';
    setTimeout(() => { document.getElementById('tb-add-modal')?.remove(); tbRefresh(); }, 800);
  } catch(e) {
    status.innerHTML = `<span style="color:#ef4444">Error: ${e.message}</span>`;
  }
}


function tbShowSkillWarning(userName, skillLabel) {
  return new Promise(resolve => {
    const existing = document.getElementById('tb-skill-warn');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'tb-skill-warn';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
      <div style="background:var(--bg2);border:1px solid #f59e0b;border-radius:16px;padding:24px;width:420px;max-width:95vw;
                  box-shadow:0 20px 60px rgba(0,0,0,.5)">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
          <i class="ti ti-alert-triangle" style="font-size:24px;color:#f59e0b;flex-shrink:0"></i>
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px">Skill Mismatch Warning</div>
            <div style="font-size:13px;color:var(--text3);line-height:1.5">
              <strong style="color:var(--text)">${userName}</strong> is not trained on
              <strong style="color:#f59e0b">${skillLabel}</strong>.
              Assign anyway?
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button id="tb-skill-warn-yes" style="flex:1;background:#f59e0b;color:#1a1208;border:none;border-radius:10px;
            padding:11px;font-size:13px;font-weight:700;cursor:pointer">Assign Anyway</button>
          <button id="tb-skill-warn-no" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);
            border-radius:10px;padding:11px 18px;font-size:13px;cursor:pointer">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('tb-skill-warn-yes').onclick = () => { modal.remove(); resolve(true); };
    document.getElementById('tb-skill-warn-no').onclick  = () => { modal.remove(); resolve(false); };
  });
}


async function tbReassignItem(itemId, itemType, contactId, newUserId, trained, skillLabel, el) {
  el.closest('.tb-reassign-menu')?.remove();

  // Show warning if assignee is not trained for this skill type
  if (trained === 'false' && skillLabel) {
    const user = tbState.users.find(u=>u.id===newUserId);
    const proceed = await tbShowSkillWarning(user?.name||'This person', skillLabel);
    if (!proceed) return;
  }

  try {
    if (itemType === 'opp') {
      await fetch(`/api/opportunities/${itemId}/assign`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ assignedTo: newUserId }),
      });
      const opp = tbState.opps.find(o=>o.id===itemId);
      if (opp) opp.assignedTo = newUserId;
    } else {
      await fetch(`/api/contacts/${contactId}/tasks/${itemId}/assign`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ assignedTo: newUserId }),
      });
      const task = tbState.tasks.find(t=>t.id===itemId);
      if (task) { task.assignedTo = newUserId; task.assigneeId = newUserId; }
    }
    tbRender();
  } catch(e) { alert('Failed to reassign: ' + e.message); }
}



// ═════════════════════════════════════════════════════════════════════════════
// CS BOARD — Customer Service Task Board
// ═════════════════════════════════════════════════════════════════════════════

const CS_PREFIX = '[CS]';
const CS_MAHAD_ID = 'yri669q8Ymx22zdFDPLK';

// ── CS Staff management (localStorage) ───────────────────────────────────────
function csGetStaffIds() {
  try { return JSON.parse(localStorage.getItem('ats_cs_staff') || '[]'); }
  catch { return []; }
}
function csSaveStaffIds(ids) { localStorage.setItem('ats_cs_staff', JSON.stringify(ids)); }
function csNextAssignee() {
  const ids = csGetStaffIds();
  if (!ids.length) {
    // No CS staff set up — fall back to Mahad (permanent admin) so tasks always have an assignee
    console.warn('No CS staff configured — assigning to Mahad as fallback');
    return CS_MAHAD_ID;
  }
  let idx = parseInt(localStorage.getItem('ats_cs_rr') || '0') % ids.length;
  localStorage.setItem('ats_cs_rr', String((idx + 1) % ids.length));
  return ids[idx];
}

// ── State ─────────────────────────────────────────────────────────────────────
let csState = { rawTasks: [], allStaff: [], loaded: false, loading: false, selectedStaff: 'all' };

// ── Load from cache only (safe, never crashes) ───────────────────────────────
function csLoadFromCache() {
  const dbg = document.getElementById('cs-debug-info');
  const hasData = tbState.loaded && tbState.users && tbState.users.length > 0;
  const csTaskCount = (tbState.tasks || []).filter(t => t.title && t.title.startsWith(CS_PREFIX)).length;

  if (dbg) dbg.innerHTML = `tbState: loaded=${tbState.loaded} | users=${tbState.users?.length||0} | tasks=${tbState.tasks?.length||0} | [CS] tasks=${csTaskCount}`;

  if (!tbState.loaded || !tbState.users || !tbState.users.length) {
    const promptEl = document.getElementById('cs-not-loaded');
    if (promptEl) {
      if (dbg) dbg.innerHTML += ' → showing not-loaded prompt';
      csShowNotLoaded();
    } else {
      // HTML doesn't have the prompt div — auto-load instead
      if (dbg) dbg.innerHTML += ' → auto-starting load (no prompt div found)';
      if (!csState.loading) csLoad(true);
    }
    return;
  }
  // Build from tbState (instant, already in memory)
  // tbState.users and tbState.tasks are flat arrays (from server { tasks, users } response)
  csState.allStaff = tbState.users.map(u => ({
    id: u.id, name: u.name,
    tasks: (tbState.tasks || []).filter(t => {
      const aid = t.assigneeId || t.assignedTo || t.assignedUserId || t.userId || (t.user?.id) || '';
      return aid === u.id;
    }),
  }));
  // Merge fallback staff names if tbState.users is missing anyone
  if (csState.allStaff.length < ATS_STAFF_FALLBACK.length) {
    const knownIds = new Set(csState.allStaff.map(s => s.id));
    ATS_STAFF_FALLBACK.forEach(s => {
      if (!knownIds.has(s.id)) csState.allStaff.push({ id: s.id, name: s.name, tasks: [] });
    });
  }
  csState.rawTasks = [];
  csState.allStaff.forEach(s => {
    (s.tasks || []).forEach(t => {
      if (t.title && t.title.startsWith(CS_PREFIX)) {
        csState.rawTasks.push({ ...t, assigneeName: s.name, assigneeId: s.id });
      }
    });
  });
  csState.loaded = true;
  csRenderStaffTabs();
  csApplyFilter();
  csRenderSettings();
}

// Full refresh — fetches from API (user-triggered only, never auto)
async function csLoad(force = false) {
  if (csState.loading) return;
  // If cache available and not forcing, use it
  if (!force && tbState.loaded && tbState.users.length) { csLoadFromCache(); return; }
  csState.loading = true;
  const loadEl = document.getElementById('cs-loading');
  const listEl = document.getElementById('cs-task-list');
  const promptEl = document.getElementById('cs-not-loaded');
  if (loadEl)   loadEl.style.display = 'block';
  if (promptEl) promptEl.style.display = 'none';
  if (listEl)   listEl.innerHTML = '';
  try {
    // 90-second timeout — prevents infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const res = await fetch(`/api/tasks-board${force ? '?refresh=1' : ''}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();

    // Server returns { tasks, users, opportunities } — NOT data.staff
    tbState.tasks = data.tasks || [];
    tbState.users = (data.users || []).filter(u => !u.deleted);
    tbState.loaded = true;

    // Build allStaff from users + their tasks
    // Check all possible GHL field names for assignee
    csState.allStaff = tbState.users.map(u => ({
      id: u.id, name: u.name,
      tasks: tbState.tasks.filter(t => {
        const aid = t.assigneeId || t.assignedTo || t.assignedUserId || t.userId || (t.user?.id) || '';
        return aid === u.id;
      }),
    }));

    // Extract [CS] tasks
    csState.rawTasks = [];
    csState.allStaff.forEach(s => {
      s.tasks.forEach(t => {
        if (t.title && t.title.startsWith(CS_PREFIX))
          csState.rawTasks.push({ ...t, assigneeName: s.name, assigneeId: s.id });
      });
    });
    csState.loaded = true;

    // Update debug info with actual results
    const dbgFinal = document.getElementById('cs-debug-info');
    if (dbgFinal) {
      const csTasks = csState.rawTasks.length;
      const allTasks = tbState.tasks.length;
      const csIds2 = csGetStaffIds();
      dbgFinal.innerHTML = `Loaded: ${tbState.users.length} users | ${allTasks} total tasks | ${csTasks} [CS] tasks | CS staff IDs: ${csIds2.join(', ') || 'none'}`;
      dbgFinal.style.color = csTasks > 0 ? 'var(--green)' : 'var(--yellow)';
    }
  } catch(e) {
    console.error('CS load error', e);
    const msg = e.name === 'AbortError'
      ? 'Load timed out (>90s). Visit Tasks Board first, then return here for instant load.'
      : 'Failed to load: ' + e.message;
    if (listEl) listEl.innerHTML = `<div style="color:var(--yellow);padding:20px;text-align:center;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;margin:10px 0">${msg}<br><br><button onclick="navigateTo('tasks-board')" style="background:var(--primary);color:#0a1a0f;border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer;margin-top:8px">Go to Tasks Board →</button></div>`;
  }
  csState.loading = false;
  if (loadEl) loadEl.style.display = 'none';
  csRenderStaffTabs();
  csApplyFilter();
  csRenderSettings();
}

function csShowNotLoaded() {
  const promptEl = document.getElementById('cs-not-loaded');
  const listEl   = document.getElementById('cs-task-list');
  if (promptEl) promptEl.style.display = 'flex';
  if (listEl)   listEl.innerHTML = '';
  // Reset stats
  ['cs-stat-total','cs-stat-overdue','cs-stat-open','cs-stat-done'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '—';
  });
}

function csRefresh() {
  const promptEl = document.getElementById('cs-not-loaded');
  if (promptEl) promptEl.style.display = 'none';
  csState.loaded = false;
  tbState.loaded = false;
  csLoad(true);
}

// ── Staff tabs ────────────────────────────────────────────────────────────────
function csRenderStaffTabs() {
  const tabs = document.getElementById('cs-staff-tabs');
  if (!tabs) return;
  const csIds = csGetStaffIds();
  const csStaff = csState.allStaff.filter(s => csIds.includes(s.id));
  const all = [{ id: 'all', name: 'All CS Staff' }, ...csStaff];
  tabs.innerHTML = all.map(s => `
    <button onclick="csSelectStaff('${s.id}')"
      style="background:${csState.selectedStaff===s.id?'var(--primary)':'var(--bg3)'};
             color:${csState.selectedStaff===s.id?'#0a1a0f':'var(--text)'};
             border:1px solid ${csState.selectedStaff===s.id?'var(--primary)':'var(--border)'};
             border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">
      ${s.name}
    </button>`).join('');
}

function csSelectStaff(id) { csState.selectedStaff = id; csRenderStaffTabs(); csApplyFilter(); }

// ── Filter + Render ───────────────────────────────────────────────────────────
function csApplyFilter() {
  const q = (document.getElementById('cs-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('cs-filter-status')?.value || 'all';
  const csIds = csGetStaffIds();
  const now = Date.now();

  // When no CS staff set up, show ALL [CS] tasks (including fallback-assigned ones)
  let tasks = csState.rawTasks.filter(t => {
    const taskAssignee = t.assigneeId || t.assignedTo || t.assignedUserId || t.userId || '';
    if (csState.selectedStaff !== 'all' && taskAssignee !== csState.selectedStaff) return false;
    // If CS staff configured: only show their tasks. If not configured: show all [CS] tasks
    if (csIds.length && !csIds.includes(taskAssignee) && taskAssignee !== CS_MAHAD_ID) return false;
    if (q && !t.title.toLowerCase().includes(q) &&
        !(t.contactName||'').toLowerCase().includes(q) &&
        !(t.businessName||'').toLowerCase().includes(q)) return false;
    const due = t.dueDate ? new Date(t.dueDate).getTime() : null;
    const isDone = t.completed || t.status === 'completed';
    const isOverdue = !isDone && due && due < now;
    if (statusF === 'completed' && !isDone) return false;
    if (statusF === 'overdue' && !isOverdue) return false;
    if (statusF === 'open' && (isDone || isOverdue)) return false;
    return true;
  });

  // Warn if no CS staff configured
  const noStaffWarning = document.getElementById('cs-no-staff-warning');
  if (noStaffWarning) noStaffWarning.style.display = csIds.length ? 'none' : 'block';

  // Update stats — when no CS staff set, count ALL [CS] tasks
  const allFiltered = csIds.length
    ? csState.rawTasks.filter(t => csIds.includes(t.assigneeId))
    : csState.rawTasks;
  const statTotal   = allFiltered.length;
  const statOverdue = allFiltered.filter(t => { const d = t.dueDate ? new Date(t.dueDate).getTime() : null; return !t.completed && d && d < now; }).length;
  const statDone    = allFiltered.filter(t => t.completed || t.status === 'completed').length;
  const statOpen    = statTotal - statDone;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('cs-stat-total', statTotal); set('cs-stat-overdue', statOverdue);
  set('cs-stat-open', statOpen);   set('cs-stat-done', statDone);

  csRenderTasks(tasks);
}

function csRenderTasks(tasks) {
  const list = document.getElementById('cs-task-list');
  if (!list) return;
  if (!tasks.length) {
    list.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3)">
      <i class="ti ti-circle-check" style="font-size:40px;display:block;margin-bottom:12px;opacity:.3"></i>
      No CS tasks found. All caught up!
    </div>`; return;
  }

  // Group by assignee
  const groups = {};
  tasks.forEach(t => {
    const aid = t.assigneeId || t.assignedTo || t.assignedUserId || t.userId || 'unassigned';
    if (!groups[aid]) groups[aid] = { name: t.assigneeName || t.ownerName || aid, tasks: [] };
    groups[aid].tasks.push(t);
  });
  const now = Date.now();

  list.innerHTML = Object.entries(groups).map(([, g]) => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;margin-bottom:16px;overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:#0a1a0f;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">
          ${g.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div style="font-weight:700;color:var(--text);font-size:14px">${g.name}</div>
        <div style="margin-left:auto;font-size:11px;color:var(--text3)">${g.tasks.length} task${g.tasks.length!==1?'s':''}</div>
      </div>
      ${g.tasks.map(t => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const isOverdue = due && due.getTime() < now && !t.completed;
        const isDone = t.completed || t.status === 'completed';
        const displayTitle = t.title.replace(/^\[CS\]\s*/,'');
        const safeTitle = displayTitle.replace(/'/g,"\\'");
        const safeAssignee = g.name.replace(/'/g,"\\'");
        const taskDataStr = JSON.stringify({id:t.id,title:t.title,body:t.body||'',dueDate:t.dueDate,completed:t.completed,contactId:t.contactId||'',contactName:t.contactName||'',businessName:t.businessName||t.companyName||'',assigneeId:t.assigneeId||'',assignedTo:t.assignedTo||'',assigneeName:t.assigneeName||g.name||''}).replace(/'/g,"&#39;").replace(/"/g,'&quot;');
        return `<div onclick='csOpenTaskCard(JSON.parse(this.dataset.task))' data-task="${taskDataStr}"
          style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:12px;cursor:pointer;
                 background:${isDone?'rgba(0,196,106,.04)':isOverdue?'rgba(239,68,68,.04)':'transparent'}"
          onmouseover="this.style.background='var(--bg3)'"
          onmouseout="this.style.background='${isDone?'rgba(0,196,106,.04)':isOverdue?'rgba(239,68,68,.04)':'transparent'}'">
          <div style="flex-shrink:0;width:7px;height:7px;border-radius:50%;margin-top:2px;
                      background:${isDone?'var(--green)':isOverdue?'var(--red)':'var(--yellow)'}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:${isDone?'var(--text3)':'var(--text)'};${isDone?'text-decoration:line-through':''}">
              ${displayTitle}
            </div>
            <div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">
              ${t.contactName ? `<span style="font-size:11px;color:var(--text3)"><i class="ti ti-user"></i> ${t.contactName}</span>` : ''}
              ${t.businessName ? `<span style="font-size:11px;color:var(--text3)"><i class="ti ti-building"></i> ${t.businessName}</span>` : ''}
              ${due ? `<span style="font-size:11px;color:${isOverdue?'var(--red)':'var(--text3)'}"><i class="ti ti-calendar"></i> ${due.toLocaleDateString()}</span>` : ''}
            </div>
          </div>
          ${!isDone ? `<button onclick="csComplete('${t.id}','${t.contactId||''}','${safeTitle}','${safeAssignee}')"
            style="background:rgba(0,196,106,.15);color:var(--primary);border:1px solid rgba(0,196,106,.4);
                   border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">
            ✓ Complete</button>`
          : `<span style="font-size:11px;color:var(--green);flex-shrink:0;font-weight:700">✓ Done</span>`}
        </div>`;
      }).join('')}
    </div>`).join('');
}

// ── Complete task + send note ─────────────────────────────────────────────────
async function csComplete(taskId, contactId, taskTitle, staffName) {
  if (!contactId) { toast('No contact linked to this task'); return; }
  const btn = event?.currentTarget;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const res = await fetch(`/api/contacts/${contactId}/tasks/${taskId}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedBy: staffName, taskTitle }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast('✓ Task completed');

    // ── Update in memory immediately — no API reload needed ──────────────
    // Mark task as completed in csState.rawTasks
    const t = csState.rawTasks.find(t => t.id === taskId);
    if (t) { t.completed = true; t.status = 'completed'; }
    // Also update in tbState.tasks
    const t2 = (tbState.tasks || []).find(t => t.id === taskId);
    if (t2) { t2.completed = true; t2.status = 'completed'; }

    // Animate the row out then re-render
    const rowEl = document.querySelector(`[data-task-id="${taskId}"]`) ||
                  document.querySelector(`[onclick*="${taskId}"]`);
    if (rowEl) {
      rowEl.style.transition = 'opacity .3s, transform .3s';
      rowEl.style.opacity = '0.3';
      rowEl.style.transform = 'scale(.98)';
    }
    setTimeout(() => csApplyFilter(), 350); // re-render after brief animation

  } catch(e) {
    if (btn) { btn.disabled = false; btn.textContent = '✓ Complete'; }
    toast('Error: ' + e.message);
  }
}

// ── Settings panel (CS Staff toggle) ─────────────────────────────────────────
function csToggleSettings() {
  const panel = document.getElementById('cs-settings-panel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  if (panel.style.display === 'block') {
    // Auto-load staff if board hasn't been loaded yet
    if (!csState.allStaff.length) {
      csLoad(false).then(() => csRenderSettings());
    } else {
      csRenderSettings();
    }
  }
}

function csRenderSettings() {
  const grid = document.getElementById('cs-staff-settings-grid');
  if (!grid || !csState.allStaff.length) return;
  const csIds = csGetStaffIds();
  grid.innerHTML = csState.allStaff.map(s => {
    const isCS = csIds.includes(s.id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);
                border:1px solid ${isCS?'var(--primary)':'var(--border)'};border-radius:10px">
      <div style="width:30px;height:30px;border-radius:50%;background:var(--primary);color:#0a1a0f;
                  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">
        ${s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
      </div>
      <span style="font-size:13px;font-weight:600;color:var(--text);flex:1">${s.name}</span>
      <div onclick="csToggleStaff('${s.id}')" style="cursor:pointer;display:flex;align-items:center;gap:6px">
        <div style="width:38px;height:20px;border-radius:10px;background:${isCS?'var(--primary)':'var(--bg2)'};
                    border:1px solid ${isCS?'var(--primary)':'var(--border)'};position:relative;flex-shrink:0">
          <div style="position:absolute;top:2px;${isCS?'right:2px':'left:2px'};width:14px;height:14px;
                      border-radius:50%;background:${isCS?'#0a1a0f':'var(--text3)'}"></div>
        </div>
        <span style="font-size:11px;color:${isCS?'var(--primary)':'var(--text3)'};font-weight:600">${isCS?'CS':'OFF'}</span>
      </div>
    </div>`;
  }).join('');
}

function csToggleStaff(userId) {
  const ids = csGetStaffIds();
  const idx = ids.indexOf(userId);
  if (idx === -1) ids.push(userId); else ids.splice(idx, 1);
  csSaveStaffIds(ids);
  csRenderSettings();
  csRenderStaffTabs();
  csApplyFilter();
  toast(idx === -1 ? '✓ Added to CS staff' : 'Removed from CS staff');
}

// ── Add CS Task modal ─────────────────────────────────────────────────────────
let csAddSelectedContact = null;

function csOpenAddTask() {
  document.getElementById('cs-add-modal')?.remove();
  const csIds = csGetStaffIds();
  const staffPool2 = csState.allStaff?.length ? csState.allStaff : ATS_STAFF_FALLBACK;
  const csStaff = csIds.length ? staffPool2.filter(s => csIds.includes(s.id)) : staffPool2;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const modal = document.createElement('div');
  modal.id = 'cs-add-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg2);z-index:1">
        <div style="font-size:15px;font-weight:800;color:var(--text)"><i class="ti ti-clipboard-list" style="color:var(--primary);margin-right:6px"></i>Add CS Task</div>
        <button onclick="document.getElementById('cs-add-modal').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:22px;line-height:1">×</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:8px">CLIENT — GHL CONTACT</div>
          <div style="position:relative">
            <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:13px;pointer-events:none"></i>
            <input id="cs-add-contact-search" type="text" autocomplete="off"
              placeholder="Type to search or scroll below..."
              oninput="csAddSearchContact(this.value)"
              onfocus="csAddSearchContact(this.value || '')"
              style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px 9px 32px;font-size:13px;box-sizing:border-box">
          </div>
          <!-- Scrollable contact list — always visible, filtered by search -->
          <div id="cs-add-contact-results"
            style="margin-top:6px;max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;background:var(--bg3);display:none"></div>
          <div id="cs-add-selected" style="display:none;padding:8px 12px;background:rgba(0,196,106,.08);border:1px solid rgba(0,196,106,.3);border-radius:8px;margin-top:6px;font-size:12px;color:var(--green);font-weight:700"></div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:8px">WHAT NEEDS TO BE DONE?</div>
          <input id="cs-add-title" type="text" placeholder="e.g. Collect missing email and backup codes"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:8px">DUE DATE</div>
          <input id="cs-add-due" type="date" value="${todayStr}"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:8px">ASSIGN TO CS STAFF</div>
          <select id="cs-add-assignee" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px">
            <option value="">-- Auto-assign (round-robin) --</option>
            ${csStaff.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
          ${!csStaff.length ? '<div style="font-size:11px;color:var(--yellow);margin-top:6px">⚠ No CS staff set up yet — go to CS Staff settings to designate staff.</div>' : ''}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:8px">NOTES (OPTIONAL)</div>
          <textarea id="cs-add-notes" placeholder="Any additional context..."
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;min-height:70px;resize:vertical;box-sizing:border-box"></textarea>
        </div>
        <div id="cs-add-status" style="font-size:12px;text-align:center;min-height:18px"></div>
        <button onclick="csSubmitTask()"
          style="width:100%;background:var(--primary);color:#0a1a0f;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:800;cursor:pointer">
          <i class="ti ti-send"></i> Create CS Task
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  csAddSelectedContact = null;
}

function csAddSearchContact(query) {
  const resultsEl = document.getElementById('cs-add-contact-results');
  if (!resultsEl) return;
  const q = (query || '').toLowerCase().trim();
  const clients = state.clients || [];

  // Empty query — show first 50 contacts alphabetically; otherwise filter
  const matches = q.length < 1
    ? clients.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).slice(0,50)
    : clients.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.dot_number||'').includes(q) ||
        (c.business_name||'').toLowerCase().includes(q)
      ).slice(0, 30);

  resultsEl.style.display = 'block';

  if (!clients.length) {
    resultsEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 12px">No contacts loaded — visit Dashboard first to sync GHL</div>';
    return;
  }
  if (!matches.length) {
    resultsEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:10px 12px">No contacts match your search</div>';
    return;
  }

  resultsEl.innerHTML = matches.map(c => {
    const safeName = (c.name||'Unknown').replace(/'/g, "\'");
    const biz = c.business_name && c.business_name !== c.name
      ? `<span style="color:var(--text3);font-size:11px"> · ${c.business_name}</span>` : '';
    const dot = c.dot_number
      ? `<span style="color:var(--text3);font-size:10px;margin-left:4px">DOT# ${c.dot_number}</span>` : '';
    return `<div onclick="csAddSelectContact('${c.id}','${safeName}')"
      style="padding:9px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);
             font-size:12px;color:var(--text);display:flex;align-items:center;justify-content:space-between"
      onmouseover="this.style.background='rgba(0,196,106,.08)'"
      onmouseout="this.style.background='transparent'"
    ><span>${c.name||'Unknown'}${biz}</span>${dot}</div>`;
  }).join('');

  if (q.length > 0) {
    const totalMatches = clients.filter(c =>
      (c.name||'').toLowerCase().includes(q) ||
      (c.dot_number||'').includes(q) ||
      (c.business_name||'').toLowerCase().includes(q)).length;
    if (totalMatches > 30)
      resultsEl.innerHTML += `<div style="font-size:11px;color:var(--text3);padding:8px 12px;text-align:center;border-top:1px solid var(--border)">Showing 30 of ${totalMatches} — keep typing to narrow down</div>`;
  }
}

function csAddSelectContact(id, name) {
  csAddSelectedContact = { id, name };
  const resultsEl = document.getElementById('cs-add-contact-results');
  if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
  const searchEl = document.getElementById('cs-add-contact-search');
  if (searchEl) searchEl.value = name;
  const sel = document.getElementById('cs-add-selected');
  if (sel) { sel.style.display = 'block'; sel.textContent = `✓ Selected: ${name}`; }
}

async function csSubmitTask() {
  const status = document.getElementById('cs-add-status');
  const title = document.getElementById('cs-add-title').value.trim();
  const due = document.getElementById('cs-add-due').value;
  const notes = document.getElementById('cs-add-notes').value.trim();
  let assignee = document.getElementById('cs-add-assignee').value;

  if (!csAddSelectedContact) { status.innerHTML = '<span style="color:var(--red)">⚠ Please select a client</span>'; return; }
  if (!title) { status.innerHTML = '<span style="color:var(--red)">⚠ Please describe what needs to be done</span>'; return; }
  if (!assignee) assignee = csNextAssignee() || '';

  // ── Duplicate guard ───────────────────────────────────────────────────────
  const existingM = csFindOpenTask(csAddSelectedContact.id);
  if (existingM) {
    status.innerHTML = '<span style="color:var(--yellow)">⚠ This contact already has an open CS task — opening it</span>';
    setTimeout(() => {
      document.getElementById('cs-add-modal')?.remove();
      csOpenTaskCard(existingM);
    }, 900);
    return;
  }

  status.innerHTML = '<span style="color:var(--text3)">Creating CS task...</span>';
  try {
    const res = await fetch(`/api/contacts/${csAddSelectedContact.id}/tasks`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        title: `${CS_PREFIX} ${title}`,
        body: notes,
        assignedTo: assignee || undefined,
        dueDate: due ? new Date(due+'T12:00:00').toISOString() : new Date(Date.now()+86400000).toISOString(),
        completed: false,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error||'Failed');
    // Inject into memory immediately so task shows without waiting for API refresh
    const newT = {
      id: data.task?.id || `local-${Date.now()}`,
      title: fullTitle, body: notes, assigneeId: assignee, assignedTo: assignee,
      assigneeName: (csState.allStaff.find(s=>s.id===assignee)||ATS_STAFF_FALLBACK.find(s=>s.id===assignee)||{}).name||'Staff',
      contactId: csAddSelectedContact.id, contactName: csAddSelectedContact.name,
      dueDate: due ? new Date(due+'T12:00:00').toISOString() : new Date(Date.now()+86400000).toISOString(),
      completed: false, status: 'open',
    };
    if (!tbState.tasks) tbState.tasks = [];
    tbState.tasks.push(newT);
    if (!csState.rawTasks) csState.rawTasks = [];
    csState.rawTasks.push({ ...newT });
    const staffE = csState.allStaff.find(s=>s.id===assignee);
    if (staffE) { if (!staffE.tasks) staffE.tasks=[]; staffE.tasks.push(newT); }

    status.innerHTML = '<span style="color:var(--green)">✓ CS Task created!</span>';
    toast(`✓ Task assigned to ${newT.assigneeName}`);
    setTimeout(() => { document.getElementById('cs-add-modal')?.remove(); csApplyFilter(); }, 700);
  } catch(e) { status.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`; }
}

// ── Auto-create CS intake task when new contact is created via DOT Lookup ─────
async function csCreateIntakeTask(contactId, companyName) {
  const assignee = csNextAssignee();
  if (!assignee) { console.log('CS intake skipped — no CS staff configured'); return; }
  try {
    await fetch(`/api/contacts/${contactId}/tasks`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        title: `${CS_PREFIX} Collect Client Info — ${companyName}`,
        body: 'Please update the following in GHL:\n• Email address\n• Phone number\n• DOT number confirmed\n• License / CDL information\n• Portal backup codes',
        assignedTo: assignee,
        dueDate: new Date(Date.now()+86400000).toISOString(),
        completed: false,
      }),
    });
    console.log(`✓ CS intake task created for ${companyName}`);
  } catch(e) { console.warn('CS intake task failed:', e.message); }
}

// ── CS Board loaded via navigateTo hook above ────────────────────────────────


// ═════════════════════════════════════════════════════════════════════════════
// CS BOARD — CONTACT AUDIT + LICENSE TRACKING (client-side, uses state.clients)
// ═════════════════════════════════════════════════════════════════════════════

let csAuditData = null;

// ── Run audit client-side from already-loaded state.clients ──────────────────
const CS_AUDIT_CACHE_KEY = 'ats_audit_cache';
const CS_AUDIT_TTL       = 60 * 60 * 1000; // 1 hour

function csShowCachedAudit() {
  try {
    const cached = JSON.parse(localStorage.getItem(CS_AUDIT_CACHE_KEY) || 'null');
    if (cached && cached.data && (Date.now() - cached.ts) < CS_AUDIT_TTL) {
      csAuditData = cached.data;
      csRenderAudit(cached.data);
      const area = document.getElementById('cs-audit-results');
      if (area) {
        const ageMin = Math.round((Date.now() - cached.ts) / 60000);
        const ageBar = document.createElement('div');
        ageBar.style.cssText = 'font-size:10px;color:var(--text3);margin-bottom:10px;display:flex;align-items:center;gap:8px;padding:6px 0';
        ageBar.innerHTML = `<i class="ti ti-clock"></i> Results from ${ageMin}m ago &nbsp;·&nbsp;
          <button onclick="csRunAudit(true)" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:10px;text-decoration:underline;padding:0">Refresh now</button>`;
        area.prepend(ageBar);
      }
      return true; // cache hit
    }
  } catch(e) {}
  // No cache — show prompt
  const area = document.getElementById('cs-audit-results');
  if (area && !area.innerHTML.trim()) {
    area.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text3);font-size:12px">
      Click <strong style="color:var(--text)">Run Audit</strong> to scan Advanced &amp; Recurring contacts for missing info.
      <div style="font-size:11px;margin-top:6px;opacity:.6">Results cache for 1 hour — no auto-scan on open</div>
    </div>`;
  }
  return false;
}

function csRunAudit(force = false) {
  if (!force && csShowCachedAudit()) return; // use cache if fresh
  csRunAuditFull(); // run fresh scan
}

function csRunAuditFull() {
  const btn  = document.getElementById('cs-audit-btn');
  const area = document.getElementById('cs-audit-results');

  const allClients = state.clients || [];
  if (!allClients.length) {
    if (area) area.innerHTML = '<div style="color:var(--yellow);padding:12px">⚠ Client list not loaded yet — go to Dashboard first to sync GHL, then return here.</div>';
    return;
  }

  // Only audit Advanced and Recurring contacts — these are the ones we care about
  const clients = allClients.filter(c => {
    const tags = (c.tags || []).map(t => String(t).toLowerCase());
    return tags.some(t => t.includes('advance') || t.includes('recurring'));
  });

  if (btn) { btn.innerHTML = '<i class="ti ti-refresh"></i> Re-scan'; }

  const issues = [];
  clients.forEach(c => {
    const missing = [];
    const hasDotConcat = c.business_name && /DOT#/i.test(c.business_name);
    if (!c.email)           missing.push('Email');
    if (!c.phone)           missing.push('Phone');
    if (!c.dot_number)      missing.push('DOT#');
    if (!c.mc_number)       missing.push('MC#');
    if (!c.ein)             missing.push('EIN');
    if (!c.mailing_address) missing.push('Mailing Address');
    if (!hasDotConcat)      missing.push('Business Name (no DOT#)');
    const hasLicense = (c.tags||[]).includes('license-received');
    if (!hasLicense)        missing.push('License Info');
    if (missing.length) {
      issues.push({ id: c.id, name: c.name, business_name: c.business_name,
        dot_number: c.dot_number, phone: c.phone, email: c.email,
        missing, hasLicense, tags: c.tags || [] });
    }
  });

  issues.sort((a,b) => b.missing.length - a.missing.length);
  csAuditData = { total: clients.length, totalAll: allClients.length, issues, issueCount: issues.length };
  // Cache results for 1 hour
  try {
    localStorage.setItem(CS_AUDIT_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: csAuditData }));
  } catch(e) {}
  csRenderAudit(csAuditData);
}

// ── Audit pagination state ────────────────────────────────────────────────────
let csAuditPage = 0;
const CS_AUDIT_PAGE_SIZE = 25;
let csAuditFilter = 'all'; // 'all' or a missing field label

// ── Render audit results ──────────────────────────────────────────────────────
function csRenderAudit(data) {
  const area = document.getElementById('cs-audit-results');
  if (!area) return;
  csAuditPage = 0; // reset to first page on new scan

  if (!data.issues.length) {
    area.innerHTML = `<div style="text-align:center;padding:30px;color:var(--green)">
      <i class="ti ti-circle-check" style="font-size:32px;display:block;margin-bottom:8px"></i>
      All ${data.total} contacts have complete information!
    </div>`; return;
  }

  const fieldCounts = {};
  data.issues.forEach(c => c.missing.forEach(m => { fieldCounts[m] = (fieldCounts[m]||0)+1; }));

  area.innerHTML = `
    <!-- Summary chips (clickable filters) -->
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-right:4px">${data.issueCount} of ${data.total} <span style="background:rgba(0,196,106,.12);color:var(--primary);border-radius:4px;padding:1px 7px;font-size:11px">Advanced/Recurring only</span> contacts missing info:</div>
      <span onclick="csAuditSetFilter('all')" id="cs-af-all"
        style="background:rgba(0,196,106,.15);border:1px solid rgba(0,196,106,.4);color:var(--primary);
               border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer">All</span>
      ${Object.entries(fieldCounts).sort((a,b)=>b[1]-a[1]).map(([f,n])=>`
        <span onclick="csAuditSetFilter('${f.replace(/'/g,"\'")}')" id="cs-af-${f.replace(/[^a-z0-9]/gi,'_')}"
          style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#ef4444;
                 border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer">${f} (${n})</span>`).join('')}
    </div>
    <!-- Bulk action -->
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;color:var(--text3)">
        <input type="checkbox" id="cs-chk-all" onchange="csToggleSelectAll(this.checked)"
          style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer">
        Select All
      </label>
      <button id="cs-create-selected-btn" onclick="csCreateSelectedTasks()" disabled
        style="background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid #7c3aed;opacity:.5;
               border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;
               display:flex;align-items:center;gap:6px">
        <i class="ti ti-wand"></i> Create CS Tasks for Selected (<span id="cs-selected-count">0</span>)
      </button>
      <button onclick="csGenerateAllTasks()"
        style="background:var(--bg3);color:var(--text3);border:1px solid var(--border);
               border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;
               display:flex;align-items:center;gap:6px">
        All Issues
      </button>
      <div id="cs-audit-bulk-status" style="font-size:12px;color:var(--text3)"></div>
    </div>
    <!-- Rows container -->
    <div id="cs-audit-rows"></div>
    <!-- Pagination -->
    <div id="cs-audit-pagination"></div>
  `;
  csAuditRenderPage();
}

function csAuditSetFilter(field) {
  csAuditFilter = field;
  csAuditPage = 0;
  csAuditRenderPage();
}

function csAuditRenderPage() {
  if (!csAuditData) return;
  const all = csAuditFilter === 'all'
    ? csAuditData.issues
    : csAuditData.issues.filter(c => c.missing.includes(csAuditFilter));

  const total = all.length;
  const pages = Math.ceil(total / CS_AUDIT_PAGE_SIZE);
  const start = csAuditPage * CS_AUDIT_PAGE_SIZE;
  const slice = all.slice(start, start + CS_AUDIT_PAGE_SIZE);

  const rows = document.getElementById('cs-audit-rows');
  const pag  = document.getElementById('cs-audit-pagination');
  if (rows) rows.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${slice.map(c => csAuditRow(c)).join('')}</div>`;

  if (pag) {
    if (pages <= 1) { pag.innerHTML = ''; return; }
    pag.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding:12px 0;border-top:1px solid var(--border)">
        <button onclick="csAuditGoPage(${csAuditPage-1})" ${csAuditPage===0?'disabled':''} 
          style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;opacity:${csAuditPage===0?.4:1}">
          ← Prev
        </button>
        <div style="font-size:12px;color:var(--text3)">
          Page <strong style="color:var(--text)">${csAuditPage+1}</strong> of ${pages}
          &nbsp;·&nbsp; ${start+1}–${Math.min(start+CS_AUDIT_PAGE_SIZE,total)} of ${total} contacts
        </div>
        <button onclick="csAuditGoPage(${csAuditPage+1})" ${csAuditPage>=pages-1?'disabled':''}
          style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;opacity:${csAuditPage>=pages-1?.4:1}">
          Next →
        </button>
      </div>`;
  }
}

function csAuditGoPage(n) {
  const all = csAuditFilter === 'all' ? csAuditData.issues : csAuditData.issues.filter(c => c.missing.includes(csAuditFilter));
  const pages = Math.ceil(all.length / CS_AUDIT_PAGE_SIZE);
  csAuditPage = Math.max(0, Math.min(n, pages-1));
  csAuditRenderPage();
  document.getElementById('cs-audit-results')?.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function csAuditRow(c) {
  const displayName = (c.name && c.name !== 'Unknown')
    ? c.name : (c.business_name || (c.dot_number ? 'DOT# '+c.dot_number : 'Unknown'));
  const safeName   = displayName.replace(/'/g, "\'");
  const safeBiz    = (c.business_name||'').replace(/'/g, "\'");
  const hasLicense = c.hasLicense || (c.tags||[]).includes('license-received');
  const csIds      = csGetStaffIds();
  const staffPool  = csState.allStaff?.length ? csState.allStaff : ATS_STAFF_FALLBACK;
  // CS staff first, pre-selected; then others
  const csStaffList  = staffPool.filter(s => csIds.includes(s.id));
  const otherStaff   = staffPool.filter(s => !csIds.includes(s.id));
  const orderedStaff = [...csStaffList, ...otherStaff];
  const defaultId    = csStaffList[0]?.id || '';
  const staffOpts    = orderedStaff.map(s => {
    const isCS = csIds.includes(s.id);
    const sel  = s.id === defaultId ? ' selected' : '';
    return `<option value="${s.id}"${sel}>${isCS ? '\u2605 ' : ''}${s.name}</option>`;
  }).join('');
  return `
  <div id="cs-audit-row-${c.id}" style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:10px 14px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <input type="checkbox" id="cs-chk-${c.id}" data-contact-id="${c.id}"
        data-name="${safeName}" data-biz="${safeBiz}"
        onchange="csUpdateSelectionCount()"
        style="width:16px;height:16px;accent-color:var(--primary);flex-shrink:0;cursor:pointer">
      <div style="flex:1;min-width:160px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${displayName}</div>
        ${c.business_name && c.business_name !== displayName ? `<div style="font-size:11px;color:var(--text3);margin-top:1px">${c.business_name}</div>` : ''}
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px">
          ${c.missing.map(m=>`<span style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#ef4444;border-radius:5px;padding:2px 6px;font-size:10px;font-weight:700">${m}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;flex-wrap:wrap">
        <button onclick="csToggleLicense('${c.id}','${safeName}',${hasLicense})" id="cs-lic-${c.id}"
          style="background:${hasLicense ? 'rgba(0,196,106,.15)' : 'var(--bg2)'};color:${hasLicense ? 'var(--green)' : 'var(--text3)'};
                 border:1px solid ${hasLicense ? 'rgba(0,196,106,.4)' : 'var(--border)'};border-radius:7px;
                 padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
          ${hasLicense ? '\u2713 License' : '\uD83D\uDCC4 License?'}
        </button>
        <select id="cs-assignee-${c.id}"
          style="background:var(--bg2);border:1px solid rgba(124,58,237,.35);color:#a78bfa;border-radius:7px;
                 padding:5px 8px;font-size:11px;cursor:pointer;max-width:140px">
          <option value="">Auto-assign</option>
          ${staffOpts}
        </select>
        <button id="cs-task-btn-${c.id}" onclick="csCreateAuditTask('${c.id}','${safeName}','${safeBiz}')"
          style="background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.4);
                 border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
          + CS Task
        </button>
      </div>
    </div>
  </div>`;
}

// ── Toggle license-received tag ───────────────────────────────────────────────
async function csToggleLicense(contactId, name, currentlyHas) {
  const btn = document.getElementById(`cs-lic-${contactId}`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const addTags    = currentlyHas ? [] : ['license-received'];
    const removeTags = currentlyHas ? ['license-received'] : [];
    const res = await fetch(`/api/contacts/${contactId}/tags`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ addTags, removeTags }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const nowHas = !currentlyHas;
    if (btn) {
      btn.disabled = false;
      btn.textContent = nowHas ? '✓ License' : '📄 License?';
      btn.style.background = nowHas ? 'rgba(0,196,106,.15)' : 'var(--bg2)';
      btn.style.color = nowHas ? 'var(--green)' : 'var(--text3)';
      btn.style.border = nowHas ? '1px solid rgba(0,196,106,.4)' : '1px solid var(--border)';
      btn.onclick = () => csToggleLicense(contactId, name, nowHas);
    }
    toast(nowHas ? `✓ License received marked for ${name}` : `License mark removed for ${name}`);
  } catch(e) {
    if (btn) { btn.disabled = false; }
    toast('Error: ' + e.message);
  }
}

// ── Create CS task from audit row ─────────────────────────────────────────────

// ── Duplicate CS task guard ────────────────────────────────────────────────────
function csFindOpenTask(contactId) {
  if (!contactId || !csState.rawTasks) return null;
  return csState.rawTasks.find(t =>
    (t.contactId || t.contact_id) === contactId &&
    !t.completed &&
    t.status !== 'completed'
  ) || null;
}

async function csCreateAuditTask(contactId, name, bizName) {
  // ── Duplicate guard ───────────────────────────────────────────────────────
  const existing = csFindOpenTask(contactId);
  if (existing) {
    toast('⚠ Already has an open CS task — opening it');
    csOpenTaskCard(existing);
    return;
  }

  const selectEl  = document.getElementById(`cs-assignee-${contactId}`);
  const assigneeId = (selectEl && selectEl.value) ? selectEl.value : csNextAssignee();
  const assigneeName = (csState.allStaff.find(s => s.id === assigneeId) ||
                        ATS_STAFF_FALLBACK.find(s => s.id === assigneeId) || {}).name || 'Staff';

  const missingList  = csAuditData?.issues?.find(c=>c.id===contactId)?.missing || [];
  const displayName  = (name && name !== 'Unknown') ? name : (bizName || name);
  const title = `${CS_PREFIX} Update Missing Info — ${displayName}`;
  const body  = missingList.length
    ? `Please update the following missing fields in GHL:\n${missingList.map(m=>`• ${m}`).join('\n')}`
    : 'Please review and update contact information in GHL.';
  const dueDate = new Date(Date.now()+86400000).toISOString();

  // Show loading state on button
  const row     = document.getElementById(`cs-audit-row-${contactId}`);
  const taskBtn = document.getElementById(`cs-task-btn-${contactId}`);
  if (taskBtn) { taskBtn.disabled = true; taskBtn.textContent = 'Creating...'; taskBtn.style.background = 'rgba(245,158,11,.2)'; taskBtn.style.color = '#f59e0b'; }

  try {
    const res = await fetch(`/api/contacts/${contactId}/tasks`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, body, assignedTo: assigneeId || undefined, dueDate, completed: false }),
    });
    const data = await res.json();

    // ── Server says this contact already has an open CS task ──────────────
    if (res.status === 409 && data.existingTask) {
      if (taskBtn) { taskBtn.disabled = false; taskBtn.textContent = '+ CS Task'; taskBtn.style.background = 'rgba(124,58,237,.15)'; taskBtn.style.color = '#a78bfa'; }
      const row = document.getElementById(`cs-audit-row-${contactId}`);
      if (row) {
        row.innerHTML = `<div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
          <i class="ti ti-alert-circle" style="color:var(--yellow);font-size:18px;flex-shrink:0"></i>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--yellow)">Already has an open CS task</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${displayName} · <button onclick="csOpenTaskCard(${JSON.stringify({...data.existingTask, contactId, contactName: displayName}).replace(/"/g,'&quot;')})" style="background:none;border:none;color:var(--primary);cursor:pointer;font-size:11px;text-decoration:underline;padding:0">Open existing task →</button></div>
          </div>
        </div>`;
      }
      toast('⚠ Contact already has an open CS task');
      return;
    }

    if (!res.ok) throw new Error(data.error);

    // ── Inject task directly into memory so it shows immediately ──────────
    const newTask = {
      id:           data.task?.id || `local-${Date.now()}`,
      title,
      body,
      assigneeId,
      assignedTo:   assigneeId,
      assigneeName,
      contactId,
      contactName:  displayName,
      businessName: bizName || '',
      dueDate,
      completed:    false,
      status:       'open',
    };
    // Add to tbState.tasks
    if (!tbState.tasks) tbState.tasks = [];
    tbState.tasks.push(newTask);
    // Add to csState.rawTasks
    if (!csState.rawTasks) csState.rawTasks = [];
    csState.rawTasks.push({ ...newTask });
    // Update the staff entry in csState.allStaff
    const staffEntry = csState.allStaff.find(s => s.id === assigneeId);
    if (staffEntry) { if (!staffEntry.tasks) staffEntry.tasks = []; staffEntry.tasks.push(newTask); }

    // Mark row as done
    if (row) {
      row.innerHTML = `<div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
        <i class="ti ti-circle-check" style="color:var(--green);font-size:18px;flex-shrink:0"></i>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--green)">✓ Task created — assigned to ${assigneeName}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${displayName} · Due tomorrow</div>
        </div>
      </div>`;
    }

    // Update CS Board task list immediately
    csApplyFilter();
    toast(`✓ CS task assigned to ${assigneeName}`);

  } catch(e) {
    if (taskBtn) { taskBtn.disabled = false; taskBtn.textContent = '+ CS Task'; taskBtn.style.background = 'rgba(124,58,237,.15)'; taskBtn.style.color = '#a78bfa'; }
    const errRow = document.getElementById(`cs-audit-row-${contactId}`);
    if (errRow) { const e2=document.createElement('div'); e2.style.cssText='font-size:11px;color:#ef4444;padding:4px 14px 8px;font-weight:600'; e2.textContent='Error: '+e.message; errRow.appendChild(e2); }
    console.error('CS task error:', e);
  }
}

// ── CS Tools toolbar toggle ───────────────────────────────────────────────────
const CS_TOOLS = ['dot','vehicles','audit'];
let csActiveTool = null;

function csTool(name) {
  if (csActiveTool === name) {
    // Close if already open
    document.getElementById('cs-tool-panel-' + name).style.display = 'none';
    const btn = document.getElementById('cs-tool-btn-' + name);
    if (btn) { btn.style.background = 'var(--bg3)'; btn.style.color = 'var(--text)'; btn.style.borderColor = 'var(--border)'; }
    csActiveTool = null;
    return;
  }
  // Close any open panel first
  if (csActiveTool) {
    document.getElementById('cs-tool-panel-' + csActiveTool).style.display = 'none';
    const old = document.getElementById('cs-tool-btn-' + csActiveTool);
    if (old) { old.style.background = 'var(--bg3)'; old.style.color = 'var(--text)'; old.style.borderColor = 'var(--border)'; }
  }
  // Open selected panel
  const panel = document.getElementById('cs-tool-panel-' + name);
  const btn   = document.getElementById('cs-tool-btn-' + name);
  if (panel) panel.style.display = 'block';
  if (btn)  {
    btn.style.background = name === 'vehicles' ? 'rgba(245,158,11,.15)'
      : name === 'drivers' ? 'rgba(96,165,250,.15)'
      : name === 'audit' ? 'rgba(124,58,237,.15)' : 'rgba(0,196,106,.15)';
    btn.style.color = name === 'vehicles' ? '#f59e0b'
      : name === 'drivers' ? '#60a5fa'
      : name === 'audit' ? '#a78bfa' : 'var(--primary)';
    btn.style.borderColor = name === 'vehicles' ? 'rgba(245,158,11,.4)'
      : name === 'drivers' ? 'rgba(96,165,250,.4)'
      : name === 'audit' ? 'rgba(124,58,237,.4)' : 'rgba(0,196,106,.4)';
  }
  csActiveTool = name;
  // Show cached audit results if available (no auto-run — user clicks Run Audit)
  if (name === 'audit') csShowCachedAudit();
}

// ── Selection helpers ─────────────────────────────────────────────────────────
function csUpdateSelectionCount() {
  const checked = document.querySelectorAll('[id^="cs-chk-"]:not(#cs-chk-all):checked');
  const count   = checked.length;
  const countEl = document.getElementById('cs-selected-count');
  const btn     = document.getElementById('cs-create-selected-btn');
  const allChk  = document.getElementById('cs-chk-all');
  if (countEl) countEl.textContent = count;
  if (btn) { btn.disabled = count === 0; btn.style.opacity = count === 0 ? '.5' : '1'; }
  // Update select-all checkbox state
  const total = document.querySelectorAll('[id^="cs-chk-"]:not(#cs-chk-all)').length;
  if (allChk) { allChk.indeterminate = count > 0 && count < total; allChk.checked = count === total && total > 0; }
}

function csToggleSelectAll(checked) {
  document.querySelectorAll('[id^="cs-chk-"]:not(#cs-chk-all)').forEach(chk => { chk.checked = checked; });
  csUpdateSelectionCount();
}

async function csCreateSelectedTasks() {
  const checked = [...document.querySelectorAll('[id^="cs-chk-"]:not(#cs-chk-all):checked')];
  if (!checked.length) return;
  const btn = document.getElementById('cs-create-selected-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Creating...'; }
  const statusEl = document.getElementById('cs-audit-bulk-status');
  let done = 0;
  for (const chk of checked) {
    const contactId = chk.dataset.contactId;
    const name      = chk.dataset.name;
    const biz       = chk.dataset.biz;
    // Read assignee from that row's dropdown
    const sel       = document.getElementById(`cs-assignee-${contactId}`);
    const assigneeId = sel?.value || csNextAssignee() || '';
    const assigneeName = (csState.allStaff.find(s=>s.id===assigneeId)||ATS_STAFF_FALLBACK.find(s=>s.id===assigneeId)||{}).name||'Staff';
    const missingList  = csAuditData?.issues?.find(c=>c.id===contactId)?.missing || [];
    const displayName  = (name && name !== 'Unknown') ? name : (biz || name);
    const title = `${CS_PREFIX} Update Missing Info — ${displayName}`;
    const body  = missingList.length ? `Please update:\n${missingList.map(m=>`• ${m}`).join('\n')}` : 'Please update contact info in GHL.';
    try {
      // Dupe check — open existing task instead of creating new one
      const existingT = csFindOpenTask(contactId);
      if (existingT) {
        console.log(`Skipped duplicate CS task for contact ${contactId}`);
        chk.checked = false;
        if (statusEl) statusEl.innerHTML = `<span style="color:var(--yellow)">⚠ ${displayName} already has an open task — skipped</span>`;
        await new Promise(r => setTimeout(r, 60));
        continue;
      }

      const res = await fetch(`/api/contacts/${contactId}/tasks`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ title, body, assignedTo: assigneeId||undefined,
          dueDate: new Date(Date.now()+86400000).toISOString(), completed: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      done++;
      // Inject into memory
      const newTask = { id: data.task?.id||`local-${Date.now()}`, title, body, assigneeId,
        assignedTo: assigneeId, assigneeName, contactId, contactName: displayName,
        businessName: biz||'', dueDate: new Date(Date.now()+86400000).toISOString(),
        completed: false, status:'open' };
      if (!tbState.tasks) tbState.tasks=[];
      tbState.tasks.push(newTask);
      if (!csState.rawTasks) csState.rawTasks=[];
      csState.rawTasks.push({...newTask});
      const staffE = csState.allStaff.find(s=>s.id===assigneeId);
      if (staffE) { if (!staffE.tasks) staffE.tasks=[]; staffE.tasks.push(newTask); }
      // Mark row as done
      const row = document.getElementById(`cs-audit-row-${contactId}`);
      if (row) row.style.opacity = '0.4';
      chk.checked = false;
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">${done} created so far...</span>`;
      await new Promise(r => setTimeout(r, 80));
    } catch(e) { console.error('CS task error for', displayName, e.message); }
  }
  if (btn) { btn.disabled = false; btn.innerHTML = `<i class="ti ti-wand"></i> Create CS Tasks for Selected (<span id="cs-selected-count">0</span>)`; }
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✓ ${done} CS tasks created</span>`;
  csUpdateSelectionCount();
  csApplyFilter(); // refresh board
  toast(`✓ ${done} CS tasks created`);
}

// ── Generate CS tasks for ALL audit issues ────────────────────────────────────
async function csGenerateAllTasks() {
  if (!csAuditData?.issues?.length) return;
  const btn = document.querySelector('[onclick="csGenerateAllTasks()"]');
  const statusEl = document.getElementById('cs-audit-bulk-status');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Generating...'; }

  let done = 0, failed = 0;
  const issues = csAuditData.issues.slice(0, 200); // cap at 200

  for (const c of issues) {
    try {
      const assignee = csNextAssignee();
      const body = `Please update the following missing fields in GHL:\n${c.missing.map(m=>`• ${m}`).join('\n')}`;
      await fetch(`/api/contacts/${c.id}/tasks`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          title: `[CS] Update Missing Info — ${c.name}`,
          body, assignedTo: assignee || undefined,
          dueDate: new Date(Date.now()+86400000).toISOString(),
          completed: false,
        }),
      });
      done++;
      const row = document.getElementById(`cs-audit-row-${c.id}`);
      if (row) row.style.opacity = '0.4';
      if (statusEl) statusEl.textContent = `${done}/${issues.length} tasks created...`;
      await new Promise(r => setTimeout(r, 120)); // rate limit
    } catch(e) { failed++; }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-wand"></i> Generate CS Tasks for All Issues'; }
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✓ ${done} tasks created${failed?`, ${failed} failed`:''}</span>`;
  toast(`✓ ${done} CS tasks generated`);
  setTimeout(() => csLoad(true), 1000);
}



// ═════════════════════════════════════════════════════════════════════════════
// CS STAFF MANAGEMENT MODAL
// ═════════════════════════════════════════════════════════════════════════════

// Known ATS staff — always available as fallback even before Tasks Board loads
const ATS_STAFF_FALLBACK = [
  { id: 'FmjXHSLQ6XWMGgj0Y0w3', name: 'Ahmed Gure' },
  { id: '48vCVBOEaRTpUJ23XC4K', name: 'Ahmed Yusuf' },
  { id: '40ynNiHEBfnZq6gsh7IS', name: 'Ali Ali' },
  { id: 'fnFKHlkLVfjYBzFxC5aG', name: 'Kamal Ahmed' },
  { id: 'yri669q8Ymx22zdFDPLK', name: 'Mahad Said Q' },
  { id: 'zohmJyCbnyzoBtLiKNir', name: 'Mustaf Hassan' },
  { id: 's57KFI2a9N3LmRprzdJW', name: 'Shucayb Jama' },
  { id: 'mIbzEna47UOXtsV2zzxD', name: 'Yahya Yusuf' },
  { id: 'DY4bAKCSR4dnw94zbj2a', name: 'Yusuf Yusuf' },
];

function csOpenStaffModal() {
  document.getElementById('cs-staff-modal')?.remove();

  // Use tbState if loaded, csState if available, otherwise fallback to hardcoded ATS staff
  const allStaff = tbState?.users?.length ? tbState.users
    : csState.allStaff?.length ? csState.allStaff
    : ATS_STAFF_FALLBACK;

  // Also sync fallback into csState.allStaff so dropdowns work
  if (!csState.allStaff?.length) csState.allStaff = ATS_STAFF_FALLBACK;

  const csIds = csGetStaffIds();
  const modal = document.createElement('div');
  modal.id = 'cs-staff-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:520px;max-width:95vw;
                max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <!-- Header -->
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text)">
            <i class="ti ti-users-group" style="color:var(--primary);margin-right:6px"></i>CS Staff Management
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            Toggle who is designated as Customer Service staff.
            CS staff appear on the CS Board and get auto-assigned intake tasks.
          </div>
        </div>
        <button onclick="document.getElementById('cs-staff-modal').remove()"
          style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:22px;line-height:1;padding:4px">×</button>
      </div>

      <!-- Staff list -->
      <div style="padding:16px 24px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:10px" id="cs-staff-modal-list">
        ${allStaff.map(s => {
          const isCS = csIds.includes(s.id);
          const initials = s.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          return `
          <div id="cs-modal-row-${s.id}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;
               background:${isCS?'rgba(0,196,106,.06)':'var(--bg3)'};
               border:1px solid ${isCS?'rgba(0,196,106,.35)':'var(--border)'};border-radius:10px;transition:all .15s">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#0a1a0f;
                        display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;flex-shrink:0">
              ${initials}
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--text)">${s.name}</div>
              <div style="font-size:11px;color:${isCS?'var(--green)':'var(--text3)'};margin-top:1px">
                ${isCS ? '✓ CS Staff' : 'Operator only'}
              </div>
            </div>
            <button onclick="csModalToggleStaff('${s.id}','${s.name.replace(/'/g,"\\'")}',this)"
              style="padding:7px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;
                     background:${isCS?'rgba(239,68,68,.12)':'rgba(0,196,106,.12)'};
                     color:${isCS?'#ef4444':'var(--green)'};
                     border:1px solid ${isCS?'rgba(239,68,68,.35)':'rgba(0,196,106,.35)'}">
              ${isCS ? 'Remove' : '+ Add CS'}
            </button>
          </div>`;
        }).join('')}
      </div>

      <!-- Footer -->
      <div style="padding:14px 24px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="font-size:12px;color:var(--text3)">
          <span id="cs-modal-count" style="color:var(--primary);font-weight:700">${csIds.length}</span> CS staff designated
        </div>
        <button onclick="document.getElementById('cs-staff-modal').remove()"
          style="background:var(--primary);color:#0a1a0f;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer">
          Done
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  // Close on backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function csModalToggleStaff(userId, userName, btn) {
  const ids  = csGetStaffIds();
  const isCS = ids.includes(userId);
  if (isCS) ids.splice(ids.indexOf(userId), 1);
  else ids.push(userId);
  csSaveStaffIds(ids);

  // Update button
  const nowCS = !isCS;
  btn.textContent = nowCS ? 'Remove' : '+ Add CS';
  btn.style.background = nowCS ? 'rgba(239,68,68,.12)' : 'rgba(0,196,106,.12)';
  btn.style.color = nowCS ? '#ef4444' : 'var(--green)';
  btn.style.border = `1px solid ${nowCS ? 'rgba(239,68,68,.35)' : 'rgba(0,196,106,.35)'}`;

  // Update row
  const row = document.getElementById(`cs-modal-row-${userId}`);
  if (row) {
    row.style.background = nowCS ? 'rgba(0,196,106,.06)' : 'var(--bg3)';
    row.style.border = `1px solid ${nowCS ? 'rgba(0,196,106,.35)' : 'var(--border)'}`;
    const label = row.querySelector('div > div:last-child');
    if (label) { label.textContent = nowCS ? '✓ CS Staff' : 'Operator only'; label.style.color = nowCS ? 'var(--green)' : 'var(--text3)'; }
  }

  // Update count
  const countEl = document.getElementById('cs-modal-count');
  if (countEl) countEl.textContent = ids.length;

  toast(nowCS ? `✓ ${userName} added to CS staff` : `${userName} removed from CS staff`);
  csRenderStaffTabs();
  csApplyFilter();
}



// ═════════════════════════════════════════════════════════════════════════════
// TASKS BOARD VIEW TOGGLE (Operator / CS Board)
// ═════════════════════════════════════════════════════════════════════════════

let tbCurrentView = 'operator';

function tbSwitchView(view) {
  tbCurrentView = view;
  const opView  = document.getElementById('tb-operator-view');
  const csView  = document.getElementById('tb-cs-view');
  const opBtn   = document.getElementById('tb-view-btn-operator');
  const csBtn   = document.getElementById('tb-view-btn-cs');
  if (!opView || !csView) return;

  if (view === 'operator') {
    opView.style.display = 'block';
    csView.style.display = 'none';
    if (opBtn) { opBtn.style.background = 'var(--primary)'; opBtn.style.color = '#0a1a0f'; }
    if (csBtn) { csBtn.style.background = 'transparent'; csBtn.style.color = 'var(--text3)'; }
  } else {
    opView.style.display = 'none';
    csView.style.display = 'block';
    if (csBtn) { csBtn.style.background = 'var(--primary)'; csBtn.style.color = '#0a1a0f'; }
    if (opBtn) { opBtn.style.background = 'transparent'; opBtn.style.color = 'var(--text3)'; }
    // Auto-load CS tasks from cache if Tasks Board already loaded
    setTimeout(() => {
      if (tbState.loaded && tbState.users.length) csLoadFromCache();
      else if (!csState.loading) csLoad(true);
    }, 100);
  }
}

// ── DOT Quick Update in CS Board ─────────────────────────────────────────────
async function csDotLookup() {
  const input  = document.getElementById('cs-dot-input');
  const result = document.getElementById('cs-dot-result');
  const dot    = (input?.value || '').trim();
  if (!dot) return;
  if (result) result.innerHTML = '<div style="color:var(--text3);font-size:12px"><i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Searching FMCSA...</div>';

  try {
    const res  = await fetch(`/api/dot/${dot}`);
    const data = await res.json();
    if (!res.ok || !data.info) throw new Error(data.error || 'Not found');
    const info = data.info;

    // Find matching GHL contact
    const q = dot.toLowerCase();
    const match = (state.clients || []).find(c =>
      (c.dot_number || '') === dot ||
      (c.business_name || '').toLowerCase().includes(info.legal_name?.toLowerCase() || '')
    );

    result.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:10px">CARRIER INFO</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${info.legal_name || '—'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">DOT# ${info.dot_number} · MC-${info.mc_number||'—'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${info.phone || ''}</div>
          <div style="font-size:11px;color:var(--text3)">${info.email || ''}</div>
        </div>
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:10px">STATUS</div>
          <div style="font-size:12px;font-weight:700;color:${info.operating_status==='AUTHORIZED'?'var(--green)':'#ef4444'}">${info.operating_status || '—'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">MCS-150: ${info.mcs150_date || '—'}</div>
          <div style="font-size:11px;color:var(--text3)">${info.mailing_address || ''}</div>
        </div>
      </div>
      ${match ? `
        <div style="background:rgba(0,196,106,.08);border:1px solid rgba(0,196,106,.3);border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--green)">✓ GHL Contact Found</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${match.name} · ${match.business_name || ''}</div>
          </div>
          <button onclick="csDotPushUpdate('${match.id}','${dot}')"
            style="background:var(--primary);color:#0a1a0f;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
            <i class="ti ti-cloud-upload"></i> Update GHL Contact
          </button>
        </div>` : `
        <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
          <div style="font-size:12px;color:var(--text3)">No existing GHL contact found for DOT# ${dot}</div>
          <button onclick="csDotCreateNew('${dot}')"
            style="background:rgba(0,196,106,.15);color:var(--primary);border:1px solid rgba(0,196,106,.4);border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">
            + Create New Contact
          </button>
        </div>`}
      <div id="cs-dot-push-status" style="font-size:12px;margin-top:8px"></div>`;

    // Store info for push
    window._csDotInfo = info;

  } catch(e) {
    if (result) result.innerHTML = `<div style="color:var(--red);font-size:12px">✗ ${e.message}</div>`;
  }
}

async function csDotPushUpdate(contactId, dotNumber) {
  const statusEl = document.getElementById('cs-dot-push-status');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text3)">Updating GHL contact...</span>';
  try {
    const res = await fetch(`/api/dot/${dotNumber}/push-to-ghl`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ contactId, info: window._csDotInfo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✓ GHL contact updated successfully</span>';
    toast('✓ GHL contact updated');
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}

async function csDotCreateNew(dotNumber) {
  if (!window._csDotInfo) return;
  const statusEl = document.getElementById('cs-dot-push-status');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text3)">Creating contact...</span>';
  try {
    const res = await fetch(`/api/dot/${dotNumber}/create-contact`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ info: window._csDotInfo }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✓ Contact created in GHL</span>';
    toast('✓ New GHL contact created');
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}



// ═════════════════════════════════════════════════════════════════════════════
// CS TASK CARD — click to view, edit, and reassign
// ═════════════════════════════════════════════════════════════════════════════

function csOpenTaskCard(task) {
  document.getElementById('cs-task-card-modal')?.remove();

  const staffPool = csState.allStaff?.length ? csState.allStaff : ATS_STAFF_FALLBACK;
  const csIds = csGetStaffIds();
  const displayTitle = (task.title || '').replace(/^\[CS\]\s*/, '');
  const dueVal = task.dueDate
    ? new Date(task.dueDate).toISOString().split('T')[0]
    : new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const modal = document.createElement('div');
  modal.id = 'cs-task-card-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9900;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:18px;
                width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.6)">

      <!-- Header -->
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg2);z-index:1">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--primary);letter-spacing:.1em;margin-bottom:4px">CS TASK</div>
          <div style="font-size:15px;font-weight:800;color:var(--text)">${displayTitle}</div>
        </div>
        <button onclick="document.getElementById('cs-task-card-modal').remove()"
          style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);cursor:pointer;
                 border-radius:8px;width:32px;height:32px;font-size:18px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>

      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">

        <!-- Contact info -->
        ${task.contactName ? `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
          <i class="ti ti-user" style="color:var(--primary);font-size:16px;flex-shrink:0"></i>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text)">${task.contactName}</div>
            ${task.businessName ? `<div style="font-size:11px;color:var(--text3)">${task.businessName}</div>` : ''}
          </div>
          ${task.contactId ? `
          <a href="https://app.gohighlevel.com/v2/location/SS9SXQU94ZExykvAta0y/contacts/detail/${task.contactId}" target="_blank"
            style="margin-left:auto;font-size:11px;color:var(--primary);text-decoration:none;display:flex;align-items:center;gap:4px;flex-shrink:0">
            <i class="ti ti-external-link"></i> GHL
          </a>` : ''}
        </div>` : ''}

        <!-- Task title -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:6px">TASK TITLE</div>
          <input id="cs-card-title" type="text" value="${displayTitle.replace(/"/g,'&quot;')}"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box">
        </div>

        <!-- Notes -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:6px">NOTES</div>
          <textarea id="cs-card-body" rows="3"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:13px;resize:vertical;box-sizing:border-box"
          >${(task.body || task.description || '').replace(/<[^>]+>/g,' ')}</textarea>
        </div>

        <!-- Due date -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:6px">DUE DATE</div>
          <input id="cs-card-due" type="date" value="${dueVal}"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box">
        </div>

        <!-- Assign to staff -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:6px">ASSIGN TO STAFF</div>
          <select id="cs-card-assignee"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);
                   border-radius:8px;padding:9px 12px;font-size:13px">
            <option value="">-- Keep current assignment --</option>
            ${[...staffPool.filter(s => csIds.includes(s.id)), ...staffPool.filter(s => !csIds.includes(s.id))]
              .map(s => {
                const isCS = csIds.includes(s.id);
                const isCurrent = s.id === (task.assigneeId || task.assignedTo);
                return `<option value="${s.id}" ${isCurrent ? 'selected' : ''}>${isCS ? '★ ' : ''}${s.name}</option>`;
              }).join('')}
          </select>
        </div>

        <!-- FMCSA DOT Lookup + Contact Update -->
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:10px">
            <i class="ti ti-search" style="color:var(--primary);margin-right:4px"></i>FMCSA LOOKUP & UPDATE CONTACT
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px">
            <input id="cs-card-dot" type="text" placeholder="Enter DOT number..."
              onkeydown="if(event.key==='Enter')csCardDotSearch('${task.contactId||''}')"
              value="${task.dotNumber||''}"
              style="flex:1;background:var(--bg2);border:1px solid var(--border);color:var(--text);
                     border-radius:8px;padding:8px 12px;font-size:13px">
            <button onclick="csCardDotSearch('${task.contactId||''}')"
              style="background:var(--primary);color:#0a1a0f;border:none;border-radius:8px;
                     padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px">
              <i class="ti ti-search"></i> Search
            </button>
          </div>
          <div id="cs-card-fmcsa-result" style="font-size:12px;color:var(--text3)"></div>
        </div>

        <div id="cs-card-status" style="font-size:12px;text-align:center;min-height:16px"></div>

        <!-- Action buttons -->
        <div style="display:flex;gap:8px">
          <button onclick="csUpdateTaskCard('${task.id}','${task.contactId||''}')"
            style="flex:1;background:var(--primary);color:#0a1a0f;border:none;border-radius:10px;
                   padding:11px;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">
            <i class="ti ti-device-floppy"></i> Save Changes
          </button>
          ${!task.completed ? `
          <button onclick="csCompleteFromCard('${task.id}','${task.contactId||''}','${displayTitle.replace(/'/g,"\\'")}','${(task.assigneeName||'').replace(/'/g,"\\'")}',this)"
            style="background:rgba(0,196,106,.15);color:var(--green);border:1px solid rgba(0,196,106,.4);
                   border-radius:10px;padding:11px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">
            ✓ Complete
          </button>` : '<span style="color:var(--green);font-size:12px;font-weight:700;display:flex;align-items:center;gap:4px"><i class="ti ti-circle-check"></i> Completed</span>'}
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
}

async function csUpdateTaskCard(taskId, contactId) {
  const title    = document.getElementById('cs-card-title')?.value.trim();
  const body     = document.getElementById('cs-card-body')?.value.trim();
  const due      = document.getElementById('cs-card-due')?.value;
  const assignee = document.getElementById('cs-card-assignee')?.value;
  const status   = document.getElementById('cs-card-status');

  if (!title) { if (status) status.innerHTML = '<span style="color:var(--red)">Title is required</span>'; return; }
  if (status) status.innerHTML = '<span style="color:var(--text3)">Saving...</span>';

  const fullTitle = title.startsWith('[CS]') ? title : `[CS] ${title}`;
  const payload = {
    title:      fullTitle,
    body:       body || '',
    dueDate:    due ? new Date(due + 'T12:00:00').toISOString() : undefined,
    assignedTo: assignee || undefined,
  };

  try {
    const res = await fetch(`/api/contacts/${contactId}/tasks/${taskId}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Update in-memory task
    const tIdx = csState.rawTasks.findIndex(t => t.id === taskId);
    if (tIdx !== -1) {
      const assigneeName = assignee
        ? (csState.allStaff.find(s=>s.id===assignee)||ATS_STAFF_FALLBACK.find(s=>s.id===assignee)||{}).name || ''
        : csState.rawTasks[tIdx].assigneeName;
      csState.rawTasks[tIdx] = { ...csState.rawTasks[tIdx], title: fullTitle, body, dueDate: payload.dueDate || csState.rawTasks[tIdx].dueDate, assigneeId: assignee || csState.rawTasks[tIdx].assigneeId, assigneeName };
    }
    if (tbState.tasks) {
      const tIdx2 = tbState.tasks.findIndex(t => t.id === taskId);
      if (tIdx2 !== -1) Object.assign(tbState.tasks[tIdx2], payload);
    }

    if (status) status.innerHTML = '<span style="color:var(--green)">✓ Saved successfully</span>';
    toast('✓ CS task updated');
    setTimeout(() => { document.getElementById('cs-task-card-modal')?.remove(); csApplyFilter(); }, 700);
  } catch(e) {
    if (status) status.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}

async function csCompleteFromCard(taskId, contactId, taskTitle, staffName, btn) {
  if (!contactId) { toast('No contact ID on this task — cannot complete'); return; }
  if (!taskId)    { toast('No task ID — cannot complete'); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .7s linear infinite"></i> Completing...'; }

  try {
    const res = await fetch(`/api/contacts/${contactId}/tasks/${taskId}/complete`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ completedBy: staffName, taskTitle }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to complete task');

    // ── Update in memory immediately ───────────────────────────────────────
    const t = csState.rawTasks.find(t => t.id === taskId);
    if (t) { t.completed = true; t.status = 'completed'; }
    const t2 = (tbState.tasks || []).find(t => t.id === taskId);
    if (t2) { t2.completed = true; t2.status = 'completed'; }

    toast('✓ Task completed');
    if (btn) { btn.innerHTML = '✓ Completed!'; btn.style.background = 'rgba(0,196,106,.2)'; btn.style.color = 'var(--green)'; btn.style.border = '1px solid rgba(0,196,106,.4)'; }
    setTimeout(() => {
      document.getElementById('cs-task-card-modal')?.remove();
      csApplyFilter(); // re-render board — task moves to Completed section
    }, 600);
  } catch(e) {
    console.error('Complete error:', e);
    if (btn) { btn.disabled = false; btn.innerHTML = '✓ Complete'; }
    toast('Error completing task: ' + e.message);
  }
}



// ── CS Task Card — FMCSA lookup and push to GHL contact ──────────────────────
async function csCardDotSearch(contactId) {
  const dotInput  = document.getElementById('cs-card-dot');
  const resultEl  = document.getElementById('cs-card-fmcsa-result');
  const dot = (dotInput?.value || '').trim();
  if (!dot) { if (resultEl) resultEl.innerHTML = '<span style="color:var(--yellow)">Enter a DOT number first</span>'; return; }
  if (resultEl) resultEl.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Searching FMCSA...';

  try {
    const res  = await fetch(`/api/dot/${dot}`);
    const data = await res.json();
    if (!res.ok || !data.info) throw new Error(data.error || 'Not found');
    const info = data.info;
    window._csCardDotInfo = { info, contactId };

    resultEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${info.legal_name || '—'}
          <span style="font-size:11px;font-weight:400;color:${info.operating_status==='AUTHORIZED'?'var(--green)':'#ef4444'};margin-left:6px">${info.operating_status||''}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">
          ${info.dot_number  ? `<div style="color:var(--text3);font-size:11px"><span style="color:var(--text2)">DOT#</span> ${info.dot_number}</div>` : ''}
          ${info.mc_number   ? `<div style="color:var(--text3);font-size:11px"><span style="color:var(--text2)">MC#</span> ${info.mc_number}</div>` : ''}
          ${info.ein         ? `<div style="color:var(--text3);font-size:11px"><span style="color:var(--text2)">EIN</span> ${info.ein}</div>` : ''}
          ${info.phone       ? `<div style="color:var(--text3);font-size:11px"><span style="color:var(--text2)">Phone</span> ${info.phone}</div>` : ''}
          ${info.email       ? `<div style="color:var(--text3);font-size:11px;grid-column:span 2"><span style="color:var(--text2)">Email</span> ${info.email}</div>` : ''}
          ${info.mailing_address ? `<div style="color:var(--text3);font-size:11px;grid-column:span 2"><span style="color:var(--text2)">Address</span> ${info.mailing_address}</div>` : ''}
          ${info.mcs150_date ? `<div style="color:var(--text3);font-size:11px"><span style="color:var(--text2)">MCS-150</span> ${info.mcs150_date}</div>` : ''}
          ${info.mcs150_mileage_year ? `<div style="color:var(--text3);font-size:11px"><span style="color:var(--text2)">Mileage Year</span> ${info.mcs150_mileage_year}</div>` : ''}
        </div>
      </div>
      <button onclick="csCardPushToContact()" id="cs-card-push-btn"
        style="width:100%;background:var(--primary);color:#0a1a0f;border:none;border-radius:8px;
               padding:9px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
        <i class="ti ti-cloud-upload"></i> Update GHL Contact with FMCSA Data
      </button>
      <div id="cs-card-push-status" style="font-size:11px;margin-top:6px;text-align:center"></div>`;
  } catch(e) {
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--red)">✗ ${e.message}</span>`;
  }
}

async function csCardPushToContact() {
  const { info, contactId } = window._csCardDotInfo || {};
  if (!info || !contactId) return;
  const btn = document.getElementById('cs-card-push-btn');
  const statusEl = document.getElementById('cs-card-push-status');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Updating...'; }

  try {
    const res = await fetch(`/api/dot/${info.dot_number}/push-to-ghl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactId, info }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (btn) { btn.disabled = false; btn.innerHTML = '✓ Contact Updated!'; btn.style.background = 'rgba(0,196,106,.2)'; btn.style.color = 'var(--green)'; btn.style.border = '1px solid rgba(0,196,106,.4)'; }
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✓ GHL contact updated with FMCSA data — ${info.legal_name}</span>`;
    toast('✓ GHL contact updated');
  } catch(e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-cloud-upload"></i> Update GHL Contact'; }
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}



// ═════════════════════════════════════════════════════════════════════════════
// VEHICLE MANAGER — CS Board
// ═════════════════════════════════════════════════════════════════════════════

let vmSelectedContact = null;

function vmSearchContact(query) {
  const resultsEl = document.getElementById('vm-contact-results');
  if (!resultsEl) return;
  const q = (query || '').toLowerCase().trim();
  const clients = state.clients || [];
  const matches = q.length < 1
    ? clients.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).slice(0, 40)
    : clients.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.dot_number||'').includes(q) ||
        (c.business_name||'').toLowerCase().includes(q)
      ).slice(0, 20);

  if (!matches.length) { resultsEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px">No contacts found</div>'; return; }
  resultsEl.style.cssText = 'max-height:180px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-bottom:8px';
  resultsEl.innerHTML = matches.map(c => {
    const safeName = (c.name||'').replace(/'/g,"\\'");
    return `<div onclick="vmSelectContact('${c.id}','${safeName}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:var(--text);display:flex;align-items:center;justify-content:space-between"
      onmouseover="this.style.background='rgba(0,196,106,.08)'" onmouseout="this.style.background=''">
      <span>${c.name}</span>
      ${c.dot_number ? `<span style="color:var(--text3);font-size:11px">DOT# ${c.dot_number}</span>` : ''}
    </div>`;
  }).join('');
}

function vmSelectContact(id, name) {
  vmSelectedContact = { id, name };
  const searchEl = document.getElementById('vm-contact-search');
  const resultsEl = document.getElementById('vm-contact-results');
  const selEl = document.getElementById('vm-selected-contact');
  const nameEl = document.getElementById('vm-selected-name');
  if (searchEl) searchEl.value = '';
  if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.cssText = ''; }
  if (selEl) selEl.style.display = 'flex';
  if (nameEl) nameEl.textContent = '✓ ' + name;
  vmLoadVehicles(id);
}

function vmClearContact() {
  vmSelectedContact = null;
  const selEl = document.getElementById('vm-selected-contact');
  const areaEl = document.getElementById('vm-vehicles-area');
  if (selEl) selEl.style.display = 'none';
  if (areaEl) areaEl.innerHTML = '';
}

async function vmLoadVehicles(contactId) {
  const area = document.getElementById('vm-vehicles-area');
  if (!area) return;
  area.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)"><i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Loading vehicles...</div>';

  try {
    const res  = await fetch(`/api/contacts/${contactId}/vehicles`);
    const data = await res.json();
    vmRenderVehicles(data.vehicles || [], contactId);
  } catch(e) {
    area.innerHTML = `<div style="color:var(--red);font-size:12px">Error: ${e.message}</div>`;
  }
}

function vmRenderVehicles(vehicles, contactId) {
  const area = document.getElementById('vm-vehicles-area');
  if (!area) return;

  const addBtn = `<button onclick="vmOpenVehicleForm(null,'${contactId}')"
    style="width:100%;background:rgba(0,196,106,.12);color:var(--primary);border:1px dashed rgba(0,196,106,.4);
           border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;margin-top:10px;
           display:flex;align-items:center;justify-content:center;gap:6px">
    <i class="ti ti-plus"></i> Add New Vehicle
  </button>`;

  if (!vehicles.length) {
    area.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">
      No vehicles found for this contact.</div>${addBtn}`;
    return;
  }

  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
      ${vehicles.map(v => `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:11px;font-weight:800;color:var(--primary)">
              ${v.unit ? 'UNIT ' + v.unit : 'VEHICLE'}
              ${v.status ? `<span style="font-size:10px;font-weight:600;color:${v.status.toLowerCase()==='active'?'var(--green)':'var(--text3)'};margin-left:8px">${v.status}</span>` : ''}
            </div>
            <button onclick="vmOpenVehicleForm(${JSON.stringify(v).replace(/"/g,'&quot;')},'${contactId}')"
              style="background:rgba(124,58,237,.12);color:#a78bfa;border:1px solid rgba(124,58,237,.3);
                     border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer">
              ✏ Edit
            </button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px">
            ${[['Year',v.year],['Make',v.make],['Model',v.model],['VIN',v.vin],['Plate',v.plate],['State',v.state]]
              .filter(([,val]) => val)
              .map(([label,val]) => `
                <div style="background:var(--bg2);border-radius:6px;padding:6px 8px">
                  <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${label}</div>
                  <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:1px">${val}</div>
                </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>${addBtn}`;
}

function vmOpenVehicleForm(vehicle, contactId) {
  document.getElementById('vm-form-modal')?.remove();
  const isEdit = vehicle && vehicle.id;
  const v = vehicle || {};

  const modal = document.createElement('div');
  modal.id = 'vm-form-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.6)">
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg2);z-index:1">
        <div style="font-size:14px;font-weight:800;color:var(--text)">
          <i class="ti ti-truck" style="color:var(--primary);margin-right:6px"></i>
          ${isEdit ? 'Edit Vehicle' : 'Add New Vehicle'}
        </div>
        <button onclick="document.getElementById('vm-form-modal').remove()"
          style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);cursor:pointer;border-radius:8px;width:30px;height:30px;font-size:18px;display:flex;align-items:center;justify-content:center">×</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
        ${[
          ['vm-f-unit',   'Unit Number',   'text',   v.unit   || '', '0808, 116, 9791...'],
          ['vm-f-vin',    'VIN Number',    'text',   v.vin    || '', '3AKJHHDR...'],
          ['vm-f-year',   'Year',          'text',   v.year   || '', '2021'],
          ['vm-f-make',   'Make',          'text',   v.make   || '', 'FRHT, Kenworth...'],
          ['vm-f-model',  'Model',         'text',   v.model  || '', 'Cascadia...'],
          ['vm-f-plate',  'Plate Number',  'text',   v.plate  || '', 'PZB9211'],
          ['vm-f-state',  'State',         'text',   v.state  || '', 'MN'],
        ].map(([id, label, type, val, ph]) => `
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.07em;margin-bottom:5px">${label.toUpperCase()}</div>
            <input id="${id}" type="${type}" value="${val}" placeholder="${ph}"
              style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px;box-sizing:border-box">
          </div>`).join('')}
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.07em;margin-bottom:5px">STATUS</div>
          <select id="vm-f-status" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px">
            <option value="Active" ${(!v.status || v.status==='Active')?'selected':''}>Active</option>
            <option value="Inactive" ${v.status==='Inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.07em;margin-bottom:5px">VEHICLE TYPE</div>
          <select id="vm-f-type" style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px">
            <option value="Tractor" ${(!v.type || v.type==='Tractor')?'selected':''}>Tractor</option>
            <option value="Trailer" ${v.type==='Trailer'?'selected':''}>Trailer</option>
            <option value="Straight Truck" ${v.type==='Straight Truck'?'selected':''}>Straight Truck</option>
          </select>
        </div>
        <div id="vm-form-status" style="font-size:12px;text-align:center;min-height:16px"></div>
        <button onclick="vmSaveVehicle('${isEdit ? v.id : ''}','${contactId}')"
          style="width:100%;background:var(--primary);color:#0a1a0f;border:none;border-radius:10px;
                 padding:12px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">
          <i class="ti ti-device-floppy"></i> ${isEdit ? 'Save Changes' : 'Add Vehicle to GHL'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function vmSaveVehicle(recordId, contactId) {
  const statusEl = document.getElementById('vm-form-status');
  const get = id => document.getElementById(id)?.value.trim() || '';

  const payload = {
    unit:   get('vm-f-unit'),
    vin:    get('vm-f-vin'),
    year:   get('vm-f-year'),
    make:   get('vm-f-make'),
    model:  get('vm-f-model'),
    plate:  get('vm-f-plate'),
    state:  get('vm-f-state'),
    status: get('vm-f-status'),
    type:   get('vm-f-type'),
  };

  if (!payload.vin && !payload.plate) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">Enter at least a VIN or Plate number</span>';
    return;
  }

  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text3)">Saving to GHL...</span>';

  try {
    const url    = recordId ? `/api/vehicles/${recordId}` : `/api/contacts/${contactId}/vehicles`;
    const method = recordId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method, headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✓ Vehicle saved successfully!</span>';
    toast(`✓ Vehicle ${recordId ? 'updated' : 'added'} in GHL`);
    setTimeout(() => {
      document.getElementById('vm-form-modal')?.remove();
      vmLoadVehicles(contactId);
    }, 700);
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}



// ═════════════════════════════════════════════════════════════════════════════
// DRIVER MANAGER (CS Board tool — mirrors Vehicle Manager)
// ═════════════════════════════════════════════════════════════════════════════

let dmSelectedContact = null;

function dmSearchContact(query) {
  const resultsEl = document.getElementById('dm-contact-results');
  if (!resultsEl) return;
  const q = (query || '').toLowerCase().trim();
  const clients = state.clients || [];
  const matches = q.length < 1
    ? clients.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).slice(0, 40)
    : clients.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.dot_number||'').includes(q) ||
        (c.business_name||'').toLowerCase().includes(q)
      ).slice(0, 20);

  if (!matches.length) { resultsEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:6px">No contacts found</div>'; return; }
  resultsEl.style.cssText = 'max-height:180px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border);border-radius:8px;margin-bottom:8px';
  resultsEl.innerHTML = matches.map(c => {
    const safeName = (c.name||'').replace(/'/g,"\\'");
    return `<div onclick="dmSelectContact('${c.id}','${safeName}')"
      style="padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:var(--text);display:flex;align-items:center;justify-content:space-between"
      onmouseover="this.style.background='rgba(96,165,250,.08)'" onmouseout="this.style.background=''">
      <span>${c.name}</span>
      ${c.dot_number ? `<span style="color:var(--text3);font-size:11px">DOT# ${c.dot_number}</span>` : ''}
    </div>`;
  }).join('');
}

function dmSelectContact(id, name) {
  dmSelectedContact = { id, name };
  const searchEl  = document.getElementById('dm-contact-search');
  const resultsEl = document.getElementById('dm-contact-results');
  const selEl     = document.getElementById('dm-selected-contact');
  const nameEl    = document.getElementById('dm-selected-name');
  if (searchEl)  searchEl.value = '';
  if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.cssText = ''; }
  if (selEl)     selEl.style.display = 'flex';
  if (nameEl)    nameEl.textContent = '✓ ' + name;
  dmLoadDrivers(id);
}

function dmClearContact() {
  dmSelectedContact = null;
  const selEl  = document.getElementById('dm-selected-contact');
  const areaEl = document.getElementById('dm-drivers-area');
  if (selEl)  selEl.style.display = 'none';
  if (areaEl) areaEl.innerHTML = '';
}

async function dmLoadDrivers(contactId) {
  const area = document.getElementById('dm-drivers-area');
  if (!area) return;
  area.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)"><i class="ti ti-loader" style="animation:spin .8s linear infinite"></i> Loading drivers...</div>';
  try {
    const res  = await fetch(`/api/contacts/${contactId}/drivers`);
    const data = await res.json();
    dmRenderDrivers(data.drivers || [], contactId);
  } catch(e) {
    area.innerHTML = `<div style="color:var(--red);font-size:12px">Error: ${e.message}</div>`;
  }
}

function dmRenderDrivers(drivers, contactId) {
  const area = document.getElementById('dm-drivers-area');
  if (!area) return;

  const addBtn = `<button onclick="dmOpenDriverForm(null,'${contactId}')"
    style="width:100%;background:rgba(96,165,250,.12);color:#60a5fa;border:1px dashed rgba(96,165,250,.4);
           border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;margin-top:10px;
           display:flex;align-items:center;justify-content:center;gap:6px">
    <i class="ti ti-plus"></i> Add New Driver
  </button>`;

  if (!drivers.length) {
    area.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text3);font-size:12px">
      No drivers found for this contact.</div>${addBtn}`;
    return;
  }

  area.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
      ${drivers.map(d => `
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:11px;font-weight:800;color:#60a5fa">
              ${d.fullName || 'Unnamed Driver'}
              ${d.license ? `<span style="font-size:10px;font-weight:600;color:var(--text3);margin-left:8px">CDL: ${d.license}</span>` : ''}
            </div>
            <button onclick="dmOpenDriverForm(${JSON.stringify(d).replace(/"/g,'&quot;')},'${contactId}')"
              style="background:rgba(124,58,237,.12);color:#a78bfa;border:1px solid rgba(124,58,237,.3);
                     border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer">
              ✏ Edit
            </button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px">
            ${[['License #', d.license],['Full Name', d.fullName],['Date of Birth', d.dob],['CDL Expires', d.cdlExp]]
              .filter(([,val]) => val)
              .map(([label,val]) => `
                <div style="background:var(--bg2);border-radius:6px;padding:6px 8px">
                  <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">${label}</div>
                  <div style="font-size:12px;font-weight:700;color:var(--text);margin-top:1px">${val}</div>
                </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>${addBtn}`;
}

function dmOpenDriverForm(driver, contactId) {
  document.getElementById('dm-form-modal')?.remove();
  const isEdit = driver && driver.id;
  const d = driver || {};

  const modal = document.createElement('div');
  modal.id = 'dm-form-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;width:480px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.6)">
      <div style="padding:18px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg2);z-index:1">
        <div style="font-size:14px;font-weight:800;color:var(--text)">
          <i class="ti ti-id-badge" style="color:#60a5fa;margin-right:6px"></i>
          ${isEdit ? 'Edit Driver' : 'Add New Driver'}
        </div>
        <button onclick="document.getElementById('dm-form-modal').remove()"
          style="background:var(--bg3);border:1px solid var(--border);color:var(--text3);cursor:pointer;border-radius:8px;width:30px;height:30px;font-size:18px;display:flex;align-items:center;justify-content:center">×</button>
      </div>
      <div style="padding:20px 24px;display:flex;flex-direction:column;gap:12px">
        ${[
          ['dm-f-name',    'Full Name',          'text', d.fullName || '', 'John Smith'],
          ['dm-f-license', 'Driver License / CDL #', 'text', d.license  || '', 'F366070520715'],
          ['dm-f-dob',     'Date of Birth',      'text', d.dob      || '', 'YYYY-MM-DD'],
          ['dm-f-cdlexp',  'CDL Expiration Date','text', d.cdlExp   || '', 'YYYY-MM-DD'],
        ].map(([id, label, type, val, ph]) => `
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.07em;margin-bottom:5px">${label.toUpperCase()}</div>
            <input id="${id}" type="${type}" value="${val}" placeholder="${ph}"
              style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:13px;box-sizing:border-box">
          </div>`).join('')}
        <div id="dm-form-status" style="font-size:12px;text-align:center;min-height:16px"></div>
        <button onclick="dmSaveDriver('${isEdit ? d.id : ''}','${contactId}')"
          style="width:100%;background:#60a5fa;color:#0a1a2f;border:none;border-radius:10px;
                 padding:12px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">
          <i class="ti ti-device-floppy"></i> ${isEdit ? 'Save Changes' : 'Add Driver to GHL'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function dmSaveDriver(recordId, contactId) {
  const statusEl = document.getElementById('dm-form-status');
  const get = id => document.getElementById(id)?.value.trim() || '';

  const payload = {
    fullName: get('dm-f-name'),
    license:  get('dm-f-license'),
    dob:      get('dm-f-dob'),
    cdlExp:   get('dm-f-cdlexp'),
  };

  if (!payload.license && !payload.fullName) {
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">Enter at least a name or license number</span>';
    return;
  }

  if (statusEl) statusEl.innerHTML = '<span style="color:var(--text3)">Saving to GHL...</span>';

  try {
    const url    = recordId ? `/api/drivers/${recordId}` : `/api/contacts/${contactId}/drivers`;
    const method = recordId ? 'PUT' : 'POST';
    const res    = await fetch(url, {
      method, headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">✓ Driver saved successfully!</span>';
    toast(`✓ Driver ${recordId ? 'updated' : 'added'} in GHL`);
    setTimeout(() => {
      document.getElementById('dm-form-modal')?.remove();
      dmLoadDrivers(contactId);
    }, 700);
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SWIMLANE VIEW
// ═════════════════════════════════════════════════════════════════════════════

let tbViewMode = 'list'; // 'list' | 'swimlane'

// GHL stage order for swimlane columns (matches your pipeline stages)
const SWIMLANE_STAGES = [
  { key: 'Open',                        color: '#60a5fa', icon: 'ti-circle' },
  { key: 'Lost (they already did it)',  color: '#94a3b8', icon: 'ti-x' },
  { key: 'In Progress',                 color: '#f59e0b', icon: 'ti-loader' },
  { key: 'Waiting for Customer Approval', color: '#f97316', icon: 'ti-clock-pause' },
  { key: 'Ready to be file',            color: '#a78bfa', icon: 'ti-file-check' },
  { key: 'Filing Completed',            color: '#34d399', icon: 'ti-circle-check' },
];

// Label color map — matches GHL colored tags
const LABEL_COLORS = {
  'retry the payment now':   { bg:'rgba(239,68,68,.2)',   border:'rgba(239,68,68,.5)',   text:'#ef4444' },
  'data entry completed':    { bg:'rgba(52,211,153,.15)', border:'rgba(52,211,153,.4)',  text:'#34d399' },
  'missing mileage report':  { bg:'rgba(245,158,11,.2)',  border:'rgba(245,158,11,.5)',  text:'#f59e0b' },
  'data entry':              { bg:'rgba(96,165,250,.15)', border:'rgba(96,165,250,.4)',  text:'#60a5fa' },
  'missing information':     { bg:'rgba(239,68,68,.15)',  border:'rgba(239,68,68,.4)',   text:'#ef4444' },
  'waiting on customer':     { bg:'rgba(249,115,22,.15)', border:'rgba(249,115,22,.4)',  text:'#f97316' },
  'filed':                   { bg:'rgba(52,211,153,.12)', border:'rgba(52,211,153,.3)',  text:'#34d399' },
  'rejected':                { bg:'rgba(239,68,68,.2)',   border:'rgba(239,68,68,.5)',   text:'#ef4444' },
};

function getLabelStyle(tag) {
  const t = tag.toLowerCase().trim();
  for (const [key, style] of Object.entries(LABEL_COLORS)) {
    if (t.includes(key)) return style;
  }
  return { bg:'rgba(148,163,184,.1)', border:'rgba(148,163,184,.3)', text:'#94a3b8' };
}

function tbSetView(mode) {
  tbViewMode = mode;
  const listBtn = document.getElementById('tb-view-list-btn');
  const swimBtn = document.getElementById('tb-view-swim-btn');
  const listGrid = document.getElementById('tb-staff-grid');
  const swimGrid = document.getElementById('tb-swimlane-grid');

  if (mode === 'swimlane') {
    if (listBtn) { listBtn.style.background = 'var(--bg3)'; listBtn.style.color = 'var(--text3)'; }
    if (swimBtn) { swimBtn.style.background = 'var(--primary)'; swimBtn.style.color = '#000'; }
    if (listGrid) listGrid.style.display = 'none';
    if (swimGrid) swimGrid.style.display = 'block';
    tbRenderSwimlane();
  } else {
    if (listBtn) { listBtn.style.background = 'var(--primary)'; listBtn.style.color = '#000'; }
    if (swimBtn) { swimBtn.style.background = 'var(--bg3)'; swimBtn.style.color = 'var(--text3)'; }
    if (listGrid) listGrid.style.display = 'grid';
    if (swimGrid) swimGrid.style.display = 'none';
  }
}

function tbRenderSwimlane() {
  const container = document.getElementById('tb-swimlane-grid');
  if (!container) return;

  // Collect all opps for the selected supervisor's team
  const staffMap  = tbGetStaffMap();
  const supId     = tbState.selectedSup;
  const staffIds  = supId === '__unassigned__' ? [] : (staffMap[supId] || []);
  const memberIds = supId === '__unassigned__' ? [] : [supId, ...staffIds];

  let opps = supId === '__unassigned__'
    ? tbState.opps.filter(o => !o.assignedTo || o.assignedTo === '')
    : tbState.opps.filter(o => memberIds.includes(o.assignedTo));

  // Apply search/type filter
  if (tbState.filterType === 'tasks') { container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Swimlane shows opportunities only. Switch filter to All Items or Opportunities Only.</div>'; return; }
  if (tbState.searchQuery) opps = opps.filter(o => tbItemMatchesSearch(o, false));

  // Group by pipeline name first, then by stage
  const byPipeline = {};
  opps.forEach(o => {
    const pipe = (o.pipelineName || 'Other').replace(/^\d+\.\s*/,'').trim();
    if (!byPipeline[pipe]) byPipeline[pipe] = {};
    const stage = o.stageName || 'Open';
    if (!byPipeline[pipe][stage]) byPipeline[pipe][stage] = [];
    byPipeline[pipe][stage].push(o);
  });

  if (!Object.keys(byPipeline).length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">No opportunities found for this view.</div>';
    return;
  }

  // Pipeline selector
  const pipes = Object.keys(byPipeline).sort();
  let selectedPipe = container.dataset.pipeline || pipes[0];
  if (!byPipeline[selectedPipe]) selectedPipe = pipes[0];
  container.dataset.pipeline = selectedPipe;

  const pipeSelector = `<div style="display:flex;gap:10px;margin-bottom:14px;align-items:center">
    <span style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;white-space:nowrap">PIPELINE:</span>
    <select onchange="document.getElementById('tb-swimlane-grid').dataset.pipeline=this.value;tbRenderSwimlane()"
      style="background:var(--bg3);border:1px solid var(--primary);color:var(--text);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;flex:1;max-width:420px">
      ${pipes.map(p => `<option value="${p}" ${p===selectedPipe?'selected':''}>${p} (${Object.values(byPipeline[p]).flat().length})</option>`).join('')}
    </select>
  </div>`;

  // Build columns — dynamically use actual stage names from data, mapped to our display order
  const stageData = byPipeline[selectedPipe] || {};
  const actualStages = Object.keys(stageData);

  // Log actual stage names to console for debugging
  if (actualStages.length) console.log('Actual GHL stages in this pipeline:', actualStages);

  // Map each SWIMLANE_STAGES entry to actual GHL stage names (fuzzy match)
  const columns = SWIMLANE_STAGES.map(s => {
    // Exact match first
    let matchedKey = actualStages.find(k => k === s.key);
    // Fuzzy: actual stage contains our key words OR our key contains actual stage words
    if (!matchedKey) matchedKey = actualStages.find(k =>
      k.toLowerCase().includes(s.key.toLowerCase().split(' ')[0]) ||
      s.key.toLowerCase().includes(k.toLowerCase().split(' ')[0])
    );
    const cards = matchedKey ? stageData[matchedKey] : [];
    return { ...s, cards, actualKey: matchedKey || s.key };
  });

  // Append any stages from GHL not covered by our SWIMLANE_STAGES list
  const coveredStages = new Set(columns.map(c => c.actualKey));
  actualStages.filter(s => !coveredStages.has(s)).forEach(s => {
    columns.push({ key: s, actualKey: s, color: '#94a3b8', icon: 'ti-circle-dashed', cards: stageData[s] || [] });
  });

  const columnsHtml = `<div style="display:flex;gap:12px;min-width:max-content;align-items:flex-start">
    ${columns.map(col => `
      <div style="width:240px;flex-shrink:0" ondragover="event.preventDefault()" ondrop="tbSwimlaneDropStage(event,'${col.actualKey.replace(/'/g,"\\'")}')">
        <!-- Column header -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-top:3px solid ${col.color};border-radius:10px 10px 0 0;padding:10px 12px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:6px">
            <i class="ti ${col.icon}" style="color:${col.color};font-size:13px"></i>
            <span style="font-size:11px;font-weight:800;color:var(--text)">${col.key}</span>
          </div>
          <span style="font-size:11px;font-weight:700;color:${col.color};background:${col.color}22;border-radius:10px;padding:1px 8px">${col.cards.length}</span>
        </div>
        <!-- Cards -->
        <div id="sl-col-${col.actualKey.replace(/\s+/g,'-')}" style="background:rgba(255,255,255,.02);border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;min-height:120px;padding:8px;display:flex;flex-direction:column;gap:6px">
          ${col.cards.length ? col.cards.map(opp => tbSwimlaneCard(opp, col.color)).join('') :
            `<div style="text-align:center;padding:20px 10px;color:var(--text3);font-size:11px;opacity:.5">Drop cards here</div>`}
        </div>
      </div>`).join('')}
  </div>`;

  container.innerHTML = pipeSelector + columnsHtml;
}

function tbSwimlaneCard(opp, stageColor) {
  const name    = (opp.contactName || opp.name || 'Unknown').split(' ').slice(0,4).join(' ');
  const company = opp.companyName || '';
  const dot     = opp.dotNumber ? `DOT# ${opp.dotNumber}` : '';
  const tags    = [...new Set([...(opp.tags || []), ...(opp.oppTags || [])])];
  const assignee = tbState.users.find(u => u.id === opp.assignedTo);
  const initials = assignee ? assignee.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : '?';
  const isOverdue = opp._status === 'overdue' || (opp.dueDate && new Date(opp.dueDate) < new Date());
  // Debug: log first card tags
  if (tags.length) console.log(`Card tags for ${name}:`, tags);

  const labelBadges = tags.length ? `
    <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:6px">
      ${tags.slice(0,4).map(t => {
        const s = getLabelStyle(t);
        return `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:${s.bg};border:1px solid ${s.border};color:${s.text}">${t}</span>`;
      }).join('')}
    </div>` : '';

  const tierTag = (() => {
    const ct = (opp.customerTags || []).map(t=>String(t).toLowerCase());
    if (ct.some(t=>t.includes('advance'))) return '<span style="font-size:8px;background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.3);border-radius:3px;padding:1px 5px;font-weight:700">ADV</span>';
    if (ct.some(t=>t.includes('recurring'))) return '<span style="font-size:8px;background:rgba(96,165,250,.15);color:#60a5fa;border:1px solid rgba(96,165,250,.3);border-radius:3px;padding:1px 5px;font-weight:700">REC</span>';
    return '';
  })();

  return `<div draggable="true"
    ondragstart="tbSwimlaneDragStart(event,'${opp.id}')"
    onclick="tbShowItemDetail({contactId:'${opp.contactId||''}',contactName:'${name.replace(/'/g,"\\'")}',companyName:'${company.replace(/'/g,"\\'")}',tags:[],dotNumber:'${opp.dotNumber||''}',phone:'${opp.contactPhone||''}',email:'${opp.contactEmail||''}',title:'${(opp.pipelineName||'').replace(/'/g,"\\'")}',sub2:'Stage: ${(opp.stageName||'').replace(/'/g,"\\'")}',type:'opp',status:'${opp._status||'open'}'})"
    style="background:var(--bg2);border:1px solid ${isOverdue?'rgba(239,68,68,.4)':'var(--border)'};border-left:3px solid ${stageColor};border-radius:8px;padding:10px;cursor:grab;transition:box-shadow .15s;position:relative"
    onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.4)'" onmouseout="this.style.boxShadow=''">

    <!-- TOP: Company + tier + assignee -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:5px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:800;color:var(--text);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${company ? company.replace(/\s+DOT#.*$/,'') : name}
        </div>
        ${dot ? `<div style="font-size:9px;color:var(--text3);margin-top:1px">${dot}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        ${tierTag}
        <div style="width:22px;height:22px;border-radius:50%;background:var(--primary);color:#000;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center" title="${assignee?.name||'Unassigned'}">${initials}</div>
      </div>
    </div>

    <!-- LABELS -->
    ${labelBadges}

    <!-- BOTTOM: Contact name + overdue + label button -->
    <div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;gap:6px">
      <div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        ${company ? `<i class="ti ti-user" style="font-size:9px;margin-right:3px"></i>${name}` : ''}
        ${isOverdue ? '<span style="color:#ef4444;font-weight:700;margin-left:4px">⚠ Overdue</span>' : ''}
      </div>
      <button onclick="event.stopPropagation();tbSwimlaneAddLabel('${opp.id}','${opp.contactId||''}')"
        style="background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.2);color:var(--text3);border-radius:4px;padding:1px 7px;font-size:9px;cursor:pointer;font-weight:700;white-space:nowrap;flex-shrink:0">
        + Label
      </button>
    </div>
  </div>`;
}

// Drag and drop between stages
let tbDragOppId = null;
function tbSwimlaneDragStart(event, oppId) {
  tbDragOppId = oppId;
  event.dataTransfer.effectAllowed = 'move';
}

async function tbSwimlaneDropStage(event, stageName) {
  event.preventDefault();
  if (!tbDragOppId) return;
  const opp = tbState.opps.find(o => o.id === tbDragOppId);
  if (!opp) return;
  tbDragOppId = null;

  // Update stage via GHL
  try {
    await fetch(`/api/opps/${opp.id}/stage`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ stageName, pipelineId: opp.pipelineId }),
    });
    // Update local state
    opp.stageName = stageName;
    if (stageName === 'Filing Completed') opp.status = 'won';
    tbRenderSwimlane();
    toast(`✓ Moved to "${stageName}"`);
  } catch(e) {
    toast(`Error: ${e.message}`);
  }
}

// Add label to opp
async function tbSwimlaneAddLabel(oppId, contactId) {
  // Fetch available GHL labels for this location
  document.getElementById('tb-label-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'tb-label-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9900;display:flex;align-items:center;justify-content:center';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };

  const labels = Object.keys(LABEL_COLORS).map(k => k.replace(/\b\w/g, c=>c.toUpperCase()));
  modal.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;width:340px;max-width:95vw">
    <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:14px">Add Label to Opportunity</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${labels.map(label => {
        const s = getLabelStyle(label);
        return `<button onclick="tbApplySwimlaneLabel('${oppId}','${label}');document.getElementById('tb-label-modal').remove()"
          style="text-align:left;padding:8px 12px;border-radius:8px;border:1px solid ${s.border};background:${s.bg};color:${s.text};font-size:12px;font-weight:700;cursor:pointer">
          ${label}
        </button>`;
      }).join('')}
    </div>
    <button onclick="document.getElementById('tb-label-modal').remove()" style="margin-top:12px;width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text3);border-radius:8px;padding:8px;cursor:pointer;font-size:12px">Cancel</button>
  </div>`;
  document.body.appendChild(modal);
}

async function tbApplySwimlaneLabel(oppId, label) {
  try {
    const res = await fetch(`/api/opps/${oppId}/tags`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ tag: label }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add label');
    // Update local opp tags
    const opp = tbState.opps.find(o => o.id === oppId);
    if (opp) { opp.tags = data.tags || [...(opp.tags||[]), label]; }
    tbRenderSwimlane();
    toast(`✓ Label "${label}" added in GHL`);
  } catch(e) {
    toast(`❌ Label error: ${e.message}`);
    console.error('Label add failed:', e);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// UNASSIGNED TASKS & OPPORTUNITIES VIEW
// ═════════════════════════════════════════════════════════════════════════════

function tbRenderUnassigned() {
  const grid  = document.getElementById('tb-staff-grid');
  const label = document.getElementById('tb-team-label');
  if (!grid) return;

  // Filter to unassigned items (no assigneeId / assignedTo)
  const isUnassigned = t => !t.assigneeId && !t.assignedTo && !t.assignedUserId && !t.userId && !t.owner;

  // Only show ATS Advance + Recurring contacts
  const isATS = item => {
    const tags = (item.customerTags || []).map(t => String(t).toLowerCase());
    return tags.some(t => t.includes('advance') || t.includes('recurring'));
  };

  let unassignedTasks = tbState.tasks.filter(t => isUnassigned(t) && isATS(t));
  let unassignedOpps  = tbState.opps.filter(o =>
    (!o.assignedTo || o.assignedTo === '') && isATS(o) &&
    !(o.stageName || '').toLowerCase().includes('complet')
  );

  // Apply type filter
  let items = [];
  if (tbState.filterType !== 'opps')  unassignedTasks.forEach(t => {
    if (tbItemMatchesSearch(t, true)) items.push({...t, _type:'task', _status:tbGetItemStatus(t,true), _staffName:'Unassigned'});
  });
  if (tbState.filterType !== 'tasks') unassignedOpps.forEach(o => {
    if (tbItemMatchesSearch(o, false)) items.push({...o, _type:'opp', _status:tbGetItemStatus(o,false), _staffName:'Unassigned'});
  });

  // Apply status filter
  if (tbState.filterStatus !== 'all') items = items.filter(i => i._status === tbState.filterStatus);

  // Sort newest first
  items.sort((a,b) => {
    const statusOrder = {overdue:0,open:1,completed:2,lost:3};
    const sd = (statusOrder[a._status]||1) - (statusOrder[b._status]||1);
    if (sd !== 0) return sd;
    return new Date(b.dueDate||b.dateAdded||0) - new Date(a.dueDate||a.dateAdded||0);
  });

  // Stats
  const overdueCount = items.filter(i => i._status === 'overdue').length;
  const openCount    = items.filter(i => i._status === 'open').length;
  const doneCount    = items.filter(i => i._status === 'completed').length;

  if (label) label.textContent = `UNASSIGNED — ATS ADVANCE & RECURRING CONTACTS`;

  // Update stats display
  const statsEl = document.getElementById('tb-stats');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-box"><i class="ti ti-list-check"></i><div><div class="stat-num">${items.length}</div><div class="stat-lbl">Total Unassigned</div></div></div>
    <div class="stat-box urgent"><i class="ti ti-alert-triangle"></i><div><div class="stat-num">${overdueCount}</div><div class="stat-lbl">Overdue</div></div></div>
    <div class="stat-box open"><i class="ti ti-clock"></i><div><div class="stat-num">${openCount}</div><div class="stat-lbl">Open</div></div></div>
    <div class="stat-box done"><i class="ti ti-circle-check"></i><div><div class="stat-num">${doneCount}</div><div class="stat-lbl">Completed</div></div></div>`;

  if (!items.length) {
    grid.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text3);grid-column:1/-1">
      <i class="ti ti-circle-check" style="font-size:40px;color:var(--green);opacity:.4;display:block;margin-bottom:12px"></i>
      <div style="font-size:15px;font-weight:700;color:var(--text)">No unassigned items!</div>
      <div style="font-size:12px;margin-top:6px">All tasks and opportunities for ATS Advance & Recurring contacts have been assigned.</div>
    </div>`;
    return;
  }

  // Group by contact
  const byContact = {};
  items.forEach(item => {
    const name = item.contactName || item.companyName || item.contactPhone || 'Unknown';
    if (!byContact[name]) byContact[name] = { name, dotNumber: item.dotNumber || '', items: [] };
    byContact[name].items.push(item);
  });

  grid.innerHTML = `
    <div style="grid-column:1/-1">
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <i class="ti ti-alert-triangle" style="color:#f59e0b;font-size:16px;flex-shrink:0"></i>
        <div style="font-size:12px;color:var(--text2)">
          <strong>${items.length} unassigned item${items.length!==1?'s':''}</strong> for ATS Advance & Recurring contacts.
          Click <strong>↑ Assign</strong> on any item to assign it to a staff member.
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        ${Object.values(byContact).map(contact => `
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden">
            <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--bg3)">
              <div style="width:30px;height:30px;border-radius:8px;background:rgba(0,196,106,.12);color:var(--green);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                ${(contact.name||'?').slice(0,2).toUpperCase()}
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text)">${contact.name}</div>
                ${contact.dotNumber ? `<div style="font-size:11px;color:var(--text3)">DOT# ${contact.dotNumber}</div>` : ''}
              </div>
              <div style="margin-left:auto;font-size:11px;color:var(--text3)">${contact.items.length} item${contact.items.length!==1?'s':''}</div>
            </div>
            <div style="display:flex;flex-direction:column">
              ${contact.items.map(item => {
                const isTask = item._type === 'task';
                const isOvr  = item._status === 'overdue';
                const isDone = item._status === 'completed';
                const statusDot = isDone ? 'var(--green)' : isOvr ? '#ef4444' : '#f59e0b';
                const displayTitle = isTask
                  ? (item.title||'Untitled Task').replace(/^\[CS\]\s*/,'')
                  : (item.pipelineName || item.name || 'Opportunity').replace(/^\d+\.\s*/,'').replace(/^2026\s*/,'').trim();
                const subDetail = isTask
                  ? (item.body ? `<span style="color:var(--text3);font-style:italic">${item.body.slice(0,80)}${item.body.length>80?'…':''}</span>` : '')
                  : (item.stageName ? `<span style="background:rgba(99,102,241,.12);color:#818cf8;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700">Stage: ${item.stageName}</span>` : '');
                const due = item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : '';
                const isNewItem = item.id && !tbGetViewedTasks().has(item.id);
                return `<div style="padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:10px">
                  <div style="width:6px;height:6px;border-radius:50%;background:${statusDot};flex-shrink:0"></div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                      ${displayTitle}
                      ${isNewItem ? '<span style="font-size:9px;background:rgba(0,196,106,.2);color:var(--primary);border:1px solid rgba(0,196,106,.5);padding:1px 5px;border-radius:3px;font-weight:800">NEW</span>' : ''}
                    </div>
                    <div style="font-size:11px;color:var(--text3);margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <span style="background:rgba(124,58,237,.12);color:#a78bfa;border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700">${isTask?'TASK':'OPP'}</span>
                      ${subDetail}
                      ${due ? `<span style="color:${isOvr?'#ef4444':'var(--text3)'}">Due: ${due}</span>` : ''}
                    </div>
                  </div>
                  <button onclick="tbQuickAssign('${item.id||''}','${isTask}','${item.contactId||''}')"
                    style="background:rgba(0,196,106,.12);color:var(--green);border:1px solid rgba(0,196,106,.3);
                           border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">
                    ↑ Assign
                  </button>
                </div>`;
              }).join('')}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

// Quick assign modal for unassigned items
function tbQuickAssign(itemId, isTask, contactId) {
  document.getElementById('tb-quick-assign-modal')?.remove();
  const staffPool = tbState.users.length ? tbState.users : ATS_STAFF_FALLBACK;

  const modal = document.createElement('div');
  modal.id = 'tb-quick-assign-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9900;display:flex;align-items:center;justify-content:center';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:24px;width:380px;max-width:95vw">
      <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:16px">Assign to Staff</div>
      <div style="display:flex;flex-direction:column;gap:8px" id="qa-staff-list">
        ${staffPool.map(u => `
          <button onclick="tbDoQuickAssign('${itemId}','${isTask}','${contactId}','${u.id}','${u.name.replace(/'/g,"\\'")}',this.parentElement.parentElement.parentElement)"
            style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:9px;
                   padding:10px 14px;font-size:13px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px">
            <div style="width:28px;height:28px;border-radius:8px;background:rgba(0,196,106,.12);color:var(--green);font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              ${u.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
            </div>
            ${u.name}
          </button>`).join('')}
      </div>
      <button onclick="document.getElementById('tb-quick-assign-modal').remove()"
        style="margin-top:12px;width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text3);border-radius:9px;padding:9px;cursor:pointer;font-size:13px">
        Cancel
      </button>
    </div>`;
  document.body.appendChild(modal);
}

async function tbDoQuickAssign(itemId, isTask, contactId, userId, userName, modal) {
  const isTaskBool = isTask === 'true' || isTask === true;
  try {
    if (isTaskBool) {
      const res = await fetch(`/api/contacts/${contactId}/tasks/${itemId}/assign`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    } else {
      const res = await fetch(`/api/opportunities/${itemId}/assign`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    }
    // Remove from tbState
    if (isTaskBool) {
      const t = tbState.tasks.find(t => t.id === itemId);
      if (t) { t.assigneeId = userId; t.assignedTo = userId; }
    } else {
      const o = tbState.opps.find(o => o.id === itemId);
      if (o) o.assignedTo = userId;
    }
    modal?.remove();
    toast(`✓ Assigned to ${userName}`);
    tbRenderUnassigned(); // refresh the unassigned view
  } catch(e) {
    toast('Error assigning: ' + e.message);
  }
}

