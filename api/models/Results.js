const mongoose = require('mongoose');

const resultsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  results: { type: Object, default: {} },
  overrides: { type: Object, default: {} },
  locked: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Results', resultsSchema);
