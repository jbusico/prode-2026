// ===== UTILS.JS =====
// Funciones utilitarias, validación y helpers

// ===== VALIDACIÓN =====

/**
 * Valida un DNI
 */
function validateDNI(dni) {
  dni = dni.trim();
  if (!DNI_REGEX.test(dni)) {
    return { valid: false, error: 'DNI debe tener 7-8 dígitos' };
  }
  return { valid: true };
}

/**
 * Valida un email
 */
function validateEmail(email) {
  email = email.trim();
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Email no es válido' };
  }
  return { valid: true };
}

/**
 * Valida una contraseña
 */
function validatePassword(pass) {
  if (pass.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres` };
  }
  return { valid: true };
}

/**
 * Valida un nombre
 */
function validateName(name) {
  name = name.trim();
  if (name.length < 3 || name.length > 50) {
    return { valid: false, error: 'Nombre entre 3 y 50 caracteres' };
  }
  if (!/^[a-záéíóúñ\s]+$/i.test(name)) {
    return { valid: false, error: 'El nombre contiene caracteres inválidos' };
  }
  return { valid: true };
}

/**
 * Sanitiza un string para prevenir XSS
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Escapa HTML para mostrar en el DOM
 */
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== HASHING SIMPLE (para demostración) =====
// EN PRODUCCIÓN: Usar bcryptjs o backend

/**
 * Hash simple para demostración (NO usar en producción real)
 * En producción usar bcryptjs o hacer el hash en el backend
 */
async function hashPassword(password) {
  // Convertir a Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Hacer SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convertir a hex
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Compara contraseña con hash
 */
async function comparePassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// ===== LOCALSTORAGE CON ERROR HANDLING =====

function getFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error leyendo ${key}:`, e);
    return defaultValue;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Error guardando ${key}:`, e);
    showToast('Error al guardar datos. Intenta de nuevo.', 'error');
    return false;
  }
}

function clearStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Error eliminando ${key}:`, e);
    return false;
  }
}

// ===== TOAST NOTIFICATIONS =====

/**
 * Muestra una notificación toast mejorada
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duración en ms (default: 5000)
 */
function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  const titles = {
    success: 'Éxito',
    error: 'Error',
    info: 'Información',
    warning: 'Advertencia'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '📢'}</div>
    <div class="toast-content">
      <div class="toast-title">${titles[type] || 'Notificación'}</div>
      <div class="toast-message">${escapeHTML(message)}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove();">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Auto-remove después del duration
  const timeoutId = setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'slideOutDown 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
  
  // Click en close button
  toast.querySelector('.toast-close').onclick = () => {
    clearTimeout(timeoutId);
    toast.style.animation = 'slideOutDown 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  };
}

// ===== LOADING OVERLAY =====

function showLoading(text = 'Cargando...') {
  const overlay = document.getElementById('loading-overlay');
  const textEl = overlay.querySelector('.loading-text');
  textEl.textContent = text;
  overlay.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ===== CONFIRMACIÓN PERSONALIZADA =====

/**
 * Modal de confirmación personalizado
 * @param {string} message - Mensaje a mostrar
 * @param {function} callback - Función a ejecutar si confirma
 * @param {boolean} isDangerous - Si es una acción peligrosa (muestra advertencia)
 * @param {string} title - Título del modal
 */
function showConfirm(message, callback, isDangerous = false, title = 'Confirmar Acción') {
  const modal = document.getElementById('modal-confirm');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const warningEl = document.getElementById('confirm-warning');
  const acceptBtn = document.getElementById('confirm-accept');
  
  titleEl.textContent = title;
  msgEl.textContent = message;
  warningEl.style.display = isDangerous ? 'block' : 'none';
  
  acceptBtn.className = isDangerous ? 'btn-danger' : 'btn-primary';
  
  // Limpiar listener anterior
  const newAcceptBtn = acceptBtn.cloneNode(true);
  acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
  
  newAcceptBtn.onclick = () => {
    closeModal('modal-confirm');
    callback();
  };
  
  modal.classList.remove('hidden');
}

// ===== AUDITORÍA =====

/**
 * Registra una acción en el log de auditoría
 */
function logAudit(action, details = {}) {
  const registro = {
    timestamp: new Date().toISOString(),
    usuario: currentUser || 'anonymous',
    accion: action,
    detalles: details
  };
  
  auditLog.push(registro);
  
  // Mantener solo últimos 1000 registros
  if (auditLog.length > 1000) {
    auditLog = auditLog.slice(-1000);
  }
  
  saveToStorage('insc_audit_log', auditLog);
  console.log('📋 Auditoría:', registro);
}

// ===== MODAL HELPERS =====

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// ===== PÁGINA NAVIGATION =====

function showPage(pageId) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
  });
  
  // Mostrar la seleccionada
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
  }
  
  // Scroll al top
  window.scrollTo(0, 0);
}

// ===== FORMATEO =====

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// ===== DESCARGA CSV =====

function downloadCSV(filename, data) {
  const csv = data.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===== API HELPER =====

async function apiCall(method, path, body = null) {
  const token = localStorage.getItem('prode_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json();

  if (res.status === 401) {
    localStorage.removeItem('prode_token');
    localStorage.removeItem('prode_user');
    showPage('page-login');
    throw new Error('Sesión expirada');
  }

  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ===== INICIALIZACIÓN =====

console.log('✅ Utils.js cargado');
