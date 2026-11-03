import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, weekDates, initialState, validateState, combinations, available, packing, searchItems, lookKey } from '../dist/domain.js';

const item = (id, category, overrides = {}) => ({
  id, name: id, category, colors: ['cream'],
  occasions: ['everyday', 'work', 'evening', 'weekend'],
  temperatures: ['warm', 'mild', 'cool'], image: `/media/${id}.jpg`, ...overrides,
});
const items = [item('shirt', 'top'), item('tee', 'top'), item('trousers', 'bottom'), item('dress', 'dress'), item('coat', 'layer'), item('sneakers', 'shoes'), item('tote', 'bag')];
const looks = [{ id: 'city', name: 'City', itemIds: ['shirt', 'trousers', 'sneakers'], occasion: 'work', temperature: 'mild', source: 'curated' }];
const created = { id: 'mine-1', name: ' My outfit ', itemIds: ['dress', 'sneakers'], occasion: 'evening', temperature: 'warm', source: 'created' };

test('local dates retain local calendar components and reject impossible dates', () => {
  assert.equal(localDate(new Date(2026, 10, 3, 23, 59)), '2026-11-03');
  assert.equal(localDate('2024-02-29'), '2024-02-29');
  assert.throws(() => localDate('2026-02-29'), RangeError);
  assert.throws(() => localDate(new Date(NaN)), RangeError);
});

