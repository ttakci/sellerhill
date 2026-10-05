export class TestCampaignAccountLock {
  private readonly tails = new Map<string, Promise<void>>();
  readonly queuedAccounts: string[] = [];

  async run<T>(accountId: string, operation: () => Promise<T>): Promise<T> {
    this.queuedAccounts.push(accountId);
    const previous = this.tails.get(accountId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.tails.set(accountId, previous.then(() => next));
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
