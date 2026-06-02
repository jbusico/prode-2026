const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const matchesRoutes = require('./routes/matches');
const predictionsRoutes = require('./routes/predictions');
const resultsRoutes = require('./routes/results');
const prizesRoutes = require('./routes/prizes');
const logsRoutes = require('./routes/logs');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/prizes', prizesRoutes);
app.use('/api/logs', logsRoutes);

app.get('/api/health', (req, res) => res.json({ status: '✅ Server OK' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

async function seedAdmin() {
  try {
    const User = require('./models/User');
    const exists = await User.findOne({ dni: '11222333' });
    if (!exists) {
      await User.create({
        dni: '11222333',
        nombre: 'Administrador',
        email: 'admin@prode.local',
        password: '11222333',
        isAdmin: true,
        paid: false
      });
      console.log('✅ Admin creado (DNI: 11222333 / Pass: 11222333)');
    }
  } catch (err) {
    console.error('Error al crear admin:', err.message);
  }
}

async function seedPrizes() {
  try {
    const Prize = require('./models/Prize');
    const defined = [
      { category: 'prode', position: 1, name: 'Camiseta de la Selección Argentina', description: 'Camiseta oficial de la Selección Argentina' },
      { category: 'prode', position: 99, name: '¡y algunas sorpresitas más!',             description: '' },
    ];
    await Prize.deleteMany({});
    await Prize.insertMany(defined);
    console.log('✅ Premios actualizados');
  } catch (err) {
    console.error('Error al crear premios:', err.message);
  }
}

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log('✅ MongoDB conectado');
      await seedAdmin();
      await seedPrizes();

      if (!process.env.VERCEL) {
        const cron = require('node-cron');
        const { syncFromESPN } = require('./routes/matches');
        cron.schedule('0 3,9,15,21 * * *', async () => {
          const AuditLog = require('./models/AuditLog');
          console.log('⏰ Sync automático iniciado...');
          try {
            const count = await syncFromESPN();
            console.log(`⏰ Sync automático completo: ${count} partidos`);
            await AuditLog.create({ accion: 'sync_espn', detalles: { partidos: count, resultado: 'ok' } });
          } catch (err) {
            console.error('⏰ Error en sync automático:', err.message);
            await AuditLog.create({ accion: 'sync_espn', detalles: { resultado: 'error', error: err.message } }).catch(() => {});
          }
        });
        console.log('⏰ Sync automático programado (cada 6 horas)');
      }
    })
    .catch(err => console.error('❌ Error MongoDB:', err.message));
}

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));
}

module.exports = app;
