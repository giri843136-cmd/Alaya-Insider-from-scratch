const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'images', 'hero');
fs.mkdirSync(dir, { recursive: true });

const slides = [
  { name: 'hero-1.svg', bg1: '#f8f6f3', bg2: '#ede8e3', accent: '#8b7355', title: 'ALAYA INSIDER', sub: 'Everyday Finds, Better Chosen' },
  { name: 'hero-2.svg', bg1: '#faf5f0', bg2: '#f0e8df', accent: '#9b7b6b', title: 'NEW ARRIVALS', sub: 'Easy Pieces Worth Repeating' },
  { name: 'hero-3.svg', bg1: '#f5f3f0', bg2: '#e8e4df', accent: '#7b8b7b', title: 'HOME & LIVING', sub: 'Small Changes. A Better Home.' },
  { name: 'hero-4.svg', bg1: '#f0f5f3', bg2: '#dfe8e4', accent: '#6b8b8b', title: 'TRAVEL ESSENTIALS', sub: 'Pack Better. Travel Lighter.' },
  { name: 'hero-5.svg', bg1: '#f5f0f5', bg2: '#e8dfe8', accent: '#8b7b8b', title: 'BEAUTY & WELLNESS', sub: 'Simple Additions, Better Routines' },
  { name: 'hero-6.svg', bg1: '#f0f0f5', bg2: '#dfdfe8', accent: '#7b7b8b', title: 'TECH PICKS', sub: 'Useful Tech Without the Noise' },
];

for (const s of slides) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="800" viewBox="0 0 1920 800">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${s.bg1}"/>
      <stop offset="100%" style="stop-color:${s.bg2}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${s.accent}"/>
      <stop offset="100%" style="stop-color:${s.accent}88"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="800" fill="url(#bg)"/>
  <circle cx="1500" cy="400" r="300" fill="${s.accent}" opacity="0.05"/>
  <circle cx="1600" cy="350" r="200" fill="${s.accent}" opacity="0.08"/>
  <circle cx="1400" cy="500" r="150" fill="${s.accent}" opacity="0.04"/>
  <rect x="120" y="300" width="60" height="3" fill="url(#accent)"/>
  <text x="120" y="340" font-family="Inter,Helvetica,Arial,sans-serif" font-size="14" font-weight="600" letter-spacing="3" fill="${s.accent}">${s.title}</text>
  <text x="120" y="400" font-family="Inter,Helvetica,Arial,sans-serif" font-size="48" font-weight="700" fill="#2d2a26">${s.sub}</text>
  <text x="120" y="450" font-family="Inter,Helvetica,Arial,sans-serif" font-size="18" fill="#8a8580">Curated products that earn their place in your life.</text>
  <rect x="120" y="490" width="180" height="50" rx="25" fill="${s.accent}"/>
  <text x="210" y="522" font-family="Inter,Helvetica,Arial,sans-serif" font-size="15" font-weight="600" fill="white" text-anchor="middle">Explore</text>
</svg>`;
  fs.writeFileSync(path.join(dir, s.name), svg);
  console.log('Created', s.name);
}

console.log('All 6 hero images created');
