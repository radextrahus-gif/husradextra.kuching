/* ============================================================
   SISTEM PERMOHONAN LAPORAN RADIOLOGI - HUS KUCHING
   Versi: 1.0.0 | Jabatan Radiologi Hospital Umum Sarawak
   ============================================================ */

'use strict';

// ============================================================
//  DATA: PENGGUNA SISTEM (ID & PASSWORD TETAP)
// ============================================================
const USERS = [
  {
    id: 'SADMIN001', password: 'SuperRad@2026', role: 'superadmin',
    name: 'Super Admin Radiologi HUS', unit: 'Jabatan Radiologi, Hospital Umum Sarawak',
    shortName: 'SA', facilityCode: 'HUS'
  },
  {
    id: 'ADMIN001', password: 'RadHUS@2026', role: 'admin',
    name: 'Admin Radiologi HUS', unit: 'Jabatan Radiologi, Hospital Umum Sarawak',
    shortName: 'ADM', facilityCode: 'HUS'
  },
  {
    id: 'KK001', password: 'Masjid@2026', role: 'user',
    name: 'KK Jalan Masjid', unit: 'Klinik Kesihatan Jalan Masjid',
    shortName: 'KKM', facilityCode: 'KK-MASJID'
  },
  {
    id: 'KK002', password: 'Petra@2026', role: 'user',
    name: 'KK Petra Jaya', unit: 'Klinik Kesihatan Petra Jaya',
    shortName: 'KKP', facilityCode: 'KK-PETRA'
  },
  {
    id: 'KK003', password: 'Puteh@2026', role: 'user',
    name: 'KK Tanah Puteh', unit: 'Klinik Kesihatan Tanah Puteh',
    shortName: 'KKT', facilityCode: 'KK-TPUTEH'
  },
  {
    id: 'KK004', password: 'Kawa@2026', role: 'user',
    name: 'KK Batu Kawa', unit: 'Klinik Kesihatan Batu Kawa',
    shortName: 'KKB', facilityCode: 'KK-BKAWA'
  },
  {
    id: 'KK005', password: 'Tabuan@2026', role: 'user',
    name: 'KK Tabuan', unit: 'Klinik Kesihatan Tabuan',
    shortName: 'KKU', facilityCode: 'KK-TABUAN'
  },
  {
    id: 'HSP001', password: 'Lundu@2026', role: 'user',
    name: 'Hospital Lundu', unit: 'Hospital Lundu',
    shortName: 'HLD', facilityCode: 'HSP-LUNDU'
  },
  {
    id: 'HSP002', password: 'Bau@2026', role: 'user',
    name: 'Hospital Bau', unit: 'Hospital Bau',
    shortName: 'HBU', facilityCode: 'HSP-BAU'
  },
  {
    id: 'RSAT001', password: 'Rsat@2026', role: 'user',
    name: 'RSAT', unit: 'Rumah Sakit Awam Tempatan (RSAT)',
    shortName: 'RST', facilityCode: 'RSAT'
  }
];

// ============================================================
//  STATE GLOBAL
// ============================================================
let currentUser = null;
let currentPage = 'dashboard';
let notifications = [];
let permohonanData = [];
let filteredData = [];
let currentPageNum = 1;
const PAGE_SIZE = 15;
let notifPanelOpen = false;
let liveInterval = null;
let pollInterval  = null;
let modalEditData = null;
let selectedIds = new Set(); // for delete selected (Super Admin only)

// ============================================================
//  STORAGE HELPERS
// ============================================================
function saveData() {
  localStorage.setItem('radiologi_permohonan', JSON.stringify(permohonanData));
  localStorage.setItem('radiologi_notif', JSON.stringify(notifications));
}
function loadData() {
  const p = localStorage.getItem('radiologi_permohonan');
  const n = localStorage.getItem('radiologi_notif');
  permohonanData = p ? JSON.parse(p) : getSampleData();
  notifications = n ? JSON.parse(n) : [];
  // Normalkan nama pesakit & doktor sedia ada kepada huruf besar
  permohonanData.forEach(r => {
    if (r.namaPesakit) r.namaPesakit = r.namaPesakit.toUpperCase();
    if (r.namaDokter)  r.namaDokter  = r.namaDokter.toUpperCase();
  });
  if (!p) saveData();
  mergeAdminPermohonan();
}

// Selaraskan permohonan yang dihantar oleh Admin ke dalam permohonanData supaya
// ia kelihatan di Dashboard, Semua Permohonan, Kemaskini Status, dan Live Polling.
function mergeAdminPermohonan() {
  const adminList = getAdminPermohonan();
  if (!adminList.length) return;
  adminList.forEach(ap => {
    // Normalkan nama kepada huruf besar
    if (ap.namaPesakit) ap.namaPesakit = ap.namaPesakit.toUpperCase();
    if (ap.namaDokter)  ap.namaDokter  = ap.namaDokter.toUpperCase();
    const idx = permohonanData.findIndex(p => p.id === ap.id);
    if (idx === -1) {
      permohonanData.push(ap);
    } else {
      permohonanData[idx] = ap;
    }
  });
  saveData();
}

// ============================================================
//  KATA LALUAN HELPERS — disimpan berasingan di localStorage
//  supaya setiap pengguna boleh mengubah kata laluan mereka sendiri
// ============================================================
function loadPasswords() {
  const stored = localStorage.getItem('radiologi_passwords');
  const passwords = stored ? JSON.parse(stored) : {};
  // Ensure all built-in users have a password entry (handles new users added to USERS array)
  let changed = false;
  USERS.forEach(u => {
    if (!passwords[u.id]) { passwords[u.id] = u.password; changed = true; }
  });
  if (changed || !stored) localStorage.setItem('radiologi_passwords', JSON.stringify(passwords));
  return passwords;
}
function savePassword(userId, newPwd) {
  const passwords = loadPasswords();
  passwords[userId] = newPwd;
  localStorage.setItem('radiologi_passwords', JSON.stringify(passwords));
}
function getPassword(userId) {
  return loadPasswords()[userId] || '';
}
function getSampleData() {
  const now = new Date();
  const f = (d) => d.toISOString();
  const d1 = new Date(now); d1.setDate(d1.getDate() - 2);
  const d2 = new Date(now); d2.setDate(d2.getDate() - 1);
  const d3 = new Date(now); d3.setHours(d3.getHours() - 3);
  // Contoh: rekod dengan pelbagai bilangan hari RIS untuk demonstrasi warna alert
  const d10 = new Date(now); d10.setDate(d10.getDate() - 10); // 10 hari lalu
  const d14 = new Date(now); d14.setDate(d14.getDate() - 14); // 14 hari lalu
  const d16 = new Date(now); d16.setDate(d16.getDate() - 16); // 16 hari lalu (> 15, papar "-")

  return [
    {
      id: generateId(), noRef: 'RAD-KK001-2026001',
      facilityCode: 'KK-MASJID', facilityName: 'KK Jalan Masjid',
      submittedBy: 'KK001', submittedAt: f(d1),
      noIC: '900101035678', namaPesakit: 'AHMAD BIN SULAIMAN',
      tarikh: '1990-01-01', jantina: 'Lelaki', noTelefon: '0123456789',
      jenisXray: 'Chest X-Ray (CXR)', bahagian: 'Thorax PA',
      tarikhXray: d1.toISOString().split('T')[0], indikasiKlinikal: 'Batuk kronik, demam',
      namaDokter: 'DR. MAZLAN BIN ALI',
      status: 'done', remark: 'Laporan disediakan. Tiada kelainan ketara.',
      updatedAt: f(d2), updatedBy: 'ADMIN001', adminRemark: 'Telah didaftar dan laporan siap.',
      noAccession: 'ACC-2026-001',
      tarikhDaftarRIS: d10.toISOString().split('T')[0]  // 10 hari — warna purple (alert)
    },
    {
      id: generateId(), noRef: 'RAD-KK002-2026002',
      facilityCode: 'KK-PETRA', facilityName: 'KK Petra Jaya',
      submittedBy: 'KK002', submittedAt: f(d2),
      noIC: '850515145892', namaPesakit: 'SITI NORZAHRA BT HAMID',
      tarikh: '1985-05-15', jantina: 'Perempuan', noTelefon: '0167891234',
      jenisXray: 'Lower Extremities X-Ray', bahagian: 'Knee AP/Lateral',
      tarikhXray: d2.toISOString().split('T')[0], indikasiKlinikal: 'Sakit lutut kanan, bengkak',
      namaDokter: 'DR. RASHIDAH BT OSMAN',
      status: 'registered', remark: '', updatedAt: f(d3),
      updatedBy: 'ADMIN001', adminRemark: 'Telah didaftar. Laporan sedang disediakan.',
      noAccession: 'ACC-2026-002',
      tarikhDaftarRIS: d14.toISOString().split('T')[0]  // 14 hari — warna merah (kritikal)
    },
    {
      id: generateId(), noRef: 'RAD-KK004-2026003',
      facilityCode: 'KK-BKAWA', facilityName: 'KK Batu Kawa',
      submittedBy: 'KK004', submittedAt: f(d3),
      noIC: '951220089076', namaPesakit: 'LIM WEI HAO',
      tarikh: '1995-12-20', jantina: 'Lelaki', noTelefon: '0193334455',
      jenisXray: 'Chest X-Ray (CXR)', bahagian: 'Thorax PA + Lateral',
      tarikhXray: d3.toISOString().split('T')[0], indikasiKlinikal: 'Sesak nafas',
      namaDokter: 'DR. TAN BOON HUAT',
      status: 'pending', remark: '', updatedAt: f(d3),
      updatedBy: '', adminRemark: '', noAccession: '',
      tarikhDaftarRIS: ''  // belum didaftar RIS
    },
    {
      id: generateId(), noRef: 'RAD-HSP001-2026004',
      facilityCode: 'HSP-LUNDU', facilityName: 'Hospital Lundu',
      submittedBy: 'HSP001', submittedAt: f(d3),
      noIC: '780320129012', namaPesakit: 'DAYANG FATIMAH BT AWANG',
      tarikh: '1978-03-20', jantina: 'Perempuan', noTelefon: '0112223344',
      jenisXray: 'Abdominal X-Ray', bahagian: 'Abdomen AP',
      tarikhXray: d3.toISOString().split('T')[0], indikasiKlinikal: 'Sakit perut akut',
      namaDokter: 'DR. HAFIZUDDIN BIN MUSA',
      status: 'pending', remark: '', updatedAt: f(d3),
      updatedBy: '', adminRemark: '', noAccession: '',
      tarikhDaftarRIS: d16.toISOString().split('T')[0]  // 16 hari — melebihi 15, papar "-"
    },
    {
      id: generateId(), noRef: 'RAD-KK005-2026005',
      facilityCode: 'KK-TABUAN', facilityName: 'KK Tabuan',
      submittedBy: 'KK005', submittedAt: f(now),
      noIC: '920810067890', namaPesakit: 'MOHD FIRDAUS BIN ZAINAL',
      tarikh: '1992-08-10', jantina: 'Lelaki', noTelefon: '0145678901',
      jenisXray: 'Chest X-Ray (CXR)', bahagian: 'Thorax PA',
      tarikhXray: now.toISOString().split('T')[0], indikasiKlinikal: 'Pemeriksaan rutin pra-operasi',
      namaDokter: 'DR. NURUL AIN BT HASSAN',
      status: 'pending', remark: '', updatedAt: f(now),
      updatedBy: '', adminRemark: '', noAccession: '',
      tarikhDaftarRIS: ''  // belum didaftar RIS
    }
  ];
}

function generateId() {
  return 'P' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}
function generateRefNo(facilityCode, userId) {
  // Gunakan counter berasingan supaya no. rujukan tidak berulang walaupun rekod dipadam
  const counterKey = 'radiologi_ref_counter';
  let counter = parseInt(localStorage.getItem(counterKey) || '0', 10) + 1;
  localStorage.setItem(counterKey, String(counter));
  return `RAD-${userId}-${new Date().getFullYear()}${String(counter).padStart(5, '0')}`;
}

// ============================================================
//  DATE / TIME HELPERS
// ============================================================
function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru sahaja';
  if (mins < 60) return `${mins} minit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

// ============================================================
//  VALIDATION HELPERS
// ============================================================

/**
 * Sahkan nombor telefon Malaysia.
 * Format diterima: 01x-xxxxxxxx atau 01xxxxxxxxx (10–11 digit, bermula 0)
 * Pulangkan true jika sah ATAU kosong (nombor telefon tidak wajib).
 */
function validatePhone(tel) {
  if (!tel) return true; // Tidak wajib
  const digits = tel.replace(/[\s\-]/g, '');
  return /^0[1-9]\d{7,9}$/.test(digits);
}

// ============================================================
//  TARIKH PERMOHONAN HELPERS
// ============================================================

/**
 * Hitung bilangan hari dari tarikhSubmit ke hari ini.
 * Pulangkan integer >= 0.
 */
function hitungHariPermohonan(submittedAt) {
  if (!submittedAt) return 0;
  const mula = new Date(submittedAt);
  mula.setHours(0, 0, 0, 0);
  const hari = new Date();
  hari.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hari - mula) / 86400000));
}

/**
 * Jana badge "Hari ke-X" dengan warna mengikut tempoh (maks 30 hari).
 * compact=true → badge ringkas untuk jadual
 */
function hariPermohonanBadge(submittedAt, compact = true) {
  const hari = hitungHariPermohonan(submittedAt);
  let bg, color, icon;
  if (hari === 0) {
    bg = '#dcfce7'; color = '#16a34a'; icon = '🟢';
  } else if (hari <= 7) {
    bg = '#dcfce7'; color = '#16a34a'; icon = '🟢';
  } else if (hari <= 14) {
    bg = '#fef9c3'; color = '#854d0e'; icon = '🟡';
  } else if (hari <= 21) {
    bg = '#ede9fe'; color = '#7c3aed'; icon = '🟣';
  } else if (hari <= 30) {
    bg = '#fee2e2'; color = '#dc2626'; icon = '🔴';
  } else {
    // Melebihi 30 hari — papar maksimum sahaja
    return compact
      ? `<span style="font-size:.7rem;background:#f1f5f9;color:var(--text-muted);padding:2px 7px;border-radius:10px;font-style:italic">— (>30 hari)</span>`
      : `<span style="font-size:.78rem;color:var(--text-muted);font-style:italic">Melebihi 30 hari</span>`;
  }
  const label = hari === 0 ? 'Hari ini' : `Hari ke-${hari}`;
  return compact
    ? `<span style="font-size:.7rem;background:${bg};color:${color};font-weight:600;padding:2px 7px;border-radius:10px">${icon} ${label}</span>`
    : `<span style="font-size:.82rem;background:${bg};color:${color};font-weight:700;padding:3px 10px;border-radius:10px">${icon} ${label}</span>`;
}

// ============================================================
//  RIS HELPERS — kiraan hari dari tarikh daftar RIS ke hari ini
//  Logik warna (hanya aktif jika status BUKAN 'done'):
//    Tiada tarikh          → "Belum Didaftar" (neutral)
//    Hari 1–8              → normal (hijau muda)
//    Hari 9–13             → PURPLE BOLD (amaran)
//    Hari 14–15            → MERAH BOLD (kritikal)
//    Hari > 15             → "-" sahaja (tamat tempoh paparan)
//  Jika status 'done'     → semua amaran TIDAK dipapar; gantikan
//                            dengan notis "Laporan Siap" sahaja.
// ============================================================

/**
 * Hitung bilangan hari dari tarikhDaftarRIS ke hari ini (calendar days).
 * Pulangkan integer >= 0, atau null jika tiada tarikh.
 */
function hitungHariRIS(tarikhDaftarRIS) {
  if (!tarikhDaftarRIS) return null;
  const mula = new Date(tarikhDaftarRIS);
  mula.setHours(0, 0, 0, 0);
  const hari = new Date();
  hari.setHours(0, 0, 0, 0);
  const diff = Math.floor((hari - mula) / 86400000);
  return diff >= 0 ? diff : 0;
}

/**
 * Hitung bilangan hari dari tarikhMohon (submittedAt) hingga tarikhSiap (updatedAt/hari ini).
 * Digunakan untuk papar "siap dalam X hari" apabila status = done.
 * Pulangkan integer >= 0.
 */
function hitungHariSiap(submittedAt, updatedAt) {
  const mula   = new Date(submittedAt);
  const tamat  = updatedAt ? new Date(updatedAt) : new Date();
  mula.setHours(0, 0, 0, 0);
  tamat.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((tamat - mula) / 86400000));
}

/**
 * Jana HTML paparan kiraan hari RIS dengan warna alert.
 * Apabila status = 'done', amaran TIDAK dipapar — gantikan dengan
 * notis hijau "Laporan Siap".
 * status   — nilai status rekod ('done', 'pending', dsb.)
 * submittedAt / updatedAt — untuk kiraan hari siap apabila done.
 */
function risHariHTML(tarikhDaftarRIS, compact = false, status = '', submittedAt = '', updatedAt = '') {
  // ---- STATUS DONE: sembunyikan semua amaran RIS ----
  if (status === 'done') {
    const hariSiap = hitungHariSiap(submittedAt, updatedAt);
    const label = hariSiap === 0 ? 'Hari yang sama' : `${hariSiap} hari`;
    return compact
      ? `<span style="font-size:.7rem;background:#d8f0e6;color:#145a32;font-weight:700;padding:2px 8px;border-radius:10px">✅ Siap</span>`
      : `<div style="margin-top:2px">
           <span style="color:#145a32;font-weight:700;font-size:.82rem">✅ Laporan Siap</span>
           <div style="font-size:.68rem;color:var(--text-muted);margin-top:1px">Masa siap: ${label} dari tarikh mohon</div>
         </div>`;
  }

  if (!tarikhDaftarRIS) {
    return compact
      ? `<span style="font-size:.7rem;color:var(--text-light);font-style:italic">Belum</span>`
      : `<span style="font-size:.78rem;color:var(--text-light);font-style:italic">Belum Didaftar</span>`;
  }
  const hari = hitungHariRIS(tarikhDaftarRIS);
  if (hari === null) return '<span style="color:var(--text-light)">—</span>';

  if (hari > 15) {
    // Melebihi 15 hari → papar "-" sahaja
    return `<span style="color:var(--text-light);font-size:.8rem" title="Melebihi 15 hari (${hari} hari)">—</span>`;
  }

  let style, label, icon;
  if (hari >= 14) {
    // Hari 14–15 → MERAH BOLD kritikal
    style = 'color:#dc2626;font-weight:700;font-size:.82rem';
    icon  = '🔴';
    label = `${hari} hari`;
  } else if (hari >= 9) {
    // Hari 9–13 → PURPLE BOLD amaran
    style = 'color:#7c3aed;font-weight:700;font-size:.82rem';
    icon  = '🟣';
    label = `${hari} hari`;
  } else {
    // Hari 1–8 → normal hijau
    style = 'color:#16a34a;font-weight:600;font-size:.8rem';
    icon  = '🟢';
    label = `${hari} hari`;
  }

  return compact
    ? `<span style="${style}" title="Daftar RIS: ${formatDate(tarikhDaftarRIS)}">${icon} ${label}</span>`
    : `<div style="margin-top:2px"><span style="${style}">${icon} ${label} dari daftar</span><div style="font-size:.68rem;color:var(--text-muted);margin-top:1px">Daftar: ${formatDate(tarikhDaftarRIS)}</div></div>`;
}

/**
 * Jana badge status daftar RIS untuk paparan ringkas dalam jadual.
 * Apabila status = 'done', gantikan dengan badge "Laporan Siap".
 * status / submittedAt / updatedAt — digunakan untuk kiraan hari siap.
 */
function risBadgeHTML(tarikhDaftarRIS, status = '', submittedAt = '', updatedAt = '') {
  // ---- STATUS DONE: gantikan badge dengan notis siap ----
  if (status === 'done') {
    const hariSiap = hitungHariSiap(submittedAt, updatedAt);
    const label = hariSiap === 0 ? 'Hari sama' : `${hariSiap} hari`;
    return `<span style="font-size:.7rem;background:#d8f0e6;color:#145a32;font-weight:700;padding:2px 8px;border-radius:10px" title="Siap dalam ${label} dari tarikh mohon">✅ Siap (${label})</span>`;
  }

  if (!tarikhDaftarRIS) {
    return `<span style="font-size:.7rem;background:#f1f5f9;color:var(--text-muted);padding:2px 8px;border-radius:10px;font-style:italic">Belum Didaftar</span>`;
  }
  const hari = hitungHariRIS(tarikhDaftarRIS);
  if (hari > 15) {
    return `<span style="font-size:.7rem;background:#f1f5f9;color:var(--text-light);padding:2px 8px;border-radius:10px">— (>15 hari)</span>`;
  }
  if (hari >= 14) {
    return `<span style="font-size:.7rem;background:#fee2e2;color:#dc2626;font-weight:700;padding:2px 8px;border-radius:10px">🔴 ${hari} Hari</span>`;
  }
  if (hari >= 9) {
    return `<span style="font-size:.7rem;background:#ede9fe;color:#7c3aed;font-weight:700;padding:2px 8px;border-radius:10px">🟣 ${hari} Hari</span>`;
  }
  return `<span style="font-size:.7rem;background:#dcfce7;color:#16a34a;font-weight:600;padding:2px 8px;border-radius:10px">🟢 ${hari} Hari</span>`;
}

// ============================================================
//  STATUS HELPERS
// ============================================================
const STATUS_MAP = {
  pending:    { label: 'Menunggu',      badge: 'badge-pending',    icon: '⏳' },
  registered: { label: 'Telah Didaftar', badge: 'badge-registered', icon: '📋' },
  inprogress: { label: 'Sedang Disedia', badge: 'badge-inprogress', icon: '🔬' },
  done:       { label: 'Laporan Siap',   badge: 'badge-done',       icon: '✅' },
  rejected:   { label: 'Ditolak',        badge: 'badge-rejected',   icon: '❌' }
};
function statusBadge(status) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending;
  return `<span class="badge ${s.badge}">${s.label}</span>`;
}

// ============================================================
//  AUTH & DYNAMIC USER MANAGEMENT
// ============================================================
function getDynamicUsers() {
  const stored = localStorage.getItem('radiologi_dynamic_users');
  return stored ? JSON.parse(stored) : [];
}
function saveDynamicUsers(list) {
  localStorage.setItem('radiologi_dynamic_users', JSON.stringify(list));
}
function getAllUsers() {
  // Apply any override edits for built-in users
  const overrides = JSON.parse(localStorage.getItem('radiologi_user_overrides') || '{}');
  const base = USERS.map(u => overrides[u.id] ? { ...u, ...overrides[u.id] } : u);
  return [...base, ...getDynamicUsers()];
}

// Helper: check if user is an admin-level role (superadmin or admin)
function isAdminRole(user) {
  return user && (user.role === 'superadmin' || user.role === 'admin');
}
// Helper: check if user is Super Admin
function isSuperAdmin(user) {
  return user && user.role === 'superadmin';
}

function login(userId, password) {
  const user = getAllUsers().find(u => u.id === userId);
  if (!user) return false;
  const currentPwd = getPassword(userId);
  if (password !== currentPwd) return false;
  currentUser = user;
  localStorage.setItem('radiologi_session', JSON.stringify({ id: user.id }));
  return true;
}
function logout() {
  currentUser = null;
  localStorage.removeItem('radiologi_session');
  if (liveInterval)  { clearInterval(liveInterval);  liveInterval  = null; }
  if (pollInterval)  { clearInterval(pollInterval);   pollInterval  = null; }
  renderApp();
}
function restoreSession() {
  const s = localStorage.getItem('radiologi_session');
  if (!s) return false;
  const { id } = JSON.parse(s);
  const user = getAllUsers().find(u => u.id === id);
  if (user) { currentUser = user; return true; }
  localStorage.removeItem('radiologi_session');
  return false;
}

// ============================================================
//  RENDER APP ROOT
// ============================================================
function renderApp() {
  const app = document.getElementById('app');
  if (!currentUser) {
    app.innerHTML = renderLoginPage();
    bindLoginEvents();
  } else {
    app.innerHTML = renderMainLayout();
    bindMainEvents();
    navigateTo(currentPage);
    startLiveClock();
    startLivePolling();
  }
}

// ============================================================
//  LOGIN PAGE
// ============================================================
function renderLoginPage() {
  const opts = getAllUsers().map(u =>
    `<option value="${u.id}">${u.id} — ${u.name}</option>`
  ).join('');
  return `
  <div id="login-page">
    <div class="orb1"></div>
    <div class="login-card">
      <div class="login-logo-wrap">
        <div class="login-logo-svg-wrap">
          <img src="Radextra1.png" class="login-logo-svg" alt="Logo RADEXTRA" />
        </div>
        <div class="login-logo-brand">
          <div class="brand-title">RADEXTRA</div>
          <div class="brand-sub">Radiology External Reporting Assist</div>
        </div>
      </div>
      <div class="login-header">
        <div class="login-divider"></div>
        <p style="margin-top:4px;font-size:.78rem;color:var(--text-light)">Jabatan Radiologi · Hospital Umum Sarawak · Kuching</p>
      </div>
      <div class="form-group">
        <label>ID Pengguna <span>*</span></label>
        <div class="input-wrap">
          <span class="input-icon">👤</span>
          <select id="login-userid">
            <option value="">-- Pilih ID Pengguna --</option>
            ${opts}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Kata Laluan <span>*</span></label>
        <div class="input-wrap">
          <span class="input-icon">🔒</span>
          <input type="password" id="login-pass" placeholder="Masukkan kata laluan" autocomplete="off" />
        </div>
      </div>
      <button class="btn-login" id="btn-login">🔑 Log Masuk</button>
      <div class="login-error" id="login-error">⛔ ID atau kata laluan tidak sah. Sila cuba semula.</div>
      <div class="login-footer">
        🛡️ Sistem ini adalah untuk kegunaan kakitangan bertauliah sahaja.<br>
        Jabatan Radiologi HUS © ${new Date().getFullYear()}
      </div>
    </div>
  </div>`;
}
function bindLoginEvents() {
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}
function doLogin() {
  const uid = document.getElementById('login-userid').value.trim();
  const pwd = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.classList.remove('show');
  if (!uid || !pwd) { err.classList.add('show'); err.textContent = '⛔ Sila pilih ID pengguna dan masukkan kata laluan.'; return; }
  if (login(uid, pwd)) {
    currentPage = 'dashboard';
    renderApp();
  } else {
    err.classList.add('show');
    err.textContent = '⛔ ID atau kata laluan tidak sah. Sila cuba semula.';
    document.getElementById('login-pass').value = '';
  }
}

// ============================================================
//  MAIN LAYOUT
// ============================================================
function renderMainLayout() {
  const isAdmin = isAdminRole(currentUser);
  const isSA    = isSuperAdmin(currentUser);

  const roleBadgeHtml = isSA
    ? `<span class="role-badge superadmin">👑 Super Admin</span>`
    : (isAdmin ? `<span class="role-badge admin">🛡️ Admin</span>` : `<span class="role-badge user">👤 User</span>`);

  const adminNav = isAdmin ? `
    <div class="nav-section-title">Pengurusan Admin</div>
    <div class="nav-item" data-page="admin-permohonan-baru">
      <span class="nav-icon">📝</span> Permohonan Baru
    </div>
    <div class="nav-item" data-page="admin-permohonan-saya">
      <span class="nav-icon">🗂️</span> Permohonan Admin
    </div>
    <div class="nav-item" data-page="all-applications">
      <span class="nav-icon">📂</span> Semua Permohonan
      <span class="nav-badge" id="nb-pending"></span>
    </div>
    <div class="nav-item" data-page="kemaskini">
      <span class="nav-icon">✏️</span> Kemaskini Status
    </div>
    <div class="nav-item" data-page="laporan">
      <span class="nav-icon">📊</span> Laporan & Statistik
    </div>
    <div class="nav-item" data-page="urus-pengguna">
      <span class="nav-icon">👥</span> Urus Pengguna
    </div>` : `
    <div class="nav-section-title">Permohonan Saya</div>
    <div class="nav-item" data-page="permohonan-saya">
      <span class="nav-icon">📋</span> Senarai Permohonan
    </div>
    <div class="nav-item" data-page="jejak-status">
      <span class="nav-icon">🔍</span> Jejak Status
    </div>`;

  // Logo image for sidebar brand
  const brandSVG = `<img src="Radextra1.png" width="36" height="36" alt="Logo" style="object-fit:contain;border-radius:6px;" />`;

  return `
  <div class="sidebar-overlay" id="sidebar-overlay"></div>
  <div id="main-app">
    <aside class="sidebar" id="main-sidebar">
      <div class="sidebar-brand">
        <div class="brand-logo">
          <div class="brand-icon">${brandSVG}</div>
          <div class="brand-text">
            <h2>RADEXTRA</h2>
            <p>Radiology External Reporting Assist</p>
          </div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-avatar">${currentUser.shortName}</div>
        <div class="user-info">
          <div class="user-name">${currentUser.name}</div>
          <div class="user-role">
            ${roleBadgeHtml}
            &nbsp;${currentUser.id}
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-title">Menu Utama</div>
        <div class="nav-item" data-page="dashboard">
          <span class="nav-icon">🏠</span> Papan Pemuka
        </div>
        ${!isAdmin ? `<div class="nav-item" data-page="permohonan-baru">
          <span class="nav-icon">➕</span> Mohon Laporan Baru
        </div>` : ''}
        ${adminNav}
        <div class="nav-section-title">Lain-lain</div>
        <div class="nav-item" data-page="panduan">
          <span class="nav-icon">📖</span> Panduan Pengguna
        </div>
      </nav>
      <div class="sidebar-footer">
        <button class="btn-tukar-pwd" id="btn-tukar-pwd">🔑 Tukar Kata Laluan</button>
        <button class="btn-logout" id="btn-logout">🚪 Log Keluar</button>
        <div style="text-align:center;font-size:.62rem;color:rgba(255,255,255,.25);padding-top:4px;border-top:1px solid rgba(255,255,255,.08)">
          RADEXTRA v1.0 · Jabatan Radiologi HUS
        </div>
      </div>
    </aside>
    <div class="main-content">
      <div class="topbar">
        <div class="topbar-left">
          <button class="hamburger-btn" id="hamburger-btn" title="Menu" aria-label="Buka menu">
            <span></span><span></span><span></span>
          </button>
          <div>
            <div class="page-title" id="topbar-title">Papan Pemuka</div>
            <div class="page-subtitle" id="topbar-sub">${currentUser.unit}</div>
          </div>
        </div>
        <div class="topbar-right">
          <div class="topbar-clock">
            🕐 <span id="live-clock" class="clock-time">--:--:--</span>
            <span id="live-date" style="font-size:.72rem;color:var(--text-light)"></span>
          </div>
          <div class="live-indicator"><div class="live-dot"></div> LIVE</div>
          <div class="notif-btn" id="notif-btn">
            🔔
            <div class="notif-dot" id="notif-dot" style="display:none"></div>
          </div>
        </div>
      </div>
      <div id="notif-panel" class="notif-panel"></div>
      <div class="page-content" id="page-content"></div>
    </div>
  </div>
  <div id="toast-container"></div>`;
}

function bindMainEvents() {
  document.getElementById('btn-logout').addEventListener('click', () => {
    if (confirm('Adakah anda pasti ingin log keluar?')) logout();
  });
  document.getElementById('btn-tukar-pwd').addEventListener('click', () => {
    openTukarKataLaluan(currentUser.id);
  });

  // ---- Hamburger / Mobile Sidebar ----
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar   = document.getElementById('main-sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  function openMobileSidebar() {
    sidebar?.classList.add('mobile-open');
    overlay?.classList.add('show');
    hamburger?.classList.add('open');
  }
  function closeMobileSidebar() {
    sidebar?.classList.remove('mobile-open');
    overlay?.classList.remove('show');
    hamburger?.classList.remove('open');
  }

  if (hamburger) hamburger.addEventListener('click', () => {
    sidebar?.classList.contains('mobile-open') ? closeMobileSidebar() : openMobileSidebar();
  });
  if (overlay) overlay.addEventListener('click', closeMobileSidebar);

  // ---- Global click handler ----
  document.addEventListener('click', e => {
    const item = e.target.closest('.nav-item[data-page]');
    if (item) {
      navigateTo(item.dataset.page);
      closeMobileSidebar();
    }
    if (e.target.closest('#notif-btn')) toggleNotifPanel();
    else if (!e.target.closest('#notif-panel') && notifPanelOpen) closeNotifPanel();
  });

  // ---- Escape key — tutup modal / sidebar ----
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    // Tutup mana-mana modal overlay yang terbuka
    const openModal = document.querySelector('.modal-overlay.show');
    if (openModal) { openModal.remove(); return; }
    // Tutup notification panel
    if (notifPanelOpen) { closeNotifPanel(); return; }
    // Tutup sidebar mobile
    closeMobileSidebar();
  });
}

// ============================================================
//  NAVIGATION
// ============================================================
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  const titles = {
    dashboard: ['Papan Pemuka', 'Ringkasan & Statistik Terkini'],
    'permohonan-baru': ['Permohonan Laporan Baru', 'Isi maklumat pemeriksaan X-ray'],
    'permohonan-saya': ['Senarai Permohonan Saya', currentUser.unit],
    'jejak-status': ['Jejak Status Permohonan', 'Cari dan semak status terkini'],
    'all-applications': ['Semua Permohonan', 'Paparan keseluruhan semua fasiliti'],
    kemaskini: ['Kemaskini Status', 'Kemas kini dan urus permohonan'],
    laporan: ['Laporan & Statistik', 'Analisis data radiologi'],
    panduan: ['Panduan Pengguna', 'Arahan penggunaan sistem'],
    'admin-permohonan-baru': ['Permohonan Baru (Admin)', 'Borang permohonan laporan — kemasukan data Admin'],
    'admin-permohonan-saya': ['Permohonan Admin', 'Senarai & jejak permohonan yang dihantar oleh Admin'],
    'urus-pengguna': ['Urus Pengguna', 'Tambah & urus akaun pengguna sistem']
  };
  const t = titles[page] || [page, ''];
  document.getElementById('topbar-title').textContent = t[0];
  document.getElementById('topbar-sub').textContent = t[1];
  currentPageNum = 1;
  selectedIds.clear(); // reset selection on page change
  renderPage(page);
  updateNotifBadge();
}

function renderPage(page) {
  const c = document.getElementById('page-content');
  switch (page) {
    case 'dashboard':              c.innerHTML = renderDashboard(); bindDashboardEvents(); break;
    case 'permohonan-baru':        c.innerHTML = renderFormPermohonan(); bindFormEvents(); break;
    case 'permohonan-saya':        c.innerHTML = renderPermohonanSaya(); bindTableEvents(); break;
    case 'jejak-status':           c.innerHTML = renderJejakStatus(); bindJejakEvents(); break;
    case 'all-applications':       c.innerHTML = renderAllApplications(); bindTableEvents(); break;
    case 'kemaskini':              c.innerHTML = renderKemaskini(); bindKemaskiniEvents(); break;
    case 'laporan':                c.innerHTML = renderLaporan(); break;
    case 'panduan':                c.innerHTML = renderPanduan(); break;
    case 'admin-permohonan-baru':  c.innerHTML = renderFormAdminPermohonan(); bindAdminFormEvents(); break;
    case 'admin-permohonan-saya':  c.innerHTML = renderAdminPermohonanSaya(); bindAdminSayaEvents(); break;
    case 'urus-pengguna':          c.innerHTML = renderUrusPengguna(); bindUrusPenggunaEvents(); break;
    default: c.innerHTML = '<p style="padding:40px;color:var(--text-muted)">Halaman tidak dijumpai.</p>';
  }
}

// ============================================================
//  DASHBOARD PAGE
// ============================================================
function renderDashboard() {
  const isAdmin = isAdminRole(currentUser);
  const myData = isAdmin ? permohonanData : permohonanData.filter(p => p.submittedBy === currentUser.id);
  const total   = myData.length;
  const pending  = myData.filter(p => p.status === 'pending').length;
  const registered = myData.filter(p => p.status === 'registered').length;
  const inprog  = myData.filter(p => p.status === 'inprogress').length;
  const done    = myData.filter(p => p.status === 'done').length;

  const recent = [...myData].sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);

  const adminExtra = isAdmin ? `
    <div class="stat-card"><div class="stat-icon cyan">🏥</div><div class="stat-info">
      <div class="stat-value">${[...new Set(permohonanData.map(p => p.facilityCode))].length}</div>
      <div class="stat-label">Fasiliti Aktif</div>
    </div></div>
    <div class="stat-card"><div class="stat-icon purple">📅</div><div class="stat-info">
      <div class="stat-value">${permohonanData.filter(p => new Date(p.submittedAt).toDateString() === new Date().toDateString()).length}</div>
      <div class="stat-label">Permohonan Hari Ini</div>
    </div></div>` : '';

  const recentRows = recent.map(p => `
    <tr>
      <td><span style="font-size:.7rem;color:var(--text-muted)">${p.noRef}</span></td>
      <td><strong>${p.namaPesakit}</strong><br><span style="font-size:.72rem;color:var(--text-muted)">${p.noIC}</span></td>
      ${isAdmin ? `<td><span style="font-size:.78rem">${p.facilityName}</span></td>` : ''}
      <td>${p.jenisXray}</td>
      <td>${statusBadge(p.status)}</td>
      <td style="font-size:.75rem;color:var(--text-muted)">${timeAgo(p.submittedAt)}</td>
      <td>
        <button class="btn btn-outline btn-xs" onclick="showDetail('${p.id}')">🔍 Lihat</button>
      </td>
    </tr>`).join('');

  return `
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-icon blue">📁</div><div class="stat-info">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Jumlah Permohonan</div>
    </div></div>
    <div class="stat-card"><div class="stat-icon orange">⏳</div><div class="stat-info">
      <div class="stat-value">${pending}</div>
      <div class="stat-label">Menunggu</div>
      ${pending > 0 ? '<div class="stat-change pending">⚠ Perlu tindakan</div>' : ''}
    </div></div>
    <div class="stat-card"><div class="stat-icon cyan">📋</div><div class="stat-info">
      <div class="stat-value">${registered}</div>
      <div class="stat-label">Telah Didaftar</div>
    </div></div>
    <div class="stat-card"><div class="stat-icon green">✅</div><div class="stat-info">
      <div class="stat-value">${done}</div>
      <div class="stat-label">Laporan Siap</div>
      <div class="stat-change up">📈 Selesai</div>
    </div></div>
    ${adminExtra}
  </div>
  <div class="card">
    <div class="card-header">
      <h3>🕐 Permohonan Terkini</h3>
      <span style="font-size:.72rem;color:var(--text-muted)">Dikemas kini: ${formatDateTime(new Date().toISOString())}</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>No. Rujukan</th><th>Pesakit</th>
          ${isAdmin ? '<th>Fasiliti</th>' : ''}
          <th>Jenis Pemeriksaan</th><th>Status</th><th>Masa</th><th>Tindakan</th>
        </tr></thead>
        <tbody>${recentRows || '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📂</div><h4>Tiada permohonan lagi</h4></div></td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <div id="detail-modal-area"></div>`;
}
function bindDashboardEvents() {}

