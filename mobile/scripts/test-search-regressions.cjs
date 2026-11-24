const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/AppRoot.tsx'), 'utf8');
const ast = ts.createSourceFile('AppRoot.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function expression(name, context) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, `Missing implementation: ${name}`);
  if (ts.isCallExpression(found) && found.expression.getText(ast) === 'useCallback') found = found.arguments[0];
  const js = ts.transpile(`(${found.getText(ast)})`, { target: ts.ScriptTarget.ES2022 });
  return vm.runInNewContext(js, context);
}
const quietConsole = { info() {}, warn() {} };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const makeRestaurant = (i) => ({ id: `r${i}`, externalProvider: 'HOTPEPPER', externalId: `${i}`, name: `店${i}`, latitude: 35.68, longitude: 139.76, genre: 'ラーメン', rating: 0, photoUrl: null });
function poolContext(restaurants = []) {
  const ctx = {
    console: quietConsole, Date, Map, Math, setTimeout,
    // randishApi の isApiConnectivityError と同じ判定（kind が connection/timeout のみ再試行対象）。
    isApiConnectivityError: (error) => error?.kind === 'connection' || error?.kind === 'timeout',
    restaurantSearchKey: 'current', restaurantSearchKeyRef: { current: 'current' },
    matchingRestaurantsRef: { current: restaurants }, candidateCacheRef: { current: null },
    candidatePoolRunRef: { current: 0 },
    subscription: { isPro: true }, minRating: 0, openNowOnly: false, situation: 'none',
    excludedKeys: new Set(), excludedKeyForCandidate: p => p.id,
    distanceBetweenLocationsMeters: (a, b) => Math.abs(a.latitude - b.latitude) * 111320,
    prioritizeCandidatesForSituation: p => p,
    apiBaseUrlCandidates: ['https://example.test'], syncWorkingApiBaseUrl() {},
    getUsableCandidateCache: () => null,
    setMapCandidates(p) { ctx.published = p; }, setMapCandidatesSearchKey() {}, setMapRouletteStatus(s) { ctx.status = s; },
    randishApi: { getNearbyPlaces: async () => { throw new Error('nearby unavailable'); } },
  };
  ctx.toOptionalNumber = expression('toOptionalNumber', ctx);
  for (const name of ['restaurantToCandidatePlace', 'candidatePlaceKey', 'mergeCandidatePlaces', 'candidateMatchesPremiumConditions']) ctx[name] = expression(name, ctx);
  return ctx;
}
const query = { key: 'q', center: { latitude: 35.68, longitude: 139.76 }, radius: 1500 };

