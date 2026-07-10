// AgriAdapt — All server API calls in one place

// ── Admin session ─────────────────────────────────────────────────────────────
export async function adminLogin(password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function adminLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
}

export async function adminStatus() {
  try {
    const res = await fetch('/api/admin/status');
    if (!res.ok) return false;
    return (await res.json()).admin === true;
  } catch { return false; }
}

export async function fetchFinance(baseWRSI, optWRSI, members, inputs) {
  const res = await fetch('/api/finance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseWRSI, optWRSI, members, inputs }),
  });
  if (!res.ok) throw new Error(`Finance API error: ${res.status}`);
  return res.json();
}

export async function fetchSpatialEngine(date) {
  const url = date ? `/api/spatial-engine?date=${date}` : '/api/spatial-engine';
  const res = await fetch(url);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error('Spatial Engine API error: ' + (err.error || res.status)); }
  return res.json();
}

export async function fetchSpectralData(date, bounds) {
  const res = await fetch(`/api/spectral-data?date=${date}&bounds=${JSON.stringify(bounds)}`);
  if (!res.ok) { const err = await res.json(); throw new Error('GEE Backend Error: ' + err.error); }
  return res.json();
}

export async function fetchMembers() {
  const res = await fetch('/api/members');
  if (!res.ok) return [];
  return res.json();
}

export async function postMember(member) {
  const res = await fetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member),
  });
  return res.ok;
}

export async function deleteMember(id) {
  const res = await fetch(`/api/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.ok;
}

export async function patchMember(id, updates) {
  const res = await fetch(`/api/members/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    let msg = `PATCH /api/members/${id} failed: ${res.status}`;
    try { const body = await res.json(); if (body?.error) msg += ` — ${body.error}`; } catch (e) {}
    throw new Error(msg);
  }
  return true;
}
