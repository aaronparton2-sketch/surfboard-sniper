# How it works

The whole thing is a 7-step n8n pipeline that runs on a timer. Here is what each
step does and why.

```
 ┌──────────────┐   ┌────────────────┐   ┌──────────────┐   ┌────────────────────┐
 │  Schedule    │──▶│ Apify scrape   │──▶│ Match buy box│──▶│ Supabase insert    │
 │ every 30 min │   │ FB Marketplace │   │ (src/matcher)│   │ (ignore-duplicates)│
 └──────────────┘   └────────────────┘   └──────────────┘   └─────────┬──────────┘
                                                                       │
        ┌──────────────┐   ┌────────────────┐   ┌──────────────┐      │
        │ Mark alerted │◀──│ Telegram alert │◀──│ Build caption│◀─────┘
        └──────────────┘   └────────────────┘   └──────────────┘
```

1. **Schedule** fires every 30 minutes between 6am and 11pm. No point scanning
   at 3am when nobody is posting boards.

2. **Apify scrape** calls the `apify/facebook-marketplace-scraper` actor with a
   Marketplace search URL (newest first). `includeListingDetails: false` keeps
   it cheap: you get the title, price, photo, location and URL, but not the full
   description. That is fine because the matcher reads dimensions off the title.

3. **Match buy box** (`src/matcher.js`) is the brain. For each listing it checks,
   in order: not sold, not an accessory, brand is one you want, price under your
   cap, length and volume inside your window, and location inside your area. If a
   field cannot be parsed from the title (say the seller never wrote the volume)
   it does not bin the listing, it flags it `review` so you still get pinged and
   can eyeball the photo. Anything fully confirmed is `high`.

4. **Supabase insert** writes matches to the `surfboard_listings` table with
   `resolution=ignore-duplicates`. Because `listing_id` is the primary key, a
   listing you have already seen is silently ignored. This is what stops the bot
   spamming you the same board every 30 minutes.

5. **Only new rows** passes through the genuinely new inserts.

6. **Build caption** (`src/caption.js`) formats the alert: brand, price, size,
   distance, the listing link, and a ready-to-paste opening message.

7. **Telegram alert** sends the photo + caption to your chat. **Mark alerted**
   flips the row's status so you have a record of what was sent.

## Why these tools

- **Apify** handles the hard part (logging into Marketplace and not getting
  blocked) so you do not have to run a scraper yourself.
- **n8n** is the glue and the scheduler. Self-host it free, or use n8n cloud.
- **Supabase** is just a free Postgres for the dedupe memory.
- **Telegram** is the cheapest, fastest way to get a photo + link onto your
  phone with a tap-through. Swap it for Discord, email or SMS easily.

## Tuning tips

- Too many junk alerts? Tighten `EXCLUDE_TITLE`, raise `minVolumeL`, or drop a
  brand whose name collides with common words.
- Missing boards? The seller probably wrote dims in the description, not the
  title. Set `includeListingDetails: true` in the Apify node (costs more) and
  the matcher will read the description too.
- Different city? Change the Marketplace URL in the Apify node and the
  `regionPattern` / `centre` in CONFIG.
