import assert from 'node:assert/strict';
import test from 'node:test';

import { applyGrowthTracking } from '../src/monitor.js';
import type { ProfileRecord } from '../src/types.js';

function profile(scrapedAt: string, followersCount: number, tweetsCount: number): ProfileRecord {
  return {
    username: 'openai', displayName: 'OpenAI', bio: 'AI', followersCount, followingCount: 4, tweetsCount,
    likesCount: null, joinedDate: null, location: null, websiteUrl: 'https://openai.com', profileImageUrl: null,
    bannerImageUrl: null, verifiedBadge: true, blueCheckmark: true, verificationType: 'Business',
    isBusinessAccount: true, isPrivate: false, profileUrl: 'https://x.com/openai', pinnedTweetId: null,
    dataSource: 'public-page', dataQuality: 'detailed', recentTweets: [], scrapedAt,
    recentPostSummary: { postsReturned: 0, latestPostAt: null, totalLikes: null, totalReposts: null,
      totalReplies: null, totalViews: null, averageLikes: null, averageViews: null,
      averageEngagements: null, postsWithMedia: 0 },
  };
}

test('creates a baseline and calculates later growth', () => {
  const baseline = applyGrowthTracking(profile('2026-10-01T00:00:00.000Z', 1_000, 100), null, 'US watchlist', 30);
  assert.equal(baseline.profile.trackingStatus, 'baseline');
  assert.equal(baseline.profile.observationCount, 1);

  const update = applyGrowthTracking(profile('2026-10-03T00:00:00.000Z', 1_100, 104), baseline.state, 'US watchlist', 30);
  assert.equal(update.profile.trackingStatus, 'updated');
  assert.equal(update.profile.followersDelta, 100);
  assert.equal(update.profile.followersGrowthPercent, 10);
  assert.equal(update.profile.followersPerDay, 50);
  assert.equal(update.profile.postsPerWeek, 14);
  assert.ok(update.profile.growthSignals?.includes('followers_growing'));
});

test('keeps monitoring history bounded', () => {
  let state = applyGrowthTracking(profile('2026-10-01T00:00:00.000Z', 1_000, 100), null, 'default', 2).state;
  state = applyGrowthTracking(profile('2026-10-02T00:00:00.000Z', 1_001, 101), state, 'default', 2).state;
  state = applyGrowthTracking(profile('2026-10-03T00:00:00.000Z', 1_002, 102), state, 'default', 2).state;
  assert.equal(state.observations.length, 2);
  assert.equal(state.observationCount, 3);
});
