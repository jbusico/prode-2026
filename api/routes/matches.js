const express = require('express');
const router = express.Router();
const Match = require('../models/Match');

// GET /api/matches - Retorna todos los partidos ordenados por fecha
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find({}).sort({ date: 1, matchNumber: 1 }).lean();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/matches/sync - Sincroniza partidos desde ESPN (solo admin)
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Iniciando sincronización desde ESPN...');
    const count = await syncFromESPN();
    res.json({ success: true, count });
  } catch (err) {
    console.error('Error en sync:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/matches/fix-groups - Asigna grupos a partidos de Fase de Grupos que no los tienen
router.post('/fix-groups', async (req, res) => {
  try {
    const groupMap = await buildGroupMapFromStandings();
    if (Object.keys(groupMap).length === 0) {
      return res.status(503).json({ error: 'No se pudo obtener grupos desde ESPN. Intentá de nuevo.' });
    }
    console.log(`📊 Mapa de grupos obtenido: ${Object.keys(groupMap).length} equipos`);

    const matches = await Match.find({ phase: 'Fase de Grupos' }).lean();
    let fixed = 0;

    for (const match of matches) {
      const group = groupMap[match.homeTeam] || groupMap[match.awayTeam] || null;
      if (group && match.group !== group) {
        await Match.findByIdAndUpdate(match._id, { group });
        fixed++;
        console.log(`  ✅ ${match.homeTeam} vs ${match.awayTeam} → Grupo ${group}`);
      }
    }

    res.json({ success: true, fixed, total: matches.length, teams: Object.keys(groupMap).length });
  } catch (err) {
    console.error('Error en fix-groups:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/matches/:id/result - Admin actualiza resultado de un partido
router.put('/:id/result', async (req, res) => {
  const { homeScore, awayScore } = req.body;
  try {
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { homeScore, awayScore, status: 'finished' },
      { new: true }
    );
    if (!match) return res.status(404).json({ error: 'Partido no encontrado' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ESPN SYNC LOGIC =====

const PHASE_MAP = [
  { phase: 'Fase de Grupos', from: [2026, 6, 11], to: [2026, 6, 27] },
  { phase: 'Ronda de 32',    from: [2026, 6, 28], to: [2026, 7,  3] },
  { phase: 'Ronda de 16',    from: [2026, 7,  4], to: [2026, 7,  7] },
  { phase: 'Cuartos de Final', from: [2026, 7, 9],  to: [2026, 7, 11] },
  { phase: 'Semifinal',      from: [2026, 7, 14], to: [2026, 7, 15] },
  { phase: 'Tercer Puesto',  from: [2026, 7, 18], to: [2026, 7, 18] },
  { phase: 'Final',          from: [2026, 7, 19], to: [2026, 7, 19] }
];

function getPhaseFromDate(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();

  for (const entry of PHASE_MAP) {
    const [fy, fm, fd] = entry.from;
    const [ty, tm, td] = entry.to;
    const dateNum = y * 10000 + m * 100 + d;
    const fromNum = fy * 10000 + fm * 100 + fd;
    const toNum   = ty * 10000 + tm * 100 + td;
    if (dateNum >= fromNum && dateNum <= toNum) return entry.phase;
  }
  return null;
}

function getGroupFromNotes(notes) {
  if (!Array.isArray(notes)) return null;
  for (const note of notes) {
    const text = (note.headline || note.type?.text || note.text || '');
    const m = text.match(/[Gg]roup\s+([A-La-l])/i) || text.match(/[Gg]rupo\s+([A-La-l])/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function getGroupFromEventName(name) {
  if (!name) return null;
  const m = name.match(/[Gg]roup\s+([A-La-l])/i) || name.match(/[Gg]rupo\s+([A-La-l])/i);
  return m ? m[1].toUpperCase() : null;
}

function formatDateES(date) {
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

function formatTimeAR(date) {
  try {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    });
  } catch {
    return '';
  }
}

function getAllDates(startISO, endISO) {
  const dates = [];
  const cur = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cur.getUTCDate()).padStart(2, '0');
    dates.push(`${y}${m}${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function buildGroupMapFromStandings() {
  const urls = [
    'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings',
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/standings'
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const map = {};

      // ESPN puede devolver distintas estructuras según la temporada
      const groups =
        data.standings?.groups ||
        data.standings ||
        data.groups ||
        [];

      for (const group of (Array.isArray(groups) ? groups : [])) {
        const groupName = group.name || group.shortDisplayName || group.displayName || '';
        const letter = groupName.match(/[Gg]roup\s+([A-La-l])/i);
        if (!letter) continue;
        const g = letter[1].toUpperCase();

        const entries =
          group.standings?.entries ||
          group.entries ||
          [];

        for (const entry of entries) {
          const name = entry.team?.displayName || entry.team?.name;
          if (name) map[name] = g;
        }
      }

      if (Object.keys(map).length > 0) {
        console.log(`📊 Standings obtenidos de: ${url} (${Object.keys(map).length} equipos)`);
        return map;
      }
    } catch (e) {
      console.warn(`⚠️ Standings fallido en ${url}:`, e.message);
    }
  }
  return {};
}

async function fetchEventSummary(eventId) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${eventId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function syncFromESPN() {
  const groupMap = await buildGroupMapFromStandings();
  console.log(`📊 Mapa de grupos pre-sync: ${Object.keys(groupMap).length} equipos`);

  const dates = getAllDates('2026-06-11', '2026-07-19');
  const allEvents = [];

  for (const dateStr of dates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateStr}&limit=50`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.events?.length) allEvents.push(...data.events);
    } catch (e) {
      console.error(`Error fetching ${dateStr}:`, e.message);
    }
  }

  console.log(`ESPN: ${allEvents.length} eventos encontrados`);

  // Deduplicar por id
  const uniqueEvents = [];
  const seen = new Set();
  for (const ev of allEvents) {
    if (!seen.has(ev.id)) { seen.add(ev.id); uniqueEvents.push(ev); }
  }

  // Ordenar por fecha
  uniqueEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

  let count = 0;
  let matchNumber = 1;

  for (const event of uniqueEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const competitors = comp.competitors || [];
    const homeComp = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const awayComp = competitors.find(c => c.homeAway === 'away') || competitors[1];
    if (!homeComp || !awayComp) continue;

    const homeTeam = homeComp.team?.displayName || homeComp.team?.name || 'Por definir';
    const awayTeam = awayComp.team?.displayName || awayComp.team?.name || 'Por definir';

    const date = new Date(event.date);
    const phase = getPhaseFromDate(date);
    if (!phase) continue;

    // Detectar grupo desde notas o nombre del evento
    let group = getGroupFromNotes(comp.notes) || getGroupFromEventName(event.name);

    // Si es fase de grupos y aún no tiene grupo, buscar en el summary
    if (phase === 'Fase de Grupos' && !group) {
      const summary = await fetchEventSummary(event.id);
      if (summary) {
        group = getGroupFromNotes(summary.header?.competitions?.[0]?.notes)
              || getGroupFromEventName(summary.header?.competitions?.[0]?.season?.name)
              || getGroupFromEventName(summary.pickcenter?.[0]?.gameInfo?.venue?.name);
      }
    }

    // Fallback: usar el mapa de standings si todavía sin grupo
    if (phase === 'Fase de Grupos' && !group && Object.keys(groupMap).length > 0) {
      group = groupMap[homeTeam] || groupMap[awayTeam] || null;
    }

    const matchData = {
      espnId: event.id,
      matchNumber: matchNumber++,
      phase,
      group: group || null,
      homeTeam,
      awayTeam,
      date,
      dateStr: formatDateES(date),
      time: formatTimeAR(date),
      venue: comp.venue?.fullName || '',
      city:  comp.venue?.address?.city || ''
    };

    await Match.findOneAndUpdate(
      { espnId: event.id },
      { $set: matchData },
      { upsert: true, new: true }
    );
    count++;
    process.stdout.write(`  ✅ ${phase}${group ? ' Grupo ' + group : ''} | ${homeTeam} vs ${awayTeam}\n`);
  }

  console.log(`\n✅ Sync completo: ${count} partidos`);
  return count;
}

module.exports = router;
