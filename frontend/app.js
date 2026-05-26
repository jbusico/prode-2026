// ===== APP.JS - PARTE 1 =====
// Autenticación, inicialización y funciones principales

// ===== INICIALIZACIÓN =====

async function initApp() {
  console.log('🚀 Inicializando aplicación...');
  try {
    auditLog = getFromStorage('insc_audit_log', []);

    const token = localStorage.getItem('prode_token');
    const savedUser = getFromStorage('prode_user');

    if (token && savedUser) {
      currentUser = savedUser.dni;
      users[savedUser.dni] = savedUser;
      updateUIAfterLogin();
      showPage('page-home');
      logAudit('LOGIN_RESTORED', { método: 'sesión guardada' });

      // Refrescar datos del usuario en background
      apiCall('GET', `/api/users/${savedUser.dni}`)
        .then(u => { users[u.dni] = u; saveToStorage('prode_user', u); })
        .catch(() => {});
    } else {
      showPage('page-login');
    }
    console.log('✅ Aplicación inicializada');
  } catch (error) {
    console.error('❌ Error inicializando:', error);
    showToast('Error al inicializar la aplicación', 'error');
  }
}

// ===== AUTENTICACIÓN =====

async function handleLogin(event) {
  event.preventDefault();

  const dniInput = document.getElementById('login-dni').value.trim();
  const passInput = document.getElementById('login-pass').value;

  document.getElementById('dni-error').textContent = '';
  document.getElementById('pass-error').textContent = '';

  const dniVal = validateDNI(dniInput);
  if (!dniVal.valid) {
    document.getElementById('dni-error').textContent = dniVal.error;
    return;
  }
  if (!passInput) {
    document.getElementById('pass-error').textContent = 'La contraseña es requerida';
    return;
  }

  if (isLoginBlocked(dniInput)) {
    const remaining = getRemainingBlockTime(dniInput);
    showToast(`Demasiados intentos. Bloqueado ${Math.ceil(remaining / 60)} minutos.`, 'error');
    return;
  }

  showLoading('Verificando credenciales...');
  try {
    const { token, user } = await apiCall('POST', '/api/auth/login', {
      dni: dniInput,
      password: passInput
    });

    localStorage.setItem('prode_token', token);

    const fullUser = await apiCall('GET', `/api/users/${user.dni}`);
    users[user.dni] = fullUser;
    saveToStorage('prode_user', fullUser);
    currentUser = user.dni;

    hideLoading();
    logAudit('LOGIN_SUCCESS', { dni: dniInput });
    clearLoginErrors(dniInput);

    document.getElementById('login-dni').value = '';
    document.getElementById('login-pass').value = '';

    updateUIAfterLogin();
    showPage('page-home');
    showToast(`¡Bienvenido, ${fullUser.nombre}!`, 'success');
  } catch (error) {
    hideLoading();
    logAudit('LOGIN_FAILED', { dni: dniInput, razón: error.message });
    recordLoginAttempt(dniInput);
    document.getElementById('pass-error').textContent = 'DNI o contraseña incorrectos';
    showToast('DNI o contraseña incorrectos', 'error');
    updateAttemptWarning(dniInput);
  }
}

function recordLoginAttempt(dni) {
  const now = Date.now();
  if (!loginAttempts[dni]) loginAttempts[dni] = { count: 0, timestamp: now };
  loginAttempts[dni].count++;
  loginAttempts[dni].timestamp = now;
}

function isLoginBlocked(dni) {
  if (!loginAttempts[dni]) return false;
  const now = Date.now();
  const { count, timestamp } = loginAttempts[dni];
  if (now - timestamp > BLOCK_DURATION) { delete loginAttempts[dni]; return false; }
  return count >= MAX_LOGIN_ATTEMPTS;
}

function getRemainingBlockTime(dni) {
  if (!loginAttempts[dni]) return 0;
  return Math.max(0, Math.ceil((BLOCK_DURATION - (Date.now() - loginAttempts[dni].timestamp)) / 1000));
}

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

