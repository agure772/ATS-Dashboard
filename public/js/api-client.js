// api-client.js — all calls go through the backend proxy

const API_BASE = window.location.hostname === 'localhost'
  ? `http://localhost:${window.location.port || 3001}/api`
  : '/api';

async function apiFetch(method, path, body = null) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

const GHL = {
  getContacts:       (q='')         => apiFetch('GET', `/contacts${q?`?query=${encodeURIComponent(q)}`:''}`),
  getContact:        (id)           => apiFetch('GET', `/contacts/${id}`),
  createContact:     (payload)      => apiFetch('POST', '/contacts', payload),
  createOpportunity: (contactId, serviceKey, contactName, businessName, dotNumber) =>
                                       apiFetch('POST', '/opportunities', { contactId, serviceKey, contactName, businessName, dotNumber }),
  updateOppStatus:   (id, status, serviceKey, notes='') =>
                                       apiFetch('PATCH', `/opportunities/${id}/status`, { status, serviceKey, notes }),
  updateOppFields:   (id, serviceKey, fields) =>
                                       apiFetch('PATCH', `/opportunities/${id}/fields`, { serviceKey, fields }),
  addOppNote:        (id, body)     => apiFetch('POST', `/opportunities/${id}/notes`, { body }),
  addTask:           (id, title, dueDate, desc) =>
                                       apiFetch('POST', `/contacts/${id}/tasks`, { title, dueDate, description: desc }),
  getPipelines:      ()             => apiFetch('GET', '/pipelines'),
  health:            ()             => apiFetch('GET', '/health'),
  refresh:           ()             => apiFetch('POST', '/refresh'),
};

window.GHL = GHL;
