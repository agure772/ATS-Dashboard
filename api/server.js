require('dotenv').config();
console.log('=== ATS SERVER v2.6 STARTING ===');
const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
// Allow GHL to embed this app in an iframe
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *.gohighlevel.com *.leadconnectorhq.com");
  next();
});
app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, '../public')));

const LOC_ID  = process.env.GHL_LOCATION_ID;
const API_KEY = process.env.GHL_API_KEY;
const V2      = 'https://services.leadconnectorhq.com';
const HDRS    = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type':  'application/json',
  'Version':       '2021-07-28',
};

async function ghl(method, url, body = null) {
  const res = await fetch(url, {
    method, headers: HDRS,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch(e) { data = { raw: text }; }
  if (!res.ok) {
    console.error(`✗ ${res.status} ${url}:`, JSON.stringify(data).slice(0,200));
    throw { status: res.status, message: data.message||data.msg||`HTTP ${res.status}`, data };
  }
  return data;
}

// Fetch ALL pages of contacts (handles 1000+ contacts)
async function getAllContacts() {
  const contacts = [];
  let url = `${V2}/contacts/?locationId=${LOC_ID}&limit=100`;
  let page = 1;
  while (url) {
    console.log(`  Fetching contacts page ${page}...`);
    const data = await ghl('GET', url);
    const batch = data.contacts || [];
    contacts.push(...batch);
    // Get next page URL from meta
    url = data.meta?.nextPageUrl || null;
    page++;
    if (page > 20) break; // safety cap at 2000 contacts
  }
  console.log(`  Total contacts fetched: ${contacts.length}`);
  return contacts;
}

// Fetch ALL pages of opportunities
async function getAllOpportunities() {
  const opps = [];
  let url = `${V2}/opportunities/search?location_id=${LOC_ID}&limit=100`;
  let page = 1;
  while (url) {
    console.log(`  Fetching opportunities page ${page}...`);
    const data = await ghl('GET', url);
    const batch = data.opportunities || [];
    opps.push(...batch);
    url = data.meta?.nextPageUrl || null;
    page++;
    if (page > 50) break; // safety cap
  }
  console.log(`  Total opportunities fetched: ${opps.length}`);
  return opps;
}

// ── Pipeline map ──────────────────────────────────────────────────────────────
const PIPELINE_MAP = {
  filing_2290:          { name: '1. 2026 2290 Form Filing (06-30-26)' },
  filing_ucr:           { name: '2. 2026 UCR Filing' },
  filing_ifta_license:  { name: '3. 2026 IFTA License Renewal' },
  filing_business_name: { name: '4. 2026 Business Name Renewal' },
  filing_clearinghouse: { name: '5. 2026 Clearinghouse Driver Annual Query' },
  filing_nm_permit:     { name: '6. 2026 NM Permit Renewal' },
  filing_irp_cab_card:  { name: '7. 2026 IRP Cab Card (Plate) Renewal' },
  filing_mcs150:        { name: '8. 2026 MCS-150 Mileage Update for 2025' },
  filing_ky_vehicle:    { name: '9. 2026 KY Annual Vehicle Update' },
  ifta_q1_2026:         { name: 'Q1 2026 IFTA Filing' },
  ifta_q2_2026:         { name: 'Q2 2026 IFTA Filing' },
  ifta_q4_2025:         { name: 'Q4 2025 IFTA Filing' },
  ifta_q3_2025:         { name: 'Q3 2025 IFTA Filing' },
  ifta_q2_2025:         { name: 'Q2 2025 IFTA Filing' },
  ifta_q1_2025:         { name: 'Q1 2025 IFTA Filing' },
  ifta_q4_2024:         { name: 'Q4 2024 IFTA Filing' },
  new_company_setup:    { name: 'Step #1: New Company Setup' },
  prorate_account:      { name: 'Step #2: Prorate Account Setup (IRP/IFTA)' },
  clearinghouse_setup:  { name: 'Step #3: Clearinghouse Account Setup' },
  boi_filing:           { name: 'BOI Filing' },
  new_prorate_account:  { name: 'New Prorate Account Setup' },
  ifta_audit:           { name: 'IFTA Audit Support' },
};

const STAGE_MAP = { done:'Won', pending:'Open', urgent:'In Progress' };
let pipelineCache = {};
let clientCache   = { data: null, ts: 0, error: null };
const CACHE_TTL   = 60 * 1000; // 1 minute — so GHL changes show up quickly

// ── Load pipelines ────────────────────────────────────────────────────────────
async function loadPipelines() {
  console.log('\n🔄 Loading pipelines...');
  try {
    const d = await ghl('GET', `${V2}/opportunities/pipelines?locationId=${LOC_ID}`);
    (d.pipelines||[]).forEach(p => {
      const stages = {};
      const pid = p.id || p._id || p.pipelineId;
      (p.stages||[]).forEach(s => { stages[s.name] = s.id || s._id || s.stageId; });
      pipelineCache[p.name] = { id: pid, stages };
    });
    console.log(`✅ ${Object.keys(pipelineCache).length} pipelines loaded`);
  } catch(e) {
    console.log('⚠️  Pipeline load failed:', e.message);
  }
}

// ── Fetch and cache all clients ───────────────────────────────────────────────
async function fetchAllClients(force = false) {
  const now = Date.now();
  if (!force && clientCache.data && (now - clientCache.ts) < CACHE_TTL) {
    console.log(`⚡ Serving ${clientCache.data.length} clients from cache`);
    return clientCache.data;
  }

  console.log('\n📡 Fetching ALL contacts + opportunities from GHL...');
  console.log('   (You have 1000+ contacts — this takes ~30s the first time, then cached for 5 min)');
  const t = Date.now();

  try {
    // Fetch contacts and opportunities in parallel
    const [contacts, opps] = await Promise.all([
      getAllContacts(),
      getAllOpportunities(),
    ]);

    // Group opps by contactId for fast lookup
    const oppsByContact = {};
    opps.forEach(opp => {
      const cid = opp.contactId || opp.contact?.id;
      if (!cid) return;
      if (!oppsByContact[cid]) oppsByContact[cid] = [];
      oppsByContact[cid].push(opp);
    });

    const clients = contacts.map(c => mapContact(c, oppsByContact[c.id] || []));
    clientCache = { data: clients, ts: Date.now(), error: null };
    console.log(`✅ ${clients.length} clients ready in ${((Date.now()-t)/1000).toFixed(1)}s\n`);
    return clients;

  } catch(err) {
    clientCache.error = err.message;
    throw err;
  }
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  status:              'ok',
  ghl_configured:      !!API_KEY,
  location_configured: !!LOC_ID,
  api_key_prefix:      API_KEY ? API_KEY.slice(0,20)+'...' : 'NOT SET',
  location_id:         LOC_ID || 'NOT SET',
  pipelines_loaded:    Object.keys(pipelineCache).length,
  clients_cached:      clientCache.data?.length ?? 'none',
  cache_age_seconds:   Math.round((Date.now()-clientCache.ts)/1000),
  last_error:          clientCache.error || null,
  timestamp:           new Date().toISOString(),
}));

app.get('/api/debug', async (req, res) => {
  try {
    const data = await ghl('GET', `${V2}/contacts/?locationId=${LOC_ID}&limit=1`);
    res.json({ success:true, api:'v2 LeadConnector', total_contacts: data.meta?.total, sample: data.contacts?.[0] });
  } catch(err) {
    res.status(500).json({ success:false, error: err.message, detail: err.data });
  }
});

app.get('/api/pipelines', async (req, res) => {
  const list = Object.entries(pipelineCache).map(([name,p]) => ({
    id: p.id, name,
    stages: Object.entries(p.stages).map(([n,id]) => ({ id, name: n })),
  }));
  res.json({ pipelines_loaded: list.length, pipelines: list });
});

