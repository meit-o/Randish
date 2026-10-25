const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-randish-test-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NearbyRequest = {
  latitude?: number;
  longitude?: number;
  radius?: number;
  category?: string;
  priceRange?: string;
  openNow?: boolean;
  minRating?: number;
};

type Candidate = {
  id: string;
  provider: string;
  providerPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  categories: string[];
  rating: number | null;
  priceLevel: number | null;
  openNow: boolean | null;
  address: string | null;
  distanceMeters: number;
  googleMapsUri: string | null;
  photoUrl: string | null;
  photoAttributions: { displayName: string; uri: string }[];
  _budgetAverage?: number | null;
};

const MAX_RESULTS = 60;
const MAX_RADIUS_METERS = 20_000;
const EARTH_RADIUS_METERS = 6_371_000;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "POST is required." }, 405);
  }

  const expectedToken = Deno.env.get("RANDISH_EDGE_TEST_TOKEN") ?? "";
  const suppliedToken = request.headers.get("x-randish-test-token") ?? "";
  if (!expectedToken || suppliedToken.length !== expectedToken.length || suppliedToken !== expectedToken) {
    return json({ error: "Invalid test token." }, 401);
  }

  let rawInput: unknown;
  try {
    rawInput = await request.json();
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return json({ error: "Request body must be a JSON object." }, 400);
  }
  const input = rawInput as NearbyRequest;
  if (input.category != null && (typeof input.category !== "string" || input.category.length > 80)) {
    return json({ error: "category must be a string of at most 80 characters." }, 400);
  }
  if (input.priceRange != null && (typeof input.priceRange !== "string" || input.priceRange.length > 100)) {
    return json({ error: "priceRange must be a string of at most 100 characters." }, 400);
  }
  if (input.openNow != null && typeof input.openNow !== "boolean") {
    return json({ error: "openNow must be a boolean." }, 400);
  }

  const latitude = input.latitude;
  const longitude = input.longitude;
  const radius = input.radius ?? 1_500;
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90
    || !isFiniteNumber(longitude) || longitude < -180 || longitude > 180) {
    return json({ error: "Valid latitude and longitude are required." }, 400);
  }
  if (!isFiniteNumber(radius) || radius < 50 || radius > MAX_RADIUS_METERS) {
    return json({ error: `radius must be between 50 and ${MAX_RADIUS_METERS} meters.` }, 400);
  }
  if (input.minRating != null && (!isFiniteNumber(input.minRating) || input.minRating < 1 || input.minRating > 5)) {
    return json({ error: "minRating must be between 1 and 5." }, 400);
  }

  const startedAt = Date.now();
  const errors: Record<string, string> = {};
  const primary: Candidate[] = [];
  const budgetMax = parseBudgetMax(input.priceRange);
  const geoapifyKey = Deno.env.get("GEOAPIFY_API_KEY") ?? "";
  const hotPepperKey = Deno.env.get("HOTPEPPER_API_KEY") ?? "";

  const primaryResults = await Promise.allSettled([
    hotPepperKey ? searchHotPepper(hotPepperKey, latitude, longitude, radius, input.category, budgetMax) : Promise.resolve([]),
    geoapifyKey ? searchGeoapify(geoapifyKey, latitude, longitude, radius, input.category) : Promise.resolve([]),
  ]);
  primaryResults.forEach((result, index) => {
    const provider = index === 0 ? "HOTPEPPER" : "GEOAPIFY";
    if (result.status === "fulfilled") primary.push(...result.value);
    else errors[provider] = safeError(result.reason);
  });

  const uniquePrimary = deduplicate(primary).filter((place) => place.distanceMeters <= radius).slice(0, MAX_RESULTS);
  let googlePlaces: Candidate[] = [];
  const googleEnabled = Deno.env.get("RANDISH_GOOGLE_PLACES_ENABLED") === "true";
  const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? "";
  if (googleEnabled && googleKey && uniquePrimary.length < MAX_RESULTS) {
    try {
      googlePlaces = await searchGoogle(googleKey, latitude, longitude, radius, input.category, MAX_RESULTS - uniquePrimary.length);
    } catch (error) {
      errors.GOOGLE_PLACES = safeError(error);
    }
  }

  let places = deduplicate([...uniquePrimary, ...googlePlaces]).filter((place) => place.distanceMeters <= radius);
  if (input.openNow === true) places = places.filter((place) => place.openNow === true);
  if (input.minRating != null) places = places.filter((place) => place.rating != null && place.rating >= input.minRating!);
  places = places.slice(0, MAX_RESULTS);

  const source = uniquePrimary.length && googlePlaces.length
    ? "HYBRID_PLACES"
    : googlePlaces.length
      ? "GOOGLE_PLACES"
      : "RANDISH_RESTAURANTS";
  return json({
    places: places.map(({ _budgetAverage: _ignored, ...place }) => place),
    cacheHit: false,
    source,
    fetchedAt: new Date().toISOString(),
    message: places.length ? "fresh nearby candidates" : "no nearby candidates",
    diagnostics: {
      elapsedMs: Date.now() - startedAt,
      providers: {
        HOTPEPPER: { configured: Boolean(hotPepperKey), count: primaryResults[0].status === "fulfilled" ? primaryResults[0].value.length : 0 },
        GEOAPIFY: { configured: Boolean(geoapifyKey), count: primaryResults[1].status === "fulfilled" ? primaryResults[1].value.length : 0 },
        GOOGLE_PLACES: { enabled: googleEnabled, configured: Boolean(googleKey), count: googlePlaces.length },
      },
      errors,
    },
  });
});

