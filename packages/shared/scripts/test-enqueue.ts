import path from 'path';
import { fileURLToPath } from 'url';

import { Queue } from 'bullmq';
import dotenv from 'dotenv';

import { ZON_SCRAPPER_QUEUE, getQueueOptions } from '../src/queue/scrapeQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

async function enqueueTestJob(): Promise<void> {
  const queueOptions = getQueueOptions(REDIS_URL);
  const queue = new Queue(ZON_SCRAPPER_QUEUE, queueOptions);

  const asin = process.argv[2] ?? 'B0BMGFTY7N';

  await queue.add('scrape', {
    asin,
    marketplace: 'US',
  });

  await queue.close();
}

enqueueTestJob().catch(console.error);
