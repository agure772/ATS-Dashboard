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
  { key: 'filing_ny_permit',     label: 'NY Permit Renewal',     short: 'NY Perm',    group: 'annual'   },
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
    dashboard:  ['Dashboard', '2026 compliance overview'],
    compliance: ['Compliance Grid', 'Click any cell to update the GHL opportunity'],
    deadlines:  ['Upcoming Deadlines', 'Filing calendar for all clients'],
  };
  const [title, sub] = T[page] || ['ATS',''];
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent   = sub;
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
           'filing_clearinghouse','filing_nm_permit','filing_irp_cab_card','filing_mcs150','filing_ky_vehicle','filing_ny_permit'],
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

  const statusEl    = document.getElementById('dot-search-status');
  const resultEl    = document.getElementById('dot-result');
  const noKeyEl     = document.getElementById('dot-no-key');

  if (!statusEl) return; // not on DOT lookup page
  statusEl.textContent = 'Searching FMCSA...';
  statusEl.style.color = 'var(--text3)';
  if (resultEl) resultEl.style.display  = 'none';
  if (noKeyEl)  noKeyEl.style.display   = 'none';

  try {
    const res  = await fetch(`/api/dot/${dot}`);
    const data = await res.json();

    if (!res.ok) {
      if (data.help) {
        if (noKeyEl) noKeyEl.style.display = 'block';
        statusEl.textContent = '';
      } else {
        statusEl.textContent = `Error: ${data.error}`;
        statusEl.style.color = 'var(--red)';
      }
      return;
    }

    dotCurrentInfo = data.info;

    renderDotResult(data.info);
    if (resultEl) resultEl.style.display = 'block';

    // Show status with appropriate color
    const isRestricted = ['N','I','S'].includes(data.info.operating_status);
    statusEl.textContent = `✓ Found: ${data.info.legal_name}`;
    statusEl.style.color = isRestricted ? 'var(--yellow)' : 'var(--green)';

    // Auto-search GHL for matching contact
    dotSearchGHL(data.info.legal_name);

  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    statusEl.style.color = 'var(--red)';
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

async function dotSearchGHL(query) {
  if (!query || query.length < 2) {
    document.getElementById('dot-ghl-matches').innerHTML = '';
    return;
  }
  const q = query.toLowerCase().replace(/dot#?\s*/i,'');

  // First try local cache for fast results
  let matches = state.clients.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.dot_number || '').includes(q) ||
    (c.business_name || '').toLowerCase().includes(q)
  ).slice(0, 6);

  // If no local matches, do a live GHL search
  if (!matches.length) {
    try {
      const res = await fetch(`/api/contacts/search-live?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      matches = (data.contacts || []).slice(0, 6);
    } catch(e) {
      console.log('Live GHL search error:', e.message);
    }
  }

  if (!matches.length) {
    document.getElementById('dot-ghl-matches').innerHTML = '';
    const createSection = document.getElementById('dot-create-section');
    if (createSection) createSection.style.display = 'block';
    return;
  }
  const createSection = document.getElementById('dot-create-section');
  if (createSection) createSection.style.display = 'none';

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

    // Handle duplicate contact — server found the existing contact and used it
    if (data.duplicate && !data.contactId) {
      document.getElementById('dot-push-status').innerHTML = `
        <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px 14px;margin-top:8px">
          <div style="font-size:13px;font-weight:700;color:var(--yellow)"><i class="ti ti-alert-triangle"></i> Contact Already Exists</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">${data.error}</div>
        </div>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-user-plus"></i> Create New GHL Contact + Opportunities';
      return;
    }

    if (!res.ok) throw new Error(data.error);

    // Success — contact was created (or existing contact was found and updated)
    const wasExisting = data.usedExistingContact;
    document.getElementById('dot-create-section').style.display = 'none';
    document.getElementById('dot-push-status').innerHTML = `
      <div style="background:rgba(0,196,106,.1);border:1px solid rgba(0,196,106,.3);border-radius:8px;padding:10px 14px;margin-top:8px">
        <div style="font-size:13px;font-weight:700;color:var(--green)">
          <i class="ti ti-check"></i> ${wasExisting ? 'Existing Contact Updated!' : 'Contact Created Successfully!'}
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:4px">
          <strong>${dotCurrentInfo.legal_name}</strong> — ${wasExisting ? 'FMCSA data synced to existing GHL contact' : `added to GHL with ${data.opportunitiesCreated?.length || 0} service opportunities`}
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
