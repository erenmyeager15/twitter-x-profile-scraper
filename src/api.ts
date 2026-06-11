import { Actor, log } from 'apify';
import { extractUsername } from './routes.js';
import type { ActorInput, ProfileRecord, TweetRecord } from './types.js';

const X_API_BASE_URLS = ['https://api.twitter.com/2', 'https://api.x.com/2'];

type JsonObject = Record<string, unknown>;

interface ApiUser {
  id: string;
  name?: string;
  username?: string;
  description?: string;
  created_at?: string;
  location?: string;
  url?: string;
  verified?: boolean;
  verified_type?: string;
  profile_image_url?: string;
  pinned_tweet_id?: string;
  entities?: JsonObject;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
    listed_count?: number;
    like_count?: number;
  };
}

interface ApiTweet {
  id: string;
  text?: string;
  created_at?: string;
  lang?: string;
  author_id?: string;
  entities?: JsonObject;
  attachments?: { media_keys?: string[] };
  referenced_tweets?: Array<{ type?: string; id?: string }>;
  public_metrics?: {
    retweet_count?: number;
    reply_count?: number;
    like_count?: number;
    quote_count?: number;
    impression_count?: number;
  };
}

interface ApiMedia {
  media_key?: string;
  type?: string;
  url?: string;
  preview_image_url?: string;
  variants?: Array<{ url?: string; content_type?: string; bit_rate?: number }>;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstExpandedUrl(entities: JsonObject | undefined): string | null {
  const urlObj = isObject(entities?.url) ? entities.url : undefined;
  const urls = arrayOfObjects(urlObj?.urls);
  return stringValue(urls[0]?.expanded_url) ?? stringValue(urls[0]?.url);
}

function mediaUrl(media: ApiMedia): string | null {
  if (media.url) return media.url;
  if (media.preview_image_url) return media.preview_image_url;

  const variants = media.variants ?? [];
  const mp4 = variants
    .filter((variant) => variant.url && variant.content_type === 'video/mp4')
    .sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0];
  return mp4?.url ?? variants.find((variant) => variant.url)?.url ?? null;
}

async function xFetch(path: string, bearerToken: string, params: Record<string, string>): Promise<JsonObject> {
  let lastError: Error | null = null;

  for (const baseUrl of X_API_BASE_URLS) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      });

      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`X API ${response.status}: ${text.slice(0, 500)}`);
        if (response.status !== 404 && response.status !== 410) throw lastError;
        continue;
      }

      return text ? JSON.parse(text) as JsonObject : {};
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error('X API request failed.');
}

async function fetchUser(username: string, bearerToken: string): Promise<ApiUser | null> {
  const response = await xFetch(`/users/by/username/${encodeURIComponent(username)}`, bearerToken, {
    'user.fields': [
      'created_at',
      'description',
      'entities',
      'location',
      'pinned_tweet_id',
      'profile_image_url',
      'public_metrics',
      'url',
      'verified',
      'verified_type',
    ].join(','),
  });

  return isObject(response.data) ? response.data as unknown as ApiUser : null;
}

async function fetchTweets(
  userId: string,
  bearerToken: string,
  maxTweets: number,
  includeReplies: boolean,
  includeRetweets: boolean,
): Promise<{ tweets: ApiTweet[]; mediaByKey: Map<string, ApiMedia> }> {
  const tweets: ApiTweet[] = [];
  const mediaByKey = new Map<string, ApiMedia>();
  let paginationToken: string | undefined;

  while (tweets.length < maxTweets) {
    const remaining = maxTweets - tweets.length;
    const pageSize = Math.min(100, Math.max(5, remaining));
    const exclude = [
      includeRetweets ? null : 'retweets',
      includeReplies ? null : 'replies',
    ].filter((value): value is string => Boolean(value));

    const response = await xFetch(`/users/${encodeURIComponent(userId)}/tweets`, bearerToken, {
      max_results: String(pageSize),
      pagination_token: paginationToken ?? '',
      exclude: exclude.join(','),
      expansions: 'attachments.media_keys,referenced_tweets.id',
      'tweet.fields': [
        'attachments',
        'created_at',
        'entities',
        'id',
        'lang',
        'public_metrics',
        'referenced_tweets',
        'text',
      ].join(','),
      'media.fields': 'media_key,preview_image_url,type,url,variants',
    });

    const pageTweets = Array.isArray(response.data) ? response.data as unknown as ApiTweet[] : [];
    tweets.push(...pageTweets);

    const includes = isObject(response.includes) ? response.includes : {};
    for (const media of Array.isArray(includes.media) ? includes.media as unknown as ApiMedia[] : []) {
      if (media.media_key) mediaByKey.set(media.media_key, media);
    }

    const meta = isObject(response.meta) ? response.meta : {};
    paginationToken = stringValue(meta.next_token) ?? undefined;
    if (!paginationToken || pageTweets.length === 0) break;
  }

  return { tweets: tweets.slice(0, maxTweets), mediaByKey };
}

