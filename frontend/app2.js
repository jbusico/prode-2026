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

  if (tabName === 'users') renderAdminUsers();
  else if (tabName === 'results') renderAdminResults();
  else if (tabName === 'scores') renderAdminScores();
  else if (tabName === 'logs') renderAdminLogs();
}

// ===== ADMIN: USUARIOS =====

async function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';
  try {
    const allUsers = await apiCall('GET', '/api/users');
    allUsers.forEach(u => { users[u.dni] = u; });

    tbody.innerHTML = '';
    allUsers.forEach(u => {
      if (u.isAdmin && u.dni !== currentUser) return;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.dni}</td>
        <td>${escapeHTML(u.nombre)}</td>
        <td>${escapeHTML(u.email)}</td>
        <td>${u.paid ? '✅' : '❌'}</td>
        <td><button class="btn-secondary" onclick="openEditUser('${u.dni}')">Editar</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar usuarios</td></tr>';
  }
}

function openAddUserModal() {
  ['au-dni', 'au-nombre', 'au-email', 'au-pass'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('au-paid').checked = false;
  ['au-dni-error', 'au-nombre-error', 'au-email-error', 'au-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  openModal('modal-add-user');
}

async function saveAddUser() {
  const dni = document.getElementById('au-dni').value.trim();
  const nombre = document.getElementById('au-nombre').value.trim();
  const email = document.getElementById('au-email').value.trim();
  const pass = document.getElementById('au-pass').value;
  const paid = document.getElementById('au-paid').checked;

  ['au-dni-error', 'au-nombre-error', 'au-email-error', 'au-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  let valid = true;
  const dniVal = validateDNI(dni);
  if (!dniVal.valid) { document.getElementById('au-dni-error').textContent = dniVal.error; valid = false; }
  const nameVal = validateName(nombre);
  if (!nameVal.valid) { document.getElementById('au-nombre-error').textContent = nameVal.error; valid = false; }
  const emailVal = validateEmail(email);
  if (!emailVal.valid) { document.getElementById('au-email-error').textContent = emailVal.error; valid = false; }
  const passVal = validatePassword(pass);
  if (!passVal.valid) { document.getElementById('au-pass-error').textContent = passVal.error; valid = false; }
  if (!valid) return;

  try {
    showLoading('Agregando usuario...');
    await apiCall('POST', '/api/auth/register', { dni, nombre, email, password: pass, paid });
    logAudit('CREATE_USER', { dni, nombre });
    hideLoading();
    closeModal('modal-add-user');
    await renderAdminUsers();
    showToast('✅ Usuario agregado correctamente', 'success');
  } catch (error) {
    hideLoading();
    if (error.message.includes('ya existe')) {
      document.getElementById('au-dni-error').textContent = 'Este DNI ya existe';
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }
  }
}

async function openEditUser(dni) {
  const u = users[dni];
  if (!u) return;

  document.getElementById('eu-dni').value = u.dni;
  document.getElementById('eu-nombre').value = u.nombre;
  document.getElementById('eu-email').value = u.email;
  document.getElementById('eu-pass').value = '';
  document.getElementById('eu-paid').checked = u.paid === true;

  try {
    const { overrides } = await apiCall('GET', '/api/results');
    document.getElementById('eu-points').value = overrides[dni] !== undefined ? overrides[dni] : '';
  } catch {
    document.getElementById('eu-points').value = '';
  }

  ['eu-nombre-error', 'eu-email-error', 'eu-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  window.editingUserDni = dni;
  openModal('modal-edit-user');
}

async function saveEditUser() {
  const dni = window.editingUserDni;
  if (!dni) return;

  const nombre = document.getElementById('eu-nombre').value.trim();
  const email = document.getElementById('eu-email').value.trim();
  const pass = document.getElementById('eu-pass').value;
  const paid = document.getElementById('eu-paid').checked;
  const pointsVal = document.getElementById('eu-points').value;

  ['eu-nombre-error', 'eu-email-error', 'eu-pass-error'].forEach(id => {
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

    const body = { nombre, email, paid };
    if (pass) body.password = pass;
    await apiCall('PUT', `/api/users/${dni}`, body);

    // Actualizar override de puntos
    const currentData = await apiCall('GET', '/api/results');
    const overrides = currentData.overrides || {};
    if (pointsVal !== '') {
      overrides[dni] = Number(pointsVal);
    } else {
      delete overrides[dni];
    }
    await apiCall('PUT', '/api/results', { results: currentData.results || {}, overrides });

    logAudit('UPDATE_USER', { dni, nombre });
    hideLoading();
    closeModal('modal-edit-user');
    await renderAdminUsers();
    await renderAdminScores();
    showToast('✅ Usuario actualizado', 'success');
  } catch (error) {
    hideLoading();
    showToast(`Error: ${error.message}`, 'error');
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
        await renderAdminUsers();
        await renderAdminScores();
        showToast('✅ Usuario eliminado', 'success');
      } catch (error) {
        hideLoading();
        showToast(`Error: ${error.message}`, 'error');
      }
    },
    true,
    'Eliminar Usuario'
  );
}

// ===== ADMIN: RESULTADOS =====

async function renderAdminResults() {
  const form = document.getElementById('results-form');
  form.innerHTML = '<p style="text-align:center; padding:20px;">Cargando...</p>';
  try {
    const { results } = await apiCall('GET', '/api/results');
    form.innerHTML = '';

    Object.values(MATCHES).flat().forEach((match, i) => {
      const res = (results && results[i]) ? results[i] : { home: '', away: '' };
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `
        <div class="result-teams">
          <strong>${match.home} vs ${match.away}</strong>
          <span style="color:var(--text-light); font-size:12px; margin-left:auto;">${match.date}</span>
        </div>
        <div class="result-inputs">
          <input type="number" class="result-input" min="0" max="20"
            value="${res.home}" id="res-home-${i}" placeholder="0">
          <div style="color:var(--text-light); font-weight:700;">–</div>
          <input type="number" class="result-input" min="0" max="20"
            value="${res.away}" id="res-away-${i}" placeholder="0">
        </div>
      `;
      form.appendChild(card);
    });
  } catch (error) {
    form.innerHTML = '<p style="text-align:center; color:red; padding:20px;">Error al cargar resultados</p>';
  }
}

async function saveResultsWithLoader() {
  showLoading('Guardando resultados...');
  try {
    const success = await saveResults();
    hideLoading();
    if (success) {
      await renderRanking();
      await renderAdminScores();
    }
  } catch (error) {
    hideLoading();
    showToast('Error al guardar resultados', 'error');
  }
}

async function saveResults() {
  try {
    const results = {};
    let errors = [];

    Object.values(MATCHES).flat().forEach((match, i) => {
      const homeVal = document.getElementById(`res-home-${i}`).value.trim();
      const awayVal = document.getElementById(`res-away-${i}`).value.trim();
      if (homeVal === '' && awayVal === '') { results[i] = { home: '', away: '' }; return; }
      if ((homeVal === '') !== (awayVal === '')) { errors.push(`Partido ${i + 1}: Complete ambos marcadores`); return; }
      if (!/^\d+$/.test(homeVal) || !/^\d+$/.test(awayVal)) { errors.push(`Partido ${i + 1}: Solo se aceptan números`); return; }
      const home = parseInt(homeVal);
      const away = parseInt(awayVal);
      if (home > 20 || away > 20) { errors.push(`Partido ${i + 1}: Marcador poco realista`); return; }
      results[i] = { home, away };
    });

    if (errors.length > 0) {
      showToast('Errores: ' + errors.join(', '), 'error');
      return false;
    }

    const currentData = await apiCall('GET', '/api/results');
    await apiCall('PUT', '/api/results', { results, overrides: currentData.overrides || {} });

    logAudit('SAVE_RESULTS', { cantidad: Object.keys(results).filter(k => results[k].home !== '').length });
    showToast('✅ Resultados guardados correctamente', 'success');
    return true;
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
    return false;
  }
}

// ===== ADMIN: PUNTAJES =====

async function renderAdminScores() {
  const tbody = document.getElementById('admin-scores-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';
  try {
    const [allUsers, resultsData] = await Promise.all([
      apiCall('GET', '/api/users'),
      apiCall('GET', '/api/results')
    ]);

    const results = resultsData.results || {};
    const overrides = resultsData.overrides || {};
    allUsers.forEach(u => { users[u.dni] = u; });

    const participants = allUsers
      .filter(u => u.paid && !u.isAdmin)
      .map(u => {
        const preds = u.predictions || {};
        let acertados = 0;
        Object.keys(results).forEach(i => {
          const r = results[i]; const p = preds[i];
          if (p && String(p.home) === String(r.home) && String(p.away) === String(r.away)) acertados++;
        });
        return { dni: u.dni, nombre: u.nombre, aciertos: acertados, puntosAuto: acertados * 5, puntosOverride: overrides[u.dni] };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    tbody.innerHTML = '';
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
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al cargar puntajes</td></tr>';
  }
}

async function saveAdminScores() {
  try {
    const currentData = await apiCall('GET', '/api/results');
    const overrides = currentData.overrides || {};
    let cambios = 0;

    Object.values(users).forEach(u => {
      if (!u.paid || u.isAdmin) return;
      const input = document.getElementById(`ov-${u.dni}`);
      if (!input) return;
      const value = input.value.trim();
      if (value !== '') {
        const numValue = Number(value);
        if (!isNaN(numValue) && overrides[u.dni] !== numValue) { cambios++; overrides[u.dni] = numValue; }
      } else if (overrides[u.dni] !== undefined) {
        cambios++;
        delete overrides[u.dni];
      }
    });

    await apiCall('PUT', '/api/results', { results: currentData.results || {}, overrides });
    logAudit('UPDATE_SCORES', { cambios });
    await renderRanking();
    showToast(`✅ Puntajes guardados (${cambios} cambios)`, 'success');
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
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

  [...auditLog].reverse().slice(0, 100).forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const details = Object.entries(log.detalles).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
    entry.innerHTML = `
      <div class="log-timestamp">${formatDate(log.timestamp)}</div>
      <div>
        <span class="log-usuario">${escapeHTML(log.usuario)}</span> realizó
        <span class="log-action">${log.accion}</span>
      </div>
      ${details ? `<div style="color:var(--text-light); font-size:12px; margin-top:4px;">${escapeHTML(details)}</div>` : ''}
    `;
    container.appendChild(entry);
  });
}

function clearAuditLogs() {
  showConfirm(
    '¿Estás seguro de que quieres borrar todos los registros? Esta acción no se puede deshacer.',
    () => {
      auditLog = [];
      saveToStorage('insc_audit_log', auditLog);
      logAudit('CLEAR_AUDIT_LOGS', {});
      renderAdminLogs();
      showToast('✅ Logs borrados', 'success');
    },
    true,
    'Borrar Logs'
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
