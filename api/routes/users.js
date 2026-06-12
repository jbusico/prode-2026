const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Results = require('../models/Results');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:dni', requireAuth, async (req, res) => {
  try {
    if (!req.user.isAdmin && req.user.dni !== req.params.dni) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    const user = await User.findOne({ dni: req.params.dni }).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:dni', requireAdmin, async (req, res) => {
  try {
    const { nombre, email, paid, password } = req.body;
    const update = { nombre, email, paid, updatedAt: new Date() };
    if (password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(password, salt);
    }
    const user = await User.findOneAndUpdate(
      { dni: req.params.dni },
      update,
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:dni', requireAdmin, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ dni: req.params.dni });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:dni/predictions', requireAuth, async (req, res) => {
  try {
    if (!req.user.isAdmin && req.user.dni !== req.params.dni) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    const { predictions } = req.body;
    if (!req.user.isAdmin) {
      const resultsDoc = await Results.findOne({ key: 'global' });
      if (resultsDoc && resultsDoc.predictionsClosed) {
        return res.status(403).json({ error: 'La carga de pronósticos está cerrada' });
      }
      const predictionLocked = (resultsDoc && resultsDoc.predictionLocked) ? resultsDoc.predictionLocked : {};
      const lockedIds = predictions ? Object.keys(predictions).filter(id => predictionLocked[id]) : [];
      if (lockedIds.length > 0) {
        const existingUser = await User.findOne({ dni: req.params.dni }).select('predictions');
        const existingPreds = (existingUser && existingUser.predictions) || {};
        lockedIds.forEach(id => {
          if (existingPreds[id] !== undefined) {
            predictions[id] = existingPreds[id];
          } else {
            delete predictions[id];
          }
        });
      }
    }
    const user = await User.findOneAndUpdate(
      { dni: req.params.dni },
      { predictions, saved: true, updatedAt: new Date() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
