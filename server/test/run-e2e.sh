#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  E2E Test Runner
#
#  Starts the NestJS server on port 3001 using the TEST database
#  (.env.test), runs universal-e2e.mjs, then shuts down the server.
#
#  Usage:  bash test/run-e2e.sh [-- --flash --flash-users=1000 ...]
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_TEST="$SERVER_DIR/.env.test"
TEST_PORT=3001
BASE_URL="http://localhost:$TEST_PORT"
SERVER_PID=""

# ── Cleanup on exit ──
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "🧹  Stopping test server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# ── Verify .env.test exists ──
if [ ! -f "$ENV_TEST" ]; then
  echo "❌  Missing $ENV_TEST — create it with test DB credentials."
  exit 1
fi

# ── Build the server ──
echo "🔨  Building server..."
cd "$SERVER_DIR"
npm run build --silent 2>&1

# ── Start server with test env ──
echo "🚀  Starting test server on port $TEST_PORT (test DB)..."

# Load .env.test and export all vars
set -a
source "$ENV_TEST"
set +a
export PORT=$TEST_PORT
export THROTTLE_DISABLED=true

node dist/src/main.js &
SERVER_PID=$!

# ── Wait for server to be ready ──
echo "⏳  Waiting for server to be ready..."
MAX_WAIT=30
WAITED=0
while ! curl -sf "$BASE_URL/api" > /dev/null 2>&1; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "❌  Server did not start within ${MAX_WAIT}s"
    exit 1
  fi
done
echo "✅  Server ready (took ${WAITED}s)"

# ── Run E2E tests ──
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Running Universal E2E Tests against TEST DB"
echo "═══════════════════════════════════════════════════"
echo ""

node "$SCRIPT_DIR/universal-e2e.mjs" "$BASE_URL" "$@"
TEST_EXIT=$?

echo ""
if [ $TEST_EXIT -eq 0 ]; then
  echo "✅  E2E tests passed!"
else
  echo "❌  E2E tests failed (exit code $TEST_EXIT)"
fi

exit $TEST_EXIT
