import { summarizeRecentPosts } from './public-page.js';
import type { ProfileRecord, ProfileResult, TweetRecord } from './types.js';

const X_API_BASE_URLS = ['https://api.x.com/2', 'https://api.twitter.com/2'];
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
    like_count?: number;
  };
}

interface ApiTweet {
  id: string;
  text?: string;
  created_at?: string;
  lang?: string;
  attachments?: { media_keys?: string[] };
  entities?: JsonObject;
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
  url?: string;
  preview_image_url?: string;
  variants?: Array<{ url?: string; content_type?: string; bit_rate?: number }>;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstExpandedUrl(entities: JsonObject | undefined): string | null {
  const url = isObject(entities?.url) ? entities.url : undefined;
  const first = objects(url?.urls)[0];
  return stringValue(first?.expanded_url) ?? stringValue(first?.url);
}

function mediaUrl(media: ApiMedia): string | null {
  if (media.url) return media.url;
  if (media.preview_image_url) return media.preview_image_url;
  return [...(media.variants ?? [])]
    .filter((variant) => variant.url && variant.content_type === 'video/mp4')
    .sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0))[0]?.url ?? null;
}

async function xFetch(path: string, token: string, params: Record<string, string>): Promise<JsonObject> {
  let lastError: Error | null = null;
  for (const baseUrl of X_API_BASE_URLS) {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
    try {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      const text = (await response.text()).slice(0, 2_000_000);
      if (!response.ok) throw new Error(`X API returned HTTP ${response.status}.`);
      return text ? JSON.parse(text) as JsonObject : {};
    } catch (error) {
      lastError = error as Error;
    }
  }
  throw lastError ?? new Error('X API request failed.');
}

async function fetchUser(username: string, token: string): Promise<ApiUser | null> {
  const response = await xFetch(`/users/by/username/${encodeURIComponent(username)}`, token, {
    'user.fields': 'created_at,description,entities,location,pinned_tweet_id,profile_image_url,public_metrics,url,verified,verified_type',
  });
  return isObject(response.data) ? response.data as unknown as ApiUser : null;
}

async function fetchTweets(
  userId: string,
  token: string,
  maxTweets: number,
  includeReplies: boolean,
  includeRetweets: boolean,
): Promise<{ tweets: ApiTweet[]; media: Map<string, ApiMedia> }> {
  const tweets: ApiTweet[] = [];
  const media = new Map<string, ApiMedia>();
  let paginationToken: string | undefined;
  while (tweets.length < maxTweets) {
    const exclude = [includeReplies ? null : 'replies', includeRetweets ? null : 'retweets']
      .filter((value): value is string => Boolean(value));
    const response = await xFetch(`/users/${encodeURIComponent(userId)}/tweets`, token, {
      max_results: String(Math.min(100, Math.max(5, maxTweets - tweets.length))),
      pagination_token: paginationToken ?? '',
      exclude: exclude.join(','),
      expansions: 'attachments.media_keys,referenced_tweets.id',
      'tweet.fields': 'attachments,created_at,entities,id,lang,public_metrics,referenced_tweets,text',
      'media.fields': 'media_key,preview_image_url,type,url,variants',
    });
    const page = Array.isArray(response.data) ? response.data as unknown as ApiTweet[] : [];
    tweets.push(...page);
    const includes = isObject(response.includes) ? response.includes : {};
    for (const item of Array.isArray(includes.media) ? includes.media as unknown as ApiMedia[] : []) {
      if (item.media_key) media.set(item.media_key, item);
    }
    const meta = isObject(response.meta) ? response.meta : {};
    paginationToken = stringValue(meta.next_token) ?? undefined;
    if (!paginationToken || page.length === 0) break;
  }
  return { tweets: tweets.slice(0, maxTweets), media };
}

function mapTweet(tweet: ApiTweet, username: string, media: Map<string, ApiMedia>, scrapedAt: string): TweetRecord {
  const references = tweet.referenced_tweets ?? [];
  const mediaUrls = (tweet.attachments?.media_keys ?? [])
    .map((key) => media.get(key)).filter((item): item is ApiMedia => Boolean(item))
    .map(mediaUrl).filter((url): url is string => Boolean(url));
  return {
    tweetId: tweet.id,
    text: tweet.text ?? '',
    tweetUrl: `https://x.com/${username}/status/${tweet.id}`,
    postedDate: tweet.created_at ?? null,
    likesCount: numberValue(tweet.public_metrics?.like_count),
    retweetsCount: numberValue(tweet.public_metrics?.retweet_count),
    repliesCount: numberValue(tweet.public_metrics?.reply_count),
    viewsCount: numberValue(tweet.public_metrics?.impression_count),
    quoteTweetsCount: numberValue(tweet.public_metrics?.quote_count),
    hasMedia: mediaUrls.length > 0,
    mediaUrls,
    isReply: references.some((reference) => reference.type === 'replied_to'),
    isRetweet: references.some((reference) => reference.type === 'retweeted'),
    isQuote: references.some((reference) => reference.type === 'quoted'),
    isPinned: false,
    hashtags: objects(tweet.entities?.hashtags).map((item) => stringValue(item.tag) ?? stringValue(item.text)).filter((item): item is string => Boolean(item)),
    mentions: objects(tweet.entities?.mentions).map((item) => stringValue(item.username)).filter((item): item is string => Boolean(item)),
    links: objects(tweet.entities?.urls).map((item) => stringValue(item.expanded_url) ?? stringValue(item.url)).filter((item): item is string => Boolean(item)),
    language: tweet.lang ?? null,
    authorUsername: username,
    inReplyToTweetId: references.find((reference) => reference.type === 'replied_to')?.id ?? null,
    quotedTweetId: references.find((reference) => reference.type === 'quoted')?.id ?? null,
    scrapedAt,
  };
}

export async function fetchXApiProfile(
  username: string,
  bearerToken: string,
  maxTweets: number,
  includeReplies: boolean,
  includeRetweets: boolean,
): Promise<ProfileResult | null> {
  const user = await fetchUser(username, bearerToken);
  if (!user?.id) return null;
  const scrapedAt = new Date().toISOString();
  const fetched = await fetchTweets(user.id, bearerToken, maxTweets, includeReplies, includeRetweets);
  const tweets = fetched.tweets.map((tweet) => mapTweet(tweet, user.username ?? username, fetched.media, scrapedAt));
  const profile: ProfileRecord = {
    username: user.username ?? username,
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
    verificationType: user.verified_type ?? null,
    isBusinessAccount: user.verified_type?.toLowerCase() === 'business',
    isPrivate: false,
    profileUrl: `https://x.com/${user.username ?? username}`,
    pinnedTweetId: user.pinned_tweet_id ?? null,
    dataSource: 'x-api',
    dataQuality: 'detailed',
    recentPostSummary: summarizeRecentPosts(tweets),
    recentTweets: tweets,
    scrapedAt,
  };
  return { profile, tweets };
}
