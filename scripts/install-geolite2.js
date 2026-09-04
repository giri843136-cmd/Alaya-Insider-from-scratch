#!/usr/bin/env node
/**
 * Alaya Insider — GeoLite2-Country installer.
 *
 * Downloads the free MaxMind GeoLite2 Country database (≈6 MB) and installs
 * it as data/GeoLite2-Country.mmdb so src/lib/geo.ts can route visitors by
 * IP. Requires a free MaxMind account + license key:
 *
 *   1. https://www.maxmind.com/en/geolite2/signup
 *   2. Account → Manage License Keys → generate a key
 *   3. node scripts/install-geolite2.js --license-key=XXXXXXXX
 *
 * The license key is read from the --license-key flag or the MAXMIND_LICENSE_KEY
 * env var and is only sent to MaxMind's download endpoint — never logged.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const argKey = (process.argv.find(a => a.startsWith('--license-key=')) || '').split('=')[1];
const licenseKey = (argKey || process.env.MAXMIND_LICENSE_KEY || '').trim();

if (!licenseKey) {
  console.error('Missing license key. Pass --license-key=XXXX or set MAXMIND_LICENSE_KEY.');
  console.error('Get a free key: https://www.maxmind.com/en/geolite2/signup → Manage License Keys');
  process.exit(1);
}

const target = path.resolve(process.cwd(), process.env.GEOIP_DB_PATH || './data/GeoLite2-Country.mmdb');
const url = 'https://download.maxmind.com/app/geoip_download'
  + `?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(licenseKey)}&suffix=tar.gz`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geolite2-'));
const archive = path.join(tmpDir, 'GeoLite2-Country.tar.gz');

(async () => {
  console.log('Downloading GeoLite2-Country from MaxMind…');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Download failed (HTTP ${res.status}).`);
    if (/license/i.test(text)) console.error('The license key was rejected — check it in your MaxMind account.');
    process.exit(1);
  }
  fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));

  console.log('Extracting…');
  const r = spawnSync('tar', ['-xzf', archive, '-C', tmpDir], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('tar extraction failed — extract the archive manually and place GeoLite2-Country.mmdb at', target);
    process.exit(1);
  }

  const mmdb = (function find(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) {
        const hit = find(p);
        if (hit) return hit;
      } else if (name === 'GeoLite2-Country.mmdb') {
        return p;
      }
    }
    return null;
  })(tmpDir);

  if (!mmdb) {
    console.error('GeoLite2-Country.mmdb not found in the downloaded archive.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(mmdb, target);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`Installed ${target} (${(fs.statSync(target).size / 1024 / 1024).toFixed(1)} MB).`);
  console.log('Restart the app — geo.ts picks the DB up on the first request.');
})().catch(e => {
  console.error('Failed:', e?.message || e);
  process.exit(1);
});
