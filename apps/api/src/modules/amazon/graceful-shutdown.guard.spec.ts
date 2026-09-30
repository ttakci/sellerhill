import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/**
 * A deploy must let an in-flight Amazon checkout FINISH, not kill it. Two
 * pieces make that true:
 *
 *  - `main.ts` turns SIGTERM into `app.close()`. That runs Nest's
 *    `onApplicationShutdown` hooks, where `@nestjs/bullmq` calls
 *    `worker.close()` and waits for every active job. Node is PID 1 in the
 *    container (`exec "$@"` in the entrypoint), so without this listener the
 *    signal would be ignored and Docker would SIGKILL a node mid-"Place Order".
 *  - `stop_grace_period` on the api service in both Coolify compose files.
 *    Docker's default is 10 s — `app.close()` would still be waiting on the
 *    checkout when the SIGKILL arrived. A checkout takes minutes.
 *
 * `decideFulfillStart` (INTERRUPTED) is the fail-closed backstop when a kill
 * still happens; these two keep it from being the common path.
 */
describe('graceful shutdown for in-flight queue jobs', () => {
  it('main.ts closes the Nest app on SIGTERM so BullMQ workers drain their active job', () => {
    const main = read('apps/api/src/main.ts');
    expect(main).toMatch(/process\.on\('SIGTERM'/);
    expect(main).toMatch(/await app\.close\(\)/);
    // The manual listener IS the shutdown hook; a second registration would
    // run app.close() twice.
    expect(main).not.toMatch(/enableShutdownHooks/);
  });

  it.each(['docker-compose.production.yml', 'docker-compose.test.yml'])(
    '%s gives the api service a stop grace period longer than a checkout',
    (file) => {
      // The compose files are CRLF in the working tree; normalise before matching.
      const compose = read(file).replace(/\r\n/g, '\n');
      const apiBlock = compose.match(/^ {2}api:\n([\s\S]*?)(?=^ {2}\S)/m)?.[1] ?? '';
      expect(apiBlock).not.toBe('');
      const grace = apiBlock.match(/^ {4}stop_grace_period:\s*(\d+)m\s*$/m)?.[1];
      expect(grace).toBeDefined();
      expect(Number(grace)).toBeGreaterThanOrEqual(5);
    }
  );
});
