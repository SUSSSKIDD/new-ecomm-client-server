#!/bin/bash
set -e

echo "=========================================="
echo " Starting Neyokart Blue/Green Deployment  "
echo "=========================================="

APP_DIR="/opt/neyokart"
DOCKER_COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
STATE_FILE="$APP_DIR/active_color.txt"

# .env must exist — it holds all production secrets.
# CI/CD never creates or overwrites it. Create once on the VPS:
#   nano /opt/neyokart/.env   (fill in DATABASE_URL, JWT_SECRET, etc.)
if [ ! -f "$APP_DIR/.env" ]; then
    echo "❌ /opt/neyokart/.env is missing. SSH into the VPS and create it:"
    echo "   nano /opt/neyokart/.env"
    exit 1
fi

# Ensure uploads directory exists and is writable by the container user (uid 1001 = nodeuser).
# Docker mounts /opt/neyokart/uploads → /app/uploads inside the container.
# If the host dir is missing or root-owned, the app crashes with EACCES on startup.
mkdir -p "$APP_DIR/uploads"
chown -R 1001:1001 "$APP_DIR/uploads" 2>/dev/null || true

# Default to blue if no state exists
if [ ! -f "$STATE_FILE" ]; then
    echo "blue" > "$STATE_FILE"
fi

ACTIVE_COLOR=$(cat "$STATE_FILE")

if [ "$ACTIVE_COLOR" = "blue" ]; then
    NEW_COLOR="green"
    NEW_PORT=3002
    OLD_PORT=3001
    NEW_CLIENT=8002
    OLD_CLIENT=8001
else
    NEW_COLOR="blue"
    NEW_PORT=3001
    OLD_PORT=3002
    NEW_CLIENT=8001
    OLD_CLIENT=8002
fi

echo "Current Active: $ACTIVE_COLOR ($OLD_PORT)"
echo "Deploying to:   $NEW_COLOR ($NEW_PORT)"

# ── Step 0: Ensure infrastructure services are running ──────────────────────
# Runs on EVERY deploy. Safe because:
#   - Named volumes (neyokart_redis_data, neyokart_redis_bull_data) are independent
#     of their containers. Data is NEVER deleted by `docker compose up`.
#   - Only `docker compose down -v` or `docker volume rm` deletes volume data —
#     neither command appears anywhere in this script.
#   - If containers are already running and config is unchanged → no-op.
#   - If a container was stopped (e.g. OOM kill) → restarts it, volume remounted.
#   - If config changed (e.g. new Redis image) → recreates container, same volume.
#   - First-ever deploy on a fresh VPS → creates containers + empty volumes.
echo "[0/6] Ensuring infrastructure services (redis, redis-bull)..."
docker compose -f $DOCKER_COMPOSE_FILE up -d redis redis-bull

echo "  Waiting for redis to be healthy..."
REDIS_RETRIES=0
until docker compose -f $DOCKER_COMPOSE_FILE exec -T redis redis-cli ping | grep -q PONG; do
    REDIS_RETRIES=$((REDIS_RETRIES+1))
    if [ $REDIS_RETRIES -ge 15 ]; then
        echo "❌ redis failed to become healthy after 15s. Aborting."
        exit 1
    fi
    sleep 1
done
echo "  ✅ redis healthy"

echo "  Waiting for redis-bull to be healthy..."
BULL_RETRIES=0
until docker compose -f $DOCKER_COMPOSE_FILE exec -T redis-bull redis-cli ping | grep -q PONG; do
    BULL_RETRIES=$((BULL_RETRIES+1))
    if [ $BULL_RETRIES -ge 15 ]; then
        echo "❌ redis-bull failed to become healthy after 15s. Aborting."
        exit 1
    fi
    sleep 1
done
echo "  ✅ redis-bull healthy"


# 1. Build new slot images in parallel using BuildKit
# --no-cache removed: BuildKit layer cache cuts repeat build time significantly.
# DOCKER_BUILDKIT=1 enables parallel stage execution within each Dockerfile.
# --parallel builds server + client simultaneously (independent, no shared layers).
echo "[1/6] Building latest images (parallel, BuildKit)..."
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 \
  docker compose -f $DOCKER_COMPOSE_FILE build --parallel \
  server-$NEW_COLOR client-$NEW_COLOR

# 2. Start the new container in the background
echo "[2/6] Starting $NEW_COLOR containers..."
docker compose -f $DOCKER_COMPOSE_FILE up -d --no-deps server-$NEW_COLOR client-$NEW_COLOR

# 3. Wait for the new backend to be healthy
echo "[3/6] Waiting for server-$NEW_COLOR to become healthy..."
RETRIES=0
MAX_RETRIES=20
HEALTHY=false

while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:$NEW_PORT/health > /dev/null; then
        HEALTHY=true
        break
    fi
    echo "  Waiting for HTTP 200... ($RETRIES/$MAX_RETRIES)"
    sleep 3
    RETRIES=$((RETRIES+1))
done

if [ "$HEALTHY" = false ]; then
    echo "❌ Deployment Failed: $NEW_COLOR failed to become healthy. Rolling back."
    docker compose -f $DOCKER_COMPOSE_FILE stop server-$NEW_COLOR client-$NEW_COLOR
    exit 1
fi
echo "✅ $NEW_COLOR is healthy!"

# 4. Reload Nginx to perform the Zero-Downtime Swap
echo "[4/6] Swapping Nginx upstream to port $NEW_PORT (Server) and $NEW_CLIENT (Client)..."
# More robust regex that matches either 127.0.0.1 or localhost
sudo sed -i "s/\(127\.0\.0\.1\|localhost\):$OLD_PORT/\1:$NEW_PORT/g" /etc/nginx/sites-available/neyokart
sudo sed -i "s/\(127\.0\.0\.1\|localhost\):$OLD_CLIENT/\1:$NEW_CLIENT/g" /etc/nginx/sites-available/neyokart

# Safety check: Test Nginx configuration before reloading
if ! sudo nginx -t; then
    echo "❌ Nginx configuration test failed! Rolling back changes."
    # Revert the sed replacements
    sudo sed -i "s/127.0.0.1:$NEW_PORT/127.0.0.1:$OLD_PORT/g" /etc/nginx/sites-available/neyokart
    sudo sed -i "s/127.0.0.1:$NEW_CLIENT/127.0.0.1:$OLD_CLIENT/g" /etc/nginx/sites-available/neyokart
    exit 1
fi

# Reloading Nginx doesn't drop active connections. It gracefully drains.
sudo nginx -s reload

# 5. Stop and remove the old inactive containers
echo "[5/6] Stopping old $ACTIVE_COLOR containers..."
docker compose -f $DOCKER_COMPOSE_FILE stop server-$ACTIVE_COLOR client-$ACTIVE_COLOR
docker compose -f $DOCKER_COMPOSE_FILE rm -f server-$ACTIVE_COLOR client-$ACTIVE_COLOR

# 6. Cleanup old dangling images specifically for this project's server and client
echo "[6/6] Cleaning up old neyokart server and client images..."
# Explicitly finds dangling images with neyokart-server/client in their repo name and removes them
docker images -f "dangling=true" --format '{{.Repository}} {{.ID}}' | grep -E "neyokart-server|neyokart-client" | awk '{print $2}' | xargs -r docker rmi

# Update the state file
echo "$NEW_COLOR" > "$STATE_FILE"

echo "=========================================="
echo " 🚀 Deployment Complete! Traffic is now   "
echo "    flowing to $NEW_COLOR ($NEW_PORT).    "
echo "=========================================="
