const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Match = require('../models/Match');

// ===== GRUPOS OFICIALES - COPA MUNDIAL 2026 =====

const TEAM_GROUPS = {
  // Grupo A
  'México':                      'A',
  'Corea del Sur':               'A',
  'Sudáfrica':                   'A',
  'Rep. repesca europea D':      'A',
  // Grupo B
  'Canadá':                      'B',
  'Suiza':                       'B',
  'Catar':                       'B',
  'Rep. repesca europea A':      'B',
  // Grupo C
  'Brasil':                      'C',
  'Marruecos':                   'C',
  'Escocia':                     'C',
  'Haití':                       'C',
  // Grupo D
  'Estados Unidos':              'D',
  'Australia':                   'D',
  'Paraguay':                    'D',
  'Rep. repesca europea B':      'D',
  // Grupo E
  'Alemania':                    'E',
  'Ecuador':                     'E',
  'Costa de Marfil':             'E',
  'Curazao':                     'E',
  // Grupo F
  'Países Bajos':                'F',
  'Japón':                       'F',
  'Túnez':                       'F',
  'Rep. repesca europea C':      'F',
  // Grupo G
  'Bélgica':                     'G',
  'Irán':                        'G',
  'Egipto':                      'G',
  'Nueva Zelanda':               'G',
  // Grupo H
  'España':                      'H',
  'Uruguay':                     'H',
  'Arabia Saudí':                'H',
  'Cabo Verde':                  'H',
  // Grupo I
  'Francia':                     'I',
  'Senegal':                     'I',
  'Noruega':                     'I',
  'Rep. repesca internacional 2':'I',
  // Grupo J
  'Argentina':                   'J',
  'Austria':                     'J',
  'Argelia':                     'J',
  'Jordania':                    'J',
  // Grupo K
  'Portugal':                    'K',
  'Colombia':                    'K',
  'Uzbekistán':                  'K',
  'Rep. repesca internacional 1':'K',
  // Grupo L
  'Inglaterra':                  'L',
  'Croacia':                     'L',
  'Panamá':                      'L',
  'Ghana':                       'L',
};

// ===== TRADUCCIONES ESPN (inglés) → ESPAÑOL =====

const TEAM_NAMES_ES = {
  'Mexico':                   'México',
  'South Korea':              'Corea del Sur',
  'Korea Republic':           'Corea del Sur',
  'South Africa':             'Sudáfrica',
  'Canada':                   'Canadá',
  'Switzerland':              'Suiza',
  'Qatar':                    'Catar',
  'Brazil':                   'Brasil',
  'Morocco':                  'Marruecos',
  'Scotland':                 'Escocia',
  'Haiti':                    'Haití',
  'United States':            'Estados Unidos',
  'USA':                      'Estados Unidos',
  'Australia':                'Australia',
  'Paraguay':                 'Paraguay',
  'Germany':                  'Alemania',
  'Ecuador':                  'Ecuador',
  "Côte d'Ivoire":            'Costa de Marfil',
  'Ivory Coast':              'Costa de Marfil',
  'Curaçao':                  'Curazao',
  'Curacao':                  'Curazao',
  'Netherlands':              'Países Bajos',
  'Japan':                    'Japón',
  'Tunisia':                  'Túnez',
  'Belgium':                  'Bélgica',
  'Iran':                     'Irán',
  'Egypt':                    'Egipto',
  'New Zealand':              'Nueva Zelanda',
  'Spain':                    'España',
  'Uruguay':                  'Uruguay',
  'Saudi Arabia':             'Arabia Saudí',
  'Cape Verde':               'Cabo Verde',
  'France':                   'Francia',
  'Senegal':                  'Senegal',
  'Norway':                   'Noruega',
  'Argentina':                'Argentina',
  'Austria':                  'Austria',
  'Algeria':                  'Argelia',
  'Jordan':                   'Jordania',
  'Portugal':                 'Portugal',
  'Colombia':                 'Colombia',
  'Uzbekistan':               'Uzbekistán',
  'England':                  'Inglaterra',
  'Croatia':                  'Croacia',
  'Panama':                   'Panamá',
  'Ghana':                    'Ghana',
  // Otros equipos que pueden aparecer en fases eliminatorias
  'Italy':                    'Italia',
  'Serbia':                   'Serbia',
  'Denmark':                  'Dinamarca',
  'Poland':                   'Polonia',
  'Türkiye':                  'Turquía',
  'Turkey':                   'Turquía',
  'Romania':                  'Rumania',
  'Hungary':                  'Hungría',
  'Ukraine':                  'Ucrania',
  'Slovakia':                 'Eslovaquia',
  'Greece':                   'Grecia',
  'Albania':                  'Albania',
  'Slovenia':                 'Eslovenia',
  'Wales':                    'Gales',
  'Nigeria':                  'Nigeria',
  'Cameroon':                 'Camerún',
  'DR Congo':                 'Congo DR',
  'Mali':                     'Malí',
  'Indonesia':                'Indonesia',
  'Iraq':                     'Irak',
  'Saudi Arabia':             'Arabia Saudí',
  'Venezuela':                'Venezuela',
  'Bolivia':                  'Bolivia',
  'Peru':                     'Perú',
  'Chile':                    'Chile',
  'Honduras':                 'Honduras',
  'El Salvador':              'El Salvador',
  'Jamaica':                  'Jamaica',
  'Costa Rica':               'Costa Rica',
};

