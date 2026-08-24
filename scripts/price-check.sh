#!/bin/bash
# ===========================================
# Alaya Insider - Price Check Report
# ===========================================
# Shows which products need price updates
# Run this weekly to stay on top of prices
# ===========================================

export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"

DB_PATH="$HOME/alaya-insider/data/alaya.db"

echo "📊 PRICE CHECK REPORT"
echo "====================="
echo ""
echo "Products published: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM products WHERE status='published' AND deleted_at IS NULL;")"
echo "Products with prices: $(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM products WHERE status='published' AND deleted_at IS NULL AND current_price > 0;")"
echo ""
echo "💰 Products by Price Range:"
sqlite3 "$DB_PATH" <<SQL
.mode column
.headers on
SELECT 
    CASE 
        WHEN current_price < 500 THEN 'Under ₹500/$50'
        WHEN current_price BETWEEN 500 AND 2000 THEN '₹500-2000/$50-200'
        WHEN current_price BETWEEN 2000 AND 5000 THEN '₹2000-5000/$200-500'
        ELSE 'Over ₹5000/$500'
    END as price_range,
    COUNT(*) as count
FROM products 
WHERE status='published' AND deleted_at IS NULL AND current_price > 0
GROUP BY price_range
ORDER BY MIN(current_price);
SQL

echo ""
echo "📝 Top 10 Products (Check these prices first):"
sqlite3 "$DB_PATH" <<SQL
.mode column
.headers on
.width 40 10 15
SELECT 
    substr(p.name, 1, 40) as name,
    p.current_price as price,
    p.marketplace
FROM products p
WHERE p.status='published' AND p.deleted_at IS NULL 
AND p.current_price > 0
ORDER BY p.click_count DESC
LIMIT 10;
SQL

echo ""
echo "🔗 Amazon.in Products:"
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM products WHERE status='published' AND deleted_at IS NULL AND marketplace LIKE '%India%' OR marketplace LIKE '%.in%';"

echo "🔗 Amazon.com Products:"
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM products WHERE status='published' AND deleted_at IS NULL AND marketplace LIKE '%Amazon%' AND marketplace NOT LIKE '%.in%';"
