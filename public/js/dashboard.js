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
    'dot-lookup':  ['FMCSA DOT Lookup', 'Search any DOT number and push to GHL'],
    'tasks-board': ['Tasks Board', 'Supervisor view — staff tasks & opportunities'],
    'fmcsa-form':   ['FMCSA Support Form', 'Complete on the call — auto-creates GHL task'],
    'skills-setup': ['Skills Setup', 'Assign service skills to each staff member'],
    'cs-board':    ['CS Task Board', 'Customer service tasks — info gathering & GHL updates'],
  };
  const [title, sub] = T[page] || ['ATS',''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent   = sub;
  // CS Board: only load from cache, never auto-fetch (prevents tab crash)
  if (page === 'cs-board') { setTimeout(csLoadFromCache, 50); }

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
    // Show create section as soon as we have FMCSA data
    const createSec = document.getElementById('dot-create-section');
    if (createSec) createSec.style.display = 'block';
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

  if (!matches.length) {
    document.getElementById('dot-ghl-matches').innerHTML =
      '<div style="font-size:11px;color:var(--text3);padding:6px 0">No existing GHL contact found for this DOT.</div>';
    const sec = document.getElementById('dot-create-section');
    if (sec) sec.style.display = 'block';
    return;
  }
  // Matches found — still show create section below (user may want to add as new)
  const sec2 = document.getElementById('dot-create-section');
  if (sec2) sec2.style.display = 'block';

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
    if (res.status === 409) {
      // Already exists — show warning instead of error
      const sec3 = document.getElementById('dot-create-section');
      if (sec3) sec3.style.display = 'none';
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

    const sec3 = document.getElementById('dot-create-section');
    if (sec3) sec3.style.display = 'none';
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
function tbRender() {
  const grid  = document.getElementById('tb-staff-grid');
  const label = document.getElementById('tb-team-label');
  if (!grid) return;

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
    items.sort((a,b) => ({overdue:0,open:1,completed:2,lost:3}[a._status]||1) - ({overdue:0,open:1,completed:2,lost:3}[b._status]||1));
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
      <div onclick='tbShowItemDetail(${detailJson})'
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
  if (!tbState.loaded || !tbState.users.length) {
    // Tasks Board not loaded yet — show prompt, don't fetch
    csShowNotLoaded();
    return;
  }
  // Build from tbState (instant, already in memory)
  csState.allStaff = tbState.users.map(u => ({
    id: u.id, name: u.name,
    tasks: (tbState.tasks || []).filter(t =>
      (t.assigneeId || t.assignedTo) === u.id
    ),
  }));
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

    csState.allStaff = data.staff || [];
    if (data.staff) {
      tbState.users = data.staff.map(s => ({ id: s.id, name: s.name }));
      tbState.tasks = [];
      data.staff.forEach(s => {
        (s.tasks || []).forEach(t => tbState.tasks.push({ ...t, assigneeId: s.id }));
      });
      tbState.loaded = true;
    }
    csState.rawTasks = [];
    csState.allStaff.forEach(s => {
      (s.tasks || []).forEach(t => {
        if (t.title && t.title.startsWith(CS_PREFIX))
          csState.rawTasks.push({ ...t, assigneeName: s.name, assigneeId: s.id });
      });
    });
    csState.loaded = true;
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
    if (csState.selectedStaff !== 'all' && t.assigneeId !== csState.selectedStaff) return false;
    // If CS staff configured: only show their tasks. If not configured: show all [CS] tasks
    if (csIds.length && !csIds.includes(t.assigneeId) && t.assigneeId !== CS_MAHAD_ID) return false;
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
    if (!groups[t.assigneeId]) groups[t.assigneeId] = { name: t.assigneeName, tasks: [] };
    groups[t.assigneeId].tasks.push(t);
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
        return `<div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.04);display:flex;align-items:center;gap:12px;
                            background:${isDone?'rgba(0,196,106,.04)':isOverdue?'rgba(239,68,68,.04)':'transparent'}">
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
    toast('✓ Task completed — note sent to operator');
    setTimeout(() => csLoad(true), 500);
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
          <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.08em;margin-bottom:8px">CLIENT</div>
          <input id="cs-add-contact-search" type="text" autocomplete="off" placeholder="Search by name or DOT..."
            oninput="csAddSearchContact(this.value)"
            style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px 12px;font-size:13px;box-sizing:border-box">
          <div id="cs-add-contact-results" style="margin-top:6px"></div>
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
  if (!query || query.length < 2) { document.getElementById('cs-add-contact-results').innerHTML = ''; return; }
  const q = query.toLowerCase();
  const matches = (state.clients||[]).filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.dot_number||'').includes(q) ||
    (c.business_name||'').toLowerCase().includes(q)
  ).slice(0, 6);
  document.getElementById('cs-add-contact-results').innerHTML = matches.map(c=>`
    <div onclick="csAddSelectContact('${c.id}','${(c.name||'').replace(/'/g,"\\'")}')"
      style="padding:8px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--border);background:var(--bg3);margin-bottom:4px;font-size:12px;color:var(--text)">
      ${c.name}${c.dot_number?` · DOT# ${c.dot_number}`:''}
    </div>`).join('') || '<div style="font-size:12px;color:var(--text3);padding:6px">No results</div>';
}

function csAddSelectContact(id, name) {
  csAddSelectedContact = { id, name };
  document.getElementById('cs-add-contact-results').innerHTML = '';
  document.getElementById('cs-add-contact-search').value = name;
  const sel = document.getElementById('cs-add-selected');
  sel.style.display = 'block'; sel.textContent = `✓ ${name}`;
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
    status.innerHTML = '<span style="color:var(--green)">✓ CS Task created!</span>';
    toast('CS task created ✓');
    setTimeout(() => { document.getElementById('cs-add-modal')?.remove(); csLoad(true); }, 700);
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
function csRunAudit() {
  const btn  = document.getElementById('cs-audit-btn');
  const area = document.getElementById('cs-audit-results');

  const clients = state.clients || [];
  if (!clients.length) {
    if (area) area.innerHTML = '<div style="color:var(--yellow);padding:12px">⚠ Client list not loaded yet — go to Dashboard first to sync GHL, then return here.</div>';
    return;
  }

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
  csAuditData = { total: clients.length, issues, issueCount: issues.length };
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
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-right:4px">${data.issueCount} of ${data.total} contacts missing info:</div>
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
      <button onclick="csGenerateAllTasks()" style="background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid #7c3aed;
        border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
        <i class="ti ti-wand"></i> Generate CS Tasks for All Issues
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
  const safeName   = displayName.replace(/'/g, "\\'");
  const safeBiz    = (c.business_name||'').replace(/'/g, "\\'");
  const hasLicense = c.hasLicense || (c.tags||[]).includes('license-received');
  const csIds   = csGetStaffIds();
  // Use fallback staff list if csState not yet loaded
  const staffPool = csState.allStaff?.length ? csState.allStaff : ATS_STAFF_FALLBACK;
  const csStaff = csIds.length ? staffPool.filter(s => csIds.includes(s.id)) : staffPool;
  const staffOpts = csStaff.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  return `
  <div id="cs-audit-row-${c.id}" style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
    <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${displayName}</div>
        ${c.business_name && c.business_name !== displayName ? `<div style="font-size:11px;color:var(--text3);margin-top:1px">${c.business_name}</div>` : ''}
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">
          ${c.missing.map(m=>`<span style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);color:#ef4444;border-radius:5px;padding:2px 6px;font-size:10px;font-weight:700">${m}</span>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;flex-wrap:wrap">
        <button onclick="csToggleLicense('${c.id}','${safeName}',${hasLicense})" id="cs-lic-${c.id}"
          style="background:${hasLicense ? 'rgba(0,196,106,.15)' : 'var(--bg2)'};color:${hasLicense ? 'var(--green)' : 'var(--text3)'};
                 border:1px solid ${hasLicense ? 'rgba(0,196,106,.4)' : 'var(--border)'};border-radius:7px;
                 padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
          ${hasLicense ? '✓ License' : '📄 License?'}
        </button>
        <div style="display:flex;gap:4px;align-items:center">
          <select id="cs-assignee-${c.id}"
            style="background:var(--bg2);border:1px solid rgba(124,58,237,.35);color:#a78bfa;border-radius:7px;
                   padding:5px 8px;font-size:11px;cursor:pointer;max-width:130px">
            <option value="">Auto-assign</option>
            ${staffOpts}
          </select>
          <button onclick="csCreateAuditTask('${c.id}','${safeName}','${safeBiz}')"
            style="background:rgba(124,58,237,.15);color:#a78bfa;border:1px solid rgba(124,58,237,.4);
                   border-radius:7px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">
            + CS Task
          </button>
        </div>
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
async function csCreateAuditTask(contactId, name, bizName) {
  // Read manually-chosen assignee from the row's select, fallback to round-robin
  const selectEl = document.getElementById(`cs-assignee-${contactId}`);
  const assignee = (selectEl && selectEl.value) ? selectEl.value : csNextAssignee();

  const missingList = csAuditData?.issues?.find(c=>c.id===contactId)?.missing || [];
  // Use display name (already resolved in csAuditRow) — avoid "Unknown"
  const displayName = (name && name !== 'Unknown') ? name : (bizName || name);
  const title = `[CS] Update Missing Info — ${displayName}`;
  const body = missingList.length
    ? `Please update the following missing fields in GHL:\n${missingList.map(m=>`• ${m}`).join('\n')}`
    : 'Please review and update contact information in GHL.';
  try {
    const res = await fetch(`/api/contacts/${contactId}/tasks`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        title, body,
        assignedTo: assignee || undefined,
        dueDate: new Date(Date.now()+86400000).toISOString(),
        completed: false,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(`✓ CS task created for ${displayName}`);
    const row = document.getElementById(`cs-audit-row-${contactId}`);
    if (row) { row.style.opacity = '0.4'; row.style.pointerEvents = 'none'; }
    csLoadFromCache();
  } catch(e) { toast('Error: ' + e.message); }
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

