/**
 * GeoLite2-Country refresh helper used by POST /api/cron/geolite2.
 *
 * Downloads the free MaxMind GeoLite2 Country DB (≈6 MB), extracts the .mmdb
 * with a small pure-Node tar parser (no system `tar` dependency), validates
 * the MaxMind binary magic, and swaps it into place ATOMICALLY:
 *
 *   - the new file is written to a temp name in the same directory, then
 *     fs.renameSync'd over the target — readers never see a partial file
 *   - ANY failure (network, HTTP, bad archive, bad magic) leaves the previous
 *     .mmdb untouched (keep-old-on-failure)
 *
 * Note: the running process keeps serving the DB it mapped at boot until the
 * app is restarted/redeployed — the swap updates the file on disk so the next
 * restart (or a subsequent request after a process restart) uses the new DB.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

export const GEO_DB_DEFAULT = './data/GeoLite2-Country.mmdb';

/** Where the mmdb lives (honours GEOIP_DB_PATH, same default as src/lib/geo.ts). */
export function geolite2TargetPath(): string {
  return path.resolve(process.cwd(), process.env.GEOIP_DB_PATH || GEO_DB_DEFAULT);
}

export function maxmindLicenseKey(): string {
  return (process.env.MAXMIND_LICENSE_KEY || '').trim();
}

/** MaxMind .mmdb files start with 0xAB 0xCD 0xEF "MaxMind.com". */
const MMDB_MAGIC = Buffer.concat([Buffer.from([0xab, 0xcd, 0xef]), Buffer.from('MaxMind.com')]);

/** Minimal ustar (+ GNU longname) tar reader — returns { name, data } entries. */
function parseTar(buf: Buffer): { name: string; data: Buffer }[] {
  const entries: { name: string; data: Buffer }[] = [];
  let off = 0;
  let pendingLongName = '';

  const str = (start: number, len: number): string => {
    const s = buf.toString('utf8', off + start, off + start + len);
    const nul = s.indexOf('\0');
    return (nul >= 0 ? s.slice(0, nul) : s).trim();
  };
  const fieldSize = (start: number, len: number): number => {
    const first = buf[off + start];
    if (first & 0x80) { // base-256 encoding (large files)
      let v = first & 0x7f;
      for (let i = 1; i < len; i++) v = v * 256 + buf[off + start + i];
      return v;
    }
    return parseInt(str(start, len) || '0', 8) || 0;
  };

  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every(b => b === 0)) break; // end-of-archive marker
    const type = str(156, 1);
    const size = fieldSize(124, 12);
    const name = str(0, 100);
    const prefix = str(345, 155);

    const data = size > 0
      ? Buffer.from(buf.subarray(off + 512, off + 512 + Math.min(size, buf.length - off - 512)))
      : Buffer.alloc(0);

    if (type === 'L') { // GNU long name: data holds the real name of the next entry
      pendingLongName = data.toString('utf8').replace(/\0+$/, '').trim();
    } else if (type !== 'x' && type !== 'g') { // skip PAX records; keep real entries
      const full = pendingLongName || (prefix ? `${prefix}/${name}` : name);
      entries.push({ name: full, data });
      pendingLongName = '';
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export interface ExtractedDb {
  data: Buffer;
  /** Build date from the archive folder, e.g. GeoLite2-Country_20260904 → 20260904. */
  archiveDate: string;
}

/**
 * Extract the GeoLite2-Country .mmdb from a downloaded .tar.gz payload.
 * Throws when the archive is malformed, the mmdb is missing, or the magic
 * check fails (so callers never install a corrupt file).
 */
export function extractGeoLite2Archive(gz: Buffer): ExtractedDb {
  const tar = zlib.gunzipSync(gz);
  const entries = parseTar(tar);
  const mmdb = entries.find(e =>
    e.name === 'GeoLite2-Country.mmdb' || e.name.endsWith('/GeoLite2-Country.mmdb'));
  if (!mmdb) throw new Error('GeoLite2-Country.mmdb not found in archive');
  if (mmdb.data.length < MMDB_MAGIC.length || !mmdb.data.subarray(0, MMDB_MAGIC.length).equals(MMDB_MAGIC)) {
    throw new Error('Downloaded file failed the MaxMind magic check — not a valid .mmdb');
  }
  const dated = entries.find(e => /GeoLite2-Country_(\d{8})/.test(e.name));
  const m = dated ? dated.name.match(/GeoLite2-Country_(\d{8})/) : null;
  return { data: mmdb.data, archiveDate: m ? m[1] : '' };
}

export interface RefreshResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  target?: string;
  bytes?: number;
  archiveDate?: string;
}



/**
 * Download + atomically swap the GeoLite2 Country DB. Never throws: returns
 * { ok:false, reason } on every failure and leaves any existing DB in place.
 */
export async function refreshGeoLite2(): Promise<RefreshResult> {
  const key = maxmindLicenseKey();
  const target = geolite2TargetPath();
  if (!key) {
    return { ok: false, skipped: true, reason: 'MAXMIND_LICENSE_KEY not set (see RUNBOOK — Install GeoLite2)', target };
  }

  const url = 'https://download.maxmind.com/app/geoip_download'
    + `?edition_id=GeoLite2-Country&license_key=${encodeURIComponent(key)}&suffix=tar.gz`;

  const tmp = path.join(path.dirname(target), `.GeoLite2-Country.mmdb.tmp-${process.pid}-${Date.now()}`);
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const reason = /license/i.test(body)
        ? `MaxMind rejected the license key (HTTP ${res.status})`
        : `Download failed (HTTP ${res.status})`;
      return { ok: false, reason, target };
    }
    const gz = Buffer.from(await res.arrayBuffer());
    const { data, archiveDate } = extractGeoLite2Archive(gz);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(tmp, data); // same directory → rename is atomic on one filesystem
    fs.renameSync(tmp, target);  // keep-old-on-failure: only replaced on success

    return { ok: true, target, bytes: data.length, archiveDate };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e), target };
  } finally {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}
