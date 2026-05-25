// ===== APP.JS - PARTE 1 =====
// Autenticación, inicialización y funciones principales

// ===== INICIALIZACIÓN =====

async function initApp() {
  console.log('🚀 Inicializando aplicación...');
  
  try {
    // Cargar datos del storage
    users = getFromStorage('insc_users', {});
    auditLog = getFromStorage('insc_audit_log', []);
    
    // Si no hay usuarios, crear los de demostración
    if (Object.keys(users).length === 0) {
      console.log('📝 Creando usuarios de demostración...');
      await createDemoUsers();
    }
    
    // Restaurar sesión si existe
    const savedUser = getFromStorage('insc_current');
    if (savedUser && users[savedUser]) {
      currentUser = savedUser;
      updateUIAfterLogin();
      showPage('page-home');
      logAudit('LOGIN_RESTORED', { método: 'sesión guardada' });
    } else {
      showPage('page-login');
    }
    
    console.log('✅ Aplicación inicializada');
  } catch (error) {
    console.error('❌ Error inicializando:', error);
    showToast('Error al inicializar la aplicación', 'error');
  }
}

/**
 * Crea usuarios de demostración
 */
async function createDemoUsers() {
  for (const [dni, userData] of Object.entries(DEMO_USERS)) {
    const password = DEMO_PASSWORDS[dni];
    
    // Para la demostración, guardar la contraseña en texto plano
    // En producción, usar hash
    users[dni] = {
      ...userData,
      pass: password,  // Contraseña en texto plano para demo
      passHash: null   // Sin hash para usuario inicial
    };
  }
  
  saveToStorage('insc_users', users);
}

// ===== AUTENTICACIÓN =====

/**
 * Maneja el envío del formulario de login
 */
async function handleLogin(event) {
  event.preventDefault();
  
  const dniInput = document.getElementById('login-dni').value.trim();
  const passInput = document.getElementById('login-pass').value;
  
  // Limpiar errores previos
  document.getElementById('dni-error').textContent = '';
  document.getElementById('pass-error').textContent = '';
  
  // Validar DNI
  const dniVal = validateDNI(dniInput);
  if (!dniVal.valid) {
    document.getElementById('dni-error').textContent = dniVal.error;
    return;
  }
  
  // Validar contraseña
  if (!passInput) {
    document.getElementById('pass-error').textContent = 'La contraseña es requerida';
    return;
  }
  
  // Verificar rate limiting
  if (isLoginBlocked(dniInput)) {
    const remaining = getRemainingBlockTime(dniInput);
    const minutes = Math.ceil(remaining / 60);
    showToast(
      `Demasiados intentos. Bloqueado ${minutes} minutos.`,
      'error'
    );
    return;
  }
  
  // Intentar login
  showLoading('Verificando credenciales...');
  
  try {
    // Simular delay de red
    await new Promise(r => setTimeout(r, 500));
    
    const success = await attemptLogin(dniInput, passInput);
    
    hideLoading();
    
    if (success) {
      logAudit('LOGIN_SUCCESS', { dni: dniInput });
      clearLoginErrors(dniInput);
      
      // Limpiar formulario
      document.getElementById('login-dni').value = '';
      document.getElementById('login-pass').value = '';
      
      // Mostrar página de inicio
      updateUIAfterLogin();
      showPage('page-home');
      showToast(
        `¡Bienvenido, ${users[dniInput].nombre}!`,
        'success'
      );
    } else {
      logAudit('LOGIN_FAILED', { dni: dniInput, razón: 'credenciales inválidas' });
      recordLoginAttempt(dniInput);
      
      document.getElementById('pass-error').textContent =
        'DNI o contraseña incorrectos';
      
      showToast('DNI o contraseña incorrectos', 'error');
      
      // Mostrar advertencia de intentos
      updateAttemptWarning(dniInput);
    }
  } catch (error) {
    hideLoading();
    console.error('Error en login:', error);
    showToast('Error al iniciar sesión', 'error');
  }
}

/**
 * Intenta hacer login
 */
