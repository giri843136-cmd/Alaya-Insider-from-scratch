import {
  IN_FIXES, US_FIXES, US_NEUTRALIZE, ARCHIVE_NO_LISTING, DRAFT_COM_ONLY,
  inUrl, usUrl, IN_TAG, US_TAG,
} from '@/lib/amazon-link-fixes';

describe('amazon-link-fixes maps', () => {
  it('builds tagged URLs per marketplace', () => {
    expect(inUrl('B0AAAA1111')).toBe(`https://www.amazon.in/dp/B0AAAA1111?tag=${IN_TAG}`);
    expect(usUrl('B0AAAA1111')).toBe(`https://www.amazon.com/dp/B0AAAA1111?tag=${US_TAG}`);
  });

  it('has the audited fix counts', () => {
    expect(Object.keys(IN_FIXES)).toHaveLength(12);
    expect(Object.keys(US_FIXES)).toHaveLength(16);
    expect(US_NEUTRALIZE).toHaveLength(4);
    expect(ARCHIVE_NO_LISTING).toHaveLength(4);
    expect(DRAFT_COM_ONLY).toHaveLength(4);
  });

  it('keeps the status lists consistent with the fix maps', () => {
    // Drafted products (.com only) must carry a US fix.
    for (const slug of DRAFT_COM_ONLY) {
      expect(US_FIXES[slug]).toBeTruthy();
    }
    // Archived/neutralized products have no listing on EITHER store.
    for (const slug of US_NEUTRALIZE) {
      expect(US_FIXES[slug]).toBeUndefined();
      expect(IN_FIXES[slug]).toBeUndefined();
    }
    // A product with a US fix should never be neutralized.
    for (const slug of Object.keys(US_FIXES)) {
      expect(US_NEUTRALIZE).not.toContain(slug);
      expect(ARCHIVE_NO_LISTING).not.toContain(slug);
    }
    // Archive list is exactly the neutralization list (neither store present).
    expect([...ARCHIVE_NO_LISTING].sort()).toEqual([...US_NEUTRALIZE].sort());
  });

  it('has no duplicate keys inside each fix map', () => {
    expect(new Set(Object.keys(IN_FIXES)).size).toBe(Object.keys(IN_FIXES).length);
    expect(new Set(Object.keys(US_FIXES)).size).toBe(Object.keys(US_FIXES).length);
  });
});