async function searchHotPepper(key: string, lat: number, lng: number, radius: number, category?: string, budgetMax?: number | null): Promise<Candidate[]> {
  const params = new URLSearchParams({
    key,
    lat: String(lat),
    lng: String(lng),
    range: String(hotPepperRange(radius)),
    order: "4",
    count: "100",
    format: "json",
  });
  const genreCode = hotPepperGenre(category);
  if (genreCode) params.set("genre", genreCode);
  if (category && category !== "すべて" && category.toLowerCase() !== "all") params.set("keyword", category);
  const body = await fetchJson(`https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?${params}`);
  if (body?.results?.error?.message) throw new Error(`Hot Pepper API: ${String(body.results.error.message).slice(0, 200)}`);
  const shops = body?.results?.shop;
  if (!Array.isArray(shops)) return [];
  return shops.map((shop: any) => {
    const shopLat = Number(shop.lat);
    const shopLng = Number(shop.lng);
    if (!Number.isFinite(shopLat) || !Number.isFinite(shopLng) || !shop.name) return null;
    const id = String(shop.id ?? `${shopLat}:${shopLng}`);
    const address = shop.address || null;
    const photoUrl = shop.photo?.mobile?.l || shop.photo?.pc?.l || null;
    const budgetNumbers = String(shop.budget?.name ?? "").match(/[\d,]+/g)?.map((item: string) => Number(item.replaceAll(",", ""))).filter(Number.isFinite) ?? [];
    const budgetAverage = budgetNumbers.length ? Math.round(budgetNumbers.reduce((sum: number, value: number) => sum + value, 0) / budgetNumbers.length) : null;
    if (budgetMax != null && budgetNumbers.length && Math.min(...budgetNumbers) > budgetMax) return null;
    return candidate({
      provider: "HOTPEPPER", providerPlaceId: id, name: shop.name, latitude: shopLat, longitude: shopLng,
      categories: [shop.genre?.name, "HOTPEPPER"].filter(Boolean), rating: null,
      priceLevel: budgetAverage == null ? null : budgetAverage <= 1_000 ? 1 : budgetAverage <= 2_000 ? 2 : budgetAverage <= 5_000 ? 3 : 4,
      openNow: null, address, _budgetAverage: budgetAverage,
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${address ?? ""}`)}`,
      photoUrl,
    }, lat, lng);
  }).filter(Boolean) as Candidate[];
}

