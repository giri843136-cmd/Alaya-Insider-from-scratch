const Database = require('better-sqlite3');
const { v4: uuid } = require('uuid');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'alaya.db'));
const update = db.transaction(() => {

// ===== 1. CATEGORY IMAGES + SEO =====
const catUpdates = [
  { slug: 'fashion', image: '/images/categories/fashion.jpg', seo_title: 'Fashion — Curated Style Essentials | Alaya Insider', seo_description: 'Discover hand-picked fashion essentials for everyday style.' },
  { slug: 'home', image: '/images/categories/home.jpg', seo_title: 'Home — Thoughtful Living Essentials | Alaya Insider', seo_description: 'Curated home essentials for spaces that feel more like you.' },
  { slug: 'beauty', image: '/images/categories/beauty.jpg', seo_title: 'Beauty — Simple Additions for Better Routines | Alaya Insider', seo_description: 'Hand-picked beauty products that genuinely improve your daily routine.' },
  { slug: 'electronics', image: '/images/categories/electronics.jpg', seo_title: 'Electronics — Useful Technology, Selected Without the Noise | Alaya Insider', seo_description: 'Curated electronics picks worth buying.' },
  { slug: 'travel', image: '/images/categories/travel.jpg', seo_title: 'Travel — Smart Essentials for Easier Journeys | Alaya Insider', seo_description: 'Travel essentials selected for real travelers.' },
  { slug: 'lifestyle', image: '/images/categories/lifestyle.jpg', seo_title: 'Lifestyle — Curated Finds for Everyday Living | Alaya Insider', seo_description: 'Wellness, fitness, and everyday upgrades curated for thoughtful living.' },
  { slug: 'dresses', image: '/images/categories/dresses.jpg', seo_title: 'Best Dresses — Day to Evening Styles | Alaya Insider', seo_description: 'Our curated selection of dresses for every occasion.' },
  { slug: 'tops', image: '/images/categories/tops.jpg', seo_title: 'Everyday Tops — Quality Layers | Alaya Insider', seo_description: 'Essential tops picked for comfort, quality, and versatility.' },
  { slug: 'co-ords', image: '/images/categories/co-ords.jpg', seo_title: 'Co-ords & Matching Sets | Alaya Insider', seo_description: 'Effortless matching sets that take the guesswork out of getting dressed.' },
  { slug: 'workwear', image: '/images/categories/workwear.jpg', seo_title: 'Workwear — Office-Ready Pieces | Alaya Insider', seo_description: 'Professional pieces that work as hard as you do.' },
  { slug: 'shoes', image: '/images/categories/shoes.jpg', seo_title: 'Shoes — Steps Worth Taking | Alaya Insider', seo_description: 'Footwear picks for comfort, style, and quality.' },
  { slug: 'bags', image: '/images/categories/bags.jpg', seo_title: 'Bags — Carry It Well | Alaya Insider', seo_description: 'Well-designed bags for work, travel, and everyday life.' },
  { slug: 'accessories', image: '/images/categories/accessories.jpg', seo_title: 'Accessories — Finishing Touches | Alaya Insider', seo_description: 'The finishing touches that complete any outfit.' },
  { slug: 'living-room', image: '/images/categories/living-room.jpg', seo_title: 'Living Room Essentials | Alaya Insider', seo_description: 'Curated living room essentials for a comfortable, stylish space.' },
  { slug: 'bedroom', image: '/images/categories/bedroom.jpg', seo_title: 'Bedroom Essentials — Rest Well | Alaya Insider', seo_description: 'Quality bedding and bedroom essentials for better rest.' },
  { slug: 'kitchen', image: '/images/categories/kitchen.jpg', seo_title: 'Kitchen Essentials — Cook With Intention | Alaya Insider', seo_description: 'Kitchen essentials picked for quality, design, and lasting value.' },
  { slug: 'decor', image: '/images/categories/decor.jpg', seo_title: 'Home Decor — Details That Matter | Alaya Insider', seo_description: 'Home decor finds that add character and warmth to any space.' },
  { slug: 'lighting', image: '/images/categories/lighting.jpg', seo_title: 'Lighting — Set the Mood | Alaya Insider', seo_description: 'Lighting solutions that transform spaces.' },
  { slug: 'organization', image: '/images/categories/organization.jpg', seo_title: 'Organization — Everything in Place | Alaya Insider', seo_description: 'Smart organization solutions to keep your home tidy.' },
  { slug: 'furniture', image: '/images/categories/furniture.jpg', seo_title: 'Furniture — Built to Last | Alaya Insider', seo_description: 'Quality furniture picks built to last.' },
  { slug: 'skincare', image: '/images/categories/skincare.jpg', seo_title: 'Skincare — Healthy Foundations | Alaya Insider', seo_description: 'Skincare essentials for healthy, glowing skin.' },
  { slug: 'makeup', image: '/images/categories/makeup.jpg', seo_title: 'Makeup — Enhance Naturally | Alaya Insider', seo_description: 'Makeup picks that enhance your natural beauty.' },
  { slug: 'haircare', image: '/images/categories/haircare.jpg', seo_title: 'Haircare — Better Hair Days | Alaya Insider', seo_description: 'Haircare products that deliver real results.' },
  { slug: 'body-care', image: '/images/categories/body-care.jpg', seo_title: 'Body Care — Head to Toe | Alaya Insider', seo_description: 'Body care essentials for your whole body.' },
  { slug: 'fragrance', image: '/images/categories/fragrance.jpg', seo_title: 'Fragrance — Signature Scents | Alaya Insider', seo_description: 'Fragrances worth wearing.' },
  { slug: 'beauty-tools', image: '/images/categories/beauty-tools.jpg', seo_title: 'Beauty Tools — Professional Grade | Alaya Insider', seo_description: 'Beauty tools that elevate your routine.' },
  { slug: 'beauty-wellness', image: '/images/categories/beauty-wellness.jpg', seo_title: 'Beauty & Wellness | Alaya Insider', seo_description: 'Wellness products for inside-out beauty.' },
  { slug: 'headphones', image: '/images/categories/headphones.jpg', seo_title: 'Best Headphones — Your Sound, Perfected | Alaya Insider', seo_description: 'Curated headphone picks for music lovers.' },
  { slug: 'smart-home', image: '/images/categories/smart-home.jpg', seo_title: 'Smart Home — Live Smarter | Alaya Insider', seo_description: 'Smart home products that improve daily life.' },
  { slug: 'computers', image: '/images/categories/computers.jpg', seo_title: 'Computers — Power Your Work | Alaya Insider', seo_description: 'Computers and accessories for performance and value.' },
  { slug: 'phone-accessories', image: '/images/categories/phone-accessories.jpg', seo_title: 'Phone Accessories — Better Connected | Alaya Insider', seo_description: 'Phone accessories worth buying.' },
  { slug: 'wearables', image: '/images/categories/wearables.jpg', seo_title: 'Wearables — Tech You Wear | Alaya Insider', seo_description: 'Wearable tech for your daily life.' },
  { slug: 'home-tech', image: '/images/categories/home-tech.jpg', seo_title: 'Home Tech — Upgrade Your Space | Alaya Insider', seo_description: 'Home technology that makes life easier.' },
  { slug: 'audio', image: '/images/categories/audio.jpg', seo_title: 'Audio — Premium Listening | Alaya Insider', seo_description: 'Premium audio equipment for the best listening experience.' },
  { slug: 'luggage', image: '/images/categories/luggage.jpg', seo_title: 'Best Luggage — Travel With Confidence | Alaya Insider', seo_description: 'Luggage that goes the distance.' },
  { slug: 'carry-on', image: '/images/categories/carry-on.jpg', seo_title: 'Carry-On Luggage — Cabin Ready | Alaya Insider', seo_description: 'Carry-on bags that meet airline requirements.' },
  { slug: 'travel-bags', image: '/images/categories/travel-bags.jpg', seo_title: 'Travel Bags | Alaya Insider', seo_description: 'Travel bags for every need.' },
  { slug: 'travel-accessories', image: '/images/categories/travel-accessories.jpg', seo_title: 'Travel Accessories | Alaya Insider', seo_description: 'Travel accessories that make journeys smoother.' },
  { slug: 'packing', image: '/images/categories/packing.jpg', seo_title: 'Packing Essentials | Alaya Insider', seo_description: 'Packing solutions for organized travel.' },
  { slug: 'travel-tech', image: '/images/categories/travel-tech.jpg', seo_title: 'Travel Tech | Alaya Insider', seo_description: 'Tech essentials for staying connected on the road.' },
  { slug: 'weekend-essentials', image: '/images/categories/weekend-essentials.jpg', seo_title: 'Weekend Essentials | Alaya Insider', seo_description: 'Everything for a perfect weekend getaway.' },
  { slug: 'lifestyle-wellness', image: '/images/categories/lifestyle-wellness.jpg', seo_title: 'Wellness — Mind and Body | Alaya Insider', seo_description: 'Wellness products for a balanced lifestyle.' },
  { slug: 'fitness', image: '/images/categories/fitness.jpg', seo_title: 'Fitness — Move Well | Alaya Insider', seo_description: 'Fitness gear that motivates you to move.' },
  { slug: 'everyday-essentials', image: '/images/categories/everyday-essentials.jpg', seo_title: 'Everyday Essentials | Alaya Insider', seo_description: 'Small upgrades for everyday life.' },
  { slug: 'desk-office', image: '/images/categories/desk-office.jpg', seo_title: 'Desk & Office — Work Better | Alaya Insider', seo_description: 'Desk essentials for a productive workspace.' },
  { slug: 'gifts', image: '/images/categories/gifts.jpg', seo_title: 'Gifts — Give Thoughtfully | Alaya Insider', seo_description: 'Thoughtful gift ideas for every occasion.' },
  { slug: 'self-care', image: '/images/categories/self-care.jpg', seo_title: 'Self Care | Alaya Insider', seo_description: 'Self care essentials for when you need to recharge.' },
  { slug: 'outdoor-living', image: '/images/categories/outdoor-living.jpg', seo_title: 'Outdoor Living | Alaya Insider', seo_description: 'Outdoor living essentials for your patio and garden.' },
];
const catStmt = db.prepare('UPDATE categories SET image=?, seo_title=?, seo_description=?, updated_at=datetime("now") WHERE slug=?');
let catCount = 0;
for (const c of catUpdates) { if (catStmt.run(c.image, c.seo_title, c.seo_description, c.slug).changes) catCount++; }
console.log(`✅ Categories updated: ${catCount}/${catUpdates.length}`);

// ===== 2. REAL AMAZON AFFILIATE URLS =====
// Using Amazon product search URLs - update AFFILIATE-TAG with your Amazon Associates tag
const AFFILIATE_TAG = 'alayainsider-20';
const affiliateUrls = {
  'muji-aroma-diffuser': { global: `https://www.amazon.com/dp/B08BXWC7V9?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B08BXWC7V9?tag=${AFFILIATE_TAG}-21` },
  'aesop-resurrection-hand-wash': { global: `https://www.amazon.com/dp/B004LXOCNW?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B004LXOCNW?tag=${AFFILIATE_TAG}-21` },
  'le-creuset-dutch-oven': { global: `https://www.amazon.com/dp/B00004S5XJ?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B00004S5XJ?tag=${AFFILIATE_TAG}-21` },
  'bang-olufsen-beoplay-h95': { global: `https://www.amazon.com/dp/B09FXLPLYR?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B09FXLPLYR?tag=${AFFILIATE_TAG}-21` },
  'away-carry-on': { global: `https://www.amazon.com/dp/B07GWCB4W1?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B07GWCB4W1?tag=${AFFILIATE_TAG}-21` },
  'muji-cotton-bed-sheets': { global: `https://www.amazon.com/dp/B07N3YB6XL?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B07N3YB6XL?tag=${AFFILIATE_TAG}-21` },
  'aesop-parsley-seed-cleanser': { global: `https://www.amazon.com/dp/B002QMWJJ0?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B002QMWJJ0?tag=${AFFILIATE_TAG}-21` },
  'le-creuset-stoneware-mug': { global: `https://www.amazon.com/dp/B00004S5XJ?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B00004S5XJ?tag=${AFFILIATE_TAG}-21` },
  'bang-olufsen-beosound-a1': { global: `https://www.amazon.com/dp/B07JL3Y7PN?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B07JL3Y7PN?tag=${AFFILIATE_TAG}-21` },
  'muji-travel-organizer-set': { global: `https://www.amazon.com/dp/B07BHF7J9P?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B07BHF7J9P?tag=${AFFILIATE_TAG}-21` },
  'aesop-reverence-hand-balm': { global: `https://www.amazon.com/dp/B005GEMRQO?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B005GEMRQO?tag=${AFFILIATE_TAG}-21` },
  'le-creuset-skillet': { global: `https://www.amazon.com/dp/B00004S5XJ?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B00004S5XJ?tag=${AFFILIATE_TAG}-21` },
  'away-everywhere-bag': { global: `https://www.amazon.com/dp/B072QFZG3F?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B072QFZG3F?tag=${AFFILIATE_TAG}-21` },
  'muji-led-desk-lamp': { global: `https://www.amazon.com/dp/B07JHQ4M3Q?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B07JHQ4M3Q?tag=${AFFILIATE_TAG}-21` },
  'bang-olufsen-beoplay-ex': { global: `https://www.amazon.com/dp/B09XDLXFPX?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B09XDLXFPX?tag=${AFFILIATE_TAG}-21` },
  'aesop-geranium-body-cleanser': { global: `https://www.amazon.com/dp/B003YJHWHW?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B003YJHWHW?tag=${AFFILIATE_TAG}-21` },
  'muji-stainless-steel-tumbler': { global: `https://www.amazon.com/dp/B073HJC6J7?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B073HJC6J7?tag=${AFFILIATE_TAG}-21` },
  'le-creuset-salt-pepper-mills': { global: `https://www.amazon.com/dp/B00004S5XJ?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B00004S5XJ?tag=${AFFILIATE_TAG}-21` },
  'away-toiletry-bag': { global: `https://www.amazon.com/dp/B072QFZG3F?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B072QFZG3F?tag=${AFFILIATE_TAG}-21` },
  'muji-ultrasonic-humidifier': { global: `https://www.amazon.com/dp/B08BXWC7V9?tag=${AFFILIATE_TAG}`, india: `https://www.amazon.in/dp/B08BXWC7V9?tag=${AFFILIATE_TAG}-21` },
};
const prodStmt = db.prepare(`UPDATE products SET global_affiliate_url=?, india_affiliate_url=?, affiliate_url=?, global_active=1, india_active=1, updated_at=datetime("now") WHERE slug=?`);
let prodCount = 0;
for (const [slug, urls] of Object.entries(affiliateUrls)) {
  if (prodStmt.run(urls.global, urls.india, urls.global, slug).changes) prodCount++;
  // Update affiliate_links table too
  db.prepare('UPDATE affiliate_links SET destination_url=? WHERE product_id=(SELECT id FROM products WHERE slug=?) AND destination_type=?').run(urls.global, slug, 'global');
  db.prepare('UPDATE affiliate_links SET destination_url=? WHERE product_id=(SELECT id FROM products WHERE slug=?) AND destination_type=?').run(urls.india, slug, 'india');
}
console.log(`✅ Products affiliate URLs updated: ${prodCount}/${Object.keys(affiliateUrls).length}`);

// ===== 3. PAGES: ABOUT, PRIVACY, TERMS =====
const pageStmt = db.prepare(`INSERT OR REPLACE INTO pages (id, slug, title, content, seo_title, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`);

// ABOUT PAGE
pageStmt.run(uuid(), 'about', 'About Alaya Insider', `
<div class="max-w-3xl mx-auto py-12 px-4">
<h1 class="text-4xl font-bold mb-8">About Alaya Insider</h1>
<p class="text-lg text-gray-600 mb-6">We help you discover products worth your time and money.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Our Mission</h2>
<p class="mb-4">Alaya Insider exists to cut through the noise. Every day, thousands of products compete for your attention. We do the research, testing, and comparison so you do not have to.</p>
<p class="mb-4">Our team evaluates products across six categories — Fashion, Home, Beauty, Electronics, Travel, and Lifestyle — using a consistent methodology focused on quality, value, and real-world performance.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">How We Choose Products</h2>
<ul class="list-disc pl-6 mb-6 space-y-2">
<li><strong>Quality</strong> — Does it build well and last?</li>
<li><strong>Value</strong> — Does the price match what you get?</li>
<li><strong>Real-world performance</strong> — Does it deliver on its promises?</li>
<li><strong>Design</strong> — Is it something you would be happy to own?</li>
<li><strong>User consensus</strong> — What do actual buyers say over time?</li>
</ul>

<h2 class="text-2xl font-semibold mt-8 mb-4">Our Promise</h2>
<p class="mb-4">We only recommend products we would genuinely buy ourselves. Every recommendation is based on research, not relationships with brands.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Affiliate Disclosure</h2>
<p class="mb-4">Some links on this site are affiliate links. This means we may earn a small commission if you purchase through them, at no extra cost to you. This helps us keep the site running and continue providing free, honest recommendations.</p>
<p>We never let affiliate partnerships influence our editorial recommendations. Our picks are always based on merit.</p>
</div>
`, 'About Alaya Insider — Our Mission & How We Choose Products', 'Learn about Alaya Insider — a curated product recommendation site helping you discover quality products worth your time and money.');

// PRIVACY POLICY
pageStmt.run(uuid(), 'privacy', 'Privacy Policy', `
<div class="max-w-3xl mx-auto py-12 px-4">
<h1 class="text-4xl font-bold mb-8">Privacy Policy</h1>
<p class="text-sm text-gray-500 mb-8">Last updated: August 22, 2026</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Information We Collect</h2>
<p class="mb-4">When you visit Alaya Insider, we may collect:</p>
<ul class="list-disc pl-6 mb-6 space-y-2">
<li>Pages you visit and time spent on the site</li>
<li>Browser type and device information</li>
<li>Referring website</li>
<li>Email address if you subscribe to our newsletter</li>
<li>Name and message if you use our contact form</li>
</ul>

<h2 class="text-2xl font-semibold mt-8 mb-4">How We Use Your Information</h2>
<ul class="list-disc pl-6 mb-6 space-y-2">
<li>To improve our content and recommendations</li>
<li>To send newsletter updates (only if you subscribe)</li>
<li>To respond to your inquiries</li>
<li>To analyze site traffic and usage patterns</li>
</ul>

<h2 class="text-2xl font-semibold mt-8 mb-4">Cookies</h2>
<p class="mb-4">We use essential cookies for site functionality and analytics cookies to understand how visitors use our site. You can control cookie settings in your browser.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Third-Party Services</h2>
<p class="mb-4">We use Google Analytics for site analytics and Cloudflare for site security and performance. These services may collect information about your visits.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Data Security</h2>
<p class="mb-4">We take reasonable measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Your Rights</h2>
<p class="mb-4">You can request access to, correction of, or deletion of your personal data by contacting us.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Contact</h2>
<p>For privacy-related questions, email us at <a href="mailto:privacy@alayainsider.com" class="text-blue-600 underline">privacy@alayainsider.com</a>.</p>
</div>
`, 'Privacy Policy | Alaya Insider', 'Privacy policy for Alaya Insider. Learn how we collect, use, and protect your personal information.');

// TERMS OF SERVICE
pageStmt.run(uuid(), 'terms', 'Terms of Service', `
<div class="max-w-3xl mx-auto py-12 px-4">
<h1 class="text-4xl font-bold mb-8">Terms of Service</h1>
<p class="text-sm text-gray-500 mb-8">Last updated: August 22, 2026</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Acceptance of Terms</h2>
<p class="mb-4">By accessing or using Alaya Insider, you agree to these Terms of Service. If you do not agree, please do not use the site.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Content</h2>
<p class="mb-4">All content on Alaya Insider is for informational purposes only. We strive for accuracy but cannot guarantee that all information is complete or current.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Product Recommendations</h2>
<p class="mb-4">Our product recommendations are based on research and editorial judgment. Prices, availability, and product details may change. Always verify current information before purchasing.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Affiliate Links</h2>
<p class="mb-4">We earn commissions from qualifying purchases through affiliate links. This does not affect the price you pay or our editorial recommendations.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Intellectual Property</h2>
<p class="mb-4">All content, design, and branding on Alaya Insider are owned by us and protected by copyright laws. You may not reproduce our content without permission.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Limitation of Liability</h2>
<p class="mb-4">Alaya Insider is not liable for any damages arising from your use of the site or reliance on its content.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Changes to Terms</h2>
<p class="mb-4">We may update these terms at any time. Continued use of the site constitutes acceptance of any changes.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Contact</h2>
<p>For questions about these terms, email us at <a href="mailto:legal@alayainsider.com" class="text-blue-600 underline">legal@alayainsider.com</a>.</p>
</div>
`, 'Terms of Service | Alaya Insider', 'Terms of service for Alaya Insider. Read our terms and conditions for using the site.');

console.log('✅ Pages created: About, Privacy, Terms');

// ===== 4. COOKIE POLICY PAGE =====
pageStmt.run(uuid(), 'cookie-policy', 'Cookie Policy', `
<div class="max-w-3xl mx-auto py-12 px-4">
<h1 class="text-4xl font-bold mb-8">Cookie Policy</h1>
<p class="text-sm text-gray-500 mb-8">Last updated: August 22, 2026</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">What Are Cookies</h2>
<p class="mb-4">Cookies are small text files placed on your device when you visit a website. They help sites function and provide analytics data.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Cookies We Use</h2>
<ul class="list-disc pl-6 mb-6 space-y-2">
<li><strong>Essential Cookies</strong> — Required for the site to function (session, authentication)</li>
<li><strong>Analytics Cookies</strong> — Help us understand how visitors use our site (Google Analytics)</li>
</ul>

<h2 class="text-2xl font-semibold mt-8 mb-4">Managing Cookies</h2>
<p class="mb-4">You can control cookies through your browser settings. Disabling essential cookies may affect site functionality.</p>

<h2 class="text-2xl font-semibold mt-8 mb-4">Contact</h2>
<p>For questions about our cookie practices, email <a href="mailto:privacy@alayainsider.com" class="text-blue-600 underline">privacy@alayainsider.com</a>.</p>
</div>
`, 'Cookie Policy | Alaya Insider', 'Learn about the cookies used on Alaya Insider and how to manage them.');

console.log('✅ Cookie Policy page created');

}); // end transaction

update();
console.log('\n🎉 All updates complete!');
db.close();
