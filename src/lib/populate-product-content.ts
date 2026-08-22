import getDb from './db';

/**
 * Populates product SEO fields, images, and replaces demo affiliate URLs.
 * Safe to run multiple times.
 */
export function populateProductContent() {
  const db = getDb();

  const PRODUCTS: Record<string, {
    seo_title: string;
    seo_description: string;
    image: string;
    global_url: string;
    india_url: string;
  }> = {
    'muji-aroma-diffuser': {
      seo_title: 'Muji Aroma Diffuser — Honest Review | Alaya Insider',
      seo_description: 'A beautifully minimal ultrasonic aroma diffuser that doubles as ambient lighting. See our honest recommendation and where to buy.',
      image: '/images/products/muji-aroma-diffuser.jpg',
      global_url: 'https://www.amazon.com/dp/B07PB6WX3W?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B07PB6WX3W?tag=alayainsider-21',
    },
    'aesop-resurrection-hand-wash': {
      seo_title: 'Aesop Resurrection Hand Wash — Worth It? | Alaya Insider',
      seo_description: 'Gentle hand wash with orange, rosemary, and lavender. Our honest take on whether this luxury essential is worth the price.',
      image: '/images/products/aesop-hand-wash.jpg',
      global_url: 'https://www.amazon.com/dp/B000GKDBT0?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B000GKDBT0?tag=alayainsider-21',
    },
    'le-creuset-dutch-oven': {
      seo_title: 'Le Creuset Dutch Oven 5.5 Qt — Buy-It-For-Life | Alaya Insider',
      seo_description: 'The iconic enameled cast iron Dutch oven. A kitchen investment that genuinely lasts a lifetime. Our full recommendation.',
      image: '/images/products/le-creuset-dutch-oven.jpg',
      global_url: 'https://www.amazon.com/dp/B00004S8F7?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B00004S8F7?tag=alayainsider-21',
    },
    'bang-olufsen-beoplay-h95': {
      seo_title: 'B&O Beoplay H95 — Premium Wireless Headphones | Alaya Insider',
      seo_description: 'Premium wireless headphones with adaptive ANC. For those who want the absolute best in wireless audio.',
      image: '/images/products/bo-beoplay-h95.jpg',
      global_url: 'https://www.amazon.com/dp/B08FCLPYDM?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B08FCLPYDM?tag=alayainsider-21',
    },
    'away-carry-on': {
      seo_title: 'Away Carry-On — Best Travel Luggage | Alaya Insider',
      seo_description: 'Durable polycarbonate carry-on with interior compression. A practical, well-designed carry-on for frequent travelers.',
      image: '/images/products/away-carry-on.jpg',
      global_url: 'https://www.amazon.com/dp/B07C3SLKHG?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B07C3SLKHG?tag=alayainsider-21',
    },
    'muji-cotton-bed-sheets': {
      seo_title: 'Muji Organic Cotton Bed Sheets | Alaya Insider',
      seo_description: 'Organic cotton bed sheets with a soft, washed texture. Simple, well-made sheets at a fair price.',
      image: '/images/products/muji-bed-sheets.jpg',
      global_url: 'https://www.amazon.com/dp/B073P8CCPR?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B073P8CCPR?tag=alayainsider-21',
    },
    'aesop-parsley-seed-cleanser': {
      seo_title: 'Aesop Parsley Seed Cleanser — Gentle Daily Cleanser | Alaya Insider',
      seo_description: 'Gentle gel cleanser with parsley seed, grape seed, and green tea. Leaves skin clean without stripping.',
      image: '/images/products/aesop-cleanser.jpg',
      global_url: 'https://www.amazon.com/dp/B002VLY3NC?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B002VLY3NC?tag=alayainsider-21',
    },
    'le-creuset-stoneware-mug': {
      seo_title: 'Le Creuset Stoneware Mug — Daily Luxury | Alaya Insider',
      seo_description: 'Dense stoneware mug that keeps drinks hotter for longer. A small daily luxury that elevates your morning routine.',
      image: '/images/products/le-creuset-mug.jpg',
      global_url: 'https://www.amazon.com/dp/B001ATLU0S?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B001ATLU0S?tag=alayainsider-21',
    },
    'bang-olufsen-beosound-a1': {
      seo_title: 'B&O Beosound A1 — Best Portable Speaker | Alaya Insider',
      seo_description: 'Portable Bluetooth speaker with true360 omnidirectional sound. One of the best-sounding portable speakers at any price.',
      image: '/images/products/bo-beosound-a1.jpg',
      global_url: 'https://www.amazon.com/dp/B0932FG1SR?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B0932FG1SR?tag=alayainsider-21',
    },
    'muji-travel-organizer-set': {
      seo_title: 'Muji Travel Organizer Set — Minimal Packing | Alaya Insider',
      seo_description: 'Set of mesh and nylon organizer pouches for packing. Simple, functional, and well-priced travel essentials.',
      image: '/images/products/muji-travel-organizer.jpg',
      global_url: 'https://www.amazon.com/dp/B01H51LBBW?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B01H51LBBW?tag=alayainsider-21',
    },
    'aesop-reverence-hand-balm': {
      seo_title: 'Aesop Reverence Hand Balm — Deep Moisture | Alaya Insider',
      seo_description: 'Rich, nourishing hand balm with vetiver root and petitgrain. Genuinely effective with a grounding, earthy scent.',
      image: '/images/products/aesop-hand-balm.jpg',
      global_url: 'https://www.amazon.com/dp/B000GKDBU4?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B000GKDBU4?tag=alayainsider-21',
    },
    'le-creuset-skillet': {
      seo_title: 'Le Creuset Skillet 10.25\" — Versatile Cast Iron | Alaya Insider',
      seo_description: 'Cast iron skillet with enamel interior. A versatile pan that handles everything from searing to baking.',
      image: '/images/products/le-creuset-skillet.jpg',
      global_url: 'https://www.amazon.com/dp/B0076NOP2W?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B0076NOP2W?tag=alayainsider-21',
    },
    'away-everywhere-bag': {
      seo_title: 'Away Everywhere Bag — Versatile Travel Bag | Alaya Insider',
      seo_description: 'Versatile travel bag that works as a personal item or weekender. Smart organization and sturdy construction.',
      image: '/images/products/away-everywhere-bag.jpg',
      global_url: 'https://www.amazon.com/dp/B085Y8L8M1?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B085Y8L8M1?tag=alayainsider-21',
    },
    'muji-led-desk-lamp': {
      seo_title: 'Muji LED Desk Lamp — Minimal Workspace Lighting | Alaya Insider',
      seo_description: 'Minimalist LED desk lamp with adjustable brightness. Clean design that disappears into any workspace.',
      image: '/images/products/muji-desk-lamp.jpg',
      global_url: 'https://www.amazon.com/dp/B01LXHBCZ1?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B01LXHBCZ1?tag=alayainsider-21',
    },
    'bang-olufsen-beoplay-ex': {
      seo_title: 'B&O Beoplay EX — Premium True Wireless Earbuds | Alaya Insider',
      seo_description: 'Premium wireless earbuds with adaptive noise cancellation. The best-sounding true wireless earbuds we have tested.',
      image: '/images/products/bo-beoplay-ex.jpg',
      global_url: 'https://www.amazon.com/dp/B09YRCR8V2?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B09YRCR8V2?tag=alayainsider-21',
    },
    'aesop-geranium-body-cleanser': {
      seo_title: 'Aesop Geranium Leaf Body Cleanser | Alaya Insider',
      seo_description: 'Low-foam gel body cleanser with geranium leaf and bergamot. Transforms a daily shower into something genuinely pleasant.',
      image: '/images/products/aesop-body-cleanser.jpg',
      global_url: 'https://www.amazon.com/dp/B000GKDBUK?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B000GKDBUK?tag=alayainsider-21',
    },
    'muji-stainless-steel-tumbler': {
      seo_title: 'Muji Stainless Steel Tumbler — Daily Commute | Alaya Insider',
      seo_description: 'Slim, double-walled stainless steel tumbler that keeps drinks at temperature for hours. Clean, reliable, affordable.',
      image: '/images/products/muji-tumbler.jpg',
      global_url: 'https://www.amazon.com/dp/B07TFXNCYR?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B07TFXNCYR?tag=alayainsider-21',
    },
    'le-creuset-salt-pepper-mills': {
      seo_title: 'Le Creuset Salt & Pepper Mills | Alaya Insider',
      seo_description: 'Stoneware salt and pepper mills with carbon steel mechanism. Good-looking mills with reliable grind mechanisms.',
      image: '/images/products/le-creuset-mills.jpg',
      global_url: 'https://www.amazon.com/dp/B0000AN4CT?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B0000AN4CT?tag=alayainsider-21',
    },
    'away-toiletry-bag': {
      seo_title: 'Away Toiletry Bag — Travel Organization | Alaya Insider',
      seo_description: 'Water-resistant toiletry bag with smart compartments and a useful hanging hook. Well-organized travel essential.',
      image: '/images/products/away-toiletry-bag.jpg',
      global_url: 'https://www.amazon.com/dp/B08LLP4Z9C?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B08LLP4Z9C?tag=alayainsider-21',
    },
    'muji-ultrasonic-humidifier': {
      seo_title: 'Muji Ultrasonic Humidifier — Quiet & Minimal | Alaya Insider',
      seo_description: 'Quiet ultrasonic humidifier in signature minimal white. Reliable, quiet, and visually unobtrusive home essential.',
      image: '/images/products/muji-humidifier.jpg',
      global_url: 'https://www.amazon.com/dp/B07K2SWBB6?tag=alayainsider-20',
      india_url: 'https://www.amazon.in/dp/B07K2SWBB6?tag=alayainsider-21',
    },
  };

  const updateStmt = db.prepare(`
    UPDATE products
    SET seo_title = ?, seo_description = ?,
        primary_image = CASE WHEN (primary_image IS NULL OR primary_image = '') THEN ? ELSE primary_image END,
        global_affiliate_url = CASE WHEN global_affiliate_url LIKE '%example.com%' THEN ? ELSE global_affiliate_url END,
        india_affiliate_url = CASE WHEN india_affiliate_url LIKE '%example.com%' THEN ? ELSE india_affiliate_url END,
        affiliate_url = CASE WHEN affiliate_url LIKE '%example.com%' THEN ? ELSE affiliate_url END,
        updated_at = datetime('now')
    WHERE slug = ?
  `);

  // Also update affiliate_links table
  const updateLinkStmt = db.prepare(`
    UPDATE affiliate_links
    SET destination_url = ?
    WHERE product_id = (SELECT id FROM products WHERE slug = ?) AND destination_type = ?
      AND destination_url LIKE '%example.com%'
  `);

  let updated = 0;
  for (const [slug, data] of Object.entries(PRODUCTS)) {
    updateStmt.run(
      data.seo_title, data.seo_description,
      data.image,
      data.global_url, data.india_url, data.global_url,
      slug
    );
    updateLinkStmt.run(data.global_url, slug, 'global');
    updateLinkStmt.run(data.india_url, slug, 'india');
    updated++;
  }

  console.log(`Product content populated: ${updated} products updated`);
  return updated;
}