async function searchGeoapify(key: string, lat: number, lng: number, radius: number, category?: string): Promise<Candidate[]> {
  // Keep the commas unescaped; Geoapify parses them as separators in these parameters.
  const requested = geoapifyCategories(category);
  let body: any;
  try {
    body = await fetchGeoapify(key, lat, lng, radius, requested);
  } catch (error) {
    const general = ["catering.restaurant", "catering.fast_food", "catering.cafe", "catering.bar"];
    if (!(error instanceof Error) || !error.message.includes("HTTP 400") || requested.join(",") === general.join(",")) throw error;
    body = await fetchGeoapify(key, lat, lng, radius, general);
  }
  const features = body?.features;
  if (!Array.isArray(features)) return [];
  return features.map((feature: any) => {
    const properties = feature?.properties ?? {};
    const coords = feature?.geometry?.coordinates;
    const placeLat = Number(properties.lat ?? coords?.[1]);
    const placeLng = Number(properties.lon ?? coords?.[0]);
    const name = properties.name || properties.name_international || properties.address_line1;
    if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return null;
    const id = String(properties.place_id ?? `${name}:${placeLat.toFixed(5)}:${placeLng.toFixed(5)}`);
    const categories: string[] = Array.isArray(properties.categories) ? properties.categories : [];
    if (!matchesGenre(name, category, categories)) return null;
    return candidate({
      provider: "GEOAPIFY", providerPlaceId: id, name,
      latitude: placeLat, longitude: placeLng,
      categories,
      rating: null, priceLevel: null, openNow: null,
      address: properties.formatted || properties.address_line2 || null,
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${properties.formatted ?? ""}`)}`,
      photoUrl: null,
    }, lat, lng);
  }).filter(Boolean) as Candidate[];
}

async function fetchGeoapify(key: string, lat: number, lng: number, radius: number, categories: string[]): Promise<any> {
  const url = `https://api.geoapify.com/v2/places?categories=${categories.join(",")}&filter=circle:${lng},${lat},${radius}&limit=100&lang=ja&apiKey=${encodeURIComponent(key)}`;
  return fetchJson(url);
}

async function searchGoogle(key: string, lat: number, lng: number, radius: number, category: string | undefined, limit: number): Promise<Candidate[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.priceLevel,places.googleMapsUri,places.currentOpeningHours",
    },
    body: JSON.stringify({
      textQuery: category ? `飲食店 ${category}` : "飲食店",
      languageCode: "ja",
      regionCode: "JP",
      maxResultCount: Math.max(1, Math.min(limit, 20)),
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    }),
  });
  const body = await readJsonResponse(response);
  return (body?.places ?? []).map((place: any) => {
    const placeLat = Number(place.location?.latitude);
    const placeLng = Number(place.location?.longitude);
    const name = place.displayName?.text;
    if (!name || !Number.isFinite(placeLat) || !Number.isFinite(placeLng)) return null;
    return candidate({
      provider: "GOOGLE_PLACES", providerPlaceId: String(place.id ?? name), name,
      latitude: placeLat, longitude: placeLng, categories: [category || "restaurant", "GOOGLE_PLACES"],
      rating: typeof place.rating === "number" ? place.rating : null,
      priceLevel: googlePriceLevel(place.priceLevel),
      openNow: typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : null,
      address: place.formattedAddress || null,
      googleMapsUri: place.googleMapsUri || null,
      // Do not return a media URL with the server key embedded in its query string.
      photoUrl: null,
    }, lat, lng);
  }).filter((item: Candidate | null) => item && item.distanceMeters <= radius) as Candidate[];
}

function candidate(value: Omit<Candidate, "id" | "distanceMeters" | "photoAttributions">, lat: number, lng: number): Candidate {
  const distanceMeters = Math.round(distance(lat, lng, value.latitude, value.longitude));
  return {
    ...value,
    id: `${value.provider.toLowerCase()}-${value.providerPlaceId.replace(/[^A-Za-z0-9._:@-]/g, "_").slice(0, 90)}`,
    distanceMeters,
    photoAttributions: [],
  };
}

function deduplicate(places: Candidate[]): Candidate[] {
  const unique: Candidate[] = [];
  for (const place of places) {
    const normalizedName = normalize(place.name);
    const existing = unique.find((item) => item.id === place.id
      || (normalize(item.name) === normalizedName && distance(item.latitude, item.longitude, place.latitude, place.longitude) <= 60));
    if (!existing) {
      unique.push(place);
    } else if (!existing.photoUrl && place.photoUrl) {
      existing.photoUrl = place.photoUrl;
    }
  }
  return unique;
}