const ORDINAL_ES = { '1st': '1°', '2nd': '2°', '3rd': '3°', '4th': '4°' };

const PHASE_NAME_ES = {
  'Round of 32':   'R32',
  'Round of 16':   'R16',
  'Quarterfinal':  'Cuartos',
  'Semifinal':     'Semifinal',
};

function translateTeam(espnName) {
  if (!espnName) return espnName;

  // Traducción directa por nombre
  if (TEAM_NAMES_ES[espnName]) return TEAM_NAMES_ES[espnName];

  // "Group A 1st Place" → "1° Grupo A"
  let m = espnName.match(/^Group\s+([A-L])\s+(1st|2nd|3rd|4th)\s+Place$/i);
  if (m) return `${ORDINAL_ES[m[2]] || m[2]} Grupo ${m[1].toUpperCase()}`;

  // "Round of 32 4 Winner" / "Round of 16 2 Winner" / "Quarterfinal 1 Winner" / "Semifinal 2 Winner"
  m = espnName.match(/^(Round of 32|Round of 16|Quarterfinal|Semifinal)\s+(\d+)\s+Winner$/i);
  if (m) {
    const fase = PHASE_NAME_ES[m[1]] || m[1];
    return `Ganador ${fase} #${m[2]}`;
  }

  // "Round of 32 4 Loser" (improbable pero por las dudas)
  m = espnName.match(/^(Round of 32|Round of 16|Quarterfinal|Semifinal)\s+(\d+)\s+Loser$/i);
  if (m) {
    const fase = PHASE_NAME_ES[m[1]] || m[1];
    return `Perdedor ${fase} #${m[2]}`;
  }

  return espnName;
}

// ===== ROUTES =====

const MISSING_GRUPO_J = [
  { homeTeam: 'Argelia',  awayTeam: 'Austria',   group: 'J' },
  { homeTeam: 'Jordania', awayTeam: 'Argentina', group: 'J' },
];

let grupoJSeeded = false;

async function ensureMissingGrupoJ() {
  if (grupoJSeeded) return;
  // Espera a que MongoDB esté conectado antes de operar
  await mongoose.connection.asPromise();
  for (const m of MISSING_GRUPO_J) {
    try {
      const exists = await Match.findOne({
        $or: [
          { homeTeam: m.homeTeam, awayTeam: m.awayTeam },
          { homeTeam: m.awayTeam, awayTeam: m.homeTeam },
        ]
      });
      if (!exists) {
        await Match.create({ ...m, phase: 'Fase de Grupos', status: 'scheduled' });
        console.log(`✅ Partido creado: ${m.homeTeam} vs ${m.awayTeam}`);
      }
    } catch (e) {
      console.error(`Error creando ${m.homeTeam} vs ${m.awayTeam}:`, e.message);
    }
  }
  grupoJSeeded = true;
}

