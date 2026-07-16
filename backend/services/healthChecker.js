import net from 'net';
import { resolveAndValidate } from '../middleware/ssrfProtection.js';

/* ------------------------------------------------------------------ */
/*  checkHttpEndpoint — HTTP GET probe against a specific endpoint    */
/*  Builds URL as protocol://host:port/endpoint and uses native        */
/*  fetch() with a 3-second timeout. Returns true if status is         */
/*  between 200 and 399 (inclusive). No external dependencies.         */
/* ------------------------------------------------------------------ */

async function checkHttpEndpoint(host, port, endpoint, protocol) {
  try {
    const url = `${protocol}://${host}:${port}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.status >= 200 && response.status < 400;
  } catch (err) {
    console.warn(
      `[health] http:${protocol}://${host}:${port}${endpoint}` +
      ` ${err.code ?? err.message}`
    );
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  checkServiceStatus — single-port TCP probe (+ optional HTTP)       */
/*  Opens a TCP socket to { host, port } with a 3-second timeout.     */
/*  If endpoint is provided, also validates via HTTP GET.             */
/*  Resolves to { port, status: 'up' | 'down' }.                      */
/*  No external dependencies.                                        */
/* ------------------------------------------------------------------ */

function checkServiceStatus(host, port, endpoint, protocol) {
  return new Promise((resolve) => {
    /* --- Pre-connection SSRF guard (DNS + IP validation) --------- */
    resolveAndValidate(host).then(({ allowed, ip }) => {
      if (!allowed) {
        resolve({ port, status: 'down' });
        return;
      }

      /* Use the resolved IP for the actual TCP connection           */
      /* (prevents DNS rebinding between validation and connect).    */
      const socket = net.createConnection({ host: ip ?? host, port }, async () => {
        socket.destroy();

        /* TCP succeeded — if no endpoint, immediately report 'up' */
        if (!endpoint) {
          resolve({ port, status: 'up' });
          return;
        }

        /* Two-tier check: validate HTTP response                   */
        const httpOk = await checkHttpEndpoint(ip ?? host, port, endpoint, protocol || 'http');
        resolve({ port, status: httpOk ? 'up' : 'down' });
      });

      socket.setTimeout(3000);

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ port, status: 'down' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        if (err.code !== 'ECONNRESET') {
          console.warn(
            `[health] port:${port} host="${host}" ip="${ip ?? 'unknown'}" ${err.code ?? err.message}`
          );
        }
        resolve({ port, status: 'down' });
      });
    });
  });
}

/* ------------------------------------------------------------------ */
/*  checkPcServices — iterate embedded servicios on a single PC       */
/*  Uses the PC-level `ip` as the TCP host (services currently have   */
/*  no per-service `host` field in the schema). Services that lack    */
/*  both an explicit `host` override and a resolvable PC ip are      */
/*  skipped.                                                         */
/* ------------------------------------------------------------------ */

function checkPcServices(pcDoc) {
  const fallbackHost = pcDoc.ip ?? pcDoc.nombre;

  const servicios = Array.isArray(pcDoc.servicios) ? pcDoc.servicios : [];

  const checks = servicios.map((svc, idx) => {
    const host = svc.host ?? fallbackHost;
    const port = svc.puerto ?? svc.port;
    const endpoint = svc.endpoint ?? null;
    const protocol = svc.protocol ?? 'http';

    if (!host || !port || typeof port !== 'number') {
      return Promise.resolve({ index: idx, status: 'down', reason: 'missing-host-or-port' });
    }

    return checkServiceStatus(host, port, endpoint, protocol).then((result) => ({
      index: idx,
      nombre: svc.nombre ?? `service[${idx}]`,
      puerto: result.port,
      status: result.status,
    }));
  });

  return Promise.allSettled(checks).then((results) => {
    const services = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { index: r.reason?.index ?? -1, status: 'down', reason: 'check-errored' }
    );
    return {
      pcId: pcDoc._id?.toString() ?? pcDoc.id ?? null,
      id: pcDoc.id ?? null,
      services,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  checkAllServices — parallel health check across a fleet of PCs    */
/*  All PC checks run concurrently. Individual misbehaviour does not   */
/*  abort the overall sweep.                                          */
/* ------------------------------------------------------------------ */

function checkAllServices(pcsArray) {
  if (!Array.isArray(pcsArray)) {
    return Promise.resolve([]);
  }

  const promises = pcsArray.map((pc, idx) => {
    try {
      return checkPcServices(pc).then((result) => ({ ...result, pcDocIndex: idx }));
    } catch (err) {
      return Promise.resolve({
        pcId: pc?._id?.toString() ?? null,
        id: null,
        services: [],
        error: err.message,
        pcDocIndex: idx,
      });
    }
  });

  return Promise.allSettled(promises).then((results) =>
    results.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { pcId: null, services: [], error: r.reason?.message ?? 'unknown' }
    )
  );
}

/* ------------------------------------------------------------------ */
/*  Exports                                                           */
/* ------------------------------------------------------------------ */

export { checkHttpEndpoint, checkServiceStatus, checkPcServices, checkAllServices };
