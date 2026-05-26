const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  espnId:      { type: String, unique: true, sparse: true },
  matchNumber: { type: Number },
  phase: {
    type: String,
    enum: ['Fase de Grupos', 'Ronda de 32', 'Ronda de 16', 'Cuartos de Final', 'Semifinal', 'Tercer Puesto', 'Final'],
    required: true
  },
  group:     { type: String, default: null },
  homeTeam:  { type: String, required: true },
  awayTeam:  { type: String, required: true },
  date:      { type: Date },
  dateStr:   { type: String },
  time:      { type: String },
  venue:     { type: String, default: '' },
  city:      { type: String, default: '' },
  homeScore: { type: Number, default: null },
  awayScore: { type: Number, default: null },
  status:    { type: String, enum: ['scheduled', 'live', 'finished'], default: 'scheduled' }
}, { timestamps: true });

module.exports = mongoose.model('Match', MatchSchema);
