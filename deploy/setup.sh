#!/usr/bin/env bash
# ============================================================================
# DocStroy — Server Setup Script
# Run once on a fresh Ubuntu 22.04+ Yandex Cloud Compute instance
# Usage: sudo bash deploy/setup.sh
# ============================================================================

set -euo pipefail

DOMAIN="docstroy.ru"
API_DOMAIN="api.docstroy.ru"
APP_DIR="/var/www/docstroy"
LOG_DIR="/var/log/docstroy"

echo "=== DocStroy Server Setup ==="

# 1. System updates
echo "[1/8] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Install Node.js 20
echo "[2/8] Installing Node.js 20..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "Node.js $(node -v), npm $(npm -v)"

# 3. Install PM2
echo "[3/8] Installing PM2..."
npm install -g pm2

# 4. Install Nginx
echo "[4/8] Installing Nginx..."
apt-get install -y -qq nginx

# 5. Install Certbot
echo "[5/8] Installing Certbot..."
apt-get install -y -qq certbot python3-certbot-nginx

# 6. Create directories
echo "[6/8] Creating directories..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"

# 7. Configure Nginx
echo "[7/8] Configuring Nginx..."
cp deploy/nginx.conf /etc/nginx/sites-available/docstroy
ln -sf /etc/nginx/sites-available/docstroy /etc/nginx/sites-enabled/docstroy
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 8. SSL Certificate
echo "[8/8] Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" -d "$API_DOMAIN" --non-interactive --agree-tos --email admin@docstroy.ru

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy .env file to $APP_DIR/server/.env"
echo "  2. Copy CA.pem to $APP_DIR/server/certs/CA.pem"
echo "  3. Deploy the app (push to main or run manually):"
echo "     cd $APP_DIR && npm ci && npm run build"
echo "     cd server && npm ci && npm run build"
echo "     pm2 start deploy/ecosystem.config.js"
echo "     pm2 save && pm2 startup"