// ============================================================
//  FORM PERMOHONAN BARU
// ============================================================
function renderFormPermohonan(editData = null) {
  const d = editData || {};
  const jenis = ['Chest X-Ray (CXR)', 'Abdominal X-Ray', 'Skull X-Ray', 'Spine X-Ray', 'Pelvis X-Ray', 'Upper Extremities X-Ray', 'Lower Extremities X-Ray', 'Lain-lain'];
  const jenisOpts = jenis.map(j => `<option value="${j}" ${d.jenisXray === j ? 'selected' : ''}>${j}</option>`).join('');

  return `
  <div class="card" style="max-width:860px">
    <div class="card-header">
      <h3>🩻 Borang Permohonan Laporan Radiologi</h3>
      <span class="live-indicator"><div class="live-dot"></div> ${currentUser.unit}</span>
    </div>
    <div class="card-body">
      <div style="background:var(--info-light);border:1px solid #a5f3fc;border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:#164e63;margin-bottom:20px;display:flex;align-items:flex-start;gap:8px;">
        ℹ️ <div>Sila isi maklumat pesakit dengan <strong>lengkap dan tepat</strong>. Nombor IC diisi <strong>tanpa tanda "-"</strong>. Semua medan bertanda <span style="color:var(--danger)">*</span> adalah wajib.</div>
      </div>

      <form id="form-permohonan" novalidate>
        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          A. MAKLUMAT FASILITI
        </div>
        <div class="form-row">
          <div class="field">
            <label>Fasiliti / Klinik / Hospital <span class="req">*</span></label>
            <input type="text" value="${currentUser.unit}" readonly style="background:#f1f5f9;cursor:not-allowed" />
          </div>
          <div class="field">
            <label>ID Fasiliti</label>
            <input type="text" value="${currentUser.facilityCode}" readonly style="background:#f1f5f9;cursor:not-allowed" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Nama Pegawai Perubatan / Doktor Rujukan <span class="req">*</span></label>
            <input type="text" id="f-doktor" placeholder="Nama doktor yang merujuk" value="${d.namaDokter || ''}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
          </div>
          <div class="field">
            <label>Tarikh Pemeriksaan X-Ray Dilakukan <span class="req">*</span></label>
            <input type="date" id="f-tarikhxray" value="${d.tarikhXray || new Date().toISOString().split('T')[0]}" max="${new Date().toISOString().split('T')[0]}" />
          </div>
        </div>

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">📅 Tarikh Permohonan Laporan</div>
            <div style="font-size:.92rem;font-weight:700;color:var(--primary);margin-top:2px">${formatDate(new Date().toISOString())}</div>
          </div>
          <div style="border-left:1px solid var(--border);padding-left:16px">
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">⏱ Tempoh</div>
            <div style="margin-top:2px">${hariPermohonanBadge(new Date().toISOString(), false)}</div>
          </div>
        </div>

        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          B. MAKLUMAT PESAKIT
        </div>
        <div class="form-row">
          <div class="field">
            <label>Nombor Kad Pengenalan (IC) <span class="req">*</span></label>
            <input type="text" id="f-ic" placeholder="Contoh: 901231075678 (tanpa tanda -)" maxlength="12"
              value="${d.noIC || ''}" pattern="[0-9]{12}" />
            <span class="hint">12 digit, tanpa tanda "-"</span>
          </div>
          <div class="field">
            <label>Nama Penuh Pesakit <span class="req">*</span></label>
            <input type="text" id="f-nama" placeholder="NAMA SEPERTI DALAM KAD PENGENALAN" value="${d.namaPesakit || ''}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>
        <div class="form-row triple">
          <div class="field">
            <label>Tarikh Lahir</label>
            <input type="date" id="f-dob" value="${d.tarikh || ''}" />
          </div>
          <div class="field">
            <label>Jantina <span class="req">*</span></label>
            <select id="f-jantina">
              <option value="">-- Pilih --</option>
              <option value="Lelaki" ${d.jantina === 'Lelaki' ? 'selected' : ''}>Lelaki</option>
              <option value="Perempuan" ${d.jantina === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
            </select>
          </div>
          <div class="field">
            <label>No. Telefon</label>
            <input type="tel" id="f-tel" placeholder="01XXXXXXXX" value="${d.noTelefon || ''}" />
          </div>
        </div>

        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          C. MAKLUMAT PEMERIKSAAN
        </div>
        <div class="form-row">
          <div class="field">
            <label>Jenis Pemeriksaan X-Ray <span class="req">*</span></label>
            <select id="f-jenis">
              <option value="">-- Pilih jenis pemeriksaan --</option>
              ${jenisOpts}
            </select>
          </div>
          <div class="field">
            <label>Bahagian / Pandangan <span class="req">*</span></label>
            <input type="text" id="f-bahagian" placeholder="Contoh: Thorax PA, Knee AP/Lateral" value="${d.bahagian || ''}" />
          </div>
        </div>
        <div class="form-row single">
          <div class="field">
            <label>Indikasi Klinikal / Diagnosis <span class="req">*</span></label>
            <textarea id="f-indikasi" rows="3" placeholder="Nyatakan indikasi klinikal, simptom atau diagnosis awal...">${d.indikasiKlinikal || ''}</textarea>
          </div>
        </div>

        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          D. DOKUMEN SOKONGAN <span style="font-size:.72rem;font-weight:400;color:var(--text-muted)">(Pilihan)</span>
        </div>
        <div class="form-row single">
          <div class="field">
            <label>Muat Naik Dokumen Laporan Pemeriksaan (PDF)</label>
            <div class="upload-wrap" id="upload-wrap">
              <input type="file" id="f-dokumen" accept="application/pdf" style="display:none" onchange="handleFileUpload(this)" />
              <div class="upload-box" onclick="document.getElementById('f-dokumen').click()">
                <div class="upload-icon">📄</div>
                <div class="upload-label">Klik untuk muat naik fail PDF</div>
                <div class="upload-hint">Saiz maksimum: 500KB · Format: PDF sahaja</div>
              </div>
              <div class="upload-preview" id="upload-preview" style="display:none">
                <span class="upload-file-icon">📎</span>
                <span class="upload-file-name" id="upload-file-name"></span>
                <span class="upload-file-size" id="upload-file-size"></span>
                <button type="button" class="upload-remove" onclick="removeUploadedFile()" title="Buang fail">✕</button>
              </div>
            </div>
            ${d.dokumenNama ? `<div class="upload-preview" style="display:flex;margin-top:8px"><span class="upload-file-icon">📎</span><span class="upload-file-name">${d.dokumenNama}</span><span class="upload-file-size">${d.dokumenSaiz || ''}</span><button type="button" class="upload-remove" onclick="clearExistingDoc()" title="Buang fail">✕</button></div>` : ''}
            <span class="hint">Tidak wajib. Muat naik surat rujukan, keputusan lab atau dokumen berkaitan.</span>
          </div>
        </div>

        <div id="form-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:var(--danger);margin-top:8px"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap">
          <button type="button" class="btn btn-outline" onclick="navigateTo('dashboard')">✖ Batal</button>
          ${!editData ? `<button type="button" class="btn btn-gold" onclick="previewPermohonan()">👁 Pratonton Borang</button>` : ''}
          <button type="submit" class="btn btn-primary" id="btn-submit-form">
            ${editData ? '💾 Kemaskini Permohonan' : '📤 Hantar Permohonan'}
          </button>
        </div>
      </form>
    </div>
  </div>`;
}

function bindFormEvents() {
  const form = document.getElementById('form-permohonan');
  if (!form) return;
  // Auto-format IC input
  document.getElementById('f-ic').addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 12);
  });
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    submitPermohonan();
  });
}

function submitPermohonan(editId = null) {
  const ic      = document.getElementById('f-ic').value.trim();
  const nama    = document.getElementById('f-nama').value.trim().toUpperCase();
  const jantina = document.getElementById('f-jantina').value;
  const jenis   = document.getElementById('f-jenis').value;
  const bahagian= document.getElementById('f-bahagian').value.trim();
  const indikasi= document.getElementById('f-indikasi').value.trim();
  const doktor  = document.getElementById('f-doktor').value.trim().toUpperCase();
  const tarikhXray = document.getElementById('f-tarikhxray').value;
  const dob     = document.getElementById('f-dob').value;
  const tel     = document.getElementById('f-tel').value.trim();
  const errDiv  = document.getElementById('form-error');

  const errors = [];
  if (!ic || ic.length !== 12 || !/^\d{12}$/.test(ic)) errors.push('Nombor IC mestilah 12 digit angka tanpa tanda "-".');
  if (!nama) errors.push('Nama penuh pesakit diperlukan.');
  if (!jantina) errors.push('Sila pilih jantina.');
  if (!jenis) errors.push('Sila pilih jenis pemeriksaan X-ray.');
  if (!bahagian) errors.push('Bahagian / pandangan diperlukan.');
  if (!indikasi) errors.push('Indikasi klinikal diperlukan.');
  if (!doktor) errors.push('Nama doktor / pegawai perubatan diperlukan.');
  if (!tarikhXray) errors.push('Tarikh pemeriksaan diperlukan.');
  if (tel && !validatePhone(tel)) errors.push('Format nombor telefon tidak sah. Gunakan format: 01XXXXXXXX.');

  if (errors.length) {
    errDiv.style.display = 'block';
    errDiv.innerHTML = '⛔ ' + errors.join('<br>⛔ ');
    errDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  errDiv.style.display = 'none';

  // Ambil data dokumen PDF jika ada
  const existing = editId ? permohonanData.find(p => p.id === editId) : null;
  const uploadedDoc = window._uploadedDoc_f || null;
  const keepExisting = !window._clearExistingDoc_f && existing?.dokumenData;
  const dokumenData = uploadedDoc ? uploadedDoc.data : (keepExisting ? existing.dokumenData : '');
  const dokumenNama = uploadedDoc ? uploadedDoc.nama : (keepExisting ? existing.dokumenNama : '');
  const dokumenSaiz = uploadedDoc ? uploadedDoc.saiz : (keepExisting ? existing.dokumenSaiz : '');
  window._uploadedDoc_f = null;
  window._clearExistingDoc_f = false;

  const now = new Date().toISOString();
  const record = {
    id: editId || generateId(),
    noRef: editId ? (permohonanData.find(p => p.id === editId)?.noRef || '') : generateRefNo(currentUser.facilityCode, currentUser.id),
    facilityCode: currentUser.facilityCode,
    facilityName: currentUser.unit,
    submittedBy: currentUser.id,
    submittedAt: editId ? (permohonanData.find(p => p.id === editId)?.submittedAt || now) : now,
    noIC: ic, namaPesakit: nama, tarikh: dob, jantina, noTelefon: tel,
    jenisXray: jenis, bahagian, tarikhXray, indikasiKlinikal: indikasi, namaDokter: doktor,
    status: editId ? permohonanData.find(p => p.id === editId)?.status || 'pending' : 'pending',
    remark: editId ? permohonanData.find(p => p.id === editId)?.remark || '' : '',
    updatedAt: now, updatedBy: editId ? currentUser.id : '',
    adminRemark: editId ? permohonanData.find(p => p.id === editId)?.adminRemark || '' : '',
    noAccession: editId ? permohonanData.find(p => p.id === editId)?.noAccession || '' : '',
    dokumenData, dokumenNama, dokumenSaiz
  };

  if (editId) {
    const idx = permohonanData.findIndex(p => p.id === editId);
    if (idx > -1) permohonanData[idx] = record;
    showToast('success', '✅ Permohonan dikemaskini', `No. Rujukan: ${record.noRef}`);
  } else {
    permohonanData.unshift(record);
    addNotif('success', 'Permohonan Baru Dihantar', `${record.namaPesakit} (${record.noIC}) - ${record.jenisXray}`, 'success');
    showToast('success', '📤 Permohonan berjaya dihantar!', `No. Rujukan: ${record.noRef}`);
  }
  saveData();
  navigateTo('permohonan-saya');
}

// ============================================================
//  ADMIN — PERMOHONAN BARU (dengan Bahagian D & E tambahan)
// ============================================================

// Storage berasingan untuk permohonan yang dibuat oleh Admin sendiri
function getAdminPermohonan() {
  const s = localStorage.getItem('radiologi_admin_permohonan');
  return s ? JSON.parse(s) : [];
}
function saveAdminPermohonan(data) {
  localStorage.setItem('radiologi_admin_permohonan', JSON.stringify(data));
}

function renderFormAdminPermohonan(editData = null) {
  const d = editData || {};
  const jenis = ['Chest X-Ray (CXR)', 'Abdominal X-Ray', 'Skull X-Ray', 'Spine X-Ray', 'Pelvis X-Ray', 'Upper Extremities X-Ray', 'Lower Extremities X-Ray', 'Lain-lain'];
  const jenisOpts = jenis.map(j => `<option value="${j}" ${d.jenisXray === j ? 'selected' : ''}>${j}</option>`).join('');

  // Jenis laporan
  const jenisLaporan = ['Hardcopy', 'CD', 'Muatnaik PACS', 'Lain-lain (sila nyatakan)'];
  const jenisLaporanOpts = jenisLaporan.map(j => `<option value="${j}" ${d.jenisLaporan === j ? 'selected' : ''}>${j}</option>`).join('');

  // Sumber pesakit
  const sumberOpts = ['Pesakit Dalam HUS', 'Pesakit Luar HUS'].map(s => `<option value="${s}" ${d.sumberPesakit === s ? 'selected' : ''}>${s}</option>`).join('');

  return `
  <div class="card" style="max-width:860px">
    <div class="card-header">
      <h3>🩻 Borang Permohonan Laporan Radiologi (Admin)</h3>
      <span class="live-indicator"><div class="live-dot"></div> ${currentUser.unit}</span>
    </div>
    <div class="card-body">
      <div style="background:var(--info-light);border:1px solid #a5f3fc;border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:#164e63;margin-bottom:20px;display:flex;align-items:flex-start;gap:8px;">
        ℹ️ <div>Borang ini untuk kegunaan Admin HUS sahaja. Semua medan bertanda <span style="color:var(--danger)">*</span> adalah wajib.</div>
      </div>

      <form id="form-admin-permohonan" novalidate>
        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          A. MAKLUMAT FASILITI
        </div>
        <div class="form-row">
          <div class="field">
            <label>Fasiliti / Unit</label>
            <input type="text" value="${currentUser.unit}" readonly style="background:#f1f5f9;cursor:not-allowed" />
          </div>
          <div class="field">
            <label>Nama Pegawai Perubatan / Doktor Rujukan <span class="req">*</span></label>
            <input type="text" id="af-doktor" placeholder="NAMA DOKTOR YANG MERUJUK" value="${d.namaDokter || ''}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Tarikh Pemeriksaan X-Ray Dilakukan <span class="req">*</span></label>
            <input type="date" id="af-tarikhxray" value="${d.tarikhXray || new Date().toISOString().split('T')[0]}" max="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="field"></div>
        </div>

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">📅 Tarikh Permohonan Laporan</div>
            <div style="font-size:.92rem;font-weight:700;color:var(--primary);margin-top:2px">${d.submittedAt ? formatDate(d.submittedAt) : formatDate(new Date().toISOString())}</div>
          </div>
          <div style="border-left:1px solid var(--border);padding-left:16px">
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">⏱ Tempoh</div>
            <div style="margin-top:2px">${hariPermohonanBadge(d.submittedAt || new Date().toISOString(), false)}</div>
          </div>
        </div>

        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          B. MAKLUMAT PESAKIT
        </div>
        <div class="form-row">
          <div class="field">
            <label>Nombor Kad Pengenalan (IC) <span class="req">*</span></label>
            <input type="text" id="af-ic" placeholder="12 digit tanpa tanda -" maxlength="12" value="${d.noIC || ''}" />
            <span class="hint">12 digit, tanpa tanda "-"</span>
          </div>
          <div class="field">
            <label>Nama Penuh Pesakit <span class="req">*</span></label>
            <input type="text" id="af-nama" placeholder="NAMA SEPERTI DALAM KAD PENGENALAN" value="${d.namaPesakit || ''}" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>
        <div class="form-row triple">
          <div class="field">
            <label>Tarikh Lahir</label>
            <input type="date" id="af-dob" value="${d.tarikh || ''}" />
          </div>
          <div class="field">
            <label>Jantina <span class="req">*</span></label>
            <select id="af-jantina">
              <option value="">-- Pilih --</option>
              <option value="Lelaki" ${d.jantina === 'Lelaki' ? 'selected' : ''}>Lelaki</option>
              <option value="Perempuan" ${d.jantina === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
            </select>
          </div>
          <div class="field">
            <label>No. Telefon</label>
            <input type="tel" id="af-tel" placeholder="01XXXXXXXX" value="${d.noTelefon || ''}" />
          </div>
        </div>

        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          C. MAKLUMAT PEMERIKSAAN
        </div>
        <div class="form-row">
          <div class="field">
            <label>Jenis Pemeriksaan X-Ray <span class="req">*</span></label>
            <select id="af-jenis">
              <option value="">-- Pilih jenis pemeriksaan --</option>
              ${jenisOpts}
            </select>
          </div>
          <div class="field">
            <label>Bahagian / Pandangan <span class="req">*</span></label>
            <input type="text" id="af-bahagian" placeholder="Contoh: Thorax PA, Knee AP/Lateral" value="${d.bahagian || ''}" />
          </div>
        </div>
        <div class="form-row single">
          <div class="field">
            <label>Indikasi Klinikal / Diagnosis <span class="req">*</span></label>
            <textarea id="af-indikasi" rows="3" placeholder="Nyatakan indikasi klinikal, simptom atau diagnosis awal...">${d.indikasiKlinikal || ''}</textarea>
          </div>
        </div>

        <!-- BAHAGIAN D — Jenis Laporan (Admin sahaja) -->
        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          D. JENIS LAPORAN DIPOHON
        </div>
        <div class="form-row">
          <div class="field">
            <label>Jenis Laporan <span class="req">*</span></label>
            <select id="af-jenis-laporan" onchange="toggleJenisLaporanLain(this.value)">
              <option value="">-- Pilih jenis laporan --</option>
              ${jenisLaporanOpts}
            </select>
          </div>
          <div class="field" id="af-jenis-laporan-lain-wrap" style="display:${d.jenisLaporan === 'Lain-lain (sila nyatakan)' ? '' : 'none'}">
            <label>Sila Nyatakan Jenis Laporan <span class="req">*</span></label>
            <input type="text" id="af-jenis-laporan-lain" placeholder="Nyatakan jenis laporan..." value="${d.jenisLaporanLain || ''}" />
          </div>
        </div>

        <!-- BAHAGIAN E — Sumber Pesakit (Admin sahaja) -->
        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          E. SUMBER PESAKIT
        </div>
        <div class="form-row">
          <div class="field">
            <label>Pesakit Daripada <span class="req">*</span></label>
            <select id="af-sumber" onchange="toggleSumberLain(this.value)">
              <option value="">-- Pilih sumber pesakit --</option>
              ${sumberOpts}
            </select>
          </div>
          <div class="field">
            <label>Sila Nyatakan (Butiran Tambahan)</label>
            <input type="text" id="af-sumber-nyatakan" placeholder="Contoh: Ward 7B, Klinik Swasta ABC..." value="${d.sumberNyatakan || ''}" />
          </div>
        </div>
        <div class="form-row single">
          <div class="field">
            <label>Catatan Admin (Jika Ada)</label>
            <textarea id="af-catatan" rows="2" placeholder="Catatan tambahan jika perlu...">${d.catatanAdmin || ''}</textarea>
          </div>
        </div>

        <!-- BAHAGIAN F — Dokumen Sokongan (Pilihan) -->
        <div style="font-size:.8rem;font-weight:700;color:var(--primary);margin:20px 0 12px;padding-bottom:6px;border-bottom:2px solid var(--border)">
          F. DOKUMEN SOKONGAN <span style="font-size:.72rem;font-weight:400;color:var(--text-muted)">(Pilihan)</span>
        </div>
        <div class="form-row single">
          <div class="field">
            <label>Muat Naik Dokumen Laporan Pemeriksaan (PDF)</label>
            <div class="upload-wrap" id="af-upload-wrap">
              <input type="file" id="af-dokumen" accept="application/pdf" style="display:none" onchange="handleFileUpload(this, 'af')" />
              <div class="upload-box" onclick="document.getElementById('af-dokumen').click()">
                <div class="upload-icon">📄</div>
                <div class="upload-label">Klik untuk muat naik fail PDF</div>
                <div class="upload-hint">Saiz maksimum: 500KB · Format: PDF sahaja</div>
              </div>
              <div class="upload-preview" id="af-upload-preview" style="display:none">
                <span class="upload-file-icon">📎</span>
                <span class="upload-file-name" id="af-upload-file-name"></span>
                <span class="upload-file-size" id="af-upload-file-size"></span>
                <button type="button" class="upload-remove" onclick="removeUploadedFile('af')" title="Buang fail">✕</button>
              </div>
            </div>
            ${d.dokumenNama ? `<div class="upload-preview" style="display:flex;margin-top:8px"><span class="upload-file-icon">📎</span><span class="upload-file-name">${d.dokumenNama}</span><span class="upload-file-size">${d.dokumenSaiz || ''}</span><button type="button" class="upload-remove" onclick="clearExistingDoc('af')" title="Buang fail">✕</button></div>` : ''}
            <span class="hint">Tidak wajib. Muat naik surat rujukan, keputusan lab atau dokumen berkaitan.</span>
          </div>
        </div>

        <div id="af-form-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:var(--danger);margin-top:8px"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap">
          <button type="button" class="btn btn-outline" onclick="navigateTo('admin-permohonan-saya')">✖ Batal</button>
          ${!editData ? `<button type="button" class="btn btn-gold" onclick="previewAdminPermohonan()">👁 Pratonton Borang</button>` : ''}
          <button type="submit" class="btn btn-primary" id="af-btn-submit">
            ${editData ? '💾 Kemaskini Permohonan' : '📤 Hantar Permohonan'}
          </button>
        </div>
      </form>
    </div>
  </div>`;
}

function toggleJenisLaporanLain(val) {
  const wrap = document.getElementById('af-jenis-laporan-lain-wrap');
  if (wrap) wrap.style.display = val === 'Lain-lain (sila nyatakan)' ? '' : 'none';
}

// Fungsi ini dipanggil oleh select Sumber Pesakit dalam borang Admin
// (tiada tindakan tersembunyi/papar semasa — medan "nyatakan" sentiasa kelihatan)
function toggleSumberLain(val) {
  // Medan sumber-nyatakan sentiasa kelihatan sebagai ruang maklumat tambahan
  // Tiada tindakan toggle yang diperlukan buat masa ini
}

function bindAdminFormEvents() {
  const form = document.getElementById('form-admin-permohonan');
  if (!form) return;
  const icField = document.getElementById('af-ic');
  if (icField) icField.addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 12);
  });
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    submitAdminPermohonan();
  });
}

