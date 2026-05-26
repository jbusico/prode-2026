// ===== APP.JS - PARTE 1 =====
// Autenticación, inicialización y funciones principales

// ===== INICIALIZACIÓN =====

async function initApp() {
  console.log('🚀 Inicializando aplicación...');

  try {
    users    = getFromStorage('insc_users', {});
    auditLog = getFromStorage('insc_audit_log', []);

    if (Object.keys(users).length === 0) {
      console.log('📝 Creando usuarios de demostración...');
      await createDemoUsers();
    }

    // Cargar partidos desde la API (con fallback a caché local)
    await loadMatchesFromAPI();

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

async function loadMatchesFromAPI() {
  try {
    const res = await fetch('/api/matches');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    MATCHES = data;
    if (MATCHES.length > 0) saveToStorage('insc_matches_cache', MATCHES);
    console.log(`📋 ${MATCHES.length} partidos cargados desde API`);
  } catch (err) {
    console.warn('⚠️ API no disponible, usando caché:', err.message);
    MATCHES = getFromStorage('insc_matches_cache', []);
  }
}

async function createDemoUsers() {
  users['11222333'] = {
    dni: '11222333',
    nombre: 'Administrador',
    email: 'admin@prode.local',
    pass: '11222333',
    passHash: null,
    paid: false,
    saved: false,
    predictions: {},
    rifas: 0,
    isAdmin: true,
    createdAt: new Date().toISOString()
  };
  saveToStorage('insc_users', users);
}

// ===== AUTENTICACIÓN =====

async function handleLogin(event) {
  event.preventDefault();

  const dniInput  = document.getElementById('login-dni').value.trim();
  const passInput = document.getElementById('login-pass').value;

  document.getElementById('dni-error').textContent  = '';
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
    const mins = Math.ceil(getRemainingBlockTime(dniInput) / 60);
    showToast(`Demasiados intentos. Bloqueado ${mins} minutos.`, 'error');
    return;
  }

  showLoading('Verificando credenciales...');

  try {
    await new Promise(r => setTimeout(r, 500));
    const success = await attemptLogin(dniInput, passInput);
    hideLoading();

    if (success) {
      logAudit('LOGIN_SUCCESS', { dni: dniInput });
      clearLoginErrors(dniInput);
      document.getElementById('login-dni').value  = '';
      document.getElementById('login-pass').value = '';
      updateUIAfterLogin();
      showPage('page-home');
      showToast(`¡Bienvenido, ${users[dniInput].nombre}!`, 'success');
    } else {
      logAudit('LOGIN_FAILED', { dni: dniInput, razón: 'credenciales inválidas' });
      recordLoginAttempt(dniInput);
      document.getElementById('pass-error').textContent = 'DNI o contraseña incorrectos';
      showToast('DNI o contraseña incorrectos', 'error');
      updateAttemptWarning(dniInput);
    }
  } catch (error) {
    hideLoading();
    console.error('Error en login:', error);
    showToast('Error al iniciar sesión', 'error');
  }
}

async function attemptLogin(dni, password) {
  if (!users[dni]) return false;

  const user = users[dni];
  let isValid = false;

  if (user.pass && user.pass === password) {
    isValid = true;
  } else if (user.passHash) {
    isValid = await comparePassword(password, user.passHash);
  }

  if (!isValid) return false;

  currentUser = dni;
  saveToStorage('insc_current', dni);
  return true;
}

function recordLoginAttempt(dni) {
  const now = Date.now();
  if (!loginAttempts[dni]) loginAttempts[dni] = { count: 0, timestamp: now };
  loginAttempts[dni].count++;
  loginAttempts[dni].timestamp = now;
}

function isLoginBlocked(dni) {
  if (!loginAttempts[dni]) return false;
  const { count, timestamp } = loginAttempts[dni];
  if (Date.now() - timestamp > BLOCK_DURATION) { delete loginAttempts[dni]; return false; }
  return count >= MAX_LOGIN_ATTEMPTS;
}

function getRemainingBlockTime(dni) {
  if (!loginAttempts[dni]) return 0;
  return Math.max(0, Math.ceil((BLOCK_DURATION - (Date.now() - loginAttempts[dni].timestamp)) / 1000));
}

function updateAttemptWarning(dni) {
  const box       = document.getElementById('login-attempts-warning');
  const remaining = MAX_LOGIN_ATTEMPTS - (loginAttempts[dni]?.count || 0);
  if (remaining <= 0) {
    box.classList.remove('hidden');
    document.getElementById('attempts-remaining').textContent = '0';
  } else if (remaining < MAX_LOGIN_ATTEMPTS) {
    box.classList.remove('hidden');
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
      clearStorage('insc_current');
      showPage('page-login');
      showToast('Sesión cerrada', 'info');
      document.getElementById('login-dni').value  = '';
      document.getElementById('login-pass').value = '';
    },
    false, 'Cerrar Sesión'
  );
}