test('Monday weeks cover Sunday, year boundaries, and offsets without mutating anchor', () => {
  const anchor = new Date(2027, 0, 3, 23, 59);
  const before = anchor.getTime();
  assert.deepEqual(weekDates(anchor), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(weekDates(anchor, 1)[0], '2027-01-04');
  assert.equal(weekDates('2026-11-02', -1)[0], '2026-10-26');
  assert.equal(anchor.getTime(), before);
  assert.throws(() => weekDates(anchor, 0.5), RangeError);
});

test('corrupt, oversized, and obsolete storage recover to independent initial state', () => {
  for (const raw of ['{', null, [], { version: 0 }, 'x'.repeat(1_000_001)]) {
    assert.deepEqual(validateState(raw, items, looks), initialState(items));
  }
  const a = initialState(items);
  a.availableItemIds.pop();
  assert.equal(initialState(items).availableItemIds.length, items.length);
});

test('normalization preserves intentional partial and empty wardrobe availability', () => {
  const raw = { ...initialState(items), availableItemIds: ['shirt', 'unknown', 'shirt'] };
  assert.deepEqual(validateState(JSON.stringify(raw), items, looks).availableItemIds, ['shirt']);
  assert.deepEqual(validateState({ ...raw, availableItemIds: [] }, items, looks).availableItemIds, []);
});

test('storage removes unknown outfits, duplicate IDs, invalid dates and unsafe shapes', () => {
  const raw = {
    ...initialState(items),
    createdOutfits: [created, { ...created }, { ...created, id: 'city' }, { ...created, id: 'bad', itemIds: ['missing'] }, { ...created, id: 'duplicate', itemIds: ['dress', 'dress'] }],
    favoriteOutfitIds: ['city', 'mine-1', 'ghost', 'mine-1'],
    plan: { '2026-11-03': 'mine-1', '2026-02-29': 'city', '2026-11-04': 'ghost', '2024-02-29': 'city', '__proto__': 'city' },
    packingChecks: { '2026-11-01/2026-11-07': ['shirt', 'shirt', 'missing'], '2026-11-09/2026-11-07': ['dress'], '2026-02-30/2026-11-07': ['coat'] },
  };
  const result = validateState(raw, items, looks);
  assert.equal(result.createdOutfits.length, 1);
  assert.equal(result.createdOutfits[0].name, 'My outfit');
  assert.deepEqual(result.favoriteOutfitIds, ['city', 'mine-1']);
  assert.deepEqual(result.plan, { '2026-11-03': 'mine-1', '2024-02-29': 'city' });
  assert.deepEqual(result.packingChecks, { '2026-11-01/2026-11-07': ['shirt'] });
});

test('created outfit normalization strips unsupported metadata and caps names and counts', () => {
  const candidates = Array.from({ length: 220 }, (_, n) => ({ ...created, id: `custom-${n}`, name: 'x'.repeat(200), image: 'https://untrusted.test/tracker', unexpected: true }));
  const result = validateState({ ...initialState(items), createdOutfits: candidates }, items, looks);
  assert.equal(result.createdOutfits.length, 200);
  assert.equal(result.createdOutfits[0].name.length, 80);
  assert.equal('image' in result.createdOutfits[0], false);
  assert.equal('unexpected' in result.createdOutfits[0], false);
});

test('outfits use real available pieces, valid base slots, shoes, and required cool layers', () => {
  const candidates = combinations(items, { occasion: 'work', temperature: 'cool', availableIds: items.map(x => x.id) });
  assert.ok(candidates.length > 0);
  const byId = new Map(items.map(x => [x.id, x]));
  for (const candidate of candidates) {
    const categories = candidate.itemIds.map(id => byId.get(id).category);
    assert.ok(categories.includes('shoes'));
    assert.ok(categories.includes('layer'));
    assert.ok(categories.includes('dress') || categories.includes('top') && categories.includes('bottom'));
    assert.equal(new Set(candidate.itemIds).size, candidate.itemIds.length);
  }
  assert.deepEqual(combinations(items, { occasion: 'work', temperature: 'cool', availableIds: items.filter(x => x.category !== 'layer').map(x => x.id) }), []);
  assert.deepEqual(combinations(items, { availableIds: [] }), []);
});

test('combinations respect tags, have stable unique keys, exclude shown looks and cap at 100', () => {
  const restricted = [...items, item('party-top', 'top', { occasions: ['evening'] }), item('snow-boots', 'shoes', { temperatures: ['cool'] })];
  const options = { occasion: 'work', temperature: 'warm', availableIds: restricted.map(x => x.id) };
  const first = combinations(restricted, options);
  assert.deepEqual(first, combinations([...restricted].reverse(), options));
  assert.ok(first.every(x => !x.itemIds.includes('party-top') && !x.itemIds.includes('snow-boots') && !x.itemIds.includes('coat')));
  assert.equal(new Set(first.map(x => x.key)).size, first.length);
  assert.equal(lookKey(['b', 'a', 'a']), 'a|b');
  assert.equal(combinations(restricted, { ...options, excludeKeys: first.map(x => x.key) }).length, 0);
  const many = [...items, ...Array.from({ length: 110 }, (_, n) => item(`top-${n}`, 'top'))];
  assert.equal(combinations(many, { occasion: 'work', temperature: 'warm' }).length, 100);
  assert.deepEqual(combinations(items, { occasion: 'unknown' }), []);
});

test('availability rejects an incomplete or empty outfit and preserves saved plan references', () => {
  assert.equal(available(looks[0], ['shirt', 'trousers', 'sneakers']), true);
  assert.equal(available(looks[0], ['shirt', 'sneakers']), false);
  assert.equal(available({ itemIds: [] }, []), false);
  assert.equal(available(null, []), false);
  const state = validateState({ ...initialState(items), availableItemIds: [], plan: { '2026-11-03': 'city' } }, items, looks);
  assert.equal(state.plan['2026-11-03'], 'city');
});

test('packing deduplicates physical pieces, counts wear occurrences and respects inclusive date range', () => {
  const plan = { '2026-11-01': 'city', '2026-11-02': 'city', '2026-11-03': 'mine-1', '2026-11-04': 'city', '2026-11-05': 'missing', '2026-02-30': 'city' };
  const result = packing(plan, [...looks, created], items, '2026-11-02', '2026-11-03');
  assert.equal(result.length, 4);
  assert.equal(result.find(x => x.item.id === 'sneakers').count, 2);
  assert.equal(result.find(x => x.item.id === 'dress').count, 1);
  assert.equal(new Set(result.map(x => x.item.id)).size, result.length);
  assert.deepEqual(packing(plan, looks, items, '2026-11-04', '2026-11-03'), []);
  assert.deepEqual(packing(plan, looks, items, '2026-02-30', '2026-11-03'), []);
});

test('search combines category, exact color and case/diacritic insensitive query terms', () => {
  const wardrobe = [item('linen', 'top', { name: 'Áo sơ mi Linen', colors: ['White'] }), item('coat', 'layer', { name: 'White coat', colors: ['white'] }), item('boots', 'shoes', { colors: ['black'] })];
  assert.deepEqual(searchItems(wardrobe, { category: 'top', color: 'white', query: 'AO linen' }).map(x => x.id), ['linen']);
  assert.equal(searchItems(wardrobe, { query: 'white' }).length, 2);
  assert.equal(searchItems(wardrobe, { color: 'white', query: 'black' }).length, 0);
  assert.equal(searchItems(wardrobe).length, wardrobe.length);
});
