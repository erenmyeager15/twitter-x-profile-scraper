# X (Twitter) Profile Scraper & Growth Monitor

Extract public X (Twitter) profiles for creator research, brand monitoring and competitor intelligence. Collect available profile totals, recent posts, engagement metrics, media, verification details and website links—then reuse a named watchlist to measure observed follower growth, posting pace and profile changes.

**No X login or API key is required for the default public-page mode.** An official X API bearer token remains available as an optional bring-your-own-token path.

## Why use this Actor?

Most profile exports are isolated snapshots. This Actor also makes repeat runs useful:

- Track follower growth, follower change, and followers gained per day.
- Track new posts and estimated posting pace per week.
- Detect bio, display name, website, and verification changes.
- Flag follower spikes, drops, new posts, and profile updates.
- Keep separate histories for different client or competitor watchlists.
- Export a spreadsheet-ready monitoring report in CSV and JSON.
- Receive profile data and recent posts together in one automation-friendly row.

Typical US-market workflows include creator vetting, executive and brand monitoring, influencer research, competitive intelligence, PR watchlists, and social audience tracking.

## What you get

### Profile intelligence

- Username, display name, bio, location, and website
- Exact follower, following, and total post counts when exposed by X
- Avatar, banner, profile URL, account privacy, and verification type
- Pinned post ID when available
- Collection source and data-quality indicator

### Recent post analytics

- Post text, URL, timestamp, author, and post ID
- Likes, reposts, replies, views, and quote count when available
- Images or video preview URLs
- Hashtags, mentions, and outbound links
- Reply, repost, quote, media, and pinned-post flags
- Per-profile totals and averages for recent engagement and views

### Repeat-run monitoring

- `followersDelta` and `followersGrowthPercent`
- `followersPerDay`
- `tweetsDelta` and `postsPerWeek`
- Previous counts, observation count, and first/previous seen timestamps
- Changed fields and growth signals
- `baseline`, `updated`, `unchanged`, or `partial` tracking status

The first run creates a baseline. Later runs using the same `monitorName` compare against that watchlist's previous complete observation. Rate fields require observations at least one hour apart so short test runs do not create misleading growth rates.

## Quick start

