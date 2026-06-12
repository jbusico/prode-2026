// ===== APP.JS - PARTE 1 =====
// Autenticación, inicialización y funciones principales

// ===== INICIALIZACIÓN =====

async function initApp() {
  console.log('🚀 Inicializando aplicación...');

  try {
    auditLog = getFromStorage('insc_audit_log', []);

    await loadMatchesFromAPI();

    const token        = localStorage.getItem('prode_token');
    const savedUserStr = localStorage.getItem('prode_user');

    if (token && savedUserStr) {
      const savedUser = JSON.parse(savedUserStr);
      users[savedUser.dni] = savedUser;
      currentUser = savedUser.dni;
      try {
        const freshUser = await apiCall('GET', `/api/users/${savedUser.dni}`);
        users[savedUser.dni] = freshUser;
        localStorage.setItem('prode_user', JSON.stringify(freshUser));
      } catch (e) {
        console.warn('No se pudo refrescar usuario desde API, usando caché local');
      }
      if (savedUser.isAdmin) await loadAllUsers();
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

async function loadAllUsers() {
  try {
    const allUsers = await apiCall('GET', '/api/users');
    allUsers.forEach(u => { users[u.dni] = u; });
  } catch (e) {
    console.error('Error cargando usuarios:', e);
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

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni: dniInput, password: passInput })
    });

    hideLoading();

    if (!res.ok) {
      logAudit('LOGIN_FAILED', { dni: dniInput, razón: 'credenciales inválidas' });
      recordLoginAttempt(dniInput);
      document.getElementById('pass-error').textContent = 'DNI o contraseña incorrectos';
      showToast('DNI o contraseña incorrectos', 'error');
      updateAttemptWarning(dniInput);
      return;
    }

    const data = await res.json();
    localStorage.setItem('prode_token', data.token);
    localStorage.setItem('prode_user', JSON.stringify(data.user));

    users[data.user.dni] = data.user;
    currentUser = data.user.dni;

    if (data.user.isAdmin) await loadAllUsers();

    logAudit('LOGIN_SUCCESS', { dni: dniInput });
    clearLoginErrors(dniInput);
    document.getElementById('login-dni').value  = '';
    document.getElementById('login-pass').value = '';
    updateUIAfterLogin();
    showPage('page-home');
    showToast(`¡Bienvenido, ${data.user.nombre}!`, 'success');
  } catch (error) {
    hideLoading();
    console.error('Error en login:', error);
    showToast('Error al iniciar sesión', 'error');
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
      users = {};
      latestResults = { results: {}, overrides: {}, locked: {}, predictionsClosed: false };
      localStorage.removeItem('prode_token');
      localStorage.removeItem('prode_user');
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

async function updateUIAfterLogin() {
  const user = users[currentUser];

  document.getElementById('navbar').style.display = 'flex';
  document.getElementById('nav-user-text').textContent = user.nombre;
  document.getElementById('nav-admin').style.display = user.isAdmin ? 'block' : 'none';

  try {
    const resultsData = await apiCall('GET', '/api/results');
    latestResults = {
      results:          resultsData.results          || {},
      overrides:        resultsData.overrides        || {},
      locked:           resultsData.locked           || {},
      predictionLocked: resultsData.predictionLocked || {},
      predictionsClosed: !!resultsData.predictionsClosed
    };
  } catch (e) {}

  renderProdeUI();
  applyPredictionsClosedUI();
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

  const groupMatches = MATCHES.filter(m => m.phase === 'Fase de Grupos');

  if (groupMatches.length === 0) {
    container.innerHTML = `
      <div class="empty-matches">
        <p>No hay partidos de Fase de Grupos cargados aún.</p>
      </div>`;
    return;
  }

  const byGroup = {};
  groupMatches.forEach(m => {
    const g = m.group || '?';
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(m);
  });

  // Sección Campeón del Mundial — al tope
  const allTeams = [...new Set(groupMatches.flatMap(m => [m.homeTeam, m.awayTeam]))].sort();
  const currentChampion = preds.champion || '';
  const isChampionLocked = !!(latestResults.locked && latestResults.locked['champion']);

  const champSection = document.createElement('div');
  champSection.className = 'champion-section';
  champSection.innerHTML = `
    <div class="champion-header">
      <h3>🏆 Campeón del Mundial 2026</h3>
      <p class="champion-subtitle">Acertar el campeón suma 10 puntos extra al ranking</p>
    </div>
    <select id="champion-select" class="champion-select" onchange="markProdeUnsaved()"${isChampionLocked ? ' disabled' : ''}>
      <option value="">-- Seleccionar equipo --</option>
      ${allTeams.map(t => `<option value="${escapeHTML(t)}"${t === currentChampion ? ' selected' : ''}>${escapeHTML(t)}</option>`).join('')}
    </select>
    ${isChampionLocked ? '<p style="font-size:12px;color:var(--text-light);margin-top:6px;">🔒 La elección de campeón está cerrada</p>' : ''}`;
  container.appendChild(champSection);

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

    container.appendChild(groupSection);
  });

  if (byGroup['?']?.length) {
    const noGroup = document.createElement('div');
    noGroup.className = 'group-section';
    noGroup.innerHTML = '<div class="group-header"><h3 class="group-title">Sin grupo asignado</h3></div>';
    byGroup['?']
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(m => {
        noGroup.appendChild(createMatchCard(m, preds[m._id] || { home: '', away: '' }));
      });
    container.appendChild(noGroup);
  }
}

