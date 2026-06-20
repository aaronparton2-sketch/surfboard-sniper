// Surfboard Sniper — buy-box matcher
// ----------------------------------
// Takes raw Facebook Marketplace listings (as returned by the Apify
// apify/facebook-marketplace-scraper actor) and returns only the ones that
// match your "buy box": the brands, sizes, price and location you actually
// want. It runs as a plain Node module AND drops straight into an n8n Code
// node (see workflow/surfboard-sniper.template.json).
//
// Edit CONFIG below to make it yours. Run `node src/demo.js` to see it work
// against the sample listings with no API keys needed.

// ---------------------------------------------------------------------------
// CONFIG — change everything in here to match what YOU are hunting for.
// ---------------------------------------------------------------------------

// Brands to watch. `aliases` match anywhere in the text (case-insensitive,
// substring). `strict` are short/ambiguous tokens (like "js" or "ci") that
// only match as a whole word, so "just like new" doesn't read as "JS".
const BRANDS = {
  "JS": { aliases: ["js industries", "jason stevenson"], strict: ["js"] },
  "DHD": { aliases: ["darren handley designs", "darren handley"], strict: ["dhd"] },
  "Pyzel": { aliases: ["pyzel"], strict: [] },
  "Channel Islands": { aliases: ["channel islands", "channel island", "al merrick", "almerrick"], strict: ["ci"] },
  "Haydenshapes": { aliases: ["haydenshapes", "hayden shapes"], strict: ["hs", "hayden"] },
};

const CONFIG = {
  // Which of the brands above to actually alert on.
  brands: ["JS", "DHD", "Pyzel", "Channel Islands", "Haydenshapes"],

  // Size window, in inches of length and litres of volume.
  minLengthIn: 68,   // 5'8"
  maxLengthIn: 78,   // 6'6"
  minVolumeL: 30,

  // Most you'll pay.
  maxPrice: 900,

  // Location filter. Two ways, both optional:
  //  1) regionPattern — a regex tested against the listing's location text.
  //  2) centre + radiusKm — a geo radius, used when the listing has lat/lon.
  // A listing passes if EITHER check passes (whichever data is available).
  regionPattern: /perth|\bwa\b|western australia/,
  centre: { lat: -31.9505, lon: 115.8605 }, // Perth CBD
  radiusKm: 30,

  // Currency label only used for display in the caption.
  currency: "A$",
};

// Titles containing any of these are skipped (accessories, not boards).
const EXCLUDE_TITLE = [
  "surfboard bag", "board bag", "surfboard cover", "board cover", "surfboard sock",
  "surfboard fins", "fins only", "set of fins", "fin set", "surfboard fin", " fins",
  "kitesurf", "kite surf", "kiteboard", "wakeboard", "skimboard", "bodyboard",
  "boogie board", "sup ", "stand up paddle", "paddle board", "wetsuit", "leash only",
  "roof rack", "bike rack", "surfboard rack", " rack", "traction pad", "deck grip",
  "decorative",
];

// ---------------------------------------------------------------------------
// Matching logic — you usually don't need to touch below here.
// ---------------------------------------------------------------------------

