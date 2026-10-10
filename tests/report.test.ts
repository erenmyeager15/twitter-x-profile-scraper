import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMonitoringReport, monitoringReportCsv } from '../src/report.js';
import type { ProfileRecord } from '../src/types.js';

const record = {
  username: 'formula', displayName: '=IMPORTXML("bad")', bio: '', followersCount: 10, followingCount: 2,
  tweetsCount: 3, likesCount: null, joinedDate: null, location: null, websiteUrl: null, profileImageUrl: null,
  bannerImageUrl: null, verifiedBadge: false, blueCheckmark: false, verificationType: null,
  isBusinessAccount: false, isPrivate: false, profileUrl: 'https://x.com/formula', pinnedTweetId: null,
  dataSource: 'public-page', dataQuality: 'detailed', recentTweets: [], scrapedAt: '2026-10-11T00:00:00.000Z',
  recentPostSummary: { postsReturned: 0, latestPostAt: null, totalLikes: null, totalReposts: null,
    totalReplies: null, totalViews: null, averageLikes: null, averageViews: null,
    averageEngagements: null, postsWithMedia: 0 },
} satisfies ProfileRecord;

test('builds summary totals and formula-safe CSV', () => {
  const report = buildMonitoringReport([record], 2, false, 'default', 0);
  assert.equal(report.savedProfiles, 1);
  assert.equal(report.failedProfiles, 1);
  const csv = monitoringReportCsv(report);
  assert.match(csv, /'=IMPORTXML/);
  assert.ok(csv.endsWith('\r\n'));
});