function showRegisterModal(event) {
  event.preventDefault();
  showToast('El registro está deshabilitado. Usá las credenciales de acceso.', 'info');
}

// ===== UI UPDATE =====

function updateUIAfterLogin() {
  const user = users[currentUser];

  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('nav-user-text').textContent = user.nombre;
  document.getElementById('nav-admin').style.display = user.isAdmin ? 'block' : 'none';

  renderProdeUI();
  renderPrizesUI();
  if (user.isAdmin) renderAdminUI();
}

// ===== PRODE PAGE =====

function renderProdeUI() {
  const container = document.getElementById('matches-container');
  const preds     = (users[currentUser] && users[currentUser].predictions) || {};

  container.innerHTML = '';

  if (!MATCHES || MATCHES.length === 0) {
    container.innerHTML = `
      <div class="empty-matches">
        <p>No hay partidos cargados aún.</p>
        <p style="font-size:13px; color:var(--text-light); margin-top:8px;">
          El administrador debe sincronizar los partidos desde el Panel de Administración.
        </p>
      </div>`;
    return;
  }

  // Agrupar por fase
  const byPhase = {};
  MATCHES.forEach(m => {
    if (!byPhase[m.phase]) byPhase[m.phase] = [];
    byPhase[m.phase].push(m);
  });

  PHASE_ORDER.forEach(phase => {
    const phaseMatches = byPhase[phase];
    if (!phaseMatches || phaseMatches.length === 0) return;

    const phaseSection = document.createElement('div');
    phaseSection.className = 'phase-section';

    const phaseHeader = document.createElement('div');
    phaseHeader.className = 'phase-header';
    phaseHeader.innerHTML = `<h2 class="phase-title">${phase.toUpperCase()}</h2>`;
    phaseSection.appendChild(phaseHeader);

    if (phase === 'Fase de Grupos') {
      const byGroup = {};
      phaseMatches.forEach(m => {
        const g = m.group || '?';
        if (!byGroup[g]) byGroup[g] = [];
        byGroup[g].push(m);
      });

      GROUP_ORDER.forEach(gl => {
        const gMatches = byGroup[gl];
        if (!gMatches || gMatches.length === 0) return;

        const groupSection = document.createElement('div');
        groupSection.className = 'group-section';

        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.innerHTML = `<h3 class="group-title">Grupo ${gl}</h3>`;
        groupSection.appendChild(groupHeader);

        gMatches
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .forEach(m => {
            groupSection.appendChild(createMatchCard(m, preds[m._id] || { home: '', away: '' }));
          });

        phaseSection.appendChild(groupSection);
      });

      // Matches sin grupo asignado
      if (byGroup['?']?.length) {
        const noGroup = document.createElement('div');
        noGroup.className = 'group-section';
        noGroup.innerHTML = '<div class="group-header"><h3 class="group-title">Sin grupo asignado</h3></div>';
        byGroup['?']
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .forEach(m => {
            noGroup.appendChild(createMatchCard(m, preds[m._id] || { home: '', away: '' }));
          });
        phaseSection.appendChild(noGroup);
      }
    } else {
      phaseMatches
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(m => {
          phaseSection.appendChild(createMatchCard(m, preds[m._id] || { home: '', away: '' }));
        });
    }

    container.appendChild(phaseSection);
  });
}

