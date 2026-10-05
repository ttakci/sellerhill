import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import ts from 'typescript';

const moduleDir = __dirname;
const source = (file: string) => readFileSync(join(moduleDir, file), 'utf8');

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function textNodes(node: ts.Node, file: ts.SourceFile): string[] {
  const values: string[] = [];
  walk(node, (child) => {
    if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) {
      values.push(child.text);
    }
    if (ts.isTemplateExpression(child)) {
      values.push(child.head.text + child.templateSpans.map((span) => span.literal.text).join(''));
    }
  });
  return values.length ? values : [node.getText(file)];
}

function reportRequest(axiosCall: ts.CallExpression, file: ts.SourceFile): boolean {
  let methodName: string | null = null;
  let method: ts.MethodDeclaration | undefined;
  for (let parent: ts.Node | undefined = axiosCall.parent; parent; parent = parent.parent) {
    if (ts.isMethodDeclaration(parent) && ts.isIdentifier(parent.name)) {
      methodName = parent.name.text;
      method = parent;
      break;
    }
  }
  const httpMethod = ts.isPropertyAccessExpression(axiosCall.expression) ? axiosCall.expression.name.text : '';
  const pathName =
    methodName === 'createReportTask' || methodName === 'getReportTask'
      ? 'REPORT_TASK_PATH'
      : methodName === 'downloadReport'
        ? 'REPORT_PATH'
        : null;
  if (
    !pathName ||
    (methodName === 'createReportTask' ? httpMethod !== 'post' : httpMethod !== 'get') ||
    !axiosCall.arguments[0]
  ) {
    return false;
  }
  const hasExactReportUrl = (node: ts.Node): boolean => {
    let exact = false;
    walk(node, (child) => {
      if (
        ts.isCallExpression(child) &&
        ts.isPropertyAccessExpression(child.expression) &&
        child.expression.expression.getText(file) === 'this' &&
        child.expression.name.text === 'reportUrl' &&
        child.arguments.length === 1 &&
        ts.isIdentifier(child.arguments[0]) &&
        child.arguments[0].text === pathName
      ) {
        exact = true;
      }
    });
    return exact;
  };
  if (methodName === 'createReportTask' && ts.isIdentifier(axiosCall.arguments[0])) {
    let endpointBoundToReportTask = false;
    if (method?.body) {
      walk(method.body, (node) => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          ts.isIdentifier(axiosCall.arguments[0]) &&
          node.name.text === axiosCall.arguments[0].text &&
          node.initializer &&
          hasExactReportUrl(node.initializer)
        ) {
          endpointBoundToReportTask = true;
        }
      });
    }
    return endpointBoundToReportTask;
  }
  return hasExactReportUrl(axiosCall.arguments[0]);
}

function containsNode(container: ts.Node | undefined, target: ts.Node): boolean {
  if (!container) {
    return false;
  }
  let found = false;
  walk(container, (node) => {
    if (node === target) {
      found = true;
    }
  });
  return found;
}

function assertMarketingCallsBudgeted(text: string): void {
  const file = ts.createSourceFile('ebay-marketing.client.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const axiosCalls: ts.CallExpression[] = [];
  let marketingBudgetConfigured = false;
  walk(file, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === 'axios' &&
      ['get', 'post'].includes(node.expression.name.text)
    ) {
      axiosCalls.push(node);
    }
    if (ts.isMethodDeclaration(node) && node.name.getText(file) === 'options' && node.body) {
      walk(node.body, (child) => {
        if (!ts.isPropertyAssignment(child) || child.name.getText(file) !== 'acquireBudget') {
          return;
        }
        const acquireBudget = child.initializer;
        if (!ts.isArrowFunction(acquireBudget) || !ts.isCallExpression(acquireBudget.body)) {
          return;
        }
        const call = acquireBudget.body;
        marketingBudgetConfigured =
          ts.isPropertyAccessExpression(call.expression) &&
          call.expression.expression.getText(file) === 'this.budget' &&
          call.expression.name.text === 'acquire' &&
          call.arguments[0]?.getText(file) === 'EbayApiResource.MARKETING_ADS';
      });
    }
  });
  if (!marketingBudgetConfigured || axiosCalls.length === 0) {
    throw new Error('Marketing budget configuration is missing');
  }
  for (const axiosCall of axiosCalls) {
    let retry: ts.CallExpression | undefined;
    for (let parent: ts.Node | undefined = axiosCall.parent; parent; parent = parent.parent) {
      if (
        ts.isCallExpression(parent) &&
        ts.isIdentifier(parent.expression) &&
        parent.expression.text === 'withEbayRateLimitRetry'
      ) {
        retry = parent;
        break;
      }
    }
    const options = retry?.arguments[1];
    const validOptionsCall = (node: ts.Expression): boolean =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === 'this' &&
      node.expression.name.text === 'options';
    const validRetryOptions = (node: ts.Expression | undefined): boolean => {
      if (!node) {
        return false;
      }
      if (validOptionsCall(node)) {
        return true;
      }
      if (!ts.isObjectLiteralExpression(node)) {
        return false;
      }
      const spreads = node.properties.filter(ts.isSpreadAssignment);
      const overrides = node.properties.filter((property) => !ts.isSpreadAssignment(property));
      return (
        spreads.length === 1 &&
        validOptionsCall(spreads[0].expression) &&
        overrides.every(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(file).replace(/^['"]|['"]$/g, '') === 'maxAttempts'
        )
      );
    };
    const reportCall = reportRequest(axiosCall, file);
    if (reportCall) {
      const reportOptions = options?.getText(file) ?? '';
      if (!retry || !containsNode(retry.arguments[0], axiosCall) || reportOptions.includes('acquireBudget')) {
        throw new Error(`Invalid capture-only report HTTP call: ${axiosCall.getText(file)}`);
      }
      continue;
    }
    if (
      !retry ||
      !retry.arguments[0] ||
      !containsNode(retry.arguments[0], axiosCall) ||
      !validRetryOptions(options)
    ) {
      throw new Error(`Unbudgeted Marketing HTTP call or per-call budget override: ${axiosCall.getText(file)}`);
    }
  }
}

function assertAppliedRateWriters(files: Record<string, string>, allowed: string[]): void {
  for (const [name, text] of Object.entries(files)) {
    const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    walk(file, (node) => {
      if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node) && !ts.isTemplateExpression(node)) {
        return;
      }
      const sql = node.getText(file).replace(/\s+/g, ' ');
      if (
        /\bUPDATE\s+listings\b/i.test(sql) &&
        /\bSET\b[^;]*\bad_rate_applied\s*=/i.test(sql) &&
        !allowed.includes(name)
      ) {
        throw new Error(`Unexpected applied-rate writer: ${name}`);
      }
    });
  }
}

