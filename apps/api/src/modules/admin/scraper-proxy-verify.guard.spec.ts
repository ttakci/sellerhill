import * as fs from 'fs';
import * as path from 'path';

/**
 * A proxy URL carries credentials. The lightweight connectivity check added
 * for "let the admin see which saved/draft proxies actually connect" is a
 * NEW path a proxy value travels through — admin.controller.ts's body,
 * admin.service.ts's orchestration, scraper.client.ts's request — and every
 * one of those must never log the value, only its host:port-only `id` (the
 * scraper service is the one thing that ever reads the raw proxy; this side
 * only ever passes it through in a request body, never inspects or prints it).
 *
 * Source-grep, because nothing here throws a real credential to catch in a
 * unit test — the risk is a future `this.logger.debug(proxies)` or similar,
 * added for what looks like harmless debugging.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function read(fileName: string): string {
  return stripComments(fs.readFileSync(path.join(__dirname, fileName), 'utf8'));
}

describe('scraper proxy verify — credentials never logged or echoed back', () => {
  it('scraper.client.ts logs only a count on failure, never the proxies array', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'listings', 'scraper.client.ts'), 'utf8');
    const method = source.slice(source.indexOf('async verifyProxies'), source.indexOf('\n}', source.indexOf('async verifyProxies')));
    expect(stripComments(method)).toMatch(/logger\.error\(`Scraper proxy verify failed \(\$\{proxies\.length\}/);
    expect(stripComments(method)).not.toMatch(/logger\.\w+\([^)]*\bproxies\b(?!\.length)/);
  });

  it('admin.service.ts never logs the draft or the resolved proxy list', () => {
    const source = read('admin.service.ts');
    const start = source.indexOf('async verifyScraperProxies');
    const method = source.slice(start, source.indexOf('\n  }', start));
    expect(method).not.toMatch(/logger\.\w+\(/);
  });

  it('admin.controller.ts never echoes the request body back in the response', () => {
    const source = read('admin.controller.ts');
    const start = source.indexOf('async verifyScraperProxies');
    const method = source.slice(start, source.indexOf('\n  }', start));
    // The only thing returned is `{ results }`, built from what
    // verifyScraperProxies() resolves to — never `dto` (or `dto.proxies`)
    // itself, anywhere in a `return` statement.
    const returnStatements = method.match(/return[^;]*;/g) ?? [];
    expect(returnStatements.length).toBeGreaterThan(0);
    expect(returnStatements).toEqual(['return { results };']);
    for (const statement of returnStatements) {
      expect(statement).not.toMatch(/\bdto\b/);
    }
  });

  it('the Python endpoint never returns a probed URL, only egress.redact\'s host:port', () => {
    const appPy = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', '..', 'services', 'amazon-scraper', 'sellerhill', 'app.py'),
      'utf8',
    );
    const start = appPy.indexOf('def verify_proxies');
    const route = appPy.slice(start, appPy.indexOf('\n    @app.', start));
    expect(route).toMatch(/egress\.redact\(/);
  });
});
