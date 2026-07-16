# Requirements — Cybersecurity Audit Implementation

## Context
The user has a cybersecurity audit report for the `where-is-my-model` project and wants ALL security improvements implemented sequentially, following the prioritized list below.

## Prioritized Security Tasks

### Inmediato (Crítico)
1. **MongoDB con autenticación** — usuario + contraseña en la URI
2. **JWT_SECRET fuerte y fuera del repo** — generar con `openssl rand -base64 64`, inyectar como env var
3. **Rate limiting en /login y /register** — `express-rate-limit`
4. **Helmet.js en el backend** — headers de seguridad mínimos
5. **Mover .env.development fuera del repo** — o al menos el secret

### Corto plazo (Alto)
6. **httpOnly cookies en lugar de localStorage para el JWT**
7. **HTTPS/TLS con reverse proxy en producción**
8. **CSP + HSTS en nginx**
9. **Validación de fuerza de contraseña**
10. **Eliminar debug logs y usar logger con niveles**
11. **Healthcheck en frontend/backend contenedores**
12. **SSRF protection en healthChecker (whitelist de IPs/redes)**
13. **Usuario no-root en Dockerfiles**

### Medio plazo (Medio)
14. **Token refresh mechanism** (access + refresh tokens)
15. **Email en el modelo User + verificación**
16. **Backups automatizados de MongoDB**
17. **Request ID tracking para auditoría**
18. **Logs estructurados con winston/pino**
19. **Mongoose transactions para operaciones de GPU cap atómicas**
20. **Seed script para admin inicial en lugar de first-user-is-admin**

### Largo plazo
21. **2FA / MFA para cuentas admin**
22. **Audit logging de todas las acciones críticas**
23. **API versioning (/api/v1/...)**
24. **Input sanitización contra log injection**
25. **Security headers completos con Permissions-Policy**

## Constraints
- No TypeScript, no test suite, no CI
- ESM modules
- Docker Compose for running
- Must follow repo conventions from AGENTS.md
- Each task must be implemented, tested, and verified before moving to next
- User must confirm after each task before proceeding