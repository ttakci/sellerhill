// apps/api/src/modules/ebay-returns/ebay-returns.guard.spec.ts
//
// Source-grep invariants for the eBay returns module. Each one is a rule a
// mocked unit test would keep passing after it was broken:
//
//   1. Exactly nine Post-Order calls exist, all documented locally, and the
//      five WRITES (return decide / mark_as_received / issue_refund,
//      cancellation approve / reject) live in the client alone, are sent once
//      (never inside the retry wrapper), are charged to their own quota at
//      INTERACTIVE, and are reached only through
//      `EbayReturnsActionsService.act` / `EbayCancellationsActionsService.act`,
//      which check the operator's switch, suspension and a LIVE eBay read
//      BEFORE the call. A write that cancels an order or moves real money must
//      never appear anywhere else.
//   2. Post-Order takes the user token with the `IAF ` prefix. The prefix the
//      other eBay REST APIs use is rejected — every call would fail.
//   3. Every seller-facing read is scoped to the calling user.
//   4. The sweeps never delete rows and never rewrite `first_seen_at`.
//   5. The cancellation search sends `role=SELLER` (the caller's role — BUYER
//      answered nothing on production) and a closed date range (`_to` missing
//      is a 400).

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MODULE_DIR = __dirname;
const ADMIN_DIR = join(MODULE_DIR, '..', 'admin');

const read = (dir: string, file: string): string => readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');

/** Every source file of the module; specs are not shipped code. */
const SOURCE_FILES = readdirSync(MODULE_DIR)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
  .sort();

const sources = new Map(SOURCE_FILES.map((file) => [file, read(MODULE_DIR, file)]));
const source = (file: string): string => {
  const text = sources.get(file);
  if (text === undefined) {
    throw new Error(`${file} is not a source file of the ebay-returns module`);
  }
  return text;
};

/** Block and line comments removed, so prose can never satisfy or break a check. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The contents of every template literal in a (comment-free) source. */
function templateLiterals(text: string): string[] {
  return stripComments(text)
    .split('`')
    .filter((_, index) => index % 2 === 1);
}

