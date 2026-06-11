# Twitter/X Profile & Tweets Scraper

Extract Twitter/X profile data and recent tweets. Use an official X API v2 bearer token for reliable runs, or use the guarded no-login syndication fallback for small best-effort public profile checks.

## What This Actor Extracts

- Profile data: username, display name, bio, follower/following counts, tweet count, join date, location, website, profile image, verification status
- Tweet data: text, URL, date, likes, retweets, replies, quotes, views when available, media URLs, hashtags, mentions, links, language, reply/quote IDs
- Separate datasets: profiles in the default dataset, tweets in the named `tweets` dataset

## Data Sources

### X API mode

Recommended. Add `xApiBearerToken` and set `dataSource` to `auto` or `api`.

API mode uses official X API v2 endpoints:

- User lookup by username
- Recent user tweets with public metrics, media expansions, hashtags, mentions, and links

This is the reliable path because the old no-login syndication endpoint is heavily rate-limited by X.

### No-login syndication mode

Fallback only. Set `dataSource` to `syndication`.

The actor keeps the old `syndication.twitter.com` parser, but X often returns 429 for that endpoint. The run is guarded: if the endpoint is rate-limited, empty, or blocked, the actor retries/rotates session and does not save or charge invalid data.

## Input

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `usernames` | `string[]` | Twitter/X usernames or profile URLs | `["elonmusk"]` |
| `dataSource` | `string` | `auto`, `api`, or `syndication` | `auto` |
| `xApiBearerToken` | `string` | Optional official X API v2 bearer token. Secret input. | empty |
| `maxTweetsPerProfile` | `integer` | Max tweets per profile | `10` |
| `includeReplies` | `boolean` | Include replies | `false` |
| `includeRetweets` | `boolean` | Include retweets | `false` |
| `proxyConfiguration` | `object` | Proxy settings for syndication mode | Apify Residential |

## Example Inputs

### API mode

```json
{
  "dataSource": "api",
  "xApiBearerToken": "YOUR_X_API_BEARER_TOKEN",
  "usernames": ["openai", "elonmusk"],
  "maxTweetsPerProfile": 10,
  "includeReplies": false,
  "includeRetweets": false
}
```

### Syndication fallback

```json
{
  "dataSource": "syndication",
  "usernames": ["elonmusk"],
  "maxTweetsPerProfile": 10,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Output

### Profile

```json
{
  "username": "openai",
  "displayName": "OpenAI",
  "bio": "Creating safe AGI that benefits all of humanity.",
  "followersCount": 10000000,
  "followingCount": 5,
  "tweetsCount": 12000,
  "likesCount": null,
  "joinedDate": "2015-12-11T00:00:00.000Z",
  "location": "San Francisco, CA",
  "websiteUrl": "https://openai.com",
  "profileImageUrl": "https://pbs.twimg.com/profile_images/...",
  "bannerImageUrl": null,
  "verifiedBadge": true,
  "blueCheckmark": true,
  "isBusinessAccount": true,
  "profileUrl": "https://x.com/openai",
  "pinnedTweetId": "1234567890",
  "scrapedAt": "2026-06-11T10:00:00.000Z"
}
```

### Tweet

```json
{
  "tweetId": "1234567890",
  "text": "Hello world!",
  "tweetUrl": "https://x.com/openai/status/1234567890",
  "postedDate": "2026-06-09T12:00:00.000Z",
  "likesCount": 50000,
  "retweetsCount": 5000,
  "repliesCount": 1000,
  "viewsCount": 5000000,
  "quoteTweetsCount": 500,
  "hasMedia": true,
  "mediaUrls": ["https://pbs.twimg.com/media/..."],
  "isReply": false,
  "isRetweet": false,
  "isQuote": false,
  "hashtags": ["AI"],
  "mentions": ["openai"],
  "links": ["https://openai.com"],
  "language": "en",
  "authorUsername": "openai",
  "inReplyToTweetId": null,
  "quotedTweetId": null,
  "scrapedAt": "2026-06-11T10:00:00.000Z"
}
```

## Pricing

| Event | Price |
|-------|-------|
| Profile scraped | `$0.004` |

The actor charges once per successfully saved profile, after profile data and available tweets are pushed. Blocked, rate-limited, empty, or failed profiles are not charged.

## Notes

- Use X API mode for production runs.
- API field availability and limits depend on the user's X API plan.
- Syndication mode is no-login but rate-limited aggressively by X.
- The actor only collects publicly available profile/tweet data returned by the selected data source.

## License

Apache-2.0
