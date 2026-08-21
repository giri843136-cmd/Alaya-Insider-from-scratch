import getDb from './db';

/**
 * Populates all category/subcategory SEO fields and descriptions.
 * Safe to run multiple times — always updates to latest content.
 */
export function populateCategoryContent() {
  const db = getDb();

  const CONTENT: Record<string, {
    description: string;
    seo_title: string;
    seo_description: string;
    children: Record<string, { description: string; seo_title: string; seo_description: string }>;
  }> = {
    fashion: {
      description: 'Easy pieces, polished essentials and everyday styles worth discovering.',
      seo_title: 'Fashion — Curated Style Picks | Alaya Insider',
      seo_description: 'Discover curated fashion finds — from everyday dresses and polished workwear to bags, shoes and accessories worth adding to your wardrobe.',
      children: {
        dresses: { description: 'Easy silhouettes for workdays, weekends and everything between.', seo_title: 'Dresses Worth Discovering | Alaya Insider', seo_description: 'Curated dress picks for every occasion — easy silhouettes for workdays, weekends and everything in between.' },
        tops: { description: 'Polished everyday tops that pair with almost anything.', seo_title: 'Everyday Tops & Blouses | Alaya Insider', seo_description: 'Polished everyday tops and blouses that pair with almost anything. Simple, wearable, worth repeating.' },
        'co-ords': { description: 'Matching sets that make getting dressed feel effortless.', seo_title: 'Co-ord Sets & Matching Pieces | Alaya Insider', seo_description: 'Matching co-ord sets that make getting dressed feel effortless. Curated picks for easy, put-together outfits.' },
        workwear: { description: 'Smart pieces for polished workday wardrobes.', seo_title: 'Workwear & Office Style | Alaya Insider', seo_description: 'Smart workwear pieces for polished office wardrobes. Professional style that feels comfortable and intentional.' },
        shoes: { description: 'Everyday footwear worth adding to the rotation.', seo_title: 'Shoes & Footwear Picks | Alaya Insider', seo_description: 'Everyday shoes and footwear worth adding to your rotation. From comfortable flats to versatile sneakers.' },
        bags: { description: 'Useful, stylish bags for work, weekends and travel.', seo_title: 'Bags & Handbags | Alaya Insider', seo_description: 'Useful, stylish bags for work, weekends and travel. Curated picks from everyday totes to weekend duffels.' },
        accessories: { description: 'Small finishing touches that pull a look together.', seo_title: 'Fashion Accessories | Alaya Insider', seo_description: 'Small finishing touches that pull a look together. Jewellery, scarves, belts and everyday accessories.' },
      },
    },
    home: {
      description: 'Thoughtful pieces for spaces that feel more like you.',
      seo_title: 'Home — Thoughtful Living Finds | Alaya Insider',
      seo_description: 'Thoughtful home finds — from kitchen essentials and bedroom upgrades to lighting, decor and furniture worth investing in.',
      children: {
        'living-room': { description: 'Comfortable, considered pieces for the heart of your home.', seo_title: 'Living Room Finds | Alaya Insider', seo_description: 'Comfortable, considered pieces for the heart of your home. Curated living room picks worth discovering.' },
        bedroom: { description: 'Soft upgrades for a calmer, more inviting bedroom.', seo_title: 'Bedroom Essentials | Alaya Insider', seo_description: 'Soft upgrades for a calmer, more inviting bedroom. Bedding, lighting and small touches that improve rest.' },
        kitchen: { description: 'Useful tools and beautiful additions for everyday cooking.', seo_title: 'Thoughtful Kitchen Finds | Alaya Insider', seo_description: 'Useful kitchen tools and beautiful additions for everyday cooking. Cookware, utensils and essentials worth having.' },
        decor: { description: 'Small details that make a space feel finished.', seo_title: 'Home Decor & Details | Alaya Insider', seo_description: 'Small details that make a space feel finished. Curated home decor picks — vases, candles, art and thoughtful objects.' },
        lighting: { description: 'Lighting that changes the mood without overwhelming the room.', seo_title: 'Lighting & Lamps | Alaya Insider', seo_description: 'Lighting that changes the mood without overwhelming the room. Desk lamps, ambient lighting and practical picks.' },
        organization: { description: 'Smart solutions for keeping everyday spaces beautifully under control.', seo_title: 'Home Organization | Alaya Insider', seo_description: 'Smart organization solutions for keeping everyday spaces beautifully under control. Storage, shelving and useful systems.' },
        furniture: { description: 'Functional statement pieces for spaces you actually live in.', seo_title: 'Furniture Picks | Alaya Insider', seo_description: 'Functional furniture statement pieces for spaces you actually live in. Desks, chairs, shelves and practical investments.' },
      },
    },
    beauty: {
      description: 'Simple additions for better everyday routines.',
      seo_title: 'Beauty — Everyday Routine Picks | Alaya Insider',
      seo_description: 'Simple beauty additions for better everyday routines. Skincare, makeup, haircare and wellness picks worth trying.',
      children: {
        skincare: { description: 'Simple skincare finds for everyday routines.', seo_title: 'Everyday Skincare Picks | Alaya Insider', seo_description: 'Simple skincare finds for everyday routines. Cleansers, moisturizers, serums and honest recommendations.' },
        makeup: { description: 'Easy makeup picks for polished everyday looks.', seo_title: 'Makeup & Cosmetics | Alaya Insider', seo_description: 'Easy makeup picks for polished everyday looks. Foundation, concealer, lip colour and everyday cosmetics.' },
        haircare: { description: 'Tools and products for healthier-looking, easier hair days.', seo_title: 'Haircare Picks | Alaya Insider', seo_description: 'Tools and products for healthier-looking, easier hair days. Shampoo, styling tools and practical haircare picks.' },
        'body-care': { description: 'Everyday body care worth making room for.', seo_title: 'Body Care Essentials | Alaya Insider', seo_description: 'Everyday body care worth making room for. Body wash, lotion, hand cream and personal care picks.' },
        fragrance: { description: 'Distinctive scents for different moods and moments.', seo_title: 'Fragrance & Scents | Alaya Insider', seo_description: 'Distinctive scents for different moods and moments. Perfume, cologne, candles and home fragrance picks.' },
        'beauty-tools': { description: 'Practical tools that make routines easier.', seo_title: 'Beauty Tools & Devices | Alaya Insider', seo_description: 'Practical beauty tools that make routines easier. Brushes, devices, organisers and professional-grade picks.' },
        'beauty-wellness': { description: 'Small upgrades for feeling better day to day.', seo_title: 'Wellness & Self Care | Alaya Insider', seo_description: 'Small wellness upgrades for feeling better day to day. Supplements, aromatherapy and mindful living picks.' },
      },
    },
    electronics: {
      description: 'Useful technology, selected without the noise.',
      seo_title: 'Electronics — Useful Tech Picks | Alaya Insider',
      seo_description: 'Useful technology selected without the noise. Headphones, smart home devices, audio gear and practical tech worth having.',
      children: {
        headphones: { description: 'Immersive listening for work, travel and downtime.', seo_title: 'Headphones & Earbuds | Alaya Insider', seo_description: 'Immersive headphones and earbuds for work, travel and downtime. Over-ear, in-ear and wireless picks worth hearing.' },
        'smart-home': { description: 'Useful connected upgrades for a smarter home.', seo_title: 'Smart Home Devices | Alaya Insider', seo_description: 'Useful connected upgrades for a smarter home. Smart speakers, lighting, cameras and automation picks.' },
        computers: { description: 'Practical computing picks for work and everyday life.', seo_title: 'Computers & Laptops | Alaya Insider', seo_description: 'Practical computing picks for work and everyday life. Laptops, monitors, peripherals and desk setup essentials.' },
        'phone-accessories': { description: 'Useful extras that make your phone work harder.', seo_title: 'Phone Accessories | Alaya Insider', seo_description: 'Useful phone accessories that make your device work harder. Cases, chargers, mounts and practical add-ons.' },
        wearables: { description: 'Smart devices for staying connected and informed.', seo_title: 'Wearable Tech | Alaya Insider', seo_description: 'Smart wearable devices for staying connected and informed. Smartwatches, fitness trackers and everyday wearables.' },
        'home-tech': { description: 'Technology that quietly improves everyday routines.', seo_title: 'Home Tech & Gadgets | Alaya Insider', seo_description: 'Home technology that quietly improves everyday routines. Routers, projectors, appliances and practical gadgets.' },
        audio: { description: 'Speakers and sound essentials worth hearing.', seo_title: 'Speakers & Audio | Alaya Insider', seo_description: 'Speakers and sound essentials worth hearing. Bluetooth speakers, soundbars, turntables and listening gear.' },
      },
    },
    travel: {
      description: 'Smart essentials for easier journeys.',
      seo_title: 'Travel — Smart Journey Essentials | Alaya Insider',
      seo_description: 'Smart travel essentials for easier journeys. Luggage, carry-ons, travel bags, packing tools and weekend getaway picks.',
      children: {
        luggage: { description: 'Reliable travel pieces designed to go the distance.', seo_title: 'Luggage & Suitcases | Alaya Insider', seo_description: 'Reliable luggage and suitcases designed to go the distance. Checked bags, spinner wheels and durable travel picks.' },
        'carry-on': { description: 'Smart cabin-ready options for easier trips.', seo_title: 'Carry-On Luggage | Alaya Insider', seo_description: 'Smart carry-on luggage for easier trips. Cabin-size suitcases, personal items and airline-approved picks.' },
        'travel-bags': { description: 'Practical bags for airports, weekends and everyday movement.', seo_title: 'Travel Bags & Duffels | Alaya Insider', seo_description: 'Practical travel bags for airports, weekends and everyday movement. Duffels, weekenders and versatile travel bags.' },
        'travel-accessories': { description: 'Small travel essentials that make a noticeable difference.', seo_title: 'Travel Accessories | Alaya Insider', seo_description: 'Small travel accessories that make a noticeable difference. Organisers, adapters, pillows and useful travel extras.' },
        packing: { description: 'Useful tools for fitting more into less space.', seo_title: 'Packing Solutions | Alaya Insider', seo_description: 'Useful packing tools for fitting more into less space. Packing cubes, compression bags and organiser sets.' },
        'travel-tech': { description: 'Gadgets that keep journeys organized and connected.', seo_title: 'Travel Tech & Gadgets | Alaya Insider', seo_description: 'Travel tech gadgets that keep journeys organised and connected. Portable chargers, adapters and travel-friendly tech.' },
        'weekend-essentials': { description: 'Easy picks for short trips and spontaneous getaways.', seo_title: 'Weekend Getaway Essentials | Alaya Insider', seo_description: 'Easy picks for short trips and spontaneous getaways. Weekend bags, toiletry kits and quick-trip essentials.' },
      },
    },
    lifestyle: {
      description: 'Curated finds for everyday living.',
      seo_title: 'Lifestyle — Everyday Living Finds | Alaya Insider',
      seo_description: 'Curated lifestyle finds for everyday living. Wellness, fitness, desk essentials, gifts and outdoor living picks.',
      children: {
        'lifestyle-wellness': { description: 'Thoughtful everyday picks for feeling your best.', seo_title: 'Wellness Finds | Alaya Insider', seo_description: 'Thoughtful everyday wellness picks for feeling your best. Mindfulness, supplements, aromatherapy and daily rituals.' },
        fitness: { description: 'Useful gear for staying active without the clutter.', seo_title: 'Fitness & Active Living | Alaya Insider', seo_description: 'Useful fitness gear for staying active without the clutter. Workout equipment, activewear and practical fitness picks.' },
        'everyday-essentials': { description: 'Reliable finds for the things you use most.', seo_title: 'Everyday Essentials | Alaya Insider', seo_description: 'Reliable everyday essentials for the things you use most. Practical picks that quietly improve daily routines.' },
        'desk-office': { description: 'Simple upgrades for better workdays.', seo_title: 'Desk & Office Picks | Alaya Insider', seo_description: 'Simple desk and office upgrades for better workdays. Stationery, desk accessories, chairs and workspace essentials.' },
        gifts: { description: 'Thoughtful finds for birthdays, holidays and just because.', seo_title: 'Gift Ideas | Alaya Insider', seo_description: 'Thoughtful gift ideas for birthdays, holidays and just because. Curated picks for every budget and occasion.' },
        'self-care': { description: 'Small rituals and useful products worth slowing down for.', seo_title: 'Self Care Picks | Alaya Insider', seo_description: 'Small self-care rituals and useful products worth slowing down for. Relaxation, journaling, candles and comfort picks.' },
        'outdoor-living': { description: 'Practical pieces for making more of your time outside.', seo_title: 'Outdoor Living | Alaya Insider', seo_description: 'Practical outdoor living pieces for making more of your time outside. Patio, garden, camping and outdoor essentials.' },
      },
    },
  };

  const updateStmt = db.prepare(`
    UPDATE categories SET description = ?, seo_title = ?, seo_description = ?, updated_at = datetime('now')
    WHERE slug = ?
  `);

  const updateImageStmt = db.prepare(`
    UPDATE categories SET image = ?, updated_at = datetime('now')
    WHERE slug = ? AND (image IS NULL OR image = '')
  `);

  // All known category images (path relative to public/)
  const IMAGES: Record<string, string> = {
    'fashion': '/images/categories/fashion.jpg',
    'home': '/images/categories/home.jpg',
    'beauty': '/images/categories/beauty.jpg',
    'electronics': '/images/categories/electronics.jpg',
    'travel': '/images/categories/travel.jpg',
    'lifestyle': '/images/categories/lifestyle.jpg',
    'dresses': '/images/categories/dresses.jpg',
    'tops': '/images/categories/tops.jpg',
    'co-ords': '/images/categories/co-ords.jpg',
    'workwear': '/images/categories/workwear.jpg',
    'shoes': '/images/categories/shoes.jpg',
    'bags': '/images/categories/bags.jpg',
    'accessories': '/images/categories/accessories.jpg',
    'living-room': '/images/categories/living-room.jpg',
    'bedroom': '/images/categories/bedroom.jpg',
    'kitchen': '/images/categories/kitchen.jpg',
    'decor': '/images/categories/decor.jpg',
    'lighting': '/images/categories/lighting.jpg',
    'organization': '/images/categories/organization.jpg',
    'furniture': '/images/categories/furniture.jpg',
    'skincare': '/images/categories/skincare.jpg',
    'makeup': '/images/categories/makeup.jpg',
    'haircare': '/images/categories/haircare.jpg',
    'body-care': '/images/categories/body-care.jpg',
    'fragrance': '/images/categories/fragrance.jpg',
    'beauty-tools': '/images/categories/beauty-tools.jpg',
    'beauty-wellness': '/images/categories/beauty-wellness.jpg',
    'headphones': '/images/categories/headphones.jpg',
    'smart-home': '/images/categories/smart-home.jpg',
    'computers': '/images/categories/computers.jpg',
    'phone-accessories': '/images/categories/phone-accessories.jpg',
    'wearables': '/images/categories/wearables.jpg',
    'home-tech': '/images/categories/home-tech.jpg',
    'audio': '/images/categories/audio.jpg',
    'luggage': '/images/categories/luggage.jpg',
    'carry-on': '/images/categories/carry-on.jpg',
    'travel-bags': '/images/categories/travel-bags.jpg',
    'travel-accessories': '/images/categories/travel-accessories.jpg',
    'packing': '/images/categories/packing.jpg',
    'travel-tech': '/images/categories/travel-tech.jpg',
    'weekend-essentials': '/images/categories/weekend-essentials.jpg',
    'lifestyle-wellness': '/images/categories/lifestyle-wellness.jpg',
    'fitness': '/images/categories/fitness.jpg',
    'everyday-essentials': '/images/categories/everyday-essentials.jpg',
    'desk-office': '/images/categories/desk-office.jpg',
    'gifts': '/images/categories/gifts.jpg',
    'self-care': '/images/categories/self-care.jpg',
    'outdoor-living': '/images/categories/outdoor-living.jpg',
  };

  let updated = 0;
  for (const [slug, data] of Object.entries(CONTENT)) {
    updateStmt.run(data.description, data.seo_title, data.seo_description, slug);
    if (IMAGES[slug]) updateImageStmt.run(IMAGES[slug], slug);
    updated++;
    for (const [childSlug, childData] of Object.entries(data.children)) {
      updateStmt.run(childData.description, childData.seo_title, childData.seo_description, childSlug);
      if (IMAGES[childSlug]) updateImageStmt.run(IMAGES[childSlug], childSlug);
      updated++;
    }
  }

  console.log(`Category content populated: ${updated} categories updated`);
  return updated;
}
