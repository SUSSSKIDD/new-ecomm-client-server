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

# 1. Build the absolute latest images locally on the VPS
echo "[1/6] Building latest images locally..."
docker compose -f $DOCKER_COMPOSE_FILE build --no-cache server-$NEW_COLOR client-$NEW_COLOR

# 2. Start the new container in the background
echo "[2/6] Starting $NEW_COLOR containers..."
docker compose -f $DOCKER_COMPOSE_FILE up -d --no-deps server-$NEW_COLOR client-$NEW_COLOR

# 3. Wait for the new backend to be healthy
echo "[3/6] Waiting for server-$NEW_COLOR to become healthy..."
RETRIES=0
MAX_RETRIES=20
HEALTHY=false

while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:$NEW_PORT/ > /dev/null; then
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
