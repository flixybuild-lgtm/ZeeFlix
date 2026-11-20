import {filterAdultResults, isExplicitlyAdult} from '../src/lib/contentTags';

describe('Framewave mature-result preference', () => {
  it('detects explicit adult labels but does not guess from ordinary titles', () => {
    expect(isExplicitlyAdult({title: 'Late Night 18+'})).toBe(true);
    expect(isExplicitlyAdult({tag: 'TV-MA'})).toBe(true);
    expect(isExplicitlyAdult({rating: 'NC-17'})).toBe(true);
    expect(isExplicitlyAdult({title: '18 Again'})).toBe(false);
    expect(isExplicitlyAdult({title: 'A rated performance'})).toBe(true);
  });

  it('keeps explicitly mature items out unless the setting is enabled', () => {
    const items = [
      {title: 'Family Film'},
      {title: 'Late Night', cornerTag: '18+'},
    ];
    expect(filterAdultResults(items, false)).toEqual([items[0]]);
    expect(filterAdultResults(items, true)).toEqual(items);
  });
});
