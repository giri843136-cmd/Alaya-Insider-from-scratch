const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'data', 'alaya.db'));

// Update all categories with images and SEO
const catUpdates = [
  // Main categories
  { slug: 'fashion', image: '/images/categories/fashion.jpg', seo_title: 'Fashion — Curated Style Essentials | Alaya Insider', seo_description: 'Discover our hand-picked selection of fashion essentials. From minimalist basics to statement pieces, find what works for your everyday style.' },
  { slug: 'home', image: '/images/categories/home.jpg', seo_title: 'Home — Thoughtful Living Essentials | Alaya Insider', seo_description: 'Curated home essentials for spaces that feel more like you. Kitchen, bedroom, living room, and decor finds worth investing in.' },
  { slug: 'beauty', image: '/images/categories/beauty.jpg', seo_title: 'Beauty — Simple Additions for Better Routines | Alaya Insider', seo_description: 'Hand-picked beauty products that genuinely improve your daily routine. Skincare, haircare, body care, and fragrance picks.' },
  { slug: 'electronics', image: '/images/categories/electronics.jpg', seo_title: 'Electronics — Useful Technology, Selected Without the Noise | Alaya Insider', seo_description: 'Curated electronics picks — headphones, smart home, audio, and wearables that are actually worth buying.' },
  { slug: 'travel', image: '/images/categories/travel.jpg', seo_title: 'Travel — Smart Essentials for Easier Journeys | Alaya Insider', seo_description: 'Travel essentials selected for real travelers. Luggage, carry-ons, travel accessories, and packing solutions.' },
  { slug: 'lifestyle', image: '/images/categories/lifestyle.jpg', seo_title: 'Lifestyle — Curated Finds for Everyday Living | Alaya Insider', seo_description: 'Wellness, fitness, desk essentials, and everyday upgrades curated for thoughtful living.' },
  // Fashion subcategories
  { slug: 'dresses', image: '/images/categories/dresses.jpg', seo_title: 'Best Dresses — Day to Evening Styles | Alaya Insider', seo_description: 'Our curated selection of dresses for every occasion, from casual daywear to elegant evening styles.' },
  { slug: 'tops', image: '/images/categories/tops.jpg', seo_title: 'Everyday Tops — Quality Layers | Alaya Insider', seo_description: 'Essential tops and layers picked for comfort, quality, and versatility in your everyday wardrobe.' },
  { slug: 'co-ords', image: '/images/categories/co-ords.jpg', seo_title: 'Co-ords & Matching Sets — Effortless Style | Alaya Insider', seo_description: 'Effortless matching sets and co-ords that take the guesswork out of getting dressed.' },
  { slug: 'workwear', image: '/images/categories/workwear.jpg', seo_title: 'Workwear — Office-Ready Pieces | Alaya Insider', seo_description: 'Professional pieces that work as hard as you do. Office-ready clothing worth investing in.' },
  { slug: 'shoes', image: '/images/categories/shoes.jpg', seo_title: 'Shoes — Steps Worth Taking | Alaya Insider', seo_description: 'Footwear picks for comfort, style, and quality. Everyday shoes that earn their place in your wardrobe.' },
  { slug: 'bags', image: '/images/categories/bags.jpg', seo_title: 'Bags — Carry It Well | Alaya Insider', seo_description: 'Well-designed bags for work, travel, and everyday life. Quality options at every price point.' },
  { slug: 'accessories', image: '/images/categories/accessories.jpg', seo_title: 'Accessories — Finishing Touches | Alaya Insider', seo_description: 'The finishing touches that complete any outfit. Curated accessories for everyday wear.' },
  // Home subcategories
  { slug: 'living-room', image: '/images/categories/living-room.jpg', seo_title: 'Living Room Essentials — Where Life Happens | Alaya Insider', seo_description: 'Curated living room essentials that make your space comfortable, functional, and stylish.' },
  { slug: 'bedroom', image: '/images/categories/bedroom.jpg', seo_title: 'Bedroom Essentials — Rest Well | Alaya Insider', seo_description: 'Quality bedding and bedroom essentials for better rest and a more peaceful space.' },
  { slug: 'kitchen', image: '/images/categories/kitchen.jpg', seo_title: 'Kitchen Essentials — Cook With Intention | Alaya Insider', seo_description: 'Kitchen essentials picked for quality, design, and lasting value. Cookware, tools, and everyday pieces.' },
  { slug: 'decor', image: '/images/categories/decor.jpg', seo_title: 'Home Decor — Details That Matter | Alaya Insider', seo_description: 'Home decor finds that add character and warmth to any space without breaking the bank.' },
  { slug: 'lighting', image: '/images/categories/lighting.jpg', seo_title: 'Lighting — Set the Mood | Alaya Insider', seo_description: 'Lighting solutions that transform spaces. Desk lamps, ambient lighting, and fixtures worth buying.' },
  { slug: 'organization', image: '/images/categories/organization.jpg', seo_title: 'Organization — Everything in Place | Alaya Insider', seo_description: 'Smart organization solutions to keep your home tidy, functional, and stress-free.' },
  { slug: 'furniture', image: '/images/categories/furniture.jpg', seo_title: 'Furniture — Built to Last | Alaya Insider', seo_description: 'Quality furniture picks built to last. Invest in pieces you will love for years to come.' },
  // Beauty subcategories
  { slug: 'skincare', image: '/images/categories/skincare.jpg', seo_title: 'Skincare — Healthy Foundations | Alaya Insider', seo_description: 'Skincare essentials that build a solid foundation for healthy, glowing skin.' },
  { slug: 'makeup', image: '/images/categories/makeup.jpg', seo_title: 'Makeup — Enhance Naturally | Alaya Insider', seo_description: 'Makeup picks that enhance your natural beauty. Quality cosmetics for everyday wear.' },
  { slug: 'haircare', image: '/images/categories/haircare.jpg', seo_title: 'Haircare — Better Hair Days | Alaya Insider', seo_description: 'Haircare products that deliver real results. Shampoos, treatments, and styling essentials.' },
  { slug: 'body-care', image: '/images/categories/body-care.jpg', seo_title: 'Body Care — Head to Toe | Alaya Insider', seo_description: 'Body care essentials from cleansers to moisturizers. Quality products for your whole body.' },
  { slug: 'fragrance', image: '/images/categories/fragrance.jpg', seo_title: 'Fragrance — Signature Scents | Alaya Insider', seo_description: 'Fragrances worth wearing. From everyday scents to special occasion picks.' },
  { slug: 'beauty-tools', image: '/images/categories/beauty-tools.jpg', seo_title: 'Beauty Tools — Professional Grade | Alaya Insider', seo_description: 'Beauty tools and accessories that elevate your routine. Professional quality at home.' },
  { slug: 'beauty-wellness', image: '/images/categories/beauty-wellness.jpg', seo_title: 'Beauty & Wellness — Feel Your Best | Alaya Insider', seo_description: 'Wellness products that complement your beauty routine. Inside-out beauty essentials.' },
  // Electronics subcategories
  { slug: 'headphones', image: '/images/categories/headphones.jpg', seo_title: 'Best Headphones — Your Sound, Perfected | Alaya Insider', seo_description: 'Curated headphone picks for music lovers. Wireless, noise-cancelling, and audiophile options.' },
  { slug: 'smart-home', image: '/images/categories/smart-home.jpg', seo_title: 'Smart Home — Live Smarter | Alaya Insider', seo_description: 'Smart home products that actually improve daily life. Voice assistants, lighting, and automation.' },
  { slug: 'computers', image: '/images/categories/computers.jpg', seo_title: 'Computers — Power Your Work | Alaya Insider', seo_description: 'Computers and accessories selected for performance, design, and value.' },
  { slug: 'phone-accessories', image: '/images/categories/phone-accessories.jpg', seo_title: 'Phone Accessories — Better Connected | Alaya Insider', seo_description: 'Phone accessories that are actually worth buying. Cases, chargers, and essentials.' },
  { slug: 'wearables', image: '/images/categories/wearables.jpg', seo_title: 'Wearables — Tech You Wear | Alaya Insider', seo_description: 'Wearable tech that tracks, motivates, and integrates with your daily life.' },
  { slug: 'home-tech', image: '/images/categories/home-tech.jpg', seo_title: 'Home Tech — Upgrade Your Space | Alaya Insider', seo_description: 'Home technology that makes life easier. Smart devices, gadgets, and tech essentials.' },
  { slug: 'audio', image: '/images/categories/audio.jpg', seo_title: 'Audio — Premium Listening | Alaya Insider', seo_description: 'Premium audio equipment for the best listening experience. Speakers, headphones, and more.' },
  // Travel subcategories
  { slug: 'luggage', image: '/images/categories/luggage.jpg', seo_title: 'Best Luggage — Travel With Confidence | Alaya Insider', seo_description: 'Luggage that goes the distance. Durable, well-designed suitcases and travel bags.' },
  { slug: 'carry-on', image: '/images/categories/carry-on.jpg', seo_title: 'Carry-On Luggage — Cabin Ready | Alaya Insider', seo_description: 'Carry-on bags that meet airline requirements and keep your essentials organized.' },
  { slug: 'travel-bags', image: '/images/categories/travel-bags.jpg', seo_title: 'Travel Bags — Beyond the Suitcase | Alaya Insider', seo_description: 'Travel bags for every need. Duffels, weekenders, and versatile bags for all your trips.' },
  { slug: 'travel-accessories', image: '/images/categories/travel-accessories.jpg', seo_title: 'Travel Accessories — Small but Essential | Alaya Insider', seo_description: 'Travel accessories that make journeys smoother. Packing cubes, adapters, and travel essentials.' },
  { slug: 'packing', image: '/images/categories/packing.jpg', seo_title: 'Packing Essentials — Pack Smarter | Alaya Insider', seo_description: 'Packing solutions that help you travel light and organized. Organizers, cubes, and bags.' },
  { slug: 'travel-tech', image: '/images/categories/travel-tech.jpg', seo_title: 'Travel Tech — Stay Connected | Alaya Insider', seo_description: 'Travel tech essentials. Chargers, adapters, and gadgets for staying connected on the road.' },
  { slug: 'weekend-essentials', image: '/images/categories/weekend-essentials.jpg', seo_title: 'Weekend Essentials — Quick Getaway | Alaya Insider', seo_description: 'Everything you need for a perfect weekend getaway. Packing lists and product picks.' },
  // Lifestyle subcategories
  { slug: 'lifestyle-wellness', image: '/images/categories/lifestyle-wellness.jpg', seo_title: 'Wellness — Mind and Body | Alaya Insider', seo_description: 'Wellness products for a healthier, more balanced lifestyle. Mind, body, and soul essentials.' },
  { slug: 'fitness', image: '/images/categories/fitness.jpg', seo_title: 'Fitness — Move Well | Alaya Insider', seo_description: 'Fitness gear and essentials that motivate you to move. Quality equipment for every level.' },
  { slug: 'everyday-essentials', image: '/images/categories/everyday-essentials.jpg', seo_title: 'Everyday Essentials — Daily Upgrades | Alaya Insider', seo_description: 'Small upgrades that make everyday life better. Daily essentials picked for quality and value.' },
  { slug: 'desk-office', image: '/images/categories/desk-office.jpg', seo_title: 'Desk & Office — Work Better | Alaya Insider', seo_description: 'Desk and office essentials for a more productive, comfortable workspace.' },
  { slug: 'gifts', image: '/images/categories/gifts.jpg', seo_title: 'Gifts — Give Thoughtfully | Alaya Insider', seo_description: 'Thoughtful gift ideas for every occasion and budget. Curated picks for everyone on your list.' },
  { slug: 'self-care', image: '/images/categories/self-care.jpg', seo_title: 'Self Care — Take a Moment | Alaya Insider', seo_description: 'Self care essentials for when you need to pause, recharge, and prioritize yourself.' },
  { slug: 'outdoor-living', image: '/images/categories/outdoor-living.jpg', seo_title: 'Outdoor Living — Step Outside | Alaya Insider', seo_description: 'Outdoor living essentials for your patio, garden, and beyond. Quality picks for outdoor spaces.' },
];

const updateStmt = db.prepare('UPDATE categories SET image = ?, seo_title = ?, seo_description = ?, updated_at = datetime("now") WHERE slug = ?');

let updated = 0;
for (const cat of catUpdates) {
  const result = updateStmt.run(cat.image, cat.seo_title, cat.seo_description, cat.slug);
  if (result.changes > 0) {
    updated++;
    console.log(`✅ ${cat.slug} — image + SEO updated`);
  } else {
    console.log(`⚠️ ${cat.slug} — not found`);
  }
}

console.log(`\nTotal updated: ${updated}/${catUpdates.length}`);
db.close();
