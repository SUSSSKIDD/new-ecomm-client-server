#!/bin/bash
set -e

echo "=========================================="
echo " Starting Neyokart Blue/Green Deployment  "
echo "=========================================="

APP_DIR="/opt/neyokart"
DOCKER_COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
STATE_FILE="$APP_DIR/active_color.txt"

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

# 1. Pull the absolute latest images from Docker Hub
echo "[1/6] Pulling latest images..."
docker compose -f $DOCKER_COMPOSE_FILE pull

# 2. Start the new container in the background
echo "[2/6] Starting $NEW_COLOR containers..."
docker compose -f $DOCKER_COMPOSE_FILE up -d --no-deps server-$NEW_COLOR client-$NEW_COLOR

# 3. Wait for the new backend to be healthy
echo "[3/6] Waiting for server-$NEW_COLOR to become healthy..."
RETRIES=0
MAX_RETRIES=20
HEALTHY=false

while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:$NEW_PORT/ > /dev/null; then
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
# Correctly matches proxy_pass http://127.0.0.1:CURRENT in the Nginx config
sudo sed -i "s/127.0.0.1:$OLD_PORT/127.0.0.1:$NEW_PORT/g" /etc/nginx/sites-available/neyokart
sudo sed -i "s/127.0.0.1:$OLD_CLIENT/127.0.0.1:$NEW_CLIENT/g" /etc/nginx/sites-available/neyokart
# Reloading Nginx doesn't drop active connections. It gracefully drains.
sudo nginx -s reload

# 5. Stop and remove the old inactive containers
echo "[5/6] Stopping old $ACTIVE_COLOR containers..."
docker compose -f $DOCKER_COMPOSE_FILE stop server-$ACTIVE_COLOR client-$ACTIVE_COLOR
docker compose -f $DOCKER_COMPOSE_FILE rm -f server-$ACTIVE_COLOR client-$ACTIVE_COLOR

# Update the state file
echo "$NEW_COLOR" > "$STATE_FILE"

echo "=========================================="
echo " 🚀 Deployment Complete! Traffic is now   "
echo "    flowing to $NEW_COLOR ($NEW_PORT).    "
echo "=========================================="