app.get('/api/contacts', async (req, res) => {
  try {
    const { query='' } = req.query;

    // If cache is empty and still loading, wait up to 60s
    if (!clientCache.data) {
      console.log('  Browser requested contacts — waiting for cache to fill...');
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (clientCache.data) break;
        if (clientCache.error) throw new Error(clientCache.error);
      }
    }

    let clients = await fetchAllClients();
    if (query) {
      const q = query.toLowerCase();
      clients = clients.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.mc_number||'').toLowerCase().includes(q) ||
        (c.dot_number||'').toLowerCase().includes(q) ||
        (c.business_name||'').toLowerCase().includes(q)
      );
    }
    res.json({ clients, total: clients.length });
  } catch(err) {
    console.error('GET /api/contacts:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts', async (req, res) => {
  try {
    const { name, business_name, mc_number, dot_number, phone, email } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const parts = name.trim().split(' ');
    const data = await ghl('POST', `${V2}/contacts/`, {
      locationId:  LOC_ID,
      firstName:   parts[0],
      lastName:    parts.slice(1).join(' ')||'',
      companyName: business_name||name,
      phone: phone||'', email: email||'',
      tags: ['ats-dashboard','ats advance service'],
    });
    clientCache.data = null; // bust cache
    res.status(201).json(mapContact(data.contact||data, []));
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/opportunities', async (req, res) => {
  try {
    const { contactId, serviceKey, contactName, businessName, dotNumber } = req.body;
    const pInfo = getPipelineInfo(serviceKey);
    if (!pInfo) return res.status(400).json({ error:`Pipeline not found for "${serviceKey}"` });
    const stageId = pInfo.stages['Open']||Object.values(pInfo.stages)[0];
    const data = await ghl('POST', `${V2}/opportunities/`, {
      pipelineId: pInfo.pipelineId, locationId: LOC_ID,
      name: `${contactName||'Client'}${businessName?' | '+businessName:dotNumber?' DOT# '+dotNumber:''}`,
      pipelineStageId: stageId, status:'open', contactId, monetaryValue:0,
    });
    clientCache.data = null;
    res.status(201).json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/opportunities/:id/status', async (req, res) => {
  try {
    const { status, serviceKey, notes } = req.body;
    const pInfo   = serviceKey ? getPipelineInfo(serviceKey) : null;
    const stageId = pInfo?.stages[STAGE_MAP[status]||'Open']||null;
    const payload = {
      status: status==='done'?'won':'open',
      ...(stageId?{pipelineStageId:stageId}:{}),
    };
    if (notes&&serviceKey) payload.customFields = buildCustomFields(serviceKey,{notes});
    const data = await ghl('PUT', `${V2}/opportunities/${req.params.id}`, payload);
    clientCache.data = null;
    res.json({ success:true, opportunity: data.opportunity||data });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/opportunities/:id/fields', async (req, res) => {
  try {
    const { fields, serviceKey } = req.body;
    const data = await ghl('PUT', `${V2}/opportunities/${req.params.id}`, {
      customFields: buildCustomFields(serviceKey, fields)
    });
    res.json({ success:true, opportunity: data.opportunity||data });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/opportunities/:id/notes', async (req, res) => {
  try {
    const data = await ghl('POST', `${V2}/opportunities/${req.params.id}/notes/`, {
      body:`[ATS] ${req.body.body}`
    });
    res.status(201).json(data);
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// NOTE: task creation endpoint is defined below near line 924 — single source of truth

app.post('/api/refresh', async (req, res) => {
  clientCache.data = null;
  try {
    const clients = await fetchAllClients(true);
    res.json({ success:true, clients_loaded: clients.length });
  } catch(err) { res.status(500).json({ success:false, error: err.message }); }
});



// ── Debug: list all GHL custom fields ────────────────────────────────────────
app.get('/api/debug/custom-fields', async (req, res) => {
  try {
    const data = await ghl('GET', `${V2}/locations/${process.env.GHL_LOCATION_ID}/customFields`);
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Debug: get one contact's raw custom fields ────────────────────────────────
app.get('/api/debug/contact/:id', async (req, res) => {
  try {
    const data = await ghl('GET', `${V2}/contacts/${req.params.id}`);
    res.json(data?.contact?.customFields || data?.customFields || data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Scrape Motus for company officials (operator name) ────────────────────────
async function scrapeMotus(dotNumber) {
  const result = { official_name: '', official_title: '', official_email: '', official_phone: '' };
  try {
    const url = `https://motus.dot.gov/customer/${dotNumber}/account`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://motus.dot.gov/',
      },
      timeout: 8000,
    });
    if (!res.ok) { console.log('Motus returned:', res.status); return result; }
    const html = await res.text();

    // Find "COMPANY OFFICIALS" section — table row with name and title
    // Pattern: <td>MOHAMUD SAID</td><td>MANAGER</td>
    const tableMatch = html.match(/Company\s*Officials[\s\S]{0,2000}?<tbody>([\s\S]{0,1000}?)<\/tbody>/i);
    if (tableMatch) {
      const tbody = tableMatch[1];
      // Extract all rows
      const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRx.exec(tbody)) !== null) {
        const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
          .map(m => m[1].replace(/<[^>]+>/g,'').trim());
        if (cells[0] && cells[0].length > 1 && !/^\s*$/.test(cells[0])) {
          result.official_name  = cells[0] || '';
          result.official_title = cells[1] || '';
          result.official_phone = cells[2] || '';
          result.official_email = cells[3] || '';
          console.log(`Motus official: name="${result.official_name}" title="${result.official_title}"`);
          break; // take the first official
        }
      }
    }

    if (!result.official_name) {
      // Fallback: simpler regex for name pattern in any row
      const nameMatch = html.match(/<td[^>]*>\s*([A-Z][A-Z\s]{2,40})\s*<\/td>/);
      if (nameMatch) result.official_name = nameMatch[1].trim();
    }
  } catch(e) {
    console.log('Motus scrape error:', e.message);
  }
  return result;
}

// ── Scrape SAFER website for full carrier data including mileage ──────────────
async function scrapeSAFER(dotNumber) {
  const result = { mc_number:'', mcs150_date:'', mcs150_mileage:'', mcs150_year:'', owner_name:'', phone:'', email:'', mailing_address:'' };
  try {
    // Use SAFER registration page which has MCS-150 form date
    const url = `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dotNumber}`;
    const regUrl = `https://safer.fmcsa.dot.gov/query.asp?query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dotNumber}&action=Register`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://safer.fmcsa.dot.gov/',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    if (!res.ok) { console.log('SAFER returned:', res.status); return result; }
    const html = await res.text();

    // Log a section around MCS-150 so we can see the exact HTML structure
    // MC number
    const mcMatch = html.match(/MC-(\d+)/);
    if (mcMatch) result.mc_number = `MC-${mcMatch[1]}`;

    // Collect all dates MM/DD/YYYY with their positions
    const allDateMatches = [];
    const dateRx = /(\d{2}\/\d{2}\/\d{4})/g;
    let dm;
    while ((dm = dateRx.exec(html)) !== null) {
      allDateMatches.push({ date: dm[1], index: dm.index });
    }
    console.log('All dates in SAFER HTML:', allDateMatches.map(d => d.date));

    // Today's date to exclude
    const now = new Date();
    const todayStr = String(now.getMonth()+1).padStart(2,'0') + '/' +
                     String(now.getDate()).padStart(2,'0') + '/' + now.getFullYear();

    // Mileage position
    const mileageMatch = html.match(/(\d[\d,]+)\s*\((\d{4})\)/);
    if (mileageMatch) {
      result.mcs150_mileage = mileageMatch[1].replace(/,/g,'');
      result.mcs150_year    = mileageMatch[2];
    }

    // MCS-150 date = any date that is NOT today, preferring ones near "Form Date" label
    // First try: find date after "Form Date" text
    const formDateIdx = html.search(/Form\s*Date/i);
    if (formDateIdx >= 0) {
      const chunk = html.slice(formDateIdx, formDateIdx + 150);
      const fd = chunk.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (fd && fd[1] !== todayStr) {
        result.mcs150_date = fd[1];
      }
    }

    // Second try: any date that isn't today
    if (!result.mcs150_date) {
      const notToday = allDateMatches.filter(d => d.date !== todayStr);
      if (notToday.length > 0) result.mcs150_date = notToday[0].date;
    }

    // Owner/contact name from FMCSA SMS Census API (data.transportation.gov Socrata API)
    // This is the official free public dataset with contact names — no auth required
    try {
      const socrataUrl = `https://data.transportation.gov/resource/kjg3-diqy.json?dot_number=${dotNumber}&$limit=1`;
      const socrataRes = await fetch(socrataUrl, { headers: { 'Accept': 'application/json' } });
      console.log('Socrata census API status:', socrataRes.status);
      if (socrataRes.ok) {
        const records = await socrataRes.json();
        console.log('Socrata record:', JSON.stringify(records[0] || {}).slice(0, 400));
        if (records.length > 0) {
          const r = records[0];
          // Contact name field in SMS census data
          // No contact name in this dataset — but grab phone, email, mileage
          result.owner_name = ''; // not available in public census data
          if (!result.mcs150_mileage && r.mcs150_mileage) result.mcs150_mileage = r.mcs150_mileage;
          if (!result.mcs150_year && r.mcs150_mileage_year) result.mcs150_year = r.mcs150_mileage_year;
          if (!result.phone && r.telephone) result.phone = r.telephone;
          if (!result.email && r.email_address) result.email = r.email_address;
          if (!result.mailing_address && r.mailing_street) {
            result.mailing_address = [r.mailing_street, r.mailing_city, r.mailing_state, r.mailing_zip].filter(Boolean).join(', ');
          }
          // Store individual address parts
          if (!result.mailing_street && r.mailing_street) result.mailing_street = r.mailing_street;
          if (!result.mailing_city   && r.mailing_city)   result.mailing_city   = r.mailing_city;
          if (!result.mailing_state  && r.mailing_state)  result.mailing_state  = r.mailing_state;
          if (!result.mailing_zip    && r.mailing_zip)    result.mailing_zip    = r.mailing_zip;
          console.log('Socrata phone:', result.phone, 'email:', result.email, 'mileage:', result.mcs150_mileage, 'year:', result.mcs150_year);
        }
      }
    } catch(e) { console.log('Socrata census error:', e.message); }

    console.log('SAFER scrape result:', result);
  } catch(e) {
    console.log('SAFER scrape error:', e.message);
  }
  return result;
}

// ── FMCSA DOT Lookup ──────────────────────────────────────────────────────────
app.get('/api/dot/:dotNumber', async (req, res) => {
  const { dotNumber } = req.params;
  const webKey = process.env.FMCSA_WEB_KEY;

  if (!webKey) {
    return res.status(400).json({
      error: 'FMCSA_WEB_KEY not configured',
      help: 'Get your free key at https://ai.fmcsa.dot.gov/ and add FMCSA_WEB_KEY=yourkey to your .env file'
    });
  }

  try {
    // Fetch carrier info
    const carrierUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}?webKey=${webKey}`;
    const carrierRes = await fetch(carrierUrl, { headers: { 'Accept': 'application/json' } });

    if (!carrierRes.ok) {
      const errText = await carrierRes.text();
      return res.status(carrierRes.status).json({ error: `FMCSA returned ${carrierRes.status}`, detail: errText.slice(0,200) });
    }

    const carrierData = await carrierRes.json();
    const carrier = carrierData.content?.carrier || carrierData.carrier || carrierData;

    if (!carrier || (!carrier.dotNumber && !carrier.legalName)) {
      return res.status(404).json({ error: 'DOT number not found in FMCSA database' });
    }

    // Normalize the response
    // Scrape SAFER and Motus in parallel
    const [safer, motus] = await Promise.all([
      scrapeSAFER(dotNumber),
      scrapeMotus(dotNumber),
    ]);
    let mcNumber    = safer.mc_number;
    let mcs150Date  = safer.mcs150_date;
    let mcs150Mileage = safer.mcs150_mileage;
    let mcs150Year  = safer.mcs150_year;

    // Fallback: try the docket-numbers API endpoint for MC number
    if (!mcNumber) {
      try {
        const docketUrl = `https://mobile.fmcsa.dot.gov/qc/services/carriers/${dotNumber}/docket-numbers?webKey=${webKey}`;
        const docketRes = await fetch(docketUrl, { headers: { 'Accept': 'application/json' } });
        if (docketRes.ok) {
          const docketData = await docketRes.json();
          const dockets = docketData.content?.carrierDocketNumbers || docketData.content || [];
          const mcEntry = Array.isArray(dockets)
            ? dockets.find(d => d.docketNumberPrefix === 'MC' || d.prefix === 'MC')
            : null;
          if (mcEntry) mcNumber = `MC-${mcEntry.docketNumber || mcEntry.number || ''}`;
        }
      } catch(e) { console.log('Docket fallback error:', e.message); }
    }

    // Operating status from confirmed fields
    const opStatus = carrier.allowedToOperate === 'Y' ? 'A'
      : carrier.allowedToOperate === 'N' ? 'N'
      : carrier.statusCode || 'A';

    const info = {
      dot_number:        String(carrier.dotNumber || dotNumber),
      legal_name:        carrier.legalName || '',
      dba_name:          carrier.dbaName || '',
      entity_type:       carrier.carrierOperation?.carrierOperationDesc || carrier.censusTypeId?.censusTypeDesc || '',
      mc_number:         mcNumber,
      physical_address:  [carrier.phyStreet, carrier.phyCity, carrier.phyState, carrier.phyZipcode].filter(Boolean).join(', '),
      mailing_address:   safer.mailing_address || '',
      mailing_street:    safer.mailing_street  || carrier.phyStreet   || '',
      mailing_city:      safer.mailing_city    || carrier.phyCity     || '',
      mailing_state:     safer.mailing_state   || carrier.phyState    || '',
      mailing_zip:       safer.mailing_zip     || carrier.phyZipcode  || '',
      phone:             safer.phone || '',
      email:             safer.email || '',
      ein:               carrier.ein || '',
      power_units:       String(carrier.totalPowerUnits || ''),
      drivers:           String(carrier.totalDrivers || ''),
      mcs150_date:       mcs150Date,
      mcs150_mileage:    mcs150Mileage,
      mcs150_year:       mcs150Year,
      mcs150_outdated:   carrier.mcs150Outdated === 'Y',
      oos_date:          carrier.oosDate || '',
      operating_status:  opStatus,
      safety_rating:     carrier.safetyRating || 'Not Rated',
      owner_name:        safer.owner_name || '',
      official_name:     motus.official_name  || '',
      official_title:    motus.official_title || '',
      official_email:    motus.official_email || '',
      official_phone:    motus.official_phone || '',
      crash_total:       String(carrier.crashTotal || '0'),
      iss_score:         String(carrier.issScore || ''),
      raw:               carrier,
    };

    res.json({ success: true, info });
  } catch (err) {
    console.error('FMCSA lookup error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Push FMCSA data to GHL contact ───────────────────────────────────────────
app.post('/api/dot/:dotNumber/push-to-ghl', async (req, res) => {
  const { contactId, info } = req.body;
  if (!contactId || !info) return res.status(400).json({ error: 'contactId and info required' });

  try {
    // Update contact in GHL with FMCSA data
    // Map FMCSA data to real GHL custom field IDs
    // Operating status must match GHL picklist options exactly
    const osMap = { 'A':'AUTHORIZED', 'N':'NOT AUTHORIZED', 'I':'INACTIVE', 'S':'OUT-OF-SERVICE' };
    const osVal = osMap[info.operating_status] || (info.operating_status ? 'AUTHORIZED' : undefined);

    // Number of units → map power_units to GHL radio options
    let unitVal = undefined;
    const pu = parseInt(info.power_units) || 0;
    if (pu === 1) unitVal = '1 Unit (Owner Ops)';
    else if (pu >= 2 && pu <= 3) unitVal = '2-3 Units';
    else if (pu >= 4) unitVal = '4-10 Units';

    // Strip MC- prefix for numerical field
    const mcNum  = info.mc_number ? String(info.mc_number).replace(/^MC-/i,'') : '';
    const einNum = info.ein       ? String(info.ein).replace(/-/g,'')        : '';

    const cleanName = (info.legal_name || '').replace(/\s+DOT#?\s*\d+/i,'').trim();

    // Fetch custom field schema to find Task Name field ID
    let taskNameFieldId = null;
    try {
      const schema = await ghl('GET', `${V2}/locations/${LOC_ID}/customFields`);
      const taskField = (schema.customFields || []).find(f =>
        /task.?name/i.test(f.name || f.fieldKey || '')
      );
      taskNameFieldId = taskField?.id || null;
      if (taskNameFieldId) console.log(`Task Name field ID: ${taskNameFieldId}`);
      else console.log('Task Name field not found. Fields:', (schema.customFields||[]).map(f=>f.name).slice(0,15));
    } catch(e) { console.log('Could not fetch custom fields schema:', e.message); }

    const customFields = [
      info.dot_number  && { id: 'E5MJr7vstJWSi59CxAbK', field_value: parseInt(info.dot_number) || info.dot_number },
      mcNum            && { id: 'twbBzamze4MVgetPLoSA',  field_value: parseInt(mcNum) || mcNum },
      einNum           && { id: 'fr4t6AA1aM8dRhb7Pj3R',  field_value: einNum },
      info.mcs150_year && { id: 'kmBR6gFRCxd0ZPFEXGz7',  field_value: parseInt(info.mcs150_year) },
      info.mcs150_mileage && { id: 'jzsQ29O684sLc2i5YE3e', field_value: parseInt(String(info.mcs150_mileage).replace(/,/g,'')) || 0 },
      info.mcs150_year && { id: 'u9LKMEGxjlhZGsUuhSRE',  field_value: parseInt(info.mcs150_year) },
      unitVal          && { id: 'ZK43DBIa2Nwqt8Wr7Fw3',  field_value: unitVal },
      info.power_units && { id: '0ckZ9VuFRCMao83FJKUQ',   field_value: String(info.power_units) },
      info.drivers     && { id: '6CvAenSFl04oBvhmbeEW',   field_value: String(info.drivers) },
      (info.mailing_address || info.physical_address) && { id: 'gmZAkRDtnsOhsiCYUrxp', field_value: info.mailing_address || info.physical_address },
      osVal            && { id: 'Tx9uGn4hrVwJKv6EheCJ',  field_value: osVal },
      taskNameFieldId  && cleanName && { id: taskNameFieldId, field_value: cleanName },
    ].filter(Boolean);
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email||'') ? info.email : undefined;
    const validPhone = (info.phone||'').replace(/\D/g,'').length >= 7 ? info.phone : undefined;
    const firstName  = req.body.firstName || undefined;
    const lastName   = req.body.lastName  || undefined;
    const payload = {
      // Only set name fields if provided by staff — never overwrite with blank
      ...(firstName ? { firstName } : {}),
      ...(lastName  ? { lastName  } : {}),
      // Do NOT set firstName/lastName if not provided — those belong to the actual person in GHL
      companyName: info.legal_name ? `${info.legal_name} DOT# ${info.dot_number}` : undefined,
      ...(validPhone ? { phone: validPhone } : {}),
      ...(validEmail ? { email: validEmail } : {}),
      address1: info.mailing_street || undefined,
      city:     info.mailing_city   || undefined,
      state:    info.mailing_state  || undefined,
      postalCode: info.mailing_zip  || undefined,
      country:  info.mailing_street ? 'US' : undefined,
      customFields,
    };

    const updated = await ghl('PUT', `${V2}/contacts/${contactId}`, payload);
    // Bust cache so dashboard reflects changes
    clientCache.data = null;
    res.json({ success: true, contact: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── Create new GHL contact + opportunities from DOT lookup ───────────────────
app.post('/api/dot/:dotNumber/create-contact', async (req, res) => {
  const { info } = req.body;
  if (!info) return res.status(400).json({ error: 'info required' });
  try {
    // 0. Duplicate check — search GHL by DOT number first
    const dotStr = String(info.dot_number || '').trim();
    const nameStr = (info.legal_name || '').trim();
    if (dotStr || nameStr) {
      const query = dotStr || nameStr;
      const existing = await ghl('GET', `${V2}/contacts/?locationId=${LOC_ID}&query=${encodeURIComponent(query)}&limit=5`);
      const contacts = existing?.contacts || [];
      const dupe = contacts.find(c => {
        const cDot = c.customFields?.find(f => f.id === 'E5MJr7vstJWSi59CxAbK')?.fieldValue;
        return String(cDot || '') === dotStr ||
          (c.companyName || c.firstName || '').toLowerCase() === nameStr.toLowerCase();
      });
      if (dupe) {
        return res.status(409).json({
          error: `Contact already exists in GHL: ${dupe.companyName || dupe.firstName}`,
          existingId: dupe.id,
          duplicate: true,
        });
      }
    }

    // 1. Create the contact
    const mcNum = info.mc_number ? String(info.mc_number).replace(/^MC-/i,'') : '';
    const einStr = info.ein ? String(info.ein) : '';
    const cleanName = (info.legal_name || '').replace(/\s+DOT#?\s*\d+/i,'').trim();

    // Find Task Name custom field ID
    let taskNameFieldId = null;
    try {
      const schema = await ghl('GET', `${V2}/locations/${LOC_ID}/customFields`);
      const taskField = (schema.customFields || []).find(f =>
        /task.?name/i.test(f.name || f.fieldKey || '')
      );
      taskNameFieldId = taskField?.id || null;
      if (taskNameFieldId) console.log(`Task Name field ID: ${taskNameFieldId}`);
      else console.log('Task Name field not found. Available fields:', (schema.customFields||[]).map(f=>f.name).slice(0,10));
    } catch(e) { console.log('Custom field schema error:', e.message); }

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email||'') ? info.email : undefined;
    const validPhone = (info.phone||'').replace(/\D/g,'').length >= 7 ? info.phone : undefined;
    const contactPayload = {
      firstName: req.body.firstName || '',
      lastName:  req.body.lastName  || '',
      companyName: info.legal_name
        ? `${info.legal_name} DOT# ${info.dot_number}`
        : `DOT# ${info.dot_number}`,
      ...(validPhone ? { phone: validPhone } : {}),
      ...(validEmail ? { email: validEmail } : {}),
      address1:   info.mailing_street || '',
      city:       info.mailing_city   || '',
      state:      info.mailing_state  || '',
      postalCode: info.mailing_zip    || '',
      country:    'US',
      tags: ['ats-dashboard'],
      customFields: [
        info.dot_number && { id: 'E5MJr7vstJWSi59CxAbK', field_value: parseInt(info.dot_number) },
        mcNum          && { id: 'twbBzamze4MVgetPLoSA', field_value: parseInt(mcNum) || mcNum },
        einStr         && { id: 'fr4t6AA1aM8dRhb7Pj3R', field_value: einStr },
        info.mcs150_year && { id: 'kmBR6gFRCxd0ZPFEXGz7', field_value: parseInt(info.mcs150_year) },
        info.mcs150_mileage && { id: 'jzsQ29O684sLc2i5YE3e', field_value: parseInt(String(info.mcs150_mileage).replace(/,/g,'')) },
        (info.mailing_address || info.physical_address) && { id: 'gmZAkRDtnsOhsiCYUrxp', field_value: info.mailing_address || info.physical_address },
        taskNameFieldId && cleanName && { id: taskNameFieldId, field_value: cleanName },
      ].filter(Boolean),
      locationId: process.env.GHL_LOCATION_ID,
    };

    const contactResult = await ghl('POST', `${V2}/contacts/`, contactPayload);
    const contactId = contactResult?.contact?.id;
    if (!contactId) throw new Error('Contact creation failed — no ID returned');

    // 2. Create default opportunities for annual compliance services
    const defaultServices = [
      'filing_2290', 'filing_ucr', 'filing_ifta_license', 'filing_mcs150',
      'new_company_setup', 'prorate_account', 'clearinghouse_setup'
    ];
    const oppResults = [];
    for (const serviceKey of defaultServices) {
      try {
        const pipeline = pipelineCache[PIPELINE_MAP[serviceKey]?.name];
        if (!pipeline) continue;
        const oppPayload = {
          name: cleanName || `DOT#${info.dot_number}`,
          pipelineId: pipeline.id,
          pipelineStageId: pipeline.stages?.[0]?.id,
          status: 'open',
          contactId,
          monetaryValue: 0,
          locationId: process.env.GHL_LOCATION_ID,
        };
        const oppResult = await ghl('POST', `${V2}/opportunities/`, oppPayload);
        if (oppResult?.opportunity?.id) oppResults.push(serviceKey);
      } catch(e) { console.log(`Opp creation failed for ${serviceKey}:`, e.message); }
    }

    // Bust cache
    clientCache.data = null;
    res.json({ success: true, contactId, contact: contactResult.contact, opportunitiesCreated: oppResults });
  } catch(err) {
    console.error('Create contact error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Tasks Board — fetch tasks + opportunities for supervisor view ──────────────
let tasksBoardCache = { data: null, ts: 0 };
let tasksBoardRefreshing = false;
const TASKS_BOARD_TTL   = 10 * 60 * 1000;  // serve fresh cache for 10 min without background refresh
const TASKS_BOARD_STALE = 4 * 60 * 60 * 1000; // serve stale cache up to 4 hours while refreshing in bg
// Key: once loaded, ALWAYS serve from cache (even if stale) and refresh in background.
// Only blocks waiting for fresh data on very first load or manual force-refresh.

async function buildTasksBoardData() {
  // GHL Users
  let usersData = [];
  try {
    const ud = await ghl('GET', `${V2}/users/?locationId=${LOC_ID}`);
    usersData = ud.users || ud.data || ud.members || [];
    console.log(`Users found: ${usersData.length}`);
  } catch(e) { console.log('Users err:', e.message); }

  // Fetch Opportunities and full Contact list IN PARALLEL (was sequential before)
  const fetchOpps = async () => {
    const oppsData = [];
    let oppsPage = 1, oppsHasMore = true;
    while (oppsHasMore && oppsPage <= 30) {
      try {
        const od = await ghl('GET', `${V2}/opportunities/search?location_id=${LOC_ID}&limit=100&page=${oppsPage}`);
        const batch = od.opportunities || [];
        oppsData.push(...batch);
        oppsHasMore = batch.length === 100;
        oppsPage++;
      } catch(e) { oppsHasMore = false; }
    }
    return oppsData;
  };

  const fetchAllContacts = async () => {
    const contacts = [];
    let cPage = 1, cHasMore = true;
    while (cHasMore && cPage <= 15) { // cap ~1500 contacts
      try {
        const cd = await ghl('GET', `${V2}/contacts/?locationId=${LOC_ID}&limit=100&page=${cPage}`);
        const batch = cd.contacts || [];
        contacts.push(...batch);
        cHasMore = batch.length === 100;
        cPage++;
      } catch(e) { cHasMore = false; }
    }
    return contacts;
  };

  const [oppsData, allContacts] = await Promise.all([fetchOpps(), fetchAllContacts()]);
  const allContactIds = allContacts.map(c => c.id);
  console.log(`Opps: ${oppsData.length}, Contacts: ${allContacts.length}`);

  // Build contactId -> { name, companyName, tags, phone, email, dotNumber } map for Tasks Board display
  const contactInfoMap = {};
  const extractDot = (text) => {
    const m = (text||'').match(/DOT#?\s*(\d{4,9})/i);
    return m ? m[1] : '';
  };
  allContacts.forEach(c => {
    const name = c.name || `${c.firstName||''} ${c.lastName||''}`.trim() || c.companyName || 'Unknown';
    contactInfoMap[c.id] = {
      name,
      companyName: c.companyName || '',
      tags: (c.tags || []).map(t => String(t).toLowerCase()),
      phone: c.phone || '',
      email: c.email || '',
      dotNumber: extractDot(name) || extractDot(c.companyName),
    };
  });
  // Also capture contact info embedded directly in opportunities (covers contacts not in the bulk list, e.g. if pagination cap was hit)
  oppsData.forEach(o => {
    const cid = o.contactId || o.contact?.id;
    if (cid && !contactInfoMap[cid] && o.contact) {
      contactInfoMap[cid] = {
        name: o.contact.name || `${o.contact.firstName||''} ${o.contact.lastName||''}`.trim() || 'Unknown',
        companyName: o.contact.companyName || '',
        tags: (o.contact.tags || []).map(t => String(t).toLowerCase()),
        phone: o.contact.phone || '',
        email: o.contact.email || '',
        dotNumber: '',
      };
    }
  });

  // Build userId→name map
  const userMap = {};
  usersData.forEach(u => { userMap[u.id] = u.name || `${u.firstName||''} ${u.lastName||''}`.trim(); });
  oppsData.forEach(o => { if (o.assignedTo && o.ownerName) userMap[o.assignedTo] = o.ownerName; });
  oppsData.forEach(o => { if (o.assignedTo && userMap[o.assignedTo]) o.ownerName = userMap[o.assignedTo]; });

  // Ensure pipeline cache is populated (re-fetch if empty)
  if (Object.keys(pipelineCache).length === 0) {
    console.log('⚠ pipelineCache empty — fetching pipelines now...');
    try {
      const d = await ghl('GET', `${V2}/opportunities/pipelines?locationId=${LOC_ID}`);
      (d.pipelines||[]).forEach(p => {
        const stages = {};
        const pid = p.id || p._id || p.pipelineId;
        (p.stages||[]).forEach(s => { stages[s.name] = s.id || s._id || s.stageId; });
        pipelineCache[p.name] = { id: pid, stages };
      });
      console.log(`✅ Pipelines loaded on-demand: ${Object.keys(pipelineCache).length}`);
    } catch(e) {
      console.error('Pipeline fetch failed:', e.message);
    }
  }

  // Build reverse lookup: pipelineId -> pipelineName, stageId -> stageName
  const pipelineIdToName = {};
  const stageIdToName = {};
  Object.entries(pipelineCache).forEach(([pName, p]) => {
    pipelineIdToName[p.id] = pName;
    Object.entries(p.stages).forEach(([sName, sId]) => {
      stageIdToName[sId] = sName;
    });
  });

  // Log first opp to verify pipelineId fields exist
  if (oppsData.length > 0) {
    const sample = oppsData[0];
    console.log(`🔍 Sample opp: pipelineId="${sample.pipelineId}" pipelineStageId="${sample.pipelineStageId}" name="${sample.name}"`);
    console.log(`🔍 pipelineIdToName keys: ${Object.keys(pipelineIdToName).slice(0,3).join(', ')}`);
    console.log(`🔍 Resolved: pipelineName="${pipelineIdToName[sample.pipelineId]||'NOT FOUND'}" stageName="${stageIdToName[sample.pipelineStageId]||'NOT FOUND'}"`);
  }

  // Enrich opportunities with contact info (name, company, tags, phone, email, DOT#)
  oppsData.forEach(o => {
    const cid = o.contactId || o.contact?.id;
    const info = cid ? contactInfoMap[cid] : null;
    if (info) {
      o.contactName    = o.contactName || info.name;
      o.companyName    = info.companyName;
      o.customerTags   = info.tags;
      o.contactPhone   = info.phone;
      o.contactEmail   = info.email;
      o.dotNumber      = info.dotNumber || extractDot(o.name);
    } else {
      o.dotNumber = extractDot(o.name);
    }
    // Attach human-readable pipeline and stage names
    o.pipelineName = pipelineIdToName[o.pipelineId] || '';
    o.stageName    = stageIdToName[o.pipelineStageId] || '';
    // Preserve tags explicitly (GHL returns them as o.tags — pipeline-level labels like "Zero Filing")
    o.tags    = o.tags    || [];
    o.oppTags = o.oppTags || o.tags; // alias for clarity
    if (o.tags.length) console.log(`Opp tags for ${o.name}: [${o.tags.join(', ')}]`);
  });

  // Tasks — per contact, high concurrency batches
  const tasksData = [];
  const oppContactIds = oppsData.map(o => o.contactId || o.contact?.id).filter(Boolean);
  const contactIds = [...new Set([...oppContactIds, ...allContactIds])];
  console.log(`Fetching tasks for ${contactIds.length} unique contacts...`);

  const CONCURRENCY = 10;
  let firstTaskLogged = false;
  for (let i = 0; i < contactIds.length; i += CONCURRENCY) {
    const batch = contactIds.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async cid => {
      try {
        const td = await ghl('GET', `${V2}/contacts/${cid}/tasks`);
        const tasks = td.tasks || td.data || [];
        const info = contactInfoMap[cid];
        tasks.forEach(t => {
          // Log first task to see exact field names GHL uses
          if (!firstTaskLogged) {
            console.log('GHL task fields:', Object.keys(t));
            console.log('GHL task sample:', JSON.stringify(t).slice(0,500));
            firstTaskLogged = true;
          }
          // GHL may use assignedTo, assignedUserId, or userId for the staff member
          const assigneeId = t.assignedTo || t.assignedUserId || t.userId || '';
          tasksData.push({
            ...t, contactId: cid, assigneeId, assigneeName: userMap[assigneeId] || '',
            contactName:  info?.name || '',
            companyName:  info?.companyName || '',
            customerTags: info?.tags || [],
            contactPhone: info?.phone || '',
            contactEmail: info?.email || '',
            dotNumber:    info?.dotNumber || extractDot(t.title),
          });
        });
      } catch(e) {
        if (e.message && (e.message.includes('429') || e.message.includes('rate')))
          console.log(`Rate limit hit fetching tasks for ${cid}`);
      }
    }));
    // 200ms delay every 5 batches to respect GHL rate limits (100 req/10s)
    if (Math.floor(i / CONCURRENCY) % 5 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Log how many tasks each user has for debugging
  const tasksByUser = {};
  tasksData.forEach(t => { tasksByUser[t.assigneeId] = (tasksByUser[t.assigneeId]||0)+1; });
  console.log('Tasks by user:', JSON.stringify(tasksByUser));

  const mahadOpps = oppsData.filter(o => o.assignedTo === 'yri669q8Ymx22zdFDPLK');
  console.log(`FINAL: ${tasksData.length} tasks, ${oppsData.length} opps, Mahad opps: ${mahadOpps.length}`);
  if (mahadOpps.length) console.log('Sample Mahad opp:', JSON.stringify(mahadOpps[0]).slice(0,200));
  return { tasks: tasksData, opportunities: oppsData, users: usersData, userMap };
}

app.get('/api/tasks-board', async (req, res) => {
  const force = req.query.refresh === '1';
  const now = Date.now();
  const age = now - tasksBoardCache.ts;

  // Fresh cache — serve instantly
  if (!force && tasksBoardCache.data && age < TASKS_BOARD_TTL) {
    console.log(`⚡ Serving tasks-board from cache (${Math.round(age/1000)}s old)`);
    return res.json(tasksBoardCache.data);
  }

  // Stale-but-usable cache — serve immediately, refresh in background for next time
  if (!force && tasksBoardCache.data && age < TASKS_BOARD_STALE) {
    console.log(`⚡ Serving STALE tasks-board (${Math.round(age/1000)}s old), refreshing in background`);
    res.json(tasksBoardCache.data);
    if (!tasksBoardRefreshing) {
      tasksBoardRefreshing = true;
      buildTasksBoardData()
        .then(data => { tasksBoardCache = { data, ts: Date.now() }; })
        .catch(e => console.log('Background refresh failed:', e.message))
        .finally(() => { tasksBoardRefreshing = false; });
    }
    return;
  }

  // No usable cache (first load, or forced refresh) — must wait for fresh fetch
  try {
    const data = await buildTasksBoardData();
    tasksBoardCache = { data, ts: Date.now() };
    res.json(data);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});


// Debug: get raw user data to find correct IDs
// Debug: find opps assigned to Mahad and check their field structure
app.get('/api/debug/mahad-opps', async (req, res) => {
  try {
    const mahadId = 'yri669q8Ymx22zdFDPLK';
    const od = await ghl('GET', `${V2}/opportunities/search?location_id=${LOC_ID}&limit=20&page=1`);
    const all = od.opportunities || [];
    const sample = all.slice(0,3).map(o => ({
      id: o.id, name: o.name, assignedTo: o.assignedTo, ownerName: o.ownerName,
      status: o.status, contactId: o.contactId,
    }));
    const mahadOpps = all.filter(o => o.assignedTo === mahadId).slice(0,5).map(o => ({
      id: o.id, name: o.name, assignedTo: o.assignedTo, status: o.status,
    }));
    res.json({ mahadId, totalOpps: all.length, mahadOpps, sample });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/debug/users', async (req, res) => {
  const results = {};
  try { results.v2_no_limit = await ghl('GET', `${V2}/users/?locationId=${LOC_ID}`); } catch(e) { results.v2_no_limit_err = e.message; }
  try { results.v2_with_limit = await ghl('GET', `${V2}/users/?locationId=${LOC_ID}&limit=100`); } catch(e) { results.v2_with_limit_err = e.message; }
  try {
    const od = await ghl('GET', `${V2}/opportunities/search?location_id=${LOC_ID}&limit=10&page=1`);
    results.sample_opps = (od.opportunities||[]).map(o => ({
      assignedTo: o.assignedTo, ownerName: o.ownerName, name: o.name?.slice(0,30)
    }));
  } catch(e) { results.opps_err = e.message; }
  res.json(results);
});

// ── Assign opportunity to user ────────────────────────────────────────────
app.post('/api/opportunities/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    if (!assignedTo) return res.status(400).json({ error: 'assignedTo required' });
    const data = await ghl('PUT', `${V2}/opportunities/${id}`, { assignedTo });
    console.log(`✓ Opp ${id} reassigned to ${assignedTo}`);
    res.json({ success: true, opportunity: data });
  } catch(err) {
    console.log(`✗ Opp assign failed for ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Assign task to user ───────────────────────────────────────────────────
app.post('/api/contacts/:contactId/tasks/:taskId/assign', async (req, res) => {
  try {
    const { contactId, taskId } = req.params;
    const { assignedTo } = req.body;
    if (!assignedTo) return res.status(400).json({ error: 'assignedTo required' });
    const data = await ghl('PUT', `${V2}/contacts/${contactId}/tasks/${taskId}`, { assignedTo });
    console.log(`✓ Task ${taskId} reassigned to ${assignedTo}`);
    res.json({ success: true, task: data });
  } catch(err) {
    console.log(`✗ Task assign failed for ${req.params.taskId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Mark task as completed ─────────────────────────────────────────────────
app.post('/api/contacts/:contactId/tasks/:taskId/complete', async (req, res) => {
  try {
    const { contactId, taskId } = req.params;
    const data = await ghl('PUT', `${V2}/contacts/${contactId}/tasks/${taskId}`, { completed: true });
    console.log(`✓ Task ${taskId} marked complete`);
    res.json({ success: true, task: data });
  } catch(err) {
    console.log(`✗ Task complete failed for ${req.params.taskId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Mark opportunity as Won ────────────────────────────────────────────────
app.post('/api/opportunities/:id/win', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await ghl('PUT', `${V2}/opportunities/${id}`, { status: 'won' });
    console.log(`✓ Opp ${id} marked won`);
    res.json({ success: true, opportunity: data });
  } catch(err) {
    console.log(`✗ Opp win failed for ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Create task for a contact (Tasks Board + FMCSA Support Form) ─────────
app.post('/api/contacts/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, assignedTo, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    // ── Server-side duplicate guard for [CS] tasks ─────────────────────────
    // Fetches GHL directly — catches duplicates even across browser sessions
    if (title.startsWith('[CS]')) {
      try {
        const existing = await ghl('GET', `${V2}/contacts/${id}/tasks`);
        const openCS = (existing.tasks || []).find(t =>
          t.title && t.title.startsWith('[CS]') && !t.completed
        );
        if (openCS) {
          console.log(`⚠ Duplicate CS task blocked for contact ${id}: "${openCS.title}"`);
          return res.status(409).json({
            error: 'DUPLICATE',
            message: 'Contact already has an open CS task',
            existingTask: { ...openCS, contactId: id },
          });
        }
      } catch(dupErr) {
        // Non-fatal — if duplicate check fails, allow creation to proceed
        console.log('Duplicate check skipped:', dupErr.message);
      }
    }

    const payload = {
      title,
      body:       body || '',
      assignedTo: assignedTo || undefined,
      dueDate:    dueDate || new Date(Date.now()+86400000).toISOString(),
      completed:  false,
    };
    const data = await ghl('POST', `${V2}/contacts/${id}/tasks`, payload);
    tasksBoardCache = { data: null, ts: 0 };
    console.log(`✓ Task created for contact ${id}`);
    res.json({ success: true, task: data });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Debug tasks API
app.get('/api/debug/tasks', async (req, res) => {
  const results = {};
  try {
    // Get a contact that we know has tasks (Shucayb's contacts)
    const od = await ghl('GET', `${V2}/opportunities/search?location_id=${LOC_ID}&limit=5&page=1`);
    const sampleContactId = od.opportunities?.[0]?.contactId || od.opportunities?.[0]?.contact?.id;
    results.sampleContactId = sampleContactId;
    if (sampleContactId) {
      const td = await ghl('GET', `${V2}/contacts/${sampleContactId}/tasks`);
      results.contact_tasks = td;
    }
    // Also show full opp structure to see all fields
    results.sample_opp_fields = Object.keys(od.opportunities?.[0] || {});
    results.sample_opp = od.opportunities?.[0];
  } catch(e) { results.error = e.message; }
  res.json(results);
});


// ── Get notes for a contact (used by NY Permit task detail) ──────────────────
// ── Raw vehicle debug — see exactly what GHL returns for a contact's vehicles ──
app.get('/api/debug/vehicles/:id', async (req, res) => {
  const contactId = req.params.id;
  const results = { schemaKey: null };
  const schemaKey = await getVehicleSchemaKey() || 'custom_objects.vehicles';
  results.schemaKey = schemaKey;

  // Try search with different field names to find the right one
  for (const fieldName of ['contact', 'contact_id', 'contactId', 'owner', 'associations.contact']) {
    try {
      const r = await ghl('POST', `${V2}/objects/${schemaKey}/records/search`, {
        locationId: LOC_ID, page: 1, pageLimit: 3,
        filters: [{ field: fieldName, operator: 'eq', value: contactId }],
      });
      results[`field_${fieldName}`] = { count: (r?.records||r?.data||[]).length, sample: (r?.records||r?.data||[])[0] || null };
    } catch(e) { results[`field_${fieldName}`] = { error: e.message }; }
  }

  // Fetch a few records with no filter to see their structure
  try {
    const r = await ghl('POST', `${V2}/objects/${schemaKey}/records/search`, {
      locationId: LOC_ID, page: 1, pageLimit: 2,
    });
    const recs = r?.records || r?.data || [];
    results.recordStructure = recs.map(rec => ({
      id: rec.id,
      topLevelKeys: Object.keys(rec),
      properties: rec.properties ? Object.keys(rec.properties) : [],
      relations: rec.relations,
      owners: rec.owners,
      followers: rec.followers,
    }));
  } catch(e) { results.recordStructure = { error: e.message }; }

  // Try associations endpoint variations
  for (const [label, path] of [
    ['assoc_v2', `${V2}/contacts/${contactId}/associations`],
    ['assoc_typed', `${V2}/contacts/${contactId}/associations/${schemaKey}`],
    ['assoc_api', `/associations?contactId=${contactId}&locationId=${LOC_ID}`],
  ]) {
    try {
      results[label] = await ghl('GET', path);
    } catch(e) { results[label] = { error: e.message }; }
  }

  res.json(results);
});

app.get('/api/contacts/:id/notes', async (req, res) => {
  try {
    const data = await ghl('GET', `${V2}/contacts/${req.params.id}/notes/`);
    // GHL may return notes under different keys
    const notes = data.notes || data.data || data.list || data.results || [];
    console.log(`Notes for contact ${req.params.id}: ${notes.length} notes`);
    if (notes.length > 0) console.log('Note fields:', Object.keys(notes[0]));
    res.json({ notes });
  } catch(err) {
    console.error('Notes fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── Update a task (title, dueDate, body, assignedTo) ─────────────────────────
app.put('/api/contacts/:contactId/tasks/:taskId', async (req, res) => {
  const { contactId, taskId } = req.params;
  const { title, body, dueDate, assignedTo, completed } = req.body;
  try {
    // Fetch current task to merge fields — GHL requires title + dueDate in all updates
    let current = {};
    try {
      const td = await ghl('GET', `${V2}/contacts/${contactId}/tasks/${taskId}`);
      current = td.task || td || {};
    } catch(e) { console.log('Could not pre-fetch task for update:', e.message); }

    // Build payload merging current fields with requested changes
    const payload = {
      title:      title      !== undefined ? title      : (current.title || 'CS Task'),
      body:       body       !== undefined ? body       : (current.body || current.description || ''),
      dueDate:    dueDate    !== undefined ? dueDate    : (current.dueDate || new Date(Date.now()+86400000).toISOString()),
      assignedTo: assignedTo !== undefined ? assignedTo : (current.assignedTo || undefined),
    };
    if (completed !== undefined) payload.completed = completed;

    const data = await ghl('PUT', `${V2}/contacts/${contactId}/tasks/${taskId}`, payload);
    tasksBoardCache = { data: null, ts: 0 };
    res.json({ success: true, task: data });
  } catch(err) {
    console.error('Task update error:', err.message, err.data || '');
    res.status(500).json({ error: err.data?.message || err.message });
  }
});


// ── Permit login info from GHL custom fields ──────────────────────────────────
let customFieldsSchemaCache = null;
let customFieldsSchemaTTL  = 0;

async function getCustomFieldsSchema() {
  const now = Date.now();
  if (customFieldsSchemaCache && now - customFieldsSchemaTTL < 60 * 60 * 1000) {
    return customFieldsSchemaCache;
  }
  try {
    const data = await ghl('GET', `${V2}/locations/${LOC_ID}/customFields`);
    customFieldsSchemaCache = (data.customFields || []).reduce((acc, f) => {
      acc[f.id] = f.name || f.label || '';
      return acc;
    }, {});
    customFieldsSchemaTTL = now;
    return customFieldsSchemaCache;
  } catch(e) {
    console.error('Custom fields schema fetch failed:', e.message);
    return {};
  }
}

app.get('/api/contacts/:id/permit-info', async (req, res) => {
  try {
    const [contactData, schema] = await Promise.all([
      ghl('GET', `${V2}/contacts/${req.params.id}`),
      getCustomFieldsSchema(),
    ]);
    const contact = contactData.contact || contactData;
    const cf = contact.customFields || [];

    // Build label→value map (case-insensitive label matching)
    const fields = {};
    cf.forEach(f => {
      const label = (schema[f.id] || '').toLowerCase().trim();
      const val   = f.value || f.fieldValue || '';
      if (val) fields[label] = val;
    });

    // Extract permit sections by label keywords
    const findField = (...keywords) => {
      for (const kw of keywords) {
        const match = Object.entries(fields).find(([k]) => k.includes(kw.toLowerCase()));
        if (match) return match[1];
      }
      return null;
    };

    const parseCredBlock = (text) => {
      if (!text) return null;
      const clean = String(text).replace(/<[^>]+>/g, ' ');
      const dotM  = clean.match(/DOT#?\s*[:\-]?\s*(\d+)/i);
      const einM  = clean.match(/EIN#?\s*[:\-]?\s*(\d+)/i);
      const pinM  = clean.match(/Password\s*(?:PIN|PIN#?)?\s*[:\-]?\s*(\S+)/i);
      const userM = clean.match(/Username\s*[:\-]?\s*(\S+)/i);
      const passM = clean.match(/Password\s*[:\-]?\s*(\S+)/i);
      const typeM = clean.match(/Account\s*Type\s*[-:]\s*(.+)/i);
      const emailM= clean.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      return {
        raw:      clean,
        dot:      dotM?.[1]  || null,
        ein:      einM?.[1]  || null,
        pin:      pinM?.[1]  || null,
        username: userM?.[1] || null,
        password: passM?.[1] || null,
        type:     typeM?.[1]?.trim() || null,
        email:    emailM?.[1] || null,
      };
    };

    res.json({
      nyPermit:  parseCredBlock(findField('ny permit login', 'ny permit')),
      nyFiling:  parseCredBlock(findField('ny filing login', 'ny filing')),
      nmPermit:  parseCredBlock(findField('nm permit login', 'nm permit')),
      ctPermit:  parseCredBlock(findField('ct permit login', 'ct permit')),
      kyuLogin:  parseCredBlock(findField('kyu login', 'kyu account')),
      allFields: fields, // raw for debugging
    });
  } catch(err) {
    console.error('permit-info error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ── Fetch vehicles associated with a contact ──────────────────────────────────
let vehicleSchemaKey = null; // cached object key

async function getVehicleSchemaKey() {
  if (vehicleSchemaKey) return vehicleSchemaKey;
  try {
    // Fetch all custom object schemas for this location
    const data = await ghl('GET', `${V2}/objects/?locationId=${LOC_ID}`);
    const objects = data.customObjects || data.objects || [];
    // Find vehicle/tractor object
    const vehicleObj = objects.find(o =>
      /vehicle|tractor|truck/i.test(o.key || '') ||
      /vehicle|tractor|truck/i.test(o.name || o.label || '')
    );
    vehicleSchemaKey = vehicleObj?.key || null;
    if (vehicleSchemaKey) console.log('Vehicle schema key found:', vehicleSchemaKey);
    return vehicleSchemaKey;
  } catch(e) {
    console.error('Vehicle schema fetch error:', e.message);
    return null;
  }
}

app.get('/api/contacts/:id/vehicles', async (req, res) => {
  const contactId = req.params.id;

  // Normalize a vehicle record using the confirmed GHL field names from debug
  function normalizeVehicle(v, source) {
    const p = v.properties || {};
    const rel = v.relations || [];
    // Check if this vehicle is related to the contact
    const isRelated = rel.some(r => r.id === contactId || r.value === contactId);
    return {
      id:         v.id || v.recordId || null,
      vin:        p['vin_'] || p['vin'] || null,
      make:       p['make'] || null,
      model:      p['model'] || p['model_year'] || null,
      year:       p['model_year'] || null,
      plate:      p['license_plate'] || null,
      unit:       p['unit_'] || p['unit'] || null,
      state:      p['state'] || null,
      type:       p['vehicle_type'] || null,
      status:     p['status'] || null,
      owner:      p['registration_info.owner'] || null,
      source,
      _isRelated: isRelated,
    };
  }

  try {
    const schemaKey = await getVehicleSchemaKey() || 'custom_objects.vehicles';
    let vehicles = [];

    // Fetch vehicle records page by page, filter by relations.recordId === contactId
    let page = 1;
    while (page <= 20) {
      const body = { locationId: LOC_ID, page, pageLimit: 100 };

      const r = await ghl('POST', `${V2}/objects/${schemaKey}/records/search`, body);
      const recs = r?.records || r?.data || [];
      if (!recs.length) break;

      // Log first page to diagnose matching
      if (page === 1) {
        console.log(`Vehicle search: contactId="${contactId}", total records page1=${recs.length}`);
        if (recs[0]) console.log(`First record relations:`, JSON.stringify(recs[0].relations));
      }

      const matched = recs.filter(rec =>
        (rec.relations || []).some(rel => rel.recordId === contactId)
      );
      vehicles.push(...matched.map(v => normalizeVehicle(v, 'relations')));

      if (recs.length < 100) break; // last page
      page++;
    }

    const normalized = vehicles.filter(v => v.vin || v.unit || v.plate);
    console.log(`Vehicles for ${contactId}: ${normalized.length} found across ${page} pages`);
    res.json({ vehicles: normalized, pages_searched: page });
  } catch(err) {
    console.error('Vehicles fetch error:', err.message);
    res.status(500).json({ error: err.message, vehicles: [] });
  }
});


// ── Vehicle CRUD ──────────────────────────────────────────────────────────────
// Helper: map our field names → GHL custom object field keys
function buildVehicleProperties(data) {
  // These keys match GHL's custom object field schema — adjust if needed
  const props = {};
  if (data.vin    !== undefined) props.vin_number   = data.vin;
  if (data.unit   !== undefined) props.unit_number  = data.unit;
  if (data.status !== undefined) props.status       = data.status;
  if (data.type   !== undefined) props.vehicle_type = data.type;
  if (data.make   !== undefined) props.make         = data.make;
  if (data.model  !== undefined) props.model        = data.model;
  if (data.year   !== undefined) props.year         = String(data.year);
  if (data.plate  !== undefined) props.plate_number = data.plate;
  if (data.state  !== undefined) props.state        = data.state;
  return props;
}

// Create vehicle record in GHL
app.post('/api/contacts/:contactId/vehicles', async (req, res) => {
  const { contactId } = req.params;
  try {
    const schemaKey = await getVehicleSchemaKey() || 'vehicles';
    const props = buildVehicleProperties(req.body);

    const payload = {
      locationId:  LOC_ID,
      properties:  props,
      // Associate with contact
      associations: [{ objectType: 'contact', id: contactId }],
    };

    const data = await ghl('POST', `${V2}/objects/${schemaKey}/records`, payload);
    console.log(`✓ Vehicle created for contact ${contactId}`);
    res.json({ success: true, record: data });
  } catch(err) {
    console.error('Vehicle create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update vehicle record in GHL
app.put('/api/vehicles/:recordId', async (req, res) => {
  const { recordId } = req.params;
  try {
    const schemaKey = await getVehicleSchemaKey() || 'vehicles';
    const props = buildVehicleProperties(req.body);

    const data = await ghl('PUT', `${V2}/objects/${schemaKey}/records/${recordId}`, {
      properties: props,
    });
    console.log(`✓ Vehicle ${recordId} updated`);
    res.json({ success: true, record: data });
  } catch(err) {
    console.error('Vehicle update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Driver Manager ────────────────────────────────────────────────────────────
let driverSchemaKey = null;

async function getDriverSchemaKey() {
  if (driverSchemaKey) return driverSchemaKey;
  try {
    const data = await ghl('GET', `${V2}/objects/?locationId=${LOC_ID}`);
    const objects = data.customObjects || data.objects || [];
    const driverObj = objects.find(o =>
      /driver/i.test(o.key || '') ||
      /driver/i.test(o.name || o.label || '')
    );
    driverSchemaKey = driverObj?.key || null;
    if (driverSchemaKey) console.log('Driver schema key found:', driverSchemaKey);
    return driverSchemaKey;
  } catch(e) {
    console.error('Driver schema fetch error:', e.message);
    return null;
  }
}

// GET all drivers for a contact (via relations.recordId)
app.get('/api/contacts/:id/drivers', async (req, res) => {
  const contactId = req.params.id;
  function normalizeDriver(v) {
    const p = v.properties || {};
    return {
      id:         v.id || v.recordId || null,
      license:    p['driver_license'] || p['license'] || p['license_number'] || null,
      fullName:   p['full_name'] || p['name'] || p['driver_name'] || null,
      dob:        p['dob'] || p['date_of_birth'] || p['dateOfBirth'] || null,
      cdlExp:     p['cdl_exp'] || p['cdl_expiration'] || p['cdl_expiry'] || p['cdl_exp_date'] || null,
      cdlUpload:  p['cdl_upload'] || p['cdl_file'] || null,
    };
  }
  try {
    const schemaKey = await getDriverSchemaKey();
    if (!schemaKey) return res.json({ vehicles: [], drivers: [], error: 'Driver schema not found' });
    let drivers = [];
    let page = 1;
    while (page <= 20) {
      const r = await ghl('POST', `${V2}/objects/${schemaKey}/records/search`, {
        locationId: LOC_ID, page, pageLimit: 100,
      });
      const recs = r?.records || r?.data || [];
      if (!recs.length) break;
      if (page === 1) {
        console.log(`Driver search: contactId="${contactId}", page1 count=${recs.length}`);
        if (recs[0]) console.log('Driver sample properties:', Object.keys(recs[0].properties || {}));
      }
      const matched = recs.filter(rec =>
        (rec.relations || []).some(rel => rel.recordId === contactId)
      );
      drivers.push(...matched.map(v => normalizeDriver(v)));
      if (recs.length < 100) break;
      page++;
    }
    console.log(`Drivers for ${contactId}: ${drivers.length}`);
    res.json({ drivers });
  } catch(err) {
    console.error('Drivers fetch error:', err.message);
    res.status(500).json({ error: err.message, drivers: [] });
  }
});

// POST create driver record
app.post('/api/contacts/:contactId/drivers', async (req, res) => {
  const { contactId } = req.params;
  try {
    const schemaKey = await getDriverSchemaKey();
    if (!schemaKey) throw new Error('Driver schema not found');
    const d = req.body;
    const props = {};
    if (d.license)  props.driver_license = d.license;
    if (d.fullName) props.full_name      = d.fullName;
    if (d.dob)      props.dob            = d.dob;
    if (d.cdlExp)   props.cdl_exp        = d.cdlExp;
    const payload = {
      locationId:   LOC_ID,
      properties:   props,
      associations: [{ objectType: 'contact', id: contactId }],
    };
    const data = await ghl('POST', `${V2}/objects/${schemaKey}/records`, payload);
    console.log(`✓ Driver created for contact ${contactId}`);
    res.json({ success: true, record: data });
  } catch(err) {
    console.error('Driver create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT update driver record
app.put('/api/drivers/:recordId', async (req, res) => {
  const { recordId } = req.params;
  try {
    const schemaKey = await getDriverSchemaKey();
    if (!schemaKey) throw new Error('Driver schema not found');
    const d = req.body;
    const props = {};
    if (d.license  !== undefined) props.driver_license = d.license;
    if (d.fullName !== undefined) props.full_name      = d.fullName;
    if (d.dob      !== undefined) props.dob            = d.dob;
    if (d.cdlExp   !== undefined) props.cdl_exp        = d.cdlExp;
    const data = await ghl('PUT', `${V2}/objects/${schemaKey}/records/${recordId}`, { properties: props });
    console.log(`✓ Driver ${recordId} updated`);
    res.json({ success: true, record: data });
  } catch(err) {
    console.error('Driver update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Debug: expose raw driver record structure
app.get('/api/debug/drivers/:id', async (req, res) => {
  const contactId = req.params.id;
  const schemaKey = await getDriverSchemaKey();
  const result = { schemaKey };
  try {
    const r = await ghl('POST', `${V2}/objects/${schemaKey}/records/search`, {
      locationId: LOC_ID, page: 1, pageLimit: 3,
    });
    const recs = r?.records || r?.data || [];
    result.sample = recs.map(rec => ({
      id: rec.id,
      properties: Object.keys(rec.properties || {}),
      propertyValues: rec.properties,
      relations: rec.relations,
    }));
  } catch(e) { result.error = e.message; }
  res.json(result);
});

// ── Swimlane: update opp stage ────────────────────────────────────────────────
app.put('/api/opps/:oppId/stage', async (req, res) => {
  const { oppId } = req.params;
  const { stageName, pipelineId } = req.body;
  try {
    // Find stage ID from pipelineCache
    const pipelineName = Object.keys(pipelineCache).find(k => pipelineCache[k].id === pipelineId);
    const stages = pipelineName ? pipelineCache[pipelineName].stages : {};
    // Try exact match then case-insensitive
    const stageId = stages[stageName] ||
      Object.entries(stages).find(([k]) => k.toLowerCase() === stageName.toLowerCase())?.[1];
    if (!stageId) {
      console.log(`Stage "${stageName}" not found in pipeline. Available:`, Object.keys(stages));
      return res.status(404).json({ error: `Stage "${stageName}" not found` });
    }
    const wonStatus = /complet|won|filed/i.test(stageName) ? 'won' : undefined;
    await ghl('PUT', `${V2}/opportunities/${oppId}`, {
      pipelineStageId: stageId,
      ...(wonStatus ? { status: wonStatus } : {}),
    });
    tasksBoardCache = { data: null, ts: 0 };
    console.log(`✓ Opp ${oppId} moved to stage "${stageName}"`);
    res.json({ success: true });
  } catch(err) {
    console.error('Stage update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Swimlane: add tag/label to opp ────────────────────────────────────────────
app.post('/api/opps/:oppId/tags', async (req, res) => {
  const { oppId } = req.params;
  const { tag } = req.body;
  try {
    // Step 1: Get current opp to find existing tags and pipelineId
    const oppRes = await ghl('GET', `${V2}/opportunities/${oppId}`);
    const oppData = oppRes?.opportunity || oppRes || {};
    const existing = oppData.tags || [];
    const newTags  = [...new Set([...existing, tag])];

    console.log(`Adding tag "${tag}" to opp ${oppId}. Existing: [${existing.join(', ')}] → New: [${newTags.join(', ')}]`);

    // Step 2: GHL opportunity update — tags go as top-level array
    // Some GHL versions use PATCH, some PUT — try PUT with full payload
    const updateRes = await ghl('PUT', `${V2}/opportunities/${oppId}`, {
      name:            oppData.name,
      pipelineId:      oppData.pipelineId,
      pipelineStageId: oppData.pipelineStageId,
      status:          oppData.status || 'open',
      monetaryValue:   oppData.monetaryValue || 0,
      tags:            newTags,
    });

    console.log(`✓ Tag update response:`, JSON.stringify(updateRes).slice(0, 200));
    tasksBoardCache = { data: null, ts: 0 };
    res.json({ success: true, tags: newTags });
  } catch(err) {
    console.error('Tag add error:', err.message, err.data ? JSON.stringify(err.data).slice(0,300) : '');
    res.status(500).json({ error: err.message });
  }
});

// ── Check missing opps for a contact by year ──────────────────────────────────
app.get('/api/contacts/:contactId/missing-opps', async (req, res) => {
  const { contactId } = req.params;
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const data     = await ghl('GET', `${V2}/contacts/${contactId}/opportunities`);
    const existing = (data?.opportunities || []).map(o => o.pipelineId);

    // Build year-specific service list using the same name patterns as the frontend
    const yearServices = [
      { key:'annual_2290',          name: `1. ${year} 2290 Form Filing (06-30-${String(year).slice(2)})` },
      { key:'annual_ucr',           name: `2. ${year} UCR Filing` },
      { key:'annual_ifta_license',  name: `3. ${year} IFTA License Renewal` },
      { key:'annual_business',      name: `4. ${year} Business Name Renewal` },
      { key:'annual_clearinghouse', name: `5. ${year} Clearinghouse Driver Annual Query` },
      { key:'annual_nm_permit',     name: `6. ${year} NM Permit Renewal` },
      { key:'annual_irp_cab_card',  name: `7. ${year} IRP Cab Card (Plate) Renewal` },
      { key:'annual_mcs150',        name: `8. ${year} MCS-150 Mileage Update for ${year-1}` },
      { key:'annual_ky_vehicle',    name: `9. ${year} KY Annual Vehicle Update` },
      { key:'ifta_q1',              name: `Q1 ${year} IFTA Filing` },
      { key:'ifta_q2',              name: `Q2 ${year} IFTA Filing` },
      { key:'ifta_q3',              name: `Q3 ${year} IFTA Filing` },
      { key:'ifta_q4',              name: `Q4 ${year} IFTA Filing` },
    ];

    const missing = [], present = [];
    for (const svc of yearServices) {
      // Try exact match first, then fuzzy match on year + key words
      let pipeline = pipelineCache[svc.name];
      if (!pipeline) {
        const yearStr  = String(year);
        const keyWords = svc.name.toLowerCase().replace(/^\d+\.\s*/,'').replace(yearStr,'').trim().split(/\s+/).filter(w=>w.length>3);
        const fuzzyKey = Object.keys(pipelineCache).find(k => {
          const kl = k.toLowerCase();
          return kl.includes(yearStr) && keyWords.every(w => kl.includes(w));
        });
        if (fuzzyKey) pipeline = pipelineCache[fuzzyKey];
      }
      if (!pipeline) {
        missing.push({ key: svc.key, name: svc.name, pipelineId: null, notInGHL: true });
        continue;
      }
      if (existing.includes(pipeline.id)) {
        present.push({ key: svc.key, name: svc.name });
      } else {
        missing.push({ key: `pipeline_id:${pipeline.id}`, name: svc.name, pipelineId: pipeline.id });
      }
    }
    res.json({ missing, present, year, total: yearServices.length });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Add specific opps to a contact ─────────────────────────────────────────────
app.post('/api/contacts/:contactId/add-opps', async (req, res) => {
  const { contactId } = req.params;
  const { serviceKeys, contactName } = req.body;
  const results = { created: [], failed: [] };

  // Get contact name if not provided
  let oppName = contactName;
  if (!oppName) {
    try {
      const c = await ghl('GET', `${V2}/contacts/${contactId}`);
      oppName = c?.contact?.companyName || c?.contact?.firstName || 'Unknown';
    } catch(e) { oppName = 'Unknown'; }
  }
  // Strip DOT# from opp name
  oppName = oppName.replace(/\s+DOT#?\s*\d+/i,'').trim();

  for (const key of (serviceKeys || [])) {
    try {
      let pipelineId, stageId, pipelineName;
      if (key.startsWith('pipeline_id:')) {
        // Dynamic: raw pipeline ID passed from frontend
        pipelineId = key.replace('pipeline_id:','');
        const found = Object.entries(pipelineCache).find(([,p]) => p.id === pipelineId);
        stageId      = found ? Object.values(found[1].stages)[0] : null;
        pipelineName = found ? found[0] : pipelineId;
      } else {
        const pipeline = pipelineCache[PIPELINE_MAP[key]?.name];
        if (!pipeline) { results.failed.push({ key, reason: 'Pipeline not found' }); continue; }
        pipelineId   = pipeline.id;
        stageId      = Object.values(pipeline.stages)[0];
        pipelineName = PIPELINE_MAP[key]?.name || key;
      }
      if (!stageId) { results.failed.push({ key, reason: 'No stage found' }); continue; }
      const r = await ghl('POST', `${V2}/opportunities/`, {
        name: oppName, pipelineId, pipelineStageId: stageId,
        status: 'open', contactId, monetaryValue: 0, locationId: LOC_ID,
      });
      if (r?.opportunity?.id || r?.id) {
        results.created.push({ key, name: pipelineName });
      } else {
        results.failed.push({ key, reason: 'No ID returned' });
      }
    } catch(e) {
      results.failed.push({ key, reason: e.message });
    }
  }

  tasksBoardCache = { data: null, ts: 0 };
  clientCache.data = null;
  console.log(`Add opps for ${contactId}: created=${results.created.length} failed=${results.failed.length}`);
  res.json(results);
});

// ── Bulk add opps to multiple contacts ────────────────────────────────────────
app.post('/api/bulk-add-opps', async (req, res) => {
  const { contactIds, serviceKeys } = req.body;
  if (!contactIds?.length || !serviceKeys?.length) {
    return res.status(400).json({ error: 'contactIds and serviceKeys required' });
  }

  const results = { contacts: [] };
  for (const contactId of contactIds) {
    const contactResult = { contactId, created: [], failed: [] };
    let oppName = 'Unknown';
    try {
      const c = await ghl('GET', `${V2}/contacts/${contactId}`);
      oppName = (c?.contact?.companyName || c?.contact?.firstName || 'Unknown')
        .replace(/\s+DOT#?\s*\d+/i,'').trim();
    } catch(e) {}

    for (const key of serviceKeys) {
      try {
        const pipeline = pipelineCache[PIPELINE_MAP[key]?.name];
        if (!pipeline) { contactResult.failed.push(key); continue; }
        const stageId = Object.values(pipeline.stages)[0];
        await ghl('POST', `${V2}/opportunities/`, {
          name: oppName, pipelineId: pipeline.id,
          pipelineStageId: stageId, status: 'open',
          contactId, monetaryValue: 0, locationId: LOC_ID,
        });
        contactResult.created.push(key);
      } catch(e) { contactResult.failed.push(key); }
    }
    results.contacts.push(contactResult);
    // Small delay to avoid GHL rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  tasksBoardCache = { data: null, ts: 0 };
  clientCache.data = null;
  res.json(results);
});

// ── Bulk create tasks for multiple contacts ───────────────────────────────────
app.post('/api/bulk-add-tasks', async (req, res) => {
  const { contactIds, title, body, dueDate, assignedTo } = req.body;
  if (!contactIds?.length || !title) {
    return res.status(400).json({ error: 'contactIds and title required' });
  }
  const results = { created: [], failed: [] };
  for (const contactId of contactIds) {
    try {
      const payload = {
        title,
        body:       body || '',
        dueDate:    dueDate ? new Date(dueDate).toISOString() : undefined,
        assignedTo: assignedTo || undefined,
        completed:  false,
        contactId,
        locationId: LOC_ID,
      };
      await ghl('POST', `${V2}/contacts/${contactId}/tasks`, payload);
      results.created.push(contactId);
    } catch(e) {
      console.error(`Task create failed for ${contactId}:`, e.message);
      results.failed.push({ contactId, error: e.message });
    }
    await new Promise(r => setTimeout(r, 100));
  }
  tasksBoardCache = { data: null, ts: 0 };
  console.log(`Bulk tasks: created=${results.created.length} failed=${results.failed.length}`);
  res.json(results);
});

// ── List all pipelines (for dynamic opp manager) ──────────────────────────────
app.get('/api/pipelines', async (req, res) => {
  try {
    if (!Object.keys(pipelineCache).length) await loadPipelines();
    const pipelines = Object.entries(pipelineCache).map(([name, p]) => ({
      key:   name.toLowerCase().replace(/[^a-z0-9]+/g,'_'),
      name,
      id:    p.id,
      stages: Object.keys(p.stages),
    })).sort((a,b) => a.name.localeCompare(b.name));
    res.json({ pipelines });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update contact name only ───────────────────────────────────────────────────
app.post('/api/contacts/:contactId/update-name', async (req, res) => {
  const { contactId } = req.params;
  const { firstName, lastName } = req.body;
  if (!firstName && !lastName) return res.status(400).json({ error: 'First or last name required' });
  try {
    await ghl('PUT', `${V2}/contacts/${contactId}`, {
      ...(firstName ? { firstName } : {}),
      ...(lastName  ? { lastName  } : {}),
    });
    clientCache.data = null;
    console.log(`✓ Name updated for contact ${contactId}: ${firstName} ${lastName}`);
    res.json({ success: true });
  } catch(err) {
    console.error('Name update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'../public/index.html')));

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPipelineInfo(key) {
  const e = PIPELINE_MAP[key];
  if (!e) return null;
  const c = pipelineCache[e.name];
  if (!c) return null;
  return { name: e.name, pipelineId: c.id, stages: c.stages };
}

// Known GHL custom field IDs for contact-level fields (verified from /api/debug/custom-fields)
const CF_IDS = {
  dot_number:      'E5MJr7vstJWSi59CxAbK',  // DOT# (NUMERICAL)
  ein:             'fr4t6AA1aM8dRhb7Pj3R',  // EIN# (TEXT)
  mc_number:       'twbBzamze4MVgetPLoSA',  // MC# (NUMERICAL)
  mcs150_year:     'kmBR6gFRCxd0ZPFEXGz7',  // MCS-150 Mileage (Year) ← CORRECT ID
  current_miles:   'jzsQ29O684sLc2i5YE3e',  // Current Miles (NUMERICAL)
  last_updated_yr: 'u9LKMEGxjlhZGsUuhSRE',  // Last Updated Year (NUMERICAL)
  prev_miles:      'Gb8VM9OKEvJgkG5kuIibB',  // Previous Miles (NUMERICAL)
  mailing_address: 'gmZAkRDtnsOhsiCYUrxp',  // Mailing Address (TEXT)
  op_status:       'Tx9uGn4hrVwJKv6EheCJ',  // Operating Status (SINGLE_OPTIONS)
  num_units:       'ZK43DBIa2Nwqt8Wr7Fw3',  // Number of Units (RADIO)
};

function getContactCF(cf, id) {
  const f = cf.find(f => f.id === id);
  if (!f) return null;
  return f.value ?? f.fieldValueNumber ?? f.fieldValueString ?? null;
}

function mapContact(contact, opps) {
  if (!contact) return null;
  const cells={}, oppIndex={};
  // Collect all opp-level tags across all pipelines for this contact
  const allOppTags = new Set();

  opps.forEach(opp => {
    const key = Object.keys(PIPELINE_MAP).find(k => {
      const c = pipelineCache[PIPELINE_MAP[k]?.name];
      return c && c.id === opp.pipelineId;
    });
    if (!key) return;
    const stage = opp.pipelineStage?.name || opp.stage?.name || '';
    let status = 'pending';
    if (opp.status==='won'||opp.status==='Won'||/won|complet|filing.completed/i.test(stage)) status='done';
    else if (opp.status==='lost'||opp.status==='abandoned') status='pending';
    else if (/progress|urgent|asap/i.test(stage)) status='urgent';

    // Collect opp tags (these are the colored tags like "Mileage Year Outdate")
    (opp.tags || []).forEach(t => { if (t) allOppTags.add(t); });

    // Also extract fieldValueArray tags from customFields (e.g. MCS-150 issue tags)
    (opp.customFields || []).forEach(cf => {
      if (cf.fieldValueArray) cf.fieldValueArray.forEach(v => { if (v) allOppTags.add(v); });
    });

    cells[key]    = status;
    oppIndex[key] = { id:opp.id, stage, status:opp.status, tags:opp.tags||[], customFields:opp.customFields||[] };
  });

  // Contact-level custom fields (v2 API returns {id, value} or {id, fieldValueNumber} etc)
  const cf = contact.customFields || contact.customField || [];
  const name = contact.companyName ||
    `${contact.firstName||''} ${contact.lastName||''}`.trim() || 'Unknown';

  // Detect MCS-150 urgency from:
  // 1. Opp tags containing "Mileage Year Outdated"
  // 2. Parsing the MCS-150 notes string for the mileage year
  const currentYear = new Date().getFullYear();
  let mcs150MileageYear = '';
  let mcs150Urgent = false;

  if (cells['filing_mcs150'] !== 'done') {
    // Check opp-level tags for mileage outdated flag
    if (allOppTags.has('Mileage Year Outdated')) {
      mcs150Urgent = true;
    }
    // Check the MCS-150 opportunity's custom field string for the mileage year
    const mcsOpp = opps.find(opp => {
      const key = Object.keys(PIPELINE_MAP).find(k => {
        const c = pipelineCache[PIPELINE_MAP[k]?.name];
        return c && c.id === opp.pipelineId && k === 'filing_mcs150';
      });
      return !!key;
    });
    if (mcsOpp) {
      const notesField = (mcsOpp.customFields||[]).find(f => f.id === 'p5w3zK561UlUMvXiruFT');
      if (notesField?.fieldValueString) {
        const match = notesField.fieldValueString.match(/Mileage \(Year\)[:\s]+[\d,]+\s*\((\d{4})\)/i)
          || notesField.fieldValueString.match(/Mileage.*?(\d{4})/i);
        if (match) {
          mcs150MileageYear = match[1];
          if ((currentYear - parseInt(match[1])) >= 2) mcs150Urgent = true;
        }
      }
    }
    // Also check contact-level custom fields for mileage year
    const contactMileage = getContactCF(cf, CF_IDS.mcs150_year);
    if (contactMileage) mcs150MileageYear = mcs150MileageYear || String(contactMileage);

    if (mcs150Urgent) cells['filing_mcs150'] = 'urgent';
  }

  return {
    id:              contact.id,
    name,
    business_name:   contact.companyName || '',
    initials:        name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
    dot_number:      String(getContactCF(cf, CF_IDS.dot_number) || ''),
    mc_number:       String(getContactCF(cf, CF_IDS.mc_number) || ''),
    ein:             String(getContactCF(cf, CF_IDS.ein) || ''),
    mailing_address: String(getContactCF(cf, CF_IDS.mailing_address) || ''),
    phone:           contact.phone || '',
    email:           contact.email || '',
    tags:            contact.tags  || [],
    oppTags:         [...allOppTags],
    mcs150MileageYear: mcs150MileageYear ? String(mcs150MileageYear) : '',
    cells,
    oppIndex,
  };
}

function buildCustomFields(serviceKey, data) {
  const f=[];
  if (serviceKey==='filing_mcs150') {
    if (data.mileage_year_outdated!==undefined) f.push({key:'asap_priority_mileage_year_outdated',field_value:String(data.mileage_year_outdated)});
    if (data.mcs150_form_date_outdated!==undefined) f.push({key:'asap_priority_mcs150_form_date_outdated',field_value:String(data.mcs150_form_date_outdated)});
    if (data.issues) f.push({key:'issues_updating_mcs_150',field_value:data.issues});
    if (data.notes)  f.push({key:'mcs_150_update_latest_notes',field_value:data.notes});
  }
  const nk={filing_ifta_license:'ifta_filing_notes',filing_2290:'2290_filing_notes',filing_ucr:'ucr_filing_notes',filing_irp_cab_card:'irp_cab_card_renewal',filing_clearinghouse:'clearinghouse_notes'};
  if (data.notes&&nk[serviceKey]) f.push({key:nk[serviceKey],field_value:data.notes});
  return f;
}


// ── Add / remove tag on a contact ─────────────────────────────────────────────
app.post('/api/contacts/:id/tags', async (req, res) => {
  const { id } = req.params;
  const { addTags = [], removeTags = [] } = req.body;
  try {
    // Fetch current tags
    const contact = await ghl('GET', `${V2}/contacts/${id}`);
    const current = contact?.contact?.tags || contact?.tags || [];
    const updated = [...new Set([
      ...current.filter(t => !removeTags.includes(t)),
      ...addTags,
    ])];
    const result = await ghl('PUT', `${V2}/contacts/${id}`, { tags: updated });
    clientCache.data = null; // bust so next load reflects new tag
    res.json({ success: true, tags: updated });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('\n🚛 ATS — Admin Truck Solutions Dashboard');
  console.log('─────────────────────────────────────────');
  console.log(`   API Key:  ${API_KEY?API_KEY.slice(0,20)+'...':'❌ NOT SET'}`);
  console.log(`   Location: ${LOC_ID||'❌ NOT SET'}`);
  console.log(`   API:      v2 LeadConnector (sub-account)\n`);

  await loadPipelines();

  // Pre-load in background — don't block server startup
  console.log('⚡ Pre-loading clients in background...');
  fetchAllClients().catch(e => console.log('⚠️  Pre-load failed:', e.message));

  app.listen(PORT, () => {
    console.log(`\n✅ Server ready on port ${PORT}`);

    // ── Startup cache warm-up ─────────────────────────────────────────────
    // Immediately begin building the tasks board cache in the background.
    // This mirrors how the Compliance Grid works — data is ready before the
    // first user arrives, so the Tasks Board loads instantly like the grid.
    console.log('🔄 Starting background cache warm-up...');
    Promise.all([
      // Warm contacts cache (used by Dashboard + Compliance Grid)
      fetchAllClients().catch(e => console.log('Contact warm-up error:', e.message)),
      // Warm tasks board cache (used by Tasks Board + CS Board) — starts 8s
      // after contacts to avoid competing for GHL rate limits
      new Promise(resolve => setTimeout(() => {
        buildTasksBoardData()
          .then(data => {
            tasksBoardCache = { data, ts: Date.now() };
            console.log(`✅ Tasks board cache warm — ${data.tasks?.length || 0} tasks, ${data.users?.length || 0} staff`);
          })
          .catch(e => console.log('Tasks warm-up error:', e.message))
          .finally(resolve);
      }, 8000)),
    ]);

    // ── Keep-alive ping — prevents Render free tier from spinning down ──────
    if (process.env.RENDER_EXTERNAL_URL) {
      const pingUrl = process.env.RENDER_EXTERNAL_URL + '/api/health';
      setInterval(() => {
        fetch(pingUrl).then(() => console.log('⚡ Keep-alive ping sent'))
                      .catch(e => console.log('Keep-alive ping failed:', e.message));
      }, 14 * 60 * 1000);
      console.log(`🔔 Keep-alive active → pinging ${pingUrl} every 14 min`);
    }
  });
})();

// ── Complete a CS task + add note to contact ──────────────────────────────────
app.post('/api/contacts/:contactId/tasks/:taskId/complete', async (req, res) => {
  const { contactId, taskId } = req.params;
  const { completedBy, taskTitle } = req.body;
  
  // Step 1: Fetch the current task so we can preserve its fields
  let currentTask = {};
  try {
    const td = await ghl('GET', `${V2}/contacts/${contactId}/tasks/${taskId}`);
    currentTask = td.task || td || {};
  } catch(e) { console.log('Could not fetch task for completion:', e.message); }

  // Step 2: Mark task complete — try multiple payload formats
  // GHL v2 is picky about which fields are required
  let completeErr = null;

  // Attempt A: full payload with all fetched fields
  const dueDate = currentTask.dueDate
    ? (currentTask.dueDate.includes('T') ? currentTask.dueDate : new Date(currentTask.dueDate).toISOString())
    : new Date(Date.now() + 86400000).toISOString();

  const payloads = [
    // Most complete — preserves all existing fields
    { title: currentTask.title || taskTitle || 'CS Task',
      body:  currentTask.body || currentTask.description || '',
      dueDate,
      assignedTo: currentTask.assignedTo || undefined,
      completed: true },
    // Minimal with status string (some GHL versions use this)
    { title: currentTask.title || taskTitle || 'CS Task',
      dueDate,
      completed: true,
      status: 'completed' },
    // Absolute minimum
    { completed: true },
  ];

  for (const payload of payloads) {
    try {
      await ghl('PUT', `${V2}/contacts/${contactId}/tasks/${taskId}`, payload);
      console.log(`✓ CS task ${taskId} marked complete`);
      completeErr = null;
      break;
    } catch(err) {
      console.log(`Task complete attempt failed: ${err.message} | GHL: ${JSON.stringify(err.data||'').slice(0,200)}`);
      completeErr = err;
    }
  }

  if (completeErr) {
    console.error('All complete attempts failed:', completeErr.message);
    const ghlDetail = completeErr.data?.message || completeErr.data?.msg || completeErr.message;
    return res.status(500).json({ error: ghlDetail });
  }

  // Step 3: Add note — best-effort, never blocks the response
  const noteText = `✓ CS Task Completed: "${taskTitle || currentTask.title}" — by ${completedBy || 'CS Staff'}`;
  ghl('POST', `${V2}/contacts/${contactId}/notes`, { body: noteText })
    .catch(e => console.log('Note post failed (non-critical):', e.message));

  // Step 4: Bust cache
  tasksBoardCache = { data: null, ts: 0 };
  res.json({ success: true });
});
