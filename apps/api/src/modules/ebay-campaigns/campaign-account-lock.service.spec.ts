const mockLockPool = {
  connect: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
};

jest.mock('pg', () => ({ Pool: jest.fn(() => mockLockPool) }));

import { Pool } from 'pg';

import { CampaignAccountLockService } from './campaign-account-lock.service';

describe('CampaignAccountLockService', () => {
  const config = { get: jest.fn().mockReturnValue('postgres://test') };

  beforeEach(() => {
    mockLockPool.connect.mockReset();
    mockLockPool.end.mockReset();
    mockLockPool.on.mockReset().mockReturnValue(mockLockPool);
    (Pool as unknown as jest.Mock).mockClear().mockImplementation(() => mockLockPool);
    config.get.mockReturnValue('postgres://test');
  });

  it('uses a dedicated pool and queues same-account waiters before clients', async () => {
    const firstClient = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    const secondClient = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    mockLockPool.connect.mockResolvedValueOnce(firstClient).mockResolvedValueOnce(secondClient);
    const service = new CampaignAccountLockService(config as never);
    let releaseOperation!: () => void;
    let signalStarted!: () => void;
    const operationStarted = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const operationGate = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });
    const sharedDatabasePoolMaxOne = { query: jest.fn().mockResolvedValue([]) };

    const first = service.run('store-1', async () => {
      await sharedDatabasePoolMaxOne.query('UPDATE listings');
      signalStarted();
      await operationGate;
      return 'first';
    });
    await operationStarted;
    const second = service.run('store-1', () => Promise.resolve('second'));
    await Promise.resolve();

    expect(sharedDatabasePoolMaxOne.query).toHaveBeenCalledWith('UPDATE listings');
    expect(mockLockPool.connect).toHaveBeenCalledTimes(1);
    expect(secondClient.query).not.toHaveBeenCalled();
    releaseOperation();
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
    expect(mockLockPool.connect).toHaveBeenCalledTimes(2);
    expect(firstClient.release).toHaveBeenCalledTimes(1);
    expect(secondClient.release).toHaveBeenCalledTimes(1);
    expect(Pool).toHaveBeenCalledWith({
      connectionString: 'postgres://test',
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    expect(mockLockPool.on).toHaveBeenCalledWith('error', expect.any(Function));
    await service.onModuleDestroy();
    expect(mockLockPool.end).toHaveBeenCalledTimes(1);
  });

  it('releases the local queue after a connection acquisition failure', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    mockLockPool.connect.mockRejectedValueOnce(new Error('connection failed')).mockResolvedValueOnce(client);
    const service = new CampaignAccountLockService(config as never);

    await expect(service.run('store-1', () => Promise.resolve('unreachable'))).rejects.toThrow('connection failed');
    await expect(service.run('store-1', () => Promise.resolve('recovered'))).resolves.toBe('recovered');
    expect(mockLockPool.connect).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('destroys sessions when advisory lock acquisition or release fails', async () => {
    const acquireError = new Error('lock failed');
    const unlockError = new Error('unlock failed');
    const failedAcquireClient = {
      query: jest.fn().mockRejectedValue(acquireError),
      release: jest.fn(),
    };
    const acquiredClient = {
      query: jest.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(unlockError),
      release: jest.fn(),
    };
    mockLockPool.connect.mockResolvedValueOnce(failedAcquireClient).mockResolvedValueOnce(acquiredClient);
    const service = new CampaignAccountLockService(config as never);

    await expect(service.run('store-1', () => Promise.resolve('unused'))).rejects.toThrow('lock failed');
    expect(failedAcquireClient.release).toHaveBeenCalledWith(acquireError);
    await expect(service.run('store-1', () => Promise.resolve('ok'))).rejects.toThrow('unlock failed');
    expect(acquiredClient.release).toHaveBeenCalledWith(unlockError);
  });
});