```json
{
  "usernames": ["openai", "nasa", "github"],
  "maxTweetsPerProfile": 5,
  "trackGrowth": true,
  "monitorName": "US technology watchlist",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

For recurring intelligence, save this input as an Apify task and schedule it daily or weekly. Keep the same usernames and `monitorName` so comparisons remain continuous.

## Input

| Field | Purpose | Default |
|---|---|---|
| `usernames` | Up to 25 X usernames or x.com/twitter.com profile URLs | `openai` |
| `maxTweetsPerProfile` | Recent posts nested in each profile; set 0 for metrics only | `5` |
| `includeReplies` | Include recent replies | `false` |
| `includeRetweets` | Include recent reposts | `false` |
| `trackGrowth` | Persist bounded observations and calculate changes | `true` |
| `monitorName` | Stable name separating one watchlist from another | `default` |
| `observationHistoryLimit` | Observations retained per profile | `30` |
| `dataSource` | `auto`, `public-page`, or `api` | `auto` |
| `xApiBearerToken` | Optional secret official X API bearer token | empty |
| `proxyConfiguration` | Optional one-retry fallback after direct public access fails | disabled |

Public-page mode returns up to 20 recent posts. Official API mode supports up to 100, subject to the permissions and limits of your X developer plan.

## Output example

```json
{
  "username": "OpenAI",
  "displayName": "OpenAI",
  "followersCount": 5424044,
  "followingCount": 4,
  "tweetsCount": 2179,
  "websiteUrl": "https://openai.com",
  "verificationType": "Business",
  "profileUrl": "https://x.com/OpenAI",
  "dataSource": "public-page",
  "dataQuality": "detailed",
  "trackingStatus": "updated",
  "previousFollowersCount": 5419000,
  "followersDelta": 5044,
  "followersGrowthPercent": 0.0931,
  "followersPerDay": 720.57,
  "tweetsDelta": 4,
  "postsPerWeek": 4,
  "growthSignals": ["followers_growing", "new_posts"],
  "recentPostSummary": {
    "postsReturned": 5,
    "averageLikes": 15600,
    "averageViews": 7320000,
    "postsWithMedia": 3
  },
  "recentTweets": [
    {
      "tweetId": "2107894997538525580",
      "tweetUrl": "https://x.com/OpenAI/status/2107894997538525580",
      "text": "Example post text",
      "postedDate": "2026-10-07T18:05:04.000Z",
      "likesCount": 23000,
      "retweetsCount": 1800,
      "repliesCount": 1100,
      "viewsCount": 5900000,
      "hasMedia": true,
      "isPinned": true
    }
  ],
  "scrapedAt": "2026-10-11T12:00:00.000Z"
}
```

Example values illustrate the schema and can change at the source.

## Reports and integrations

Every successful run provides:

- **Default dataset:** profile records with nested recent posts and monitoring fields
- **`MONITORING-REPORT`:** JSON coverage, status, signal totals, and comparison rows
- **`MONITORING-REPORT.csv`:** spreadsheet-ready growth report with formula-injection protection
- **`OUTPUT`:** saved and failed target counts with concise failure reasons

Use the dataset API with Google Sheets, Airtable, Make, Zapier, n8n, BI tools, or your own data pipeline.

## Pricing: Saved Profiles + Actor Start

The undiscounted `profile-scraped` event costs **$0.004 per successfully saved profile** (`$4.00` per 1,000), including its available recent posts and monitoring comparison. The separate `apify-actor-start` event costs **$0.00005 per GB, minimum one event**, when the Actor starts.

| Successful profiles | Profile-event subtotal, before start fee or tier discounts |
|---:|---:|
| 1 | $0.004 |
| 10 | $0.04 |
| 25 | $0.10 |

Failed targets and empty responses that are not saved do not trigger `profile-scraped`. Profiles already saved before a partial failure retain their normal result charges. The Actor Start fee can still apply to empty or failed runs: Apify counts one start event per GB of memory, with at least one event. At the unchanged 256 MB default, that is `$0.00005` for the start event.

For example, one successfully saved profile at the undiscounted rate has `$0.00405` in result-plus-start event charges at 256 MB. That is an event subtotal, not a guarantee about separate platform or optional third-party API costs. Check the [live Pricing tab](https://apify.com/fascinating_lentil/twitter-x-profile-scraper/pricing) for current subscription-tier discounts and platform-usage terms. Your own official X API access, if selected, is not supplied by this Actor.

## Reliability and cost controls

- Uses direct HTTP rather than a browser for low memory and fast startup.
- Rejects mismatched, incomplete, or oversized source pages instead of saving misleading rows.
- Direct access is attempted first; Residential traffic is never enabled silently.
- A user-configured proxy receives only one retry after direct access fails.
- Monitoring history is bounded from 2 to 90 observations per profile.
- The `profile-scraped` result event is charged only when its dataset record is successfully saved; the separate Actor Start fee is not waived by an empty result.
- If every target fails, the run fails visibly rather than reporting false success.

Public websites can change. The Actor reports `dataQuality` so downstream workflows can distinguish complete post analytics from profile-only results.

## Official X API mode

Choose `dataSource: "api"` and provide `xApiBearerToken` if your workflow requires the official API. The token is treated as a secret and is never written to results or logs. API availability, fields, and request limits depend on your X developer plan.

## Responsible use

Use this Actor only for lawful collection of publicly available information. Respect X's terms, applicable privacy and data-protection laws, and the rights of account owners. Do not use the output for harassment, discrimination, surveillance, or unlawful profiling.

## Support

When reporting an issue, include the Apify run ID, input with secrets removed, affected public usernames, and the approximate run time. Never send API tokens in support messages.

## License

Apache-2.0
