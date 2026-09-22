import * as zlib from 'zlib';

import { decodeReportBody, parseActiveInventoryReportXml } from './feed-report-parser';

// A real captured excerpt (2026-09-22), trimmed. Do not "clean up" the
// whitespace — the parser has to survive eBay's actual formatting.
const REAL_REPORT_EXCERPT = `<?xml version="1.0" encoding="UTF-8"?>
<BulkDataExchangeResponses xmlns="urn:ebay:apis:eBLBaseComponents"><ActiveInventoryReport>
<SKUDetails>
        <SKU>B07VQ1ZHY1</SKU>
        <Price currencyID="USD">15.38</Price>
        <Quantity>1</Quantity>
        <ItemID>206349816749</ItemID>
</SKUDetails>
<SKUDetails>
        <SKU>B0DCYYLFLZ</SKU>
        <Price currencyID="USD">136.29</Price>
        <Quantity>1</Quantity>
        <ItemID>206349816964</ItemID>
</SKUDetails>
</ActiveInventoryReport></BulkDataExchangeResponses>`;

describe('parseActiveInventoryReportXml', () => {
  it('reads every field from a real captured report', () => {
    const items = parseActiveInventoryReportXml(REAL_REPORT_EXCERPT);
    expect(items).toEqual([
      { ebayItemId: '206349816749', sku: 'B07VQ1ZHY1', price: 15.38, currency: 'USD', quantity: 1 },
      { ebayItemId: '206349816964', sku: 'B0DCYYLFLZ', price: 136.29, currency: 'USD', quantity: 1 },
    ]);
  });

  it('drops a record with no ItemID rather than failing the whole parse', () => {
    const xml = `<SKUDetails><SKU>X</SKU><Price currencyID="USD">1.00</Price><Quantity>1</Quantity></SKUDetails>`;
    expect(parseActiveInventoryReportXml(xml)).toEqual([]);
  });

  it('returns an empty list, never throws, on malformed input', () => {
    for (const input of ['', 'not xml at all', '<SKUDetails><ItemID>', '<html></html>']) {
      expect(() => parseActiveInventoryReportXml(input)).not.toThrow();
      expect(parseActiveInventoryReportXml(input)).toEqual([]);
    }
  });

  it('tolerates a missing price or quantity without dropping the record', () => {
    const xml = `<SKUDetails><SKU>X</SKU><ItemID>123</ItemID></SKUDetails>`;
    expect(parseActiveInventoryReportXml(xml)).toEqual([
      { ebayItemId: '123', sku: 'X', price: undefined, currency: undefined, quantity: undefined },
    ]);
  });
});

describe('decodeReportBody', () => {
  it('decompresses a gzipped report before returning text', () => {
    const gzipped = zlib.gzipSync(Buffer.from(REAL_REPORT_EXCERPT));
    expect(decodeReportBody(gzipped)).toContain('<ItemID>206349816749</ItemID>');
  });

  it('reads a plain (uncompressed) report straight through', () => {
    expect(decodeReportBody(Buffer.from(REAL_REPORT_EXCERPT))).toContain('B0DCYYLFLZ');
  });

  it('never throws on bytes that only look gzipped', () => {
    const fake = Buffer.from([0x1f, 0x8b, 0x00, 0x01, 0x02]);
    expect(() => decodeReportBody(fake)).not.toThrow();
  });
});
