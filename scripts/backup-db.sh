#!/bin/bash
# Alaya Insider - Database Backup Script
# Run via cron: 0 2 * * * /home/u131951911/alaya-insider/scripts/backup-db.sh
# This backs up the SQLite database daily at 2 AM

BACKUP_DIR="/home/u131951911/alaya-insider/backups"
DB_PATH="/home/u131951911/alaya-insider/data/alaya.db"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
KEEP_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Use SQLite backup command for safe consistent backup
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/alaya-$DATE.db'"

# Compress the backup
gzip "$BACKUP_DIR/alaya-$DATE.db"

# Delete backups older than KEEP_DAYS
find "$BACKUP_DIR" -name "alaya-*.db.gz" -mtime +$KEEP_DAYS -delete

echo "[$(date)] Backup completed: alaya-$DATE.db.gz"
echo "[$(date)] Backups older than $KEEP_DAYS days deleted"
echo "[$(date)] Current backups:"
ls -la "$BACKUP_DIR"/alaya-*.db.gz 2>/dev/null | tail -5
