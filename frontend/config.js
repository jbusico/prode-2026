// ===== CONFIG.JS =====
// Configuración global y datos del sistema

// ===== CONSTANTES =====
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000;  // 15 minutos
const PASSWORD_MIN_LENGTH = 6;
const DNI_REGEX = /^\d{7,8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===== DATOS DE PARTIDOS =====
// Se cargan dinámicamente desde /api/matches al iniciar la app
let MATCHES = [];

// Orden de fases para display
const PHASE_ORDER = [
  'Fase de Grupos',
  'Ronda de 32',
  'Ronda de 16',
  'Cuartos de Final',
  'Semifinal',
  'Tercer Puesto',
  'Final'
];

const GROUP_ORDER = ['A','B','C','D','E','F','G','H','I','J','K','L'];

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
