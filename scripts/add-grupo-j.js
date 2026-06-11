const envPath = require('path').join(__dirname, '../.env');
const examplePath = require('path').join(__dirname, '../.env.example');
require('dotenv').config({ path: require('fs').existsSync(envPath) ? envPath : examplePath });
const mongoose = require('mongoose');
const Match = require('../api/models/Match');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  const toAdd = [
    { homeTeam: 'Argelia',  awayTeam: 'Austria',   group: 'J' },
    { homeTeam: 'Jordania', awayTeam: 'Argentina', group: 'J' },
  ];

  for (const m of toAdd) {
    const exists = await Match.findOne({
      $or: [
        { homeTeam: m.homeTeam, awayTeam: m.awayTeam },
        { homeTeam: m.awayTeam, awayTeam: m.homeTeam },
      ]
    });
    if (exists) {
      console.log(`⚠️  Ya existe: ${exists.homeTeam} vs ${exists.awayTeam}`);
    } else {
      const created = await Match.create({ ...m, phase: 'Fase de Grupos', status: 'scheduled' });
      console.log(`✅ Creado: ${created.homeTeam} vs ${created.awayTeam} (id: ${created._id})`);
    }
  }

  // Mostrar todos los partidos del Grupo J para verificar
  const grupoJ = await Match.find({ group: 'J' }).sort({ date: 1 });
  console.log(`\nGrupo J (${grupoJ.length} partidos):`);
  grupoJ.forEach(p => console.log(`  - ${p.homeTeam} vs ${p.awayTeam} | ${p.status}`));

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
