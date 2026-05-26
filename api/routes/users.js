const express = require('express');
const User = require('../models/User');
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
    // Un usuario solo puede ver su propio perfil, el admin puede ver cualquiera
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

router.put('/:dni/predictions', requireAuth, async (req, res) => {
  try {
    if (!req.user.isAdmin && req.user.dni !== req.params.dni) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    const { predictions } = req.body;
    const user = await User.findOneAndUpdate(
      { dni: req.params.dni },
      { predictions, updatedAt: new Date() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
