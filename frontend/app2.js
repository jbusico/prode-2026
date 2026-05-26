// ===== APP.JS - PARTE 2 =====
// Funciones de administración

// ===== ADMIN =====

/**
 * Renderiza la UI del admin
 */
function renderAdminUI() {
  switchAdminTab('users');
}

/**
 * Cambia de tab en admin
 */
function switchAdminTab(tabName) {
  currentAdminTab = tabName;
  
  // Desactivar todos los tabs
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.remove('active');
  });
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('active');
  });
  
  // Activar el seleccionado
  const tab = document.getElementById(`admin-${tabName}-tab`);
  if (tab) {
    tab.classList.add('active');
  }
  
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(tabName)) {
      b.classList.add('active');
    }
  });
  
  // Renderizar contenido
  if (tabName === 'users') {
    renderAdminUsers();
  } else if (tabName === 'results') {
    renderAdminResults();
  } else if (tabName === 'scores') {
    renderAdminScores();
  } else if (tabName === 'logs') {
    renderAdminLogs();
  }
}

// ===== ADMIN: USUARIOS =====

/**
 * Renderiza tabla de usuarios
 */
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
      <td>
        <button class="btn-secondary" onclick="openEditUser('${u.dni}')">Editar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Abre modal para agregar usuario
 */
