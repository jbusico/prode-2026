# PRODE Copa Mundial 2026

App de pronósticos para el Mundial 2026. Frontend vanilla JS + backend Express + MongoDB Atlas.

## Correr localmente

```bash
pnpm dev        # arranca el servidor en http://localhost:3001
pnpm start      # modo producción
```

Cuenta admin por defecto (se crea sola al arrancar): **DNI 11222333 / Pass 11222333**

## Stack

- **Frontend:** HTML/CSS/JS vanilla en `frontend/` — sin framework
- **Backend:** Express.js (`api/server.js`), puerto 3001 sirve también el frontend
- **DB:** MongoDB Atlas — URI en `.env`
- **Auth:** JWT 30 días, token en `localStorage` como `prode_token`
- **Package manager:** pnpm

## Archivos clave

```
frontend/
  config.js     — constantes, MATCHES (obj por grupos A-H), PRIZES, vars globales
  utils.js      — apiCall(), validaciones, localStorage helpers, toasts
  app.js        — auth, login/logout, pronósticos, ranking
  app2.js       — panel admin: usuarios, resultados, puntajes, logs
  styles.css    — dark mode, variables CSS en :root

api/
  server.js           — Express + seed admin al conectar MongoDB
  middleware/auth.js  — requireAuth, requireAdmin
  models/User.js      — dni, nombre, email, password(bcrypt), paid, isAdmin, predictions, rifas, saved
  models/Results.js   — singleton {key:'global', results{}, overrides{}}
  routes/auth.js      — POST /login (público), POST /register (requireAdmin)
  routes/users.js     — CRUD usuarios + PUT /:dni/predictions
  routes/results.js   — GET/PUT resultados y overrides de puntos
  routes/predictions.js — GET /ranking
```

## Cosas importantes

- `MATCHES` es un objeto `{grupoA:[...], grupoB:[...]}` — usar `Object.values(MATCHES).flat()` cuando se necesita lista plana
- Los pronósticos se indexan 0-15 (orden de `Object.values(MATCHES).flat()`)
- El log de auditoría vive en `localStorage` del browser, no en la DB
- Dark mode: variables `--fondo`, `--card`, `--card-alt`, `--text` — no usar `background: white` en nuevos componentes
