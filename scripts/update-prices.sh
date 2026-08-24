#!/bin/bash
# ===========================================
# Alaya Insider - Price Update Helper
# ===========================================
# This script helps you update Amazon prices
# quickly using CSV import/export.
# ===========================================

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

DB_PATH="$HOME/alaya-insider/data/alaya.db"
EXPORT_DIR="$HOME/alaya-insider/price-updates"
DATE=$(date +%Y%m%d)

mkdir -p "$EXPORT_DIR"

echo "🔄 Amazon Price Update Helper"
echo "=============================="
echo ""

# Export current products with prices
echo "📊 Exporting current products with prices..."
sqlite3 "$DB_PATH" <<SQL
.headers on
.mode csv
.output $EXPORT_DIR/prices-$DATE.csv
SELECT 
    p.name,
    p.sku,
    p.current_price as price,
    p.previous_price,
    p.currency,
    p.affiliate_url,
    p.marketplace
FROM products p
WHERE p.status = 'published' AND p.deleted_at IS NULL
ORDER BY p.name;
SQL

echo "✅ Exported to: $EXPORT_DIR/prices-$DATE.csv"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Open the CSV file in Excel/Google Sheets"
echo "2. Update the 'price' column with new Amazon prices"
echo "3. Save as CSV"
echo "4. Login to https://alayainsider.com/admin/products"
echo "5. Click Import → Upload the updated CSV"
echo ""
echo "💡 TIP: Check Amazon.in and Amazon.com for latest prices"
echo "   and update the price column accordingly."
echo ""
echo "📁 Exported files:"
ls -la "$EXPORT_DIR"/prices-*.csv 2>/dev/null | tail -5
