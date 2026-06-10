# Resume Notes — Twitter / X Profile & Tweets Scraper (PARKED)

## Status
Build is fixed, compiles, runs, and is **safe** (guard retires session + never charges on rate-limit/empty). Pricing configured: `profile-scraped` @ $4.00/1000. SEO-optimized listing. On GitHub and pushed to Apify. **Not earning** — rate-limited.

## What works
- Compiles clean; `actor.json` pricing valid (PAY_PER_EVENT `profile-scraped`) + SEO title/description.
- Implemented the **no-login syndication approach**: `syndication.twitter.com/srv/timeline-profile/screen-name/{user}` → parse `__NEXT_DATA__` JSON → full profile (followers, following, tweets, bio, verified, joined, location) + tweets (likes/RT/replies/views/media/hashtags/mentions). Parser is complete in `src/routes.ts`.

## What's blocking (where it stopped)
- The syndication endpoint returns **429 (rate limited)** — on a bare home IP AND on Apify residential with rotation + session retire. X rate-limits this endpoint aggressively per request, not just per IP.

## What it needs next (turnkey resume)
1. **Guest-token GraphQL flow** (most capable, what robust X scrapers use):
   - POST `https://api.twitter.com/1.1/guest/activate.json` with the public `Authorization: Bearer <public web bearer>` → `guest_token`.
   - GET GraphQL `UserByScreenName` (bearer + `x-guest-token`) → full user (rest_id, legacy.followers_count, etc.).
   - GET GraphQL `UserTweets` with userId → tweets.
   - NOTE: query IDs + `features`/`variables` params rotate — needs occasional maintenance.
2. OR provide **auth cookies** (`auth_token`, `ct0`) via input and call the GraphQL endpoints as a logged-in session (most reliable, but needs an account).
3. OR try the `cdn.syndication.twimg.com/timeline/profile?screen_name=&token=` variant with the computed `token`, paired with heavier residential rotation + delays.

## Test command
```bash
apify push
# then run: { "usernames": ["elonmusk"], "maxTweetsPerProfile": 20, "proxyConfiguration": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] } }
```
Watch for: no 429, and `Done: @elonmusk — profile + N tweets`.
