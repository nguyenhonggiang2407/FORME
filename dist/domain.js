const OCCASIONS = new Set(['everyday', 'work', 'evening', 'weekend']);
const TEMPERATURES = new Set(['warm', 'mild', 'cool']);
const MAX_OUTFITS = 200;
const MAX_PLAN_DAYS = 730;
const MAX_PACKING_RANGES = 52;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value);
const unique = values => [...new Set(values)];

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function asDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (!validDate(value)) throw new RangeError('Invalid local calendar date');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return date;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  return date;
}

export function localDate(value = new Date()) {
  const date = asDate(value);
  const year = date.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('Date outside supported calendar');
  return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weekDates(anchor = new Date(), offset = 0) {
  if (!Number.isInteger(offset)) throw new RangeError('Week offset must be an integer');
  const monday = asDate(anchor);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getTime());
    date.setDate(monday.getDate() + index);
    return localDate(date);
  });
}

export function initialState(items) {
  return {
    version: 1,
    availableItemIds: unique(items.map(item => item.id)),
    favoriteOutfitIds: [],
    createdOutfits: [],
    plan: {},
    packingChecks: {},
  };
}

function knownIds(value, known, limit = known.size) {
  return Array.isArray(value)
    ? unique(value.slice(0, Math.max(limit * 4, 100)).filter(id => typeof id === 'string' && known.has(id))).slice(0, limit)
    : [];
}

export function validateState(raw, items, looks) {
  const fallback = initialState(items);
  if (typeof raw === 'string') {
    if (raw.length > 1_000_000) return fallback;
    try { raw = JSON.parse(raw); } catch { return fallback; }
  }
  if (!record(raw) || raw.version !== 1) return fallback;
  const itemIds = new Set(items.map(item => item.id));
  const outfitIds = new Set(looks.map(look => look.id));
  const createdOutfits = [];
  for (const candidate of Array.isArray(raw.createdOutfits) ? raw.createdOutfits.slice(0, MAX_OUTFITS) : []) {
    if (!record(candidate) || !validId(candidate.id) || outfitIds.has(candidate.id)) continue;
    if (typeof candidate.name !== 'string' || !candidate.name.trim()) continue;
    if (!OCCASIONS.has(candidate.occasion) || !TEMPERATURES.has(candidate.temperature)) continue;
    if (!Array.isArray(candidate.itemIds) || candidate.itemIds.length < 1 || candidate.itemIds.length > 12) continue;
    if (candidate.itemIds.some(id => typeof id !== 'string' || !itemIds.has(id))) continue;
    const candidateIds = unique(candidate.itemIds);
    if (candidateIds.length !== candidate.itemIds.length) continue;
    const outfit = {
      id: candidate.id,
      name: candidate.name.trim().slice(0, 80),
      itemIds: candidateIds,
      occasion: candidate.occasion,
      temperature: candidate.temperature,
      source: 'created',
    };
    createdOutfits.push(outfit);
    outfitIds.add(outfit.id);
  }
  const plan = {};
  if (record(raw.plan)) {
    for (const [date, id] of Object.entries(raw.plan).slice(0, MAX_PLAN_DAYS)) {
      if (validDate(date) && typeof id === 'string' && outfitIds.has(id)) plan[date] = id;
    }
  }
  const packingChecks = {};
  if (record(raw.packingChecks)) {
    for (const [range, ids] of Object.entries(raw.packingChecks).slice(0, MAX_PACKING_RANGES)) {
      const dates = range.split('/');
      if (dates.length === 2 && dates.every(validDate) && dates[0] <= dates[1] && Array.isArray(ids)) {
        packingChecks[range] = knownIds(ids, itemIds);
      }
    }
  }
  return {
    version: 1,
    availableItemIds: own(raw, 'availableItemIds') && Array.isArray(raw.availableItemIds)
      ? knownIds(raw.availableItemIds, itemIds) : fallback.availableItemIds,
    favoriteOutfitIds: knownIds(raw.favoriteOutfitIds, outfitIds),
    createdOutfits,
    plan,
    packingChecks,
  };
}

export function lookKey(itemIds) {
  return unique(itemIds).sort().join('|');
}

export function available(outfit, availableIds) {
  if (!outfit || !Array.isArray(outfit.itemIds) || !outfit.itemIds.length) return false;
  const ids = new Set(availableIds || []);
  return outfit.itemIds.every(id => ids.has(id));
}

export function combinations(items, { occasion = 'everyday', temperature = 'mild', availableIds, excludeKeys = [] } = {}) {
  if (!OCCASIONS.has(occasion) || !TEMPERATURES.has(temperature)) return [];
  const allowed = new Set(availableIds ?? items.map(item => item.id));
  const selected = new Map();
  for (const item of items) {
    if (allowed.has(item.id) && Array.isArray(item.occasions) && item.occasions.includes(occasion)
      && Array.isArray(item.temperatures) && item.temperatures.includes(temperature)) selected.set(item.id, item);
  }
  const candidates = [...selected.values()].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const category = value => candidates.filter(item => item.category === value);
  const bases = [
    ...category('top').flatMap(top => category('bottom').map(bottom => [top, bottom])),
    ...category('dress').map(dress => [dress]),
  ];
  const layers = temperature === 'cool' ? category('layer')
    : temperature === 'mild' ? [null, ...category('layer')] : [null];
  const bags = [null, ...category('bag')];
  const excluded = new Set(excludeKeys);
  const seen = new Set();
  const result = [];
  for (const base of bases) for (const shoes of category('shoes')) for (const layer of layers) for (const bag of bags) {
    const itemIds = [...base, shoes, layer, bag].filter(Boolean).map(item => item.id);
    if (unique(itemIds).length !== itemIds.length) continue;
    const key = lookKey(itemIds);
    if (excluded.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push({ itemIds, key });
    if (result.length === 100) return result;
  }
  return result;
}

export function packing(plan, outfits, items, from, to) {
  if (!validDate(from) || !validDate(to) || from > to || !record(plan)) return [];
  const outfitMap = new Map(outfits.map(outfit => [outfit.id, outfit]));
  const itemMap = new Map(items.map(item => [item.id, item]));
  const counts = new Map();
  for (const [date, outfitId] of Object.entries(plan)) {
    if (!validDate(date) || date < from || date > to) continue;
    const outfit = outfitMap.get(outfitId);
    if (!outfit || !Array.isArray(outfit.itemIds)) continue;
    for (const id of unique(outfit.itemIds)) {
      if (itemMap.has(id)) counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  const order = ['top', 'bottom', 'dress', 'layer', 'shoes', 'bag'];
  return [...counts.entries()].map(([id, count]) => ({ item: itemMap.get(id), count }))
    .sort((a, b) => order.indexOf(a.item.category) - order.indexOf(b.item.category)
      || a.item.name.localeCompare(b.item.name, 'en'));
}

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function searchItems(items, { category = 'all', query = '', color = 'all' } = {}) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const wantedColor = normalize(color);
  return items.filter(item => {
    if (category !== 'all' && item.category !== category) return false;
    const colors = Array.isArray(item.colors) ? item.colors : [];
    if (wantedColor !== 'all' && !colors.some(value => normalize(value) === wantedColor)) return false;
    const text = normalize([item.name, item.category, ...colors].join(' '));
    return terms.every(term => text.includes(term));
  });
}
