#!/usr/bin/env bash
# ======================================================================
# nginx/generate-certs.sh — self-signed certificate generator (dev)
# ======================================================================
# Generates a CA + server certificate pair valid for localhost.
# Idempotent: skips if files already exist unless --force (-f).
# ======================================================================
set -euo pipefail

CERTS_DIR="$(cd "$(dirname "$0")" && pwd)/certs"
CA_KEY="$CERTS_DIR/ca.key"
CA_CERT="$CERTS_DIR/ca.crt"
SRV_KEY="$CERTS_DIR/server.key"
SRV_CRT="$CERTS_DIR/server.crt"
DAYS="${1:-365}"

force=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -f|--force) force=true; shift ;;
        [0-9]*) DAYS="$1"; shift ;;
        *) echo "Unrecognized option: $1"; exit 1 ;;
    esac
done

should_generate=false
for f in "$CA_KEY" "$CA_CERT" "$SRV_KEY" "$SRV_CRT"; do
    if [[ ! -f "$f" ]]; then
        should_generate=true
        break
    fi
done

if $force; then
    should_generate=true
fi

if $should_generate; then
    echo "[certs] Generating self-signed certificates in $CERTS_DIR ($DAYS days)"
    mkdir -p "$CERTS_DIR"

    # 1. Create CA key + certificate
    openssl genrsa -out "$CA_KEY" 2048 >/dev/null 2>&1
    openssl req -x509 \
        -new -nodes \
        -key "$CA_KEY" \
        -sha256 -days "$DAYS" \
        -subj "/CN=Local Dev CA" \
        -out "$CA_CERT" \
        >/dev/null 2>&1

    # 2. Create server key + CSR with SAN for localhost
    openssl genrsa -out "$SRV_KEY" 2048 >/dev/null 2>&1

    cat > /tmp/cert-ext.cnf <<EXT
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = req_ext

[dn]
CN = localhost

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1  = 127.0.0.1
EXT

    openssl req -new \
        -key "$SRV_KEY" \
        -out /tmp/server.csr \
        -config /tmp/cert-ext.cnf \
        >/dev/null 2>&1

    # 3. Sign server cert with CA (same-key self-sign for dev simplicity)
    openssl x509 -req \
        -in /tmp/server.csr \
        -CA "$CA_CERT" \
        -CAkey "$CA_KEY" \
        -CAcreateserial \
        -out "$SRV_CRT" \
        -days "$DAYS" \
        -sha256 \
        -extfile /tmp/cert-ext.cnf \
        -extensions req_ext \
        >/dev/null 2>&1

    rm -f /tmp/server.csr /tmp/cert-ext.cnf /tmp/ca.srl

    echo "[certs] ✓ Certificates generated successfully"
    echo "     CA cert   : $CA_CERT"
    echo "     Server crt: $SRV_CRT"
    echo "     Server key: $SRV_KEY"
    echo ""
    echo "[certs] ⚠ These are SELF-SIGNED certificates for development only."
    echo "     Browsers will show a security warning — proceed manually."
else
    echo "[certs] Certificates already exist — skipping generation."
    echo "     Pass -f to force regeneration."
fi