function mapProfile(user: ApiUser, fallbackUsername: string): ProfileRecord {
  return {
    username: user.username ?? fallbackUsername,
    displayName: user.name ?? '',
    bio: user.description ?? '',
    followersCount: numberValue(user.public_metrics?.followers_count),
    followingCount: numberValue(user.public_metrics?.following_count),
    tweetsCount: numberValue(user.public_metrics?.tweet_count),
    likesCount: numberValue(user.public_metrics?.like_count),
    joinedDate: user.created_at ?? null,
    location: user.location ?? null,
    websiteUrl: firstExpandedUrl(user.entities) ?? user.url ?? null,
    profileImageUrl: user.profile_image_url?.replace('_normal', '') ?? null,
    bannerImageUrl: null,
    verifiedBadge: Boolean(user.verified),
    blueCheckmark: Boolean(user.verified || user.verified_type),
    isBusinessAccount: user.verified_type === 'business',
    profileUrl: `https://x.com/${user.username ?? fallbackUsername}`,
    pinnedTweetId: user.pinned_tweet_id ?? null,
    scrapedAt: new Date().toISOString(),
  };
}

function mapTweet(tweet: ApiTweet, authorUsername: string, mediaByKey: Map<string, ApiMedia>): TweetRecord {
  const referenced = tweet.referenced_tweets ?? [];
  const mediaKeys = tweet.attachments?.media_keys ?? [];
  const mediaUrls = mediaKeys
    .map((key) => mediaByKey.get(key))
    .filter((media): media is ApiMedia => Boolean(media))
    .map(mediaUrl)
    .filter((url): url is string => Boolean(url));
  const hashtags = arrayOfObjects(tweet.entities?.hashtags)
    .map((item) => stringValue(item.tag) ?? stringValue(item.text))
    .filter((item): item is string => Boolean(item));
  const mentions = arrayOfObjects(tweet.entities?.mentions)
    .map((item) => stringValue(item.username))
    .filter((item): item is string => Boolean(item));
  const links = arrayOfObjects(tweet.entities?.urls)
    .map((item) => stringValue(item.expanded_url) ?? stringValue(item.url))
    .filter((item): item is string => Boolean(item));

  return {
    tweetId: tweet.id,
    text: tweet.text ?? '',
    tweetUrl: `https://x.com/${authorUsername}/status/${tweet.id}`,
    postedDate: tweet.created_at ?? '',
    likesCount: numberValue(tweet.public_metrics?.like_count),
    retweetsCount: numberValue(tweet.public_metrics?.retweet_count),
    repliesCount: numberValue(tweet.public_metrics?.reply_count),
    viewsCount: numberValue(tweet.public_metrics?.impression_count),
    quoteTweetsCount: numberValue(tweet.public_metrics?.quote_count),
    hasMedia: mediaUrls.length > 0,
    mediaUrls,
    isReply: referenced.some((ref) => ref.type === 'replied_to'),
    isRetweet: referenced.some((ref) => ref.type === 'retweeted'),
    isQuote: referenced.some((ref) => ref.type === 'quoted'),
    hashtags,
    mentions,
    links,
    language: tweet.lang ?? null,
    authorUsername,
    inReplyToTweetId: referenced.find((ref) => ref.type === 'replied_to')?.id ?? null,
    quotedTweetId: referenced.find((ref) => ref.type === 'quoted')?.id ?? null,
    scrapedAt: new Date().toISOString(),
  };
}

export async function runXApiMode(input: ActorInput): Promise<void> {
  const bearerToken = input.xApiBearerToken?.trim();
  if (!bearerToken) throw new Error('X_API_BEARER_TOKEN_REQUIRED: Provide xApiBearerToken or use syndication mode.');

  const profilesDataset = await Actor.openDataset();
  const tweetsDataset = await Actor.openDataset('tweets');
  const maxTweets = input.maxTweetsPerProfile ?? 10;
  const usernames = input.usernames.map(extractUsername);
  let savedProfiles = 0;

  for (const username of usernames) {
    try {
      const user = await fetchUser(username, bearerToken);
      if (!user?.id) {
        log.warning(`X API returned no user for @${username}; not saving or charging.`);
        continue;
      }

      const profile = mapProfile(user, username);
      const { tweets, mediaByKey } = await fetchTweets(
        user.id,
        bearerToken,
        maxTweets,
        Boolean(input.includeReplies),
        Boolean(input.includeRetweets),
      );
      const tweetRecords = tweets.map((tweet) => mapTweet(tweet, profile.username, mediaByKey));

      await profilesDataset.pushData(profile);
      for (const tweet of tweetRecords) {
        await tweetsDataset.pushData(tweet);
      }
      await Actor.charge({ eventName: 'profile-scraped' }).catch((error) => {
        log.warning(`PPE charge failed: ${(error as Error).message}`);
      });

      savedProfiles++;
      log.info(`X API scraped @${profile.username}: profile + ${tweetRecords.length} tweets`);
    } catch (error) {
      log.warning(`X API scrape failed for @${username}: ${(error as Error).message}`);
    }
  }

  log.info(`X API mode finished. Saved ${savedProfiles} profile(s).`);
}
