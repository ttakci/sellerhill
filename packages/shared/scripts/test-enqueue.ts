import path from 'path';
import { fileURLToPath } from 'url';

import { Queue } from 'bullmq';
import dotenv from 'dotenv';

import { AMAZON_SCRAPE_QUEUE, getQueueOptions } from '../src/queue/scrapeQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function enqueueTestJob() {
  const queueOptions = getQueueOptions(REDIS_URL);
  const queue = new Queue(AMAZON_SCRAPE_QUEUE, queueOptions);

  const asin = process.argv[2] || 'B0BMGFTY7N'; // Default to a known ASIN if none provided

  console.log(`📡 Enqueueing job for ASIN: ${asin}`);

  const job = await queue.add('scrape', {
    asin,
    marketplace: 'US',
  });

  console.log(`✅ Job enqueued with ID: ${job.id}`);
  await queue.close();
}

enqueueTestJob().catch(console.error);