function createMatchCard(match, pred) {
  const id         = match._id;
  const hasResult  = match.homeScore !== null && match.awayScore !== null;
  const isFinished = match.status === 'finished';
  const card       = document.createElement('div');
  card.className   = 'match-card';

  card.innerHTML = `
    <div class="match-meta">
      <span class="match-date">${match.dateStr || ''}</span>
      ${match.city ? `<span class="match-venue">${escapeHTML(match.city)}</span>` : ''}
    </div>
    <div class="match-teams">
      <div class="match-team">${escapeHTML(match.homeTeam)}</div>
      <div class="match-vs${hasResult ? ' has-result' : ''}">${hasResult ? match.homeScore + ' – ' + match.awayScore : 'vs'}</div>
      <div class="match-team">${escapeHTML(match.awayTeam)}</div>
    </div>
    <div class="match-inputs">
      <input type="number" class="match-input" min="0" max="20"
        value="${pred.home}" id="pred-home-${id}" placeholder="0"
        ${isFinished ? 'disabled title="Partido finalizado"' : ''}>
      <div class="match-dash">–</div>
      <input type="number" class="match-input" min="0" max="20"
        value="${pred.away}" id="pred-away-${id}" placeholder="0"
        ${isFinished ? 'disabled title="Partido finalizado"' : ''}>
    </div>`;
  return card;
}

// ===== GUARDAR PRONÓSTICOS =====

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
    showToast('Error al guardar pronósticos', 'error');
  }
}

function saveProde() {
  try {
    const predictions = {};
    const errors      = [];

    for (const match of MATCHES) {
      const id     = match._id;
      const homeEl = document.getElementById(`pred-home-${id}`);
      const awayEl = document.getElementById(`pred-away-${id}`);
      if (!homeEl || !awayEl) continue;

      const homeVal = homeEl.value.trim();
      const awayVal = awayEl.value.trim();

      if (homeVal === '' && awayVal === '') {
        predictions[id] = { home: '', away: '' };
        continue;
      }

      if ((homeVal === '') !== (awayVal === '')) {
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: Complete ambos marcadores`);
        continue;
      }

      if (!/^\d+$/.test(homeVal) || !/^\d+$/.test(awayVal)) {
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: Solo se aceptan números`);
        continue;
      }

      const home = parseInt(homeVal);
      const away = parseInt(awayVal);

      if (home > 20 || away > 20) {
        errors.push(`${match.homeTeam} vs ${match.awayTeam}: Marcador poco realista`);
        continue;
      }

      predictions[id] = { home, away };
    }

    if (errors.length > 0) {
      showToast(errors.slice(0, 3).join(' | '), 'error');
      return false;
    }

    users[currentUser].predictions = predictions;
    users[currentUser].saved       = true;
    saveToStorage('insc_users', users);

    logAudit('SAVE_PREDICTIONS', { cantidad: Object.keys(predictions).length });
    showToast('✅ Pronósticos guardados correctamente', 'success');
    return true;
  } catch (error) {
    console.error('Error guardando pronósticos:', error);
    showToast('Error al guardar pronósticos', 'error');
    return false;
  }
}

function updateStatusIndicator(isSaving) {
  const indicator  = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  if (isSaving) {
    indicator.style.display = 'flex';
    statusText.textContent  = 'Guardando...';
    indicator.style.color   = 'var(--warning)';
  } else {
    indicator.style.color   = 'var(--success)';
    statusText.textContent  = 'Cambios guardados';
    setTimeout(() => { if (indicator) indicator.style.display = 'flex'; }, 3000);
  }
}

// ===== PRIZES PAGE =====

function renderPrizesUI() {
  renderRanking();
  renderPrizes();
}

