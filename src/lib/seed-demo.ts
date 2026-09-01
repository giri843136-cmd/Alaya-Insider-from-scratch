import getDb from './db';
import { v4 as uuid } from 'uuid';

export function seedDemoData() {
  const db = getDb();
  if ((db.prepare('SELECT COUNT(*) as cnt FROM products').get() as any).cnt > 0) return;

  // Categories
  const categories: Record<string, string> = {};
  const catData = [
    { name: 'Fashion', slug: 'fashion', desc: 'Easy pieces, polished essentials and everyday styles worth discovering.', featured: 1, children: [
      { name: 'Dresses', slug: 'dresses', desc: 'From day to evening' },
      { name: 'Tops', slug: 'tops', desc: 'Everyday layers' },
      { name: 'Co-ords', slug: 'co-ords', desc: 'Effortless sets' },
      { name: 'Workwear', slug: 'workwear', desc: 'Office-ready pieces' },
      { name: 'Shoes', slug: 'shoes', desc: 'Steps worth taking' },
      { name: 'Bags', slug: 'bags', desc: 'Carry it well' },
      { name: 'Accessories', slug: 'accessories', desc: 'Finishing touches' },
    ]},
    { name: 'Home', slug: 'home', desc: 'Thoughtful pieces for spaces that feel more like you.', featured: 1, children: [
      { name: 'Living Room', slug: 'living-room', desc: 'Where life happens' },
      { name: 'Bedroom', slug: 'bedroom', desc: 'Rest well' },
      { name: 'Kitchen', slug: 'kitchen', desc: 'Cook with intention' },
      { name: 'Decor', slug: 'decor', desc: 'Details that matter' },
      { name: 'Lighting', slug: 'lighting', desc: 'Set the mood' },
      { name: 'Organization', slug: 'organization', desc: 'Everything in place' },
      { name: 'Furniture', slug: 'furniture', desc: 'Built to last' },
    ]},
    { name: 'Beauty', slug: 'beauty', desc: 'Simple additions for better everyday routines.', featured: 1, children: [
      { name: 'Skincare', slug: 'skincare', desc: 'Healthy foundations' },
      { name: 'Makeup', slug: 'makeup', desc: 'Enhance naturally' },
      { name: 'Haircare', slug: 'haircare', desc: 'Better hair days' },
      { name: 'Body Care', slug: 'body-care', desc: 'Head to toe' },
      { name: 'Fragrance', slug: 'fragrance', desc: 'Signature scents' },
      { name: 'Beauty Tools', slug: 'beauty-tools', desc: 'Professional grade' },
      { name: 'Wellness', slug: 'beauty-wellness', desc: 'Feel your best' },
    ]},
    { name: 'Electronics', slug: 'electronics', desc: 'Useful technology, selected without the noise.', featured: 1, children: [
      { name: 'Headphones', slug: 'headphones', desc: 'Your sound, perfected' },
      { name: 'Smart Home', slug: 'smart-home', desc: 'Live smarter' },
      { name: 'Computers', slug: 'computers', desc: 'Power your work' },
      { name: 'Phone Accessories', slug: 'phone-accessories', desc: 'Better connected' },
      { name: 'Wearables', slug: 'wearables', desc: 'Tech you wear' },
      { name: 'Home Tech', slug: 'home-tech', desc: 'Upgrade your space' },
      { name: 'Audio', slug: 'audio', desc: 'Premium listening' },
    ]},
    { name: 'Travel', slug: 'travel', desc: 'Smart essentials for easier journeys.', featured: 1, children: [
      { name: 'Luggage', slug: 'luggage', desc: 'Travel with confidence' },
      { name: 'Carry-On', slug: 'carry-on', desc: 'Cabin-ready' },
      { name: 'Travel Bags', slug: 'travel-bags', desc: 'Beyond the suitcase' },
      { name: 'Travel Accessories', slug: 'travel-accessories', desc: 'Small but essential' },
      { name: 'Packing', slug: 'packing', desc: 'Pack smarter' },
      { name: 'Travel Tech', slug: 'travel-tech', desc: 'Stay connected' },
      { name: 'Weekend Essentials', slug: 'weekend-essentials', desc: 'Quick getaway' },
    ]},
    { name: 'Lifestyle', slug: 'lifestyle', desc: 'Curated finds for everyday living.', featured: 1, children: [
      { name: 'Wellness', slug: 'lifestyle-wellness', desc: 'Mind and body' },
      { name: 'Fitness', slug: 'fitness', desc: 'Move well' },
      { name: 'Everyday Essentials', slug: 'everyday-essentials', desc: 'Daily upgrades' },
      { name: 'Desk & Office', slug: 'desk-office', desc: 'Work better' },
      { name: 'Gifts', slug: 'gifts', desc: 'Give thoughtfully' },
      { name: 'Self Care', slug: 'self-care', desc: 'Take a moment' },
      { name: 'Outdoor Living', slug: 'outdoor-living', desc: 'Step outside' },
    ]},
  ];
  const catStmt = db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, description, parent_id, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let catOrder = 0;
  for (const cat of catData) {
    const pid = uuid(); categories[cat.slug] = pid;
    catStmt.run(pid, cat.name, cat.slug, cat.desc, null, cat.featured, catOrder++);
    let subOrder = 0;
    for (const ch of cat.children) { const cid = uuid(); categories[ch.slug] = cid; catStmt.run(cid, ch.name, ch.slug, ch.desc || '', pid, 0, subOrder++); }
  }

  // Brands
  const brands: Record<string, string> = {};
  const brandData = [
    { name: 'Muji', slug: 'muji', desc: 'Japanese minimalist lifestyle brand' },
    { name: 'Aesop', slug: 'aesop', desc: 'Australian luxury skincare' },
    { name: 'Le Creuset', slug: 'le-creuset', desc: 'Premium French cookware' },
    { name: 'Bang & Olufsen', slug: 'bang-olufsen', desc: 'Danish luxury electronics' },
    { name: 'Away', slug: 'away', desc: 'Modern travel essentials' },
  ];
  const brandStmt = db.prepare('INSERT OR IGNORE INTO brands (id, name, slug, description, is_featured) VALUES (?, ?, ?, ?, 1)');
  for (const b of brandData) { const id = uuid(); brands[b.slug] = id; brandStmt.run(id, b.name, b.slug, b.desc); }

  // Products with dual destinations
  const products: { id: string; slug: string; name: string }[] = [];
  const productData = [
    { name: 'Muji Aroma Diffuser', slug: 'muji-aroma-diffuser', brand: 'muji', cat: 'home', subcat: 'decor', price: 69, prev: 79, rating: 4.6, reviews: 2847, desc: 'A beautifully minimal ultrasonic aroma diffuser that doubles as ambient lighting.', why: 'An elegant everyday diffuser combining simplicity with excellent functionality.', bestFor: 'Minimalists who want a reliable, good-looking diffuser', benefits: ['Ultra-quiet operation','Warm ambient LED light','Easy to clean','Compact design'], pros: ['Beautiful minimal design','Very quiet','Good mist output'], cons: ['Small water tank','No timer options'], featured: 1, trending: 1, editors: 0 },
    { name: 'Aesop Resurrection Hand Wash', slug: 'aesop-resurrection-hand-wash', brand: 'aesop', cat: 'beauty', subcat: 'skincare', price: 40, prev: null, rating: 4.8, reviews: 1523, desc: 'Gentle hand wash with orange, rosemary, and lavender essential oils.', why: 'A daily luxury that makes routine handwashing feel like a spa moment.', bestFor: 'Anyone who appreciates elevated everyday essentials', benefits: ['Botanical ingredients','Distinctive scent','Gentle on skin','Beautiful packaging'], pros: ['Incredible scent','Moisturizing formula','Iconic design'], cons: ['Premium price point'], featured: 1, trending: 0, editors: 1 },
    { name: 'Le Creuset Dutch Oven 5.5 Qt', slug: 'le-creuset-dutch-oven', brand: 'le-creuset', cat: 'home', subcat: 'kitchen', price: 379.95, prev: 419, rating: 4.9, reviews: 8934, desc: 'The iconic enameled cast iron Dutch oven.', why: 'A kitchen investment that genuinely lasts a lifetime.', bestFor: 'Home cooks who want buy-it-for-life cookware', benefits: ['Lifetime durability','Even heat distribution','Versatile cooking','Beautiful presentation'], pros: ['Exceptional build quality','Gorgeous colors','Works on all heat sources'], cons: ['Heavy','Expensive'], featured: 1, trending: 1, editors: 1 },
    { name: 'Bang & Olufsen Beoplay H95', slug: 'bang-olufsen-beoplay-h95', brand: 'bang-olufsen', cat: 'electronics', subcat: 'audio', price: 799, prev: 899, rating: 4.7, reviews: 456, desc: 'Premium wireless headphones with adaptive ANC.', why: 'For those who want the absolute best in wireless audio.', bestFor: 'Audiophiles and design-conscious listeners', benefits: ['Exceptional sound quality','Premium materials','38-hour battery','Adaptive ANC'], pros: ['Outstanding audio clarity','Beautiful aluminum design','Incredible comfort'], cons: ['Very expensive','Bulky carrying case'], featured: 0, trending: 1, editors: 1 },
    { name: 'Away Carry-On', slug: 'away-carry-on', brand: 'away', cat: 'travel', subcat: 'luggage', price: 275, prev: null, rating: 4.5, reviews: 3201, desc: 'Durable polycarbonate carry-on with interior compression system.', why: 'A practical, well-designed carry-on that balances durability with smart features.', bestFor: 'Frequent travelers who want reliable, stylish luggage', benefits: ['Durable polycarbonate shell','Interior compression','Smooth spinner wheels','TSA-approved lock'], pros: ['Excellent build quality','Great interior organization','Smooth wheels'], cons: ['No external pockets','Slightly heavy'], featured: 1, trending: 0, editors: 0 },
    { name: 'Muji Cotton Bed Sheets', slug: 'muji-cotton-bed-sheets', brand: 'muji', cat: 'home', subcat: 'bedroom', price: 89, prev: 109, rating: 4.4, reviews: 1876, desc: 'Organic cotton bed sheets with a soft, washed texture.', why: 'Simple, well-made sheets at a fair price.', bestFor: 'Those who prefer simple, quality bedding', benefits: ['Organic cotton','Gets softer over time','Minimalist design'], pros: ['Very comfortable','Improves with washing','Good value'], cons: ['Wrinkles easily','Colors are muted'], featured: 0, trending: 0, editors: 0 },
    { name: 'Aesop Parsley Seed Cleanser', slug: 'aesop-parsley-seed-cleanser', brand: 'aesop', cat: 'beauty', subcat: 'skincare', price: 45, prev: null, rating: 4.7, reviews: 987, desc: 'Gentle gel cleanser with parsley seed, grape seed, and green tea.', why: 'A gentle daily cleanser that leaves skin clean without stripping.', bestFor: 'Normal to combination skin', benefits: ['Antioxidant-rich formula','Gentle cleansing','Pleasant herbal scent'], pros: ['Very gentle','Nice consistency','Effective cleansing'], cons: ['Expensive for a cleanser'], featured: 0, trending: 0, editors: 1 },
    { name: 'Le Creuset Stoneware Mug', slug: 'le-creuset-stoneware-mug', brand: 'le-creuset', cat: 'home', subcat: 'kitchen', price: 22, prev: 25, rating: 4.6, reviews: 4521, desc: 'Dense stoneware mug that keeps drinks hotter for longer.', why: 'A small daily luxury that elevates your morning routine.', bestFor: 'Coffee and tea lovers', benefits: ['Excellent heat retention','Chip-resistant stoneware','Dishwasher safe','Beautiful colors'], pros: ['Keeps drinks hot','Very durable','Beautiful colors'], cons: ['Heavier than typical mugs','Pricey for a mug'], featured: 0, trending: 1, editors: 0 },
    { name: 'Bang & Olufsen Beosound A1', slug: 'bang-olufsen-beosound-a1', brand: 'bang-olufsen', cat: 'electronics', subcat: 'audio', price: 250, prev: 279, rating: 4.5, reviews: 2134, desc: 'Portable Bluetooth speaker with true360 omnidirectional sound.', why: 'One of the best-sounding portable speakers at any price.', bestFor: 'Music lovers who want premium portable audio', benefits: ['True360 sound','IP67 waterproof','18-hour battery'], pros: ['Exceptional sound for size','Beautiful design','Waterproof'], cons: ['Expensive','Bass limited by size'], featured: 0, trending: 0, editors: 1 },
    { name: 'Muji Travel Organizer Set', slug: 'muji-travel-organizer-set', brand: 'muji', cat: 'travel', subcat: 'travel-accessories', price: 35, prev: null, rating: 4.3, reviews: 1245, desc: 'Set of mesh and nylon organizer pouches for packing.', why: 'Simple, functional, and well-priced.', bestFor: 'Organized packers who prefer minimal design', benefits: ['Lightweight mesh','Multiple sizes','Easy to pack'], pros: ['Very lightweight','Practical sizing','Great value'], cons: ['Thin material','Basic zippers'], featured: 0, trending: 0, editors: 0 },
    { name: 'Aesop Reverence Hand Balm', slug: 'aesop-reverence-hand-balm', brand: 'aesop', cat: 'beauty', subcat: 'skincare', price: 33, prev: null, rating: 4.8, reviews: 876, desc: 'Rich, nourishing hand balm with vetiver root and petitgrain.', why: 'A genuinely effective hand balm with a grounding, earthy scent.', bestFor: 'Those with dry hands', benefits: ['Rich moisturizing','Non-greasy','Calming scent'], pros: ['Deeply moisturizing','Beautiful scent','Absorbs quickly'], cons: ['Pricey','Small tube'], featured: 0, trending: 0, editors: 0 },
    { name: 'Le Creuset Skillet 10.25"', slug: 'le-creuset-skillet', brand: 'le-creuset', cat: 'home', subcat: 'kitchen', price: 199.95, prev: 225, rating: 4.8, reviews: 3456, desc: 'Cast iron skillet with enamel interior.', why: 'A versatile pan that handles everything from searing to baking.', bestFor: 'Home cooks who want versatile cast iron', benefits: ['No seasoning needed','Superior heat retention','Easy to clean enamel'], pros: ['Excellent searing','Easy maintenance','Beautiful design'], cons: ['Heavy','Expensive'], featured: 1, trending: 0, editors: 0 },
    { name: 'Away Everywhere Bag', slug: 'away-everywhere-bag', brand: 'away', cat: 'travel', subcat: 'travel-accessories', price: 195, prev: null, rating: 4.4, reviews: 1876, desc: 'Versatile travel bag that works as a personal item or weekender.', why: 'A thoughtfully designed travel bag with smart organization.', bestFor: 'Travelers who need a versatile personal item', benefits: ['Fits under airplane seats','Multiple compartments','Laptop sleeve'], pros: ['Great organization','Sturdy construction','Versatile use'], cons: ['Pricey','Stiff when new'], featured: 0, trending: 0, editors: 0 },
    { name: 'Muji LED Desk Lamp', slug: 'muji-led-desk-lamp', brand: 'muji', cat: 'home', subcat: 'lighting', price: 59, prev: 69, rating: 4.5, reviews: 1432, desc: 'Minimalist LED desk lamp with adjustable brightness.', why: 'Clean design that disappears into any workspace.', bestFor: 'Minimalists who want a simple desk lamp', benefits: ['Adjustable brightness','Color temperature control','USB charging port'], pros: ['Clean design','Good light quality','Energy efficient'], cons: ['Base could be heavier','Limited reach'], featured: 0, trending: 0, editors: 0 },
    { name: 'Bang & Olufsen Beoplay EX', slug: 'bang-olufsen-beoplay-ex', brand: 'bang-olufsen', cat: 'electronics', subcat: 'audio', price: 399, prev: 449, rating: 4.6, reviews: 789, desc: 'Premium wireless earbuds with adaptive noise cancellation.', why: 'The best-sounding true wireless earbuds we have tested.', bestFor: 'Audio enthusiasts', benefits: ['Adaptive ANC','Crystal-clear calls','IP57 protection'], pros: ['Outstanding sound quality','Effective ANC','Comfortable fit'], cons: ['Expensive','Average battery life'], featured: 0, trending: 1, editors: 0 },
    { name: 'Aesop Geranium Leaf Body Cleanser', slug: 'aesop-geranium-body-cleanser', brand: 'aesop', cat: 'beauty', subcat: 'skincare', price: 45, prev: null, rating: 4.7, reviews: 654, desc: 'Low-foam gel body cleanser with geranium leaf and bergamot.', why: 'Transforms a daily shower into something genuinely pleasant.', bestFor: 'Those looking to upgrade their shower routine', benefits: ['Gentle botanical formula','Subtle lasting scent','Non-drying'], pros: ['Luxurious experience','Great scent','Gentle on skin'], cons: ['Very expensive','Runs out quickly'], featured: 0, trending: 0, editors: 0 },
    { name: 'Muji Stainless Steel Tumbler', slug: 'muji-stainless-steel-tumbler', brand: 'muji', cat: 'home', subcat: 'kitchen', price: 24, prev: null, rating: 4.3, reviews: 2345, desc: 'Slim, double-walled stainless steel tumbler.', why: 'Clean, reliable tumbler that keeps drinks at temperature for hours.', bestFor: 'Daily commuters', benefits: ['Double-wall insulation','Slim design','Leak-proof lid'], pros: ['Fits in bags easily','Good insulation','Affordable'], cons: ['Small capacity','Hand wash only'], featured: 0, trending: 0, editors: 0 },
    { name: 'Le Creuset Salt & Pepper Mills', slug: 'le-creuset-salt-pepper-mills', brand: 'le-creuset', cat: 'home', subcat: 'kitchen', price: 72, prev: 85, rating: 4.4, reviews: 1234, desc: 'Stoneware salt and pepper mills with carbon steel mechanism.', why: 'Good-looking mills with reliable grind mechanisms.', bestFor: 'Le Creuset enthusiasts', benefits: ['Adjustable grind','Carbon steel mechanism','Beautiful design'], pros: ['Great looking','Reliable grinding','Sturdy build'], cons: ['Expensive for mills','Small capacity'], featured: 0, trending: 0, editors: 0 },
    { name: 'Away Toiletry Bag', slug: 'away-toiletry-bag', brand: 'away', cat: 'travel', subcat: 'travel-accessories', price: 75, prev: null, rating: 4.2, reviews: 987, desc: 'Water-resistant toiletry bag with smart compartments.', why: 'Well-organized with a useful hanging hook.', bestFor: 'Travelers who want an organized toiletry bag', benefits: ['Water-resistant','Hanging hook','Multiple compartments'], pros: ['Good organization','Durable material','Easy to clean'], cons: ['Pricey','Hook could be stronger'], featured: 0, trending: 0, editors: 0 },
    { name: 'Muji Ultrasonic Humidifier', slug: 'muji-ultrasonic-humidifier', brand: 'muji', cat: 'home', subcat: 'decor', price: 79, prev: 89, rating: 4.4, reviews: 1567, desc: 'Quiet ultrasonic humidifier in signature minimal white.', why: 'Reliable, quiet, and visually unobtrusive.', bestFor: 'Those who want effective humidification', benefits: ['Ultra-quiet','Auto shut-off','Adjustable mist'], pros: ['Very quiet','Clean design','Effective output'], cons: ['Small tank','No humidity sensor'], featured: 0, trending: 0, editors: 0 },
  ];

  const prodStmt = db.prepare(`INSERT OR IGNORE INTO products (id, name, slug, brand_id, category_id, subcategory_id,
    current_price, previous_price, rating, review_count, short_description, why_we_recommend, best_for,
    benefits, pros, cons, status, is_featured, is_trending, is_editors_pick,
    global_affiliate_url, global_affiliate_network, global_cta_label, global_active,
    india_affiliate_url, india_affiliate_network, india_cta_label, india_active,
    affiliate_url, marketplace, affiliate_network, cta_text, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?,
    ?, ?, ?, 1, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'))`);

  const linkStmt = db.prepare('INSERT OR IGNORE INTO affiliate_links (id, product_id, slug, destination_url, destination_type, affiliate_network, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)');

  for (const p of productData) {
    const id = uuid();
    const globalUrl = `https://example.com/global/${p.slug}`;
    const indiaUrl = `https://example.com/india/${p.slug}`;
    prodStmt.run(id, p.name, p.slug, brands[p.brand], categories[p.cat], categories[p.subcat],
      p.price, p.prev, p.rating, p.reviews, p.desc, p.why, p.bestFor,
      JSON.stringify(p.benefits), JSON.stringify(p.pros), JSON.stringify(p.cons),
      p.featured, p.trending, p.editors,
      globalUrl, 'Amazon Associates', 'Explore Global Options',
      indiaUrl, 'Amazon Associates', 'Explore India',
      globalUrl, 'Amazon', 'Amazon Associates', 'Check Price');
    linkStmt.run(uuid(), id, `${p.slug}-global`, globalUrl, 'global', 'Amazon Associates');
    linkStmt.run(uuid(), id, `${p.slug}-india`, indiaUrl, 'india', 'Amazon Associates');
    products.push({ id, slug: p.slug, name: p.name });
  }

  // Collections
  const collStmt = db.prepare('INSERT OR IGNORE INTO collections (id, name, slug, description, is_active, sort_order) VALUES (?, ?, ?, ?, 1, ?)');
  const cpStmt = db.prepare('INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)');
  [
    { name: 'Quiet Luxury', slug: 'quiet-luxury', desc: 'Understated quality for everyday living.' },
    { name: 'Small Space Living', slug: 'small-space-living', desc: 'Smart products for compact spaces.' },
    { name: 'Weekend Ready', slug: 'weekend-ready', desc: 'Everything for a great weekend.' },
  ].forEach((c, i) => {
    const cid = uuid(); collStmt.run(cid, c.name, c.slug, c.desc, i);
    products.slice(i * 5, i * 5 + 6).forEach((p, j) => cpStmt.run(cid, p.id, j));
  });

  // Articles
  const artCats = db.prepare('SELECT * FROM article_categories').all() as any[];
  const bgCat = artCats.find((c: any) => c.slug === 'buying-guides');
  const rvCat = artCats.find((c: any) => c.slug === 'product-reviews');
  const trCat = artCats.find((c: any) => c.slug === 'trends');
  const admin = db.prepare('SELECT id FROM users LIMIT 1').get() as any;
  const artStmt = db.prepare(`INSERT OR IGNORE INTO articles (id, title, slug, subtitle, category_id, author_id, content, excerpt, reading_time, status, is_featured, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, datetime('now'))`);

  artStmt.run(uuid(), 'The Best Kitchen Essentials for 2024', 'best-kitchen-essentials-2024', 'A practical guide to outfitting your kitchen', bgCat?.id, admin?.id, '<p>A well-equipped kitchen does not require dozens of specialized tools.</p><h2>Our Top Picks</h2><p>After researching dozens of products, these are the kitchen essentials we recommend most confidently.</p>', 'A practical guide to kitchen tools worth investing in.', 8, 1);
  artStmt.run(uuid(), 'Honest Review: Aesop Skincare Range', 'aesop-skincare-review', 'Is the premium price justified?', rvCat?.id, admin?.id, '<p>Aesop has built a reputation for sophisticated skincare. But at premium prices, is it worth it?</p><h2>The Verdict</h2><p>The products genuinely perform well.</p>', 'A three-month test of Aesop bestsellers.', 6, 0);
  artStmt.run(uuid(), 'Smart Home Products Worth Your Attention', 'smart-home-products-2024', 'Technology that actually improves daily life', trCat?.id, admin?.id, '<p>Not every smart home product is worth buying. Here are the ones that genuinely earn their place.</p>', 'Smart home products that actually improve daily routines.', 5, 0);

  // Comparisons
  const compStmt = db.prepare("INSERT OR IGNORE INTO comparisons (id, title, slug, description, product_ids, status) VALUES (?, ?, ?, ?, ?, 'published')");
  const p1 = products.find(p => p.slug === 'bang-olufsen-beoplay-h95');
  const p2 = products.find(p => p.slug === 'bang-olufsen-beoplay-ex');
  const p3 = products.find(p => p.slug === 'le-creuset-dutch-oven');
  const p4 = products.find(p => p.slug === 'le-creuset-skillet');
  if (p1 && p2) compStmt.run(uuid(), 'Beoplay H95 vs Beoplay EX', 'beoplay-h95-vs-beoplay-ex', 'Over-ear luxury vs true wireless', JSON.stringify([p1.id, p2.id]));
  if (p3 && p4) compStmt.run(uuid(), 'Le Creuset Dutch Oven vs Skillet', 'le-creuset-dutch-oven-vs-skillet', 'Two iconic pieces compared', JSON.stringify([p3.id, p4.id]));

  // Sample clicks
  const clickStmt = db.prepare('INSERT OR IGNORE INTO affiliate_clicks (id, product_id, destination_type, source_page, device, clicked_at) VALUES (?, ?, ?, ?, ?, ?)');
  const devices = ['desktop', 'mobile', 'tablet'];
  const dests = ['global', 'india'];
  for (let i = 0; i < 15; i++) {
    const rp = products[Math.floor(Math.random() * products.length)];
    const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random() * 30));
    clickStmt.run(uuid(), rp.id, dests[i % 2], '/products', devices[i % 3], d.toISOString());
  }

  // Subscribers
  const subStmt = db.prepare('INSERT OR IGNORE INTO newsletter_subscribers (id, email, first_name, source) VALUES (?, ?, ?, ?)');
  subStmt.run(uuid(), 'reader@example.com', 'Alex', 'homepage');
  subStmt.run(uuid(), 'shopper@example.com', 'Jordan', 'product_page');

  console.log('Demo data seeded successfully');
}