// GET /api/matches
router.get('/', async (req, res) => {
  try {
    await ensureMissingGrupoJ();
    const matches = await Match.find({}).sort({ date: 1, matchNumber: 1 }).lean();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/matches/sync
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

// PUT /api/matches/:id/result
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
  { phase: 'Fase de Grupos',    from: [2026, 6, 11], to: [2026, 6, 27] },
  { phase: 'Ronda de 32',       from: [2026, 6, 28], to: [2026, 7,  3] },
  { phase: 'Ronda de 16',       from: [2026, 7,  4], to: [2026, 7,  7] },
  { phase: 'Cuartos de Final',  from: [2026, 7,  9], to: [2026, 7, 11] },
  { phase: 'Semifinal',         from: [2026, 7, 14], to: [2026, 7, 15] },
  { phase: 'Tercer Puesto',     from: [2026, 7, 18], to: [2026, 7, 18] },
  { phase: 'Final',             from: [2026, 7, 19], to: [2026, 7, 19] }
];

function getPhaseFromDate(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  for (const entry of PHASE_MAP) {
    const [fy, fm, fd] = entry.from;
    const [ty, tm, td] = entry.to;
    const dateNum = y * 10000 + m * 100 + d;
    if (dateNum >= fy * 10000 + fm * 100 + fd && dateNum <= ty * 10000 + tm * 100 + td) {
      return entry.phase;
    }
  }
  return null;
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

async function syncFromESPN() {
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
  const seen = new Set();
  const uniqueEvents = allEvents.filter(ev => {
    if (seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });
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

    const homeTeam = translateTeam(homeComp.team?.displayName || homeComp.team?.name || 'Por definir');
    const awayTeam = translateTeam(awayComp.team?.displayName || awayComp.team?.name || 'Por definir');

    const date = new Date(event.date);
    const phase = getPhaseFromDate(date);
    if (!phase) continue;

    // Grupo desde la tabla maestra hardcodeada
    const group = phase === 'Fase de Grupos'
      ? (TEAM_GROUPS[homeTeam] || TEAM_GROUPS[awayTeam] || null)
      : null;

    // Estado y resultado desde ESPN
    const espnStatus = comp.status?.type?.name || '';
    const isFinished = comp.status?.type?.completed === true || espnStatus === 'STATUS_FINAL';
    const isLive     = espnStatus === 'STATUS_IN_PROGRESS' || espnStatus === 'STATUS_HALFTIME';

    const matchData = {
      espnId:      event.id,
      matchNumber: matchNumber++,
      phase,
      group:       group || null,
      homeTeam,
      awayTeam,
      date,
      dateStr:     formatDateES(date),
      time:        formatTimeAR(date),
      venue:       comp.venue?.fullName || '',
      city:        comp.venue?.address?.city || '',
      status:      isFinished ? 'finished' : isLive ? 'live' : 'scheduled',
      ...(isFinished || isLive ? {
        homeScore: parseInt(homeComp.score ?? null, 10) ?? null,
        awayScore: parseInt(awayComp.score ?? null, 10) ?? null,
      } : {})
    };

    await Match.findOneAndUpdate(
      { espnId: event.id },
      { $set: matchData },
      { upsert: true, new: true }
    );
    count++;
    const scoreStr = isFinished ? ` (${matchData.homeScore}-${matchData.awayScore})` : '';
    process.stdout.write(`  ✅ ${phase}${group ? ' Grupo ' + group : ''} | ${homeTeam} vs ${awayTeam}${scoreStr}\n`);
  }

  console.log(`\n✅ Sync completo: ${count} partidos`);
  return count;
}

module.exports = router;
module.exports.syncFromESPN = syncFromESPN;