function assertClearGuarded(text: string): void {
  const file = ts.createSourceFile(
    'campaign-ad-state.repository.ts',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let guarded = false;
  walk(file, (node) => {
    if (!ts.isIfStatement(node) || node.expression.getText(file) !== 'clearOthers') {
      return;
    }
    const guardedText = textNodes(node.thenStatement, file).join('\n');
    if (/ebay_item_id\s*<>\s*ALL/i.test(guardedText)) {
      guarded = true;
    }
  });
  if (!guarded) {
    throw new Error('The clear predicate is not inside the clearOthers block');
  }
}

function assertWriteGates(text: string): void {
  const file = ts.createSourceFile('actions.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const methods = new Map<string, ts.MethodDeclaration>();
  walk(file, (node) => {
    if (ts.isMethodDeclaration(node) && node.body && ts.isIdentifier(node.name)) {
      methods.set(node.name.text, node);
    }
  });
  for (const name of ['create', 'add', 'remove', 'rate', 'action']) {
    const wrapper = methods.get(name);
    const method = methods.get(`${name}Locked`);
    if (!wrapper || !method) {
      throw new Error(`Missing write method: ${name}`);
    }
    const wrapperCalls: ts.CallExpression[] = [];
    walk(wrapper.body!, (node) => {
      if (ts.isCallExpression(node)) {
        wrapperCalls.push(node);
      }
    });
    const lockCall = wrapperCalls.find((call) => call.expression.getText(file) === 'this.accountLock.run');
    const callback = lockCall?.arguments[1];
    let delegatesToLockedMethod = false;
    if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
      walk(callback.body, (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText(file) === 'this' &&
          node.expression.name.text === `${name}Locked`
        ) {
          delegatesToLockedMethod = true;
        }
      });
    }
    const expectedLockKey = name === 'action' ? 'accountId' : 'body.ebayAccountId';
    if (!lockCall || lockCall.arguments[0]?.getText(file) !== expectedLockKey || !delegatesToLockedMethod) {
      throw new Error(`Write method is not serialized through its account lock: ${name}`);
    }
    const calls: ts.CallExpression[] = [];
    walk(method.body!, (node) => {
      if (ts.isCallExpression(node)) {
        calls.push(node);
      }
    });
    const gate = calls.findIndex((call) => call.expression.getText(file) === 'this.assertWritable');
    const firstMarketingCall = calls.findIndex((call) =>
      call.expression.getText(file).startsWith('this.client.')
    );
    if (gate < 0 || firstMarketingCall < 0 || gate > firstMarketingCall) {
      throw new Error(`Write method is not gated before Marketing: ${name}`);
    }
  }
  for (const name of ['create', 'rate']) {
    const method = methods.get(`${name}Locked`)!;
    const calls: ts.CallExpression[] = [];
    walk(method.body!, (node) => {
      if (ts.isCallExpression(node)) {
        calls.push(node);
      }
    });
    const rateValidation = calls.findIndex((call) => call.expression.getText(file) === 'this.validateRate');
    const gate = calls.findIndex((call) => call.expression.getText(file) === 'this.assertWritable');
    if (rateValidation < 0 || gate < 0 || rateValidation > gate) {
      throw new Error(`Direct rate is not validated before the write gate: ${name}`);
    }
  }
  const addGate = methods.get('addLocked')!.body!.getText(file).match(/this\.assertWritable\([\s\S]*?\)/)?.[0] ?? '';
  if (!/,\s*true\s*\)$/.test(addGate)) {
    throw new Error('Add does not validate its stored rate before eligibility');
  }
}

