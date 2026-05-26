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
  if (tabName === 'scores')  renderAdminScores();
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
    const passHash = await hashPassword(pass);

    users[dni] = {
      dni, nombre: sanitize(nombre), email: sanitize(email),
      passHash, paid, saved: false, predictions: {}, rifas: 0,
      isAdmin: false, createdAt: new Date().toISOString()
    };

    saveToStorage('insc_users', users);
    logAudit('CREATE_USER', { dni, nombre: users[dni].nombre });
    hideLoading();
    closeModal('modal-add-user');
    renderAdminUsers();
    showToast('✅ Usuario agregado correctamente', 'success');
  } catch (error) {
    hideLoading();
    showToast('Error al agregar usuario', 'error');
  }
}

function openEditUser(dni) {
  const u = users[dni];
  if (!u) return;

  const overrides = getFromStorage('insc_points_override', {});
  document.getElementById('eu-dni').value    = u.dni;
  document.getElementById('eu-nombre').value = u.nombre;
  document.getElementById('eu-email').value  = u.email;
  document.getElementById('eu-pass').value   = '';
  document.getElementById('eu-paid').checked = u.paid === true;
  document.getElementById('eu-points').value = overrides[dni] !== undefined ? overrides[dni] : '';
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
    const user  = users[dni];
    user.nombre = sanitize(nombre);
    user.email  = sanitize(email);
    user.paid   = paid;
    if (pass) user.passHash = await hashPassword(pass);

    const overrides = getFromStorage('insc_points_override', {});
    if (pointsVal !== '') overrides[dni] = Number(pointsVal);
    else delete overrides[dni];
    saveToStorage('insc_points_override', overrides);

    saveToStorage('insc_users', users);
    logAudit('UPDATE_USER', { dni, nombre: user.nombre });
    hideLoading();
    closeModal('modal-edit-user');
    renderAdminUsers();
    renderAdminScores();
    showToast('✅ Usuario actualizado', 'success');
  } catch (error) {
    hideLoading();
    showToast('Error al actualizar usuario', 'error');
  }
}

function deleteCurrentUser() {
  const dni = window.editingUserDni;
  if (!dni) return;
  const u = users[dni];
  showConfirm(
    `¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`,
    () => {
      delete users[dni];
      saveToStorage('insc_users', users);
      logAudit('DELETE_USER', { dni, nombre: u.nombre });
      closeModal('modal-edit-user');
      renderAdminUsers();
      renderAdminScores();
      showToast('✅ Usuario eliminado', 'success');
    },
    true, 'Eliminar Usuario'
  );
}

// ===== ADMIN: RESULTADOS =====

function renderAdminResults() {
  const form    = document.getElementById('results-form');
  const results = getFromStorage('insc_results', {});

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

  PHASE_ORDER.forEach(phase => {
    const phaseMatches = byPhase[phase];
    if (!phaseMatches || phaseMatches.length === 0) return;

    const phaseHeader = document.createElement('div');
    phaseHeader.className = 'phase-header-admin';
    phaseHeader.innerHTML = `<strong>${phase.toUpperCase()}</strong>`;
    form.appendChild(phaseHeader);

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
        form.appendChild(groupLabel);

        gMatches
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .forEach(m => form.appendChild(buildResultCard(m, results[m._id])));
      });
    } else {
      phaseMatches
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(m => form.appendChild(buildResultCard(m, results[m._id])));
    }
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
    await new Promise(r => setTimeout(r, 500));
    const success = saveResults();
    hideLoading();
    if (success) { renderRanking(); renderAdminScores(); }
  } catch (error) {
    hideLoading();
    showToast('Error al guardar resultados', 'error');
  }
}

