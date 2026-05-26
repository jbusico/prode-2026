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

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/results', resultsRoutes);

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

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log('✅ MongoDB conectado');
      await seedAdmin();
    })
    .catch(err => console.error('❌ Error MongoDB:', err.message));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Servidor en puerto ${PORT}`));

module.exports = app;
