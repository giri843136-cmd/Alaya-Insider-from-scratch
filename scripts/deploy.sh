#!/bin/bash
# ===========================================
# ALAYA INSIDER — Hostinger VPS Deploy Script
# ===========================================
# Run this ONCE on your VPS to deploy the site.
# Usage: bash deploy.sh
# ===========================================

set -e

echo "🚀 Starting Alaya Insider deployment..."

# --- Config ---
APP_DIR="$HOME/alaya-insider"
NODE_VERSION="22"

# --- Step 1: Install Node.js (if not present) ---
echo ""
echo "=== 1. Checking Node.js ==="
if ! command -v node &> /dev/null; then
    echo "Installing Node.js $NODE_VERSION via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install $NODE_VERSION
    nvm use $NODE_VERSION
    echo "✅ Node.js $(node -v) installed"
else
    echo "✅ Node.js $(node -v) already installed"
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

# --- Step 2: Install PM2 (if not present) ---
echo ""
echo "=== 2. Checking PM2 ==="
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
    echo "✅ PM2 installed"
else
    echo "✅ PM2 already installed"
fi

# --- Step 3: Create app directory ---
echo ""
echo "=== 3. Setting up directory ==="
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/uploads/images"
mkdir -p "$APP_DIR/backups"
cd "$APP_DIR"

# --- Step 4: Pull latest code ---
echo ""
echo "=== 4. Pulling code from Git ==="
if [ -d ".git" ]; then
    git pull origin master
else
    echo "⚠️  No git repo found. Please clone your repo first:"
    echo "    cd $HOME"
    echo "    git clone <your-repo-url> alaya-insider"
    echo "    Then re-run this script."
    exit 1
fi

# --- Step 5: Install dependencies ---
echo ""
echo "=== 5. Installing dependencies ==="
npm install

# --- Step 6: Configure .env (if not exists) ---
echo ""
echo "=== 6. Checking environment ==="
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    
    # Generate AUTH_SECRET
    SECRET=$(openssl rand -base64 48)
    sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$SECRET|" .env
    
    # Set production defaults
    sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env
    sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=https://alayainsider.com|" .env
    
    echo ""
    echo "⚠️  IMPORTANT: Edit .env with your settings:"
    echo "    nano $APP_DIR/.env"
    echo ""
    echo "   Required settings:"
    echo "   - ADMIN_SEED_PASSWORD (set a strong password for first login)"
    echo "   - SMTP_HOST, SMTP_USER, SMTP_PASS (for email)"
    echo "   - NEXT_PUBLIC_ANALYTICS_ID (for Google Analytics)"
    echo ""
    echo "   Press Enter when .env is configured..."
    read -r
else
    echo "✅ .env already exists"
fi

# --- Step 7: Build ---
echo ""
echo "=== 7. Building application ==="
npm run build

# --- Step 8: Start with PM2 ---
echo ""
echo "=== 8. Starting with PM2 ==="
pm2 delete alaya-insider 2>/dev/null || true
pm2 start npm --name alaya-insider -- start
pm2 save
pm2 startup 2>/dev/null || true

# --- Step 9: Set permissions ---
echo ""
echo "=== 9. Setting permissions ==="
chmod 600 .env
chmod 700 data/
chmod 700 backups/

# --- Step 10: Verify ---
echo ""
echo "=== 10. Verifying deployment ==="
sleep 3
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "200"; then
    echo "✅ Site is running on http://localhost:3000/"
else
    echo "⚠️  Site may not be responding yet. Check logs:"
    echo "    pm2 logs alaya-insider"
fi

echo ""
echo "==========================================="
echo "🎉 Deployment complete!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "  1. Set up Nginx reverse proxy (see DEPLOYMENT.md)"
echo "  2. Install SSL certificate with Let's Encrypt"
echo "  3. Point your domain DNS to this VPS IP"
echo ""
echo "Useful commands:"
echo "  pm2 logs alaya-insider     # View logs"
echo "  pm2 restart alaya-insider  # Restart app"
echo "  pm2 status                 # Check status"
echo ""