function renderRanking() {
  const results   = getFromStorage('insc_results', {});
  const overrides = getFromStorage('insc_points_override', {});
  const rankings  = [];

  Object.values(users).forEach(u => {
    if (!u.paid || u.isAdmin) return;
    const preds   = u.predictions || {};
    let acertados = 0;
    let puntosAuto = 0;

    Object.keys(results).forEach(matchId => {
      const r   = results[matchId];
      const p   = preds[matchId];
      const pts = calcMatchPoints(p, r);
      if (pts > 0) acertados++;
      puntosAuto += pts;
    });
    const puntosManual = overrides[u.dni];
    const puntos       = puntosManual !== undefined ? puntosManual : puntosAuto;
    rankings.push({ dni: u.dni, nombre: u.nombre, aciertos: acertados, puntos, puntosAuto });
  });

  rankings.sort((a, b) => b.puntos - a.puntos);

  const topThree = document.getElementById('top-three');
  topThree.innerHTML = '';
  const medals  = ['🥇','🥈','🥉'];
  const classes = ['rank-1st','rank-2nd','rank-3rd'];
  for (let i = 0; i < 3; i++) {
    if (!rankings[i]) break;
    const card = document.createElement('div');
    card.className = `rank-card ${classes[i]}`;
    card.innerHTML = `
      <div class="rank-medal">${medals[i]}</div>
      <div class="rank-name">${escapeHTML(rankings[i].nombre)}</div>
      <div class="rank-points">${rankings[i].puntos} pts</div>`;
    topThree.appendChild(card);
  }

  const tbody = document.getElementById('scores-tbody');
  tbody.innerHTML = '';
  rankings.forEach((rank, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${escapeHTML(rank.nombre)}</td>
      <td>${rank.aciertos}</td>
      <td>${rank.puntos}</td>
      <td><button class="btn-secondary" onclick="openViewPredictions('${rank.dni}')">Ver pronósticos</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderPrizes() {
  const grid = document.getElementById('prizes-grid');
  grid.innerHTML = '';
  [...PRIZES.prode, ...PRIZES.rifa].forEach(prize => {
    const card  = document.createElement('div');
    card.className = 'prize-card';
    const label = prize.position === '1' ? '1er Lugar' : prize.position === '2' ? '2do Lugar' : '3er Lugar';
    card.innerHTML = `
      <img src="${prize.image}" alt="${prize.name}" class="prize-image" onerror="this.style.display='none'">
      <div class="prize-info">
        <div class="prize-category">${label}</div>
        <div class="prize-title">${escapeHTML(prize.name)}</div>
      </div>`;
    grid.appendChild(card);
  });
}

function openViewPredictions(dni) {
  const u = users[dni];
  if (!u) return;

  const preds   = u.predictions || {};
  const results = getFromStorage('insc_results', {});
  let hits     = 0;
  let totalPts = 0;

  MATCHES.forEach(m => {
    const p   = preds[m._id];
    const r   = results[m._id];
    const pts = calcMatchPoints(p, r);
    if (pts > 0) hits++;
    totalPts += pts;
  });

  let rows = '';
  MATCHES.forEach(m => {
    const p       = preds[m._id];
    const r       = results[m._id];
    const hasPred = p && (p.home !== '' || p.away !== '');
    const predStr = hasPred ? `${p.home} – ${p.away}` : '—';
    const resStr  = r && r.home !== '' ? `${r.home} – ${r.away}` : '—';
    let status    = '⏳';
    if (r && r.home !== '' && hasPred) {
      const pts = calcMatchPoints(p, r);
      status = pts === 10 ? '✅' : pts >= 5 ? '🟡' : '❌';
    }
    rows += `
      <tr>
        <td>${escapeHTML(m.homeTeam)} vs ${escapeHTML(m.awayTeam)}</td>
        <td>${m.dateStr || ''}</td>
        <td style="text-align:center;">${predStr}</td>
        <td style="text-align:center;">${resStr}</td>
        <td style="text-align:center;">${status}</td>
      </tr>`;
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
      ${u.saved ? '✅ Guardado' : '❌ No guardado'} · ${hits} con ganador acertado · ${totalPts} pts automáticos
    </p>`;

  openModal('modal-view-predictions');
}

console.log('✅ App.js Parte 1 cargado');
