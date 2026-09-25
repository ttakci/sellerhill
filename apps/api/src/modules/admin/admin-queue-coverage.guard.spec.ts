// apps/api/src/modules/admin/admin-queue-coverage.guard.spec.ts
//
// `ADMIN_QUEUE_NAMES` declares which BullMQ queues the admin panel surfaces,
// but the Queues tab is actually fed by `AdminController.queues()` — a
// hand-written array, because each entry needs a real `Queue` instance from
// `@InjectQueue`. Nothing tied the two together, so they drifted: the constant
// listed fifteen queues while the controller returned nine, and six were
// invisible in the panel. One of those six DELETES things — `data-retention`
// removes database rows — which is exactly the kind of job an operator most
// needs to see the health of.
//
// These are source-greps rather than a DI test on purpose: instantiating the
// controller would mean standing up fifteen injected queues, and the failure
// this guards against is a missing line, which reads fine and breaks nothing
// at runtime. A queue simply stops appearing, silently.
//
// Adding a queue therefore means three edits, and this spec fails until all
// three are done: the name in `ADMIN_QUEUE_NAMES`, a `BullModule.registerQueue`
// entry in `AdminModule`, and an `@InjectQueue` + `queues()` entry here.

import { readFileSync } from 'fs';
import { join } from 'path';

import { ADMIN_QUEUE_NAMES } from './admin.service';

const read = (file: string): string => readFileSync(join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');

/** The body of `queues()`, so a name mentioned elsewhere in the file cannot satisfy the check. */
function queuesMethodBody(source: string): string {
  const start = source.indexOf('private queues()');
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n  }', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('admin queue coverage', () => {
  const controller = read('admin.controller.ts');
  const module = read('admin.module.ts');
  const body = queuesMethodBody(controller);

  it.each([...ADMIN_QUEUE_NAMES])('surfaces %s in the admin Queues tab', (name) => {
    // The panel reads queues() — a name missing here is a queue nobody can see.
    expect(body).toContain(`name: '${name}'`);
  });

  it.each([...ADMIN_QUEUE_NAMES])('injects a Queue instance for %s', (name) => {
    // queues() can only return what the constructor received.
    expect(controller).toContain(`@InjectQueue('${name}')`);
  });

  it.each([...ADMIN_QUEUE_NAMES])('registers %s with BullModule', (name) => {
    // Without the registration, @InjectQueue fails at boot rather than at read
    // time — a loud failure, but only for whoever restarts the API next.
    expect(module).toMatch(new RegExp(`name:\\s*(?:'${name}'|[A-Z_]+_QUEUE)`));
  });

  it('declares no queue in queues() that ADMIN_QUEUE_NAMES omits', () => {
    // The reverse direction: the constant is the manifest, so a queue surfaced
    // without being declared there means the manifest is no longer the truth.
    const surfaced = [...body.matchAll(/name: '([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(surfaced.sort()).toEqual([...ADMIN_QUEUE_NAMES].sort());
  });
});
