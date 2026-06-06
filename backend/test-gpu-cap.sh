#!/usr/bin/env bash
# =============================================================================
# GPU Cap Validation — Integration Verification Script
# =============================================================================
# Verifies that the backend correctly enforces sum(services[].gpu) <= pc.vram.
#
# Tests performed:
#   1. Create a PC with 24 GB VRAM
#   2. Add a 16 GB GPU service (should succeed — 16 <= 24)
#   3. Add a 12 GB GPU service (should FAIL — 16 + 12 = 28 > 24)
#   4. Verify PC still has exactly 1 service after rejection
#   5. Add an 8 GB GPU service (should succeed — 16 + 8 = 24, exactly at cap)
#   6. Try adding a 1 GB GPU service (should FAIL — 24 + 1 = 25 > 24)
#   7. Clean up by deleting the test PC
#
# Requirements: curl, jq
# Usage:       ./test-gpu-cap.sh [BASE_URL]
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:8080/api}"

# --- Colours ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# --- Counters ----------------------------------------------------------------
PASS=0
FAIL=0
TOTAL=0

# --- Helpers -----------------------------------------------------------------
pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${GREEN}✔ PASS${RESET} — $1"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${RED}✘ FAIL${RESET} — $1"
}

step() {
  echo ""
  echo -e "${CYAN}────────────────────────────────────────────────────────${RESET}"
  echo -e "${BOLD}  $1${RESET}"
  echo -e "${CYAN}────────────────────────────────────────────────────────${RESET}"
}

# --- Cleanup trap -----------------------------------------------------------
cleanup() {
  if [ -n "${PC_ID:-}" ]; then
    echo ""
    echo -e "${YELLOW}Cleaning up: deleting test PC ${PC_ID}...${RESET}"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "${BASE_URL}/pcs/${PC_ID}")
    if [ "$HTTP_CODE" = "200" ]; then
      echo -e "${YELLOW}  ✔ Test PC deleted.${RESET}"
    else
      echo -e "${YELLOW}  ⚠ Could not delete test PC (HTTP ${HTTP_CODE}). Clean up manually.${RESET}"
    fi
  fi
}
trap cleanup EXIT

# =============================================================================
# Test 1 — Create a PC with 24 GB VRAM
# =============================================================================
step "1. Create a PC with 24 GB VRAM"

PC_RESPONSE=$(curl -s -X POST "${BASE_URL}/pcs" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "GPU-Cap-Test-Node",
    "ip": "10.0.99.1",
    "vram": 24
  }')

PC_SUCCESS=$(echo "$PC_RESPONSE" | jq -r '.success')
if [ "$PC_SUCCESS" = "true" ]; then
  PC_ID=$(echo "$PC_RESPONSE" | jq -r '.data._id')
  pass "PC created with ID ${PC_ID} (24 GB VRAM)"
else
  fail "Failed to create test PC"
  echo "$PC_RESPONSE" | jq .
  exit 1
fi

# =============================================================================
# Test 2 — Add a 16 GB GPU service (should succeed)
# =============================================================================
step "2. Add 16 GB GPU service (16 <= 24, expect success)"

SVC_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/pcs/${PC_ID}/services" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "ollama-inference",
    "puerto": 11434,
    "gpu": 16
  }')

SVC_HTTP=$(echo "$SVC_RESPONSE" | tail -1)
SVC_BODY=$(echo "$SVC_RESPONSE" | sed '$d')
SVC_SUCCESS=$(echo "$SVC_BODY" | jq -r '.success')

if [ "$SVC_HTTP" = "201" ] && [ "$SVC_SUCCESS" = "true" ]; then
  pass "16 GB service added (HTTP 201)"
else
  fail "Expected HTTP 201, got HTTP ${SVC_HTTP}"
fi

# =============================================================================
# Test 3 — Add a 12 GB GPU service (should be REJECTED — 16 + 12 = 28 > 24)
# =============================================================================
step "3. Add 12 GB GPU service (16 + 12 = 28 > 24, expect REJECTED)"

OVER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/pcs/${PC_ID}/services" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "comfyui-stable",
    "puerto": 8188,
    "gpu": 12
  }')

