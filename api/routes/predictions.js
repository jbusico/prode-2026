const express = require('express');
const User = require('../models/User');
const Match = require('../models/Match');
const Results = require('../models/Results');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function calcMatchPoints(p, r) {
  if (!p || !r || r.home === '' || r.away === '') return 0;
  const ph = Number(p.home), pa = Number(p.away);
  const rh = Number(r.home), ra = Number(r.away);
  if (ph === rh && pa === ra) return 3;
  const pWin = ph > pa ? 1 : ph < pa ? -1 : 0;
  const rWin = rh > ra ? 1 : rh < ra ? -1 : 0;
  if (pWin === rWin) return 1;
  return 0;
}

router.get('/ranking', requireAuth, async (req, res) => {
  try {
    const [users, resultsDoc, groupMatches] = await Promise.all([
      User.find({ paid: true }).select('-password'),
      Results.findOne({ key: 'global' }),
      Match.find({ phase: 'Fase de Grupos' }).select('_id')
    ]);

    const results = resultsDoc?.results || {};
    const overrides = resultsDoc?.overrides || {};
    const groupMatchIds = new Set(groupMatches.map(m => m._id.toString()));
    const currentDni = req.user.dni;

    const ranked = users.map(u => {
      const obj = u.toObject();
      const preds = obj.predictions || {};

      let aciertos = 0;
      let puntosAuto = 0;

      groupMatchIds.forEach(matchId => {
        const r = results[matchId];
        const p = preds[matchId];
        const pts = calcMatchPoints(p, r);
        if (pts > 0) aciertos++;
        puntosAuto += pts;
      });

      if (preds.champion && results.champion && preds.champion === results.champion) {
        puntosAuto += 10;
        aciertos++;
      }

      const puntosManual = overrides[obj.dni];
      const puntos = puntosManual !== undefined ? puntosManual : puntosAuto;

      if (obj.dni !== currentDni) {
        delete obj.predictions;
      }

      return { ...obj, aciertos, puntos, puntosAuto };
    });

    res.json(ranked);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
