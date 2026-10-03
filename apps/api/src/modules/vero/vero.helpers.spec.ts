import { compileVeroKeywords, findVeroMatch, parseVeroKeywords } from './vero.helpers';

describe('parseVeroKeywords', () => {
  it('splits on commas and new lines, never on spaces', () => {
    expect(parseVeroKeywords(['Stomp Rocket, Roku\nFlame   King'])).toEqual(['Stomp Rocket', 'Roku', 'Flame King']);
  });

  it('drops blanks, over-long entries and case-insensitive repeats', () => {
    expect(parseVeroKeywords(['Roku', ' roku ', '', ',', 'x'.repeat(81)])).toEqual(['Roku']);
  });
});

describe('findVeroMatch', () => {
  const list = compileVeroKeywords(['Roku', 'Stomp Rocket', 'Apple']);

  it('matches the brand or the manufacturer, in any case', () => {
    expect(findVeroMatch(list, ['ROKU', null])).toBe('Roku');
    expect(findVeroMatch(list, ['Generic', 'Apple Inc.'])).toBe('Apple');
  });

  it('matches whole words only', () => {
    expect(findVeroMatch(list, ['Rokua'])).toBeNull();
    expect(findVeroMatch(list, ['Pineapple Co'])).toBeNull();
    expect(findVeroMatch(list, ['Stomp'])).toBeNull();
    expect(findVeroMatch(list, ['Stomp Rocket Toys'])).toBe('Stomp Rocket');
  });

  it('answers null for no brand and for an empty list', () => {
    expect(findVeroMatch(list, ['', undefined, null])).toBeNull();
    expect(findVeroMatch([], ['Roku'])).toBeNull();
  });
});
