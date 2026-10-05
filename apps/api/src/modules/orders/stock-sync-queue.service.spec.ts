import { StockSyncQueueService } from './stock-sync-queue.service';

describe('durable campaign repricing delivery ids', () => {
  it('keeps retries idempotent while different revisions have distinct safe BullMQ ids', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new StockSyncQueueService(queue as never);
    jest.spyOn(Date, 'now').mockReturnValue(5000);
    try {
      await service.enqueueProductStockSync('product-1', 'campaign-account-1-42');
      await service.enqueueProductStockSync('product-1', 'campaign-account-1-42');
      await service.enqueueProductStockSync('product-1', 'campaign-account-1-43');
      const calls = queue.add.mock.calls as Array<[string, { productId: string }, { jobId: string; attempts: number }]>;
      expect(calls.map((call) => call[2].jobId)).toEqual([
        'stock-sync-product-1-campaign-account-1-42',
        'stock-sync-product-1-campaign-account-1-42',
        'stock-sync-product-1-campaign-account-1-43',
      ]);
      expect(calls.every((call) => !call[2].jobId.includes(':'))).toBe(true);
      expect(calls.every((call) => call[1].productId === 'product-1' && call[2].attempts === 3)).toBe(true);
    } finally {
      jest.restoreAllMocks();
    }
  });
  it('retains the existing time bucket for callers without a delivery id', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    const service = new StockSyncQueueService(queue as never);
    jest.spyOn(Date, 'now').mockReturnValue(5000);
    try {
      await service.enqueueProductStockSync('product-1');
      expect(queue.add).toHaveBeenCalledWith(
        'sync-product-stock',
        expect.objectContaining({ productId: 'product-1' }),
        expect.objectContaining({ jobId: 'stock-sync:product-1:1' })
      );
    } finally {
      jest.restoreAllMocks();
    }
  });
});
