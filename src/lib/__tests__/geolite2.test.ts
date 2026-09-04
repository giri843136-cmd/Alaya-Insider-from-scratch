/**
 * GeoLite2 refresh tests:
 *   - tar.gz extraction of the .mmdb (pure-Node parser, no system tar)
 *   - MaxMind magic validation rejects corrupt archives
 *   - refresh is atomic + keep-old-on-failure (HTTP error, bad payload, and
 *     missing license key never clobber an existing DB)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

const MMDB_MAGIC = Buffer.concat([Buffer.from([0xab, 0xcd, 0xef]), Buffer.from('MaxMind.com')]);

let tmpDir = '';
let mod: any;
let fetchMock: jest.Mock;

/** Build a real ustar .tar.gz containing the given files (for tests). */
function makeTarGz(files: { name: string; content: Buffer }[]): Buffer {
  const blocks: Buffer[] = [];

  const header = (name: string, size: number, type: string): Buffer => {
    const h = Buffer.alloc(512);
    h.write(name.slice(0, 100), 0, 'utf8');
    h.write('0000644\0', 100); // mode
    h.write('0000000\0', 108); // uid
    h.write('0000000\0', 116); // gid
    h.write(size.toString(8).padStart(11, '0') + '\0', 124);
    h.write('00000000000\0', 136); // mtime
    h.fill(0x20, 148, 156); // checksum placeholder (spaces)
    h.write(type, 156); // typeflag
    h.write('ustar\0', 257); // magic
    h.write('00', 263); // version
    // prefix (offset 345) left empty — short names fit in the 100-byte field
    let sum = 0;
    for (const b of h) sum += b;
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    return h;
  };

  for (const f of files) {
    blocks.push(header(f.name, f.content.length, '0'));
    const data = Buffer.alloc(Math.ceil(f.content.length / 512) * 512);
    f.content.copy(data);
    blocks.push(data);
  }
  blocks.push(Buffer.alloc(1024)); // two zero blocks end the archive
  return zlib.gzipSync(Buffer.concat(blocks));
}

const DB_CONTENT = () => Buffer.concat([MMDB_MAGIC, Buffer.from('fake-country-data-'.repeat(50))]);

function goodArchive(): Buffer {
  return makeTarGz([
    { name: 'GeoLite2-Country_20991231/GeoLite2-Country.mmdb', content: DB_CONTENT() },
    { name: 'GeoLite2-Country_20991231/COPYRIGHT.txt', content: Buffer.from('© 2099 MaxMind') },
  ]);
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geolite2-test-'));
  mod = await import('../geolite2');
});

afterEach(() => {
  fetchMock?.mockClear();
  delete process.env.MAXMIND_LICENSE_KEY;
  delete process.env.GEOIP_DB_PATH;
  for (const f of fs.readdirSync(tmpDir)) {
    try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ignore */ }
  }
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('extractGeoLite2Archive', () => {
  it('extracts the .mmdb and reports the MaxMind build date', () => {
    const { data, archiveDate } = mod.extractGeoLite2Archive(goodArchive());
    expect(data.subarray(0, MMDB_MAGIC.length).equals(MMDB_MAGIC)).toBe(true);
    expect(archiveDate).toBe('20991231');
  });

  it('rejects an archive without the mmdb', () => {
    const gz = makeTarGz([{ name: 'GeoLite2-Country_20991231/COPYRIGHT.txt', content: Buffer.from('x') }]);
    expect(() => mod.extractGeoLite2Archive(gz)).toThrow(/not found/);
  });

  it('rejects a payload that fails the MaxMind magic check', () => {
    const gz = makeTarGz([{ name: 'GeoLite2-Country_20991231/GeoLite2-Country.mmdb', content: Buffer.from('not-a-mmdb-'.repeat(20)) }]);
    expect(() => mod.extractGeoLite2Archive(gz)).toThrow(/magic check/);
  });

  it('rejects a non-gzip payload', () => {
    expect(() => mod.extractGeoLite2Archive(Buffer.from('plain junk'))).toThrow();
  });
});

describe('refreshGeoLite2 — atomic swap + keep-old-on-failure', () => {
  it('downloads, validates and atomically swaps the DB in', async () => {
    const target = path.join(tmpDir, 'GeoLite2-Country.mmdb');
    process.env.GEOIP_DB_PATH = target;
    process.env.MAXMIND_LICENSE_KEY = 'test-key';
    fetchMock = jest.fn(async () => new Response(goodArchive())) as any;
    (global as any).fetch = fetchMock;

    const r = await mod.refreshGeoLite2();
    expect(r.ok).toBe(true);
    expect(r.archiveDate).toBe('20991231');
    expect(r.bytes).toBe(DB_CONTENT().length);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target).subarray(0, MMDB_MAGIC.length).equals(MMDB_MAGIC)).toBe(true);
    // No temp files left behind.
    expect(fs.readdirSync(tmpDir).filter(f => f.includes('.tmp-'))).toHaveLength(0);
  });

  it('keeps the previous DB when the download fails (HTTP error)', async () => {
    const target = path.join(tmpDir, 'GeoLite2-Country.mmdb');
    fs.writeFileSync(target, 'OLD-DB-CONTENT');
    process.env.GEOIP_DB_PATH = target;
    process.env.MAXMIND_LICENSE_KEY = 'test-key';
    fetchMock = jest.fn(async () => jsonResponse({ error: 'license' }, 400)) as any;
    (global as any).fetch = fetchMock;

    const r = await mod.refreshGeoLite2();
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/license key/i);
    expect(fs.readFileSync(target, 'utf8')).toBe('OLD-DB-CONTENT');
  });

  it('keeps the previous DB when the payload is corrupt', async () => {
    const target = path.join(tmpDir, 'GeoLite2-Country.mmdb');
    fs.writeFileSync(target, 'OLD-DB-CONTENT');
    process.env.GEOIP_DB_PATH = target;
    process.env.MAXMIND_LICENSE_KEY = 'test-key';
    fetchMock = jest.fn(async () => new Response(Buffer.from('totally-not-a-tarball'))) as any;
    (global as any).fetch = fetchMock;

    const r = await mod.refreshGeoLite2();
    expect(r.ok).toBe(false);
    expect(fs.readFileSync(target, 'utf8')).toBe('OLD-DB-CONTENT');
  });

  it('skips cleanly (no fetch, old kept) when no license key is configured', async () => {
    const target = path.join(tmpDir, 'GeoLite2-Country.mmdb');
    fs.writeFileSync(target, 'OLD-DB-CONTENT');
    process.env.GEOIP_DB_PATH = target;
    delete process.env.MAXMIND_LICENSE_KEY;
    fetchMock = jest.fn() as any;
    (global as any).fetch = fetchMock;

    const r = await mod.refreshGeoLite2();
    expect(r.ok).toBe(false);
    expect(r.skipped).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fs.readFileSync(target, 'utf8')).toBe('OLD-DB-CONTENT');
  });
});
