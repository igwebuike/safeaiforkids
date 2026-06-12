const API_BASE_URL = window.SAFEAIFORKIDS_API_URL || 'https://safeaiforkids-api.onrender.com';
const tokenInput = document.getElementById('adminToken');
const loginPanel = document.getElementById('loginPanel');
const dashboardPanel = document.getElementById('dashboardPanel');
const loginStatus = document.getElementById('loginStatus');
const dashboardStatus = document.getElementById('dashboardStatus');
const rowsEl = document.getElementById('waitlistRows');
const audienceFilter = document.getElementById('audienceFilter');
const countryFilter = document.getElementById('countryFilter');

let adminToken = localStorage.getItem('safeai_admin_token') || '';
if (adminToken) tokenInput.value = adminToken;

function setStatus(el, msg, error=false){ el.textContent = msg || ''; el.classList.toggle('danger', error); }
function authHeaders(){ return { Authorization: `Bearer ${adminToken}` }; }
function fmtDate(value){ return value ? new Date(value).toLocaleString() : ''; }
function fullName(row){ return [row.first_name, row.last_name].filter(Boolean).join(' ') || '—'; }

async function fetchJson(path){
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function loadDashboard(){
  setStatus(dashboardStatus, 'Loading waitlist...');
  const params = new URLSearchParams();
  if (audienceFilter.value) params.set('audience', audienceFilter.value);
  if (countryFilter.value.trim()) params.set('country', countryFilter.value.trim());
  const [stats, waitlist] = await Promise.all([
    fetchJson('/api/admin/stats'),
    fetchJson(`/api/admin/waitlist?${params.toString()}`)
  ]);

  document.getElementById('totalSignups').textContent = stats.total || 0;
  document.getElementById('last7Days').textContent = stats.last7Days || 0;
  document.getElementById('topAudience').textContent = stats.byAudience?.[0]?.audience || '-';
  document.getElementById('topCountry').textContent = stats.byCountry?.[0]?.country || '-';

  if (!waitlist.signups.length) {
    rowsEl.innerHTML = '<tr><td colspan="7" class="muted">No signups found for this filter.</td></tr>';
  } else {
    rowsEl.innerHTML = waitlist.signups.map(row => `
      <tr>
        <td>${fullName(row)}</td>
        <td>${row.email}</td>
        <td><span class="small-pill">${row.audience || '—'}</span></td>
        <td>${row.country || '—'}</td>
        <td>${row.source || '—'}</td>
        <td>${row.welcome_email_sent ? 'Sent' : 'Not sent'}</td>
        <td>${fmtDate(row.created_at)}</td>
      </tr>`).join('');
  }
  setStatus(dashboardStatus, `Loaded ${waitlist.count} signup(s).`);
}

async function login(){
  adminToken = tokenInput.value.trim();
  if (!adminToken) return setStatus(loginStatus, 'Enter your admin token.', true);
  try {
    localStorage.setItem('safeai_admin_token', adminToken);
    setStatus(loginStatus, 'Checking token...');
    await fetchJson('/api/admin/stats');
    loginPanel.style.display = 'none';
    dashboardPanel.style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'inline-flex';
    await loadDashboard();
  } catch (err) {
    setStatus(loginStatus, err.message || 'Could not open dashboard.', true);
  }
}

document.getElementById('loginBtn').addEventListener('click', login);
tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
document.getElementById('refreshBtn').addEventListener('click', loadDashboard);
document.getElementById('applyFiltersBtn').addEventListener('click', loadDashboard);
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('safeai_admin_token'); location.reload(); });
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
  const url = `${API_BASE_URL}/api/admin/waitlist.csv?token=${encodeURIComponent(adminToken)}`;
  window.open(url, '_blank');
});

if (adminToken) login();