describe('campaign write boundaries', () => {
  it('charges campaign calls to MARKETING_ADS while capture-only report calls remain unbudgeted and retried', () => {
    const client = source('ebay-marketing.client.ts');
    expect(() => assertMarketingCallsBudgeted(client)).not.toThrow();
    const accountBudgetMutation = client.replace('EbayApiResource.MARKETING_ADS', 'EbayApiResource.ACCOUNT');
    expect(() => assertMarketingCallsBudgeted(accountBudgetMutation)).toThrow(/Marketing budget/);
    const perCallAccountOverride = client.replace(
      'this.options(priority)',
      '{ ...this.options(priority), acquireBudget: () => this.budget.acquire(EbayApiResource.ACCOUNT, priority) }'
    );
    expect(perCallAccountOverride).not.toBe(client);
    expect(() => assertMarketingCallsBudgeted(perCallAccountOverride)).toThrow(/per-call budget override/);
    const validRetryOverride = client.replace(
      'this.options(priority)',
      '{ ...this.options(priority), maxAttempts: 1 }'
    );
    expect(() => assertMarketingCallsBudgeted(validRetryOverride)).not.toThrow();
    const reportBudgetMutation = client.replace(
      '{ logger: this.logger }\n    );',
      '{ logger: this.logger, acquireBudget: () => this.budget.acquire(EbayApiResource.MARKETING_ADS, priority) }\n    );'
    );
    expect(reportBudgetMutation).not.toBe(client);
    expect(() => assertMarketingCallsBudgeted(reportBudgetMutation)).toThrow(/capture-only report/);
    const commentBypass = client.replace(
      'this.options(priority)',
      '{ logger: this.logger } /* REPORT_PATH */'
    );
    expect(commentBypass).not.toBe(client);
    expect(() => assertMarketingCallsBudgeted(commentBypass)).toThrow(/per-call budget override/);
  });

  it('gates every write before Marketing, validates direct rates first, and add validates its stored campaign rate', () => {
    const text = source('ebay-campaign-actions.service.ts');
    const file = ts.createSourceFile('actions.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const methods = new Map<string, ts.MethodDeclaration>();
    walk(file, (node) => {
      if (ts.isMethodDeclaration(node) && node.body && ts.isIdentifier(node.name)) {
        methods.set(node.name.text, node);
      }
    });
    expect(() => assertWriteGates(text)).not.toThrow();
    const ungatedAction = text.replace(
      'const { account } = await this.assertWritable(userId, accountId, campaignId);',
      'const account = { id: accountId, user_id: userId, status: \'active\' };'
    );
    expect(() => assertWriteGates(ungatedAction)).toThrow(/not gated before Marketing: action/);
    const internalGate = methods.get('assertWritable')!.body!.getText(file);
    expect(internalGate.indexOf('this.validateRate(Number(campaign.bid_percentage))')).toBeLessThan(
      internalGate.indexOf('this.eligibility.getEligibility')
    );
  });

  it('keeps applied-rate writes within the repository and action service, including compound SET clauses', () => {
    const listingsDir = join(moduleDir, '..', 'listings');
    const files: Record<string, string> = {};
    for (const name of readdirSync(listingsDir).filter((item) => item.endsWith('.ts') && !item.endsWith('.spec.ts'))) {
      files[`listings/${name}`] = readFileSync(join(listingsDir, name), 'utf8');
    }
    for (const name of readdirSync(moduleDir).filter((item) => item.endsWith('.ts') && !item.endsWith('.spec.ts'))) {
      files[name] = source(name);
    }
    const allowed = ['campaign-ad-state.repository.ts', 'ebay-campaign-actions.service.ts'];
    expect(() => assertAppliedRateWriters(files, allowed)).not.toThrow();
    expect(() =>
      assertAppliedRateWriters(
        { 'bad-writer.ts': 'db.query("UPDATE listings SET status = $1, ad_rate_applied = $2")' },
        allowed
      )
    ).toThrow(/Unexpected applied-rate writer/);
  });

  it('keeps the clear predicate inside the complete-sweep branch', () => {
    const repository = source('campaign-ad-state.repository.ts');
    expect(() => assertClearGuarded(repository)).not.toThrow();
    const unguardedMutation = repository.replace('if (clearOthers)', 'if (includeListings)');
    expect(() => assertClearGuarded(unguardedMutation)).toThrow(/not inside the clearOthers block/);
  });
});
