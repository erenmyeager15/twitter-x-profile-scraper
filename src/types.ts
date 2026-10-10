export interface ActorInput {
  usernames: string[];
  dataSource?: 'auto' | 'public-page' | 'api';
  xApiBearerToken?: string;
  maxTweetsPerProfile?: number;
  includeReplies?: boolean;
  includeRetweets?: boolean;
  trackGrowth?: boolean;
  monitorName?: string;
  observationHistoryLimit?: number;
  proxyConfiguration?: {
    useApifyProxy: boolean;
    apifyProxyGroups?: string[];
    apifyProxyCountry?: string;
    proxyUrls?: string[];
  };
}

export interface TweetRecord {
  tweetId: string;
  text: string;
  tweetUrl: string;
  postedDate: string | null;
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
  isPinned: boolean;
  hashtags: string[];
  mentions: string[];
  links: string[];
  language: string | null;
  authorUsername: string;
  inReplyToTweetId: string | null;
  quotedTweetId: string | null;
  scrapedAt: string;
}

export interface RecentPostSummary {
  postsReturned: number;
  latestPostAt: string | null;
  totalLikes: number | null;
  totalReposts: number | null;
  totalReplies: number | null;
  totalViews: number | null;
  averageLikes: number | null;
  averageViews: number | null;
  averageEngagements: number | null;
  postsWithMedia: number;
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
  verificationType: string | null;
  isBusinessAccount: boolean;
  isPrivate: boolean;
  profileUrl: string;
  pinnedTweetId: string | null;
  dataSource: 'public-page' | 'x-api';
  dataQuality: 'detailed' | 'profile-only';
  recentPostSummary: RecentPostSummary;
  recentTweets: TweetRecord[];
  scrapedAt: string;
  monitorName?: string | null;
  trackingStatus?: 'baseline' | 'updated' | 'unchanged' | 'partial' | null;
  firstSeenAt?: string | null;
  previousSeenAt?: string | null;
  observationCount?: number | null;
  changedFields?: string[];
  previousFollowersCount?: number | null;
  followersDelta?: number | null;
  followersGrowthPercent?: number | null;
  followersPerDay?: number | null;
  previousFollowingCount?: number | null;
  followingDelta?: number | null;
  previousTweetsCount?: number | null;
  tweetsDelta?: number | null;
  postsPerWeek?: number | null;
  growthSignals?: string[];
}

export interface ProfileResult {
  profile: ProfileRecord;
  tweets: TweetRecord[];
}