// ============================================================
//  PRATONTON BORANG PERMOHONAN SEBELUM HANTAR
// ============================================================

/**
 * Helper: Jana baris pratonton dengan label dan nilai.
 */
function _pvRow(label, value, fullWidth = false) {
  const v = value || '<span style="color:#aaa;font-style:italic">—</span>';
  return `<div style="${fullWidth ? 'grid-column:1/-1;' : ''}">
    <div style="font-size:.68rem;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px">${label}</div>
    <div style="font-size:.88rem;font-weight:600;color:#1f2328;background:#f5f0ea;border:1px solid #d9cfc4;border-radius:6px;padding:6px 10px;min-height:30px;word-break:break-word">${v}</div>
  </div>`;
}

/**
 * Helper: Jana HTML seksyen pratonton.
 */
function _pvSection(letter, title, rows) {
  return `
  <div style="margin-bottom:16px">
    <div style="font-size:.78rem;font-weight:800;color:#2d6a4f;border-bottom:2px solid #2d6a4f;padding-bottom:5px;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">${letter}. ${title}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${rows}</div>
  </div>`;
}

/**
 * Header pratonton dengan logo RADEXTRA.HUS.
 */
function _pvHeader(noRef, tarikhPermohonan) {
  return `
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #2d6a4f;padding-bottom:14px;margin-bottom:18px;gap:12px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="Radextra1.png" alt="RADEXTRA" style="width:60px;height:60px;object-fit:contain;border-radius:10px;border:2px solid #d9cfc4" onerror="this.style.display='none'" />
      <div>
        <div style="font-size:1.3rem;font-weight:900;color:#2d6a4f;letter-spacing:-0.5px;line-height:1">RADEXTRA<span style="color:#8b6347">.HUS</span></div>
        <div style="font-size:.7rem;font-weight:600;color:#6b5d50;margin-top:1px">Radiology External Reporting Assist</div>
        <div style="font-size:.65rem;color:#a89580;margin-top:1px">Jabatan Radiologi · Hospital Umum Sarawak · Kuching</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:.7rem;font-weight:700;color:#6b5d50;text-transform:uppercase;letter-spacing:.4px">Tarikh Permohonan</div>
      <div style="font-size:.95rem;font-weight:800;color:#2d6a4f">${tarikhPermohonan}</div>
      ${noRef ? `<div style="font-size:.7rem;color:#a89580;margin-top:2px">${noRef}</div>` : '<div style="font-size:.7rem;color:#a89580;margin-top:2px;font-style:italic">No. Rujukan akan dijana</div>'}
      <div style="margin-top:5px;display:inline-block;padding:3px 10px;background:#fdf4e7;color:#9a6a2a;border:1px solid #f0d9b5;border-radius:10px;font-size:.65rem;font-weight:700">⏳ PRATONTON — Belum Dihantar</div>
    </div>
  </div>`;
}

/**
 * Pratonton borang permohonan pengguna (User) sebelum dihantar.
 * Jalankan validasi dahulu — jika gagal, papar ralat pada borang dan hentikan.
 */
