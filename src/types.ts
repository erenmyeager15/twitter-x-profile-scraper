export interface ActorInput {
  usernames: string[];
  dataSource?: 'auto' | 'api' | 'syndication';
  xApiBearerToken?: string;
  maxTweetsPerProfile?: number;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  proxyConfiguration?: {
    useApifyProxy: boolean;
    apifyProxyGroups?: string[];
    proxyUrls?: string[];
  };
}

export interface ProfileRecord {
  username: string;
  displayName: string;
  bio: string;
  followersCount: number | null;
  followingCount: number | null;
  tweetsCount: number | null;
  likesCount: number | null;
  joinedDate: string | null;
  location: string | null;
  websiteUrl: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  verifiedBadge: boolean;
  blueCheckmark: boolean;
  isBusinessAccount: boolean;
  profileUrl: string;
  pinnedTweetId: string | null;
  scrapedAt: string;
}

export interface TweetRecord {
  tweetId: string;
  text: string;
  tweetUrl: string;
  postedDate: string;
  likesCount: number | null;
  retweetsCount: number | null;
  repliesCount: number | null;
  viewsCount: number | null;
  quoteTweetsCount: number | null;
  hasMedia: boolean;
  mediaUrls: string[];
  isReply: boolean;
  isRetweet: boolean;
  isQuote: boolean;
  hashtags: string[];
  mentions: string[];
  links: string[];
  language: string | null;
  authorUsername: string;
  inReplyToTweetId: string | null;
  quotedTweetId: string | null;
  scrapedAt: string;
}

export interface CrawlContext {
  username: string;
  maxTweets: number;
  includeReplies: boolean;
  includeRetweets: boolean;
}
