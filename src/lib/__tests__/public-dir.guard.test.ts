/**
 * Security guard for the public/ directory.
 *
 * public/auth-test.html shipped a real-looking credential pair as form
 * defaults and POSTed them to /api/auth/login from production
 * (alayainsider.com/auth-test.html, removed in the same commit as this test).
 * public/visual-test.html was the same class of file: a dev QA harness
 * publicly served in prod.
 *
 * This test fails the suite if any such file reappears.
 */
import fs from 'fs';
import path from 'path';

const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.txt', '.json', '.xml', '.svg']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('public/ directory security guard', () => {
  const publicDir = path.join(process.cwd(), 'public');

  it('public/ exists (sanity: guard is wired to the right directory)', () => {
    expect(fs.existsSync(publicDir)).toBe(true);
  });

  it('contains no auth-test / debug / login dev files', () => {
    const offenders = walk(publicDir).filter((f) =>
      /(auth-test|debug|login)/i.test(path.basename(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('contains no visual-test QA harness files', () => {
    const offenders = walk(publicDir).filter((f) => /visual-test/i.test(path.basename(f)));
    expect(offenders).toEqual([]);
  });

  it('contains no static file posting to auth endpoints (credential-default pages)', () => {
    const offenders = walk(publicDir)
      .filter((f) => TEXT_EXT.has(path.extname(f).toLowerCase()))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('/api/auth/login'));
    expect(offenders).toEqual([]);
  });
});
