# Seguridad — Login y contraseñas

Revisión de las medidas de seguridad aplicadas al login y al manejo de contraseñas.

---

## Backend

### Login (`POST /api/auth/login`)

| Medida | Implementación |
|--------|----------------|
| **Rate limiting** | 10 intentos por 15 minutos (`index.js` → `loginLimiter`). |
| **Email** | Normalizado (trim + minúsculas). Validación de formato con regex antes de consultar DB. |
| **Contraseña** | Longitud máxima 256 caracteres para evitar payloads abusivos. |
| **Respuesta** | Mismo mensaje genérico ("Credenciales inválidas") para usuario inexistente o contraseña incorrecta (evita enumeración de usuarios). |
| **Hash** | Verificación con `bcrypt.compare` (constante en tiempo). |
| **Tokens** | Access token (JWT, 15 min) en cuerpo; refresh token (JWT, 7 días) en cookie `httpOnly`. |
| **Auditoría** | Registro de acción `LOGIN` en audit log. |

### Refresh (`POST /api/auth/refresh`)

| Medida | Implementación |
|--------|----------------|
| **Rate limiting** | 30 intentos por 5 minutos. |
| **Cookie** | Solo lectura desde cookie `refreshToken` (path `/api/auth`). |
| **Rotación** | Tras cada refresh se revoca el token anterior (Redis blacklist) y se emite uno nuevo. |
| **Usuario** | Se comprueba que el usuario siga activo antes de emitir nuevos tokens. |

### Cambio de contraseña (`PUT /api/auth/password`)

| Medida | Implementación |
|--------|----------------|
| **Autenticación** | Ruta protegida con `authMiddleware` (Bearer token). |
| **Rate limiting** | 5 intentos por hora (`passwordLimiter` en `/api/auth/password`). |
| **Contraseña actual** | Se exige y se verifica con `bcrypt.compare`. |
| **Nueva contraseña** | Mínimo 8 caracteres, máximo 256. Hash con `bcrypt.hash(..., 12)`. |
| **Post-cambio** | Se revoca el refresh token actual y se limpia la cookie; el cliente debe volver a iniciar sesión. |
| **Auditoría** | Acción `CHANGE_PASSWORD` registrada. |

### Cookies

| Opción | Producción | Desarrollo |
|--------|------------|------------|
| `httpOnly` | ✓ | ✓ (no accesible desde JS) |
| `secure` | ✓ | No (HTTP) |
| `sameSite` | `strict` | `lax` |
| `path` | `/api/auth` | Idem (solo se envía a rutas de auth) |
| `maxAge` | 7 días | 7 días |

### JWT

- **Access:** `JWT_SECRET`, expiración 15 min; solo en memoria en el frontend (no en `localStorage`).
- **Refresh:** `JWT_REFRESH_SECRET`, expiración 7 días; solo en cookie.
- Secretos obligatorios al arrancar (`JWT_SECRET` y `JWT_REFRESH_SECRET` en env).

### Seed (usuario inicial)

- Contraseña desde `INITIAL_ADMIN_PASSWORD` (env). Si no se define, se usa `ChangeMe123!` (solo para desarrollo; en producción debe definirse).
- Hash con `bcrypt.hash(..., 12)`.

---

## Frontend

- **Credenciales:** Enviadas por POST con `withCredentials: true` (cookie de refresh incluida).
- **Access token:** Guardado solo en memoria del módulo (`api.js`); no se persiste en `localStorage` ni `sessionStorage` (reduce riesgo XSS).
- **Refresh:** Si el access token expira (401), el cliente intenta una sola vez `/api/auth/refresh` con la cookie; si falla, se limpia el token y se redirige a `/login`.

---

## Checklist rápido

- [ ] En producción: `NODE_ENV=production`, `FRONTEND_URL=https://whatsend.app`.
- [ ] Cookies con `secure` y `sameSite: strict` (automático si `NODE_ENV=production`).
- [ ] HTTPS en frontend y API (Nginx + Certbot).
- [ ] `JWT_SECRET` y `JWT_REFRESH_SECRET` fuertes y distintos; nunca en el repo.
- [ ] `INITIAL_ADMIN_PASSWORD` definido en el servidor antes del primer seed.
- [ ] Redis disponible para blacklist de refresh tokens (revocación y rotación).
