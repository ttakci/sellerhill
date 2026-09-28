import { BULLMQ_MAX_PRIORITY, fairBatchPriority } from './fair-priority';

describe('fairBatchPriority', () => {
  it("a seller's first chunk with nothing queued runs at the top", () => {
    expect(fairBatchPriority(0, 0)).toBe(1);
  });
  it("later chunks of one job sink behind another seller's first chunk", () => {
    expect(fairBatchPriority(0, 19)).toBe(20);
    expect(fairBatchPriority(0, 0)).toBeLessThan(fairBatchPriority(0, 19));
  });
  it('already-queued work pushes a new job back', () => {
    expect(fairBatchPriority(500, 0)).toBe(21);
  });
  it('is clamped to the BullMQ maximum', () => {
    expect(fairBatchPriority(10 ** 9, 10 ** 9)).toBe(BULLMQ_MAX_PRIORITY);
  });
});
