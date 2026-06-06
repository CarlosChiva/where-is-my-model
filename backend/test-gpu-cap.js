/**
 * GPU Cap Validation — Integration Verification Script (Node.js)
 *
 * Verifies that the backend correctly enforces sum(services[].gpu) <= pc.vram.
 *
 * Tests performed:
 *   1. Create a PC with 24 GB VRAM
 *   2. Add a 16 GB GPU service (should succeed — 16 <= 24)
 *   3. Add a 12 GB GPU service (should FAIL — 16 + 12 = 28 > 24)
 *   4. Verify PC still has exactly 1 service after rejection
 *   5. Add an 8 GB GPU service (should succeed — 16 + 8 = 24, exactly at cap)
 *   6. Try adding a 1 GB GPU service (should FAIL — 24 + 1 = 25 > 24)
 *   7. Final state verification (2 services, totalGpu = 24)
 *   8. Clean up by deleting the test PC
 *
 * Requirements: Node.js 18+ (built-in fetch)
 * Usage:       node test-gpu-cap.js [BASE_URL]
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.argv[2] || 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function assert(condition, description) {
  if (condition) {
    passCount++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m — ${description}`);
  } else {
    failCount++;
    console.log(`  \x1b[31m✘ FAIL\x1b[0m — ${description}`);
  }
}

function header(text) {
  console.log('');
  console.log('\x1b[36m────────────────────────────────────────────────────────\x1b[0m');
  console.log(`\x1b[1m  ${text}\x1b[0m`);
  console.log('\x1b[36m────────────────────────────────────────────────────────\x1b[0m');
}

// ---------------------------------------------------------------------------
// HTTP helper — returns { status, body }
// ---------------------------------------------------------------------------

async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== null) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // body may not be JSON on error
  }
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// Cleanup — store PC ID so we can delete on exit
// ---------------------------------------------------------------------------

let pcId = null;

async function cleanup() {
  if (pcId) {
    console.log(`\n\x1b[33mCleaning up: deleting test PC ${pcId}...\x1b[0m`);
    try {
      const { status } = await api('DELETE', `/pcs/${pcId}`);
      if (status === 200) {
        console.log('\x1b[33m  ✔ Test PC deleted.\x1b[0m');
      } else {
        console.log(`\x1b[33m  ⚠ Could not delete test PC (HTTP ${status}). Clean up manually.\x1b[0m`);
      }
    } catch (err) {
      console.log(`\x1b[33m  ⚠ Cleanup error: ${err.message}\x1b[0m`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main test sequence
// ---------------------------------------------------------------------------

async function run() {
  try {
    // ----- 1. Create a PC with 24 GB VRAM ----------------------------------
    header('1. Create a PC with 24 GB VRAM');

    const createRes = await api('POST', '/pcs', {
      nombre: 'GPU-Cap-Test-Node',
      ip: '10.0.99.2',
      vram: 24,
    });

    assert(
      createRes.status === 201 && createRes.body?.success === true,
      `PC created (HTTP ${createRes.status}, success=${createRes.body?.success})`
    );

    pcId = createRes.body?.data?._id;
    if (!pcId) {
      console.error('  ✘ Cannot continue without a PC ID. Aborting.');
      return;
    }

    // ----- 2. Add 16 GB service (should succeed) ---------------------------
    header('2. Add 16 GB GPU service (16 <= 24, expect success)');

    const svc16 = await api('POST', `/pcs/${pcId}/services`, {
      nombre: 'ollama-inference',
      puerto: 11434,
      gpu: 16,
    });

    assert(
      svc16.status === 201 && svc16.body?.success === true,
      `16 GB service added (HTTP ${svc16.status})`
    );

    // ----- 3. Add 12 GB service (should FAIL — 16 + 12 = 28 > 24) --------
    header('3. Add 12 GB GPU service (16 + 12 = 28 > 24, expect REJECTED)');

    const svc12 = await api('POST', `/pcs/${pcId}/services`, {
      nombre: 'comfyui-stable',
      puerto: 8188,
      gpu: 12,
    });

    assert(
      svc12.status === 400 && svc12.body?.success === false,
      `12 GB service correctly rejected (HTTP ${svc12.status}, success=${svc12.body?.success})`
    );

    // ----- 4. Verify PC still has exactly 1 service -------------------------
    header('4. Verify PC still has exactly 1 service after rejection');

    const check1 = await api('GET', `/pcs/${pcId}`);
    const count1 = check1.body?.data?.servicios?.length ?? -1;

    assert(
      count1 === 1,
      `PC has exactly 1 service (rejection did not mutate state) — found ${count1}`
    );

    // ----- 5. Add 8 GB service (should succeed — 16 + 8 = 24) -------------
    header('5. Add 8 GB GPU service (16 + 8 = 24 = VRAM, exact cap, expect success)');

    const svc8 = await api('POST', `/pcs/${pcId}/services`, {
      nombre: 'webui-small',
      puerto: 7860,
      gpu: 8,
    });

    assert(
      svc8.status === 201 && svc8.body?.success === true,
      `8 GB service added — total now 24/24 (HTTP ${svc8.status})`
    );

    // ----- 6. Try 1 more GB (should FAIL — 24 + 1 = 25 > 24) --------------
    header('6. Add 1 GB GPU service (24 + 1 = 25 > 24, expect REJECTED)');

    const svc1 = await api('POST', `/pcs/${pcId}/services`, {
      nombre: 'monitoring-agent',
      puerto: 9090,
      gpu: 1,
    });

    assert(
      svc1.status === 400 && svc1.body?.success === false,
      `1 GB service correctly rejected (total would be 25 > 24)`
    );

    // ----- 7. Final state verification -------------------------------------
    header('7. Final state verification');

    const final = await api('GET', `/pcs/${pcId}`);
    const finalCount = final.body?.data?.servicios?.length ?? -1;
    const finalTotal = (final.body?.data?.servicios ?? []).reduce((sum, svc) => sum + (svc.gpu ?? 0), 0);

    assert(
      finalCount === 2 && finalTotal === 24,
      `PC has 2 services with totalGpu = 24 — found ${finalCount} services / totalGpu ${finalTotal}`
    );
  } finally {
    // Always clean up
    await cleanup();
  }

  // ----- Summary -----------------------------------------------------------
  console.log('');
  console.log('\x1b[36m══════════════════════════════════════════════════════════\x1b[0m');
  console.log(
    `\x1b[1m  Results: \x1b[32m${passCount} passed\x1b[0m\x1b[1m, ` +
    `\x1b[31m${failCount} failed\x1b[0m\x1b[1m out of ${passCount + failCount} tests\x1b[0m`
  );
  console.log('\x1b[36m══════════════════════════════════════════════════════════\x1b[0m');

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
