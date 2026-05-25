const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:dni', async (req, res) => {
  try {
    const user = await User.findOne({ dni: req.params.dni }, { password: 0 });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:dni/predictions', async (req, res) => {
  try {
    const { predictions } = req.body;
    const user = await User.findOneAndUpdate(
      { dni: req.params.dni },
      { predictions, updatedAt: new Date() },
      { new: true, select: { password: 0 } }
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