describe('ebay-returns module invariants', () => {
  it('sees the files it is guarding', () => {
    expect(SOURCE_FILES).toEqual(
      expect.arrayContaining([
        'cancellation-mapper.ts',
        'ebay-cancellations-actions.service.ts',
        'ebay-cancellations-sync.service.ts',
        'ebay-cancellations.controller.ts',
        'ebay-returns-sync.processor.ts',
        'ebay-returns-sync.service.ts',
        'ebay-returns.controller.ts',
        'ebay-returns.service.ts',
        'post-order.client.ts',
        'return-mapper.ts',
      ])
    );
  });

  describe('the nine documented Post-Order calls, and no other', () => {
    const WRITE_FILES = SOURCE_FILES.filter((file) => file !== 'post-order.client.ts');

    it.each(WRITE_FILES)('%s issues no HTTP call of its own', (file) => {
      const code = stripComments(source(file));
      // axios.post( / http.put<T>( / client.delete( / .patch( / .request( / axios.get(
      expect(code).not.toMatch(/\baxios\b/);
      // An HTTP verb call: `.post(` / `.put<T>(`, but not a Map's own `.delete(id)`.
      expect(code).not.toMatch(/\.(post|put|patch|request)\s*[<(]/);
      expect(code).not.toMatch(/(?<!Cache)\.delete\s*[<(]/);
      expect(code).not.toMatch(/method\s*:\s*['"`](post|put|delete|patch)['"`]/i);
    });

    it('names exactly the documented paths, and only in the client', () => {
      const paths = SOURCE_FILES.flatMap(
        (file) => stripComments(source(file)).match(/\/post-order\/v2\/[\w/{}$.()-]*/g) ?? []
      );
      // Each one exactly once, each a page in docs/ebay-reference/post-order/.
      expect(paths.sort()).toEqual(
        [
          '/post-order/v2/return/search',
          '/post-order/v2/return/${encodeURIComponent(returnId)}',
          '/post-order/v2/return/${encodeURIComponent(returnId)}/decide',
          '/post-order/v2/return/${encodeURIComponent(returnId)}/mark_as_received',
          '/post-order/v2/return/${encodeURIComponent(returnId)}/issue_refund',
          '/post-order/v2/cancellation/search',
          '/post-order/v2/cancellation/${encodeURIComponent(cancelId)}',
          '/post-order/v2/cancellation/${encodeURIComponent(cancelId)}/approve',
          '/post-order/v2/cancellation/${encodeURIComponent(cancelId)}/reject',
        ].sort()
      );
      const client = stripComments(source('post-order.client.ts'));
      expect(client).not.toMatch(/escalate|send_message|add_shipping_label|file\/upload|mark_refund_sent|preference/);
      // The cancellation pages this module does not implement.
      expect(client).not.toMatch(/cancellation\/check_eligibility|confirm|submit_cancel|create_cancel/);
    });

    it('reads with GET and writes with ONE un-retried POST', () => {
      const client = stripComments(source('post-order.client.ts'));
      expect(client).toMatch(/axios\.get<unknown>\(`\$\{this\.baseUrl\(\)\}\/post-order\/v2\/return\/search`/);
      expect(client).toMatch(
        /axios\.get<unknown>\(`\$\{this\.baseUrl\(\)\}\/post-order\/v2\/return\/\$\{encodeURIComponent\(returnId\)\}`/
      );
      expect(client).toMatch(/axios\.get<unknown>\(`\$\{this\.baseUrl\(\)\}\/post-order\/v2\/cancellation\/search`/);
      expect(client).toMatch(
        /axios\.get<unknown>\(`\$\{this\.baseUrl\(\)\}\/post-order\/v2\/cancellation\/\$\{encodeURIComponent\(cancelId\)\}`/
      );
      // The one POST, in the private `write`, outside withEbayRateLimitRetry.
      expect(client.match(/axios\.post</g)).toHaveLength(1);
      const writeStart = client.indexOf('private async write(');
      const postAt = client.indexOf('axios.post<', writeStart);
      expect(writeStart).toBeGreaterThan(-1);
      expect(postAt).toBeGreaterThan(writeStart);
      expect(client.slice(writeStart, postAt)).not.toContain('withEbayRateLimitRetry');
      // Charged before it goes out, at the seller's priority.
      expect(client.slice(writeStart, postAt)).toContain('await this.charge(resource, EbayCallPriority.INTERACTIVE)()');
      // Each write names its own pool: the five calls into `write`, by resource.
      const writes = [...client.matchAll(/this\.write\(\s*EbayApiResource\.(\w+),[^`]*`([^`]+)`/g)].map(
        (m) => `${m[1]} ${m[2]}`
      );
      expect(writes.sort()).toEqual(
        [
          'POST_ORDER_RETURN /post-order/v2/return/${encodeURIComponent(returnId)}/decide',
          'POST_ORDER_RETURN /post-order/v2/return/${encodeURIComponent(returnId)}/mark_as_received',
          'POST_ORDER_RETURN /post-order/v2/return/${encodeURIComponent(returnId)}/issue_refund',
          'POST_ORDER_CANCELLATION /post-order/v2/cancellation/${encodeURIComponent(cancelId)}/approve',
          'POST_ORDER_CANCELLATION /post-order/v2/cancellation/${encodeURIComponent(cancelId)}/reject',
        ].sort()
      );
      // Only APPROVE is ever decided — the decline value is not in the local reference.
      expect(source('post-order.types.ts')).toContain("decision: 'APPROVE';");
    });

    it.each([
      ['ebay-returns.controller.ts', 'isEbayReturnAction(action)'],
      ['ebay-cancellations.controller.ts', 'isEbayCancellationAction(action)'],
    ])('%s exposes exactly one write route, the action route', (file, check) => {
      const controller = stripComments(source(file));
      expect(controller).toMatch(/@Get\(/);
      expect(controller.match(/@(Post|Put|Patch|Delete|All)\(/g)).toEqual(['@Post(']);
      expect(controller).toContain("@Post(':id/actions/:action')");
      expect(controller).toContain(check);
    });

    it('reaches each write only from its actions service', () => {
      const callers = (method: string): string[] =>
        SOURCE_FILES.filter(
          (file) => file !== 'post-order.client.ts' && stripComments(source(file)).includes(`.${method}(`)
        );
      for (const method of ['decideReturn', 'markReturnReceived', 'issueReturnRefund']) {
        expect(callers(method)).toEqual(['ebay-returns-actions.service.ts']);
      }
      for (const method of ['approveCancellation', 'rejectCancellation']) {
        expect(callers(method)).toEqual(['ebay-cancellations-actions.service.ts']);
      }
    });

    it('gates every cancellation answer: switch → suspension → sandbox → live BUYER request → one call → audit', () => {
      const code = stripComments(source('ebay-cancellations-actions.service.ts'));
      const act = code.slice(code.indexOf('async act('), code.indexOf('private assertOffered('));
      const order = [
        'this.loadRow(userId, id)',
        'this.actionsEnabled()',
        'this.quotaEnforcement.isSuspended(userId)',
        'this.postOrder.isReturnSearchSupported()',
        'this.readLiveOrThrow(row, marketplaceId)',
        'this.assertOffered(live.row)',
        'this.ebay.getAccountAccessToken(',
        'this.postOrder.approveCancellation(',
        'this.postOrder.rejectCancellation(',
        "outcome: 'sent'",
      ].map((needle) => act.indexOf(needle));
      for (const index of order) {
        expect(index).toBeGreaterThan(-1);
      }
      expect([...order]).toEqual([...order].sort((a, b) => a - b));
      // The live read before an answer is never the drawer's cached one.
      expect(act).not.toMatch(/this\.readLive\([^)]*false\)/);
      // Offered only on a buyer's open request eBay says awaits the seller —
      // the same predicate refuses an answer and hides the drawer's buttons.
      expect(code.slice(code.indexOf('private assertOffered('))).toContain('if (!isCancellationAnswerable(live))');
      const answerable = code.slice(code.indexOf('export function isCancellationAnswerable('));
      expect(answerable).toContain('live.requestorType === EBAY_CANCEL_REQUESTOR_BUYER');
      expect(answerable).toContain('live.closedAt === null');
      expect(answerable).toContain('live.sellerRespondBy !== null');
      expect(code).toContain('actionsEnabled && isCancellationAnswerable(row)');
      // No enum value of the pages the reference lacks decides anything.
      expect(code).not.toMatch(/CANCEL_PENDING|CANCEL_REQUESTED|cancelStatus ===|state ===/);
    });

    it('gates every write: switch → suspension → sandbox → live option list → one call → audit', () => {
      const code = stripComments(source('ebay-returns-actions.service.ts'));
      const act = code.slice(code.indexOf('async act('), code.indexOf('private assertOffered('));
      const order = [
        'this.actionsEnabled()',
        'this.quotaEnforcement.isSuspended(userId)',
        'this.postOrder.isReturnSearchSupported()',
        'this.readLiveOrThrow(userId, id, true)',
        'this.assertOffered(live, action)',
        'this.ebay.getAccountAccessToken(',
        'this.postOrder.decideReturn(',
        'this.postOrder.markReturnReceived(',
        'this.postOrder.issueReturnRefund(',
        "outcome: 'sent'",
      ].map((needle) => act.indexOf(needle));
      for (const index of order) {
        expect(index).toBeGreaterThan(-1);
      }
      expect([...order]).toEqual([...order].sort((a, b) => a - b));
      // The live read before a write is never the cached one.
      expect(act).not.toContain('this.readLive(userId, id, false)');
      // Approve sends the documented decision and nothing else.
      expect(act).toContain("decision: 'APPROVE'");
      expect(code).not.toMatch(/decision:\s*['"`](DECLINE|OFFER_PARTIAL_REFUND|PROVIDE_RMA)/);
    });

    it('refunds eBay’s own computed amount as one purchase-price line', () => {
      const code = stripComments(source('ebay-returns-actions.service.ts'));
      expect(code).toContain("export const REFUND_FEE_TYPE_PURCHASE_PRICE = 'PURCHASE_PRICE';");
      expect(code).toContain('Number(live.row.estimatedRefundAmount)');
      expect(code).toContain('totalAmount: { value, currency }');
    });

    it('scopes its own reads to the caller', () => {
      for (const literal of templateLiterals(source('ebay-returns-actions.service.ts')).filter((l) =>
        /\bFROM ebay_returns\b/.test(l)
      )) {
        expect(literal).toContain('WHERE r.user_id = $1');
      }
      const cancellationReads = templateLiterals(source('ebay-cancellations-actions.service.ts')).filter((l) =>
        /\bFROM ebay_cancellations\b/.test(l)
      );
      // list count + page, counts, detail, the row lookup.
      expect(cancellationReads.length).toBeGreaterThanOrEqual(5);
      for (const literal of cancellationReads) {
        expect(literal).toMatch(/WHERE (c\.user_id = \$1|\$\{where\.join\(' AND '\)\})/);
      }
      expect(stripComments(source('ebay-cancellations-actions.service.ts'))).toContain(
        "const where = ['c.user_id = $1', 'c.requestor_type = $2'];"
      );
    });
  });

  describe('Post-Order authorization', () => {
    const client = source('post-order.client.ts');

    it('prefixes the user token with "IAF " (with the space)', () => {
      expect(client).toContain("const POST_ORDER_AUTH_PREFIX = 'IAF ';");
      expect(client).toContain('Authorization: `${POST_ORDER_AUTH_PREFIX}${accessToken}`');
    });

    it('never sends the prefix of the other eBay REST APIs', () => {
      // Checked on the raw file, comments included: the word must not be there to copy.
      expect(client).not.toContain('Bearer ');
      for (const file of SOURCE_FILES) {
        expect(source(file)).not.toMatch(/Bearer \$\{/);
      }
    });

    it('sends the marketplace header eBay requires on every Post-Order call', () => {
      expect(client).toContain("'X-EBAY-C-MARKETPLACE-ID': marketplaceId");
    });

    it('charges each Post-Order pool: the sweeps at background priority, a seller at interactive', () => {
      expect(client).toContain('this.budget.acquire(resource, priority)');
      expect(client).toContain('priority: EbayCallPriority = EbayCallPriority.BACKGROUND');
      expect(client).toContain('acquireBudget: this.charge(EbayApiResource.POST_ORDER_RETURN) }');
      expect(client).toContain('acquireBudget: this.charge(EbayApiResource.POST_ORDER_CANCELLATION) }');
      expect(client).toContain(
        'acquireBudget: this.charge(EbayApiResource.POST_ORDER_RETURN, EbayCallPriority.INTERACTIVE)'
      );
      expect(client).toContain(
        'acquireBudget: this.charge(EbayApiResource.POST_ORDER_CANCELLATION, EbayCallPriority.INTERACTIVE)'
      );
      // The two live reads and the one write path — nothing else is interactive.
      expect(stripComments(client).match(/EbayCallPriority\.INTERACTIVE\)/g)).toHaveLength(3);
    });

    it('never sends `offset` — its documented meaning is ambiguous, so only the first page is read', () => {
      const code = stripComments(client);
      expect(code).not.toMatch(/\boffset\b/);
      expect(code).toContain('limit: RETURN_SEARCH_LIMIT');
      expect(code).toContain('sort: RETURN_SEARCH_SORT');
      const constants = source('ebay-returns.constants.ts');
      expect(constants).toContain('export const RETURN_SEARCH_LIMIT = 200;');
      expect(constants).toContain("export const RETURN_SEARCH_SORT = '-FILING_DATE';");
    });

    it('asks the cancellation search as the SELLER over a closed range, 500 at a time, newest first', () => {
      const code = stripComments(client);
      expect(code).toContain('role: CANCELLATION_SEARCH_ROLE');
      expect(code).toContain('creation_date_range_to: params.creationDateTo');
      expect(code).toContain('limit: CANCELLATION_SEARCH_LIMIT');
      expect(code).toContain('sort: CANCELLATION_SEARCH_SORT');
      const constants = source('ebay-returns.constants.ts');
      expect(constants).toContain("export const CANCELLATION_SEARCH_ROLE = 'SELLER';");
      expect(constants).toContain('export const CANCELLATION_SEARCH_LIMIT = 500;');
      expect(constants).toContain("export const CANCELLATION_SEARCH_SORT = '-CANCEL_REQUEST_DATE';");
    });
  });

  describe('seller-facing reads are scoped to the caller', () => {
    const service = source('ebay-returns.service.ts');
    const statements = templateLiterals(service).filter((literal) => /\bFROM ebay_returns\b/.test(literal));

    it('finds the statements it is checking', () => {
      // The count, the page, the single row and the bucket counts.
      expect(statements.length).toBeGreaterThanOrEqual(4);
    });

    it('scopes every statement over ebay_returns by user_id', () => {
      for (const statement of statements) {
        expect(statement).toMatch(/\bFROM ebay_returns r\b/);
        expect(statement).toContain('WHERE r.user_id = $1');
      }
    });

    it('binds the caller as the first parameter of every query', () => {
      const code = stripComments(service);
      const seeds = code.match(/const params: QueryParam\[\] = \[[^\]]*\];/g) ?? [];
      expect(seeds.length).toBeGreaterThanOrEqual(3);
      for (const seed of seeds) {
        expect(seed).toBe('const params: QueryParam[] = [userId];');
      }
    });

    it('reads no table that is not reached from the caller’s own return row', () => {
      // Every other table is joined FROM the scoped row, never queried on its own.
      for (const literal of templateLiterals(service)) {
        for (const match of literal.matchAll(/\bFROM (\w+)/g)) {
          expect(match[1]).toBe('ebay_returns');
        }
      }
    });

    it('writes nothing', () => {
      for (const literal of templateLiterals(service)) {
        expect(literal).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/);
      }
    });

    it('is reachable only behind JwtAuthGuard, as a customer surface', () => {
      const controller = source('ebay-returns.controller.ts');
      expect(controller).toContain('@UseGuards(JwtAuthGuard)');
      expect(controller).not.toContain('OperatorSurface');
      expect(source('ebay-cancellations.controller.ts')).toContain('@UseGuards(JwtAuthGuard)');
      const cancellations = stripComments(source('ebay-cancellations.controller.ts'));
      const cancellationHandlers = cancellations.match(/this\.actions\.\w+\([^,)]+/g) ?? [];
      expect(cancellationHandlers.map((handler) => handler.split('(')[0])).toEqual([
        'this.actions.counts',
        'this.actions.list',
        'this.actions.detail',
        'this.actions.act',
      ]);
      for (const handler of cancellationHandlers) {
        expect(handler).toMatch(/\(req\.user\.sub$/);
      }
      // Every handler passes the authenticated user id, never one from the query string.
      const handlers = stripComments(controller).match(/this\.(returns|actions)\.\w+\([^,)]+/g) ?? [];
      expect(handlers.length).toBeGreaterThanOrEqual(4);
      for (const handler of handlers) {
        expect(handler).toMatch(/\(req\.user\.sub$/);
      }
    });

    it.each(['ebay-returns.controller.ts', 'ebay-cancellations.controller.ts'])(
      '%s declares the static `counts` route before the collection and id routes',
      (file) => {
        const controller = stripComments(source(file));
        const counts = controller.indexOf("@Get('counts')");
        expect(counts).toBeGreaterThan(-1);
        expect(counts).toBeLessThan(controller.indexOf('@Get()'));
        expect(counts).toBeLessThan(controller.indexOf("@Get(':id/detail')"));
      }
    );
  });

  describe('the sweep', () => {
    const sync = source('ebay-returns-sync.service.ts');
    const literals = templateLiterals(sync);

    it('never deletes a return', () => {
      for (const literal of literals) {
        expect(literal).not.toMatch(/\bDELETE\b/);
        expect(literal).not.toMatch(/\bTRUNCATE\b/);
      }
    });

    it('never rewrites first_seen_at and never drops an existing order link', () => {
      const upsert = literals.find((literal) => literal.includes('INSERT INTO ebay_returns'));
      expect(upsert).toBeDefined();
      expect(upsert).toContain('ON CONFLICT (ebay_account_id, return_id) DO UPDATE SET');
      expect(upsert).not.toContain('first_seen_at');
      expect(upsert).toContain('order_id = COALESCE(ebay_returns.order_id, EXCLUDED.order_id)');
      // The order link is resolved for the store owner only.
      expect(upsert).toContain('o.user_id = $1::uuid');
    });

    it('claims and stamps in ONE statement, active stores only', () => {
      const claim = literals.find((literal) => literal.includes('UPDATE ebay_accounts'));
      expect(claim).toBeDefined();
      expect(claim).toContain('FOR UPDATE SKIP LOCKED');
      expect(claim).toContain('SET last_return_sync_at = NOW()');
      expect(claim).toContain("status = 'active'");
    });

    it('re-reads the master switch on every tick, before the claim', () => {
      const code = stripComments(sync);
      const gate = code.indexOf('PlatformSettingKey.EBAY_RETURN_SYNC_ENABLED');
      expect(gate).toBeGreaterThan(-1);
      expect(gate).toBeLessThan(code.indexOf('await this.claimDueAccounts()'));
    });

    it('checks suspension before it asks for a token or calls eBay', () => {
      const code = stripComments(sync);
      const suspended = code.indexOf('this.quotaEnforcement.isSuspended(');
      expect(suspended).toBeGreaterThan(-1);
      expect(suspended).toBeLessThan(code.indexOf('this.ebay.getAccountAccessToken('));
      expect(suspended).toBeLessThan(code.indexOf('this.postOrder.searchReturns('));
    });

    it('takes the token through EbayService, never from the raw columns', () => {
      for (const literal of literals) {
        expect(literal).not.toMatch(/\b(access_token|refresh_token)\b/);
      }
      expect(stripComments(sync)).toContain('this.ebay.getAccountAccessToken(account.id)');
    });
  });

  describe('the cancellation sweep', () => {
    const sync = source('ebay-cancellations-sync.service.ts');
    const literals = templateLiterals(sync);

    it('never deletes a request', () => {
      for (const literal of literals) {
        expect(literal).not.toMatch(/\b(DELETE|TRUNCATE)\b/);
      }
    });

    it('never rewrites first_seen_at, keeps an existing order link and an erasure', () => {
      const upsert = literals.find((literal) => literal.includes('INSERT INTO ebay_cancellations'));
      expect(upsert).toBeDefined();
      expect(upsert).toContain('ON CONFLICT (ebay_account_id, cancel_id) DO UPDATE SET');
      expect(upsert).not.toContain('first_seen_at');
      expect(upsert).toContain('order_id = COALESCE(ebay_cancellations.order_id, EXCLUDED.order_id)');
      expect(upsert).toContain('o.user_id = $1::uuid AND o.ebay_account_id = $2::uuid');
      expect(upsert).toContain('WHEN ebay_cancellations.buyer_data_erased_at IS NOT NULL THEN NULL');
    });

    it('claims and stamps in ONE statement, active stores only, with the express lane', () => {
      const claim = literals.find((literal) => literal.includes('UPDATE ebay_accounts'));
      expect(claim).toBeDefined();
      expect(claim).toContain('FOR UPDATE SKIP LOCKED');
      expect(claim).toContain('SET last_cancellation_sync_at = NOW()');
      expect(claim).toContain("status = 'active'");
      expect(claim).toContain("o.ebay_cancel_state NOT IN ('NONE_REQUESTED', 'CANCELED')");
    });

    it('re-reads its own master switch, before the claim, on the cancellation interval', () => {
      const code = stripComments(sync);
      const gate = code.indexOf('PlatformSettingKey.EBAY_CANCELLATION_SYNC_ENABLED');
      expect(gate).toBeGreaterThan(-1);
      expect(gate).toBeLessThan(code.indexOf('await this.claimDueAccounts()'));
      expect(code).toContain('this.schedule.resolveCancellations()');
    });

    it('checks suspension before it asks for a token or calls eBay', () => {
      const code = stripComments(sync);
      const suspended = code.indexOf('this.quotaEnforcement.isSuspended(');
      expect(suspended).toBeGreaterThan(-1);
      expect(suspended).toBeLessThan(code.indexOf('this.ebay.getAccountAccessToken('));
      expect(suspended).toBeLessThan(code.indexOf('this.postOrder.searchCancellations('));
    });

    it('runs in the return sweep tick, after it, whatever the return sweep did', () => {
      const processor = stripComments(source('ebay-returns-sync.processor.ts'));
      // Both sweeps run on the one tick, returns first, each failure logged on its own.
      const returns = processor.indexOf('this.returnsSync.sweep()');
      const cancellations = processor.indexOf('this.cancellationsSync.sweep()');
      expect(returns).toBeGreaterThan(-1);
      expect(cancellations).toBeGreaterThan(returns);
      expect(processor).toMatch(/try \{\s*await sweep\(\);\s*\} catch/);
    });
  });

  describe('queue registration', () => {
    const constants = source('ebay-returns.constants.ts');
    const queueName = constants.match(/export const EBAY_RETURNS_SYNC_QUEUE = '([a-z-]+)';/)?.[1];

    it('names the queue once', () => {
      expect(queueName).toBe('ebay-returns-sync');
    });

    it('runs the tick with concurrency 1', () => {
      expect(source('ebay-returns-sync.processor.ts')).toContain(
        '@Processor(EBAY_RETURNS_SYNC_QUEUE, { concurrency: 1 })'
      );
    });

    it('is surfaced in the admin Queues tab and observed by the collector', () => {
      expect(read(ADMIN_DIR, 'admin.service.ts')).toContain(`'${queueName}',`);
      expect(read(ADMIN_DIR, 'queue-events-collector.service.ts')).toContain(`'${queueName}',`);
    });
  });
});