function norm(s) {
  return (s || "").toString().toLowerCase()
    .replace(/[‘’ʼ′]/g, "'").replace(/[“”ʺ″]/g, '"')
    .replace(/\s+/g, " ").trim();
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function matchBrand(text, config = CONFIG, brands = BRANDS) {
  for (const brand of config.brands) {
    const def = brands[brand];
    if (!def) continue;
    for (const a of def.aliases) {
      if (text.includes(a)) return { brand, alias: a, strict: false };
    }
    for (const a of def.strict) {
      if (new RegExp("\\b" + escapeRe(a) + "\\b").test(text)) return { brand, alias: a, strict: true };
    }
  }
  return null;
}

function parseLengthIn(text) {
  // Matches things like 6'2, 6'2", 6ft 2, 6 feet 2.
  const re = /\b([4-9])\s*(?:['"]|ft|feet)\s*(\d{1,2})?/g;
  let m;
  while ((m = re.exec(text))) {
    const ft = parseInt(m[1], 10);
    const inch = m[2] !== undefined ? parseInt(m[2], 10) : 0;
    if (inch > 11) continue;
    return ft * 12 + inch;
  }
  return null;
}

function parseVolumeL(text) {
  const re = /(\d{2}(?:\.\d)?)\s*(?:l\b|lt\b|litres?\b|liters?\b)/g;
  let m;
  while ((m = re.exec(text))) {
    const v = parseFloat(m[1]);
    if (v >= 15 && v <= 70) return v;
  }
  return null;
}

function haversineKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---- Field readers for the Apify facebook-marketplace-scraper schema. -------
// They fall back across a few key names so the matcher survives minor actor
// output changes.
function getTitle(l) { return l.marketplace_listing_title || l.listingTitle || l.custom_title || l.title || ""; }
function getDescription(l) {
  if (l.description && typeof l.description === "object") return l.description.text || "";
  return l.redacted_description?.text || l.description || "";
}
function getPrice(l) {
  const lp = l.listing_price || l.listingPrice || {};
  if (lp.amount != null && !isNaN(parseFloat(lp.amount))) return Math.round(parseFloat(lp.amount));
  const f = lp.formatted_amount_zeros_stripped || lp.formatted_amount || l.price || "";
  const dnum = ("" + f).replace(/[^\d]/g, "");
  return dnum ? parseInt(dnum, 10) : null;
}
function getLocation(l) {
  const rg = (l.location && l.location.reverse_geocode) || {};
  const text = (rg.city_page && rg.city_page.display_name)
    || [rg.city, rg.state].filter(Boolean).join(", ")
    || (l.locationText && l.locationText.text) || null;
  const lat = (l.location && (l.location.latitude ?? l.location.lat)) ?? null;
  const lon = (l.location && (l.location.longitude ?? l.location.lon)) ?? null;
  return { text, lat: typeof lat === "number" ? lat : null, lon: typeof lon === "number" ? lon : null };
}
function getPhoto(l) {
  return (l.primary_listing_photo && l.primary_listing_photo.photo_image_url)
    || (l.listingPhotos && l.listingPhotos[0] && l.listingPhotos[0].image && l.listingPhotos[0].image.uri)
    || null;
}
function getUrl(l) {
  return l.listingUrl || l.itemUrl
    || (l.id ? ("https://www.facebook.com/marketplace/item/" + l.id) : null);
}
function isSold(l) { return l.is_sold === true || l.isSold === true; }

function regionCheck(loc, config = CONFIG) {
  // Geo radius first if we have coordinates.
  if (loc.lat != null && loc.lon != null && config.centre && config.radiusKm) {
    const km = Math.round(haversineKm(config.centre, { lat: loc.lat, lon: loc.lon }));
    return { ok: km <= config.radiusKm, km };
  }
  // Otherwise fall back to matching the location text.
  if (config.regionPattern) {
    return { ok: config.regionPattern.test(norm(loc.text || "")), km: null };
  }
  return { ok: true, km: null };
}

/**
 * Decide whether a single raw listing matches the buy box.
 * Returns { isMatch, ...details }. When a field can't be parsed it is recorded
 * in `unknowns` and the listing is still alerted (confidence "review") rather
 * than silently dropped, so you can eyeball the photo.
 */
function matchListing(l, config = CONFIG, brands = BRANDS) {
  const title = norm(getTitle(l));
  const desc = norm(getDescription(l));
  const text = (title + " " + desc).trim();
  const unknowns = [];

  if (isSold(l)) return { isMatch: false, reason: "sold" };
  if (!title) return { isMatch: false, reason: "no title" };
  if (EXCLUDE_TITLE.some(k => title.includes(k))) return { isMatch: false, reason: "excluded accessory" };

  const brand = matchBrand(text, config, brands);
  if (!brand) return { isMatch: false, reason: "no brand match" };

  const price = getPrice(l);
  if (price == null) unknowns.push("price");
  else if (price > config.maxPrice) return { isMatch: false, reason: "over budget" };

  const length_in = parseLengthIn(text);
  if (length_in == null) unknowns.push("length");
  else if (length_in < config.minLengthIn || length_in > config.maxLengthIn) return { isMatch: false, reason: "wrong length" };

  const volume_l = parseVolumeL(text);
  if (volume_l == null) unknowns.push("volume");
  else if (volume_l < config.minVolumeL) return { isMatch: false, reason: "too low volume" };

  const loc = getLocation(l);
  const region = regionCheck(loc, config);
  if (!region.ok) return { isMatch: false, reason: "out of area" };

  const confidence = (brand.strict || unknowns.length) ? "review" : "high";
  return {
    isMatch: true, confidence,
    brand: brand.brand, brandAlias: brand.alias,
    price, length_in, volume_l,
    distance_km: region.km, region: loc.text,
    unknowns,
  };
}

/**
 * Run the matcher over an array of raw listings and return tidy rows ready to
 * store / alert on. This is the shape the n8n Code node returns too.
 */
function runMatcher(listings, config = CONFIG, brands = BRANDS) {
  const out = [];
  for (const l of listings) {
    const r = matchListing(l, config, brands);
    if (!r.isMatch) continue;
    out.push({
      listing_id: String(l.id ?? getUrl(l)),
      title: getTitle(l) || null,
      price: r.price,
      url: getUrl(l),
      image_url: getPhoto(l),
      brand: r.brand,
      brand_alias: r.brandAlias,
      length_in: r.length_in,
      volume_l: r.volume_l,
      distance_km: r.distance_km,
      region: r.region,
      confidence: r.confidence,
      unknowns: r.unknowns,
    });
  }
  return out;
}

module.exports = {
  BRANDS, CONFIG, EXCLUDE_TITLE,
  matchListing, runMatcher,
  // exported for testing / reuse
  norm, parseLengthIn, parseVolumeL, matchBrand,
  getTitle, getPrice, getPhoto, getUrl, getLocation,
};
