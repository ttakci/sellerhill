import { PlatformSettingKey } from '@repo/shared';

import { EbayCampaignSyncProcessor } from './ebay-campaign-sync.processor';
import { EBAY_CAMPAIGN_SYNC_QUEUE, EBAY_CAMPAIGN_SYNC_TICK_JOB_ID } from './ebay-campaigns.constants';

describe('campaign sync processor', () => {
  it('removes the previous schedule before adding the configured repeatable tick', async () => {
    const order: string[] = [];
    const queue = {
      getJobSchedulers: jest.fn().mockResolvedValue([{ key: 'old-pattern' }]),
      removeJobScheduler: jest.fn(() => {
        order.push('remove');
      }),
      add: jest.fn(() => {
        order.push('add');
      }),
    };
    const settings = { getString: jest.fn().mockResolvedValue('*/15 * * * *') };
    const sweep = { runSweep: jest.fn().mockResolvedValue(undefined) };
    const processor = new EbayCampaignSyncProcessor(queue as never, sweep as never, settings as never);
    await processor.onModuleInit();
    expect(order).toEqual(['remove', 'add']);
    expect(settings.getString).toHaveBeenCalledWith(PlatformSettingKey.EBAY_CAMPAIGN_SYNC_CRON);
    expect(queue.removeJobScheduler).toHaveBeenCalledWith('old-pattern');
    expect(queue.add).toHaveBeenCalledWith(EBAY_CAMPAIGN_SYNC_QUEUE, expect.any(Object), {
      repeat: { pattern: '*/15 * * * *' },
      jobId: EBAY_CAMPAIGN_SYNC_TICK_JOB_ID,
      removeOnComplete: true,
      removeOnFail: 50,
    });
    await processor.process();
    expect(sweep.runSweep).toHaveBeenCalledTimes(1);
  });
});