function previewPermohonan() {
  // Kumpul nilai semasa dari borang
  const ic       = document.getElementById('f-ic')?.value.trim() || '';
  const nama     = (document.getElementById('f-nama')?.value.trim() || '').toUpperCase();
  const jantina  = document.getElementById('f-jantina')?.value || '';
  const dob      = document.getElementById('f-dob')?.value || '';
  const tel      = document.getElementById('f-tel')?.value.trim() || '';
  const jenis    = document.getElementById('f-jenis')?.value || '';
  const bahagian = document.getElementById('f-bahagian')?.value.trim() || '';
  const indikasi = document.getElementById('f-indikasi')?.value.trim() || '';
  const doktor   = (document.getElementById('f-doktor')?.value.trim() || '').toUpperCase();
  const tarikhXray = document.getElementById('f-tarikhxray')?.value || '';
  const errDiv   = document.getElementById('form-error');

  // Validasi — sama seperti submit
  const errors = [];
  if (!ic || ic.length !== 12 || !/^\d{12}$/.test(ic)) errors.push('Nombor IC mestilah 12 digit angka tanpa tanda "-".');
  if (!nama)     errors.push('Nama penuh pesakit diperlukan.');
  if (!jantina)  errors.push('Sila pilih jantina.');
  if (!jenis)    errors.push('Sila pilih jenis pemeriksaan X-ray.');
  if (!bahagian) errors.push('Bahagian / pandangan diperlukan.');
  if (!indikasi) errors.push('Indikasi klinikal diperlukan.');
  if (!doktor)   errors.push('Nama doktor / pegawai perubatan diperlukan.');
  if (!tarikhXray) errors.push('Tarikh pemeriksaan diperlukan.');
  if (tel && !validatePhone(tel)) errors.push('Format nombor telefon tidak sah.');

  if (errors.length) {
    if (errDiv) {
      errDiv.style.display = 'block';
      errDiv.innerHTML = '⛔ Sila betulkan ralat berikut sebelum pratonton:<br>⛔ ' + errors.join('<br>⛔ ');
      errDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }
  if (errDiv) errDiv.style.display = 'none';

  const dokNama = window._uploadedDoc_f?.nama || '';
  const tarikhHari = formatDate(new Date().toISOString());

  const html = `
  ${_pvHeader('', tarikhHari)}
  ${_pvSection('A', 'Maklumat Fasiliti', `
    ${_pvRow('Fasiliti / Klinik / Hospital', currentUser.unit)}
    ${_pvRow('Nama Doktor / Pegawai Perubatan Rujukan', doktor)}
    ${_pvRow('Tarikh Pemeriksaan X-Ray Dilakukan', formatDate(tarikhXray))}
    ${_pvRow('Kod Fasiliti', currentUser.facilityCode)}
  `)}
  ${_pvSection('B', 'Maklumat Pesakit', `
    ${_pvRow('Nombor Kad Pengenalan (IC)', ic)}
    ${_pvRow('Nama Penuh Pesakit', nama)}
    ${_pvRow('Jantina', jantina)}
    ${_pvRow('Tarikh Lahir', dob ? formatDate(dob) : '')}
    ${_pvRow('No. Telefon', tel || '')}
  `)}
  ${_pvSection('C', 'Maklumat Pemeriksaan', `
    ${_pvRow('Jenis Pemeriksaan X-Ray', jenis)}
    ${_pvRow('Bahagian / Pandangan', bahagian)}
    ${_pvRow('Indikasi Klinikal / Diagnosis', indikasi, true)}
  `)}
  ${dokNama ? `<div style="margin-top:4px;padding:8px 12px;background:#edf5ef;border:1px solid #6fcf97;border-radius:6px;font-size:.8rem;color:#145a32">📎 Dokumen Sokongan: <strong>${dokNama}</strong></div>` : ''}
  <div style="margin-top:16px;padding:10px 14px;background:#fef9e7;border:1px solid #f9e79f;border-radius:6px;font-size:.75rem;color:#7d6608">
    ℹ️ Sila semak semua maklumat di atas dengan teliti sebelum menghantar. Maklumat yang telah dihantar tidak boleh diedit kecuali semasa status <strong>Menunggu</strong>.
  </div>`;

  _showPreviewModal(html, () => { document.getElementById('form-permohonan')?.requestSubmit(); });
}

/**
 * Pratonton borang permohonan Admin sebelum dihantar.
 */
function previewAdminPermohonan() {
  const ic         = document.getElementById('af-ic')?.value.trim() || '';
  const nama       = (document.getElementById('af-nama')?.value.trim() || '').toUpperCase();
  const jantina    = document.getElementById('af-jantina')?.value || '';
  const dob        = document.getElementById('af-dob')?.value || '';
  const tel        = document.getElementById('af-tel')?.value.trim() || '';
  const jenis      = document.getElementById('af-jenis')?.value || '';
  const bahagian   = document.getElementById('af-bahagian')?.value.trim() || '';
  const indikasi   = document.getElementById('af-indikasi')?.value.trim() || '';
  const doktor     = (document.getElementById('af-doktor')?.value.trim() || '').toUpperCase();
  const tarikhXray = document.getElementById('af-tarikhxray')?.value || '';
  const jenisLaporan     = document.getElementById('af-jenis-laporan')?.value || '';
  const jenisLaporanLain = document.getElementById('af-jenis-laporan-lain')?.value.trim() || '';
  const sumber           = document.getElementById('af-sumber')?.value || '';
  const sumberNyatakan   = document.getElementById('af-sumber-nyatakan')?.value.trim() || '';
  const catatanAdmin     = document.getElementById('af-catatan')?.value.trim() || '';
  const errDiv           = document.getElementById('af-form-error');

  // Validasi
  const errors = [];
  if (!ic || ic.length !== 12 || !/^\d{12}$/.test(ic)) errors.push('Nombor IC mestilah 12 digit angka tanpa tanda "-".');
  if (!nama)         errors.push('Nama penuh pesakit diperlukan.');
  if (!jantina)      errors.push('Sila pilih jantina.');
  if (!jenis)        errors.push('Sila pilih jenis pemeriksaan X-ray.');
  if (!bahagian)     errors.push('Bahagian / pandangan diperlukan.');
  if (!indikasi)     errors.push('Indikasi klinikal diperlukan.');
  if (!doktor)       errors.push('Nama doktor / pegawai perubatan diperlukan.');
  if (!tarikhXray)   errors.push('Tarikh pemeriksaan diperlukan.');
  if (!jenisLaporan) errors.push('Sila pilih jenis laporan dipohon.');
  if (jenisLaporan === 'Lain-lain (sila nyatakan)' && !jenisLaporanLain) errors.push('Sila nyatakan jenis laporan.');
  if (!sumber)       errors.push('Sila pilih sumber pesakit.');
  if (tel && !validatePhone(tel)) errors.push('Format nombor telefon tidak sah.');

  if (errors.length) {
    if (errDiv) {
      errDiv.style.display = 'block';
      errDiv.innerHTML = '⛔ Sila betulkan ralat berikut sebelum pratonton:<br>⛔ ' + errors.join('<br>⛔ ');
      errDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return;
  }
  if (errDiv) errDiv.style.display = 'none';

  const jenisLaporanAkhir = jenisLaporan === 'Lain-lain (sila nyatakan)'
    ? `Lain-lain: ${jenisLaporanLain}` : jenisLaporan;
  const dokNama  = window._uploadedDoc_af?.nama || '';
  const tarikhHari = formatDate(new Date().toISOString());

  const html = `
  ${_pvHeader('', tarikhHari)}
  ${_pvSection('A', 'Maklumat Fasiliti', `
    ${_pvRow('Fasiliti / Unit', currentUser.unit)}
    ${_pvRow('Nama Doktor / Pegawai Perubatan Rujukan', doktor)}
    ${_pvRow('Tarikh Pemeriksaan X-Ray Dilakukan', formatDate(tarikhXray))}
  `)}
  ${_pvSection('B', 'Maklumat Pesakit', `
    ${_pvRow('Nombor Kad Pengenalan (IC)', ic)}
    ${_pvRow('Nama Penuh Pesakit', nama)}
    ${_pvRow('Jantina', jantina)}
    ${_pvRow('Tarikh Lahir', dob ? formatDate(dob) : '')}
    ${_pvRow('No. Telefon', tel || '')}
  `)}
  ${_pvSection('C', 'Maklumat Pemeriksaan', `
    ${_pvRow('Jenis Pemeriksaan X-Ray', jenis)}
    ${_pvRow('Bahagian / Pandangan', bahagian)}
    ${_pvRow('Indikasi Klinikal / Diagnosis', indikasi, true)}
  `)}
  ${_pvSection('D', 'Jenis Laporan Dipohon', `
    ${_pvRow('Jenis Laporan', jenisLaporanAkhir)}
  `)}
  ${_pvSection('E', 'Sumber Pesakit', `
    ${_pvRow('Pesakit Daripada', sumber)}
    ${sumberNyatakan ? _pvRow('Butiran Tambahan', sumberNyatakan) : ''}
    ${catatanAdmin ? _pvRow('Catatan Admin', catatanAdmin, true) : ''}
  `)}
  ${dokNama ? `<div style="margin-top:4px;padding:8px 12px;background:#edf5ef;border:1px solid #6fcf97;border-radius:6px;font-size:.8rem;color:#145a32">📎 Dokumen Sokongan: <strong>${dokNama}</strong></div>` : ''}
  <div style="margin-top:16px;padding:10px 14px;background:#fef9e7;border:1px solid #f9e79f;border-radius:6px;font-size:.75rem;color:#7d6608">
    ℹ️ Sila semak semua maklumat di atas dengan teliti sebelum menghantar.
  </div>`;

  _showPreviewModal(html, () => { document.getElementById('form-admin-permohonan')?.requestSubmit(); });
}

/**
 * Papar modal pratonton dengan kandungan HTML dan callback apabila "Sahkan & Hantar".
 */
function _showPreviewModal(bodyHtml, onConfirm) {
  const existing = document.getElementById('preview-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'preview-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:700px">
    <div class="modal-header" style="background:linear-gradient(135deg,#1b4332,#2d6a4f);border-radius:var(--radius-xl) var(--radius-xl) 0 0;position:sticky;top:0;z-index:2">
      <h3 style="color:white;display:flex;align-items:center;gap:8px">
        <span style="font-size:1.1rem">👁</span> Pratonton Borang Permohonan
      </h3>
      <button class="modal-close" onclick="document.getElementById('preview-modal').remove()"
        style="background:rgba(255,255,255,.18);color:white">✕</button>
    </div>
    <div class="modal-body" style="padding:24px;font-family:'Segoe UI',system-ui,sans-serif">
      ${bodyHtml}
    </div>
    <div class="modal-footer" style="background:var(--grey-light)">
      <button class="btn btn-outline" onclick="document.getElementById('preview-modal').remove()">
        ✏️ Kembali Edit
      </button>
      <button class="btn btn-primary" id="btn-preview-confirm" style="min-width:160px">
        ✅ Sahkan &amp; Hantar
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('btn-preview-confirm').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}

function submitAdminPermohonan(editId = null) {
  const ic           = document.getElementById('af-ic')?.value.trim() || '';
  const nama         = document.getElementById('af-nama')?.value.trim().toUpperCase() || '';
  const jantina      = document.getElementById('af-jantina')?.value || '';
  const jenis        = document.getElementById('af-jenis')?.value || '';
  const bahagian     = document.getElementById('af-bahagian')?.value.trim() || '';
  const indikasi     = document.getElementById('af-indikasi')?.value.trim() || '';
  const doktor       = document.getElementById('af-doktor')?.value.trim().toUpperCase() || '';
  const tarikhXray   = document.getElementById('af-tarikhxray')?.value || '';
  const dob          = document.getElementById('af-dob')?.value || '';
  const tel          = document.getElementById('af-tel')?.value.trim() || '';
  const jenisLaporan = document.getElementById('af-jenis-laporan')?.value || '';
  const jenisLaporanLain = document.getElementById('af-jenis-laporan-lain')?.value.trim() || '';
  const sumber       = document.getElementById('af-sumber')?.value || '';
  const sumberNyatakan = document.getElementById('af-sumber-nyatakan')?.value.trim() || '';
  const catatanAdmin = document.getElementById('af-catatan')?.value.trim() || '';
  const errDiv       = document.getElementById('af-form-error');

  const errors = [];
  if (!ic || ic.length !== 12 || !/^\d{12}$/.test(ic)) errors.push('Nombor IC mestilah 12 digit angka tanpa tanda "-".');
  if (!nama)         errors.push('Nama penuh pesakit diperlukan.');
  if (!jantina)      errors.push('Sila pilih jantina.');
  if (!jenis)        errors.push('Sila pilih jenis pemeriksaan X-ray.');
  if (!bahagian)     errors.push('Bahagian / pandangan diperlukan.');
  if (!indikasi)     errors.push('Indikasi klinikal diperlukan.');
  if (!doktor)       errors.push('Nama doktor / pegawai perubatan diperlukan.');
  if (!tarikhXray)   errors.push('Tarikh pemeriksaan diperlukan.');
  if (!jenisLaporan) errors.push('Sila pilih jenis laporan dipohon.');
  if (jenisLaporan === 'Lain-lain (sila nyatakan)' && !jenisLaporanLain) errors.push('Sila nyatakan jenis laporan.');
  if (!sumber)       errors.push('Sila pilih sumber pesakit.');
  if (tel && !validatePhone(tel)) errors.push('Format nombor telefon tidak sah. Gunakan format: 01XXXXXXXX.');

  if (errors.length) {
    errDiv.style.display = 'block';
    errDiv.innerHTML = '⛔ ' + errors.join('<br>⛔ ');
    errDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  errDiv.style.display = 'none';

  // Ambil semua permohonan admin terlebih dahulu
  const allAdminPermohonan = getAdminPermohonan();
  const now = new Date().toISOString();

  // Ambil data dokumen PDF jika ada
  const existingAf = editId ? allAdminPermohonan.find(p => p.id === editId) : null;
  const uploadedDocAf = window._uploadedDoc_af || null;
  const keepExistingAf = !window._clearExistingDoc_af && existingAf?.dokumenData;
  const dokumenDataAf = uploadedDocAf ? uploadedDocAf.data : (keepExistingAf ? existingAf.dokumenData : '');
  const dokumenNamaAf = uploadedDocAf ? uploadedDocAf.nama : (keepExistingAf ? existingAf.dokumenNama : '');
  const dokumenSaizAf = uploadedDocAf ? uploadedDocAf.saiz : (keepExistingAf ? existingAf.dokumenSaiz : '');
  window._uploadedDoc_af = null;
  window._clearExistingDoc_af = false;

  // Jenis laporan akhir — gabungkan dengan 'lain' jika berkaitan
  const jenisLaporanAkhir = jenisLaporan === 'Lain-lain (sila nyatakan)'
    ? `Lain-lain: ${jenisLaporanLain}`
    : jenisLaporan;

  const record = {
    id: editId || generateId(),
    noRef: editId
      ? (allAdminPermohonan.find(p => p.id === editId)?.noRef || '')
      : (() => {
          const counterKey = 'radiologi_ref_counter';
          let counter = parseInt(localStorage.getItem(counterKey) || '0', 10) + 1;
          localStorage.setItem(counterKey, String(counter));
          return `ADM-${currentUser.id}-${new Date().getFullYear()}${String(counter).padStart(5,'0')}`;
        })(),
    submittedBy: currentUser.id,
    submittedAt: editId ? (allAdminPermohonan.find(p => p.id === editId)?.submittedAt || now) : now,
    // Maklumat pesakit
    noIC: ic, namaPesakit: nama, tarikh: dob, jantina, noTelefon: tel,
    // Maklumat pemeriksaan
    jenisXray: jenis, bahagian, tarikhXray, indikasiKlinikal: indikasi, namaDokter: doktor,
    // Bahagian D — Jenis Laporan
    jenisLaporan: jenisLaporanAkhir, jenisLaporanLain,
    // Bahagian E — Sumber Pesakit
    sumberPesakit: sumber, sumberNyatakan,
    // Catatan
    catatanAdmin,
    // Status & admin fields
    status: editId ? (allAdminPermohonan.find(p => p.id === editId)?.status || 'pending') : 'pending',
    noAccession: editId ? (allAdminPermohonan.find(p => p.id === editId)?.noAccession || '') : '',
    adminRemark: editId ? (allAdminPermohonan.find(p => p.id === editId)?.adminRemark || '') : '',
    tarikhDaftarRIS: editId ? (allAdminPermohonan.find(p => p.id === editId)?.tarikhDaftarRIS || '') : '',
    updatedAt: now, updatedBy: currentUser.id,
    facilityCode: 'HUS', facilityName: 'Jabatan Radiologi, Hospital Umum Sarawak',
    dokumenData: dokumenDataAf, dokumenNama: dokumenNamaAf, dokumenSaiz: dokumenSaizAf
  };

  if (editId) {
    const idx = allAdminPermohonan.findIndex(p => p.id === editId);
    if (idx > -1) allAdminPermohonan[idx] = record;
    showToast('success', '✅ Permohonan dikemaskini', `No. Rujukan: ${record.noRef}`);
  } else {
    allAdminPermohonan.unshift(record);
    addNotif('success', 'Permohonan Admin Dihantar', `${record.namaPesakit} (${record.noIC}) — ${record.jenisLaporan}`, 'success');
    showToast('success', '📤 Permohonan berjaya dihantar!', `No. Rujukan: ${record.noRef}`);
  }
  saveAdminPermohonan(allAdminPermohonan);
  mergeAdminPermohonan();
  navigateTo('admin-permohonan-saya');
}

// ============================================================
//  ADMIN — SENARAI & JEJAK PERMOHONAN SENDIRI
// ============================================================
function renderAdminPermohonanSaya() {
  const data = getAdminPermohonan();
  const statuses = ['pending','registered','inprogress','done','rejected'];
  const jenisList = [...new Set(data.map(p => p.jenisXray))];
  const jenisLaporanList = [...new Set(data.map(p => p.jenisLaporan))];

  const years = [];
  const earliestYear = data.length
    ? Math.min(...data.map(p => new Date(p.submittedAt).getFullYear()))
    : new Date().getFullYear();
  for (let y = earliestYear; y <= 2099; y++) years.push(y);
  const yearOpts = years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  const monthNames = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
  const monthOpts  = monthNames.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('');

  return `
  <!-- FILTER PANEL -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header" style="cursor:pointer" onclick="toggleAdminFilterPanel()">
      <h3>🔽 Panel Carian & Penapisan</h3>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="af-filter-active-label" style="font-size:.72rem;color:var(--accent);font-weight:600"></span>
        <span id="af-filter-toggle-icon" style="font-size:.8rem;color:var(--text-muted)">▲ Sembunyikan</span>
      </div>
    </div>
    <div id="af-filter-panel-body" class="card-body" style="padding-top:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field">
          <label>🔎 Cari Nama / No. Rujukan</label>
          <input type="text" id="af-f-search" placeholder="Nama pesakit atau no. rujukan..." />
        </div>
        <div class="field">
          <label>🪪 No. IC Pesakit</label>
          <input type="text" id="af-f-ic" placeholder="12 digit tanpa -" maxlength="12" />
        </div>
        <div class="field">
          <label>🩻 Jenis Pemeriksaan</label>
          <select id="af-f-jenis">
            <option value="">Semua Jenis</option>
            ${jenisList.map(j => `<option value="${j}">${j}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field">
          <label>📄 Jenis Laporan</label>
          <select id="af-f-jenis-laporan">
            <option value="">Semua Jenis Laporan</option>
            ${jenisLaporanList.map(j => `<option value="${j}">${j}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>🏥 Sumber Pesakit</label>
          <select id="af-f-sumber">
            <option value="">Semua Sumber</option>
            <option value="Pesakit Dalam HUS">Pesakit Dalam HUS</option>
            <option value="Pesakit Luar HUS">Pesakit Luar HUS</option>
          </select>
        </div>
        <div class="field">
          <label>📌 Status</label>
          <select id="af-f-status">
            <option value="">Semua Status</option>
            ${statuses.map(s => `<option value="${s}">${STATUS_MAP[s].label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="field">
          <label>📅 Tarikh X-Ray Dari</label>
          <input type="date" id="af-f-xray-dari" />
        </div>
        <div class="field">
          <label>📅 Tarikh X-Ray Hingga</label>
          <input type="date" id="af-f-xray-hingga" />
        </div>
      </div>
      <!-- Filter Tempoh -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px">
        <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:10px">📆 Paparan Mengikut Tempoh</div>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div class="field" style="min-width:150px">
            <label>Jenis Paparan</label>
            <select id="af-f-tempoh-jenis" onchange="onAdminTempohChange()">
              <option value="">Semua Masa</option>
              <option value="bulanan">📅 Bulanan</option>
              <option value="tahunan">📆 Tahunan</option>
              <option value="custom">🗓 Custom</option>
            </select>
          </div>
          <div class="field" id="af-f-bulan-wrap" style="display:none;min-width:130px">
            <label>Bulan</label>
            <select id="af-f-bulan">${monthOpts}</select>
          </div>
          <div class="field" id="af-f-tahun-wrap" style="display:none;min-width:110px">
            <label>Tahun</label>
            <select id="af-f-tahun">${yearOpts}</select>
          </div>
          <div class="field" id="af-f-dari-wrap" style="display:none">
            <label>Dari</label>
            <input type="date" id="af-f-dari" />
          </div>
          <div class="field" id="af-f-hingga-wrap" style="display:none">
            <label>Hingga</label>
            <input type="date" id="af-f-hingga" />
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" id="af-btn-filter">🔍 Papar Hasil</button>
          <button class="btn btn-outline btn-sm" id="af-btn-reset">↺ Set Semula</button>
        </div>
        <div id="af-filter-summary" style="font-size:.75rem;color:var(--text-muted)"></div>
      </div>
    </div>
  </div>

  <!-- TABLE -->
  <div class="card">
    <div class="card-header">
      <h3>🗂️ Permohonan Admin
        <span id="af-data-count" style="font-weight:400;font-size:.8rem;color:var(--text-muted)"></span>
      </h3>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span id="af-csv-info" style="font-size:.72rem;color:var(--text-muted)"></span>
        <button class="btn btn-primary btn-sm" onclick="navigateTo('admin-permohonan-baru')">➕ Permohonan Baru</button>
        <button class="btn btn-success btn-sm" id="af-btn-export">⬇ Export CSV</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>#</th>
          <th>No. Rujukan</th>
          <th>No. IC</th>
          <th>Nama Pesakit</th>
          <th>Jenis Pemeriksaan</th>
          <th>Tarikh X-Ray</th>
          <th>Jenis Laporan</th>
          <th>Sumber Pesakit</th>
          <th>Tarikh Permohonan</th>
          <th>Hari Mohon</th>
          <th>Daftar RIS</th>
          <th>Hari RIS</th>
          <th>Status</th>
          <th>Tindakan</th>
        </tr></thead>
        <tbody id="af-table-body"></tbody>
      </table>
    </div>
    <div class="pagination" id="af-pagination"></div>
  </div>
  <div id="af-detail-modal-area"></div>`;
}

function bindAdminSayaEvents() {
  const btnFilter = document.getElementById('af-btn-filter');
  const btnReset  = document.getElementById('af-btn-reset');
  const btnExport = document.getElementById('af-btn-export');
  if (btnFilter) btnFilter.addEventListener('click', applyAdminFilter);
  if (btnReset)  btnReset.addEventListener('click', resetAdminFilter);
  if (btnExport) btnExport.addEventListener('click', exportAdminCSV);

  // Auto-format IC
  const icField = document.getElementById('af-f-ic');
  if (icField) icField.addEventListener('input', function() {
    this.value = this.value.replace(/\D/g, '').slice(0, 12);
  });

  ['af-f-search','af-f-ic','af-f-jenis','af-f-jenis-laporan','af-f-sumber','af-f-status',
   'af-f-xray-dari','af-f-xray-hingga','af-f-bulan','af-f-tahun'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyAdminFilter);
    if (el && el.tagName === 'INPUT') el.addEventListener('keyup', applyAdminFilter);
  });
  applyAdminFilter();
}

function toggleAdminFilterPanel() {
  const body = document.getElementById('af-filter-panel-body');
  const icon = document.getElementById('af-filter-toggle-icon');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (icon) icon.textContent = isHidden ? '▲ Sembunyikan' : '▼ Paparkan';
}

function onAdminTempohChange() {
  const jenis = document.getElementById('af-f-tempoh-jenis')?.value || '';
  const show = (id, cond) => { const el = document.getElementById(id); if (el) el.style.display = cond ? '' : 'none'; };
  show('af-f-bulan-wrap',  jenis === 'bulanan');
  show('af-f-tahun-wrap',  jenis === 'bulanan' || jenis === 'tahunan');
  show('af-f-dari-wrap',   jenis === 'custom');
  show('af-f-hingga-wrap', jenis === 'custom');
  applyAdminFilter();
}

let adminFilteredData = [];
let adminCurrentPage  = 1;
const ADMIN_PAGE_SIZE = 15;

function applyAdminFilter() {
  let data = getAdminPermohonan();

  const search      = document.getElementById('af-f-search')?.value.toLowerCase().trim() || '';
  const icCari      = document.getElementById('af-f-ic')?.value.trim() || '';
  const jenis       = document.getElementById('af-f-jenis')?.value || '';
  const jenisLaporan= document.getElementById('af-f-jenis-laporan')?.value || '';
  const sumber      = document.getElementById('af-f-sumber')?.value || '';
  const status      = document.getElementById('af-f-status')?.value || '';
  const xrayDari    = document.getElementById('af-f-xray-dari')?.value || '';
  const xrayHingga  = document.getElementById('af-f-xray-hingga')?.value || '';
  const tempohJenis = document.getElementById('af-f-tempoh-jenis')?.value || '';
  const bulan       = document.getElementById('af-f-bulan')?.value || '';
  const tahun       = document.getElementById('af-f-tahun')?.value || '';
  const dariCustom  = document.getElementById('af-f-dari')?.value || '';
  const hinggaCustom= document.getElementById('af-f-hingga')?.value || '';

  if (search)       data = data.filter(p => p.namaPesakit.toLowerCase().includes(search) || p.noRef.toLowerCase().includes(search));
  if (icCari)       data = data.filter(p => p.noIC.includes(icCari));
  if (jenis)        data = data.filter(p => p.jenisXray === jenis);
  if (jenisLaporan) data = data.filter(p => p.jenisLaporan === jenisLaporan);
  if (sumber)       data = data.filter(p => p.sumberPesakit === sumber);
  if (status)       data = data.filter(p => p.status === status);
  if (xrayDari)     data = data.filter(p => p.tarikhXray >= xrayDari);
  if (xrayHingga)   data = data.filter(p => p.tarikhXray <= xrayHingga);

  if (tempohJenis === 'bulanan' && bulan && tahun) {
    data = data.filter(p => {
      const d = new Date(p.submittedAt);
      return String(d.getMonth()+1).padStart(2,'0') === bulan && String(d.getFullYear()) === String(tahun);
    });
  } else if (tempohJenis === 'tahunan' && tahun) {
    data = data.filter(p => new Date(p.submittedAt).getFullYear() === Number(tahun));
  } else if (tempohJenis === 'custom') {
    if (dariCustom)    data = data.filter(p => p.submittedAt >= dariCustom);
    if (hinggaCustom)  data = data.filter(p => p.submittedAt <= hinggaCustom + 'T23:59:59');
  }

  adminFilteredData = data;
  adminCurrentPage  = 1;

  const countEl = document.getElementById('af-data-count');
  if (countEl) countEl.textContent = `(${data.length} rekod)`;
  const csvEl = document.getElementById('af-csv-info');
  if (csvEl) csvEl.textContent = `${data.length} rekod akan dimuat turun`;

  renderAdminSayaTable();
}

function resetAdminFilter() {
  ['af-f-search','af-f-ic','af-f-jenis','af-f-jenis-laporan','af-f-sumber','af-f-status',
   'af-f-xray-dari','af-f-xray-hingga','af-f-bulan','af-f-tahun','af-f-dari','af-f-hingga'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const tj = document.getElementById('af-f-tempoh-jenis');
  if (tj) { tj.value = ''; onAdminTempohChange(); }
  applyAdminFilter();
}

function renderAdminSayaTable() {
  const tbody = document.getElementById('af-table-body');
  const pag   = document.getElementById('af-pagination');
  if (!tbody) return;

  const total    = adminFilteredData.length;
  const start    = (adminCurrentPage - 1) * ADMIN_PAGE_SIZE;
  const pageData = adminFilteredData.slice(start, start + ADMIN_PAGE_SIZE);

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14">
      <div class="empty-state">
        <div class="empty-icon">🗂️</div>
        <h4>Tiada rekod dijumpai</h4>
        <p>Cuba ubah kriteria carian atau tambah permohonan baru.</p>
      </div>
    </td></tr>`;
    if (pag) pag.innerHTML = '';
    return;
  }

  tbody.innerHTML = pageData.map((p, i) => {
    const isRejected = p.status === 'rejected';
    const rejectInfo = isRejected
      ? `<div style="margin-top:4px"><span style="font-size:.7rem;color:#7f1d1d;background:#fde8eb;border:1px solid #fca5a5;padding:3px 7px;border-radius:4px;display:inline-block;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600" title="DITOLAK: ${p.rejectReason || p.adminRemark || ''}">🚫 ${p.rejectReason || p.adminRemark || 'Ditolak'}</span></div>`
      : '';
    return `
    <tr style="${isRejected ? 'background:#fff8f8;' : ''}">
      <td style="color:var(--text-muted);font-size:.72rem">${start + i + 1}</td>
      <td>
        <span style="font-size:.72rem;color:var(--primary);font-weight:600">${p.noRef}</span>
        ${p.noAccession ? `<br><span style="font-size:.68rem;color:var(--success)">✅ Acc: ${p.noAccession}</span>` : ''}
      </td>
      <td><span style="font-family:monospace;font-size:.82rem">${p.noIC}</span></td>
      <td>
        <strong style="font-size:.85rem">${p.namaPesakit}</strong>
        <br><span style="font-size:.7rem;color:var(--text-muted)">${p.jantina}</span>
      </td>
      <td style="font-size:.8rem">${p.jenisXray}<br><span style="font-size:.7rem;color:var(--text-muted)">${p.bahagian}</span></td>
      <td style="font-size:.78rem">${formatDate(p.tarikhXray)}</td>
      <td>
        <span style="font-size:.75rem;background:var(--purple-light);color:var(--purple);padding:2px 7px;border-radius:10px;font-weight:600">${p.jenisLaporan}</span>
      </td>
      <td>
        <span style="font-size:.75rem;background:var(--info-light);color:var(--info);padding:2px 7px;border-radius:10px">${p.sumberPesakit}</span>
        ${p.sumberNyatakan ? `<br><span style="font-size:.68rem;color:var(--text-muted)">${p.sumberNyatakan}</span>` : ''}
      </td>
      <td style="font-size:.75rem">${formatDate(p.submittedAt)}</td>
      <td>${hariPermohonanBadge(p.submittedAt)}</td>
      <td style="font-size:.75rem">${p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : '<span style="color:var(--text-light);font-style:italic">—</span>'}</td>
      <td>${risBadgeHTML(p.tarikhDaftarRIS || '', p.status, p.submittedAt, p.updatedAt)}</td>
      <td>${statusBadge(p.status)}${rejectInfo}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-outline btn-xs" onclick="showAdminDetail('${p.id}')">🔍</button>
          ${!isRejected ? `<button class="btn btn-primary btn-xs" onclick="editAdminPermohonan('${p.id}')">✏️</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  // Pagination
  const totalPages = Math.ceil(total / ADMIN_PAGE_SIZE);
  if (pag && totalPages > 1) {
    let pages = `<span>Menunjukkan ${start + 1}–${Math.min(start + ADMIN_PAGE_SIZE, total)} daripada ${total}</span>`;
    pages += `<div class="page-btns">
      <button class="page-btn" onclick="goAdminPage(${adminCurrentPage - 1})" ${adminCurrentPage === 1 ? 'disabled' : ''}>‹</button>`;
    for (let pg = 1; pg <= totalPages; pg++) {
      if (pg === 1 || pg === totalPages || Math.abs(pg - adminCurrentPage) <= 1)
        pages += `<button class="page-btn ${pg === adminCurrentPage ? 'active' : ''}" onclick="goAdminPage(${pg})">${pg}</button>`;
      else if (Math.abs(pg - adminCurrentPage) === 2)
        pages += `<button class="page-btn" disabled>…</button>`;
    }
    pages += `<button class="page-btn" onclick="goAdminPage(${adminCurrentPage + 1})" ${adminCurrentPage === totalPages ? 'disabled' : ''}>›</button></div>`;
    pag.innerHTML = pages;
  } else if (pag) {
    pag.innerHTML = `<span>Jumlah ${total} rekod</span>`;
  }
}

function goAdminPage(pg) {
  adminCurrentPage = pg;
  renderAdminSayaTable();
}

function editAdminPermohonan(id) {
  const all = getAdminPermohonan();
  const p = all.find(r => r.id === id);
  if (!p) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'admin-edit-own-modal';
  overlay.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <h3>✏️ Edit Permohonan Admin</h3>
      <button class="modal-close" onclick="document.getElementById('admin-edit-own-modal').remove()">✕</button>
    </div>
    <div class="modal-body">
      ${renderFormAdminPermohonan(p)}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  // rebind form
  const icField = document.getElementById('af-ic');
  if (icField) icField.addEventListener('input', function() { this.value = this.value.replace(/\D/g, '').slice(0,12); });
  const form = document.getElementById('form-admin-permohonan');
  if (form) form.addEventListener('submit', e => {
    e.preventDefault();
    submitAdminPermohonan(id);
    document.getElementById('admin-edit-own-modal')?.remove();
  });
}

function showAdminDetail(id) {
  const all = getAdminPermohonan();
  const p = all.find(r => r.id === id);
  if (!p) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'admin-detail-modal';
  const isRejected = p.status === 'rejected';
  const steps = ['pending','registered','inprogress','done'];
  const stepLabels = ['Dihantar','Telah Didaftar','Sedang Disedia','Laporan Siap'];
  const curIdx = steps.indexOf(p.status);
  const trackHtml = (isRejected
    ? `<div style="display:flex;align-items:center;justify-content:center;padding:10px 0;gap:10px">
        <span style="font-size:1.5rem">🚫</span>
        <div>
          <div style="font-weight:700;color:#7f1d1d;font-size:.9rem">Permohonan Ditolak</div>
          ${p.rejectReason || p.adminRemark ? `<div style="font-size:.78rem;color:#7f1d1d;margin-top:2px">${p.rejectReason || p.adminRemark}</div>` : ''}
        </div>
      </div>`
    : steps.map((s, i) => `
    <div class="track-step ${i < curIdx ? 'done' : i === curIdx ? 'active' : ''}">
      <div class="step-circle">${i < curIdx ? '✓' : i + 1}</div>
      <div class="step-label">${stepLabels[i]}</div>
    </div>`).join(''));

  overlay.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <h3>🔍 Butiran Permohonan Admin</h3>
      <button class="modal-close" onclick="document.getElementById('admin-detail-modal').remove()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:1rem;font-weight:700">${p.namaPesakit}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${p.noRef}</div>
        </div>
        ${statusBadge(p.status)}
      </div>
      <div class="progress-track" style="margin-bottom:16px">${trackHtml}</div>

      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Maklumat Pesakit</div>
      <div class="detail-grid" style="margin-bottom:12px">
        <div class="detail-item"><div class="detail-label">No. IC</div><div class="detail-value">${p.noIC}</div></div>
        <div class="detail-item"><div class="detail-label">Nama Penuh</div><div class="detail-value">${p.namaPesakit}</div></div>
        <div class="detail-item"><div class="detail-label">Jantina</div><div class="detail-value">${p.jantina}</div></div>
        <div class="detail-item"><div class="detail-label">No. Telefon</div><div class="detail-value">${p.noTelefon || '-'}</div></div>
      </div>

      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Maklumat Pemeriksaan</div>
      <div class="detail-grid" style="margin-bottom:12px">
        <div class="detail-item"><div class="detail-label">Jenis X-Ray</div><div class="detail-value">${p.jenisXray}</div></div>
        <div class="detail-item"><div class="detail-label">Bahagian</div><div class="detail-value">${p.bahagian}</div></div>
        <div class="detail-item"><div class="detail-label">Tarikh X-Ray</div><div class="detail-value">${formatDate(p.tarikhXray)}</div></div>
        <div class="detail-item"><div class="detail-label">Doktor Rujukan</div><div class="detail-value">${p.namaDokter}</div></div>
        <div class="detail-item full"><div class="detail-label">Indikasi Klinikal</div><div class="detail-value">${p.indikasiKlinikal}</div></div>
      </div>

      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Jenis Laporan & Sumber</div>
      <div class="detail-grid" style="margin-bottom:12px">
        <div class="detail-item"><div class="detail-label">Jenis Laporan</div><div class="detail-value" style="color:var(--purple);font-weight:700">${p.jenisLaporan}</div></div>
        <div class="detail-item"><div class="detail-label">Sumber Pesakit</div><div class="detail-value">${p.sumberPesakit}</div></div>
        ${p.sumberNyatakan ? `<div class="detail-item full"><div class="detail-label">Butiran Tambahan</div><div class="detail-value">${p.sumberNyatakan}</div></div>` : ''}
        ${p.catatanAdmin ? `<div class="detail-item full"><div class="detail-label">Catatan Admin</div><div class="detail-value">${p.catatanAdmin}</div></div>` : ''}
      </div>

      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🗃 Pendaftaran RIS</div>
      <div class="detail-grid" style="margin-bottom:4px">
        <div class="detail-item"><div class="detail-label">📅 Tarikh Permohonan</div><div class="detail-value">${formatDate(p.submittedAt)}</div></div>
        <div class="detail-item"><div class="detail-label">⏱ Tempoh Permohonan</div><div class="detail-value">${hariPermohonanBadge(p.submittedAt, false)}</div></div>
        <div class="detail-item"><div class="detail-label">Tarikh Daftar RIS</div><div class="detail-value">${p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : '<span style="color:var(--text-light);font-style:italic">Belum</span>'}</div></div>
        <div class="detail-item"><div class="detail-label">Status RIS</div><div class="detail-value">${risBadgeHTML(p.tarikhDaftarRIS || '', p.status, p.submittedAt, p.updatedAt)}</div></div>
        <div class="detail-item"><div class="detail-label">No. Accession</div><div class="detail-value">${p.noAccession || '-'}</div></div>
      </div>
      <div style="margin-top:8px">${risHariHTML(p.tarikhDaftarRIS || '', false, p.status, p.submittedAt, p.updatedAt)}</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('admin-detail-modal').remove()">Tutup</button>
      <button class="btn btn-grey btn-sm" onclick="printPermohonan('${p.id}')">🖨️ Cetak</button>
      ${!isRejected ? `<button class="btn btn-primary" onclick="document.getElementById('admin-detail-modal').remove();editAdminPermohonan('${p.id}')">✏️ Edit</button>` : ''}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function exportAdminCSV() {
  const data = adminFilteredData.length > 0 ? adminFilteredData : getAdminPermohonan();
  if (data.length === 0) {
    showToast('warning', '⚠ Tiada data untuk dimuat turun.', '');
    return;
  }
  const now = new Date();
  const stamp = now.toISOString().slice(0,10) + '_' + now.toLocaleTimeString('ms-MY',{hour:'2-digit',minute:'2-digit'}).replace(':','');
  const headers = [
    'No.','No. Rujukan','No. IC Pesakit','Nama Penuh Pesakit','Jantina',
    'Jenis Pemeriksaan','Bahagian','Tarikh X-Ray','Doktor Rujukan','Indikasi Klinikal',
    'Jenis Laporan','Sumber Pesakit','Butiran Sumber','Catatan Admin',
    'Tarikh Daftar RIS','Hari Dari Daftar RIS',
    'Status','No. Accession','Tarikh Dihantar'
  ];
  const rows = data.map((p, i) => {
    const hariRIS = p.tarikhDaftarRIS ? hitungHariRIS(p.tarikhDaftarRIS) : null;
    const hariLabel = hariRIS === null ? 'Belum Didaftar' : hariRIS > 15 ? '— (>15 hari)' : `${hariRIS} hari`;
    return [
      i+1, p.noRef, p.noIC, p.namaPesakit, p.jantina,
      p.jenisXray, p.bahagian, formatDate(p.tarikhXray), p.namaDokter, p.indikasiKlinikal,
      p.jenisLaporan, p.sumberPesakit, p.sumberNyatakan || '',
      p.catatanAdmin || '',
      p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : 'Belum Didaftar',
      hariLabel,
      STATUS_MAP[p.status]?.label || p.status,
      p.noAccession || '',
      formatDateTime(p.submittedAt)
    ].map(c => `"${String(c).replace(/"/g,'""')}"`).join(',');
  });
  const meta = [
    `"Sistem Permohonan Laporan Radiologi — Permohonan Admin HUS"`,
    `"Dijana oleh: ${currentUser.name} (${currentUser.id})"`,
    `"Tarikh & Masa Export: ${formatDateTime(now.toISOString())}"`,
    `"Jumlah Rekod: ${data.length}"`,
    `""`
  ].join('\r\n');
  const csv = meta + '\r\n' + headers.map(h => `"${h}"`).join(',') + '\r\n' + rows.join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Permohonan_Admin_HUS_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('success', '⬇ Export CSV berjaya!', `${data.length} rekod dieksport.`);
}


function renderPermohonanSaya() {
  return renderUserTable();
}

// ============================================================
//  USER TABLE — paparan khusus untuk pengguna biasa
// ============================================================
function renderUserTable() {
  const myData = permohonanData.filter(p => p.submittedBy === currentUser.id);
  const jenisOpts = [...new Set(myData.map(p => p.jenisXray))]
    .map(j => `<option value="${j}">${j}</option>`).join('');

  // Jana pilihan tahun: dari tahun terawal dalam data sehingga 2099
  const years = [];
  const earliestYear = myData.length
    ? Math.min(...myData.map(p => new Date(p.submittedAt).getFullYear()))
    : new Date().getFullYear();
  for (let y = earliestYear; y <= 2099; y++) years.push(y);
  const yearOpts = years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');

  // Jana pilihan bulan
  const monthNames = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
  const monthOpts = monthNames.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('');

  const statuses = ['pending','registered','inprogress','done'];

  return `
  <!-- FILTER PANEL UTAMA -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-header" style="cursor:pointer" onclick="toggleFilterPanel()">
      <h3>🔽 Panel Carian & Penapisan</h3>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="filter-active-label" style="font-size:.72rem;color:var(--accent);font-weight:600"></span>
        <span id="filter-toggle-icon" style="font-size:.8rem;color:var(--text-muted)">▲ Sembunyikan</span>
      </div>
    </div>
    <div id="filter-panel-body" class="card-body" style="padding-top:14px">

      <!-- ROW 1: Carian teks + IC -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;flex-wrap:wrap">
        <div class="field">
          <label>🔎 Cari Nama / No. Rujukan</label>
          <input type="text" id="f-search" placeholder="Nama pesakit atau no. rujukan..." />
        </div>
        <div class="field">
          <label>🪪 No. IC Pesakit</label>
          <input type="text" id="f-ic-cari" placeholder="12 digit tanpa -" maxlength="12" />
        </div>
        <div class="field">
          <label>🩻 Jenis Pemeriksaan X-Ray</label>
          <select id="f-jenis-filter">
            <option value="">Semua Jenis</option>
            ${jenisOpts || '<option value="" disabled>Tiada data</option>'}
          </select>
        </div>
      </div>

      <!-- ROW 2: Status + Tarikh Pemeriksaan (X-Ray) -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div class="field">
          <label>📌 Status Laporan</label>
          <select id="f-status">
            <option value="">Semua Status</option>
            ${statuses.map(s => `<option value="${s}">${STATUS_MAP[s].label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>📅 Tarikh X-Ray Dari</label>
          <input type="date" id="f-xray-dari" />
        </div>
        <div class="field">
          <label>📅 Tarikh X-Ray Hingga</label>
          <input type="date" id="f-xray-hingga" />
        </div>
      </div>

      <!-- ROW 3: Filter Bulanan / Tahunan -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px">
        <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:10px">📆 Paparan Mengikut Tempoh (berdasarkan tarikh dihantar)</div>
        <div style="display:grid;grid-template-columns:auto auto 1fr 1fr auto;gap:10px;align-items:end;flex-wrap:wrap">
          <div class="field" style="min-width:140px">
            <label>Jenis Paparan</label>
            <select id="f-tempoh-jenis" onchange="onTempohJenisChange()">
              <option value="">Semua Masa</option>
              <option value="bulanan">📅 Paparan Bulanan</option>
              <option value="tahunan">📆 Paparan Tahunan</option>
              <option value="custom">🗓 Tarikh Custom</option>
            </select>
          </div>
          <div class="field" id="f-bulan-wrap" style="display:none;min-width:130px">
            <label>Bulan</label>
            <select id="f-bulan">
              ${monthOpts}
            </select>
          </div>
          <div class="field" id="f-tahun-wrap" style="display:none;min-width:110px">
            <label>Tahun</label>
            <select id="f-tahun">
              ${yearOpts}
            </select>
          </div>
          <div class="field" id="f-custom-dari-wrap" style="display:none">
            <label>Dari Tarikh</label>
            <input type="date" id="f-dari" />
          </div>
          <div class="field" id="f-custom-hingga-wrap" style="display:none">
            <label>Hingga Tarikh</label>
            <input type="date" id="f-hingga" />
          </div>
        </div>
      </div>

      <!-- ACTION BUTTONS -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="btn-filter">🔍 Papar Hasil</button>
          <button class="btn btn-outline btn-sm" id="btn-reset-filter">↺ Set Semula Semua</button>
        </div>
        <div id="filter-summary" style="font-size:.75rem;color:var(--text-muted)"></div>
      </div>
    </div>
  </div>

  <!-- RESULT TABLE -->
  <div class="card">
    <div class="card-header">
      <h3>📋 Data Pesakit Saya
        <span id="data-count" style="font-weight:400;font-size:.8rem;color:var(--text-muted)"></span>
      </h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span id="csv-info" style="font-size:.72rem;color:var(--text-muted)"></span>
        <button class="btn btn-success btn-sm" id="btn-export">⬇ Muat Turun CSV</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>#</th>
          <th>No. Rujukan</th>
          <th>No. IC</th>
          <th>Nama Pesakit</th>
          <th>Jenis Pemeriksaan</th>
          <th>Bahagian</th>
          <th>Tarikh X-Ray</th>
          <th>Tarikh Permohonan</th>
          <th>Hari Mohon</th>
          <th>Daftar RIS</th>
          <th>Hari RIS</th>
          <th>Status</th>
          <th>Catatan HUS</th>
          <th>Tindakan</th>
        </tr></thead>
        <tbody id="table-body-permohonan-saya"></tbody>
      </table>
    </div>
    <div class="pagination" id="pagination-permohonan-saya"></div>
  </div>
  <div id="detail-modal-area"></div>`;
}

// ============================================================
//  ALL APPLICATIONS (ADMIN)
// ============================================================
function renderAllApplications() {
  return renderAdminTable(permohonanData, 'all-applications');
}

function renderAdminTable(data, tableId) {
  const facilities = [...new Set(permohonanData.map(p => p.facilityCode))];
  const statuses   = ['pending','registered','inprogress','done','rejected'];
  const years = [];
  const earliestYear = permohonanData.length
    ? Math.min(...permohonanData.map(p => new Date(p.submittedAt).getFullYear()))
    : new Date().getFullYear();
  for (let y = earliestYear; y <= 2099; y++) years.push(y);
  const yearOpts  = years.map(y => `<option value="${y}" ${y === new Date().getFullYear() ? 'selected' : ''}>${y}</option>`).join('');
  const monthNames = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
  const monthOpts = monthNames.map((m, i) => `<option value="${String(i+1).padStart(2,'0')}">${m}</option>`).join('');

  return `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header" style="cursor:pointer" onclick="toggleFilterPanel()">
      <h3>🔽 Panel Carian & Penapisan</h3>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="filter-active-label" style="font-size:.72rem;color:var(--accent);font-weight:600"></span>
        <span id="filter-toggle-icon" style="font-size:.8rem;color:var(--text-muted)">▲ Sembunyikan</span>
      </div>
    </div>
    <div id="filter-panel-body" class="card-body" style="padding-top:14px">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div class="field">
          <label>🔎 Cari Nama / IC / No. Rujukan</label>
          <input type="text" id="f-search" placeholder="Cari pesakit..." />
        </div>
        <div class="field">
          <label>🪪 No. IC Pesakit</label>
          <input type="text" id="f-ic-cari" placeholder="12 digit tanpa -" maxlength="12" />
        </div>
        <div class="field">
          <label>🏥 Fasiliti</label>
          <select id="f-facility">
            <option value="">Semua Fasiliti</option>
            ${facilities.map(f => {
              const name = permohonanData.find(p => p.facilityCode === f)?.facilityName || f;
              return `<option value="${f}">${name}</option>`;
            }).join('')}
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div class="field">
          <label>📌 Status</label>
          <select id="f-status">
            <option value="">Semua Status</option>
            ${statuses.map(s => `<option value="${s}">${STATUS_MAP[s].label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>🩻 Jenis Pemeriksaan</label>
          <select id="f-jenis-filter">
            <option value="">Semua Jenis</option>
            ${[...new Set(permohonanData.map(p => p.jenisXray))].map(j => `<option value="${j}">${j}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>📅 Tarikh X-Ray Dari</label>
          <input type="date" id="f-xray-dari" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
        <div class="field">
          <label>📅 Tarikh X-Ray Hingga</label>
          <input type="date" id="f-xray-hingga" />
        </div>
        <div class="field"></div>
        <div class="field"></div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px">
        <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:10px">📆 Paparan Mengikut Tempoh (tarikh dihantar)</div>
        <div style="display:grid;grid-template-columns:auto auto 1fr 1fr auto;gap:10px;align-items:end">
          <div class="field" style="min-width:140px">
            <label>Jenis Paparan</label>
            <select id="f-tempoh-jenis" onchange="onTempohJenisChange()">
              <option value="">Semua Masa</option>
              <option value="bulanan">📅 Paparan Bulanan</option>
              <option value="tahunan">📆 Paparan Tahunan</option>
              <option value="custom">🗓 Tarikh Custom</option>
            </select>
          </div>
          <div class="field" id="f-bulan-wrap" style="display:none;min-width:130px">
            <label>Bulan</label>
            <select id="f-bulan">${monthOpts}</select>
          </div>
          <div class="field" id="f-tahun-wrap" style="display:none;min-width:110px">
            <label>Tahun</label>
            <select id="f-tahun">${yearOpts}</select>
          </div>
          <div class="field" id="f-custom-dari-wrap" style="display:none">
            <label>Dari Tarikh</label>
            <input type="date" id="f-dari" />
          </div>
          <div class="field" id="f-custom-hingga-wrap" style="display:none">
            <label>Hingga Tarikh</label>
            <input type="date" id="f-hingga" />
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="btn-filter">🔍 Papar Hasil</button>
          <button class="btn btn-outline btn-sm" id="btn-reset-filter">↺ Set Semula Semua</button>
        </div>
        <div id="filter-summary" style="font-size:.75rem;color:var(--text-muted)"></div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header">
      <h3>📂 Semua Permohonan
        <span id="data-count" style="font-weight:400;font-size:.8rem;color:var(--text-muted)"></span>
      </h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <span id="csv-info" style="font-size:.72rem;color:var(--text-muted)"></span>
        <button class="btn btn-success btn-sm" id="btn-export">📥 Export CSV</button>
        ${isSuperAdmin(currentUser) ? `
        <span id="selected-count-label" style="font-size:.72rem;color:var(--text-muted);display:none"></span>
        <button class="btn btn-warning btn-sm" id="btn-delete-selected" onclick="confirmDeleteSelected()" style="display:none">
          🗑 Padam Dipilih
        </button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteAll()">⚠️ Padam Semua</button>` : ''}
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          ${isSuperAdmin(currentUser) ? '<th class="td-check"><input type="checkbox" id="chk-all" title="Pilih Semua" onchange="toggleSelectAll(this.checked)"/></th>' : '<th>#</th>'}
          <th>No. Rujukan</th><th>IC Pesakit</th><th>Nama Pesakit</th>
          <th>Fasiliti</th>
          <th>Jenis Pemeriksaan</th><th>Tarikh X-Ray</th>
          <th>Tarikh Permohonan</th><th>Hari Mohon</th>
          <th>Daftar RIS</th><th>Hari RIS</th>
          <th>Status</th><th>Dikemas kini</th><th>Tindakan</th>
        </tr></thead>
        <tbody id="table-body-${tableId}"></tbody>
      </table>
    </div>
    <div class="pagination" id="pagination-${tableId}"></div>
  </div>
  <div id="detail-modal-area"></div>`;
}

// ============================================================
//  TOGGLE FILTER PANEL (lipat/buka)
// ============================================================
function toggleFilterPanel() {
  const body = document.getElementById('filter-panel-body');
  const icon = document.getElementById('filter-toggle-icon');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? '' : 'none';
  if (icon) icon.textContent = isHidden ? '▲ Sembunyikan' : '▼ Paparkan';
}

// ============================================================
//  TEMPOH JENIS CHANGE — tunjuk/sembunyi medan berkaitan
// ============================================================
function onTempohJenisChange() {
  const jenis = document.getElementById('f-tempoh-jenis')?.value || '';
  const bulanWrap  = document.getElementById('f-bulan-wrap');
  const tahunWrap  = document.getElementById('f-tahun-wrap');
  const dariWrap   = document.getElementById('f-custom-dari-wrap');
  const hinggaWrap = document.getElementById('f-custom-hingga-wrap');
  if (bulanWrap)  bulanWrap.style.display  = (jenis === 'bulanan') ? '' : 'none';
  if (tahunWrap)  tahunWrap.style.display  = (jenis === 'bulanan' || jenis === 'tahunan') ? '' : 'none';
  if (dariWrap)   dariWrap.style.display   = (jenis === 'custom') ? '' : 'none';
  if (hinggaWrap) hinggaWrap.style.display = (jenis === 'custom') ? '' : 'none';
  applyFilter();
}

function bindTableEvents() {
  const btnFilter = document.getElementById('btn-filter');
  const btnReset  = document.getElementById('btn-reset-filter');
  const btnExport = document.getElementById('btn-export');
  if (btnFilter) btnFilter.addEventListener('click', applyFilter);
  if (btnReset)  btnReset.addEventListener('click', resetFilter);
  if (btnExport) btnExport.addEventListener('click', exportCSVUser);

  // Auto-format No. IC — digit sahaja
  const icField = document.getElementById('f-ic-cari');
  if (icField) {
    icField.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 12);
    });
  }

  // Auto-apply on change for all filter inputs
  ['f-search','f-ic-cari','f-status','f-facility','f-dari','f-hingga',
   'f-jenis-filter','f-xray-dari','f-xray-hingga','f-bulan','f-tahun'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilter);
    if (el && el.tagName === 'INPUT') el.addEventListener('keyup', applyFilter);
  });
  applyFilter();
}

function applyFilter() {
  const isAdmin = isAdminRole(currentUser);
  let data = isAdmin ? [...permohonanData] : permohonanData.filter(p => p.submittedBy === currentUser.id);

  const search    = document.getElementById('f-search')?.value.toLowerCase().trim() || '';
  const icCari    = document.getElementById('f-ic-cari')?.value.trim() || '';
  const status    = document.getElementById('f-status')?.value || '';
  const facility  = document.getElementById('f-facility')?.value || '';
  const jenis     = document.getElementById('f-jenis-filter')?.value || '';
  const xrayDari  = document.getElementById('f-xray-dari')?.value || '';
  const xrayHingga= document.getElementById('f-xray-hingga')?.value || '';
  const tempohJenis = document.getElementById('f-tempoh-jenis')?.value || '';
  const bulan     = document.getElementById('f-bulan')?.value || '';
  const tahun     = document.getElementById('f-tahun')?.value || '';
  const dariCustom  = document.getElementById('f-dari')?.value || '';
  const hinggaCustom= document.getElementById('f-hingga')?.value || '';

  if (search)   data = data.filter(p =>
    p.namaPesakit.toLowerCase().includes(search) ||
    p.noRef.toLowerCase().includes(search) ||
    p.namaDokter?.toLowerCase().includes(search)
  );
  if (icCari)   data = data.filter(p => p.noIC.includes(icCari));
  if (status)   data = data.filter(p => p.status === status);
  if (facility) data = data.filter(p => p.facilityCode === facility);
  if (jenis)    data = data.filter(p => p.jenisXray === jenis);

  // Filter tarikh pemeriksaan X-ray
  if (xrayDari)   data = data.filter(p => p.tarikhXray >= xrayDari);
  if (xrayHingga) data = data.filter(p => p.tarikhXray <= xrayHingga);

  // Filter tempoh berdasarkan tarikh dihantar
  if (tempohJenis === 'bulanan' && bulan && tahun) {
    data = data.filter(p => {
      const d = new Date(p.submittedAt);
      return String(d.getMonth() + 1).padStart(2,'0') === bulan &&
             String(d.getFullYear()) === String(tahun);
    });
  } else if (tempohJenis === 'tahunan' && tahun) {
    data = data.filter(p => new Date(p.submittedAt).getFullYear() === Number(tahun));
  } else if (tempohJenis === 'custom') {
    if (dariCustom)   data = data.filter(p => p.submittedAt >= dariCustom);
    if (hinggaCustom) data = data.filter(p => p.submittedAt <= hinggaCustom + 'T23:59:59');
  }

  filteredData = data;
  currentPageNum = 1;

  // Kemas kini ringkasan filter aktif
  const activeFilters = [
    search    && `Nama: "${search}"`,
    icCari    && `IC: ${icCari}`,
    status    && `Status: ${STATUS_MAP[status]?.label}`,
    facility  && `Fasiliti: ${permohonanData.find(p => p.facilityCode === facility)?.facilityName || facility}`,
    jenis     && `Jenis: ${jenis}`,
    xrayDari  && `X-Ray dari: ${formatDate(xrayDari)}`,
    xrayHingga&& `X-Ray hingga: ${formatDate(xrayHingga)}`,
    tempohJenis === 'bulanan' && bulan && tahun &&
      `Bulan: ${['','Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogs','Sep','Okt','Nov','Dis'][Number(bulan)]} ${tahun}`,
    tempohJenis === 'tahunan' && tahun && `Tahun: ${tahun}`,
    tempohJenis === 'custom' && dariCustom && `Dari: ${formatDate(dariCustom)}`,
    tempohJenis === 'custom' && hinggaCustom && `Hingga: ${formatDate(hinggaCustom)}`,
  ].filter(Boolean);

  const sumEl = document.getElementById('filter-summary');
  const lblEl = document.getElementById('filter-active-label');
  if (sumEl) sumEl.textContent = activeFilters.length ? `🔵 Filter aktif: ${activeFilters.join(' · ')}` : '';
  if (lblEl) lblEl.textContent = activeFilters.length ? `${activeFilters.length} filter aktif` : '';

  const csvInfoEl = document.getElementById('csv-info');
  if (csvInfoEl) csvInfoEl.textContent = `${data.length} rekod akan dimuat turun`;

  const tableId = isAdmin ? (currentPage === 'kemaskini' ? 'kemaskini' : 'all-applications') : 'permohonan-saya';
  renderTableBody(tableId, isAdmin);
}

function resetFilter() {
  ['f-search','f-ic-cari','f-status','f-facility','f-dari','f-hingga',
   'f-jenis-filter','f-xray-dari','f-xray-hingga','f-bulan','f-tahun'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const tj = document.getElementById('f-tempoh-jenis');
  if (tj) { tj.value = ''; onTempohJenisChange(); }
  applyFilter();
}

function renderTableBody(tableId, isAdmin) {
  const tbody = document.getElementById(`table-body-${tableId}`);
  const pag   = document.getElementById(`pagination-${tableId}`);
  const count = document.getElementById('data-count');
  if (!tbody) return;

  const isSA = isSuperAdmin(currentUser);
  const total = filteredData.length;
  const start = (currentPageNum - 1) * PAGE_SIZE;
  const pageData = filteredData.slice(start, start + PAGE_SIZE);

  if (count) count.textContent = `(${total} rekod)`;

  // Kolum: admin = 14, user = 14
  const colSpan = 14;

  if (pageData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colSpan}">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h4>Tiada rekod dijumpai</h4>
        <p>Cuba ubah kriteria carian atau tetapkan semula penapis.</p>
      </div>
    </td></tr>`;
    if (pag) pag.innerHTML = '';
    return;
  }

  if (isAdmin) {
    // Paparan Admin / Super Admin — termasuk kolum Daftar RIS & Hari RIS
    tbody.innerHTML = pageData.map((p, i) => `
      <tr id="row-${p.id}" ${selectedIds.has(p.id) ? 'style="background:#eff8ff"' : ''}>
        ${isSA
          ? `<td class="td-check"><input type="checkbox" class="row-chk" data-id="${p.id}" ${selectedIds.has(p.id) ? 'checked' : ''} onchange="toggleRowSelect('${p.id}',this.checked)"/></td>`
          : `<td style="color:var(--text-muted);font-size:.72rem">${start + i + 1}</td>`}
        <td><span style="font-size:.72rem;color:var(--primary);font-weight:600">${p.noRef}</span>
          ${p.noAccession ? `<br><span style="font-size:.68rem;color:var(--text-muted)">Acc: ${p.noAccession}</span>` : ''}
        </td>
        <td><span style="font-family:monospace;font-size:.82rem">${p.noIC}</span></td>
        <td><strong style="font-size:.85rem">${p.namaPesakit}</strong>
          <br><span style="font-size:.7rem;color:var(--text-muted)">${p.jantina}</span>
        </td>
        <td><span style="font-size:.78rem">${p.facilityName}</span></td>
        <td style="font-size:.8rem">${p.jenisXray}<br><span style="font-size:.7rem;color:var(--text-muted)">${p.bahagian}</span></td>
        <td style="font-size:.78rem">${formatDate(p.tarikhXray)}</td>
        <td style="font-size:.75rem">${formatDate(p.submittedAt)}</td>
        <td>${hariPermohonanBadge(p.submittedAt)}</td>
        <td style="font-size:.75rem">${p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : '<span style="color:var(--text-light);font-style:italic">—</span>'}</td>
        <td>${risBadgeHTML(p.tarikhDaftarRIS || '', p.status, p.submittedAt, p.updatedAt)}</td>
        <td>${statusBadge(p.status)}</td>
        <td style="font-size:.72rem;color:var(--text-muted)">${p.updatedAt ? formatDateTime(p.updatedAt) + '<br>' + timeAgo(p.updatedAt) : '-'}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-outline btn-xs" onclick="showDetail('${p.id}')">🔍</button>
            <button class="btn btn-primary btn-xs" onclick="openAdminEdit('${p.id}')">✏️ Edit</button>
            <button class="btn btn-grey btn-xs" onclick="printPermohonan('${p.id}')" title="Cetak">🖨️</button>
            ${p.status !== 'rejected' ? `<button class="btn btn-gold btn-xs" onclick="openRejectPermohonan('${p.id}')">🚫 Tolak</button>` : ''}
            ${isSA ? `<button class="btn btn-danger btn-xs" onclick="confirmDeleteSingle('${p.id}')">🗑</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
  } else {
    // Paparan User Biasa — termasuk kolum Daftar RIS & Hari RIS (read-only)
    tbody.innerHTML = pageData.map((p, i) => {
      const isRejected = p.status === 'rejected';
      const catatan = isRejected
        ? `<span style="font-size:.7rem;color:#7f1d1d;background:#fde8eb;border:1px solid #fca5a5;padding:3px 7px;border-radius:4px;display:inline-block;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600" title="DITOLAK: ${p.rejectReason || p.adminRemark || ''}">🚫 ${p.rejectReason || p.adminRemark || 'Ditolak'}</span>`
        : (p.adminRemark
          ? `<span style="font-size:.7rem;color:#164e63;background:var(--info-light);padding:2px 6px;border-radius:4px;display:inline-block;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${p.adminRemark}">${p.adminRemark}</span>`
          : `<span style="font-size:.7rem;color:var(--text-light)">—</span>`);
      return `
      <tr style="${isRejected ? 'background:#fff8f8;' : ''}">
        <td style="color:var(--text-muted);font-size:.72rem">${start + i + 1}</td>
        <td>
          <span style="font-size:.72rem;color:var(--primary);font-weight:600">${p.noRef}</span>
          ${p.noAccession ? `<br><span style="font-size:.68rem;color:var(--success)">✅ Acc: ${p.noAccession}</span>` : ''}
        </td>
        <td><span style="font-family:monospace;font-size:.82rem">${p.noIC}</span></td>
        <td>
          <strong style="font-size:.85rem">${p.namaPesakit}</strong>
          <br><span style="font-size:.7rem;color:var(--text-muted)">${p.jantina}</span>
        </td>
        <td style="font-size:.8rem">${p.jenisXray}</td>
        <td style="font-size:.78rem;color:var(--text-muted)">${p.bahagian}</td>
        <td style="font-size:.78rem">${formatDate(p.tarikhXray)}</td>
        <td style="font-size:.75rem">${formatDate(p.submittedAt)}</td>
        <td>${hariPermohonanBadge(p.submittedAt)}</td>
        <td style="font-size:.75rem">${p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : '<span style="color:var(--text-light);font-style:italic">—</span>'}</td>
        <td>${risBadgeHTML(p.tarikhDaftarRIS || '', p.status, p.submittedAt, p.updatedAt)}</td>
        <td>${statusBadge(p.status)}</td>
        <td>${catatan}</td>
        <td>
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-outline btn-xs" onclick="showDetail('${p.id}')">🔍 Lihat</button>
            ${p.status === 'pending' ? `<button class="btn btn-warning btn-xs" onclick="editMyPermohonan('${p.id}')">📝 Edit</button>` : ''}
            <button class="btn btn-grey btn-xs" onclick="printPermohonan('${p.id}')">🖨️</button>
            ${p.laporanNama && p.laporanData ? `<a href="${p.laporanData}" download="${p.laporanNama}" class="btn btn-success btn-xs" title="${p.laporanNama}">⬇ Laporan</a>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (pag && totalPages > 1) {
    let pages = `<span>Menunjukkan ${start + 1}–${Math.min(start + PAGE_SIZE, total)} daripada ${total}</span>`;
    pages += `<div class="page-btns">
      <button class="page-btn" onclick="goPage(${currentPageNum - 1},'${tableId}',${isAdmin})" ${currentPageNum === 1 ? 'disabled' : ''}>‹</button>`;
    for (let p2 = 1; p2 <= totalPages; p2++) {
      if (p2 === 1 || p2 === totalPages || Math.abs(p2 - currentPageNum) <= 1)
        pages += `<button class="page-btn ${p2 === currentPageNum ? 'active' : ''}" onclick="goPage(${p2},'${tableId}',${isAdmin})">${p2}</button>`;
      else if (Math.abs(p2 - currentPageNum) === 2)
        pages += `<button class="page-btn" disabled>…</button>`;
    }
    pages += `<button class="page-btn" onclick="goPage(${currentPageNum + 1},'${tableId}',${isAdmin})" ${currentPageNum === totalPages ? 'disabled' : ''}>›</button></div>`;
    pag.innerHTML = pages;
  } else if (pag) {
    pag.innerHTML = `<span>Jumlah ${total} rekod</span>`;
  }
}

function goPage(p, tableId, isAdmin) {
  currentPageNum = p;
  renderTableBody(tableId, isAdmin);
}

// ============================================================
//  JEJAK STATUS
// ============================================================
function renderJejakStatus() {
  return `
  <div class="card" style="max-width:700px;margin-bottom:20px">
    <div class="card-header"><h3>🔍 Jejak Status Permohonan</h3></div>
    <div class="card-body">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:200px">
          <label>Nombor IC Pesakit</label>
          <input type="text" id="jejak-ic" placeholder="12 digit tanpa -" maxlength="12" />
        </div>
        <div class="field" style="flex:1;min-width:200px">
          <label>No. Rujukan / Accession</label>
          <input type="text" id="jejak-ref" placeholder="RAD-XXXX-XXXXX" />
        </div>
        <div class="field" style="align-self:flex-end">
          <button class="btn btn-primary" id="btn-jejak">🔍 Jejak</button>
        </div>
      </div>
    </div>
  </div>
  <div id="jejak-result"></div>`;
}

function bindJejakEvents() {
  document.getElementById('btn-jejak').addEventListener('click', doJejak);
  document.getElementById('jejak-ic').addEventListener('keydown', e => { if (e.key === 'Enter') doJejak(); });
  document.getElementById('jejak-ref').addEventListener('keydown', e => { if (e.key === 'Enter') doJejak(); });
  document.getElementById('jejak-ic').addEventListener('input', function() { this.value = this.value.replace(/\D/g, '').slice(0, 12); });
}

function doJejak() {
  const ic  = document.getElementById('jejak-ic').value.trim();
  const ref = document.getElementById('jejak-ref').value.trim().toLowerCase();
  const isAdmin = isAdminRole(currentUser);
  let results = isAdmin ? permohonanData : permohonanData.filter(p => p.submittedBy === currentUser.id);

  if (!ic && !ref) { showToast('warning', '⚠ Sila isi sekurang-kurangnya satu medan carian.', ''); return; }
  if (ic) results = results.filter(p => p.noIC === ic);
  if (ref) results = results.filter(p => p.noRef.toLowerCase().includes(ref) || (p.noAccession || '').toLowerCase().includes(ref));

  const area = document.getElementById('jejak-result');
  if (results.length === 0) {
    area.innerHTML = `<div class="card"><div class="card-body"><div class="empty-state"><div class="empty-icon">🔍</div><h4>Tiada rekod dijumpai</h4><p>Semak semula nombor IC atau no. rujukan.</p></div></div></div>`;
    return;
  }
  area.innerHTML = results.map(p => renderJejakCard(p)).join('');
}

function renderJejakCard(p) {
  const steps = ['pending','registered','inprogress','done'];
  const stepLabels = ['Dihantar','Didaftar','Disedia','Siap Laporan'];
  const curIdx = steps.indexOf(p.status);
  const trackHtml = steps.map((s, i) => `
    <div class="track-step ${i < curIdx ? 'done' : i === curIdx ? 'active' : ''}">
      <div class="step-circle">${i < curIdx ? '✓' : i + 1}</div>
      <div class="step-label">${stepLabels[i]}</div>
    </div>`).join('');

  return `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div>
        <h3>📋 ${p.namaPesakit}</h3>
        <span style="font-size:.72rem;color:var(--text-muted)">${p.noRef}</span>
      </div>
      ${statusBadge(p.status)}
    </div>
    <div class="card-body">
      <div class="progress-track" style="margin-bottom:20px">${trackHtml}</div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">No. IC</div><div class="detail-value">${p.noIC}</div></div>
        <div class="detail-item"><div class="detail-label">Jantina</div><div class="detail-value">${p.jantina}</div></div>
        <div class="detail-item"><div class="detail-label">Jenis Pemeriksaan</div><div class="detail-value">${p.jenisXray}</div></div>
        <div class="detail-item"><div class="detail-label">Bahagian</div><div class="detail-value">${p.bahagian}</div></div>
        <div class="detail-item"><div class="detail-label">Tarikh X-Ray</div><div class="detail-value">${formatDate(p.tarikhXray)}</div></div>
        <div class="detail-item"><div class="detail-label">📅 Tarikh Permohonan</div><div class="detail-value">${formatDate(p.submittedAt)}</div></div>
        <div class="detail-item"><div class="detail-label">⏱ Tempoh Permohonan</div><div class="detail-value">${hariPermohonanBadge(p.submittedAt, false)}</div></div>
        <div class="detail-item"><div class="detail-label">Fasiliti</div><div class="detail-value">${p.facilityName}</div></div>
        ${p.noAccession ? `<div class="detail-item"><div class="detail-label">No. Accession</div><div class="detail-value">${p.noAccession}</div></div>` : ''}
        <div class="detail-item"><div class="detail-label">Dikemas kini</div><div class="detail-value">${formatDateTime(p.updatedAt)}</div></div>
      </div>
      ${p.status === 'done' ? (() => {
        const hariSiap = hitungHariSiap(p.submittedAt, p.updatedAt);
        const labelSiap = hariSiap === 0 ? 'hari yang sama' : `${hariSiap} hari`;
        return `<div style="margin-top:12px;padding:12px 14px;border-radius:var(--radius);background:#d8f0e6;border:1.5px solid #6fcf97;color:#145a32;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:10px">
          <span style="font-size:1.3rem">✅</span>
          <span>Laporan telah siap. Masa penyediaan: <strong>${labelSiap}</strong> dari tarikh permohonan diterima.</span>
        </div>`;
      })() : (p.tarikhDaftarRIS ? (() => {
        const h = hitungHariRIS(p.tarikhDaftarRIS);
        if (h > 15) return '';
        if (h >= 14) return `<div style="margin-top:10px;padding:8px 12px;border-radius:var(--radius);background:#fee2e2;color:#dc2626;font-size:.78rem;font-weight:600">🔴 Kritikal: Sudah <strong>${h} hari</strong> dari tarikh daftar RIS.</div>`;
        if (h >= 9)  return `<div style="margin-top:10px;padding:8px 12px;border-radius:var(--radius);background:#ede9fe;color:#7c3aed;font-size:.78rem;font-weight:600">🟣 Amaran: Sudah <strong>${h} hari</strong> dari tarikh daftar RIS.</div>`;
        return '';
      })() : '')}
      ${p.adminRemark ? `<div class="remark-box">💬 <strong>Catatan HUS:</strong> ${p.adminRemark}</div>` : ''}
      ${p.laporanNama && p.laporanData ? `
        <div style="background:var(--success-light);border:1.5px solid var(--success);border-radius:var(--radius);padding:14px 16px;margin-top:12px">
          <div style="font-size:.75rem;font-weight:700;color:var(--success);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">✅ Laporan Radiologi Telah Siap</div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:1.6rem">📄</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.85rem;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.laporanNama}</div>
              <div style="font-size:.7rem;color:var(--text-muted)">${p.laporanSaiz||''}</div>
            </div>
            <a href="${p.laporanData}" download="${p.laporanNama}" class="btn btn-success btn-sm">⬇ Muat Turun Laporan</a>
          </div>
        </div>` : ''}
      <div style="display:flex;justify-content:flex-end;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <button class="btn btn-grey btn-sm" onclick="printPermohonan('${p.id}')">🖨️ Cetak Borang</button>
      </div>
    </div>
  </div>`;
}

// ============================================================
//  ADMIN KEMASKINI
// ============================================================
function renderKemaskini() {
  return renderAdminTable(permohonanData, 'kemaskini');
}
function bindKemaskiniEvents() { bindTableEvents(); }

function openAdminEdit(id) {
  const p = permohonanData.find(r => r.id === id);
  if (!p) return;
  const existing = document.getElementById('admin-edit-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'admin-edit-modal';
  // risInfo dalam modal edit: tunjuk amaran walaupun done, supaya admin tahu sejarah RIS
  const risInfo = p.tarikhDaftarRIS
    ? `<div style="margin-top:6px">${risBadgeHTML(p.tarikhDaftarRIS)}</div>` : '';
  const jenisXrayList = ['Chest X-Ray','Skull X-Ray','Spine X-Ray','Abdomen X-Ray',
    'Pelvis X-Ray','Upper Extremities X-Ray','Lower Extremities X-Ray',
    'Dental X-Ray','Fluoroscopy','Mammography','Bone Age','Lain-lain'];

  overlay.innerHTML = `
  <div class="modal" style="max-width:720px">
    <div class="modal-header">
      <h3>✏️ Edit Penuh Permohonan — Admin</h3>
      <button class="modal-close" onclick="document.getElementById('admin-edit-modal').remove()">✕</button>
    </div>
    <div class="modal-body" style="max-height:75vh;overflow-y:auto">

      <!-- TAB NAVIGATION -->
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
        <button onclick="switchEditTab('tab-status')" id="etab-status"
          style="padding:8px 16px;border:none;background:var(--primary);color:white;font-weight:700;font-size:.82rem;cursor:pointer;border-radius:var(--radius) var(--radius) 0 0">
          📋 Status & RIS
        </button>
        <button onclick="switchEditTab('tab-pesakit')" id="etab-pesakit"
          style="padding:8px 16px;border:none;background:var(--surface2);color:var(--text-muted);font-size:.82rem;cursor:pointer;border-radius:var(--radius) var(--radius) 0 0">
          👤 Data Pesakit
        </button>
        <button onclick="switchEditTab('tab-pemeriksaan')" id="etab-pemeriksaan"
          style="padding:8px 16px;border:none;background:var(--surface2);color:var(--text-muted);font-size:.82rem;cursor:pointer;border-radius:var(--radius) var(--radius) 0 0">
          🩻 Pemeriksaan
        </button>
        <button onclick="switchEditTab('tab-laporan')" id="etab-laporan"
          style="padding:8px 16px;border:none;background:var(--surface2);color:var(--text-muted);font-size:.82rem;cursor:pointer;border-radius:var(--radius) var(--radius) 0 0">
          📄 Laporan Siap
        </button>
      </div>

      <!-- TAB: STATUS & RIS -->
      <div id="tab-status">
        <div style="background:var(--surface2);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;font-size:.8rem;border:1px solid var(--border)">
          📌 <strong>${p.noRef}</strong> · ${p.facilityName}
        </div>
        <div class="form-row">
          <div class="field">
            <label>Status Permohonan <span class="req">*</span></label>
            <select id="ae-status">
              <option value="pending" ${p.status==='pending'?'selected':''}>⏳ Menunggu</option>
              <option value="registered" ${p.status==='registered'?'selected':''}>📋 Telah Didaftar</option>
              <option value="inprogress" ${p.status==='inprogress'?'selected':''}>🔬 Sedang Disedia</option>
              <option value="done" ${p.status==='done'?'selected':''}>✅ Laporan Siap</option>
              <option value="rejected" ${p.status==='rejected'?'selected':''}>❌ Ditolak</option>
            </select>
          </div>
          <div class="field">
            <label>No. Accession (HUS)</label>
            <input type="text" id="ae-accession" placeholder="ACC-XXXX-XXX" value="${p.noAccession||''}" />
          </div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:14px">
          <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-bottom:10px">🗃 Pendaftaran RIS</div>
          <div class="form-row">
            <div class="field">
              <label>Tarikh Daftar ke RIS</label>
              <input type="date" id="ae-ris-tarikh" value="${p.tarikhDaftarRIS||''}"
                max="${new Date().toISOString().split('T')[0]}"
                onchange="previewRIS(this.value)" />
              <span class="hint">Kosongkan jika belum didaftar ke RIS</span>
            </div>
            <div class="field" style="display:flex;flex-direction:column;justify-content:flex-end">
              <label>Kiraan Hari Semasa</label>
              <div id="ae-ris-preview" style="padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);min-height:36px;display:flex;align-items:center">
                ${p.tarikhDaftarRIS ? risHariHTML(p.tarikhDaftarRIS,false) : '<span style="font-size:.78rem;color:var(--text-light);font-style:italic">Tiada tarikh dipilih</span>'}
              </div>
            </div>
          </div>
          ${risInfo}
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>Catatan Admin / Remark</label>
          <textarea id="ae-remark" rows="3" placeholder="Masukkan catatan atau maklumbalas...">${p.adminRemark||''}</textarea>
        </div>
        <div class="field">
          <label>Catatan kepada Pemohon</label>
          <textarea id="ae-remark2" rows="2" placeholder="Catatan kepada klinik / hospital pemohon...">${p.remark||''}</textarea>
        </div>
      </div>

      <!-- TAB: DATA PESAKIT -->
      <div id="tab-pesakit" style="display:none">
        <div style="background:var(--warning-light);border:1px solid #fde68a;border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:#78350f;margin-bottom:14px">
          ⚠️ Hanya ubah jika terdapat kesilapan maklumat pesakit. Semua perubahan dilog secara automatik.
        </div>
        <div class="form-row">
          <div class="field">
            <label>No. IC Pesakit <span class="req">*</span></label>
            <input type="text" id="ae-ic" value="${p.noIC}" maxlength="12" placeholder="12 digit tanpa -"
              oninput="this.value=this.value.replace(/\\D/g,'').slice(0,12)" />
          </div>
          <div class="field">
            <label>Nama Penuh Pesakit <span class="req">*</span></label>
            <input type="text" id="ae-nama" value="${p.namaPesakit||''}" placeholder="NAMA PENUH" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Jantina <span class="req">*</span></label>
            <select id="ae-jantina">
              <option value="Lelaki" ${p.jantina==='Lelaki'?'selected':''}>Lelaki</option>
              <option value="Perempuan" ${p.jantina==='Perempuan'?'selected':''}>Perempuan</option>
            </select>
          </div>
          <div class="field">
            <label>No. Telefon</label>
            <input type="text" id="ae-tel" value="${p.noTelefon||''}" placeholder="cth: 0123456789" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Tarikh Lahir</label>
            <input type="date" id="ae-dob" value="${p.tarikh||''}" />
          </div>
          <div class="field"></div>
        </div>
      </div>

      <!-- TAB: PEMERIKSAAN -->
      <div id="tab-pemeriksaan" style="display:none">
        <div class="form-row">
          <div class="field">
            <label>Jenis Pemeriksaan X-Ray <span class="req">*</span></label>
            <select id="ae-jenis-xray">
              ${jenisXrayList.map(j => `<option value="${j}" ${p.jenisXray===j?'selected':''}>${j}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Bahagian / Pandangan <span class="req">*</span></label>
            <input type="text" id="ae-bahagian" value="${p.bahagian||''}" placeholder="cth: PA, Lateral, AP" />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Tarikh Pemeriksaan X-Ray <span class="req">*</span></label>
            <input type="date" id="ae-tarikh-xray" value="${p.tarikhXray||''}" />
          </div>
          <div class="field">
            <label>Nama Doktor / Pegawai Perubatan <span class="req">*</span></label>
            <input type="text" id="ae-doktor" value="${p.namaDokter||''}" placeholder="NAMA DOKTOR" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
          </div>
        </div>
        <div class="form-row single">
          <div class="field">
            <label>Indikasi Klinikal <span class="req">*</span></label>
            <textarea id="ae-indikasi" rows="3" placeholder="Sebab pemeriksaan, diagnosis...">${p.indikasiKlinikal||''}</textarea>
          </div>
        </div>
      </div>

      <!-- TAB: LAPORAN SIAP -->
      <div id="tab-laporan" style="display:none">
        <div style="background:var(--success-light);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:#145a32;margin-bottom:16px">
          📄 Muat naik PDF laporan yang telah siap. Fail ini akan boleh dimuat turun oleh pemohon melalui paparan permohonan mereka.
        </div>

        ${p.laporanNama ? `
        <div style="margin-bottom:14px">
          <div style="font-size:.78rem;font-weight:700;color:var(--text-muted);margin-bottom:6px">Laporan Semasa:</div>
          <div class="upload-preview" style="display:flex">
            <span class="upload-file-icon">📄</span>
            <span class="upload-file-name">${p.laporanNama}</span>
            <span class="upload-file-size">${p.laporanSaiz||''}</span>
            ${p.laporanData ? `<a href="${p.laporanData}" download="${p.laporanNama}" class="btn btn-sm btn-success" style="margin-left:auto">⬇ Muat Turun</a>` : ''}
            <button type="button" class="upload-remove" onclick="clearAdminLaporan()" title="Buang laporan">✕</button>
          </div>
        </div>` : ''}

        <div class="field">
          <label>Muat Naik Laporan PDF Baharu ${p.laporanNama ? '(Gantikan Yang Sedia Ada)' : ''}</label>
          <div class="upload-wrap" id="ae-laporan-wrap">
            <input type="file" id="ae-laporan-input" accept="application/pdf" style="display:none" onchange="handleLaporanUpload(this)" />
            <div class="upload-box" onclick="document.getElementById('ae-laporan-input').click()">
              <div class="upload-icon">📤</div>
              <div class="upload-label">Klik untuk muat naik laporan PDF</div>
              <div class="upload-hint">Saiz maksimum: 500KB · Format: PDF sahaja</div>
            </div>
            <div class="upload-preview" id="ae-laporan-preview" style="display:none">
              <span class="upload-file-icon">📄</span>
              <span class="upload-file-name" id="ae-laporan-fname"></span>
              <span class="upload-file-size" id="ae-laporan-fsize"></span>
              <button type="button" class="upload-remove" onclick="removeAdminLaporan()" title="Buang fail">✕</button>
            </div>
          </div>
          <span class="hint">Fail laporan ini boleh dimuat turun oleh semua pengguna (user) yang membuat permohonan ini sahaja.</span>
        </div>
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('admin-edit-modal').remove()">Batal</button>
      ${isSuperAdmin(currentUser) ? `<button class="btn btn-danger btn-sm" onclick="confirmDeleteSingle('${p.id}',true)">🗑 Padam Rekod</button>` : ''}
      <button class="btn btn-primary" onclick="saveAdminEdit('${p.id}')">💾 Simpan Semua Perubahan</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function switchEditTab(tabId) {
  ['tab-status','tab-pesakit','tab-pemeriksaan','tab-laporan'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === tabId) ? '' : 'none';
    const btn = document.getElementById('etab-' + id.replace('tab-',''));
    if (btn) {
      btn.style.background = (id === tabId) ? 'var(--primary)' : 'var(--surface2)';
      btn.style.color = (id === tabId) ? 'white' : 'var(--text-muted)';
      btn.style.fontWeight = (id === tabId) ? '700' : '400';
    }
  });
}

function saveAdminEdit(id) {
  const idx = permohonanData.findIndex(p => p.id === id);
  if (idx === -1) return;
  const oldStatus = permohonanData[idx].status;
  const oldRIS    = permohonanData[idx].tarikhDaftarRIS || '';
  const newRIS    = (document.getElementById('ae-ris-tarikh')?.value || '').trim();

  // Tab 1 — Status & RIS
  permohonanData[idx].status          = document.getElementById('ae-status').value;
  permohonanData[idx].noAccession     = document.getElementById('ae-accession').value.trim();
  permohonanData[idx].adminRemark     = document.getElementById('ae-remark').value.trim();
  permohonanData[idx].remark          = document.getElementById('ae-remark2').value.trim();
  permohonanData[idx].tarikhDaftarRIS = newRIS;

  // Tab 2 — Data Pesakit (jika medan wujud — bermakna tab telah diedit)
  const aeIc = document.getElementById('ae-ic');
  if (aeIc) {
    const ic = aeIc.value.replace(/\D/g,'').slice(0,12);
    const nama = (document.getElementById('ae-nama')?.value.trim() || '').toUpperCase();
    if (ic.length === 12 && nama) {
      permohonanData[idx].noIC        = ic;
      permohonanData[idx].namaPesakit = nama;
      permohonanData[idx].jantina     = document.getElementById('ae-jantina')?.value || permohonanData[idx].jantina;
      permohonanData[idx].noTelefon   = document.getElementById('ae-tel')?.value.trim() || '';
      permohonanData[idx].tarikh      = document.getElementById('ae-dob')?.value || '';
    }
  }

  // Tab 3 — Pemeriksaan (jika medan wujud)
  const aeJenis = document.getElementById('ae-jenis-xray');
  if (aeJenis) {
    const jenis    = aeJenis.value;
    const bahagian = document.getElementById('ae-bahagian')?.value.trim() || '';
    const tarikhXray = document.getElementById('ae-tarikh-xray')?.value || '';
    const doktor   = (document.getElementById('ae-doktor')?.value.trim() || '').toUpperCase();
    const indikasi = document.getElementById('ae-indikasi')?.value.trim() || '';
    if (jenis && bahagian && tarikhXray && doktor) {
      permohonanData[idx].jenisXray        = jenis;
      permohonanData[idx].bahagian         = bahagian;
      permohonanData[idx].tarikhXray       = tarikhXray;
      permohonanData[idx].namaDokter       = doktor;
      permohonanData[idx].indikasiKlinikal = indikasi;
    }
  }

  // Tab 4 — Laporan Siap
  const uploadedLaporan = window._uploadedLaporan || null;
  if (uploadedLaporan) {
    permohonanData[idx].laporanData = uploadedLaporan.data;
    permohonanData[idx].laporanNama = uploadedLaporan.nama;
    permohonanData[idx].laporanSaiz = uploadedLaporan.saiz;
    window._uploadedLaporan = null;
  } else if (window._clearAdminLaporan) {
    permohonanData[idx].laporanData = '';
    permohonanData[idx].laporanNama = '';
    permohonanData[idx].laporanSaiz = '';
    window._clearAdminLaporan = false;
  }

  permohonanData[idx].updatedAt  = new Date().toISOString();
  permohonanData[idx].updatedBy  = currentUser.id;
  saveData();

  const p = permohonanData[idx];
  if (p.status !== oldStatus) {
    addNotif('success', 'Status Dikemaskini',
      `${p.namaPesakit}: ${STATUS_MAP[oldStatus]?.label} → ${STATUS_MAP[p.status]?.label}`, 'success');
  }
  if (newRIS && newRIS !== oldRIS) {
    addNotif('info', 'Tarikh Daftar RIS Dikemaskini',
      `${p.namaPesakit} — Daftar RIS: ${formatDate(newRIS)}`, 'info');
  }
  showToast('success', '✅ Permohonan berjaya dikemaskini!',
    `Status: ${STATUS_MAP[p.status]?.label} · ${formatDateTime(p.updatedAt)}`);
  document.getElementById('admin-edit-modal')?.remove();
  updatePendingBadge();
  applyFilter();
}

// Preview kiraan hari RIS secara langsung dalam modal edit
function previewRIS(tarikhStr) {
  const preview = document.getElementById('ae-ris-preview');
  if (!preview) return;
  if (!tarikhStr) {
    preview.innerHTML = '<span style="font-size:.78rem;color:var(--text-light);font-style:italic">Tiada tarikh dipilih</span>';
    return;
  }
  preview.innerHTML = risHariHTML(tarikhStr, false);
}

// ============================================================
//  DELETE SINGLE RECORD — ADMIN SAHAJA
// ============================================================
function confirmDeleteSingle(id, fromModal = false) {
  if (!isSuperAdmin(currentUser)) {
    showToast('error', '🚫 Akses Dinafikan', 'Fungsi ini hanya untuk Super Admin.');
    return;
  }
  const p = permohonanData.find(r => r.id === id);
  if (!p) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'confirm-delete-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:440px">
    <div class="modal-header" style="background:var(--danger);color:white;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <h3 style="color:white">🗑 Padam Rekod Permohonan</h3>
      <button class="modal-close" onclick="document.getElementById('confirm-delete-modal').remove()"
        style="color:white;background:rgba(255,255,255,.2)">✕</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
        <div style="font-size:.95rem;font-weight:700;color:var(--text);margin-bottom:8px">
          Anda akan memadam rekod ini secara kekal!
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin:12px 0;text-align:left;font-size:.82rem">
          <strong>${p.namaPesakit}</strong><br>
          IC: ${p.noIC} · ${p.jenisXray}<br>
          <span style="color:var(--text-muted)">No. Rujukan: ${p.noRef} · ${p.facilityName}</span>
        </div>
        <div style="color:var(--danger);font-size:.82rem;font-weight:600">
          Tindakan ini tidak boleh dibuat asal. Teruskan?
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('confirm-delete-modal').remove()">❌ Batal</button>
      <button class="btn btn-danger" onclick="executeDeleteSingle('${id}',${fromModal})">🗑 Ya, Padam Rekod Ini</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function executeDeleteSingle(id, fromModal) {
  const idx = permohonanData.findIndex(p => p.id === id);
  if (idx === -1) return;
  const nama = permohonanData[idx].namaPesakit;
  permohonanData.splice(idx, 1);
  // Padam juga dari senarai admin permohonan jika rekod ini berasal dari sana
  const adminList = getAdminPermohonan().filter(p => p.id !== id);
  saveAdminPermohonan(adminList);
  saveData();
  document.getElementById('confirm-delete-modal')?.remove();
  if (fromModal) document.getElementById('admin-edit-modal')?.remove();
  showToast('success', '🗑 Rekod dipadam', `${nama} telah dipadamkan dari sistem.`);
  addNotif('warning', 'Rekod Dipadam', `Admin telah memadam rekod: ${nama}`, 'warning');
  updatePendingBadge();
  applyFilter();
}

// ============================================================
//  DELETE ALL — SUPER ADMIN SAHAJA (dwi-pengesahan)
// ============================================================
function confirmDeleteAll() {
  if (!isSuperAdmin(currentUser)) {
    showToast('error', '🚫 Akses Dinafikan', 'Fungsi ini hanya untuk Super Admin.');
    return;
  }
  const total = filteredData.length > 0 ? filteredData.length : permohonanData.length;
  const isFiltered = filteredData.length > 0 && filteredData.length < permohonanData.length;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'confirm-deleteall-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:480px">
    <div class="modal-header" style="background:#7f1d1d;color:white;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <h3 style="color:white">⛔ Padam ${isFiltered ? 'Rekod Ditapis' : 'SEMUA Rekod'}</h3>
      <button class="modal-close" onclick="document.getElementById('confirm-deleteall-modal').remove()"
        style="color:white;background:rgba(255,255,255,.2)">✕</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:16px 0">
        <div style="font-size:3rem;margin-bottom:12px">🚨</div>
        <div style="font-size:1rem;font-weight:800;color:#7f1d1d;margin-bottom:12px">
          AMARAN KRITIKAL
        </div>
        <div style="background:#fef2f2;border:2px solid var(--danger);border-radius:var(--radius);padding:14px;margin-bottom:14px;font-size:.85rem;color:#7f1d1d">
          Anda akan memadam <strong>${total} rekod${isFiltered ? ' (dalam paparan ditapis)' : ' (SEMUA rekod)'}</strong> secara kekal.<br>
          <strong>Tindakan ini TIDAK BOLEH dibuat asal.</strong>
        </div>
        <div class="field" style="text-align:left;margin-bottom:4px">
          <label style="font-size:.82rem;font-weight:700;color:var(--danger)">
            Taip <strong>PADAM SEMUA</strong> untuk sahkan:
          </label>
          <input type="text" id="deleteall-confirm-input"
            placeholder="Taip: PADAM SEMUA"
            style="border:2px solid var(--danger);border-radius:var(--radius);padding:9px 12px;width:100%;font-size:.85rem;outline:none;background:var(--surface2)" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('confirm-deleteall-modal').remove()">Batal — Selamat</button>
      <button class="btn btn-danger" onclick="executeDeleteAll(${isFiltered})">🗑 Padam Sekarang</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function executeDeleteAll(isFiltered) {
  const input = document.getElementById('deleteall-confirm-input')?.value.trim();
  if (input !== 'PADAM SEMUA') {
    showToast('error', '❌ Pengesahan gagal', 'Sila taip "PADAM SEMUA" untuk meneruskan.');
    return;
  }
  let deletedCount;
  if (isFiltered && filteredData.length > 0) {
    const idsToDelete = new Set(filteredData.map(p => p.id));
    deletedCount = idsToDelete.size;
    permohonanData = permohonanData.filter(p => !idsToDelete.has(p.id));
    // Padam juga dari admin permohonan
    saveAdminPermohonan(getAdminPermohonan().filter(p => !idsToDelete.has(p.id)));
  } else {
    deletedCount = permohonanData.length;
    permohonanData = [];
    // Padam semua admin permohonan juga
    saveAdminPermohonan([]);
  }
  filteredData = [];
  saveData();
  document.getElementById('confirm-deleteall-modal')?.remove();
  showToast('success', `🗑 ${deletedCount} rekod dipadam`, 'Semua rekod yang dipilih telah dipadamkan.');
  addNotif('warning', 'Rekod Dipadam Semua', `Admin memadam ${deletedCount} rekod dari sistem.`, 'warning');
  updatePendingBadge();
  applyFilter();
}

// ============================================================
//  SELECT ALL / SELECT ROW / DELETE SELECTED — SUPER ADMIN SAHAJA
// ============================================================
function toggleSelectAll(checked) {
  if (!isSuperAdmin(currentUser)) return;
  const checkboxes = document.querySelectorAll('.row-chk');
  checkboxes.forEach(cb => {
    const id = cb.dataset.id;
    cb.checked = checked;
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    const row = document.getElementById(`row-${id}`);
    if (row) row.style.background = checked ? '#eff8ff' : '';
  });
  updateSelectUI();
}

function toggleRowSelect(id, checked) {
  if (!isSuperAdmin(currentUser)) return;
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  const row = document.getElementById(`row-${id}`);
  if (row) row.style.background = checked ? '#eff8ff' : '';
  // Update "select all" checkbox
  const allChk = document.getElementById('chk-all');
  if (allChk) {
    const all = document.querySelectorAll('.row-chk');
    allChk.checked = all.length > 0 && [...all].every(cb => cb.checked);
    allChk.indeterminate = selectedIds.size > 0 && selectedIds.size < all.length;
  }
  updateSelectUI();
}

function updateSelectUI() {
  const btn = document.getElementById('btn-delete-selected');
  const lbl = document.getElementById('selected-count-label');
  if (btn) {
    if (selectedIds.size > 0) {
      btn.style.display = '';
      if (lbl) { lbl.style.display = ''; lbl.textContent = `${selectedIds.size} dipilih`; }
    } else {
      btn.style.display = 'none';
      if (lbl) lbl.style.display = 'none';
    }
  }
}

function confirmDeleteSelected() {
  if (!isSuperAdmin(currentUser)) return;
  if (selectedIds.size === 0) { showToast('warning', '⚠️ Tiada rekod dipilih', 'Sila pilih sekurang-kurangnya satu rekod.'); return; }
  const count = selectedIds.size;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'confirm-delsel-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:450px">
    <div class="modal-header" style="background:var(--danger);color:white;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <h3 style="color:white">🗑 Padam Rekod Dipilih</h3>
      <button class="modal-close" onclick="document.getElementById('confirm-delsel-modal').remove()"
        style="color:white;background:rgba(255,255,255,.2)">✕</button>
    </div>
    <div class="modal-body" style="text-align:center;padding:20px">
      <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
      <div style="font-weight:700;font-size:.95rem;margin-bottom:10px">Padam ${count} rekod yang dipilih?</div>
      <div style="background:#fce8e6;border:1px solid #f1948a;border-radius:var(--radius);padding:12px;font-size:.82rem;color:var(--danger);margin-bottom:12px">
        <strong>Tindakan ini tidak boleh dibuat asal.</strong><br>
        ${count} rekod akan dipadamkan secara kekal.
      </div>
      <div class="field" style="text-align:left;margin-bottom:4px">
        <label style="font-size:.82rem;font-weight:700;color:var(--danger)">
          Taip <strong>PADAM</strong> untuk sahkan:
        </label>
        <input type="text" id="delsel-confirm-input"
          placeholder="Taip: PADAM"
          style="border:2px solid var(--danger);border-radius:var(--radius);padding:9px 12px;width:100%;font-size:.85rem;outline:none;background:var(--surface2)" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('confirm-delsel-modal').remove()">Batal</button>
      <button class="btn btn-danger" onclick="executeDeleteSelected()">🗑 Padam Dipilih</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function executeDeleteSelected() {
  if (!isSuperAdmin(currentUser)) return;
  const input = document.getElementById('delsel-confirm-input')?.value.trim();
  if (input !== 'PADAM') {
    showToast('error', '❌ Pengesahan gagal', 'Sila taip "PADAM" untuk meneruskan.');
    return;
  }
  const count = selectedIds.size;
  const idsToDelete = new Set(selectedIds);
  permohonanData = permohonanData.filter(p => !idsToDelete.has(p.id));
  filteredData   = filteredData.filter(p => !idsToDelete.has(p.id));
  // Padam juga dari admin permohonan
  saveAdminPermohonan(getAdminPermohonan().filter(p => !idsToDelete.has(p.id)));
  selectedIds.clear();
  saveData();
  document.getElementById('confirm-delsel-modal')?.remove();
  showToast('success', `🗑 ${count} rekod dipadam`, 'Rekod terpilih telah dipadamkan.');
  addNotif('warning', 'Rekod Dipilih Dipadam', `Super Admin memadam ${count} rekod terpilih.`, 'warning');
  updatePendingBadge();
  applyFilter();
}

// ============================================================
//  REJECT PERMOHONAN — ADMIN dengan sebab bertaip
// ============================================================
function openRejectPermohonan(id) {
  const p = permohonanData.find(r => r.id === id);
  if (!p) return;
  const existing = document.getElementById('reject-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'reject-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:500px">
    <div class="modal-header" style="background:var(--danger);color:white;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <h3 style="color:white">🚫 Tolak Permohonan</h3>
      <button class="modal-close" onclick="document.getElementById('reject-modal').remove()"
        style="color:white;background:rgba(255,255,255,.2)">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:16px;font-size:.82rem">
        <strong>${p.namaPesakit}</strong> · IC: ${p.noIC}<br>
        <span style="color:var(--text-muted)">${p.noRef} · ${p.facilityName}</span>
      </div>
      <div class="field" style="margin-bottom:4px">
        <label>Sebab Penolakan <span class="req">*</span></label>
        <textarea id="reject-reason" rows="4"
          placeholder="Nyatakan sebab penolakan permohonan ini secara terperinci. Maklumat ini akan dipaparkan kepada pemohon..."
          style="width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:.85rem;color:var(--text);background:var(--surface2);outline:none;resize:vertical"
        ></textarea>
        <span style="font-size:.7rem;color:var(--text-muted)">Maklumat ini akan sampai kepada klinik/hospital/unit yang membuat permohonan.</span>
      </div>
      <div id="reject-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:9px 12px;font-size:.78rem;color:var(--danger);margin-top:10px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('reject-modal').remove()">Batal</button>
      <button class="btn btn-danger" onclick="executeRejectPermohonan('${id}')">🚫 Sahkan Tolak Permohonan</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  setTimeout(() => document.getElementById('reject-reason')?.focus(), 100);
}

function executeRejectPermohonan(id) {
  const reason = document.getElementById('reject-reason')?.value.trim() || '';
  const errDiv = document.getElementById('reject-error');
  if (!reason) {
    errDiv.style.display = 'block';
    errDiv.textContent = '⛔ Sila nyatakan sebab penolakan sebelum meneruskan.';
    return;
  }
  const idx = permohonanData.findIndex(p => p.id === id);
  if (idx === -1) return;
  const oldStatus = permohonanData[idx].status;
  permohonanData[idx].status      = 'rejected';
  permohonanData[idx].rejectReason = reason;
  permohonanData[idx].adminRemark  = `[DITOLAK] ${reason}`;
  permohonanData[idx].updatedAt    = new Date().toISOString();
  permohonanData[idx].updatedBy    = currentUser.id;
  saveData();
  const p = permohonanData[idx];
  // Notifikasi — akan dilihat oleh unit pemohon apabila mereka log masuk
  addNotif('warning', '🚫 Permohonan Ditolak',
    `${p.namaPesakit} (${p.noRef}) — Sebab: ${reason}`, 'warning');
  document.getElementById('reject-modal')?.remove();
  showToast('warning', '🚫 Permohonan ditolak', `${p.namaPesakit} · ${p.noRef}`);
  updatePendingBadge();
  applyFilter();
}

// ============================================================
//  URUS PENGGUNA — ADMIN & SUPER ADMIN
// ============================================================
function renderUrusPengguna() {
  const allUsers = getAllUsers();
  const dynamic  = getDynamicUsers();
  const isSA     = isSuperAdmin(currentUser);

  const roleLabel = u => {
    if (u.role === 'superadmin') return '<span style="font-size:.72rem;padding:2px 10px;border-radius:10px;font-weight:700;background:rgba(201,152,10,.15);color:var(--gold-dark)">👑 Super Admin</span>';
    if (u.role === 'admin')      return '<span style="font-size:.72rem;padding:2px 10px;border-radius:10px;font-weight:700;background:rgba(146,43,62,.15);color:var(--accent)">🛡️ Admin</span>';
    return '<span style="font-size:.72rem;padding:2px 10px;border-radius:10px;font-weight:700;background:rgba(30,132,73,.15);color:var(--success)">👤 User</span>';
  };

  const rows = allUsers.map(u => {
    const isDynamic = dynamic.some(d => d.id === u.id);
    // Protect superadmin from being edited/deleted by regular admin
    const canEdit   = isSA || (isAdminRole(currentUser) && u.role !== 'superadmin');
    const canDelete = isSA && isDynamic;
    return `
    <tr>
      <td><code style="background:var(--surface2);padding:2px 8px;border-radius:4px;font-size:.82rem;font-weight:700;color:var(--primary)">${u.id}</code></td>
      <td style="font-size:.85rem;font-weight:600">${u.name}</td>
      <td style="font-size:.78rem;color:var(--text-muted)">${u.unit}</td>
      <td>${roleLabel(u)}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${canEdit ? `
          <button class="btn btn-primary btn-xs" onclick="openEditUser('${u.id}')">✏️ Edit</button>
          <button class="btn btn-warning btn-xs" onclick="openTukarKataLaluan('${u.id}')">🔑 Kata Laluan</button>` : ''}
          ${canDelete ? `<button class="btn btn-danger btn-xs" onclick="confirmHapusUser('${u.id}')">🗑 Hapus</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
  ${isSA ? `
  <div class="card" style="margin-bottom:16px;border-left:4px solid var(--gold)">
    <div class="card-header" style="background:linear-gradient(to right,var(--gold-light),var(--white))">
      <h3>💾 Pengurusan Data Sistem <span style="font-size:.72rem;font-weight:400;color:var(--text-muted)">(Super Admin sahaja)</span></h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-gold btn-sm" onclick="backupData()">💾 Backup Data (JSON)</button>
        <button class="btn btn-warning btn-sm" onclick="openRestoreData()">📂 Pulih Semula (Restore)</button>
      </div>
    </div>
    <div class="card-body" style="font-size:.8rem;color:var(--text-muted);line-height:1.8">
      <strong>💾 Backup</strong> — Simpan semua data permohonan ke fail JSON untuk dipindahkan ke komputer lain atau sebagai salinan.<br>
      <strong>📂 Restore</strong> — Muatkan semula data dari fail backup JSON. Data semasa akan digantikan sepenuhnya.
    </div>
  </div>` : ''}
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <h3>👥 Pengurusan Pengguna Sistem</h3>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="openTambahPengguna()">➕ Tambah Pengguna</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>ID Pengguna</th><th>Nama Fasiliti</th><th>Unit / Keterangan</th>
          <th>Peranan</th><th>Tindakan</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <div class="card" style="max-width:680px">
    <div class="card-header"><h3>ℹ️ Panduan Pengurusan Pengguna</h3></div>
    <div class="card-body" style="font-size:.82rem;line-height:1.9;color:var(--text-muted)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-weight:700;color:var(--primary);margin-bottom:6px">👑 Super Admin</div>
          <ul style="margin-left:16px">
            <li>Semua fungsi Admin</li>
            <li>Padam rekod pesakit (tunggal/dipilih/semua)</li>
            <li>Edit & hapus pengguna dinamik</li>
            <li>Lihat semua akaun termasuk Admin</li>
          </ul>
        </div>
        <div>
          <div style="font-weight:700;color:var(--accent);margin-bottom:6px">🛡️ Admin</div>
          <ul style="margin-left:16px">
            <li>Tambah, edit pengguna (kecuali Super Admin)</li>
            <li>Tetap semula kata laluan pengguna</li>
            <li>Kemaskini status permohonan</li>
            <li>Tiada fungsi padam rekod/pengguna</li>
          </ul>
        </div>
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--grey-light);border-radius:var(--radius);font-size:.78rem">
        📌 Pengguna asal (${USERS.length} akaun) tidak boleh dipadam. Kata laluan boleh ditukar bila-bila masa.
      </div>
    </div>
  </div>`;
}

function bindUrusPenggunaEvents() {
  // No special bindings needed — semua melalui onclick
}

function openTambahPengguna() {
  const existing = document.getElementById('tambah-user-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'tambah-user-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h3>➕ Tambah Pengguna Baru</h3>
      <button class="modal-close" onclick="document.getElementById('tambah-user-modal').remove()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="field">
          <label>ID Pengguna <span class="req">*</span></label>
          <input type="text" id="nu-id" placeholder="cth: KK006 atau HSP003"
            oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')" />
          <span class="hint">ID mesti unik, huruf besar dan nombor sahaja, tiada ruang</span>
        </div>
        <div class="field">
          <label>Peranan <span class="req">*</span></label>
          <select id="nu-role">
            <option value="user">👤 User (Fasiliti Luar)</option>
            <option value="admin">🛡️ Admin (HUS)</option>
            ${isSuperAdmin(currentUser) ? '<option value="superadmin">👑 Super Admin (HUS)</option>' : ''}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Nama Fasiliti / Pengguna <span class="req">*</span></label>
          <input type="text" id="nu-name" placeholder="CTH: KK KOTA SAMARAHAN" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
        </div>
        <div class="field">
          <label>Kod Fasiliti <span class="req">*</span></label>
          <input type="text" id="nu-facility-code" placeholder="cth: KK-KTSAM"
            oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')" />
        </div>
      </div>
      <div class="form-row single">
        <div class="field">
          <label>Keterangan Unit <span class="req">*</span></label>
          <input type="text" id="nu-unit" placeholder="cth: Klinik Kesihatan Kota Samarahan" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Singkatan (maks 4 huruf) <span class="req">*</span></label>
          <input type="text" id="nu-short" placeholder="cth: KKS" maxlength="4"
            oninput="this.value=this.value.toUpperCase()" />
        </div>
        <div class="field">
          <label>Kata Laluan Awal <span class="req">*</span></label>
          <input type="text" id="nu-pwd" placeholder="Min 8 aksara" />
          <span class="hint">Pengguna boleh tukar kata laluan selepas log masuk</span>
        </div>
      </div>
      <div id="nu-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:9px 12px;font-size:.78rem;color:var(--danger);margin-top:8px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('tambah-user-modal').remove()">Batal</button>
      <button class="btn btn-primary" onclick="saveTambahPengguna()">💾 Tambah Pengguna</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function saveTambahPengguna() {
  const id         = document.getElementById('nu-id')?.value.trim() || '';
  const role       = document.getElementById('nu-role')?.value || 'user';
  const name       = document.getElementById('nu-name')?.value.trim().toUpperCase() || '';
  const facCode    = document.getElementById('nu-facility-code')?.value.trim() || '';
  const unit       = document.getElementById('nu-unit')?.value.trim() || '';
  const shortName  = document.getElementById('nu-short')?.value.trim() || '';
  const pwd        = document.getElementById('nu-pwd')?.value || '';
  const errDiv     = document.getElementById('nu-error');

  const errors = [];
  if (!id)                 errors.push('ID Pengguna diperlukan.');
  else if (!/^[A-Z0-9]+$/.test(id)) errors.push('ID hanya boleh mengandungi huruf besar dan nombor tanpa ruang.');
  else if (getAllUsers().some(u => u.id === id)) errors.push(`ID "${id}" sudah wujud dalam sistem.`);
  if (!name)               errors.push('Nama fasiliti diperlukan.');
  if (!facCode)            errors.push('Kod fasiliti diperlukan.');
  if (!unit)               errors.push('Keterangan unit diperlukan.');
  if (!shortName)          errors.push('Singkatan diperlukan.');
  if (!pwd || pwd.length < 8) errors.push('Kata laluan mesti sekurang-kurangnya 8 aksara.');

  if (errors.length) {
    errDiv.style.display = 'block';
    errDiv.innerHTML = errors.map(e => `⛔ ${e}`).join('<br>');
    return;
  }
  errDiv.style.display = 'none';

  const newUser = { id, password: pwd, role, name, unit, shortName, facilityCode: facCode };
  const dynamic = getDynamicUsers();
  dynamic.push(newUser);
  saveDynamicUsers(dynamic);
  savePassword(id, pwd);

  document.getElementById('tambah-user-modal')?.remove();
  showToast('success', `✅ Pengguna "${id}" ditambah!`, `${name} boleh log masuk sekarang.`);
  addNotif('info', 'Pengguna Baru Ditambah', `Admin menambah pengguna baru: ${id} — ${name}`, 'info');
  navigateTo('urus-pengguna');
}

// ============================================================
//  EDIT PENGGUNA (ADMIN & SUPER ADMIN)
// ============================================================
function openEditUser(userId) {
  const user = getAllUsers().find(u => u.id === userId);
  if (!user) return;
  const existing = document.getElementById('edit-user-modal');
  if (existing) existing.remove();
  const isSA = isSuperAdmin(currentUser);
  const canChangeRole = isSA; // only SA can change roles
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'edit-user-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:540px">
    <div class="modal-header">
      <h3>✏️ Edit Pengguna — ${user.id}</h3>
      <button class="modal-close" onclick="document.getElementById('edit-user-modal').remove()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--grey-light);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:.8rem;margin-bottom:16px">
        📌 ID Pengguna tidak boleh diubah. Kata laluan boleh ditukar di bahagian 🔑 Kata Laluan.
      </div>
      <div class="form-row">
        <div class="field">
          <label>ID Pengguna</label>
          <input type="text" value="${user.id}" disabled style="background:var(--grey-light);color:var(--text-muted);cursor:not-allowed" />
        </div>
        <div class="field">
          <label>Peranan ${canChangeRole ? '<span class="req">*</span>' : ''}</label>
          <select id="eu-role" ${!canChangeRole ? 'disabled' : ''}>
            <option value="user" ${user.role==='user'?'selected':''}>👤 User (Fasiliti Luar)</option>
            <option value="admin" ${user.role==='admin'?'selected':''}>🛡️ Admin (HUS)</option>
            ${canChangeRole ? `<option value="superadmin" ${user.role==='superadmin'?'selected':''}>👑 Super Admin (HUS)</option>` : ''}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Nama Fasiliti / Pengguna <span class="req">*</span></label>
          <input type="text" id="eu-name" value="${user.name}" placeholder="NAMA FASILITI" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" />
        </div>
        <div class="field">
          <label>Kod Fasiliti <span class="req">*</span></label>
          <input type="text" id="eu-facility-code" value="${user.facilityCode}"
            oninput="this.value=this.value.toUpperCase().replace(/\\s/g,'')" />
        </div>
      </div>
      <div class="form-row single">
        <div class="field">
          <label>Keterangan Unit <span class="req">*</span></label>
          <input type="text" id="eu-unit" value="${user.unit}" />
        </div>
      </div>
      <div class="form-row single">
        <div class="field">
          <label>Singkatan (maks 4 huruf) <span class="req">*</span></label>
          <input type="text" id="eu-short" value="${user.shortName}" maxlength="4"
            oninput="this.value=this.value.toUpperCase()" />
        </div>
      </div>
      <div id="eu-error" style="display:none;background:var(--danger-light);border:1px solid #f1948a;border-radius:var(--radius);padding:9px 12px;font-size:.78rem;color:var(--danger);margin-top:8px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('edit-user-modal').remove()">Batal</button>
      <button class="btn btn-warning btn-sm" onclick="openTukarKataLaluan('${user.id}');document.getElementById('edit-user-modal').remove()">🔑 Tukar Kata Laluan</button>
      <button class="btn btn-primary" onclick="saveEditUser('${user.id}')">💾 Simpan Perubahan</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function saveEditUser(userId) {
  const name     = document.getElementById('eu-name')?.value.trim().toUpperCase() || '';
  const facCode  = document.getElementById('eu-facility-code')?.value.trim() || '';
  const unit     = document.getElementById('eu-unit')?.value.trim() || '';
  const shortN   = document.getElementById('eu-short')?.value.trim() || '';
  const role     = document.getElementById('eu-role')?.value || 'user';
  const errDiv   = document.getElementById('eu-error');

  const errors = [];
  if (!name)     errors.push('Nama fasiliti diperlukan.');
  if (!facCode)  errors.push('Kod fasiliti diperlukan.');
  if (!unit)     errors.push('Keterangan unit diperlukan.');
  if (!shortN)   errors.push('Singkatan diperlukan.');

  if (errors.length) {
    errDiv.style.display = 'block';
    errDiv.innerHTML = errors.map(e => `⛔ ${e}`).join('<br>');
    return;
  }
  errDiv.style.display = 'none';

  // Check if it's a dynamic user or built-in
  const dynamic = getDynamicUsers();
  const dynIdx  = dynamic.findIndex(u => u.id === userId);
  if (dynIdx !== -1) {
    // Update dynamic user
    dynamic[dynIdx] = { ...dynamic[dynIdx], name, unit, shortName: shortN, facilityCode: facCode, role };
    saveDynamicUsers(dynamic);
  } else {
    // Built-in user — save override in a separate store
    let overrides = JSON.parse(localStorage.getItem('radiologi_user_overrides') || '{}');
    overrides[userId] = { name, unit, shortName: shortN, facilityCode: facCode, role };
    localStorage.setItem('radiologi_user_overrides', JSON.stringify(overrides));
    // If the override affects currently logged in user, refresh
    if (currentUser && currentUser.id === userId) {
      currentUser = { ...currentUser, name, unit, shortName: shortN, facilityCode: facCode, role };
      localStorage.setItem('radiologi_session', JSON.stringify({ id: userId }));
    }
  }

  document.getElementById('edit-user-modal')?.remove();
  showToast('success', `✅ Pengguna "${userId}" dikemas kini`, `Maklumat ${name} telah disimpan.`);
  addNotif('info', 'Pengguna Dikemas Kini', `Admin mengemaskini pengguna: ${userId} — ${name}`, 'info');
  navigateTo('urus-pengguna');
}

function confirmHapusUser(userId) {
  const user = getDynamicUsers().find(u => u.id === userId);
  if (!user) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'confirm-hapus-user-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:420px">
    <div class="modal-header" style="background:var(--danger);color:white;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <h3 style="color:white">🗑 Hapus Pengguna</h3>
      <button class="modal-close" onclick="document.getElementById('confirm-hapus-user-modal').remove()"
        style="color:white;background:rgba(255,255,255,.2)">✕</button>
    </div>
    <div class="modal-body" style="text-align:center;padding:20px">
      <div style="font-size:2.5rem;margin-bottom:12px">👤</div>
      <div style="font-weight:700;font-size:.95rem;margin-bottom:8px">Hapus akaun pengguna ini?</div>
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:.82rem;text-align:left;margin-bottom:12px">
        <strong>${user.id}</strong> — ${user.name}<br>
        <span style="color:var(--text-muted)">${user.unit}</span>
      </div>
      <div style="font-size:.8rem;color:var(--danger)">Data permohonan mereka tidak akan dipadam.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('confirm-hapus-user-modal').remove()">Batal</button>
      <button class="btn btn-danger" onclick="executeHapusUser('${userId}')">🗑 Hapus Pengguna</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function executeHapusUser(userId) {
  const dynamic = getDynamicUsers().filter(u => u.id !== userId);
  saveDynamicUsers(dynamic);
  document.getElementById('confirm-hapus-user-modal')?.remove();
  showToast('success', '🗑 Pengguna dipadam', `Akaun ${userId} telah dipadamkan.`);
  navigateTo('urus-pengguna');
}

// ============================================================
//  EDIT PERMOHONAN SENDIRI (USER - STATUS PENDING SAHAJA)
// ============================================================
function editMyPermohonan(id) {
  const p = permohonanData.find(r => r.id === id);
  if (!p || p.status !== 'pending') return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'edit-my-modal';
  overlay.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <h3>📝 Edit Permohonan</h3>
      <button class="modal-close" onclick="document.getElementById('edit-my-modal').remove()">✕</button>
    </div>
    <div class="modal-body">
      ${renderFormPermohonan(p)}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  // rebind IC auto-format
  const icField = document.getElementById('f-ic');
  if (icField) icField.addEventListener('input', function() { this.value = this.value.replace(/\D/g, '').slice(0, 12); });
  // Override form submit for edit modal
  const form = document.getElementById('form-permohonan');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      submitPermohonan(id);
      document.getElementById('edit-my-modal')?.remove();
    });
  }
}

// ============================================================
//  DETAIL VIEW
// ============================================================
function showDetail(id) {
  const p = permohonanData.find(r => r.id === id);
  if (!p) return;
  const isRejected = p.status === 'rejected';
  const steps = ['pending','registered','inprogress','done'];
  const stepLabels = ['Dihantar','Telah Didaftar','Sedang Disedia','Laporan Siap'];
  const curIdx = isRejected ? -1 : steps.indexOf(p.status);
  const trackHtml = isRejected
    ? `<div style="background:#fde8eb;border:1px solid #fca5a5;border-radius:var(--radius);padding:12px 16px;text-align:center;font-size:.85rem;font-weight:700;color:#7f1d1d">
        🚫 Permohonan ini telah DITOLAK oleh Admin HUS
       </div>`
    : steps.map((s, i) => `
      <div class="track-step ${i < curIdx ? 'done' : i === curIdx ? 'active' : ''}">
        <div class="step-circle">${i < curIdx ? '✓' : i + 1}</div>
        <div class="step-label">${stepLabels[i]}</div>
      </div>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'detail-modal';
  overlay.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <h3>🔍 Butiran Permohonan</h3>
      <button class="modal-close" onclick="document.getElementById('detail-modal').remove()">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:1rem;font-weight:700;color:var(--text)">${p.namaPesakit}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${p.noRef}</div>
        </div>
        ${statusBadge(p.status)}
      </div>
      <div class="progress-track" style="margin-bottom:20px">${trackHtml}</div>
      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Maklumat Pesakit</div>
      <div class="detail-grid" style="margin-bottom:16px">
        <div class="detail-item"><div class="detail-label">No. IC</div><div class="detail-value">${p.noIC}</div></div>
        <div class="detail-item"><div class="detail-label">Nama Penuh</div><div class="detail-value">${p.namaPesakit}</div></div>
        <div class="detail-item"><div class="detail-label">Jantina</div><div class="detail-value">${p.jantina}</div></div>
        <div class="detail-item"><div class="detail-label">No. Telefon</div><div class="detail-value">${p.noTelefon || '-'}</div></div>
      </div>
      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Maklumat Pemeriksaan</div>
      <div class="detail-grid" style="margin-bottom:16px">
        <div class="detail-item"><div class="detail-label">Jenis X-Ray</div><div class="detail-value">${p.jenisXray}</div></div>
        <div class="detail-item"><div class="detail-label">Bahagian</div><div class="detail-value">${p.bahagian}</div></div>
        <div class="detail-item"><div class="detail-label">Tarikh X-Ray</div><div class="detail-value">${formatDate(p.tarikhXray)}</div></div>
        <div class="detail-item"><div class="detail-label">Doktor Rujukan</div><div class="detail-value">${p.namaDokter}</div></div>
        <div class="detail-item full"><div class="detail-label">Indikasi Klinikal</div><div class="detail-value">${p.indikasiKlinikal}</div></div>
      </div>
      <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Maklumat Permohonan</div>
      <div class="detail-grid" style="margin-bottom:14px">
        <div class="detail-item"><div class="detail-label">Fasiliti</div><div class="detail-value">${p.facilityName}</div></div>
        <div class="detail-item"><div class="detail-label">No. Accession</div><div class="detail-value">${p.noAccession || '-'}</div></div>
        <div class="detail-item"><div class="detail-label">📅 Tarikh Permohonan</div><div class="detail-value">${formatDate(p.submittedAt)}<br><span style="font-size:.7rem;color:var(--text-muted)">${formatDateTime(p.submittedAt).split(' ').slice(1).join(' ')}</span></div></div>
        <div class="detail-item"><div class="detail-label">⏱ Tempoh Permohonan</div><div class="detail-value">${hariPermohonanBadge(p.submittedAt, false)}</div></div>
        <div class="detail-item"><div class="detail-label">Dikemas kini</div><div class="detail-value">${formatDateTime(p.updatedAt)}</div></div>
      </div>

      <!-- MAKLUMAT RIS — paparan untuk SEMUA pengguna -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;margin-bottom:12px">
        <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">🗃 Pendaftaran RIS</div>
        <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap;margin-bottom:8px">
          <div>
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Tarikh Daftar RIS</div>
            <div style="font-size:.88rem;font-weight:600;color:var(--text)">
              ${p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : '<span style="color:var(--text-light);font-style:italic">Belum Didaftar</span>'}
            </div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">${p.status === 'done' ? 'Tempoh Siap' : 'Bilangan Hari'}</div>
            <div>${risHariHTML(p.tarikhDaftarRIS || '', false, p.status, p.submittedAt, p.updatedAt)}</div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">Status RIS</div>
            <div>${risBadgeHTML(p.tarikhDaftarRIS || '', p.status, p.submittedAt, p.updatedAt)}</div>
          </div>
        </div>
        ${(() => {
          // Jika laporan sudah siap — papar notis hijau, BUKAN amaran merah/ungu
          if (p.status === 'done') {
            const hariSiap = hitungHariSiap(p.submittedAt, p.updatedAt);
            const labelSiap = hariSiap === 0 ? 'hari yang sama' : `${hariSiap} hari`;
            return `<div style="padding:10px 14px;border-radius:var(--radius);background:#d8f0e6;color:#145a32;font-size:.78rem;font-weight:600;display:flex;align-items:center;gap:8px">
              ✅ <span>Laporan telah siap. Masa penyediaan: <strong>${labelSiap}</strong> dari tarikh permohonan diterima.</span>
            </div>`;
          }
          // Jika RIS belum didaftar
          if (!p.tarikhDaftarRIS) {
            return '<div style="font-size:.72rem;color:var(--text-light);font-style:italic">ℹ️ Tarikh daftar RIS belum diisi oleh Admin HUS.</div>';
          }
          // Paparan amaran biasa (hanya jika status bukan done)
          const h = hitungHariRIS(p.tarikhDaftarRIS);
          let bg, msg;
          if (h > 15)      { bg = 'background:#f1f5f9;color:var(--text-muted)';         msg = '— Melebihi tempoh paparan 15 hari. Sila hubungi Admin HUS.'; }
          else if (h >= 14){ bg = 'background:#fee2e2;color:#dc2626;font-weight:600';    msg = `🔴 Kritikal: Sudah <strong>${h} hari</strong> dari tarikh daftar RIS. Laporan perlu segera disediakan.`; }
          else if (h >= 9) { bg = 'background:#ede9fe;color:#7c3aed;font-weight:600';   msg = `🟣 Amaran: Sudah <strong>${h} hari</strong>. Sila pantau perkembangan laporan.`; }
          else             { bg = 'background:#dcfce7;color:#15803d';                   msg = `🟢 Dalam tempoh normal (<strong>${h} hari</strong>).`; }
          return `<div style="padding:8px 12px;border-radius:var(--radius);font-size:.75rem;${bg}">${msg}</div>`;
        })()}
      </div>

      ${p.laporanNama && p.laporanData ? `
        <div style="background:var(--success-light);border:1.5px solid var(--success);border-radius:var(--radius-lg);padding:16px;margin-top:10px">
          <div style="font-size:.78rem;font-weight:700;color:var(--success);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">✅ Laporan Radiologi Telah Siap — Sedia Untuk Dimuat Turun</div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span style="font-size:2rem">📄</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:.88rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.laporanNama}</div>
              <div style="font-size:.72rem;color:var(--text-muted)">${p.laporanSaiz || ''}</div>
            </div>
            <a href="${p.laporanData}" download="${p.laporanNama}" class="btn btn-success">⬇ Muat Turun Laporan</a>
          </div>
        </div>` : ''}
      ${p.dokumenNama ? `
        <div style="margin-top:8px">
          <div style="font-size:.75rem;font-weight:700;color:var(--primary);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">📎 Dokumen Sokongan</div>
          <div class="upload-preview" style="display:flex">
            <span class="upload-file-icon">📄</span>
            <span class="upload-file-name">${p.dokumenNama}</span>
            <span class="upload-file-size">${p.dokumenSaiz || ''}</span>
            ${p.dokumenData ? `<a href="${p.dokumenData}" download="${p.dokumenNama}" class="btn btn-sm btn-primary" style="margin-left:auto">⬇ Muat Turun</a>` : ''}
          </div>
        </div>` : ''}
      ${p.rejectReason ? `
        <div style="background:#fde8eb;border:2px solid #fca5a5;border-radius:var(--radius);padding:14px 16px;font-size:.85rem;color:#7f1d1d;margin-top:4px">
          🚫 <strong>SEBAB PENOLAKAN:</strong><br>
          <span style="font-style:italic">${p.rejectReason}</span>
        </div>` : ''}
      ${p.adminRemark && !p.rejectReason ? `<div class="remark-box" style="margin-top:4px">💬 <strong>Catatan Admin HUS:</strong><br>${p.adminRemark}</div>` : ''}
      ${p.remark ? `<div style="background:var(--info-light);border:1px solid #a5f3fc;border-radius:var(--radius);padding:10px 14px;font-size:.82rem;color:#164e63;margin-top:8px">📝 <strong>Catatan Tambahan:</strong><br>${p.remark}</div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('detail-modal').remove()">Tutup</button>
      <button class="btn btn-grey btn-sm" onclick="printPermohonan('${p.id}')">🖨️ Cetak</button>
      ${isAdminRole(currentUser) ? `
        <button class="btn btn-warning btn-sm" onclick="document.getElementById('detail-modal').remove();openRejectPermohonan('${p.id}')" ${isRejected ? 'disabled style="opacity:.4"' : ''}>🚫 Tolak</button>
        <button class="btn btn-primary" onclick="document.getElementById('detail-modal').remove();openAdminEdit('${p.id}')">✏️ Edit Penuh</button>` : ''}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ============================================================
//  LAPORAN & STATISTIK (ADMIN)
// ============================================================
function renderLaporan() {
  const data = permohonanData;
  const byFacility = {};
  getAllUsers().filter(u => u.role === 'user').forEach(u => {
    byFacility[u.facilityCode] = { name: u.unit, total: 0, pending: 0, done: 0 };
  });
  data.forEach(p => {
    if (byFacility[p.facilityCode]) {
      byFacility[p.facilityCode].total++;
      if (p.status === 'pending') byFacility[p.facilityCode].pending++;
      if (p.status === 'done') byFacility[p.facilityCode].done++;
    }
  });

  const byJenis = {};
  data.forEach(p => { byJenis[p.jenisXray] = (byJenis[p.jenisXray] || 0) + 1; });

  const rows = Object.entries(byFacility).map(([code, f]) => `
    <tr>
      <td>${f.name}</td>
      <td style="color:var(--text-muted);font-size:.78rem">${code}</td>
      <td style="text-align:center;font-weight:700">${f.total}</td>
      <td style="text-align:center">${f.pending > 0 ? `<span class="badge badge-pending">${f.pending}</span>` : '0'}</td>
      <td style="text-align:center">${f.done > 0 ? `<span class="badge badge-done">${f.done}</span>` : '0'}</td>
      <td>
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
          <div style="background:var(--success);height:100%;width:${f.total ? Math.round(f.done/f.total*100) : 0}%"></div>
        </div>
        <span style="font-size:.7rem;color:var(--text-muted)">${f.total ? Math.round(f.done/f.total*100) : 0}% siap</span>
      </td>
    </tr>`).join('');

  const jenisRows = Object.entries(byJenis).sort((a,b) => b[1]-a[1]).map(([j, c]) => `
    <tr>
      <td>${j}</td>
      <td style="text-align:center;font-weight:700">${c}</td>
      <td>
        <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
          <div style="background:var(--accent);height:100%;width:${Math.round(c/data.length*100)}%"></div>
        </div>
        <span style="font-size:.7rem;color:var(--text-muted)">${Math.round(c/data.length*100)}%</span>
      </td>
    </tr>`).join('');

  return `
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
    ${['pending','registered','inprogress','done'].map(s => {
      const n = data.filter(p => p.status === s).length;
      const icons = {pending:'⏳',registered:'📋',inprogress:'🔬',done:'✅'};
      const cls   = {pending:'orange',registered:'cyan',inprogress:'purple',done:'green'};
      return `<div class="stat-card"><div class="stat-icon ${cls[s]}">${icons[s]}</div><div class="stat-info">
        <div class="stat-value">${n}</div><div class="stat-label">${STATUS_MAP[s].label}</div>
      </div></div>`;
    }).join('')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;flex-wrap:wrap">
    <div class="card">
      <div class="card-header"><h3>🏥 Statistik Mengikut Fasiliti</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Fasiliti</th><th>Kod</th><th style="text-align:center">Jumlah</th><th style="text-align:center">Menunggu</th><th style="text-align:center">Siap</th><th>Kemajuan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>🩻 Jenis Pemeriksaan</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Jenis Pemeriksaan</th><th style="text-align:center">Jumlah</th><th>Peratusan</th></tr></thead>
        <tbody>${jenisRows || '<tr><td colspan="3"><div class="empty-state"><p>Tiada data</p></div></td></tr>'}</tbody>
      </table></div>
    </div>
  </div>`;
}

// ============================================================
//  PANDUAN PENGGUNA
// ============================================================
function renderPanduan() {
  const isAdmin = isAdminRole(currentUser);
  return `
  <div class="card" style="max-width:760px">
    <div class="card-header"><h3>📖 Panduan Pengguna Sistem</h3></div>
    <div class="card-body">
      <div style="font-size:.85rem;line-height:1.8;color:var(--text)">
        ${!isAdmin ? `
        <h4 style="color:var(--primary);margin-bottom:8px">Cara Membuat Permohonan Laporan X-Ray</h4>
        <ol style="margin-left:16px;margin-bottom:16px">
          <li>Klik <strong>➕ Mohon Laporan Baru</strong> pada menu kiri.</li>
          <li>Isi maklumat pesakit dengan <strong>lengkap dan tepat</strong>. Nombor IC diisi <strong>tanpa tanda "-"</strong>.</li>
          <li>Pilih jenis pemeriksaan X-ray dan nyatakan bahagian yang diperiksa.</li>
          <li>Isi indikasi klinikal dengan jelas.</li>
          <li>Klik <strong>📤 Hantar Permohonan</strong>. No. Rujukan akan dijana secara automatik.</li>
        </ol>
        <h4 style="color:var(--primary);margin-bottom:8px">Cara Menjejak Status</h4>
        <ol style="margin-left:16px;margin-bottom:16px">
          <li>Klik <strong>🔍 Jejak Status</strong> pada menu kiri.</li>
          <li>Masukkan No. IC Pesakit atau No. Rujukan.</li>
          <li>Klik <strong>🔍 Jejak</strong> untuk melihat status terkini.</li>
        </ol>` : `
        <h4 style="color:var(--primary);margin-bottom:8px">Kuasa Admin</h4>
        <ul style="margin-left:16px;margin-bottom:16px">
          <li>Lihat <strong>semua permohonan</strong> dari semua fasiliti.</li>
          <li><strong>Edit penuh</strong> data pesakit dan pemeriksaan (3 tab dalam modal edit).</li>
          <li><strong>Tolak permohonan</strong> dengan sebab yang dipaparkan kepada pemohon.</li>
          <li><strong>Padam rekod</strong> secara individu atau semua sekali gus dengan pengesahan.</li>
          <li><strong>Tambah pengguna baru</strong> dari menu 👥 Urus Pengguna.</li>
          <li>Kemaskini <strong>status</strong>, masukkan <strong>No. Accession</strong>, dan tambah <strong>catatan remark</strong>.</li>
          <li>Filter, cari, jejak, dan export data dalam format CSV.</li>
        </ul>`}
        <h4 style="color:var(--primary);margin-bottom:8px">Kod ID & Pengurusan Kata Laluan</h4>
        ${isAdmin ? `
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Fasiliti / Klinik</th><th>Kata Laluan Semasa</th><th>Tindakan</th></tr></thead>
          <tbody>
            ${getAllUsers().map(u => `
            <tr>
              <td><code style="background:var(--surface2);padding:2px 6px;border-radius:4px">${u.id}</code></td>
              <td>${u.unit}</td>
              <td>
                <span id="pwd-display-${u.id}" style="font-family:monospace;letter-spacing:2px">••••••••</span>
                <span onclick="toggleShowPwd('${u.id}')" style="cursor:pointer;margin-left:8px;font-size:.8rem;color:var(--accent)" title="Tunjuk/sembunyi">👁</span>
              </td>
              <td>
                <button class="btn btn-warning btn-xs" onclick="openTukarKataLaluan('${u.id}')">🔑 Set Semula</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        <div style="margin-top:12px;padding:10px 14px;background:var(--info-light);border:1px solid #a5f3fc;border-radius:var(--radius);font-size:.78rem;color:#164e63">
          ℹ️ Sebagai Admin, anda boleh menetapkan semula kata laluan mana-mana pengguna tanpa memerlukan kata laluan lama mereka.
        </div>` : `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:12px">
          <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:4px">ID Pengguna Anda</div>
          <code style="font-size:1rem;font-weight:700;color:var(--primary)">${currentUser.id}</code>
          <span style="font-size:.78rem;color:var(--text-muted);margin-left:8px">· ${currentUser.unit}</span>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openTukarKataLaluan('${currentUser.id}')">🔑 Tukar Kata Laluan Saya</button>`}
        <div style="margin-top:16px;padding:12px;background:var(--warning-light);border-radius:var(--radius);font-size:.78rem;color:#78350f">
          ⚠️ <strong>Penting:</strong> Jangan kongsi kata laluan anda dengan sesiapa. Log keluar selepas selesai menggunakan sistem.
        </div>
      </div>
    </div>
  </div>`;
}

// ============================================================
//  TUKAR KATA LALUAN
// ============================================================

/**
 * Buka modal tukar kata laluan.
 * targetId = ID pengguna yang kata laluannya hendak ditukar.
 * Jika admin memanggil untuk ID lain → mod "set semula" (tiada semakan kata laluan lama).
 * Jika pengguna memanggil untuk diri sendiri → semakan kata laluan lama diperlukan.
 */
function openTukarKataLaluan(targetId) {
  const isOwnAccount = (targetId === currentUser.id);
  const targetUser = getAllUsers().find(u => u.id === targetId);
  if (!targetUser) return;

  const existing = document.getElementById('modal-tukar-pwd');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'modal-tukar-pwd';
  overlay.innerHTML = `
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>🔑 ${isOwnAccount ? 'Tukar Kata Laluan Saya' : 'Set Semula Kata Laluan'}</h3>
      <button class="modal-close" onclick="document.getElementById('modal-tukar-pwd').remove()">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--surface2);border-radius:var(--radius);padding:10px 14px;margin-bottom:16px;font-size:.82rem;border:1px solid var(--border)">
        👤 <strong>${targetUser.name}</strong>
        <span style="color:var(--text-muted);margin-left:6px">ID: ${targetUser.id}</span>
      </div>
      ${isOwnAccount ? `
      <div class="field" style="margin-bottom:14px">
        <label>Kata Laluan Semasa <span class="req">*</span></label>
        <div style="position:relative">
          <input type="password" id="pwd-lama" placeholder="Masukkan kata laluan semasa" autocomplete="current-password"
            style="padding:9px 36px 9px 12px;border:1.5px solid var(--border);border-radius:var(--radius);width:100%;font-size:.85rem;outline:none;background:var(--surface2);transition:var(--transition)" />
          <span onclick="togglePwdVisibility('pwd-lama',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:.9rem;color:var(--text-muted)" title="Tunjuk/sembunyi">👁</span>
        </div>
      </div>` : `
      <div style="background:var(--warning-light);border:1px solid #fde68a;border-radius:var(--radius);padding:10px 14px;font-size:.78rem;color:#78350f;margin-bottom:14px">
        ⚠️ Anda sedang menetapkan semula kata laluan sebagai <strong>Admin</strong>. Kata laluan lama tidak diperlukan.
      </div>`}
      <div class="field" style="margin-bottom:14px">
        <label>Kata Laluan Baru <span class="req">*</span></label>
        <div style="position:relative">
          <input type="password" id="pwd-baru" placeholder="Minimum 8 aksara" autocomplete="new-password"
            style="padding:9px 36px 9px 12px;border:1.5px solid var(--border);border-radius:var(--radius);width:100%;font-size:.85rem;outline:none;background:var(--surface2);transition:var(--transition)" />
          <span onclick="togglePwdVisibility('pwd-baru',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:.9rem;color:var(--text-muted)" title="Tunjuk/sembunyi">👁</span>
        </div>
        <div id="pwd-strength" style="margin-top:5px;height:4px;border-radius:2px;background:var(--border);overflow:hidden">
          <div id="pwd-strength-bar" style="height:100%;width:0;transition:width .3s,background .3s"></div>
        </div>
        <div id="pwd-strength-label" style="font-size:.7rem;color:var(--text-muted);margin-top:3px"></div>
      </div>
      <div class="field" style="margin-bottom:4px">
        <label>Sahkan Kata Laluan Baru <span class="req">*</span></label>
        <div style="position:relative">
          <input type="password" id="pwd-sahkan" placeholder="Taip semula kata laluan baru" autocomplete="new-password"
            style="padding:9px 36px 9px 12px;border:1.5px solid var(--border);border-radius:var(--radius);width:100%;font-size:.85rem;outline:none;background:var(--surface2);transition:var(--transition)" />
          <span onclick="togglePwdVisibility('pwd-sahkan',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:.9rem;color:var(--text-muted)" title="Tunjuk/sembunyi">👁</span>
        </div>
        <div id="pwd-match-label" style="font-size:.7rem;margin-top:3px"></div>
      </div>
      <div id="pwd-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:9px 12px;font-size:.78rem;color:var(--danger);margin-top:12px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('modal-tukar-pwd').remove()">Batal</button>
      <button class="btn btn-primary" onclick="simpanKataLaluan('${targetId}',${isOwnAccount})">💾 Simpan Kata Laluan</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Semak kekuatan kata laluan secara langsung
  document.getElementById('pwd-baru')?.addEventListener('input', function() {
    checkPasswordStrength(this.value);
    checkPasswordMatch();
  });
  document.getElementById('pwd-sahkan')?.addEventListener('input', checkPasswordMatch);
}

function togglePwdVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

// Untuk Admin — tunjuk/sembunyi kata laluan dalam jadual Panduan
function toggleShowPwd(userId) {
  const span = document.getElementById(`pwd-display-${userId}`);
  if (!span) return;
  const isHidden = span.textContent.includes('•');
  if (isHidden) {
    const pwd = getPassword(userId);
    span.textContent = pwd;
    span.style.letterSpacing = '0';
    span.nextElementSibling.textContent = '🙈';
  } else {
    span.textContent = '••••••••';
    span.style.letterSpacing = '2px';
    span.nextElementSibling.textContent = '👁';
  }
}

function checkPasswordStrength(pwd) {
  const bar   = document.getElementById('pwd-strength-bar');
  const label = document.getElementById('pwd-strength-label');
  if (!bar || !label) return;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const levels = [
    { pct: '0%',   color: 'transparent', text: '' },
    { pct: '25%',  color: '#dc2626',     text: '🔴 Lemah — tambah huruf besar, nombor atau simbol' },
    { pct: '50%',  color: '#d97706',     text: '🟠 Sederhana — boleh lebih kukuh' },
    { pct: '75%',  color: '#2563eb',     text: '🔵 Baik' },
    { pct: '100%', color: '#16a34a',     text: '🟢 Sangat Kukuh' }
  ];
  const lv = levels[score] || levels[0];
  bar.style.width   = lv.pct;
  bar.style.background = lv.color;
  label.textContent = pwd.length ? lv.text : '';
}

function checkPasswordMatch() {
  const baru    = document.getElementById('pwd-baru')?.value || '';
  const sahkan  = document.getElementById('pwd-sahkan')?.value || '';
  const lbl     = document.getElementById('pwd-match-label');
  if (!lbl || !sahkan) return;
  if (baru === sahkan) {
    lbl.style.color = 'var(--success)';
    lbl.textContent = '✅ Kata laluan sepadan';
  } else {
    lbl.style.color = 'var(--danger)';
    lbl.textContent = '❌ Kata laluan tidak sepadan';
  }
}

function simpanKataLaluan(targetId, isOwnAccount) {
  const lama   = isOwnAccount ? (document.getElementById('pwd-lama')?.value || '') : null;
  const baru   = document.getElementById('pwd-baru')?.value || '';
  const sahkan = document.getElementById('pwd-sahkan')?.value || '';
  const errDiv = document.getElementById('pwd-error');

  const errors = [];

  if (isOwnAccount) {
    const currentPwd = getPassword(targetId);
    if (!lama) errors.push('Sila masukkan kata laluan semasa anda.');
    else if (lama !== currentPwd) errors.push('Kata laluan semasa tidak tepat.');
  }
  if (!baru)              errors.push('Sila masukkan kata laluan baru.');
  else if (baru.length < 8) errors.push('Kata laluan baru mestilah sekurang-kurangnya 8 aksara.');
  if (baru !== sahkan)   errors.push('Pengesahan kata laluan tidak sepadan.');

  if (errors.length) {
    errDiv.style.display = 'block';
    errDiv.innerHTML = errors.map(e => `⛔ ${e}`).join('<br>');
    return;
  }
  errDiv.style.display = 'none';

  savePassword(targetId, baru);
  document.getElementById('modal-tukar-pwd').remove();

  const targetUser = getAllUsers().find(u => u.id === targetId);
  if (isOwnAccount) {
    showToast('success', '🔑 Kata laluan berjaya ditukar!', 'Log masuk seterusnya gunakan kata laluan baru.');
    addNotif('success', 'Kata Laluan Ditukar', `Kata laluan akaun ${currentUser.id} telah dikemas kini.`, 'success');
  } else {
    showToast('success', '🔑 Kata laluan ditetapkan semula!', `${targetUser?.name} — ${targetId}`);
    addNotif('info', 'Set Semula Kata Laluan', `Admin telah menetapkan semula kata laluan ${targetId}.`, 'info');
  }
}

// ============================================================
//  EXPORT CSV — digunakan oleh ADMIN dan USER BIASA
// ============================================================

/**
 * Export data yang sedang dipapar (mengikut filter aktif) ke fail CSV.
 * Header CSV disesuaikan untuk user biasa (lebih lengkap) dan admin.
 */
function exportCSVUser() {
  const isAdmin = isAdminRole(currentUser);
  // Gunakan data yang telah ditapis; jika tiada filter guna semua data milik user
  const data = filteredData.length > 0 ? filteredData
    : (isAdmin ? permohonanData : permohonanData.filter(p => p.submittedBy === currentUser.id));

  if (data.length === 0) {
    showToast('warning', '⚠ Tiada data untuk dimuat turun.', 'Tiada rekod dalam paparan semasa.');
    return;
  }

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10);
  const timeStamp = now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' }).replace(':', '');

  let headers, rows, filename;

  if (!isAdmin) {
    // Header untuk pengguna biasa — termasuk maklumat RIS
    headers = [
      'No.', 'No. Rujukan', 'No. IC Pesakit', 'Nama Penuh Pesakit', 'Jantina',
      'Jenis Pemeriksaan X-Ray', 'Bahagian / Pandangan', 'Tarikh X-Ray',
      'Tarikh Dihantar', 'Doktor Rujukan', 'Indikasi Klinikal',
      'Status Laporan', 'No. Accession (HUS)',
      'Tarikh Daftar RIS', 'Hari Dari Daftar RIS',
      'Catatan dari HUS'
    ];
    rows = data.map((p, i) => {
      const hariRIS = p.tarikhDaftarRIS ? hitungHariRIS(p.tarikhDaftarRIS) : null;
      const hariLabel = hariRIS === null ? 'Belum Didaftar'
        : hariRIS > 15 ? '— (>15 hari)'
        : `${hariRIS} hari`;
      return [
        i + 1, p.noRef, p.noIC, p.namaPesakit, p.jantina,
        p.jenisXray, p.bahagian, formatDate(p.tarikhXray),
        formatDateTime(p.submittedAt), p.namaDokter, p.indikasiKlinikal,
        STATUS_MAP[p.status]?.label || p.status,
        p.noAccession || '',
        p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : 'Belum Didaftar',
        hariLabel,
        p.adminRemark || ''
      ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    filename = `Data_Pesakit_${currentUser.id}_${dateStamp}_${timeStamp}.csv`;
  } else {
    // Header untuk Admin — termasuk maklumat RIS
    headers = [
      'No.', 'No. Rujukan', 'Fasiliti', 'No. IC Pesakit', 'Nama Penuh Pesakit',
      'Jantina', 'Jenis Pemeriksaan', 'Bahagian', 'Tarikh X-Ray',
      'Tarikh Dihantar', 'Doktor Rujukan', 'Indikasi Klinikal',
      'Status', 'No. Accession',
      'Tarikh Daftar RIS', 'Hari Dari Daftar RIS',
      'Dikemas kini oleh', 'Masa Dikemas kini', 'Catatan Admin'
    ];
    rows = data.map((p, i) => {
      const hariRIS = p.tarikhDaftarRIS ? hitungHariRIS(p.tarikhDaftarRIS) : null;
      const hariLabel = hariRIS === null ? 'Belum Didaftar'
        : hariRIS > 15 ? '— (>15 hari)'
        : `${hariRIS} hari`;
      return [
        i + 1, p.noRef, p.facilityName, p.noIC, p.namaPesakit, p.jantina,
        p.jenisXray, p.bahagian, formatDate(p.tarikhXray),
        formatDateTime(p.submittedAt), p.namaDokter, p.indikasiKlinikal,
        STATUS_MAP[p.status]?.label || p.status,
        p.noAccession || '',
        p.tarikhDaftarRIS ? formatDate(p.tarikhDaftarRIS) : 'Belum Didaftar',
        hariLabel,
        p.updatedBy || '',
        p.updatedAt ? formatDateTime(p.updatedAt) : '',
        p.adminRemark || ''
      ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    filename = `Laporan_Radiologi_HUS_${dateStamp}_${timeStamp}.csv`;
  }

  // Tambah metadata baris pertama
  const meta = [
    `"Sistem Permohonan Laporan Radiologi — Jabatan Radiologi HUS Kuching"`,
    `"Dijana oleh: ${currentUser.name} (${currentUser.id})"`,
    `"Tarikh & Masa Export: ${formatDateTime(now.toISOString())}"`,
    `"Jumlah Rekod: ${data.length}"`,
    `""`
  ].join('\r\n');

  const csv = meta + '\r\n' + headers.map(h => `"${h}"`).join(',') + '\r\n' + rows.join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('success', '⬇ Muat turun CSV berjaya!', `${data.length} rekod dieksport → ${filename}`);
}

// Alias untuk keserasian panggilan lama
function exportCSV() { exportCSVUser(); }

// ============================================================
//  CETAK / PRINT BORANG PERMOHONAN
// ============================================================

/**
 * Cetak butiran satu permohonan sebagai dokumen cetak.
 * Buka tetingkap baru dengan kandungan yang telah diformat untuk cetakan.
 */
function printPermohonan(id) {
  const p = permohonanData.find(r => r.id === id)
         || getAdminPermohonan().find(r => r.id === id);
  if (!p) return;

  const statusInfo = STATUS_MAP[p.status] || STATUS_MAP.pending;
  const html = `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <title>Borang Permohonan — ${p.noRef}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; color: #111; margin: 0; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2d6a4f; padding-bottom: 12px; margin-bottom: 16px; }
    .header-left h1 { font-size: 16pt; font-weight: 900; color: #2d6a4f; margin: 0 0 2px; }
    .header-left p { font-size: 9pt; color: #666; margin: 0; }
    .header-right { text-align: right; }
    .header-right .noref { font-size: 10pt; font-weight: 700; color: #2d6a4f; }
    .header-right .ts { font-size: 8pt; color: #999; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9pt; font-weight: 700; margin-top: 4px; }
    .section { margin-bottom: 14px; }
    .section-title { font-size: 9pt; font-weight: 700; color: #2d6a4f; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #d0e8da; padding-bottom: 4px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .field { }
    .field .label { font-size: 8pt; color: #777; margin-bottom: 2px; }
    .field .value { font-size: 10pt; font-weight: 600; padding: 4px 8px; background: #f5f0ea; border-radius: 4px; border: 1px solid #ddd; min-height: 22px; }
    .field.full { grid-column: 1 / -1; }
    .remark { background: #fef9e7; border: 1px solid #f9e79f; border-radius: 4px; padding: 8px 10px; font-size: 9.5pt; margin-top: 4px; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; display: flex; justify-content: space-between; font-size: 8pt; color: #999; }
    .sign-box { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 4px; font-size: 9pt; color: #555; margin-top: 40px; }
    .sign-row { display: flex; justify-content: space-between; margin-top: 30px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>RADEXTRA</h1>
      <p>Borang Permohonan Laporan Radiologi</p>
      <p>Jabatan Radiologi, Hospital Umum Sarawak, Kuching</p>
    </div>
    <div class="header-right">
      <div class="noref">${p.noRef}</div>
      <div class="ts">Tarikh Hantar: ${formatDate(p.submittedAt)}</div>
      <div><span class="status-badge" style="background:${p.status === 'done' ? '#d8f0e6' : p.status === 'rejected' ? '#faeae8' : '#fdf4e7'};color:${p.status === 'done' ? '#145a32' : p.status === 'rejected' ? '#922b21' : '#7d5a0b'}">${statusInfo.icon} ${statusInfo.label}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">A. Maklumat Fasiliti</div>
    <div class="grid">
      <div class="field"><div class="label">Fasiliti / Klinik / Hospital</div><div class="value">${p.facilityName || '-'}</div></div>
      <div class="field"><div class="label">Nama Pegawai Perubatan / Doktor Rujukan</div><div class="value">${p.namaDokter || '-'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">B. Maklumat Pesakit</div>
    <div class="grid">
      <div class="field"><div class="label">Nombor Kad Pengenalan (IC)</div><div class="value">${p.noIC || '-'}</div></div>
      <div class="field"><div class="label">Nama Penuh Pesakit</div><div class="value">${p.namaPesakit || '-'}</div></div>
      <div class="field"><div class="label">Jantina</div><div class="value">${p.jantina || '-'}</div></div>
      <div class="field"><div class="label">No. Telefon</div><div class="value">${p.noTelefon || '-'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">C. Maklumat Pemeriksaan</div>
    <div class="grid">
      <div class="field"><div class="label">Jenis Pemeriksaan X-Ray</div><div class="value">${p.jenisXray || '-'}</div></div>
      <div class="field"><div class="label">Bahagian / Pandangan</div><div class="value">${p.bahagian || '-'}</div></div>
      <div class="field"><div class="label">Tarikh Pemeriksaan X-Ray</div><div class="value">${formatDate(p.tarikhXray)}</div></div>
      <div class="field"><div class="label">No. Accession (HUS)</div><div class="value">${p.noAccession || '-'}</div></div>
      <div class="field full"><div class="label">Indikasi Klinikal / Diagnosis</div><div class="value" style="white-space:pre-wrap">${p.indikasiKlinikal || '-'}</div></div>
    </div>
  </div>

  ${p.adminRemark ? `<div class="section">
    <div class="section-title">Catatan Admin HUS</div>
    <div class="remark">${p.adminRemark}</div>
  </div>` : ''}

  ${p.rejectReason ? `<div class="section">
    <div class="section-title" style="color:#922b21">Sebab Penolakan</div>
    <div class="remark" style="background:#faeae8;border-color:#f1948a;color:#922b21">${p.rejectReason}</div>
  </div>` : ''}

  <div class="sign-row">
    <div>
      <div class="sign-box">Tandatangan Pemohon</div>
      <div style="font-size:9pt;margin-top:4px;color:#555">Nama: ${p.submittedBy || ''}</div>
    </div>
    <div>
      <div class="sign-box">Tandatangan Admin HUS</div>
      <div style="font-size:9pt;margin-top:4px;color:#555">Nama: ${p.updatedBy || ''}</div>
    </div>
  </div>

  <div class="footer">
    <span>Dicetak: ${formatDateTime(new Date().toISOString())}</span>
    <span>RADEXTRA v1.0 · Jabatan Radiologi HUS Kuching</span>
    <span>${p.noRef}</span>
  </div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=820,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ============================================================
//  BACKUP & RESTORE DATA (SuperAdmin sahaja)
// ============================================================

function backupData() {
  if (!isSuperAdmin(currentUser)) {
    showToast('error', '🚫 Akses Dinafikan', 'Fungsi ini hanya untuk Super Admin.');
    return;
  }
  const backup = {
    _meta: {
      sistem: 'RADEXTRA v1.0',
      hospital: 'Hospital Umum Sarawak',
      exportedBy: currentUser.id,
      exportedAt: new Date().toISOString(),
      totalRekod: permohonanData.length
    },
    permohonan: permohonanData,
    adminPermohonan: getAdminPermohonan(),
    dynamicUsers: getDynamicUsers(),
    notifications: notifications,
    refCounter: localStorage.getItem('radiologi_ref_counter') || '0'
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  a.href = URL.createObjectURL(blob);
  a.download = `RADEXTRA_Backup_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('success', '💾 Backup berjaya!', `${permohonanData.length} rekod disimpan ke fail JSON.`);
  addNotif('info', 'Backup Data Dilakukan', `Super Admin membuat backup ${permohonanData.length} rekod.`, 'info');
}

function openRestoreData() {
  if (!isSuperAdmin(currentUser)) {
    showToast('error', '🚫 Akses Dinafikan', 'Fungsi ini hanya untuk Super Admin.');
    return;
  }
  const existing = document.getElementById('restore-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.id = 'restore-modal';
  overlay.innerHTML = `
  <div class="modal" style="max-width:500px">
    <div class="modal-header" style="background:var(--warning);color:white;border-radius:var(--radius-lg) var(--radius-lg) 0 0">
      <h3 style="color:white">📂 Pulih Semula Data (Restore)</h3>
      <button class="modal-close" onclick="document.getElementById('restore-modal').remove()"
        style="color:white;background:rgba(255,255,255,.2)">✕</button>
    </div>
    <div class="modal-body">
      <div style="background:var(--warning-light);border:1px solid #fde68a;border-radius:var(--radius);padding:12px 14px;font-size:.8rem;color:#78350f;margin-bottom:16px">
        ⚠️ <strong>Amaran:</strong> Memulihkan data akan <strong>menggantikan SEMUA data semasa</strong>.
        Pastikan anda telah membuat backup terkini sebelum meneruskan.
      </div>
      <div class="field">
        <label>Pilih Fail Backup JSON <span class="req">*</span></label>
        <input type="file" id="restore-file-input" accept="application/json,.json"
          style="padding:8px;border:1.5px solid var(--border);border-radius:var(--radius);width:100%;font-size:.85rem;background:var(--surface2)" />
        <span class="hint">Fail mesti dalam format RADEXTRA Backup (.json)</span>
      </div>
      <div id="restore-preview" style="display:none;margin-top:12px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;font-size:.82rem"></div>
      <div id="restore-error" style="display:none;background:var(--danger-light);border:1px solid #fca5a5;border-radius:var(--radius);padding:9px 12px;font-size:.78rem;color:var(--danger);margin-top:10px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="document.getElementById('restore-modal').remove()">Batal</button>
      <button class="btn btn-warning" id="btn-do-restore" disabled onclick="executeRestoreData()">📂 Pulih Semula</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('restore-file-input').addEventListener('change', function() {
    const file = this.files[0];
    const preview = document.getElementById('restore-preview');
    const errDiv  = document.getElementById('restore-error');
    const btn     = document.getElementById('btn-do-restore');
    preview.style.display = 'none';
    errDiv.style.display  = 'none';
    btn.disabled = true;
    window._restoreData = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data._meta || !data.permohonan) throw new Error('Format fail tidak sah.');
        window._restoreData = data;
        preview.style.display = '';
        preview.innerHTML = `
          <div style="font-weight:700;color:var(--primary);margin-bottom:6px">📋 Maklumat Backup</div>
          <div>Sistem: ${data._meta.sistem}</div>
          <div>Dieksport oleh: ${data._meta.exportedBy}</div>
          <div>Tarikh Export: ${formatDateTime(data._meta.exportedAt)}</div>
          <div>Jumlah Rekod: <strong>${data._meta.totalRekod}</strong></div>`;
        btn.disabled = false;
      } catch(err) {
        errDiv.style.display = '';
        errDiv.textContent = '⛔ Fail tidak sah atau rosak: ' + err.message;
      }
    };
    reader.readAsText(file);
  });
}

function executeRestoreData() {
  const data = window._restoreData;
  if (!data) return;
  if (!confirm('AMARAN: Ini akan menggantikan SEMUA data semasa. Teruskan?')) return;

  if (data.permohonan)       { permohonanData = data.permohonan; saveData(); }
  if (data.adminPermohonan)  localStorage.setItem('radiologi_admin_permohonan', JSON.stringify(data.adminPermohonan));
  if (data.dynamicUsers)     saveDynamicUsers(data.dynamicUsers);
  if (data.notifications)    { notifications = data.notifications; saveData(); }
  if (data.refCounter)       localStorage.setItem('radiologi_ref_counter', data.refCounter);

  window._restoreData = null;
  document.getElementById('restore-modal')?.remove();
  showToast('success', '✅ Data dipulihkan!', `${data.permohonan.length} rekod telah dipulihkan dari backup.`);
  addNotif('info', 'Data Dipulihkan', `Super Admin memulihkan ${data.permohonan.length} rekod dari backup.`, 'info');
  setTimeout(() => navigateTo('dashboard'), 1000);
}

// ============================================================
//  NOTIFICATION SYSTEM
// ============================================================
function addNotif(type, title, desc, iconType = 'info') {
  notifications.unshift({
    id: Date.now(), type, title, desc,
    iconType, ts: new Date().toISOString(), read: false
  });
  if (notifications.length > 50) notifications = notifications.slice(0, 50);
  saveData();
  updateNotifBadge();
}

function updateNotifBadge() {
  const dot = document.getElementById('notif-dot');
  const unread = notifications.filter(n => !n.read).length;
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
  const nb = document.getElementById('nb-pending');
  if (nb) {
    const p = permohonanData.filter(r => r.status === 'pending').length;
    nb.textContent = p > 0 ? String(p) : '';
  }
}

function updatePendingBadge() { updateNotifBadge(); }

function toggleNotifPanel() {
  notifPanelOpen = !notifPanelOpen;
  if (notifPanelOpen) renderNotifPanel();
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('show', notifPanelOpen);
}
function closeNotifPanel() {
  notifPanelOpen = false;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('show');
}

function renderNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  const icons = { success: '✅', info: 'ℹ️', warning: '⚠️', error: '❌' };
  const items = notifications.length
    ? notifications.slice(0, 20).map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
        <div class="notif-item-icon ${n.iconType}">${icons[n.iconType] || 'ℹ️'}</div>
        <div class="notif-item-body">
          <div class="notif-title">${n.title}</div>
          <div class="notif-desc">${n.desc}</div>
          <div class="notif-ts">${formatDateTime(n.ts)} · ${timeAgo(n.ts)}</div>
        </div>
      </div>`).join('')
    : '<div style="padding:24px;text-align:center;font-size:.78rem;color:var(--text-muted)">Tiada pemberitahuan</div>';

  panel.innerHTML = `
    <div class="notif-panel-header">
      🔔 Pemberitahuan
      <button class="btn btn-outline btn-xs" onclick="markAllRead()">Semua dibaca</button>
    </div>
    ${items}`;
  notifications.forEach(n => { n.read = true; });
  saveData();
  updateNotifBadge();
}

function markNotifRead(id) {
  const n = notifications.find(x => x.id === id);
  if (n) { n.read = true; saveData(); }
}
function markAllRead() {
  notifications.forEach(n => { n.read = true; });
  saveData();
  renderNotifPanel();
}

// ============================================================
//  TOAST NOTIFICATIONS
// ============================================================
function showToast(type, title, msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      <div class="toast-time">${formatDateTime(new Date().toISOString())}</div>
    </div>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { requestAnimationFrame(() => { toast.classList.add('show'); }); });
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4500);
}

// ============================================================
//  LIVE CLOCK
// ============================================================
function startLiveClock() {
  function tick() {
    const now = new Date();
    const cl = document.getElementById('live-clock');
    const dt = document.getElementById('live-date');
    if (cl) cl.textContent = now.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dt) dt.textContent = now.toLocaleDateString('ms-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  tick();
  if (liveInterval) clearInterval(liveInterval);
  liveInterval = setInterval(tick, 1000);
}

// ============================================================
//  LIVE POLLING (Simulate real-time refresh)
// ============================================================
function startLivePolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (!currentUser) { clearInterval(pollInterval); pollInterval = null; return; }
    const stored = localStorage.getItem('radiologi_permohonan');
    if (stored) {
      const fresh = JSON.parse(stored);
      if (JSON.stringify(fresh) !== JSON.stringify(permohonanData)) {
        permohonanData = fresh;
        updateNotifBadge();
        // Refresh table if visible
        if (['all-applications','permohonan-saya','kemaskini'].includes(currentPage)) {
          applyFilter();
        }
      }
    }
  }, 10000); // poll every 10s
}

// ============================================================
//  UPLOAD DOKUMEN PDF HELPERS
// ============================================================
function handleFileUpload(input, prefix = 'f') {
  const file = input.files[0];
  if (!file) return;

  // Semak jenis fail
  if (file.type !== 'application/pdf') {
    showToast('error', '⛔ Format tidak disokong', 'Hanya fail PDF sahaja yang diterima.');
    input.value = '';
    return;
  }
  // Semak saiz (500KB)
  if (file.size > 500 * 1024) {
    showToast('error', '⛔ Fail terlalu besar', 'Saiz maksimum ialah 500KB. Sila mampatkan fail PDF terlebih dahulu.');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const saizKB = (file.size / 1024).toFixed(1);
    const saizLabel = file.size >= 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
      : `${saizKB} KB`;

    // Simpan dalam window state
    window[`_uploadedDoc_${prefix}`] = {
      data: e.target.result,
      nama: file.name,
      saiz: saizLabel
    };

    // Tunjuk preview
    const preview = document.getElementById(`${prefix}-upload-preview`);
    const fname   = document.getElementById(`${prefix}-upload-file-name`);
    const fsize   = document.getElementById(`${prefix}-upload-file-size`);
    if (preview) preview.style.display = 'flex';
    if (fname)   fname.textContent = file.name;
    if (fsize)   fsize.textContent = saizLabel;

    showToast('success', '📄 Fail dimuat naik', `${file.name} (${saizLabel})`);
  };
  reader.readAsDataURL(file);
}

function removeUploadedFile(prefix = 'f') {
  window[`_uploadedDoc_${prefix}`] = null;
  const input   = document.getElementById(`${prefix}-dokumen`);
  const preview = document.getElementById(`${prefix}-upload-preview`);
  if (input)   input.value = '';
  if (preview) preview.style.display = 'none';
}

function clearExistingDoc(prefix = 'f') {
  window[`_clearExistingDoc_${prefix}`] = true;
  // Cari dan buang preview existing
  const wrap = document.getElementById(`${prefix}-upload-wrap`);
  if (wrap) {
    const existPrev = wrap.nextElementSibling;
    if (existPrev && existPrev.classList.contains('upload-preview')) existPrev.remove();
  }
}

// ============================================================
//  UPLOAD LAPORAN SIAP HELPERS (Admin sahaja)
// ============================================================
function handleLaporanUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    showToast('error', '⛔ Format tidak disokong', 'Hanya fail PDF sahaja yang diterima.');
    input.value = '';
    return;
  }
  if (file.size > 500 * 1024) {
    showToast('error', '⛔ Fail terlalu besar', 'Saiz maksimum ialah 500KB. Sila mampatkan fail PDF terlebih dahulu.');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const saizLabel = file.size >= 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;

    window._uploadedLaporan = { data: e.target.result, nama: file.name, saiz: saizLabel };

    const preview = document.getElementById('ae-laporan-preview');
    const fname   = document.getElementById('ae-laporan-fname');
    const fsize   = document.getElementById('ae-laporan-fsize');
    if (preview) preview.style.display = 'flex';
    if (fname)   fname.textContent = file.name;
    if (fsize)   fsize.textContent = saizLabel;

    showToast('success', '📄 Laporan dimuat naik', `${file.name} (${saizLabel})`);
  };
  reader.readAsDataURL(file);
}

function removeAdminLaporan() {
  window._uploadedLaporan = null;
  const input   = document.getElementById('ae-laporan-input');
  const preview = document.getElementById('ae-laporan-preview');
  if (input)   input.value = '';
  if (preview) preview.style.display = 'none';
}

function clearAdminLaporan() {
  window._clearAdminLaporan = true;
  // Buang paparan laporan semasa dalam modal
  const wrap = document.getElementById('ae-laporan-wrap');
  if (wrap) {
    const prev = wrap.parentElement.querySelector('.upload-preview[style*="display:flex"]');
    if (prev) prev.remove();
  }
  showToast('info', 'Laporan dibuang', 'Simpan perubahan untuk mengesahkan pembuangan.');
}

// ============================================================
//  BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  loadPasswords(); // Pastikan kata laluan diinisialisasi dari USERS jika belum ada
  if (restoreSession()) {
    currentPage = 'dashboard';
  }
  renderApp();
});
