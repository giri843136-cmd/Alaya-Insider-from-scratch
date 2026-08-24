# Amazon Price Update Workflow
## Quick Guide (Takes 5-10 minutes)

### Method 1: Update via Admin Panel (Easiest)
1. Go to **https://alayainsider.com/admin/products**
2. Click on a product name
3. Update **Current Price** field
4. Update **Previous Price** (optional)
5. Click **Save**
6. Repeat for other products

### Method 2: Bulk CSV Update (For many products)

#### Step 1: Export current prices
Login to SSH and run:
```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
cd ~/alaya-insider
sqlite3 data/alaya.db ".headers on" ".mode csv" ".output /tmp/prices.csv" "SELECT name, sku, current_price, previous_price, currency, affiliate_url FROM products WHERE status='published' AND deleted_at IS NULL;"
scp -P 65002 u131951911@145.79.58.169:/tmp/prices.csv ~/Desktop/
```

#### Step 2: Update prices in Excel
1. Open `prices.csv` in Excel/Google Sheets
2. Check Amazon.in and Amazon.com for current prices
3. Update the `current_price` column
4. Save as CSV

#### Step 3: Import updated prices
1. Login to **https://alayinsider.com/admin/products**
2. Click **Import**
3. Upload the updated CSV
4. Products will be updated with new prices

### Method 3: Amazon Price Tracker (Free Tools)

Use these free tools to track Amazon price changes:

| Tool | What It Does | Link |
|------|-------------|------|
| **Keepa** | Tracks Amazon price history | keepa.com |
| **CamelCamelCamel** | Price alerts & history | camelcamelcamel.com |
| **Amazon Assistant** | Browser extension for price alerts | amazon.com |

### Recommended Weekly Routine:
1. **Monday morning**: Check Keepa/CamelCamelCamel for price changes
2. **Update prices** in admin panel or via CSV
3. **Verify** the site shows correct prices

### Pro Tips:
- Add "Prices may vary — click to check latest price" on product pages
- This protects you if prices change after your last update
- Focus on updating your **top 10-20 best-selling products** weekly
- Less popular products can be updated monthly
