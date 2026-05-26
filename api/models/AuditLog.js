const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  usuario:   { type: String, default: 'sistema' },
  accion:    { type: String, required: true },
  detalles:  { type: mongoose.Schema.Types.Mixed, default: {} }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
