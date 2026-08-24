import { readFileSync } from 'fs';
import { join } from 'path';

const PROCESSOR = readFileSync(
  join(__dirname, 'amazon-tracking-processor.service.ts'),
  'utf8',
);

describe('delivery detection', () => {
  it('never stops Amazon polling on the strength of a converted number', () => {
    // The Integration API has NO delivery webhook — the events are
    // tracking.html.* and tracking.problem.*. The removed
    // `hasWebhookDeliveryCoverage` stopped polling once a conversion existed,
    // which would strand every converted order in SHIPPED forever.
    expect(PROCESSOR).not.toMatch(/hasWebhookDeliveryCoverage/);
  });

  it('keeps feeding the provider by continuing to scrape after SHIPPED', () => {
    expect(PROCESSOR).toMatch(/scrapeOrderStatusWithTrackingHtml/);
  });
});
