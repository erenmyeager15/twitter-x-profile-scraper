# Resume Notes - Twitter / X Profile & Tweets Scraper

## Status

Fixed by adding a reliable official API path and keeping the old no-login endpoint as a guarded fallback:

- `dataSource: "auto"` uses X API mode when `xApiBearerToken` is supplied.
- `dataSource: "api"` requires `xApiBearerToken`.
- `dataSource: "syndication"` keeps the previous no-login `syndication.twitter.com` parser.
- The actor never saves or charges for blocked, empty, or rate-limited syndication responses.

## Why this was needed

The previous no-login syndication-only actor was structurally sound, but X returned 429 rate limits even with residential proxy rotation. That endpoint is not reliable enough to monetize on its own.

## What works now

- Official X API v2 bearer token input: `xApiBearerToken` (secret)
- API user lookup by username
- API recent user tweets with public metrics and media expansions
- Existing output shape retained
- Profiles go to the default dataset
- Tweets go to named dataset `tweets`
- PAY_PER_EVENT `profile-scraped` @ `$0.004`
- Charge only after profile/tweet data has been pushed

## Remaining risk

- X API rate limits and available fields depend on the user's X API plan.
- Syndication mode can still hit 429 and should be treated as best-effort.
- API mode may not expose profile banner or likes count; those fields are set to `null` when unavailable.

## Recommended Apify test

```json
{
  "dataSource": "api",
  "xApiBearerToken": "YOUR_TOKEN",
  "usernames": ["openai"],
  "maxTweetsPerProfile": 5
}
```

Expected: one profile record in the default dataset, up to five tweet records in `tweets`, and one `profile-scraped` charge event.
