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
    'dot-lookup': ['FMCSA DOT Lookup', 'Search any DOT number and push to GHL'],
    'tasks-board':['Tasks Board', 'Supervisor view — staff tasks & opportunities'],
  };
  const [title, sub] = T[page] || ['ATS',''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent   = sub;

  // Tasks board — init supervisor tabs and load data
  if (page === 'tasks-board') {
    tbInit();
    tbLoad();
  }
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
function renderComplianceTable() {
  const visibleServices = state.groupFilter === 'all'
    ? SERVICES
    : SERVICES.filter(s => s.group === state.groupFilter);

  const thead = document.querySelector('#compliance-table thead tr');
  thead.innerHTML = `
    <th class="sticky-col">Company</th>
    <th>Score</th>
    ${visibleServices.map(s => `<th title="${s.label}">${s.short}</th>`).join('')}
  `;

  document.getElementById('compliance-tbody').innerHTML = state.filtered.map(client => {
    const allCells = SERVICES.map(s => client.cells[s.key] || 'pending');
    const done     = allCells.filter(v => v === 'done').length;
    const sc       = scoreColor(done, SERVICES.length);
    const color    = clientColor(client.name);
    const ini      = client.initials;
    const tags     = (client.tags || []).slice(0, 2);
    return `<tr data-id="${client.id}">
      <td class="sticky-col">
        <div class="co-cell" onclick="openCompanyPanel('${client.id}')" style="cursor:pointer">
          <div class="co-avatar" style="background:${color}22;color:${color}">${ini}</div>
          <div>
            <div class="co-name">${client.name}</div>
            <div class="co-mc">
              ${tags.length ? tags.map(t => `<span class="row-tag">${t}</span>`).join('') : ''}
              ${(client.oppTags||[]).slice(0,2).map(t => `<span class="row-tag" style="background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.2)">${t}</span>`).join('')}
              ${!tags.length && !(client.oppTags||[]).length ? '—' : ''}
            </div>
          </div>
        </div>
      </td>
      <td><span class="score-pill" style="background:${sc.bg};color:${sc.col}">${done}/${SERVICES.length}</span></td>
      ${visibleServices.map(s => {
        const st  = client.cells[s.key] || 'pending';
        const opp = client.oppIndex?.[s.key];
        const tip = opp ? `${s.label} · ${opp.stage || st}` : `${s.label} · no GHL opp yet`;
        return `<td style="text-align:center">
          <span class="cell-badge ${badgeClass(st)}" title="${tip}"
            onclick="openCellModal('${client.id}','${encodeURIComponent(client.name)}','${s.key}','${s.label}','${st}','${opp?.id || ''}')">
            ${badgeIcon(st)}
          </span>
        </td>`;
      }).join('')}
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
    document.getElementById('dot-result').style.display = 'block';
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
  const matches = state.clients.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.dot_number || '').includes(q) ||
    (c.business_name || '').toLowerCase().includes(q)
  ).slice(0, 6);

  if (!matches.length) {
    document.getElementById('dot-ghl-matches').innerHTML = '';
    document.getElementById('dot-create-section').style.display = 'block';
    return;
  }
  document.getElementById('dot-create-section').style.display = 'none';

  document.getElementById('dot-ghl-matches').innerHTML = matches.map(c => `
    <div onclick="dotSelectContact('${c.id}','${c.name.replace(/'/g,"\\'")}','${c.dot_number||''}')"
      style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid ${dotSelectedGHL?.id === c.id ? 'var(--primary)' : 'var(--border)'};background:${dotSelectedGHL?.id === c.id ? 'rgba(0,196,106,.08)' : 'var(--bg3)'};margin-bottom:5px;transition:all .15s"
      id="dot-match-${c.id}">
      <div style="width:30px;height:30px;border-radius:8px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--primary);flex-shrink:0">${c.initials}</div>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${c.name}</div>
        ${c.dot_number ? `<div style="font-size:10px;color:var(--text3)">DOT# ${c.dot_number}</div>` : ''}
      </div>
      ${dotSelectedGHL?.id === c.id ? '<i class="ti ti-check" style="color:var(--primary)"></i>' : ''}
    </div>
  `).join('');
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
    if (!res.ok) throw new Error(data.error);

    document.getElementById('dot-create-section').style.display = 'none';
    document.getElementById('dot-push-status').innerHTML = `
      <div style="background:rgba(0,196,106,.1);border:1px solid rgba(0,196,106,.3);border-radius:8px;padding:10px 14px;margin-top:8px">
        <div style="font-size:13px;font-weight:700;color:var(--green)"><i class="ti ti-check"></i> Contact Created Successfully!</div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">
          <strong>${dotCurrentInfo.legal_name}</strong> added to GHL with ${data.opportunitiesCreated?.length || 0} service opportunities
        </div>
      </div>`;

    toast(`${dotCurrentInfo.legal_name} created in GHL ✓`);
    logActivity('blue', `New contact <strong>${dotCurrentInfo.legal_name}</strong> created from DOT# ${dotCurrentInfo.dot_number}`);

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
// TASKS BOARD — Supervisor / Staff view
// ═══════════════════════════════════════════════════════════════════════════

// Names EXACTLY as they appear in GHL owner/assignee fields
// GHL User IDs — hardcoded from /api/debug/users
const TB_SUPERVISORS = [
  { id: 'shucayb', name: 'Shucayb Jama', ghlId: 's57KFI2a9N3LmRprzdJW', color: '#7c3aed', initials: 'SJ' },
  { id: 'ahmed_y', name: 'Ahmed Yusuf',  ghlId: '48vCVBOEaRTpUJ23XC4K', color: '#0891b2', initials: 'AY' },
  { id: 'mahad',   name: 'Mahad Said',   ghlId: 'yri669q8Ymx22zdFDPLK', color: '#059669', initials: 'MS' },
  { id: 'ahmed_g', name: 'Ahmed Gure',   ghlId: 'FmjXHSLQ6XWMGgj0Y0w3', color: '#d97706', initials: 'AG' },
];

const TB_STAFF = [
  // Shucayb's team
  { id: 'shucayb', name: 'Shucayb Jama', ghlId: 's57KFI2a9N3LmRprzdJW', supervisor: 'shucayb', isSuper: true  },
  { id: 'ali',     name: 'Ali Ali',       ghlId: '40ynNiHEBfnZq6gsh7IS', supervisor: 'shucayb', isSuper: false },
  { id: 'kamal',   name: 'Kamal Ahmed',   ghlId: 'fnFKHlkLVfjYBzFxC5aG', supervisor: 'shucayb', isSuper: false },
  // Ahmed Yusuf's team
  { id: 'ahmed_y', name: 'Ahmed Yusuf',   ghlId: '48vCVBOEaRTpUJ23XC4K', supervisor: 'ahmed_y', isSuper: true  },
  { id: 'yahya',   name: 'Yahya Yusuf',   ghlId: 'mIbzEna47UOXtsV2zzxD', supervisor: 'ahmed_y', isSuper: false },
  { id: 'yusuf',   name: 'Yusuf Yusuf',   ghlId: 'DY4bAKCSR4dnw94zbj2a', supervisor: 'ahmed_y', isSuper: false },
  // Mahad's team
  { id: 'mahad',   name: 'Mahad Said',    ghlId: 'yri669q8Ymx22zdFDPLK', supervisor: 'mahad',   isSuper: true  },
  { id: 'mustaf',  name: 'Mustaf Hassan', ghlId: 'zohmJyCbnyzoBtLiKNir', supervisor: 'mahad',   isSuper: false },
  // Ahmed Gure's team
  { id: 'ahmed_g', name: 'Ahmed Gure',    ghlId: 'FmjXHSLQ6XWMGgj0Y0w3', supervisor: 'ahmed_g', isSuper: true  },
];

let tbState = {
  selectedSup: 'shucayb',
  tasks: [],
  opps: [],
  users: [],
  loaded: false,
  filterType: 'all',
  filterStatus: 'all',
};

function tbInit() {
  const container = document.getElementById('tb-supervisor-tabs');
  if (!container) return;
  const sup = TB_SUPERVISORS.find(s => s.id === tbState.selectedSup);

  container.innerHTML = `
    <select onchange="tbSelectSupervisor(this.value)"
      style="width:100%;background:var(--bg3);border:2px solid ${sup?.color || 'var(--border)'};
             color:var(--text);border-radius:10px;padding:10px 14px;font-size:14px;font-weight:600;
             cursor:pointer;appearance:none;-webkit-appearance:none;
             background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23aaa%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>');
             background-repeat:no-repeat;background-position:right 12px center;padding-right:36px">
      ${TB_SUPERVISORS.map(s => `
        <option value="${s.id}" ${s.id === tbState.selectedSup ? 'selected' : ''}>
          ${s.initials} — ${s.name} (${TB_STAFF.filter(st=>st.supervisor===s.id).length} staff)
        </option>
      `).join('')}
    </select>
  `;

  // Update info line
  const infoEl = document.getElementById('tb-sup-info');
  if (infoEl && sup) {
    const teamCount = TB_STAFF.filter(s => s.supervisor === sup.id).length;
    const staffCount = TB_STAFF.filter(s => s.supervisor === sup.id && !s.isSuper).length;
    infoEl.innerHTML = `<span style="color:${sup.color};font-weight:700">${sup.name}</span> · ${staffCount} direct report${staffCount!==1?'s':''} · ${teamCount} total`;
  }
}

async function tbLoad() {
  if (tbState.loaded) { tbRender(); return; }
  document.getElementById('tb-loading').style.display = 'block';
  document.getElementById('tb-staff-grid').innerHTML = '';
  try {
    const res = await fetch('/api/tasks-board');
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    tbState.tasks = data.tasks || [];
    tbState.opps  = data.opportunities || [];
    tbState.users = data.users || [];
    tbState.userMap = data.userMap || {}; // id → name
    tbState.loaded = true;
    console.log(`Loaded: ${tbState.tasks.length} tasks, ${tbState.opps.length} opps, ${tbState.users.length} users`);
    console.log('UserMap:', tbState.userMap);
    // Log unique owner IDs in opps
    const ownerIds = [...new Set(tbState.opps.map(o=>o.assignedTo).filter(Boolean))];
    console.log('Unique opp owner IDs in opps:', ownerIds);
  } catch(e) {
    document.getElementById('tb-loading').innerHTML = `<div style="color:var(--red)">Failed to load: ${e.message}</div>`;
    return;
  }
  document.getElementById('tb-loading').style.display = 'none';
  tbRender();
}

function tbSelectSupervisor(supId) {
  tbState.selectedSup = supId;
  tbInit(); // re-render tabs with new selection
  tbRender();
}

function tbApplyFilters() {
  tbState.filterType   = document.getElementById('tb-filter-type').value;
  tbState.filterStatus = document.getElementById('tb-filter-status').value;
  tbRender();
}

async function tbRefresh() {
  tbState.loaded = false;
  await tbLoad();
}

function tbIsOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function tbOppIsStale(opp) {
  // Open opportunity stale for more than 1 day = highlight red
  const created = opp.createdAt || opp.dateAdded || opp.updatedAt;
  if (!created) return false;
  const ageDays = (Date.now() - new Date(created).getTime()) / (1000*60*60*24);
  return ageDays > 1;
}

function tbGetItemStatus(item, isTask) {
  if (isTask) {
    if (item.completed || item.status === 'completed') return 'completed';
    if (tbIsOverdue(item.dueDate)) return 'overdue';
    return 'open';
  } else {
    const s = (item.status || '').toLowerCase();
    if (s === 'won' || s === 'completed') return 'completed';
    if (s === 'lost') return 'lost';
    // Open opp older than 1 day = overdue (needs attention)
    if (s === 'open' && tbOppIsStale(item)) return 'overdue';
    return 'open';
  }
}

function tbRender() {
  const sup = TB_SUPERVISORS.find(s => s.id === tbState.selectedSup);
  const team = TB_STAFF.filter(s => s.supervisor === tbState.selectedSup);
  const grid = document.getElementById('tb-staff-grid');
  const label = document.getElementById('tb-team-label');
  if (!grid || !sup) return;

  const teamLabel = team.length === 1 && team[0].isSuper
    ? `${sup.name.toUpperCase()} — SUPERVISOR`
    : `${sup.name.toUpperCase()}'S TEAM — ${team.length} STAFF`;
  label.textContent = teamLabel;

  let totalTasks = 0, overdueTasks = 0, openTasks = 0, doneTasks = 0;

  const cards = team.map(staff => {
    const supConfig = TB_SUPERVISORS.find(s => s.id === staff.id);
    const userId = staff.ghlId; // hardcoded GHL user ID — no API needed
    console.log(`${staff.name} → GHL ID: ${userId}`);

    // Match by hardcoded GHL user ID — direct and reliable
    const staffOpps = tbState.opps.filter(o => o.assignedTo === userId);
    const staffTasks = tbState.tasks.filter(t =>
      t.assigneeId === userId || t.assignedTo === userId
    );
    });

    // Apply filters
    let items = [];
    if (tbState.filterType !== 'opps') {
      staffTasks.forEach(t => items.push({ ...t, _type: 'task', _status: tbGetItemStatus(t, true) }));
    }
    if (tbState.filterType !== 'tasks') {
      staffOpps.forEach(o => items.push({ ...o, _type: 'opp', _status: tbGetItemStatus(o, false) }));
    }
    if (tbState.filterStatus !== 'all') {
      items = items.filter(i => i._status === tbState.filterStatus);
    }

    // Sort: overdue first, then open, then completed
    items.sort((a,b) => {
      const order = { overdue:0, open:1, completed:2, lost:3 };
      return (order[a._status]||1) - (order[b._status]||1);
    });

    const myOverdue   = items.filter(i => i._status === 'overdue').length;
    const myOpen      = items.filter(i => i._status === 'open').length;
    const myCompleted = items.filter(i => i._status === 'completed').length;
    totalTasks += items.length;
    overdueTasks += myOverdue;
    openTasks += myOpen;
    doneTasks += myCompleted;

    const cardColor = supConfig?.color || sup.color;
    const cardInitials = supConfig?.initials || staff.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const badgeLabel = staff.isSuper ? 'SUPERVISOR' : 'STAFF';

    return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;overflow:hidden">
        <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);background:var(--bg3)">
          <div style="width:42px;height:42px;border-radius:50%;background:${cardColor}33;border:2px solid ${cardColor};
                      display:flex;align-items:center;justify-content:center;
                      font-size:13px;font-weight:800;color:${cardColor};flex-shrink:0">
            ${cardInitials}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:13px;font-weight:700;color:var(--text)">${staff.name}</span>
              <span style="font-size:9px;background:${cardColor}22;color:${cardColor};padding:2px 6px;border-radius:4px;font-weight:700">${badgeLabel}</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
              ${myOverdue ? `<span style="font-size:10px;background:rgba(239,68,68,.15);color:#ef4444;padding:2px 7px;border-radius:20px;font-weight:700">${myOverdue} overdue</span>` : ''}
              ${myOpen ? `<span style="font-size:10px;background:rgba(59,130,246,.15);color:#60a5fa;padding:2px 7px;border-radius:20px;font-weight:700">${myOpen} open</span>` : ''}
              ${myCompleted ? `<span style="font-size:10px;background:rgba(16,185,129,.15);color:#34d399;padding:2px 7px;border-radius:20px;font-weight:700">${myCompleted} done</span>` : ''}
              ${!items.length ? `<span style="font-size:10px;color:var(--text3)">No items</span>` : ''}
            </div>
          </div>
          <div style="font-size:22px;font-weight:800;color:${items.length ? cardColor : 'var(--text3)'}">
            ${items.length}
          </div>
        </div>

        <div style="max-height:360px;overflow-y:auto">
          ${items.length === 0 ? `
            <div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">
              <i class="ti ti-circle-check" style="font-size:24px;display:block;margin-bottom:6px;color:var(--green)"></i>
              All clear
            </div>
          ` : items.slice(0,25).map(item => {
            const isTask = item._type === 'task';
            const statusColor = item._status === 'overdue' ? '#ef4444'
              : item._status === 'completed' ? '#34d399' : '#60a5fa';
            const statusIcon = item._status === 'overdue' ? 'ti-alert-triangle'
              : item._status === 'completed' ? 'ti-circle-check' : 'ti-clock';
            const title = item.title || item.name || (isTask ? 'Task' : 'Opportunity');
            const contact = item.contact?.name || item.contactName || '';
            const dueDate = item.dueDate
              ? new Date(item.dueDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})
              : '';
            // For opportunities, show age in days
            const created = item.createdAt || item.dateAdded;
            const ageDays = created ? Math.floor((Date.now() - new Date(created).getTime()) / (1000*60*60*24)) : null;
            const ageLabel = !isTask && ageDays !== null ? `${ageDays}d old` : '';
            const rowBg = item._status === 'overdue' ? 'rgba(239,68,68,0.05)' : 'transparent';
            return `
              <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:10px;background:${rowBg}">
                <i class="ti ${statusIcon}" style="color:${statusColor};font-size:14px;margin-top:2px;flex-shrink:0"></i>
                <div style="flex:1;min-width:0">
                  <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</div>
                  ${contact ? `<div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${contact}</div>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
                  <span style="font-size:9px;background:var(--bg3);color:var(--text3);padding:2px 6px;border-radius:4px;font-weight:700">${isTask?'TASK':'OPP'}</span>
                  ${dueDate ? `<span style="font-size:10px;color:${item._status==='overdue'?'#ef4444':'var(--text3)'}">${dueDate}</span>` : ''}
                  ${ageLabel ? `<span style="font-size:10px;color:${item._status==='overdue'?'#ef4444':'var(--text3)'}">${ageLabel}</span>` : ''}
                </div>
              </div>
            `;
          }).join('')}
          ${items.length > 25 ? `
            <div style="padding:8px 16px;text-align:center;font-size:11px;color:var(--text3)">
              +${items.length-25} more items
            </div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.innerHTML = cards;

  // Stats bar
  const stats = document.getElementById('tb-stats');
  stats.innerHTML = [
    { label: 'Total Items', value: totalTasks,   icon: 'ti-list',           color: 'var(--primary)' },
    { label: 'Overdue',     value: overdueTasks,  icon: 'ti-alert-triangle', color: '#ef4444'        },
    { label: 'Open',        value: openTasks,     icon: 'ti-clock',          color: '#60a5fa'        },
    { label: 'Completed',   value: doneTasks,     icon: 'ti-circle-check',   color: '#34d399'        },
  ].map(s => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px">
      <i class="ti ${s.icon}" style="font-size:22px;color:${s.color}"></i>
      <div>
        <div style="font-size:22px;font-weight:800;color:${s.color}">${s.value}</div>
        <div style="font-size:11px;color:var(--text3)">${s.label}</div>
      </div>
    </div>
  `).join('');
}

// end tasks board

