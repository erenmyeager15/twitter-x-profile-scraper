import type { Page } from 'playwright';
import type { ProfileRecord, TweetRecord } from './types.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function extractUsername(urlOrUsername: string): string {
  const cleaned = urlOrUsername.trim();
  if (cleaned.match(/^@?[\w]{1,15}$/)) return cleaned.replace(/^@/, '');
  const match = cleaned.match(/(?:twitter\.com|x\.com)\/(@?[\w]{1,15})(?:\/|$|\?)/i);
  if (match) return match[1].replace(/^@/, '');
  return cleaned.replace(/^@/, '');
}

/** Public, no-login syndication timeline endpoint that returns profile + tweets as JSON. */
export function syndicationUrl(username: string): string {
  return `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(username)}?showReplies=true`;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function mapProfile(u: any, fallbackUsername: string): ProfileRecord {
  const urlEntity = u?.entities?.url?.urls?.[0]?.expanded_url ?? u?.url ?? null;
  return {
    username: u?.screen_name ?? fallbackUsername,
    displayName: u?.name ?? '',
    bio: u?.description ?? '',
    followersCount: toNum(u?.followers_count),
    followingCount: toNum(u?.friends_count),
    tweetsCount: toNum(u?.statuses_count),
    likesCount: toNum(u?.favourites_count),
    joinedDate: u?.created_at ?? null,
    location: u?.location || null,
    websiteUrl: urlEntity,
    profileImageUrl: (u?.profile_image_url_https ?? null)?.replace('_normal', '') ?? null,
    bannerImageUrl: u?.profile_banner_url ?? null,
    verifiedBadge: Boolean(u?.verified),
    blueCheckmark: Boolean(u?.is_blue_verified ?? u?.verified_type),
    isBusinessAccount: (u?.verified_type === 'Business'),
    profileUrl: `https://x.com/${u?.screen_name ?? fallbackUsername}`,
    pinnedTweetId: Array.isArray(u?.pinned_tweet_ids_str) ? (u.pinned_tweet_ids_str[0] ?? null) : null,
    scrapedAt: new Date().toISOString(),
  };
}

function mapTweet(t: any, authorUsername: string): TweetRecord {
  const text: string = t?.full_text ?? t?.text ?? '';
  const entities = t?.entities ?? {};
  const media = t?.extended_entities?.media ?? entities?.media ?? [];
  const mediaUrls: string[] = Array.isArray(media)
    ? media.map((m: any) => m?.media_url_https ?? m?.video_info?.variants?.[0]?.url ?? m?.media_url).filter(Boolean)
    : [];
  return {
    tweetId: t?.id_str ?? String(t?.id ?? ''),
    text,
    tweetUrl: `https://x.com/${authorUsername}/status/${t?.id_str ?? t?.id ?? ''}`,
    postedDate: t?.created_at ?? '',
    likesCount: toNum(t?.favorite_count),
    retweetsCount: toNum(t?.retweet_count),
    repliesCount: toNum(t?.reply_count),
    viewsCount: toNum(t?.views?.count ?? t?.ext_views?.count),
    quoteTweetsCount: toNum(t?.quote_count),
    hasMedia: mediaUrls.length > 0,
    mediaUrls,
    isReply: Boolean(t?.in_reply_to_status_id_str || t?.in_reply_to_screen_name),
    isRetweet: Boolean(t?.retweeted_status || t?.retweeted_status_result),
    isQuote: Boolean(t?.is_quote_status),
    hashtags: (entities?.hashtags ?? []).map((h: any) => h?.text).filter(Boolean),
    mentions: (entities?.user_mentions ?? []).map((m: any) => m?.screen_name).filter(Boolean),
    links: (entities?.urls ?? []).map((l: any) => l?.expanded_url).filter(Boolean),
    language: t?.lang ?? null,
    authorUsername,
    inReplyToTweetId: t?.in_reply_to_status_id_str ?? null,
    quotedTweetId: t?.quoted_status_id_str ?? null,
    scrapedAt: new Date().toISOString(),
  };
}

export interface SyndicationResult {
  profile: ProfileRecord | null;
  tweets: TweetRecord[];
  blocked: boolean;
}

export async function parseSyndication(
  page: Page,
  username: string,
  maxTweets: number,
  includeReplies: boolean,
  includeRetweets: boolean,
  seenIds: Set<string>,
): Promise<SyndicationResult> {
  const data = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__');
    if (el?.textContent) {
      try { return JSON.parse(el.textContent); } catch { /* noop */ }
    }
    // Fallback: the endpoint sometimes returns raw JSON in the body.
    const body = document.body?.innerText ?? '';
    if (body.trim().startsWith('{')) {
      try { return JSON.parse(body); } catch { /* noop */ }
    }
    return null;
  });

  if (!data) return { profile: null, tweets: [], blocked: true };

  const pp = (data as any)?.props?.pageProps ?? data;
  const entries: any[] = pp?.timeline?.entries ?? pp?.entries ?? [];
  const tweetObjs: any[] = entries
    .map((e) => e?.content?.tweet ?? e?.tweet ?? null)
    .filter(Boolean);

  const userObj = tweetObjs.find((t) => t?.user)?.user ?? pp?.contextProvider?.user ?? null;
  const profile = userObj ? mapProfile(userObj, username) : null;

  const tweets: TweetRecord[] = [];
  for (const t of tweetObjs) {
    const rec = mapTweet(t, profile?.username ?? username);
    if (!rec.tweetId || seenIds.has(rec.tweetId)) continue;
    if (!includeReplies && rec.isReply) continue;
    if (!includeRetweets && rec.isRetweet) continue;
    seenIds.add(rec.tweetId);
    tweets.push(rec);
    if (tweets.length >= maxTweets) break;
  }

  return { profile, tweets, blocked: false };
}
