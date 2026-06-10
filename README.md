# Twitter/X Profile Scraper — Extract Tweets & Analytics

Extract public Twitter/X profile data and tweets with full engagement analytics. Scrape profile information, follower counts, tweet content, likes, retweets, views, media URLs, and more.

## Features

- **Profile Data Extraction**: Username, display name, bio, follower/following counts, join date, location, website, profile/banner images, verification status
- **Tweet Scraping**: Full tweet text, engagement metrics (likes, retweets, replies, views, quotes), media URLs, hashtags, mentions, links
- **Batch Processing**: Scrape multiple Twitter/X accounts in a single run
- **Deduplication**: Automatic tweet deduplication by tweet ID
- **Anti-Bot Protection**: Residential proxy rotation, session pooling, random delays, retry logic
- **Public Data Only**: No login required, scrapes only publicly available information

## Use Cases

1. **Brand Monitoring**: Track mentions, sentiment, and engagement across social media
2. **Influencer Research**: Analyze influencer profiles, follower growth, and content performance
3. **Sentiment Analysis**: Collect tweet data for natural language processing and sentiment analysis
4. **Competitor Tracking**: Monitor competitor social media activity and engagement metrics
5. **Social Media Reporting**: Generate comprehensive social media analytics reports

## Output

### Profiles Dataset

```json
{
  "username": "elonmusk",
  "displayName": "Elon Musk",
  "bio": "CEO of Tesla & SpaceX",
  "followersCount": 150000000,
  "followingCount": 800,
  "tweetsCount": 35000,
  "likesCount": 50000,
  "joinedDate": "June 2009",
  "location": "Austin, TX",
  "websiteUrl": "https://tesla.com",
  "profileImageUrl": "https://pbs.twimg.com/profile_images/...",
  "bannerImageUrl": "https://pbs.twimg.com/profile_banners/...",
  "verifiedBadge": true,
  "blueCheckmark": true,
  "isBusinessAccount": false,
  "profileUrl": "https://x.com/elonmusk",
  "pinnedTweetId": "1234567890",
  "scrapedAt": "2026-06-09T12:00:00.000Z"
}
```

### Tweets Dataset

```json
{
  "tweetId": "1234567890",
  "text": "Hello world!",
  "tweetUrl": "https://x.com/elonmusk/status/1234567890",
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
  "hashtags": ["tech", "innovation"],
  "mentions": ["@tesla", "@spacex"],
  "links": ["https://tesla.com"],
  "language": "en",
  "authorUsername": "elonmusk",
  "inReplyToTweetId": null,
  "quotedTweetId": null,
  "scrapedAt": "2026-06-09T12:00:00.000Z"
}
```

## Pricing

| Event | Price | Description |
|-------|-------|-------------|
| Profile Scraped | $0.004 | Charged once per profile after all tweets are pushed |

**Example**: Scraping 10 profiles with 100 tweets each = $0.04 (10 × $0.004)

## Input Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `usernames` | string[] | required | Twitter/X usernames or profile URLs |
| `maxTweetsPerProfile` | integer | 100 | Max tweets to scrape per profile (1-3200) |
| `includeReplies` | boolean | false | Include reply tweets |
| `includeRetweets` | boolean | false | Include retweet posts |
| `proxyConfiguration` | object | useApifyProxy | Proxy settings (residential recommended) |

## Running the Actor

### Via Apify Console

1. Go to the Actor page on Apify Store
2. Click "Start"
3. Enter usernames and configure settings
4. Click "Start" to run

### Via API

```javascript
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({ token: 'YOUR_API_TOKEN' });

const run = await client.actor('your-actor-id').call({
  usernames: ['elonmusk', 'naval'],
  maxTweetsPerProfile: 50,
  includeReplies: false,
  includeRetweets: false,
});

console.log('Run finished:', run.status);
```

## Ethical Considerations

This Actor scrapes **publicly available data only**. It does not:

- Access private accounts or protected tweets
- Bypass authentication or login requirements
- Collect personal data beyond what users publicly share
- Violate Twitter/X Terms of Service

Users are responsible for complying with all applicable laws and regulations when using scraped data. This includes GDPR, CCPA, and other privacy regulations where applicable.

## Technical Details

- **Runtime**: Node.js 20
- **Browser**: Playwright with Chrome
- **Anti-Bot**: Residential proxy rotation, session pooling (max 10 uses), random delays (2-6s), 3 retries
- **Memory**: 4096 MB
- **Timeout**: 43200 seconds (12 hours)

## License

Apache 2.0
