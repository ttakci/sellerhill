import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

/** The `scraper:` service block of a compose file, up to the next top-level service. */
function scraperBlock(compose: string): string {
  const start = compose.search(/\r?\n {2}scraper:\r?\n/);
  if (start < 0) {return '';}
  const rest = compose.slice(start + 1);
  const next = rest.slice(1).search(/\r?\n {2}[a-z][\w-]*:\r?\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

// Spec D5: never scrape from the server's own IP. The dev-only switch must not
// exist in any deployment file, and the NestJS side must not call the service
// without proxies. Working copies may be CRLF on Windows, hence `\r?\n`.
describe('scraper egress guard', () => {
  it('deployment compose files never mention SCRAPER_ALLOW_DIRECT', () => {
    expect(read('docker-compose.test.yml')).not.toMatch(/SCRAPER_ALLOW_DIRECT/);
    expect(read('docker-compose.production.yml')).not.toMatch(/SCRAPER_ALLOW_DIRECT/);
  });

  it('both deployment files define the scraper and give the api its URL', () => {
    for (const f of ['docker-compose.test.yml', 'docker-compose.production.yml']) {
      const c = read(f);
      expect(c).toMatch(/\r?\n {2}scraper:\r?\n/);
      expect(c).toMatch(/SCRAPER_SERVICE_URL[:=]\s*http:\/\/scraper:8080/);
    }
  });

  it('the deployed scraper publishes no port and stays off the shared coolify network', () => {
    for (const f of ['docker-compose.test.yml', 'docker-compose.production.yml']) {
      const block = scraperBlock(read(f));
      expect(block).toMatch(/scraper_net/);
      expect(block).not.toMatch(/\r?\n {4}ports:/);
      expect(block).not.toMatch(/- coolify/);
    }
  });

  it('the api never waits for a healthy scraper — it must boot when the scraper is down', () => {
    for (const f of ['docker-compose.test.yml', 'docker-compose.production.yml']) {
      expect(read(f)).not.toMatch(/scraper:\s*\r?\n\s*condition:\s*service_healthy/);
    }
  });

  it('ProductSourceService short-circuits on an empty proxy list', () => {
    expect(read('apps/api/src/modules/listings/product-source.service.ts')).toMatch(/proxies\.length === 0[\s\S]{0,300}NO_PROXY/);
  });

  it('the Python service refuses direct egress', () => {
    expect(read('services/amazon-scraper/amazon/fetch.py')).toMatch(/egress\.require_proxy\(\)/);
    expect(read('services/amazon-scraper/sellerhill/egress.py')).toMatch(/SCRAPER_ALLOW_DIRECT"\) == "1"/);
  });

  it('the scraper image runs as a non-root user', () => {
    expect(read('services/amazon-scraper/Dockerfile')).toMatch(/\r?\nUSER (?!root\b)\S+/);
  });
});
