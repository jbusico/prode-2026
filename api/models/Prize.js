const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
  category: { type: String, enum: ['prode', 'rifa'], required: true },
  position: { type: Number, required: true },
  name:     { type: String, required: true },
  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
});

prizeSchema.index({ category: 1, position: 1 });

module.exports = mongoose.model('Prize', prizeSchema);