async function attemptLogin(dni, password) {
  if (!users[dni]) {
    return false;
  }
  
  const user = users[dni];
  
  // Verificar contraseña
  let isValid = false;
  
  // Primero intentar comparar con contraseña en texto plano (usuarios demo/nuevos)
  if (user.pass && user.pass === password) {
    isValid = true;
  } 
  // Si no hay contraseña en texto plano, intentar con hash
  else if (user.passHash) {
    isValid = await comparePassword(password, user.passHash);
  }
  
  if (!isValid) {
    return false;
  }
  
  // Login exitoso
  currentUser = dni;
  saveToStorage('insc_current', dni);
  
  return true;
}

/**
 * Registra un intento fallido de login
 */
function recordLoginAttempt(dni) {
  const now = Date.now();
  
  if (!loginAttempts[dni]) {
    loginAttempts[dni] = { count: 0, timestamp: now };
  }
  
  loginAttempts[dni].count++;
  loginAttempts[dni].timestamp = now;
}

/**
 * Verifica si el login está bloqueado
 */
function isLoginBlocked(dni) {
  if (!loginAttempts[dni]) return false;
  
  const now = Date.now();
  const { count, timestamp } = loginAttempts[dni];
  
  // Si pasó el tiempo de bloqueo, resetear
  if (now - timestamp > BLOCK_DURATION) {
    delete loginAttempts[dni];
    return false;
  }
  
  // Si llegó al máximo de intentos, está bloqueado
  return count >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Obtiene el tiempo restante de bloqueo en segundos
 */
function getRemainingBlockTime(dni) {
  if (!loginAttempts[dni]) return 0;
  
  const now = Date.now();
  const { timestamp } = loginAttempts[dni];
  const elapsed = now - timestamp;
  const remaining = BLOCK_DURATION - elapsed;
  
  return Math.max(0, Math.ceil(remaining / 1000));
}

/**
 * Actualiza la advertencia de intentos
 */
function updateAttemptWarning(dni) {
  const warningBox = document.getElementById('login-attempts-warning');
  const remaining = MAX_LOGIN_ATTEMPTS - (loginAttempts[dni]?.count || 0);
  
  if (remaining <= 0) {
    warningBox.classList.remove('hidden');
    document.getElementById('attempts-remaining').textContent = '0';
  } else if (remaining < MAX_LOGIN_ATTEMPTS) {
    warningBox.classList.remove('hidden');
    document.getElementById('attempts-remaining').textContent = remaining;
  }
}

/**
 * Limpia los errores de login
 */
function clearLoginErrors(dni) {
  delete loginAttempts[dni];
  document.getElementById('login-attempts-warning').classList.add('hidden');
}

/**
 * Logout
 */
function doLogout() {
  showConfirm(
    '¿Estás seguro de que quieres cerrar sesión?',
    () => {
      logAudit('LOGOUT', { dni: currentUser });
      currentUser = null;
      clearStorage('insc_current');
      showPage('page-login');
      showToast('Sesión cerrada', 'info');
      
      // Limpiar formulario
      document.getElementById('login-dni').value = '';
      document.getElementById('login-pass').value = '';
    },
    false,
    'Cerrar Sesión'
  );
}

// ===== UI UPDATE =====

/**
 * Actualiza la UI después del login
 */
function updateUIAfterLogin() {
  const user = users[currentUser];
  
  // Mostrar navbar
  document.getElementById('navbar').style.display = 'flex';
  
  // Actualizar nombre de usuario en navbar
  document.getElementById('nav-user-text').textContent = user.nombre;
  
  // Mostrar botón admin si corresponde
  if (user.isAdmin) {
    document.getElementById('nav-admin').style.display = 'block';
  } else {
    document.getElementById('nav-admin').style.display = 'none';
  }
  
  // Renderizar contenido de las páginas
  renderProdeUI();
  renderPrizesUI();
  if (user.isAdmin) {
    renderAdminUI();
  }
}

// ===== REGISTER =====

function showRegisterModal(event) {
  event.preventDefault();
  
  // Por ahora, mostrar un toast
  showToast(
    'El registro está deshabilitado. Usa las credenciales de demostración.',
    'info'
  );
  
  // En futuro, aquí iría un modal de registro
  console.log('TODO: Implementar registro de usuarios');
}

// ===== PRODE PAGE =====

/**
 * Renderiza la UI del PRODE
 */
function renderProdeUI() {
  const container = document.getElementById('matches-container');
  const user = users[currentUser];
  const predictions = user.predictions || {};
  
  container.innerHTML = '';
  
  MATCHES.forEach((match, index) => {
    const pred = predictions[index] || { home: '', away: '' };
    
    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
      <div class="match-date">${match.date}</div>
      <div class="match-teams">
        <div class="match-team">${match.home}</div>
        <div class="match-vs">vs</div>
        <div class="match-team">${match.away}</div>
      </div>
      <div class="match-inputs">
        <input 
          type="number" 
          class="match-input" 
          min="0" 
          max="20"
          value="${pred.home}"
          id="pred-home-${index}"
          placeholder="0"
        >
        <div class="match-dash">–</div>
        <input 
          type="number" 
          class="match-input" 
          min="0" 
          max="20"
          value="${pred.away}"
          id="pred-away-${index}"
          placeholder="0"
        >
      </div>
    `;
    
    container.appendChild(card);
  });
}

/**
 * Guarda pronósticos con loader
 */
async function saveProdeWithLoader() {
  showLoading('Guardando pronósticos...');
  
  try {
    await new Promise(r => setTimeout(r, 500));
    
    const success = saveProde();
    
    hideLoading();
    
    if (success) {
      updateStatusIndicator(true);
      setTimeout(() => updateStatusIndicator(false), 3000);
    }
  } catch (error) {
    hideLoading();
    console.error('Error guardando pronósticos:', error);
    showToast('Error al guardar pronósticos', 'error');
  }
}

/**
 * Guarda los pronósticos
 */
function saveProde() {
  try {
    const predictions = {};
    let errors = [];
    
    MATCHES.forEach((match, i) => {
      const homeVal = document.getElementById(`pred-home-${i}`).value.trim();
      const awayVal = document.getElementById(`pred-away-${i}`).value.trim();
      
      // Ambos vacíos es ok
      if (homeVal === '' && awayVal === '') {
        predictions[i] = { home: '', away: '' };
        return;
      }
      
      // Ambos deben estar llenos
      if ((homeVal === '') !== (awayVal === '')) {
        errors.push(`Partido ${i + 1}: Complete ambos marcadores`);
        return;
      }
      
      // Deben ser números
      if (!/^\d+$/.test(homeVal) || !/^\d+$/.test(awayVal)) {
        errors.push(`Partido ${i + 1}: Los marcadores deben ser números`);
        return;
      }
      
      const home = parseInt(homeVal);
      const away = parseInt(awayVal);
      
      // Rango razonable
      if (home > 20 || away > 20) {
        errors.push(`Partido ${i + 1}: Marcador poco realista`);
        return;
      }
      
      predictions[i] = { home, away };
    });
    
    if (errors.length > 0) {
      showToast('Errores: ' + errors.join(', '), 'error');
      return false;
    }
    
    users[currentUser].predictions = predictions;
    users[currentUser].saved = true;
    
    saveToStorage('insc_users', users);
    
    logAudit('SAVE_PREDICTIONS', {
      cantidad_predicciones: Object.keys(predictions).length
    });
    
    showToast('✅ Pronósticos guardados correctamente', 'success');
    
    return true;
  } catch (error) {
    console.error('Error validando pronósticos:', error);
    showToast('Error al guardar pronósticos', 'error');
    return false;
  }
}

/**
 * Actualiza el indicador de estado
 */
function updateStatusIndicator(isSaving) {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  
  if (isSaving) {
    indicator.style.display = 'flex';
    statusText.textContent = 'Guardando...';
    indicator.style.color = 'var(--warning)';
  } else {
    indicator.style.color = 'var(--success)';
    statusText.textContent = 'Cambios guardados';
    
    setTimeout(() => {
      if (indicator) {
        indicator.style.display = 'flex';
      }
    }, 3000);
  }
}

// ===== PRIZES PAGE =====

/**
 * Renderiza la UI de premios
 */
function renderPrizesUI() {
  renderRanking();
  renderPrizes();
}

/**
 * Renderiza el ranking
 */
function renderRanking() {
  const results = getFromStorage('insc_results', {});
  const overrides = getFromStorage('insc_points_override', {});
  
  // Calcular puntajes
  const rankings = [];
  
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
    
    const puntosAuto = acertados * 5;
    const puntosManual = overrides[u.dni];
    const puntos = puntosManual !== undefined ? puntosManual : puntosAuto;
    
    rankings.push({
      dni: u.dni,
      nombre: u.nombre,
      aciertos: acertados,
      puntos: puntos,
      puntosAuto: puntosAuto
    });
  });
  
  // Ordenar por puntos
  rankings.sort((a, b) => b.puntos - a.puntos);
  
  // Top 3
  const topThree = document.getElementById('top-three');
  topThree.innerHTML = '';
  
  const medals = ['🥇', '🥈', '🥉'];
  const classNames = ['rank-1st', 'rank-2nd', 'rank-3rd'];
  
  for (let i = 0; i < 3; i++) {
    if (!rankings[i]) break;
    
    const rank = rankings[i];
    const card = document.createElement('div');
    card.className = `rank-card ${classNames[i]}`;
    card.innerHTML = `
      <div class="rank-medal">${medals[i]}</div>
      <div class="rank-name">${escapeHTML(rank.nombre)}</div>
      <div class="rank-points">${rank.puntos} pts</div>
    `;
    
    topThree.appendChild(card);
  }
  
  // Tabla completa
  const tbody = document.getElementById('scores-tbody');
  tbody.innerHTML = '';
  
  rankings.forEach((rank, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHTML(rank.nombre)}</td>
      <td>${rank.aciertos}</td>
      <td>${rank.puntos}</td>
      <td>
        <button class="btn-secondary" onclick="openViewPredictions('${rank.dni}')">
          Ver pronósticos
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Renderiza los premios
 */
function renderPrizes() {
  const grid = document.getElementById('prizes-grid');
  grid.innerHTML = '';
  
  [...PRIZES.prode, ...PRIZES.rifa].forEach(prize => {
    const card = document.createElement('div');
    card.className = 'prize-card';
    
    card.innerHTML = `
      <img src="${prize.image}" alt="${prize.name}" class="prize-image" onerror="this.style.display='none'">
      <div class="prize-info">
        <div class="prize-category">${prize.position === '1' ? '1er Lugar' : prize.position === '2' ? '2do Lugar' : '3er Lugar'}</div>
        <div class="prize-title">${escapeHTML(prize.name)}</div>
      </div>
    `;
    
    grid.appendChild(card);
  });
}

/**
 * Ver predicciones de un usuario
 */
function openViewPredictions(dni) {
  const u = users[dni];
  if (!u) return;
  
  const preds = u.predictions || {};
  const results = getFromStorage('insc_results', {});
  
  let hits = 0;
  MATCHES.forEach((_, i) => {
    const p = preds[i];
    const r = results[i];
    if (p && r && String(p.home) === String(r.home) && String(p.away) === String(r.away)) {
      hits++;
    }
  });
  
  let rows = '';
  MATCHES.forEach((m, i) => {
    const p = preds[i];
    const r = results[i];
    const hasPred = p && (p.home !== '' || p.away !== '');
    const predStr = hasPred ? `${p.home} – ${p.away}` : '—';
    const resStr = r ? `${r.home} – ${r.away}` : '—';
    
    let status = '⏳';
    if (r && hasPred) {
      status = String(p.home) === String(r.home) && String(p.away) === String(r.away) ? '✅' : '❌';
    }
    
    rows += `
      <tr>
        <td>${m.home} vs ${m.away}</td>
        <td>${m.date}</td>
        <td style="text-align:center;">${predStr}</td>
        <td style="text-align:center;">${resStr}</td>
        <td style="text-align:center;">${status}</td>
      </tr>
    `;
  });
  
  const content = `
    <table style="width:100%; border-collapse:collapse; font-size:13px;">
      <thead>
        <tr style="background:var(--azul); color:white;">
          <th style="padding:8px; text-align:left;">Partido</th>
          <th style="padding:8px; text-align:left;">Fecha</th>
          <th style="padding:8px; text-align:center;">Pronóstico</th>
          <th style="padding:8px; text-align:center;">Real</th>
          <th style="padding:8px; text-align:center;">Estado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:12px; color:var(--text-light); font-size:12px;">
      ${u.saved ? '✅ Guardado' : '❌ No guardado'} · ${hits} aciertos · ${hits * 5} pts automáticos
    </p>
  `;
  
  document.getElementById('modal-view-predictions-content').innerHTML = content;
  openModal('modal-view-predictions');
}

console.log('✅ App.js Parte 1 cargado');