function saveResults() {
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

    saveToStorage('insc_results', results);
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

// ===== ADMIN: CORREGIR GRUPOS =====

async function fixGroupsFromESPN() {
  showConfirm(
    '¿Asignar grupos a los partidos de Fase de Grupos usando los standings de ESPN? Solo afecta partidos sin grupo asignado.',
    async () => {
      showLoading('Asignando grupos desde ESPN...');
      try {
        const res  = await fetch('/api/matches/fix-groups', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error en servidor');

        await loadMatchesFromAPI();
        hideLoading();
        renderAdminResults();
        renderProdeUI();
        showToast(`✅ ${data.fixed} partidos actualizados (${data.teams} equipos en mapa)`, 'success');
        logAudit('FIX_GROUPS', { fixed: data.fixed, total: data.total });
      } catch (err) {
        hideLoading();
        showToast(`Error al asignar grupos: ${err.message}`, 'error');
      }
    },
    false, 'Asignar Grupos'
  );
}

// ===== ADMIN: PUNTAJES =====

function renderAdminScores() {
  const tbody     = document.getElementById('admin-scores-tbody');
  const results   = getFromStorage('insc_results', {});
  const overrides = getFromStorage('insc_points_override', {});

  tbody.innerHTML = '';

  const participants = [];

  Object.values(users).forEach(u => {
    if (!u.paid || u.isAdmin) return;
    const preds   = u.predictions || {};
    let acertados  = 0;
    let puntosAuto = 0;

    Object.keys(results).forEach(matchId => {
      const r   = results[matchId];
      const p   = preds[matchId];
      const pts = calcMatchPoints(p, r);
      if (pts > 0) acertados++;
      puntosAuto += pts;
    });

    participants.push({
      dni: u.dni, nombre: u.nombre,
      aciertos: acertados, puntosAuto,
      puntosOverride: overrides[u.dni]
    });
  });

  participants.sort((a, b) => a.nombre.localeCompare(b.nombre));

  participants.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(p.nombre)}</td>
      <td>${p.dni}</td>
      <td>${p.aciertos}</td>
      <td>${p.puntosAuto}</td>
      <td>
        <input class="override-input" type="number"
          value="${p.puntosOverride !== undefined ? p.puntosOverride : ''}"
          placeholder="auto" id="ov-${p.dni}"
          style="width:100%; padding:6px; border:1px solid var(--gris-medio); border-radius:4px;">
      </td>`;
    tbody.appendChild(tr);
  });
}

function saveAdminScores() {
  try {
    const overrides = getFromStorage('insc_points_override', {});
    let cambios = 0;

    Object.values(users).forEach(u => {
      if (!u.paid || u.isAdmin) return;
      const input = document.getElementById(`ov-${u.dni}`);
      if (!input) return;
      const value = input.value.trim();
      if (value !== '') {
        const num = Number(value);
        if (!isNaN(num) && overrides[u.dni] !== num) { cambios++; overrides[u.dni] = num; }
      } else if (overrides[u.dni] !== undefined) { cambios++; delete overrides[u.dni]; }
    });

    saveToStorage('insc_points_override', overrides);
    logAudit('UPDATE_SCORES', { cambios });
    renderRanking();
    showToast(`✅ Puntajes guardados (${cambios} cambios)`, 'success');
  } catch (error) {
    showToast('Error al guardar puntajes', 'error');
  }
}

// ===== ADMIN: AUDITORÍA =====

function renderAdminLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '';

  if (auditLog.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">No hay registros aún</p>';
    return;
  }

  const logs = [...auditLog].reverse().slice(0, 100);

  logs.forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const details = Object.entries(log.detalles)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
    entry.innerHTML = `
      <div class="log-timestamp">${formatDate(log.timestamp)}</div>
      <div>
        <span class="log-usuario">${escapeHTML(log.usuario)}</span> realizó
        <span class="log-action">${log.accion}</span>
      </div>
      ${details ? `<div style="color:var(--text-light); font-size:12px; margin-top:4px;">${escapeHTML(details)}</div>` : ''}`;
    container.appendChild(entry);
  });
}

function clearAuditLogs() {
  showConfirm(
    '¿Borrar todos los registros de auditoría? Esta acción no se puede deshacer.',
    () => {
      auditLog = [];
      saveToStorage('insc_audit_log', auditLog);
      logAudit('CLEAR_AUDIT_LOGS', {});
      renderAdminLogs();
      showToast('✅ Logs borrados', 'success');
    },
    true, 'Borrar Logs'
  );
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