async function main() {
  const key = expression('buildRestaurantCacheKey', {});
  assert.notEqual(key({ range: 4, distanceMeters: 1500 }), key({ range: 4, distanceMeters: 2000 }), '1.5km and 2km must not share cached results');

  const firstSearch = deferred(), secondSearch = deferred();
  const searchContext = {
    console: quietConsole, Date, Map,
    area: 'Tokyo', previewApiParams: { area: 'Tokyo' },
    restaurantSearchRunRef: { current: 0 }, restaurantSearchKeyRef: { current: key({ area: 'Tokyo' }) },
    restaurantListCacheRef: { current: new Map() }, RESTAURANT_LIST_CACHE_TTL_MS: 600000,
    buildRestaurantCacheKey: key, apiBaseUrlCandidates: ['https://example.test'],
    conditionRandom: { area: false, genre: false }, genre: 'すべて', hasHiddenPreviewCondition: false,
    normalizeRestaurant: x => x, restaurantMatchesSelectedGenre: () => true,
    syncWorkingApiBaseUrl() {}, buildFewCandidatesHint: () => null, buildGenreSummaryItems: () => [],
    setIsLoading(value) { searchContext.loading = value; },
    setRestaurants(value) { searchContext.rows = value; }, setRestaurantsArea(value) { searchContext.rowsArea = value; },
    setRestaurantsQueryKey(value) { searchContext.rowsKey = value; }, setMessage(value) { searchContext.message = value; },
    randishApi: { getRestaurants: (_base, params) => params.area === 'Tokyo' ? firstSearch.promise : secondSearch.promise },
  };
  const oldSearch = expression('loadRestaurants', searchContext)();
  searchContext.area = 'Osaka'; searchContext.previewApiParams = { area: 'Osaka' };
  searchContext.restaurantSearchKeyRef.current = key(searchContext.previewApiParams);
  const newSearch = expression('loadRestaurants', searchContext)();
  secondSearch.resolve([makeRestaurant(2)]); await newSearch;
  firstSearch.resolve([makeRestaurant(1)]); await oldSearch;
  assert.equal(searchContext.rows[0].id, 'r2', 'late Tokyo results must not replace Osaka results');
  assert.equal(searchContext.rowsArea, 'Osaka');

  const ctx = poolContext(Array.from({ length: 45 }, (_, i) => makeRestaurant(i)));
  let calls = 0;
  ctx.randishApi.getNearbyPlaces = async () => { calls++; throw new Error('offline'); };
  const result = await expression('loadCandidatePool', ctx)(query);
  assert.equal(result.candidates.length, 45, 'all 45 listed stores must remain drawable, including stores without photos');
  assert.equal(calls, 0, 'a populated list must not depend on a second API');
  assert.equal(ctx.published.length, 45);

  const slow = deferred();
  const recovering = poolContext();
  recovering.randishApi.getNearbyPlaces = () => slow.promise;
  const pending = expression('loadCandidatePool', recovering)(query);
  recovering.matchingRestaurantsRef.current = [makeRestaurant(1)];
  slow.reject(new Error('nearby offline'));
  assert.equal((await pending).candidates.length, 1, 'use list results arriving while nearby API fails');

  const stale = poolContext();
  const delayed = deferred();
  stale.randishApi.getNearbyPlaces = () => delayed.promise;
  const oldPool = expression('loadCandidatePool', stale)(query);
  stale.restaurantSearchKeyRef.current = 'new-search';
  delayed.resolve({ places: [], source: 'HOTPEPPER' });
  await oldPool;
  assert.equal(stale.published, undefined, 'an old search must not publish into the new search');

  const overlapping = poolContext();
  const oldNearby = deferred(), newNearby = deferred();
  let nearbyCalls = 0;
  overlapping.randishApi.getNearbyPlaces = () => (++nearbyCalls === 1 ? oldNearby.promise : newNearby.promise);
  const oldFilters = expression('loadCandidatePool', overlapping)(query);
  const newFilters = expression('loadCandidatePool', overlapping)({ ...query, key: 'new-filters' });
  newNearby.resolve({ places: [overlapping.restaurantToCandidatePlace(makeRestaurant(2))], source: 'HOTPEPPER' });
  await newFilters;
  oldNearby.resolve({ places: [overlapping.restaurantToCandidatePlace(makeRestaurant(1))], source: 'HOTPEPPER' });
  await oldFilters;
  assert.equal(overlapping.published[0].id, 'r2', 'a late pool with older filters must not overwrite the newer pool');

  const filtered = poolContext([makeRestaurant(1), { ...makeRestaurant(2), latitude: 36.0 }, makeRestaurant(3)]);
  filtered.excludedKeys.add('r3');
  assert.equal((await expression('loadCandidatePool', filtered)(query)).candidates.length, 1, 'apply distance and exclusions before drawing');
  await assert.rejects(expression('loadCandidatePool', poolContext())(query), /nearby unavailable/, 'a real connection failure must remain an error');

  const retrying = poolContext();
  let retryCalls = 0;
  retrying.randishApi.getNearbyPlaces = async () => {
    retryCalls++;
    if (retryCalls === 1) throw Object.assign(new Error('timeout'), { kind: 'timeout' });
    return { places: [retrying.restaurantToCandidatePlace(makeRestaurant(7))], source: 'HOTPEPPER' };
  };
  assert.equal((await expression('loadCandidatePool', retrying)(query)).candidates.length, 1, 'a transient timeout is retried once and recovers');
  assert.equal(retryCalls, 2, 'the nearby search is attempted exactly twice');

  // Exercise the actual request implementation with a body that stalls after headers.
  const apiSource = fs.readFileSync(path.join(__dirname, '../src/services/randishApi.ts'), 'utf8');
  const apiJs = ts.transpile(apiSource, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
  let timeoutCallback, cleared = false, timeoutMs, bodyStarted = false;
  const apiContext = {
    exports: {}, process: { env: {} }, console: quietConsole, AbortController, Error,
    setTimeout(fn, ms) { timeoutCallback = fn; timeoutMs = ms; return 1; },
    clearTimeout() { cleared = true; },
    fetch: async (_url, opts) => ({ ok: true, status: 200, json: () => { bodyStarted = true; return new Promise((_resolve, reject) => opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); })); } }),
  };
  vm.runInNewContext(apiJs, apiContext);
  const request = apiContext.exports.randishApi.getRestaurants('https://example.test');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bodyStarted, true);
  assert.equal(cleared, false, 'timeout must cover the response body');
  assert.ok(timeoutMs >= 60000, 'allow the API server to wake up');
  timeoutCallback();
  await assert.rejects(request, e => e.kind === 'timeout');
  assert.equal(cleared, true);
  apiContext.fetch = async () => ({ ok: false, status: 503, json: async () => ({ message: 'Service unavailable' }) });
  await assert.rejects(apiContext.exports.randishApi.getRestaurants('https://example.test'), e => e.kind === 'http' && e.status === 503);
  apiContext.fetch = async () => ({ ok: true, status: 204 });
  assert.equal(await apiContext.exports.randishApi.logout('https://example.test'), undefined);
  console.log('PASS: search regressions (45 stores, photos, fallback, out-of-order results, stale pools, distance, exclusions, cache, body timeout)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
