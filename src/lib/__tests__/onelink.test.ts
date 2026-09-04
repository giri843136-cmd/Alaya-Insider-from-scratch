/**
 * OneLink snippet sanitization. The admin may paste Amazon's OneLink snippet,
 * but only <script src="https://…"> tags on Amazon-owned hosts may ever be
 * injected into the root layout. Everything else is rejected.
 */

import { validateOneLinkSnippet } from '../onelink';

describe('validateOneLinkSnippet', () => {
  it('accepts a single amazon-adsystem.com script', () => {
    const v = validateOneLinkSnippet('<script src="https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US"></script>');
    expect(v.ok).toBe(true);
    expect(v.srcs).toEqual(['https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=US']);
  });

  it('accepts multiple Amazon-hosted scripts', () => {
    const v = validateOneLinkSnippet(
      '<script src="https://z-eu.amazon-adsystem.com/widgets/onejs?MarketPlace=DE"></script>\n<script src="https://aax-us-east.amazon-adsystem.com/x/js/onejs.js"></script>'
    );
    expect(v.ok).toBe(true);
    expect(v.srcs).toHaveLength(2);
  });

  it('accepts amazon.com / amazon.co.uk hosts', () => {
    expect(validateOneLinkSnippet('<script src="https://www.amazon.com/widgets/one.js"></script>').ok).toBe(true);
    expect(validateOneLinkSnippet('<script src="https://images-eu.amazon.co.uk/js/onelink.js"></script>').ok).toBe(true);
  });

  it('rejects a non-Amazon script host', () => {
    const v = validateOneLinkSnippet('<script src="https://evil.example.com/x.js"></script>');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/not an Amazon-owned domain/i);
  });

  it('rejects subdomains that just look Amazon-ish (evil-amazon.com)', () => {
    const v = validateOneLinkSnippet('<script src="https://evil-amazon.com/x.js"></script>');
    expect(v.ok).toBe(false);
  });

  it('rejects inline script bodies (never inject arbitrary JS)', () => {
    const v = validateOneLinkSnippet('<script>document.write("pwned")</script>');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/inline/i);
  });

  it('rejects a script without src', () => {
    const v = validateOneLinkSnippet('<script type="text/javascript"></script>');
    expect(v.ok).toBe(false);
  });

  it('rejects non-https src', () => {
    const v = validateOneLinkSnippet('<script src="http://z-na.amazon-adsystem.com/x.js"></script>');
    expect(v.ok).toBe(false);
  });

  it('rejects a src that is not a URL (javascript: or bare path)', () => {
    expect(validateOneLinkSnippet('<script src="javascript:alert(1)"></script>').ok).toBe(false);
    expect(validateOneLinkSnippet('<script src="/local.js"></script>').ok).toBe(false);
  });

  it('rejects HTML that is not pure script tags', () => {
    const v = validateOneLinkSnippet('<iframe src="https://z-na.amazon-adsystem.com/x"></iframe><script src="https://z-na.amazon-adsystem.com/x.js"></script>');
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/only contain <script>/i);
  });

  it('rejects empty input', () => {
    expect(validateOneLinkSnippet('').ok).toBe(false);
    expect(validateOneLinkSnippet('   ').ok).toBe(false);
  });
});