#!/bin/bash
# Alaya Insider - Security Hardening Script
# Run this ONCE on the server to set up security

export PATH=$PATH:~/.nvm/versions/node/v22.22.3/bin
cd ~/alaya-insider

echo "=== 1. Setting AUTH_SECRET ==="
if grep -q "AUTH_SECRET=$" .env || ! grep -q "AUTH_SECRET=.\\+" .env; then
  SECRET=$(openssl rand -base64 48)
  sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$SECRET|" .env
  echo "AUTH_SECRET generated (${#SECRET} chars)"
else
  echo "AUTH_SECRET already set"
fi

echo ""
echo "=== 2. Setting up database backup cron ==="
SCRIPT_PATH="/home/u131951911/alaya-insider/scripts/backup-db.sh"
chmod +x "$SCRIPT_PATH"

# Add cron job if not already present
(crontab -l 2>/dev/null | grep -v "backup-db.sh"; echo "0 2 * * * $SCRIPT_PATH >> /home/u131951911/alaya-insider/backups/backup.log 2>&1") | crontab -
echo "Cron job set: daily backup at 2 AM"

# Run first backup now
mkdir -p backups
bash "$SCRIPT_PATH"

echo ""
echo "=== 3. Setting file permissions ==="
chmod 600 .env
chmod 700 data/
chmod 700 backups/
echo "File permissions hardened"

echo ""
echo "=== 4. Restarting app with new AUTH_SECRET ==="
pm2 restart alaya-insider
sleep 3
pm2 save

echo ""
echo "=== Security Hardening Complete ==="
echo " AUTH_SECRET: Set"
echo " Database backup: Configured (daily at 2 AM)"
echo " File permissions: Hardened"
echo " App: Restarted"
