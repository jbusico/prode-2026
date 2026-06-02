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

router.put('/predictions-closed', requireAdmin, async (req, res) => {
  try {
    const { closed } = req.body;
    const data = await Results.findOneAndUpdate(
      { key: 'global' },
      { predictionsClosed: !!closed, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json({ predictionsClosed: data.predictionsClosed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/lock/:matchId', requireAdmin, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { locked } = req.body;
    const data = await Results.findOne({ key: 'global' });
    const currentLocked = (data && data.locked) ? { ...data.locked } : {};
    if (locked) {
      currentLocked[matchId] = true;
    } else {
      delete currentLocked[matchId];
    }
    const updated = await Results.findOneAndUpdate(
      { key: 'global' },
      { locked: currentLocked, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json({ locked: updated.locked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    const { results, overrides, locked } = req.body;
    const updateFields = { results, overrides, updatedAt: new Date() };
    if (locked !== undefined) updateFields.locked = locked;
    const data = await Results.findOneAndUpdate(
      { key: 'global' },
      updateFields,
      { new: true, upsert: true }
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
