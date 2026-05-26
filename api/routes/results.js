const express = require('express');
const Results = require('../models/Results');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const data = await Results.findOne({ key: 'global' });
    res.json(data || { results: {}, overrides: {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    const { results, overrides } = req.body;
    const data = await Results.findOneAndUpdate(
      { key: 'global' },
      { results, overrides, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