function geoapifyCategories(category?: string): string[] {
  if (!category || category === "すべて" || category.toLowerCase() === "all") {
    return ["catering.restaurant", "catering.fast_food", "catering.cafe", "catering.bar"];
  }
  if (["ラーメン", "うどん", "そば"].includes(category)) {
    return ["catering.restaurant.ramen", "catering.fast_food.ramen", "catering.restaurant.noodle", "catering.fast_food.noodle", "catering.restaurant.japanese"];
  }
  if (["和食", "日本料理"].includes(category)) return ["catering.restaurant.japanese", "catering.restaurant"];
  if (category === "焼肉") return ["catering.restaurant.barbecue", "catering.restaurant.steak_house", "catering.restaurant"];
  if (category === "寿司") return ["catering.restaurant.sushi", "catering.restaurant.japanese", "catering.restaurant"];
  return ["catering.restaurant", "catering.fast_food", "catering.cafe", "catering.bar"];
}

function hotPepperGenre(category?: string): string | null {
  const codes: Record<string, string> = { "ラーメン": "G013", "焼肉": "G008", "居酒屋": "G001", "韓国料理": "G017", "カレー": "G009", "うどん": "G004", "そば": "G004", "寿司": "G004", "中華": "G007", "餃子": "G007", "イタリアン": "G006", "ピザ": "G006", "洋食": "G005", "スイーツ": "G014", "カフェ": "G014", "ハンバーガー": "G015" };
  return category ? codes[category] ?? null : null;
}

function hotPepperRange(radius: number): number {
  if (radius <= 300) return 1;
  if (radius <= 500) return 2;
  if (radius <= 1_000) return 3;
  if (radius <= 2_000) return 4;
  return 5;
}

function googlePriceLevel(value: string | undefined): number | null {
  if (!value) return null;
  const levels: Record<string, number> = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
  return levels[value] ?? null;
}

function parseBudgetMax(value?: string): number | null {
  const numbers = value?.match(/[\d,]+/g)?.map((item) => Number(item.replaceAll(",", ""))).filter(Number.isFinite) ?? [];
  return numbers.length ? Math.max(...numbers) : null;
}

function matchesGenre(name: string, category: string | undefined, categories: string[]): boolean {
  if (!category || category === "すべて" || category.toLowerCase() === "all") return true;
  const text = normalize(`${name} ${categories.join(" ")}`);
  if (["ラーメン", "うどん", "そば"].includes(category)) {
    return categories.some((item) => item.includes(".ramen") || item.includes(".noodle"))
      || ["ラーメン", "らーめん", "つけ麺", "つけめん", "油そば", "まぜそば", "麺", "ramen", "noodle"].some((word) => text.includes(normalize(word)));
  }
  const aliases: Record<string, string[]> = {
    "寿司": ["寿司", "鮨", "sushi"], "焼肉": ["焼肉", "焼き肉", "barbecue", "bbq"],
    "カレー": ["カレー", "curry"], "うどん": ["うどん", "udon"], "そば": ["そば", "蕎麦", "soba"],
    "居酒屋": ["居酒屋", "izakaya", "pub"], "カフェ": ["カフェ", "cafe"],
    "韓国料理": ["韓国", "korean"], "中華": ["中華", "中国料理", "chinese"],
    "ピザ": ["ピザ", "pizza"], "ハンバーガー": ["ハンバーガー", "burger"],
  };
  const terms = aliases[category];
  return terms ? terms.some((word) => text.includes(normalize(word))) : true;
}

async function fetchJson(url: string): Promise<any> {
  return readJsonResponse(await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) }));
}

async function readJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}: ${text.slice(0, 250)}`);
  return text ? JSON.parse(text) : {};
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Provider request failed.";
  return message.replace(/(key|apiKey|token)=?[^&\s]*/gi, "$1=[redacted]").slice(0, 300);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}　]/gu, "");
}

function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