OVER_HTTP=$(echo "$OVER_RESPONSE" | tail -1)
OVER_BODY=$(echo "$OVER_RESPONSE" | sed '$d')
OVER_SUCCESS=$(echo "$OVER_BODY" | jq -r '.success')

if [ "$OVER_HTTP" = "400" ] && [ "$OVER_SUCCESS" = "false" ]; then
  pass "12 GB service correctly rejected (HTTP 400)"
else
  fail "Expected HTTP 400, got HTTP ${OVER_HTTP} (success=${OVER_SUCCESS})"
fi

# =============================================================================
# Test 4 — Verify PC still has exactly 1 service
# =============================================================================
step "4. Verify PC still has exactly 1 service after rejection"

CHECK_RESPONSE=$(curl -s "${BASE_URL}/pcs/${PC_ID}")
SERVICE_COUNT=$(echo "$CHECK_RESPONSE" | jq '.data.servicios | length')

if [ "$SERVICE_COUNT" = "1" ]; then
  pass "PC has exactly 1 service (rejection did not mutate state)"
else
  fail "Expected 1 service, found ${SERVICE_COUNT}"
fi

# =============================================================================
# Test 5 — Add an 8 GB GPU service (should succeed — 16 + 8 = 24, exact cap)
# =============================================================================
step "5. Add 8 GB GPU service (16 + 8 = 24 = VRAM, exact cap, expect success)"

EXACT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/pcs/${PC_ID}/services" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "webui-small",
    "puerto": 7860,
    "gpu": 8
  }')

EXACT_HTTP=$(echo "$EXACT_RESPONSE" | tail -1)
EXACT_BODY=$(echo "$EXACT_RESPONSE" | sed '$d')
EXACT_SUCCESS=$(echo "$EXACT_BODY" | jq -r '.success')

if [ "$EXACT_HTTP" = "201" ] && [ "$EXACT_SUCCESS" = "true" ]; then
  pass "8 GB service added (total now 24/24, HTTP 201)"
else
  fail "Expected HTTP 201, got HTTP ${EXACT_HTTP}"
fi

# =============================================================================
# Test 6 — Try adding 1 more GB (should be REJECTED — 24 + 1 = 25 > 24)
# =============================================================================
step "6. Add 1 GB GPU service (24 + 1 = 25 > 24, expect REJECTED)"

ONE_OVER=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/pcs/${PC_ID}/services" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "monitoring-agent",
    "puerto": 9090,
    "gpu": 1
  }')

ONE_OVER_HTTP=$(echo "$ONE_OVER" | tail -1)
ONE_OVER_BODY=$(echo "$ONE_OVER" | sed '$d')
ONE_OVER_SUCCESS=$(echo "$ONE_OVER_BODY" | jq -r '.success')

if [ "$ONE_OVER_HTTP" = "400" ] && [ "$ONE_OVER_SUCCESS" = "false" ]; then
  pass "1 GB service correctly rejected (total would be 25 > 24)"
else
  fail "Expected HTTP 400, got HTTP ${ONE_OVER_HTTP} (success=${ONE_OVER_SUCCESS})"
fi

# =============================================================================
# Test 7 — Final state verification (should have 2 services, total GPU = 24)
# =============================================================================
step "7. Final state verification"

FINAL_RESPONSE=$(curl -s "${BASE_URL}/pcs/${PC_ID}")
FINAL_COUNT=$(echo "$FINAL_RESPONSE" | jq '.data.servicios | length')
FINAL_TOTAL=$(echo "$FINAL_RESPONSE" | jq '[.data.servicios[].gpu] | add // 0')

if [ "$FINAL_COUNT" = "2" ] && [ "$FINAL_TOTAL" = "24" ]; then
  pass "PC has 2 services with totalGpu = 24 (matches VRAM cap)"
else
  fail "Expected 2 services / totalGpu 24, got ${FINAL_COUNT} services / totalGpu ${FINAL_TOTAL}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Results: ${GREEN}${PASS} passed${RESET}${BOLD}, ${RED}${FAIL} failed${RESET}${BOLD} out of ${TOTAL} tests${RESET}"
echo -e "${CYAN}══════════════════════════════════════════════════════════${RESET}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
