// Offline demo: run the matcher against the sample listings and print what
// would get alerted. No API keys, no network. Run with:
//
//   node src/demo.js
//
const fs = require("fs");
const path = require("path");
const { runMatcher } = require("./matcher");
const { buildCaption } = require("./caption");

const sample = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "samples", "listings.sample.json"), "utf8")
);

console.log(`\nScanned ${sample.length} listings.\n`);
const matches = runMatcher(sample);

if (!matches.length) {
  console.log("No matches for the current buy box. Try loosening CONFIG in src/matcher.js.");
  process.exit(0);
}

console.log(`Found ${matches.length} match(es):\n`);
for (const row of matches) {
  console.log("─".repeat(48));
  console.log(buildCaption(row).replace(/<a href="([^"]+)">.*<\/a>/, "$1"));
  console.log("");
}
