// Builds the alert caption sent to Telegram (or wherever you push alerts).
// Pure function, no dependencies, easy to swap for your own format.

const { CONFIG } = require("./matcher");

function ftin(inch) {
  if (inch == null) return null;
  const f = Math.floor(inch / 12), i = inch % 12;
  return `${f}'${i}"`;
}

/**
 * @param {object} row  A matched row from runMatcher().
 * @returns {string}    HTML-formatted caption (Telegram parse_mode: HTML).
 */
function buildCaption(row, config = CONFIG) {
  const len = row.length_in != null ? ftin(row.length_in) : "length n/a";
  const vol = row.volume_l != null ? `${row.volume_l}L` : "vol n/a";
  const price = row.price != null ? `${config.currency}${row.price}` : "price n/a";
  const dist = row.distance_km != null ? `${row.distance_km}km away` : (row.region || "");
  const flag = row.confidence === "review" ? "\n⚠️ dims unconfirmed, check the photo" : "";

  return (
    `🏄 NEW ${row.brand} — ${price}\n` +
    `${row.title || ""}\n` +
    `📏 ${len} · ${vol} · 📍 ${dist}${flag}\n\n` +
    `💬 "Hey mate, is this still available? Keen to come have a look 👀"\n\n` +
    `<a href="${row.url}">Open listing ↗</a>`
  );
}

module.exports = { buildCaption, ftin };
