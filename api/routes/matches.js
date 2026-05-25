const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  const MATCHES = {
    grupoA: [
      { home: 'Argentina', away: 'Canadá', date: '2 jun' },
      { home: 'México', away: 'Uruguay', date: '2 jun' }
    ],
    grupoB: [
      { home: 'Brasil', away: 'Paraguay', date: '3 jun' },
      { home: 'Colombia', away: 'Perú', date: '3 jun' }
    ],
    grupoC: [
      { home: 'Chile', away: 'Bolivia', date: '4 jun' },
      { home: 'Venezuela', away: 'Panamá', date: '4 jun' }
    ],
    grupoD: [
      { home: 'Ecuador', away: 'Costa Rica', date: '5 jun' },
      { home: 'Honduras', away: 'Jamaica', date: '5 jun' }
    ],
    grupoE: [
      { home: 'Portugal', away: 'Marruecos', date: '6 jun' },
      { home: 'Francia', away: 'Alemania', date: '6 jun' }
    ],
    grupoF: [
      { home: 'España', away: 'Italia', date: '7 jun' },
      { home: 'Holanda', away: 'Bélgica', date: '7 jun' }
    ],
    grupoG: [
      { home: 'Japón', away: 'Corea del Sur', date: '8 jun' },
      { home: 'China', away: 'Tailandia', date: '8 jun' }
    ],
    grupoH: [
      { home: 'Australia', away: 'Nueva Zelanda', date: '9 jun' },
      { home: 'Sudáfrica', away: 'Camerún', date: '9 jun' }
    ]
  };
  
  res.json(MATCHES);
});

module.exports = router;
