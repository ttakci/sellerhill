import { EpsUploadPacer } from './eps-upload-pacer';

describe('EpsUploadPacer', () => {
  it('lets the first upload of a store go immediately', () => {
    const pacer = new EpsUploadPacer(125);
    expect(pacer.reserve('store-a', 1_000)).toBe(0);
  });

  it('spaces a burst on one store by the minimum interval', () => {
    const pacer = new EpsUploadPacer(125);
    expect(pacer.reserve('store-a', 1_000)).toBe(0);
    expect(pacer.reserve('store-a', 1_000)).toBe(125);
    expect(pacer.reserve('store-a', 1_000)).toBe(250);
  });

  it('keys stores independently — one store’s burst never delays another', () => {
    const pacer = new EpsUploadPacer(125);
    pacer.reserve('store-a', 1_000);
    pacer.reserve('store-a', 1_000);
    expect(pacer.reserve('store-b', 1_000)).toBe(0);
  });

  it('an idle store is immediate again — no debt accumulates across quiet periods', () => {
    const pacer = new EpsUploadPacer(125);
    pacer.reserve('store-a', 1_000);
    pacer.reserve('store-a', 1_000);
    expect(pacer.reserve('store-a', 10_000)).toBe(0);
  });

  it('a caller arriving mid-window waits only the remainder', () => {
    const pacer = new EpsUploadPacer(125);
    pacer.reserve('store-a', 1_000); // slot at 1000, next at 1125
    expect(pacer.reserve('store-a', 1_100)).toBe(25);
  });

  it('a non-finite or negative interval degrades to no pacing, never to a stuck queue', () => {
    expect(new EpsUploadPacer(Number.NaN).reserve('a', 1_000)).toBe(0);
    expect(new EpsUploadPacer(-5).reserve('a', 1_000)).toBe(0);
  });
});
