import { parseImportCsv, amazonUrl, splitCsvLine, IMPORT_COLUMNS } from '@/lib/product-import';

describe('splitCsvLine', () => {
  it('handles quoted fields with commas', () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });
  it('handles escaped quotes', () => {
    expect(splitCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x']);
  });
  it('handles CRLF and trailing spaces', () => {
    expect(parseImportCsv('name,category\n  Foo,Bar  \r\n').rows[0].name).toBe('Foo');
  });
});

describe('parseImportCsv', () => {
  const header = 'name,category,brand,india_asin,us_asin,pros,tags,status';

  it('parses a valid row and builds amazon URLs', () => {
    const { rows } = parseImportCsv(`${header}\nKurti Set,Women,KurtiBrand,B0AAAA1111,B0BBBB2222,Comfy|Breathable,tag1|tag2,published`);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.errors).toEqual([]);
    expect(r.pros).toEqual(['Comfy', 'Breathable']);
    expect(r.tags).toEqual(['tag1', 'tag2']);
    expect(r.status).toBe('published');
    expect(amazonUrl('in', 'B0AAAA1111')).toBe('https://www.amazon.in/dp/B0AAAA1111?tag=alayainsider-21');
    expect(amazonUrl('com', 'B0AAAA1111')).toBe('https://www.amazon.com/dp/B0AAAA1111?tag=alayainsider-20');
  });

  it('flags rows missing required columns', () => {
    const { rows } = parseImportCsv(`${header}\n,,,B0AAAA1111,\n`);
    expect(rows[0].errors).toContain('missing name');
    expect(rows[0].errors).toContain('missing category');
  });

  it('rejects malformed ASINs', () => {
    const { rows } = parseImportCsv(`${header}\nKurti,Women,,abc123,,`);
    expect(rows[0].errors.some(e => e.includes('india_asin'))).toBe(true);
  });

  it('requires at least one ASIN', () => {
    const { rows } = parseImportCsv(`${header}\nKurti,Women,,\n`);
    expect(rows[0].errors).toContain('needs india_asin and/or us_asin');
  });

  it('normalises ASINs to upper case and skips blank lines', () => {
    const { rows } = parseImportCsv(`${header}\nLower Kurti,Women,,b0aaaa1111,,,,\n\n\nUpper Kurti,Men,,B0BBBB2222,,,,\n`);
    expect(rows).toHaveLength(2);
    expect(rows[0].india_asin).toBe('B0AAAA1111');
    expect(rows[1].india_asin).toBe('B0BBBB2222');
  });

  it('reports unknown columns as warnings, not errors', () => {
    const { rows, unknownColumns } = parseImportCsv('name,category,not_a_column,india_asin\nFoo,Bar,whatever,B0AAAA1111\n');
    expect(unknownColumns).toContain('not_a_column');
    expect(rows[0].errors).toEqual([]);
  });

  it('rejects invalid status', () => {
    const { rows } = parseImportCsv(`${header}\nFoo,Bar,,B0AAAA1111,,,,live\n`);
    expect(rows[0].errors.some(e => e.includes('status'))).toBe(true);
  });

  it('defaults unknown rows to draft and parses pipe lists defensively', () => {
    const { rows } = parseImportCsv(`${header}\nFoo,Bar,,B0AAAA1111,,|  |,,\n`);
    expect(rows[0].status).toBe('draft');
    expect(rows[0].pros).toEqual([]);
  });

  it('exposes the documented column set', () => {
    expect(IMPORT_COLUMNS).toContain('name');
    expect(IMPORT_COLUMNS).toContain('category');
    expect(IMPORT_COLUMNS).toContain('us_asin');
  });
});
