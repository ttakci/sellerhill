import { extractTaskIdFromLocation } from './ebay-feed.service';

describe('extractTaskIdFromLocation', () => {
  it('reads the task id eBay returns in the location header', () => {
    expect(extractTaskIdFromLocation('/sell/feed/v1/inventory_task/task-123')).toBe('task-123');
    expect(
      extractTaskIdFromLocation('https://api.ebay.com/sell/feed/v1/inventory_task/task-123')
    ).toBe('task-123');
  });

  it('tolerates a trailing slash and a query string', () => {
    expect(extractTaskIdFromLocation('/sell/feed/v1/inventory_task/task-123/')).toBe('task-123');
    expect(extractTaskIdFromLocation('/sell/feed/v1/inventory_task/task-123?x=1')).toBe('task-123');
  });

  it('returns undefined rather than a wrong id when there is nothing to read', () => {
    // The caller throws on undefined. That is the right outcome: a task we
    // cannot address is one eBay is generating and we will never collect.
    for (const value of ['', '/', undefined, null, 42, {}]) {
      expect(extractTaskIdFromLocation(value)).toBeUndefined();
    }
  });
});
