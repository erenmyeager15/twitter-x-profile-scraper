import * as cheerio from 'cheerio';
import type { ProfileRecord, ProfileResult, RecentPostSummary, TweetRecord } from './types.js';

const MAX_HTML_BYTES = 2_000_000;

function meta($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).attr('content')?.trim();
  return value || null;
}

export function parseCompactNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replaceAll(',', '').toUpperCase();
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s*([KMB])?$/);
  if (!match) return null;
  const multiplier = match[2] === 'K' ? 1_000 : match[2] === 'M' ? 1_000_000 : match[2] === 'B' ? 1_000_000_000 : 1;
  const number = Number(match[1]) * multiplier;
  return Number.isFinite(number) ? Math.round(number) : null;
}

function jsBoolean(value: string | undefined): boolean {
  return value === '!0' || value === 'true';
}

function parseJsString(value: string | undefined): string {
  if (!value) return '';
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replaceAll('\\"', '"').replaceAll('\\n', '\n').replaceAll('\\/', '/');
  }
}

function exactProfileFields(html: string): {
  followers: number | null;
  following: number | null;
  tweets: number | null;
  createdAt: string | null;
  location: string | null;
  website: string | null;
  protectedAccount: boolean;
  blueVerified: boolean;
  verified: boolean;
  verificationType: string | null;
  pinnedTweetId: string | null;
} {
  const relationship = html.match(/relationship_counts:\$R\[\d+\]=\{followers:(\d+),following:(\d+)\}/);
  const tweets = html.match(/tweet_counts:\$R\[\d+\]=\{tweets:(\d+)\}/);
  const createdAt = html.match(/createdAtMs:(\d{10,})/);
  const location = html.match(/createdAtMs:\d{10,}.*?location:"((?:\\.|[^"\\])*)"/s);
  const website = html.match(/profile_bio:\$R\[\d+\]=\{.*?\},url:\$R\[\d+\]=\{urls:\$R\[\d+\]=\[\$R\[\d+\]=\{.*?expanded_url:"((?:\\.|[^"\\])*)"/s);
  const privacy = html.match(/privacy:\$R\[\d+\]=\{protected:(![01]|true|false)\}/);
  const verification = html.match(/verification:\$R\[\d+\]=\{is_blue_verified:(![01]|true|false)(?:,verified:(![01]|true|false))?(?:,verified_type:"((?:\\.|[^"\\])*)")?/);
  const pinned = html.match(/pinned_tweet_ids_str:\$R\[\d+\]=\["(\d+)"\]/);
  return {
    followers: relationship ? Number(relationship[1]) : null,
    following: relationship ? Number(relationship[2]) : null,
    tweets: tweets ? Number(tweets[1]) : null,
    createdAt: createdAt ? new Date(Number(createdAt[1])).toISOString() : null,
    location: location ? parseJsString(location[1]) || null : null,
    website: website ? parseJsString(website[1]) || null : null,
    protectedAccount: jsBoolean(privacy?.[1]),
    blueVerified: jsBoolean(verification?.[1]),
    verified: jsBoolean(verification?.[2]),
    verificationType: verification?.[3] ? parseJsString(verification[3]) : null,
    pinnedTweetId: pinned?.[1] ?? null,
  };
}

function engagement(article: cheerio.Cheerio<any>, label: string): number | null {
  const displayed = article.find(`[aria-label="${label}"] .x-animated-count-visual`).first().text().trim();
  return parseCompactNumber(displayed);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseTweets($: cheerio.CheerioAPI, username: string, maxTweets: number, scrapedAt: string): TweetRecord[] {
  const tweets: TweetRecord[] = [];
  const seen = new Set<string>();

  $('[data-timeline-entry] article').each((_index, element) => {
    if (tweets.length >= maxTweets) return;
    const article = $(element);
    const statusLinks = article.find('a[href*="/status/"]').map((_i, anchor) => $(anchor).attr('href') ?? '').get();
    const canonicalPath = statusLinks.find((href) => /^\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(href));
    const match = canonicalPath?.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)$/);
    if (!match || match[1].toLowerCase() !== username.toLowerCase() || seen.has(match[2])) return;

    const textNode = article.find('div[dir="auto"]').filter((_i, node) => $(node).find('a[href*="/status/"]').length === 0).first();
    const text = textNode.text().replace(/\s*Show more\s*$/i, '').trim();
    if (!text) return;
    const timestampScript = article.find(`a[href="${canonicalPath}"]`).first().nextAll('script').first().text();
    const timestamp = timestampScript.match(/"timestamp":(\d{10,})/)?.[1];
    const mediaUrls = unique([
      ...article.find('img[src*="pbs.twimg.com/media/"]').map((_i, image) => $(image).attr('src') ?? '').get(),
      ...article.find('video[poster]').map((_i, video) => $(video).attr('poster') ?? '').get(),
    ]);
    const links = unique(textNode.find('a[href]').map((_i, anchor) => {
      const href = $(anchor).attr('href') ?? '';
      return href.startsWith('http://') || href.startsWith('https://') ? href : '';
    }).get());
    const mentions = unique(textNode.find('a[href^="/"]').map((_i, anchor) => {
      const label = $(anchor).text().trim();
      return /^@[A-Za-z0-9_]{1,15}$/.test(label) ? label.slice(1) : '';
    }).get());
    const hashtags = unique(text.match(/#[\p{L}\p{N}_]+/gu)?.map((tag) => tag.slice(1)) ?? []);
    const surroundingText = article.parent().text();
    const quotedTweetId = statusLinks
      .map((href) => href.match(/\/status\/(\d+)/)?.[1] ?? null)
      .find((id): id is string => Boolean(id && id !== match[2])) ?? null;

    seen.add(match[2]);
    tweets.push({
      tweetId: match[2],
      text,
      tweetUrl: `https://x.com/${match[1]}/status/${match[2]}`,
      postedDate: timestamp ? new Date(Number(timestamp)).toISOString() : null,
      likesCount: engagement(article, 'Like'),
      retweetsCount: engagement(article, 'Repost'),
      repliesCount: engagement(article, 'Reply'),
      viewsCount: engagement(article, 'View count'),
      quoteTweetsCount: null,
      hasMedia: mediaUrls.length > 0,
      mediaUrls,
      isReply: /Replying to/i.test(surroundingText),
      isRetweet: /reposted/i.test(surroundingText),
      isQuote: quotedTweetId !== null,
      isPinned: /Pinned/i.test(surroundingText.slice(0, 120)),
      hashtags,
      mentions,
      links,
      language: null,
      authorUsername: match[1],
      inReplyToTweetId: null,
      quotedTweetId,
      scrapedAt,
    });
  });

  return tweets;
}

function sumKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? known.reduce((total, value) => total + value, 0) : null;
}