function switchProdePhase(phase) {
  document.querySelectorAll('#matches-container .phase-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.phase === phase);
  });
  document.querySelectorAll('#matches-container .phase-section').forEach(sec => {
    sec.style.display = sec.dataset.phase === phase ? '' : 'none';
  });
}

function createMatchCard(match, pred) {
  const id           = match._id;
  const adminResult  = (latestResults.results || {})[id];
  const homeScore    = (match.homeScore !== null && match.homeScore !== undefined && match.homeScore !== '')
    ? match.homeScore
    : (adminResult && adminResult.home !== '' && adminResult.home !== undefined && adminResult.home !== null ? adminResult.home : null);
  const awayScore    = (match.awayScore !== null && match.awayScore !== undefined && match.awayScore !== '')
    ? match.awayScore
    : (adminResult && adminResult.away !== '' && adminResult.away !== undefined && adminResult.away !== null ? adminResult.away : null);
  const hasResult    = homeScore !== null && awayScore !== null;
  const isFinished   = match.status === 'finished' || hasResult;
  const isPredLocked = !!((latestResults.predictionLocked || {})[id]);
  const card         = document.createElement('div');
  card.className     = 'match-card';

  let inputAttrs;
  if (isFinished) {
    inputAttrs = 'disabled title="Partido finalizado"';
  } else if (isPredLocked) {
    inputAttrs = 'disabled title="Pronósticos cerrados para este partido"';
  } else {
    inputAttrs = 'oninput="markProdeUnsaved()"';
  }

  card.innerHTML = `
    <div class="match-meta">
      <span class="match-date">${match.dateStr || ''}</span>
      ${match.city ? `<span class="match-venue">${escapeHTML(match.city)}</span>` : ''}
    </div>
    <div class="match-teams">
      <div class="match-team">${escapeHTML(match.homeTeam)}</div>
      <div class="match-vs${hasResult ? ' has-result' : ''}">${hasResult ? homeScore + ' – ' + awayScore : 'vs'}</div>
      <div class="match-team">${escapeHTML(match.awayTeam)}</div>
    </div>
    <div class="match-inputs">
      <input type="number" class="match-input" min="0" max="20"
        value="${pred.home}" id="pred-home-${id}" placeholder="0" ${inputAttrs}>
      <div class="match-dash">–</div>
      <input type="number" class="match-input" min="0" max="20"
        value="${pred.away}" id="pred-away-${id}" placeholder="0" ${inputAttrs}>
    </div>`;
  return card;
}

// ===== GUARDAR PRONÓSTICOS =====

