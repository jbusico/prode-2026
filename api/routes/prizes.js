const express = require('express');
const Prize = require('../models/Prize');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const prizes = await Prize.find({}).sort({ category: 1, position: 1 }).lean();
    res.json(prizes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
