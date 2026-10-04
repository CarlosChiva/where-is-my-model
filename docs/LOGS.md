# LOGS

## [2026-10-04] Task ADHOC — Corregir `getPcId()` en `services.js` + actualizar `AGENTS.md` con rutas versionadas
Resumen: Corregido el helper `getPcId()` en `backend/routes/services.js` (regex rota sobre `req.baseUrl` + fallback `req.params.pcid` → `req.params.pcId` con `mergeParams: true` en el router, load-bearing en Express 4) para el mount versionado `/api/v1/pcs/:pcId/services`; actualizada la sección "Architecture notes" de `AGENTS.md` con las rutas versionadas y las líneas correctas de `server.js` (205/216). Señalado (no corregido, fuera de scope) que `backend/middleware/validation.js` `extractPcId()` replica el mismo patrón roto y sigue rompiendo POST/PUT en el middleware.
Ficheros: backend/routes/services.js, AGENTS.md, docs/documentation/backend/routes.md
Ciclos de revisión: 1

## [2026-10-04] Task ADHOC — Task A: corregir `extractPcId()` en `validation.js` (404 "PC not found" en POST/PUT de servicios)
Resumen: Corregido `extractPcId()` en `backend/middleware/validation.js` (regex rota sobre `req.baseUrl` + fallback a claves inexistentes `req.params.pciId`/`req.params[':pciId']` → `return req.params.pcId;` vía `mergeParams: true` en el mount versionado `/api/v1/pcs/:pcId/services`) y actualizado su comentario de cabecera obsoleto; verificado en runtime (backend restarteado vía compose) que POST/PUT con body inválido ahora devuelven 400 de validación en vez de 404 "PC not found", el 404 legítimo (pcId inexistente en DB) se conserva y GET sin regresión. Actualizada `docs/documentation/backend/middleware.md` (entrada `extractPcId`, rutas versionadas y sección de cambios).
Ficheros: backend/middleware/validation.js, docs/documentation/backend/middleware.md
Ciclos de revisión: 1
