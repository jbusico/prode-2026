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

  if (tabName === 'users')    renderAdminUsers();
  if (tabName === 'results')  renderAdminResults();
  if (tabName === 'partidos') renderAdminMatches();
  if (tabName === 'logs')     renderAdminLogs();
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
  let locked = {};
  try {
    const data = await apiCall('GET', '/api/results');
    results = data.results || {};
    locked = data.locked || {};
    latestResults.locked = locked;
    latestResults.predictionsClosed = !!data.predictionsClosed;
    updatePredictionsToggleBtn();
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

  const groupMatches = MATCHES.filter(m => m.phase === 'Fase de Grupos');

  if (groupMatches.length === 0) {
    form.innerHTML = `
      <div class="empty-matches" style="margin:20px 0;">
        <p>No hay partidos de Fase de Grupos cargados.</p>
      </div>`;
    return;
  }

  // Sección Campeón al tope
  const allTeams = [...new Set(groupMatches.flatMap(m => [m.homeTeam, m.awayTeam]))].sort();
  const currentChampion = results.champion || '';

  const champDiv = document.createElement('div');
  champDiv.className = 'champion-admin-section';
  champDiv.innerHTML = `
    <h4>🏆 Campeón del Mundial</h4>
    <select id="admin-champion-select" class="champion-select">
      <option value="">-- Sin resultado --</option>
      ${allTeams.map(t => `<option value="${escapeHTML(t)}"${t === currentChampion ? ' selected' : ''}>${escapeHTML(t)}</option>`).join('')}
    </select>`;
  form.appendChild(champDiv);

  // Partidos de Fase de Grupos
  const byGroup = {};
  groupMatches.forEach(m => {
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
      .forEach(m => form.appendChild(buildResultCard(m, results[m._id], locked[m._id])));
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

function buildResultCard(match, res, isLocked) {
  const id   = match._id;
  const r    = res || { home: '', away: '' };
  const locked = !!isLocked;
  const card = document.createElement('div');
  card.className = 'result-card' + (locked ? ' result-card--locked' : '');
  card.innerHTML = `
    <div class="result-teams">
      <strong>${escapeHTML(match.homeTeam)} vs ${escapeHTML(match.awayTeam)}</strong>
      <span style="color:var(--text-light); font-size:12px; margin-left:auto;">${match.dateStr || ''}</span>
    </div>
    <div class="result-inputs">
      <input type="number" class="result-input" min="0" max="20"
        value="${r.home}" id="res-home-${id}" placeholder="0"${locked ? ' disabled' : ''}>
      <div style="color:var(--text-light); font-weight:700;">–</div>
      <input type="number" class="result-input" min="0" max="20"
        value="${r.away}" id="res-away-${id}" placeholder="0"${locked ? ' disabled' : ''}>
      <button
        id="lock-btn-${id}"
        onclick="toggleMatchLock('${id}')"
        title="${locked ? 'Desbloquear partido' : 'Bloquear partido'}"
        class="lock-result-btn${locked ? ' locked' : ''}">
        ${locked ? '🔒' : '🔓'}
      </button>
      <button
        id="clear-btn-${id}"
        onclick="clearMatchResult('${id}')"
        title="Borrar resultado"
        class="clear-result-btn"${locked ? ' disabled' : ''}>✕</button>
    </div>`;
  return card;
}

async function toggleMatchLock(matchId) {
  const isCurrentlyLocked = !!((latestResults.locked || {})[matchId]);
  const newLocked = !isCurrentlyLocked;
  try {
    await apiCall('PUT', `/api/results/lock/${matchId}`, { locked: newLocked });
    if (!latestResults.locked) latestResults.locked = {};
    if (newLocked) {
      latestResults.locked[matchId] = true;
    } else {
      delete latestResults.locked[matchId];
    }
    const lockBtn   = document.getElementById(`lock-btn-${matchId}`);
    const homeInput = document.getElementById(`res-home-${matchId}`);
    const awayInput = document.getElementById(`res-away-${matchId}`);
    const clearBtn  = document.getElementById(`clear-btn-${matchId}`);
    const card      = lockBtn ? lockBtn.closest('.result-card') : null;
    if (lockBtn) {
      lockBtn.textContent = newLocked ? '🔒' : '🔓';
      lockBtn.title = newLocked ? 'Desbloquear partido' : 'Bloquear partido';
      lockBtn.classList.toggle('locked', newLocked);
    }
    if (homeInput) homeInput.disabled = newLocked;
    if (awayInput) awayInput.disabled = newLocked;
    if (clearBtn)  clearBtn.disabled  = newLocked;
    if (card)      card.classList.toggle('result-card--locked', newLocked);
    showToast(newLocked ? '🔒 Partido bloqueado' : '🔓 Partido desbloqueado', 'success');
  } catch (error) {
    showToast('Error al cambiar el bloqueo', 'error');
  }
}

async function clearMatchResult(matchId) {
  if ((latestResults.locked || {})[matchId]) {
    showToast('El partido está bloqueado', 'error');
    return;
  }
  const homeEl = document.getElementById(`res-home-${matchId}`);
  const awayEl = document.getElementById(`res-away-${matchId}`);
  if (!homeEl || !awayEl) return;
  if (homeEl.value === '' && awayEl.value === '') {
    showToast('No hay resultado cargado', 'info');
    return;
  }

  homeEl.value = '';
  awayEl.value = '';

  showLoading('Borrando resultado...');
  try {
    const success = await saveResults();
    hideLoading();
    if (success) {
      await renderRanking();
      showToast('Resultado borrado', 'success');
    }
  } catch (error) {
    hideLoading();
    showToast('Error al borrar resultado', 'error');
  }
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

    const groupMatches = MATCHES.filter(m => m.phase === 'Fase de Grupos');

    for (const match of groupMatches) {
      const id     = match._id;

      if ((latestResults.locked || {})[id]) {
        results[id] = latestResults.results[id] || { home: '', away: '' };
        continue;
      }

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

    const champSelect = document.getElementById('admin-champion-select');
    results.champion = champSelect ? champSelect.value : '';

    await apiCall('PUT', '/api/results', { results, overrides: latestResults.overrides });
    latestResults.results = results;
    logAudit('SAVE_RESULTS', {
      cantidad: Object.keys(results).filter(k => k !== 'champion' && results[k].home !== '').length
    });
    showToast('✅ Resultados guardados correctamente', 'success');
    return true;
  } catch (error) {
    console.error('Error guardando resultados:', error);
    showToast('Error al guardar resultados', 'error');
    return false;
  }
}

async function clearResults() {
  showConfirm(
    '¿Borrar TODOS los resultados cargados? Esta acción no se puede deshacer.',
    async () => {
      showLoading('Borrando resultados...');
      try {
        const currentResults = await apiCall('GET', '/api/results');
        await apiCall('PUT', '/api/results', { results: {}, overrides: currentResults.overrides || {} });
        latestResults.results = {};
        logAudit('CLEAR_RESULTS', {});
        hideLoading();
        renderAdminResults();
        await renderRanking();
        showToast('✅ Resultados borrados correctamente', 'success');
      } catch (error) {
        hideLoading();
        showToast('Error al borrar resultados', 'error');
      }
    },
    true, 'Borrar Resultados'
  );
}

// ===== ADMIN: CERRAR/ABRIR PRONÓSTICOS =====

async function togglePredictionsClosed() {
  const newClosed = !latestResults.predictionsClosed;
  const action = newClosed ? 'cerrar' : 'abrir';
  showConfirm(
    `¿Querés ${action} la carga de pronósticos para todos los usuarios?`,
    async () => {
      try {
        showLoading(newClosed ? 'Cerrando pronósticos...' : 'Abriendo pronósticos...');
        await apiCall('PUT', '/api/results/predictions-closed', { closed: newClosed });
        latestResults.predictionsClosed = newClosed;
        hideLoading();
        updatePredictionsToggleBtn();
        applyPredictionsClosedUI();
        logAudit(newClosed ? 'CLOSE_PREDICTIONS' : 'OPEN_PREDICTIONS', {});
        showToast(newClosed ? '🔒 Pronósticos cerrados para todos' : '🔓 Pronósticos abiertos para todos', 'success');
      } catch (error) {
        hideLoading();
        showToast('Error al cambiar el estado de pronósticos', 'error');
      }
    },
    false,
    newClosed ? 'Cerrar Pronósticos' : 'Abrir Pronósticos'
  );
}

function updatePredictionsToggleBtn() {
  const btn        = document.getElementById('predictions-toggle-btn');
  const statusText = document.getElementById('predictions-status-text');
  const closed     = !!latestResults.predictionsClosed;
  if (btn) {
    btn.textContent = closed ? '🔓 Abrir Pronósticos' : '🔒 Cerrar Pronósticos';
    btn.className   = closed ? 'btn-success predictions-toggle-btn' : 'btn-danger predictions-toggle-btn';
  }
  if (statusText) {
    statusText.textContent = closed
      ? 'Estado: 🔒 Cerrado — los usuarios no pueden cargar pronósticos'
      : 'Estado: 🔓 Abierto — los usuarios pueden cargar pronósticos';
    statusText.style.color = closed ? 'var(--error)' : 'var(--success)';
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

// ===== ADMIN: PARTIDOS =====

let editingMatchId = null;

async function renderAdminMatches() {
  const container = document.getElementById('matches-list-admin');
  container.innerHTML = '<p style="color:var(--text-light);padding:12px 0">Cargando partidos...</p>';

  try {
    const matches = await apiCall('GET', '/api/matches');
    const groupMatches = matches.filter(m => m.phase === 'Fase de Grupos');

    if (groupMatches.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);padding:12px 0">No hay partidos de Fase de Grupos.</p>';
      return;
    }

    const byGroup = {};
    groupMatches.forEach(m => {
      const g = m.group || '?';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(m);
    });

    let html = '<table class="admin-table"><thead><tr><th>Local</th><th>Visitante</th><th>Grupo</th><th>Acciones</th></tr></thead><tbody>';

    [...GROUP_ORDER, '?'].forEach(g => {
      if (!byGroup[g]) return;
      byGroup[g]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(m => {
          const label = `${escapeHTML(m.homeTeam)} vs ${escapeHTML(m.awayTeam)}`;
          html += `<tr>
            <td>${escapeHTML(m.homeTeam)}</td>
            <td>${escapeHTML(m.awayTeam)}</td>
            <td>${m.group || '<span style="color:var(--rojo)">Sin grupo</span>'}</td>
            <td style="display:flex;gap:6px;">
              <button class="btn-secondary" style="padding:4px 10px;font-size:13px;"
                data-id="${m._id}"
                data-home="${escapeHTML(m.homeTeam)}" data-away="${escapeHTML(m.awayTeam)}"
                data-group="${m.group || ''}" data-phase="${escapeHTML(m.phase)}"
                onclick="openEditMatchModal(this.dataset)">✏️ Editar</button>
              <button class="btn-danger" style="padding:4px 10px;font-size:13px;"
                data-id="${m._id}" data-label="${label}"
                onclick="deleteMatch(this.dataset.id, this.dataset.label)">🗑️</button>
            </td>
          </tr>`;
        });
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-light);padding:12px 0">Error al cargar partidos.</p>';
  }
}

function openAddMatchModal() {
  editingMatchId = null;
  document.getElementById('nm-modal-title').textContent = 'Agregar Partido';
  document.getElementById('nm-submit-btn').textContent  = 'Agregar Partido';
  document.getElementById('nm-home').value  = '';
  document.getElementById('nm-away').value  = '';
  document.getElementById('nm-group').value = '';
  document.getElementById('nm-phase').value = 'Fase de Grupos';
  document.getElementById('nm-home-error').textContent = '';
  document.getElementById('nm-away-error').textContent = '';
  openModal('modal-add-match');
}

function openEditMatchModal(dataset) {
  editingMatchId = dataset.id;
  document.getElementById('nm-modal-title').textContent = 'Editar Partido';
  document.getElementById('nm-submit-btn').textContent  = 'Guardar Cambios';
  document.getElementById('nm-home').value  = dataset.home;
  document.getElementById('nm-away').value  = dataset.away;
  document.getElementById('nm-group').value = dataset.group || '';
  document.getElementById('nm-phase').value = dataset.phase || 'Fase de Grupos';
  document.getElementById('nm-home-error').textContent = '';
  document.getElementById('nm-away-error').textContent = '';
  openModal('modal-add-match');
}

async function saveNewMatch() {
  const homeTeam = document.getElementById('nm-home').value.trim();
  const awayTeam = document.getElementById('nm-away').value.trim();
  const group    = document.getElementById('nm-group').value;
  const phase    = document.getElementById('nm-phase').value;

  document.getElementById('nm-home-error').textContent = '';
  document.getElementById('nm-away-error').textContent = '';

  let valid = true;
  if (!homeTeam) { document.getElementById('nm-home-error').textContent = 'Campo requerido'; valid = false; }
  if (!awayTeam) { document.getElementById('nm-away-error').textContent = 'Campo requerido'; valid = false; }
  if (!valid) return;

  try {
    if (editingMatchId) {
      showLoading('Guardando cambios...');
      await apiCall('PUT', `/api/matches/${editingMatchId}`, { homeTeam, awayTeam, group: group || null, phase });
      hideLoading();
      closeModal('modal-add-match');
      showToast('✅ Partido actualizado correctamente', 'success');
    } else {
      showLoading('Agregando partido...');
      await apiCall('POST', '/api/matches', { homeTeam, awayTeam, group: group || null, phase });
      hideLoading();
      closeModal('modal-add-match');
      showToast('✅ Partido agregado correctamente', 'success');
    }
    await loadMatchesFromAPI();
    renderAdminMatches();
  } catch (error) {
    hideLoading();
    showToast(error.message || 'Error al guardar partido', 'error');
  }
}

async function deleteMatch(id, label) {
  showConfirm(
    `¿Eliminar el partido "${label}"? Esta acción no se puede deshacer.`,
    async () => {
      try {
        showLoading('Eliminando partido...');
        await apiCall('DELETE', `/api/matches/${id}`);
        hideLoading();
        showToast('✅ Partido eliminado', 'success');
        await loadMatchesFromAPI();
        renderAdminMatches();
      } catch (error) {
        hideLoading();
        showToast(error.message || 'Error al eliminar partido', 'error');
      }
    },
    true,
    'Eliminar Partido'
  );
}

// ===== INICIALIZACIÓN =====

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

console.log('✅ App.js Parte 2 cargado');
