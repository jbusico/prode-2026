const express = require('express');
const AuditLog = require('../models/AuditLog');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuario, accion, detalles } = req.body;
    if (!accion) return res.status(400).json({ error: 'accion requerida' });
    const log = await AuditLog.create({ usuario: usuario || 'anonymous', accion, detalles: detalles || {} });
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
