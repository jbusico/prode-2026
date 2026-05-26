// ===== APP.JS - PARTE 2 =====
// Funciones de administración

// ===== ADMIN =====

function renderAdminUI() {
  switchAdminTab('users');
}

function switchAdminTab(tabName) {
  currentAdminTab = tabName;

  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));

  const tab = document.getElementById(`admin-${tabName}-tab`);
  if (tab) tab.classList.add('active');

  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(tabName)) b.classList.add('active');
  });

  if (tabName === 'users')   renderAdminUsers();
  if (tabName === 'results') renderAdminResults();
if (tabName === 'logs')    renderAdminLogs();
}

// ===== ADMIN: USUARIOS =====

function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '';

  Object.values(users).forEach(u => {
    if (u.isAdmin && u.dni !== currentUser) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.dni}</td>
      <td>${escapeHTML(u.nombre)}</td>
      <td>${escapeHTML(u.email)}</td>
      <td>${u.paid ? '✅' : '❌'}</td>
      <td><button class="btn-secondary" onclick="openEditUser('${u.dni}')">Editar</button></td>`;
    tbody.appendChild(tr);
  });
}

function openAddUserModal() {
  document.getElementById('au-dni').value    = '';
  document.getElementById('au-nombre').value = '';
  document.getElementById('au-email').value  = '';
  document.getElementById('au-pass').value   = '';
  document.getElementById('au-paid').checked = false;
  ['au-dni-error','au-nombre-error','au-email-error','au-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  openModal('modal-add-user');
}

async function saveAddUser() {
  const dni    = document.getElementById('au-dni').value.trim();
  const nombre = document.getElementById('au-nombre').value.trim();
  const email  = document.getElementById('au-email').value.trim();
  const pass   = document.getElementById('au-pass').value;
  const paid   = document.getElementById('au-paid').checked;

  ['au-dni-error','au-nombre-error','au-email-error','au-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  let valid = true;

  const dniVal = validateDNI(dni);
  if (!dniVal.valid) { document.getElementById('au-dni-error').textContent = dniVal.error; valid = false; }
  else if (users[dni]) { document.getElementById('au-dni-error').textContent = 'Este DNI ya existe'; valid = false; }

  const nameVal = validateName(nombre);
  if (!nameVal.valid) { document.getElementById('au-nombre-error').textContent = nameVal.error; valid = false; }

  const emailVal = validateEmail(email);
  if (!emailVal.valid) { document.getElementById('au-email-error').textContent = emailVal.error; valid = false; }

  const passVal = validatePassword(pass);
  if (!passVal.valid) { document.getElementById('au-pass-error').textContent = passVal.error; valid = false; }

  if (!valid) return;

  try {
    showLoading('Agregando usuario...');
    await apiCall('POST', '/api/auth/register', {
      dni, nombre: sanitize(nombre), email: sanitize(email),
      password: pass, paid
    });
    await loadAllUsers();
    logAudit('CREATE_USER', { dni, nombre: sanitize(nombre) });
    hideLoading();
    closeModal('modal-add-user');
    renderAdminUsers();
    showToast('✅ Usuario agregado correctamente', 'success');
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Error al agregar usuario', 'error');
  }
}

function openEditUser(dni) {
  const u = users[dni];
  if (!u) return;

  document.getElementById('eu-dni').value    = u.dni;
  document.getElementById('eu-nombre').value = u.nombre;
  document.getElementById('eu-email').value  = u.email;
  document.getElementById('eu-pass').value   = '';
  document.getElementById('eu-paid').checked = u.paid === true;
  document.getElementById('eu-points').value = latestResults.overrides[dni] !== undefined ? latestResults.overrides[dni] : '';
  ['eu-nombre-error','eu-email-error','eu-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  window.editingUserDni = dni;
  openModal('modal-edit-user');
}

async function saveEditUser() {
  const dni    = window.editingUserDni;
  if (!dni) return;

  const nombre    = document.getElementById('eu-nombre').value.trim();
  const email     = document.getElementById('eu-email').value.trim();
  const pass      = document.getElementById('eu-pass').value;
  const paid      = document.getElementById('eu-paid').checked;
  const pointsVal = document.getElementById('eu-points').value;

  ['eu-nombre-error','eu-email-error','eu-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  let valid = true;

  const nameVal = validateName(nombre);
  if (!nameVal.valid) { document.getElementById('eu-nombre-error').textContent = nameVal.error; valid = false; }

  const emailVal = validateEmail(email);
  if (!emailVal.valid) { document.getElementById('eu-email-error').textContent = emailVal.error; valid = false; }

  if (pass) {
    const passVal = validatePassword(pass);
    if (!passVal.valid) { document.getElementById('eu-pass-error').textContent = passVal.error; valid = false; }
  }

  if (!valid) return;

  try {
    showLoading('Guardando cambios...');

    const updateBody = { nombre: sanitize(nombre), email: sanitize(email), paid };
    if (pass) updateBody.password = pass;
    const updatedUser = await apiCall('PUT', `/api/users/${dni}`, updateBody);
    users[dni] = updatedUser;

    const currentResults = await apiCall('GET', '/api/results');
    const overrides = currentResults.overrides || {};
    if (pointsVal !== '') overrides[dni] = Number(pointsVal);
    else delete overrides[dni];
    await apiCall('PUT', '/api/results', { results: currentResults.results || {}, overrides });
    latestResults.overrides = overrides;

    logAudit('UPDATE_USER', { dni, nombre: sanitize(nombre) });
    hideLoading();
    closeModal('modal-edit-user');
    renderAdminUsers();
    showToast('✅ Usuario actualizado', 'success');
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Error al actualizar usuario', 'error');
  }
}

function deleteCurrentUser() {
  const dni = window.editingUserDni;
  if (!dni) return;
  const u = users[dni];
  showConfirm(
    `¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`,
    async () => {
      try {
        showLoading('Eliminando usuario...');
        await apiCall('DELETE', `/api/users/${dni}`);
        delete users[dni];
        logAudit('DELETE_USER', { dni, nombre: u.nombre });
        hideLoading();
        closeModal('modal-edit-user');
        renderAdminUsers();
        showToast('✅ Usuario eliminado', 'success');
      } catch (error) {
        hideLoading();
        showToast(error.message || 'Error al eliminar usuario', 'error');
      }
    },
    true, 'Eliminar Usuario'
  );
}

// ===== ADMIN: RESULTADOS =====

async function renderAdminResults() {
  const form = document.getElementById('results-form');
  form.innerHTML = '<div class="empty-matches" style="margin:20px 0;"><p>Cargando resultados...</p></div>';

  let results = {};
  try {
    const data = await apiCall('GET', '/api/results');
    results = data.results || {};
  } catch (e) {
    form.innerHTML = '<div class="empty-matches" style="margin:20px 0;"><p>Error al cargar resultados.</p></div>';
    return;
  }

  form.innerHTML = '';

  if (!MATCHES || MATCHES.length === 0) {
    form.innerHTML = `
      <div class="empty-matches" style="margin:20px 0;">
        <p>No hay partidos cargados. Sincronizá primero desde ESPN usando el botón de arriba.</p>
      </div>`;
    return;
  }

  const byPhase = {};
  MATCHES.forEach(m => {
    if (!byPhase[m.phase]) byPhase[m.phase] = [];
    byPhase[m.phase].push(m);
  });

  const availablePhases = PHASE_ORDER.filter(p => byPhase[p]?.length > 0);
  if (availablePhases.length === 0) return;

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'phase-tabs';
  availablePhases.forEach((phase, i) => {
    const btn = document.createElement('button');
    btn.className = 'phase-tab-btn' + (i === 0 ? ' active' : '');
    btn.textContent = phase;
    btn.dataset.phase = phase;
    btn.onclick = () => switchAdminResultsPhase(phase);
    tabBar.appendChild(btn);
  });
  form.appendChild(tabBar);

  // Phase sections
  availablePhases.forEach((phase, i) => {
    const phaseMatches = byPhase[phase];
    const section = document.createElement('div');
    section.className = 'results-phase-section';
    section.dataset.phase = phase;
    if (i !== 0) section.style.display = 'none';

    if (phase === 'Fase de Grupos') {
      const byGroup = {};
      phaseMatches.forEach(m => {
        const g = m.group || '?';
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(m);
      });

      [...GROUP_ORDER, '?'].forEach(gl => {
        const gMatches = byGroup[gl];
        if (!gMatches || gMatches.length === 0) return;

        const groupLabel = document.createElement('div');
        groupLabel.className = 'group-label-admin';
        groupLabel.textContent = gl !== '?' ? `Grupo ${gl}` : 'Sin grupo asignado';
        section.appendChild(groupLabel);

        gMatches
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .forEach(m => section.appendChild(buildResultCard(m, results[m._id])));
      });
    } else {
      phaseMatches
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(m => section.appendChild(buildResultCard(m, results[m._id])));
    }

    form.appendChild(section);
  });
}

function switchAdminResultsPhase(phase) {
  document.querySelectorAll('#results-form .phase-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.phase === phase);
  });
  document.querySelectorAll('#results-form .results-phase-section').forEach(sec => {
    sec.style.display = sec.dataset.phase === phase ? '' : 'none';
  });
}

function buildResultCard(match, res) {
  const id   = match._id;
  const r    = res || { home: '', away: '' };
  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <div class="result-teams">
      <strong>${escapeHTML(match.homeTeam)} vs ${escapeHTML(match.awayTeam)}</strong>
      <span style="color:var(--text-light); font-size:12px; margin-left:auto;">${match.dateStr || ''}</span>
    </div>
    <div class="result-inputs">
      <input type="number" class="result-input" min="0" max="20"
        value="${r.home}" id="res-home-${id}" placeholder="0">
      <div style="color:var(--text-light); font-weight:700;">–</div>
      <input type="number" class="result-input" min="0" max="20"
        value="${r.away}" id="res-away-${id}" placeholder="0">
    </div>`;
  return card;
}

