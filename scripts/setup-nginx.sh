#!/bin/bash
# ===========================================
# ALAYA INSIDER — Nginx + SSL Setup Script
# ===========================================
# Run AFTER deploy.sh is successful.
# Requires: domain DNS pointing to this VPS IP
# Usage: bash setup-nginx.sh
# ===========================================

set -e

DOMAIN="alayainsider.com"
APP_PORT=3000

echo "🌐 Setting up Nginx for $DOMAIN..."

# --- Step 1: Install Nginx ---
echo ""
echo "=== 1. Installing Nginx ==="
if ! command -v nginx &> /dev/null; then
    sudo apt update
    sudo apt install -y nginx
    echo "✅ Nginx installed"
else
    echo "✅ Nginx already installed"
fi

# --- Step 2: Install Certbot ---
echo ""
echo "=== 2. Installing Certbot for SSL ==="
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi

# --- Step 3: Create Nginx config ---
echo ""
echo "=== 3. Creating Nginx configuration ==="
sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;

        # Increase timeouts for large uploads
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Upload size limit
    client_max_body_size 10M;
}
EOF

# --- Step 4: Enable site ---
echo ""
echo "=== 4. Enabling site ==="
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# --- Step 5: Test Nginx config ---
echo ""
echo "=== 5. Testing Nginx config ==="
sudo nginx -t

# --- Step 6: Restart Nginx ---
echo ""
echo "=== 6. Restarting Nginx ==="
sudo systemctl restart nginx
sudo systemctl enable nginx
echo "✅ Nginx started"

# --- Step 7: Get SSL certificate ---
echo ""
echo "=== 7. Setting up SSL certificate ==="
echo ""
echo "⚠️  Make sure your domain DNS is pointing to this VPS IP first!"
echo "   You can check with: dig +short $DOMAIN"
echo ""
echo "   Current server IP:"
curl -s ifconfig.me
echo ""
echo ""
read -p "Has DNS propagation completed? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    echo "✅ SSL certificate installed"
    
    # Set up auto-renewal
    echo "0 0,12 * * * root certbot renew --quiet" | sudo tee /etc/cron.d/certbot-renew
    echo "✅ Auto-renewal configured"
else
    echo ""
    echo "Run this later when DNS is ready:"
    echo "   sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo ""
echo "==========================================="
echo "🎉 Nginx + SSL setup complete!"
echo "==========================================="
echo ""
echo "Your site should now be accessible at:"
echo "   https://$DOMAIN"
echo ""