function clearLoginErrors(dni) {
  delete loginAttempts[dni];
  document.getElementById('login-attempts-warning').classList.add('hidden');
}

function doLogout() {
  showConfirm(
    '¿Estás seguro de que quieres cerrar sesión?',
    () => {
      logAudit('LOGOUT', { dni: currentUser });
      currentUser = null;
      users = {};
      localStorage.removeItem('prode_token');
      clearStorage('prode_user');
      showPage('page-login');
      showToast('Sesión cerrada', 'info');
      document.getElementById('login-dni').value = '';
      document.getElementById('login-pass').value = '';
    },
    false,
    'Cerrar Sesión'
  );
}

// ===== UI UPDATE =====

async function updateUIAfterLogin() {
  const user = users[currentUser];
  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('nav-user-text').textContent = user.nombre;
  document.getElementById('nav-admin').style.display = user.isAdmin ? 'block' : 'none';

  renderProdeUI();
  await renderPrizesUI();
  if (user.isAdmin) renderAdminUI();
}

// ===== REGISTER =====

function showRegisterModal(event) {
  event.preventDefault();
  showToast('El registro está deshabilitado. Contactá al administrador.', 'info');
}

// ===== PRODE PAGE =====

function renderProdeUI() {
  const container = document.getElementById('matches-container');
  const user = users[currentUser];
  const predictions = user.predictions || {};

  container.innerHTML = '';
  let matchIndex = 0;

  Object.keys(MATCHES).forEach(groupName => {
    const matches = MATCHES[groupName];

    const groupHeader = document.createElement('div');
    groupHeader.style.cssText = `
      margin-top: 32px; margin-bottom: 16px;
      padding: 0 16px; border-left: 4px solid var(--rojo);
    `;
    groupHeader.innerHTML = `
      <h2 style="font-size: 20px; color: var(--azul); font-weight: 700; margin: 0;">
        ${groupName.toUpperCase()}
      </h2>
    `;
    container.appendChild(groupHeader);

    matches.forEach(match => {
      const pred = predictions[matchIndex] || { home: '', away: '' };
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
          <input type="number" class="match-input" min="0" max="20"
            value="${pred.home}" id="pred-home-${matchIndex}" placeholder="0">
          <div class="match-dash">–</div>
          <input type="number" class="match-input" min="0" max="20"
            value="${pred.away}" id="pred-away-${matchIndex}" placeholder="0">
        </div>
      `;
      container.appendChild(card);
      matchIndex++;
    });
  });
}

async function saveProdeWithLoader() {
  showLoading('Guardando pronósticos...');
  try {
    await saveProde();
    hideLoading();
    updateStatusIndicator(true);
    setTimeout(() => updateStatusIndicator(false), 3000);
  } catch (error) {
    hideLoading();
    if (error.message !== 'Validation errors') {
      showToast('Error al guardar pronósticos', 'error');
    }
  }
}

async function saveProde() {
  const predictions = {};
  let errors = [];
  let matchIndex = 0;

  Object.keys(MATCHES).forEach(groupName => {
    MATCHES[groupName].forEach(() => {
      const homeVal = document.getElementById(`pred-home-${matchIndex}`).value.trim();
      const awayVal = document.getElementById(`pred-away-${matchIndex}`).value.trim();

      if (homeVal === '' && awayVal === '') {
        predictions[matchIndex] = { home: '', away: '' };
      } else if ((homeVal === '') !== (awayVal === '')) {
        errors.push(`Partido ${matchIndex + 1}: Complete ambos marcadores`);
      } else if (!/^\d+$/.test(homeVal) || !/^\d+$/.test(awayVal)) {
        errors.push(`Partido ${matchIndex + 1}: Los marcadores deben ser números`);
      } else {
        const home = parseInt(homeVal);
        const away = parseInt(awayVal);
        if (home > 20 || away > 20) {
          errors.push(`Partido ${matchIndex + 1}: Marcador poco realista`);
        } else {
          predictions[matchIndex] = { home, away };
        }
      }
      matchIndex++;
    });
  });

  if (errors.length > 0) {
    showToast('Errores: ' + errors.join(', '), 'error');
    throw new Error('Validation errors');
  }

  await apiCall('PUT', `/api/users/${currentUser}/predictions`, { predictions });

  users[currentUser].predictions = predictions;
  users[currentUser].saved = true;
  saveToStorage('prode_user', users[currentUser]);

  logAudit('SAVE_PREDICTIONS', { cantidad_predicciones: Object.keys(predictions).length });
  showToast('✅ Pronósticos guardados correctamente', 'success');
}

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
    setTimeout(() => { if (indicator) indicator.style.display = 'flex'; }, 3000);
  }
}

// ===== PRIZES PAGE =====

async function renderPrizesUI() {
  await renderRanking();
  renderPrizes();
}

async function renderRanking() {
  try {
    const [rankingUsers, resultsData] = await Promise.all([
      apiCall('GET', '/api/predictions/ranking'),
      apiCall('GET', '/api/results')
    ]);

    const results = resultsData.results || {};
    const overrides = resultsData.overrides || {};

    rankingUsers.forEach(u => { users[u.dni] = u; });

    const rankings = rankingUsers
      .filter(u => !u.isAdmin)
      .map(u => {
        const preds = u.predictions || {};
        let acertados = 0;
        Object.keys(results).forEach(i => {
          const r = results[i];
          const p = preds[i];
          if (p && String(p.home) === String(r.home) && String(p.away) === String(r.away)) acertados++;
        });
        const puntosAuto = acertados * 5;
        const puntos = overrides[u.dni] !== undefined ? overrides[u.dni] : puntosAuto;
        return { dni: u.dni, nombre: u.nombre, aciertos: acertados, puntos, puntosAuto };
      })
      .sort((a, b) => b.puntos - a.puntos);

    const topThree = document.getElementById('top-three');
    topThree.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    const classNames = ['rank-1st', 'rank-2nd', 'rank-3rd'];
    for (let i = 0; i < 3 && rankings[i]; i++) {
      const card = document.createElement('div');
      card.className = `rank-card ${classNames[i]}`;
      card.innerHTML = `
        <div class="rank-medal">${medals[i]}</div>
        <div class="rank-name">${escapeHTML(rankings[i].nombre)}</div>
        <div class="rank-points">${rankings[i].puntos} pts</div>
      `;
      topThree.appendChild(card);
    }

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
  } catch (error) {
    console.error('Error cargando ranking:', error);
  }
}

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

async function openViewPredictions(dni) {
  try {
    if (!users[dni] || !users[dni].predictions) {
      users[dni] = await apiCall('GET', `/api/users/${dni}`);
    }
    const u = users[dni];
    const preds = u.predictions || {};
    const resultsData = await apiCall('GET', '/api/results');
    const results = resultsData.results || {};

    const allMatches = Object.values(MATCHES).flat();
    let hits = 0;
    allMatches.forEach((_, i) => {
      const p = preds[i]; const r = results[i];
      if (p && r && String(p.home) === String(r.home) && String(p.away) === String(r.away)) hits++;
    });

    let rows = '';
    allMatches.forEach((m, i) => {
      const p = preds[i]; const r = results[i];
      const hasPred = p && (p.home !== '' || p.away !== '');
      const predStr = hasPred ? `${p.home} – ${p.away}` : '—';
      const resStr = r && r.home !== '' ? `${r.home} – ${r.away}` : '—';
      let status = '⏳';
      if (r && r.home !== '' && hasPred) {
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

    document.getElementById('modal-view-predictions-content').innerHTML = `
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
    openModal('modal-view-predictions');
  } catch (error) {
    console.error('Error cargando predicciones:', error);
    showToast('Error al cargar predicciones', 'error');
  }
}

console.log('✅ App.js Parte 1 cargado');