async function saveResultsWithLoader() {
  showLoading('Guardando resultados...');
  try {
    const success = await saveResults();
    hideLoading();
    if (success) { await renderRanking(); }
  } catch (error) {
    hideLoading();
    showToast('Error al guardar resultados', 'error');
  }
}

async function saveResults() {
  try {
    const results = {};
    const errors  = [];

    for (const match of MATCHES) {
      const id     = match._id;
      const homeEl = document.getElementById(`res-home-${id}`);
      const awayEl = document.getElementById(`res-away-${id}`);
      if (!homeEl || !awayEl) continue;

      const homeVal = homeEl.value.trim();
      const awayVal = awayEl.value.trim();

      if (homeVal === '' && awayVal === '') {
        results[id] = { home: '', away: '' };
        continue;
      }

      if ((homeVal === '') !== (awayVal === '')) {
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: Complete ambos marcadores`);
        continue;
      }

      if (!/^\d+$/.test(homeVal) || !/^\d+$/.test(awayVal)) {
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: Solo números`);
        continue;
      }

      const home = parseInt(homeVal);
      const away = parseInt(awayVal);

      if (home > 20 || away > 20) {
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: Marcador irreal`);
        continue;
      }

      results[id] = { home, away };
    }

    if (errors.length > 0) {
      showToast(errors.slice(0, 3).join(' | '), 'error');
      return false;
    }

    await apiCall('PUT', '/api/results', { results, overrides: latestResults.overrides });
    latestResults.results = results;
    logAudit('SAVE_RESULTS', {
      cantidad: Object.keys(results).filter(k => results[k].home !== '').length
    });
    showToast('✅ Resultados guardados correctamente', 'success');
    return true;
  } catch (error) {
    console.error('Error guardando resultados:', error);
    showToast('Error al guardar resultados', 'error');
    return false;
  }
}

// ===== ADMIN: SINCRONIZAR PARTIDOS DESDE ESPN =====

async function syncMatchesFromESPN() {
  showConfirm(
    '¿Sincronizar todos los partidos desde ESPN/FIFA? Esto actualiza la base de datos (tarda 1-2 min).',
    async () => {
      showLoading('Sincronizando partidos desde ESPN...');
      try {
        const res  = await fetch('/api/matches/sync', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error en servidor');

        await loadMatchesFromAPI();
        hideLoading();
        renderAdminResults();
        renderProdeUI();
        showToast(`✅ ${data.count} partidos sincronizados`, 'success');
        logAudit('SYNC_MATCHES', { count: data.count });
      } catch (err) {
        hideLoading();
        showToast(`Error al sincronizar: ${err.message}`, 'error');
      }
    },
    false, 'Sincronizar'
  );
}

// ===== ADMIN: AUDITORÍA =====

async function renderAdminLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">Cargando...</p>';

  // Logs del servidor (MongoDB)
  let todos = [];
  try {
    todos = await apiCall('GET', '/api/logs');
  } catch (e) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">Error al cargar logs</p>';
    return;
  }

  container.innerHTML = '';

  if (todos.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">No hay registros aún</p>';
    return;
  }

  todos.forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const details = Object.entries(log.detalles)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
    const origenBadge = log._origen === 'servidor'
      ? '<span style="font-size:10px; background:var(--card-alt); padding:1px 6px; border-radius:4px; margin-left:6px;">servidor</span>'
      : '';
    entry.innerHTML = `
      <div class="log-timestamp">${formatDate(log.timestamp)}${origenBadge}</div>
      <div>
        <span class="log-usuario">${escapeHTML(log.usuario)}</span> realizó
        <span class="log-action">${log.accion}</span>
      </div>
      ${details ? `<div style="color:var(--text-light); font-size:12px; margin-top:4px;">${escapeHTML(details)}</div>` : ''}`;
    container.appendChild(entry);
  });
}


function downloadAuditLogs() {
  const lines = ['timestamp,usuario,accion,detalles'];
  auditLog.forEach(log => {
    lines.push(`"${log.timestamp}","${log.usuario}","${log.accion}","${JSON.stringify(log.detalles)}"`);
  });
  downloadCSV('audit_logs.csv', lines);
  showToast('📥 Descargando logs...', 'info');
}

// ===== INICIALIZACIÓN =====

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

console.log('✅ App.js Parte 2 cargado');