function averageKnown(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? Math.round((known.reduce((total, value) => total + value, 0) / known.length) * 100) / 100 : null;
}

export function summarizeRecentPosts(tweets: TweetRecord[]): RecentPostSummary {
  const engagements = tweets.map((tweet) => {
    const parts = [tweet.likesCount, tweet.retweetsCount, tweet.repliesCount, tweet.quoteTweetsCount]
      .filter((value): value is number => value !== null);
    return parts.length > 0 ? parts.reduce((total, value) => total + value, 0) : null;
  });
  return {
    postsReturned: tweets.length,
    latestPostAt: tweets.map((tweet) => tweet.postedDate).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
    totalLikes: sumKnown(tweets.map((tweet) => tweet.likesCount)),
    totalReposts: sumKnown(tweets.map((tweet) => tweet.retweetsCount)),
    totalReplies: sumKnown(tweets.map((tweet) => tweet.repliesCount)),
    totalViews: sumKnown(tweets.map((tweet) => tweet.viewsCount)),
    averageLikes: averageKnown(tweets.map((tweet) => tweet.likesCount)),
    averageViews: averageKnown(tweets.map((tweet) => tweet.viewsCount)),
    averageEngagements: averageKnown(engagements),
    postsWithMedia: tweets.filter((tweet) => tweet.hasMedia).length,
  };
}

export function parsePublicProfilePage(html: string, requestedUsername: string, maxTweets: number): ProfileResult | null {
  if (!html || Buffer.byteLength(html) > MAX_HTML_BYTES) return null;
  if (!Number.isInteger(maxTweets) || maxTweets < 0 || maxTweets > 20) return null;
  const $ = cheerio.load(html);
  const title = meta($, 'meta[name="twitter:title"]');
  const creator = meta($, 'meta[name="twitter:creator"]')?.replace(/^@/, '') ?? null;
  const titleMatch = title?.match(/^(.*?) \(@([A-Za-z0-9_]{1,15})\) on X$/);
  const username = creator ?? titleMatch?.[2] ?? null;
  if (!username || username.toLowerCase() !== requestedUsername.toLowerCase()) return null;

  const exact = exactProfileFields(html);
  const displayName = titleMatch?.[1]?.trim() ?? meta($, 'meta[name="author"]') ?? username;
  const bio = meta($, 'meta[name="twitter:description"]') ?? meta($, 'meta[name="description"]') ?? '';
  const scrapedAt = new Date().toISOString();
  const tweets = parseTweets($, username, maxTweets, scrapedAt);
  const displayedFollowing = parseCompactNumber($(`a[href="/${username}/following"] span`).first().text());
  const displayedFollowers = parseCompactNumber($(`a[href="/${username}/verified_followers"] span`).first().text());
  const displayedPosts = meta($, 'meta[name="twitter:label1"]') === 'Posts'
    ? parseCompactNumber(meta($, 'meta[name="twitter:data1"]')) : null;
  const displayedJoined = meta($, 'meta[name="twitter:label2"]') === 'Joined'
    ? meta($, 'meta[name="twitter:data2"]') : null;
  const followersCount = exact.followers ?? displayedFollowers;
  const followingCount = exact.following ?? displayedFollowing;
  const tweetsCount = exact.tweets ?? displayedPosts;
  if (followersCount === null || followingCount === null || tweetsCount === null) return null;

  const profile: ProfileRecord = {
    username,
    displayName,
    bio,
    followersCount,
    followingCount,
    tweetsCount,
    likesCount: null,
    joinedDate: exact.createdAt ?? displayedJoined,
    location: exact.location,
    websiteUrl: exact.website,
    profileImageUrl: meta($, 'meta[property="og:image"]'),
    bannerImageUrl: meta($, 'meta[name="twitter:image"]'),
    verifiedBadge: exact.verified,
    blueCheckmark: exact.blueVerified,
    verificationType: exact.verificationType,
    isBusinessAccount: exact.verificationType?.toLowerCase() === 'business',
    isPrivate: exact.protectedAccount,
    profileUrl: `https://x.com/${username}`,
    pinnedTweetId: exact.pinnedTweetId ?? tweets.find((tweet) => tweet.isPinned)?.tweetId ?? null,
    dataSource: 'public-page',
    dataQuality: tweets.length > 0 || maxTweets === 0 ? 'detailed' : 'profile-only',
    recentPostSummary: summarizeRecentPosts(tweets),
    recentTweets: tweets,
    scrapedAt,
  };
  return { profile, tweets };
}
