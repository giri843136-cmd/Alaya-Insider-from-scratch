# Alaya Insider — Deployment Guide

## Requirements

- **Node.js** 18+ (tested with 22.x)
- **npm** 10+
- **Persistent filesystem** (VPS/dedicated server, NOT ephemeral serverless)
- **Reverse proxy** (Nginx/Caddy) for HTTPS
- **SSL certificate** (Let's Encrypt or equivalent)
- **PM2** or **systemd** for process management

## VPS Setup

### 1. Create Application Directory

```bash
sudo mkdir -p /var/www/alayainsider
sudo chown $USER:$USER /var/www/alayainsider
```

### 2. Clone Repository

```bash
cd /var/www/alayainsider
git clone <your-repo-url> .
```

### 3. Create Persistent Directories

```bash
mkdir -p data uploads/images
```

> ⚠️ `data/` and `uploads/` must be on persistent disk. They must NOT be inside `.next/`.

### 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

Fill in:
- `AUTH_SECRET` — **Required.** Generate: `openssl rand -base64 48`
- `ADMIN_SEED_PASSWORD` — Set a strong password for initial admin account creation. Remove after first login.
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — Your email provider
- `NEXT_PUBLIC_ANALYTICS_ID` — Google Analytics ID
- `NEXT_PUBLIC_SITE_URL` — `https://alayainsider.com`

### 5. Install Dependencies

```bash
npm install
```

### 6. Build

```bash
npm run build
```

### 7. Start with PM2

```bash
npm install -g pm2
pm2 start npm --name alayainsider -- start
pm2 save
pm2 startup  # Follow instructions to enable auto-start on boot
```

### 8. Verify

```bash
curl http://localhost:3000/
```

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name alayainsider.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name alayainsider.com;

    ssl_certificate /etc/letsencrypt/live/alayainsider.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alayainsider.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d alayainsider.com
```

## Database

### Location
`./data/alaya.db` — SQLite database on persistent disk.

### Initialization
On first startup, the application automatically:
1. Creates all tables (`CREATE TABLE IF NOT EXISTS`)
2. Seeds default roles and admin user
3. Seeds demo homepage sections and settings

This is **non-destructive** — existing data is never overwritten.

### Backup

```bash
cp data/alaya.db data/alaya-backup-$(date +%Y%m%d).db
```

### Restore

```bash
cp data/alaya-backup-YYYYMMDD.db data/alaya.db
pm2 restart alayainsider
```

## Uploads

Product images, hero images, and category images are stored in `./uploads/images/`.

### Backup

```bash
tar czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/
```

## Maintenance

### Restart
```bash
pm2 restart alayainsider
```

### Rebuild
```bash
npm run build
pm2 restart alayainsider
```

### View Logs
```bash
pm2 logs alayainsider
```

### Update Code
```bash
git pull origin main
npm install
npm run build
pm2 restart alayainsider
```

## Important Notes

- **Never** delete `data/` or `uploads/` during normal operations
- **Never** run `next dev` in production
- **Never** commit `.env` to Git
- **Always** backup database before major changes
- The application binds to port 3000 by default

## Pre-Flight Checklist

Before going live, complete every item:

- [ ] VPS provisioned with persistent storage
- [ ] Node.js 18+ installed
- [ ] Application code deployed
- [ ] `data/` directory exists on persistent disk
- [ ] `uploads/` directory exists on persistent disk
- [ ] Database restored from backup
- [ ] Uploads restored from backup
- [ ] `.env` configured with all required variables
- [ ] `AUTH_SECRET` set (64+ chars, `openssl rand -base64 48`)
- [ ] `ADMIN_SEED_PASSWORD` set (for first-time setup only)
- [ ] **Admin password changed from any old default** ⚠️
- [ ] `npm install` completed
- [ ] `npm run build` successful
- [ ] PM2 or systemd configured
- [ ] Reverse proxy (Nginx) configured
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] HTTP → HTTPS redirect working
- [ ] DNS pointing to VPS IP
- [ ] `SMTP_HOST/USER/PASS` configured
- [ ] `NEXT_PUBLIC_ANALYTICS_ID` configured
- [ ] Product images uploaded via admin
- [ ] Hero images uploaded via admin
- [ ] Category images uploaded via admin
- [ ] Live smoke test passed (homepage, product, redirect, admin)
- [ ] Database backup created
- [ ] Server reboot test passed

### ⚠️ Critical Security Note

The old default admin password exists in Git history. **You MUST set a completely new, unique admin password** before production. Never reuse any password from the repository history.
