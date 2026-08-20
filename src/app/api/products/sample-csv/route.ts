import { NextRequest, NextResponse } from 'next/server';

const SAMPLE_CSV = `name,brand,category,subcategory,price,previous_price,currency,rating,review_count,description,why_we_recommend,best_for,benefits,pros,cons,buying_advice,affiliate_url,marketplace,affiliate_network,cta_text,sku,status,is_featured,is_trending,is_editors_pick,seo_title,seo_description
Organic Cotton Bath Towels,Muji,Home & Living,Bathroom,34.99,44.99,USD,4.5,1230,Ultra-soft organic cotton towels that get softer with every wash.,Affordable quality that improves over time.,Anyone looking for soft and durable everyday towels,Organic cotton|Gets softer with use|Quick drying,Very soft|Eco-friendly material|Great value,Takes a few washes to peak softness|Limited colors,Buy two sets so you always have fresh towels ready.,https://example.com/affiliate/organic-cotton-towels,Amazon,Amazon Associates,Check Price on Amazon,MUJI-TOW-001,published,no,no,no,Organic Cotton Bath Towels — Alaya Insider,Soft organic cotton bath towels that improve with every wash.
Ceramic Pour-Over Coffee Maker,Le Creuset,Kitchen & Dining,Cookware,49.95,,USD,4.7,876,A beautifully crafted ceramic pour-over dripper.,Makes excellent coffee with minimal equipment.,Coffee enthusiasts who enjoy manual brewing,Heat-retaining ceramic|Easy to clean|Beautiful design,Excellent heat retention|Easy cleanup|Gorgeous design,Slow process|Only makes 1-2 cups,Pair with a gooseneck kettle for best results.,https://example.com/affiliate/ceramic-pour-over,Amazon,Amazon Associates,View on Amazon,LC-POUR-002,published,yes,no,yes,Ceramic Pour-Over Coffee Maker — Alaya Insider,Le Creuset ceramic pour-over dripper review.
Silk Sleep Mask,Aesop,Beauty,Beauty Tools,28.00,,USD,4.6,2100,100% mulberry silk sleep mask with adjustable strap.,A small investment in sleep quality.,Light sleepers and frequent travelers,100% mulberry silk|Fully adjustable|Total light block,Very comfortable|Blocks all light|Gentle on skin,Needs hand washing|Silk shows wear over time,Worth the upgrade from synthetic masks.,https://example.com/affiliate/silk-sleep-mask,Brand Website,Impact,View on Brand Site,AES-SLK-003,published,no,yes,no,Silk Sleep Mask — Alaya Insider,Mulberry silk sleep mask review.
Portable Bluetooth Speaker,Bang & Olufsen,Electronics,Audio,199.00,249.00,USD,4.4,543,Compact wireless speaker with rich 360-degree sound.,Punches well above its size in sound quality.,Music lovers who want quality sound on the go,360-degree sound|IP67 waterproof|12-hour battery,Excellent sound quality|Truly waterproof|Long battery,Expensive for the size|No stereo pairing,Great for travel and small rooms.,https://example.com/affiliate/portable-speaker,Amazon,Amazon Associates,Check Price,BO-SPK-004,draft,no,no,no,Portable Bluetooth Speaker — Alaya Insider,Bang & Olufsen compact Bluetooth speaker review.
Travel Packing Cubes Set,Away,Travel,Travel Accessories,45.00,,USD,4.3,1890,Set of 4 lightweight mesh packing cubes.,Simple and effective packing organizers.,Frequent travelers and organized packers,4 graduated sizes|Lightweight mesh|Durable zippers,Great organization|Very lightweight|Durable,Basic design|No compression|Limited colors,Use the largest cube for bulky items.,https://example.com/affiliate/packing-cubes,Brand Website,Impact,Shop Now,AW-PCK-005,published,no,no,no,Travel Packing Cubes Set — Alaya Insider,Away packing cubes set review.`;

export async function GET(req: NextRequest) {
  const mode = new URL(req.url).searchParams.get('mode');

  // mode=view: render as a full HTML page with a save button and the raw text
  if (mode === 'view') {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Sample Products CSV</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 18px; }
  p { font-size: 13px; color: #666; }
  textarea { width: 100%; height: 300px; font-family: monospace; font-size: 11px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin: 16px 0; }
  .btn { display: inline-block; padding: 10px 20px; background: #1a1a2e; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-right: 8px; text-decoration: none; }
  .btn:hover { background: #16213e; }
  .btn-outline { background: #fff; color: #333; border: 1px solid #ddd; }
  .btn-outline:hover { border-color: #1a1a2e; color: #1a1a2e; }
  .status { font-size: 13px; color: #16a34a; margin-left: 8px; display: none; }
</style></head><body>
<h1>Sample Products Import CSV</h1>
<p>Copy this content and paste into Excel or Google Sheets. Edit with your products, save as .csv, and upload in the admin panel.</p>
<div style="margin: 16px 0;">
  <button class="btn" onclick="copyCSV()">Copy All to Clipboard</button>
  <button class="btn btn-outline" onclick="selectAll()">Select All</button>
  <span class="status" id="status">✓ Copied!</span>
</div>
<textarea id="csv" readonly onclick="this.select()">${SAMPLE_CSV.replace(/</g, '&lt;')}</textarea>
<p><strong>Tip:</strong> After pasting into Google Sheets, use Data → Split text to columns (delimiter: comma).</p>
<p style="margin-top:24px"><a href="/admin/products/import" style="color:#1a1a2e">← Back to Import</a></p>
<script>
function copyCSV() {
  var ta = document.getElementById('csv');
  ta.select();
  document.execCommand('copy');
  try { navigator.clipboard.writeText(ta.value); } catch(e) {}
  var s = document.getElementById('status');
  s.style.display = 'inline';
  setTimeout(function(){ s.style.display = 'none'; }, 2000);
}
function selectAll() {
  document.getElementById('csv').select();
}
</script></body></html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Default: force download
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="sample-products-import.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