function applyPredictionsClosedUI() {
  const closed  = !!latestResults.predictionsClosed;
  const banner  = document.getElementById('predictions-closed-banner');
  const saveBtn = document.getElementById('prode-save-btn');

  if (banner)  banner.style.display = closed ? '' : 'none';
  if (saveBtn) saveBtn.disabled = closed;

  document.querySelectorAll('#matches-container .match-input').forEach(input => {
    if (input.title === 'Partido finalizado') return;
    if (input.title === 'Pronósticos cerrados para este partido') return;
    input.disabled = closed;
    if (closed) {
      input.removeAttribute('oninput');
    } else {
      input.setAttribute('oninput', 'markProdeUnsaved()');
    }
  });

  const champSelect = document.getElementById('champion-select');
  if (champSelect) champSelect.disabled = closed || !!(latestResults.locked && latestResults.locked['champion']);
}

async function saveProdeWithLoader() {
  showLoading('Guardando pronósticos...');
  try {
    const success = await saveProde();
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

async function saveProde() {
  if (latestResults.predictionsClosed) {
    showToast('La carga de pronósticos está cerrada', 'error');
    return false;
  }
  try {
    const predictions = {};
    const errors      = [];

    const groupMatches = MATCHES.filter(m => m.phase === 'Fase de Grupos');

    for (const match of groupMatches) {
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

    const champSelect = document.getElementById('champion-select');
    if (latestResults.locked && latestResults.locked['champion']) {
      predictions.champion = (users[currentUser]?.predictions?.champion) || '';
    } else {
      predictions.champion = champSelect ? champSelect.value : '';
    }

    await apiCall('PUT', `/api/users/${currentUser}/predictions`, { predictions });
    if (users[currentUser]) {
      users[currentUser].predictions = predictions;
      users[currentUser].saved = true;
    }

    logAudit('SAVE_PREDICTIONS', { cantidad: Object.keys(predictions).length });
    showToast('✅ Pronósticos guardados correctamente', 'success');
    return true;
  } catch (error) {
    console.error('Error guardando pronósticos:', error);
    showToast(error.message || 'Error al guardar pronósticos', 'error');
    return false;
  }
}

function markProdeUnsaved() {
  const indicator  = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  if (!indicator) return;
  indicator.style.color  = 'var(--warning)';
  statusText.textContent = 'Cambios sin guardar';
}

function updateStatusIndicator(isSaving) {
  const indicator  = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  if (!indicator) return;
  if (isSaving) {
    indicator.style.color  = 'var(--warning)';
    statusText.textContent = 'Guardando...';
  } else {
    indicator.style.color  = 'var(--success)';
    statusText.textContent = 'Cambios guardados';
  }
}

// ===== PRIZES PAGE =====

async function renderPrizesUI() {
  await renderRanking();
  await renderPrizes();
}

async function refreshAndShowRanking() {
  showPage('page-ranking');
  await renderRanking();
}

async function renderRanking() {
  const topThree = document.getElementById('top-three');
  const tbody    = document.getElementById('scores-tbody');
  topThree.innerHTML = '<p style="color:var(--text-light); font-size:14px;">Cargando...</p>';
  tbody.innerHTML    = '';

  try {
    const [rankingUsers, resultsData] = await Promise.all([
      apiCall('GET', '/api/predictions/ranking'),
      apiCall('GET', '/api/results')
    ]);

    latestResults = { results: resultsData.results || {}, overrides: resultsData.overrides || {}, locked: resultsData.locked || {}, predictionLocked: resultsData.predictionLocked || {}, predictionsClosed: !!resultsData.predictionsClosed };
    rankingUsers.forEach(u => { users[u.dni] = u; });
    applyPredictionsClosedUI();

    const rankings = [];

    const groupMatchIds = MATCHES.filter(m => m.phase === 'Fase de Grupos').map(m => m._id);
    const playedGroupCount = groupMatchIds.filter(id => {
      const r = latestResults.results[id];
      return r && r.home !== '';
    }).length;
    const totalPlayed = playedGroupCount + (latestResults.results.champion ? 1 : 0);

    rankingUsers.forEach(u => {
      rankings.push({ dni: u.dni, nombre: u.nombre, aciertos: u.aciertos, puntos: u.puntos, puntosAuto: u.puntosAuto });
    });

    rankings.sort((a, b) => b.puntos - a.puntos);

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

    tbody.innerHTML = '';
    if (rankings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-light);">No hay participantes con pago confirmado aún.</td></tr>';
    } else {
      rankings.forEach((rank, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${idx + 1}</td>
          <td>${escapeHTML(rank.nombre)}</td>
          <td>${rank.aciertos}</td>
          <td>${rank.puntos}</td>
          <td style="text-align:center;">
            ${totalPlayed > 0 ? `${rank.aciertos}/${totalPlayed} (${Math.round(rank.aciertos / totalPlayed * 100)}%)` : '—'}
            ${rank.dni === currentUser ? `<br><button class="btn-secondary" style="margin-top:4px;" onclick="openViewPredictions('${rank.dni}')">Mis pronósticos</button>` : ''}
          </td>`;
        tbody.appendChild(tr);
      });
    }
  } catch (e) {
    console.error('Error cargando ranking:', e);
    topThree.innerHTML = '<p style="color:var(--text-light); font-size:14px;">Error al cargar el ranking.</p>';
  }
}

async function renderPrizes() {
  const gridProde = document.getElementById('prizes-grid-prode');
  gridProde.innerHTML = '<p style="color:var(--text-light)">Cargando...</p>';

  let prizes;
  try {
    prizes = await apiCall('GET', '/api/prizes');
  } catch {
    gridProde.innerHTML = '<p style="color:var(--text-light)">Error al cargar premios.</p>';
    return;
  }

  const labels = { 1: '1er Lugar', 2: '2do Lugar', 3: '3er Lugar' };

  function buildCard(prize) {
    const card = document.createElement('div');
    if (prize.position === 99) {
      card.className = 'prize-card prize-card--more';
      card.innerHTML = `<div class="prize-more-icon">🎁</div><div class="prize-more-text">${escapeHTML(prize.name)}</div>`;
      return card;
    }
    card.className = 'prize-card';
    card.innerHTML = `
      ${prize.imageUrl ? `<img src="${escapeHTML(prize.imageUrl)}" alt="${escapeHTML(prize.name)}" class="prize-image" onerror="this.style.display='none'">` : ''}
      <div class="prize-info">
        <div class="prize-category">${labels[prize.position] || ''}</div>
        <div class="prize-title">${escapeHTML(prize.name)}</div>
        ${prize.description ? `<div class="prize-desc">${escapeHTML(prize.description)}</div>` : ''}
      </div>`;
    return card;
  }

  gridProde.innerHTML = '';
  prizes.filter(p => p.category === 'prode').forEach(p => gridProde.appendChild(buildCard(p)));
}

function openViewPredictions(dni) {
  const u = users[dni];
  if (!u) return;

  const preds       = u.predictions || {};
  const results     = latestResults.results;
  const groupMatches = MATCHES.filter(m => m.phase === 'Fase de Grupos');
  let hits     = 0;
  let totalPts = 0;

  groupMatches.forEach(m => {
    const p   = preds[m._id];
    const r   = results[m._id];
    const pts = calcMatchPoints(p, r);
    if (pts > 0) hits++;
    totalPts += pts;
  });

  if (preds.champion && results.champion && preds.champion === results.champion) {
    totalPts += 10;
    hits++;
  }

  let rows = '';

  // Fila campeón al inicio
  const champPred   = preds.champion || '—';
  const champResult = results.champion || '—';
  let champStatus   = '⏳';
  if (results.champion) {
    champStatus = preds.champion === results.champion ? '✅' : '❌';
  }
  rows += `
    <tr style="background:var(--card-alt);">
      <td><strong>🏆 Campeón del Mundial</strong></td>
      <td style="text-align:center;">+10 pts</td>
      <td style="text-align:center;">${escapeHTML(champPred)}</td>
      <td style="text-align:center;">${escapeHTML(champResult)}</td>
      <td style="text-align:center;">${champStatus}</td>
    </tr>`;

  groupMatches.forEach(m => {
    const p       = preds[m._id];
    const r       = results[m._id];
    const hasPred = p && (p.home !== '' || p.away !== '');
    const predStr = hasPred ? `${p.home} – ${p.away}` : '—';
    const resStr  = r && r.home !== '' ? `${r.home} – ${r.away}` : '—';
    let status    = '⏳';
    if (r && r.home !== '' && hasPred) {
      const pts = calcMatchPoints(p, r);
      status = pts === 3 ? '✅' : pts === 1 ? '🟡' : '❌';
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
