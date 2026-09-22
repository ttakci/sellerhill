import * as zlib from 'zlib';

import { previewReport } from './ebay-feed-sync.service';

describe('previewReport', () => {
  it('reads a plain report straight through', () => {
    expect(previewReport(Buffer.from('SKU\tPrice\tQty\nABC\t9.99\t3\n'))).toContain('SKU\tPrice\tQty');
  });

  it('decompresses a gzipped report, because eBay may serve either', () => {
    const body = zlib.gzipSync(Buffer.from('SKU,Price,Quantity\nABC,9.99,3\n'));
    expect(previewReport(body)).toContain('SKU,Price,Quantity');
  });

  it('truncates instead of putting a megabyte report in one log line', () => {
    const preview = previewReport(Buffer.from('x'.repeat(10_000)));
    expect(preview).toContain('truncated; 10000 bytes total');
    expect(preview.length).toBeLessThan(2_200);
  });

  it('never throws on bytes that only look gzipped', () => {
    // The verbatim file on disk is the real artefact; a preview that threw
    // would fail the capture it is only describing.
    const fake = Buffer.from([0x1f, 0x8b, 0x00, 0x01, 0x02]);
    expect(() => previewReport(fake)).not.toThrow();
    expect(previewReport(fake)).toContain('would not decompress');
  });
});
