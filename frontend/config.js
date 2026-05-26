// ===== CONFIG.JS =====
// Configuración global y datos del sistema

// ===== CONSTANTES =====
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000;  // 15 minutos
const PASSWORD_MIN_LENGTH = 6;
const DNI_REGEX = /^\d{7,8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===== DATOS DE PARTIDOS =====
const MATCHES = {
  grupoA: [
    { home: 'Argentina', away: 'Canadá', date: '2 jun' },
    { home: 'México', away: 'Uruguay', date: '2 jun' }
  ],
  grupoB: [
    { home: 'Brasil', away: 'Paraguay', date: '3 jun' },
    { home: 'Colombia', away: 'Perú', date: '3 jun' }
  ],
  grupoC: [
    { home: 'Chile', away: 'Bolivia', date: '4 jun' },
    { home: 'Venezuela', away: 'Panamá', date: '4 jun' }
  ],
  grupoD: [
    { home: 'Ecuador', away: 'Costa Rica', date: '5 jun' },
    { home: 'Honduras', away: 'Jamaica', date: '5 jun' }
  ],
  grupoE: [
    { home: 'Portugal', away: 'Marruecos', date: '6 jun' },
    { home: 'Francia', away: 'Alemania', date: '6 jun' }
  ],
  grupoF: [
    { home: 'España', away: 'Italia', date: '7 jun' },
    { home: 'Holanda', away: 'Bélgica', date: '7 jun' }
  ],
  grupoG: [
    { home: 'Japón', away: 'Corea del Sur', date: '8 jun' },
    { home: 'China', away: 'Tailandia', date: '8 jun' }
  ],
  grupoH: [
    { home: 'Australia', away: 'Nueva Zelanda', date: '9 jun' },
    { home: 'Sudáfrica', away: 'Camerún', date: '9 jun' }
  ]
};

// ===== PREMIOS =====
const PRIZES = {
  prode: [
    { position: '1', name: 'Primer Premio PRODE', image: 'primerpremioprode.png' },
    { position: '2', name: 'Segundo Premio PRODE', image: 'segundopermioprode.png' },
    { position: '3', name: 'Tercer Premio PRODE', image: 'tercerpremioprode.png' }
  ],
  rifa: [
    { position: '1', name: 'Primer Premio Rifa', image: 'primerpremiorifa.png' },
    { position: '2', name: 'Segundo Premio Rifa', image: 'segundopremiorifa.png' },
    { position: '3', name: 'Tercer Premio Rifa', image: 'tercerpermiorifa.png' }
  ]
};

// ===== VARIABLES GLOBALES =====
let users = {};
let currentUser = null;
let loginAttempts = {};  // {dni: {count: N, timestamp: ...}}
let auditLog = [];
let currentAdminTab = 'users';

console.log('✅ Config.js cargado');