function openAddUserModal() {
  document.getElementById('au-dni').value = '';
  document.getElementById('au-nombre').value = '';
  document.getElementById('au-email').value = '';
  document.getElementById('au-pass').value = '';
  document.getElementById('au-paid').checked = false;
  
  // Limpiar errores
  ['au-dni-error', 'au-nombre-error', 'au-email-error', 'au-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  
  openModal('modal-add-user');
}

/**
 * Guarda un usuario nuevo
 */
async function saveAddUser() {
  const dni = document.getElementById('au-dni').value.trim();
  const nombre = document.getElementById('au-nombre').value.trim();
  const email = document.getElementById('au-email').value.trim();
  const pass = document.getElementById('au-pass').value;
  const paid = document.getElementById('au-paid').checked;
  
  // Limpiar errores
  ['au-dni-error', 'au-nombre-error', 'au-email-error', 'au-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  
  // Validar
  let valid = true;
  
  const dniVal = validateDNI(dni);
  if (!dniVal.valid) {
    document.getElementById('au-dni-error').textContent = dniVal.error;
    valid = false;
  } else if (users[dni]) {
    document.getElementById('au-dni-error').textContent = 'Este DNI ya existe';
    valid = false;
  }
  
  const nameVal = validateName(nombre);
  if (!nameVal.valid) {
    document.getElementById('au-nombre-error').textContent = nameVal.error;
    valid = false;
  }
  
  const emailVal = validateEmail(email);
  if (!emailVal.valid) {
    document.getElementById('au-email-error').textContent = emailVal.error;
    valid = false;
  }
  
  const passVal = validatePassword(pass);
  if (!passVal.valid) {
    document.getElementById('au-pass-error').textContent = passVal.error;
    valid = false;
  }
  
  if (!valid) return;
  
  try {
    showLoading('Agregando usuario...');
    
    const passHash = await hashPassword(pass);
    
    users[dni] = {
      dni: dni,
      nombre: sanitize(nombre),
      email: sanitize(email),
      passHash: passHash,
      paid: paid,
      saved: false,
      predictions: {},
      rifas: 0,
      isAdmin: false,
      createdAt: new Date().toISOString()
    };
    
    saveToStorage('insc_users', users);
    
    logAudit('CREATE_USER', { dni, nombre: users[dni].nombre });
    
    hideLoading();
    closeModal('modal-add-user');
    renderAdminUsers();
    showToast('✅ Usuario agregado correctamente', 'success');
  } catch (error) {
    hideLoading();
    console.error('Error agregando usuario:', error);
    showToast('Error al agregar usuario', 'error');
  }
}

/**
 * Abre modal para editar usuario
 */
function openEditUser(dni) {
  const u = users[dni];
  if (!u) return;
  
  const overrides = getFromStorage('insc_points_override', {});
  
  document.getElementById('eu-dni').value = u.dni;
  document.getElementById('eu-nombre').value = u.nombre;
  document.getElementById('eu-email').value = u.email;
  document.getElementById('eu-pass').value = '';
  document.getElementById('eu-paid').checked = u.paid === true;
  document.getElementById('eu-points').value = overrides[dni] !== undefined ? overrides[dni] : '';
  
  // Limpiar errores
  ['eu-nombre-error', 'eu-email-error', 'eu-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  
  window.editingUserDni = dni;
  openModal('modal-edit-user');
}

/**
 * Guarda cambios de usuario
 */
async function saveEditUser() {
  const dni = window.editingUserDni;
  if (!dni) return;
  
  const nombre = document.getElementById('eu-nombre').value.trim();
  const email = document.getElementById('eu-email').value.trim();
  const pass = document.getElementById('eu-pass').value;
  const paid = document.getElementById('eu-paid').checked;
  const pointsVal = document.getElementById('eu-points').value;
  
  // Limpiar errores
  ['eu-nombre-error', 'eu-email-error', 'eu-pass-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  
  // Validar
  let valid = true;
  
  const nameVal = validateName(nombre);
  if (!nameVal.valid) {
    document.getElementById('eu-nombre-error').textContent = nameVal.error;
    valid = false;
  }
  
  const emailVal = validateEmail(email);
  if (!emailVal.valid) {
    document.getElementById('eu-email-error').textContent = emailVal.error;
    valid = false;
  }
  
  // Validar password si se ingresa uno nuevo
  if (pass) {
    const passVal = validatePassword(pass);
    if (!passVal.valid) {
      document.getElementById('eu-pass-error').textContent = passVal.error;
      valid = false;
    }
  }
  
  if (!valid) return;
  
  try {
    showLoading('Guardando cambios...');
    
    const user = users[dni];
    user.nombre = sanitize(nombre);
    user.email = sanitize(email);
    user.paid = paid;
    
    // Actualizar contraseña si se ingresó
    if (pass) {
      user.passHash = await hashPassword(pass);
    }
    
    // Actualizar override de puntos
    const overrides = getFromStorage('insc_points_override', {});
    if (pointsVal !== '') {
      overrides[dni] = Number(pointsVal);
    } else {
      delete overrides[dni];
    }
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
    console.error('Error editando usuario:', error);
    showToast('Error al actualizar usuario', 'error');
  }
}

/**
 * Elimina usuario actual
 */
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
    true,
    'Eliminar Usuario'
  );
}

// ===== ADMIN: RESULTADOS =====

/**
 * Renderiza formulario de resultados
 */
function renderAdminResults() {
  const form = document.getElementById('results-form');
  const results = getFromStorage('insc_results', {});

  form.innerHTML = '';

  Object.values(MATCHES).flat().forEach((match, i) => {
    const res = results[i] || { home: '', away: '' };
    
    const card = document.createElement('div');
    card.className = 'result-card';
    
    card.innerHTML = `
      <div class="result-teams">
        <strong>${match.home} vs ${match.away}</strong>
        <span style="color:var(--text-light); font-size:12px; margin-left:auto;">${match.date}</span>
      </div>
      <div class="result-inputs">
        <input 
          type="number" 
          class="result-input" 
          min="0" 
          max="20"
          value="${res.home}"
          id="res-home-${i}"
          placeholder="0"
        >
        <div style="color:var(--text-light); font-weight:700;">–</div>
        <input 
          type="number" 
          class="result-input" 
          min="0" 
          max="20"
          value="${res.away}"
          id="res-away-${i}"
          placeholder="0"
        >
      </div>
    `;
    
    form.appendChild(card);
  });
}

/**
 * Guarda resultados con loader
 */
async function saveResultsWithLoader() {
  showLoading('Guardando resultados...');
  
  try {
    await new Promise(r => setTimeout(r, 500));
    
    const success = saveResults();
    
    hideLoading();
    
    if (success) {
      renderRanking();
      renderAdminScores();
    }
  } catch (error) {
    hideLoading();
    console.error('Error guardando resultados:', error);
    showToast('Error al guardar resultados', 'error');
  }
}

/**
 * Guarda resultados
 */
function saveResults() {
  try {
    const results = {};
    let errors = [];

    Object.values(MATCHES).flat().forEach((match, i) => {
      const homeVal = document.getElementById(`res-home-${i}`).value.trim();
      const awayVal = document.getElementById(`res-away-${i}`).value.trim();
      
      // Ambos vacíos es ok
      if (homeVal === '' && awayVal === '') {
        results[i] = { home: '', away: '' };
        return;
      }
      
      // Ambos deben estar llenos
      if ((homeVal === '') !== (awayVal === '')) {
        errors.push(`Partido ${i + 1}: Complete ambos marcadores`);
        return;
      }
      
      // Deben ser números
      if (!/^\d+$/.test(homeVal) || !/^\d+$/.test(awayVal)) {
        errors.push(`Partido ${i + 1}: Solo se aceptan números`);
        return;
      }
      
      const home = parseInt(homeVal);
      const away = parseInt(awayVal);
      
      // Rango razonable
      if (home > 20 || away > 20) {
        errors.push(`Partido ${i + 1}: Marcador poco realista`);
        return;
      }
      
      results[i] = { home, away };
    });
    
    if (errors.length > 0) {
      showToast('Errores: ' + errors.join(', '), 'error');
      return false;
    }
    
    saveToStorage('insc_results', results);
    
    logAudit('SAVE_RESULTS', {
      cantidad: Object.keys(results).filter(k => results[k].home !== '').length
    });
    
    showToast('✅ Resultados guardados correctamente', 'success');
    
    return true;
  } catch (error) {
    console.error('Error validando resultados:', error);
    showToast('Error al guardar resultados', 'error');
    return false;
  }
}

// ===== ADMIN: PUNTAJES =====

/**
 * Renderiza tabla de puntajes
 */
function renderAdminScores() {
  const tbody = document.getElementById('admin-scores-tbody');
  const results = getFromStorage('insc_results', {});
  const overrides = getFromStorage('insc_points_override', {});
  
  tbody.innerHTML = '';
  
  // Calcular puntajes
  const participants = [];
  
  Object.values(users).forEach(u => {
    if (!u.paid || u.isAdmin) return;
    
    const preds = u.predictions || {};
    let acertados = 0;
    
    Object.keys(results).forEach(i => {
      const r = results[i];
      const p = preds[i];
      if (p && String(p.home) === String(r.home) && String(p.away) === String(r.away)) {
        acertados++;
      }
    });
    
    participants.push({
      dni: u.dni,
      nombre: u.nombre,
      aciertos: acertados,
      puntosAuto: acertados * 5,
      puntosOverride: overrides[u.dni]
    });
  });
  
  // Ordenar por nombre
  participants.sort((a, b) => a.nombre.localeCompare(b.nombre));
  
  participants.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(p.nombre)}</td>
      <td>${p.dni}</td>
      <td>${p.aciertos}</td>
      <td>${p.puntosAuto}</td>
      <td>
        <input 
          class="override-input" 
          type="number" 
          value="${p.puntosOverride !== undefined ? p.puntosOverride : ''}"
          placeholder="auto"
          id="ov-${p.dni}"
          style="width:100%; padding:6px; border:1px solid var(--gris-medio); border-radius:4px;"
        >
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Guarda overrides de puntajes
 */
function saveAdminScores() {
  try {
    const overrides = getFromStorage('insc_points_override', {});
    let cambios = 0;
    
    Object.values(users).forEach(u => {
      if (!u.paid || u.isAdmin) return;
      
      const input = document.getElementById(`ov-${u.dni}`);
      if (input) {
        const value = input.value.trim();
        
        if (value !== '') {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            if (overrides[u.dni] !== numValue) {
              cambios++;
              overrides[u.dni] = numValue;
            }
          }
        } else {
          if (overrides[u.dni] !== undefined) {
            cambios++;
            delete overrides[u.dni];
          }
        }
      }
    });
    
    saveToStorage('insc_points_override', overrides);
    
    logAudit('UPDATE_SCORES', { cambios });
    
    renderRanking();
    showToast(`✅ Puntajes guardados (${cambios} cambios)`, 'success');
  } catch (error) {
    console.error('Error guardando puntajes:', error);
    showToast('Error al guardar puntajes', 'error');
  }
}

// ===== ADMIN: AUDITORÍA =====

/**
 * Renderiza logs de auditoría
 */
function renderAdminLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '';
  
  if (auditLog.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:var(--text-light); padding:20px;">No hay registros aún</p>';
    return;
  }
  
  // Mostrar últimos 100 en orden inverso
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
        <span class="log-usuario">${escapeHTML(log.usuario)}</span> 
        realizó 
        <span class="log-action">${log.accion}</span>
      </div>
      ${details ? `<div style="color:var(--text-light); font-size:12px; margin-top:4px;">${escapeHTML(details)}</div>` : ''}
    `;
    
    container.appendChild(entry);
  });
}

/**
 * Limpia logs de auditoría
 */
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

/**
 * Descarga logs como CSV
 */
function downloadAuditLogs() {
  const lines = ['timestamp,usuario,accion,detalles'];
  
  auditLog.forEach(log => {
    const details = JSON.stringify(log.detalles);
    lines.push(`"${log.timestamp}","${log.usuario}","${log.accion}","${details}"`);
  });
  
  downloadCSV('audit_logs.csv', lines);
  showToast('📥 Descargando logs...', 'info');
}

// ===== INICIALIZACIÓN =====

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

console.log('✅ App.js Parte 2 cargado');
