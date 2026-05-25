const express = require('express');
const User = require('../models/User');
const router = express.Router();

router.get('/ranking', async (req, res) => {
  try {
    const users = await User.find({ paid: true }, { password: 0 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
