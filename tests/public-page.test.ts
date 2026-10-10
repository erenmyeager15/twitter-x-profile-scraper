import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCompactNumber, parsePublicProfilePage } from '../src/public-page.js';

const PROFILE_HTML = `<!doctype html>
<html><head>
<meta name="twitter:title" content="OpenAI (@OpenAI) on X">
<meta name="twitter:creator" content="@OpenAI">
<meta name="twitter:description" content="AI research and deployment company.">
<meta property="og:image" content="https://pbs.twimg.com/profile_images/avatar.jpg">
<meta name="twitter:image" content="https://pbs.twimg.com/profile_banners/banner.jpg">
</head><body>
<script>relationship_counts:$R[1]={followers:5424044,following:4};tweet_counts:$R[2]={tweets:2179};createdAtMs:1337373000000,location:"San Francisco",privacy:$R[3]={protected:!1},verification:$R[4]={is_blue_verified:!0,verified:!0,verified_type:"Business"};profile_bio:$R[5]={description:"bio"},url:$R[6]={urls:$R[7]=[$R[8]={expanded_url:"https://openai.com"}]};pinned_tweet_ids_str:$R[9]=["2107894997538525580"];</script>
<ul><li><div data-timeline-entry><article>
<span>Pinned</span><a href="/OpenAI">@OpenAI</a>
<div dir="auto">A useful update for <a href="/developers">@developers</a> #AI</div>
<a href="/OpenAI/status/2107894997538525580">Oct 7</a><script>run({"timestamp":1791396304000})</script>
<img src="https://pbs.twimg.com/media/example.jpg">
<div aria-label="Reply"><span class="x-animated-count-visual">1.1K</span></div>
<div aria-label="Repost"><span class="x-animated-count-visual">200</span></div>
<div aria-label="Like"><span class="x-animated-count-visual">23K</span></div>
<div aria-label="View count"><span class="x-animated-count-visual">5.9M</span></div>
</article></div></li></ul>
</body></html>`;

test('parses compact X counts', () => {
  assert.equal(parseCompactNumber('1.2K'), 1_200);
  assert.equal(parseCompactNumber('5.9M'), 5_900_000);
  assert.equal(parseCompactNumber('invalid'), null);
});

test('parses an exact public profile and recent post', () => {
  const result = parsePublicProfilePage(PROFILE_HTML, 'openai', 5);
  assert.ok(result);
  assert.equal(result.profile.username, 'OpenAI');
  assert.equal(result.profile.followersCount, 5_424_044);
  assert.equal(result.profile.followingCount, 4);
  assert.equal(result.profile.tweetsCount, 2_179);
  assert.equal(result.profile.websiteUrl, 'https://openai.com');
  assert.equal(result.profile.verificationType, 'Business');
  assert.equal(result.profile.pinnedTweetId, '2107894997538525580');
  assert.equal(result.profile.dataQuality, 'detailed');
  assert.equal(result.tweets.length, 1);
  assert.equal(result.tweets[0].postedDate, new Date(1_791_396_304_000).toISOString());
  assert.equal(result.tweets[0].likesCount, 23_000);
  assert.equal(result.tweets[0].viewsCount, 5_900_000);
  assert.deepEqual(result.tweets[0].hashtags, ['AI']);
  assert.deepEqual(result.tweets[0].mentions, ['developers']);
  assert.equal(result.tweets[0].isPinned, true);
});

test('rejects a mismatched profile and unsafe limits', () => {
  assert.equal(parsePublicProfilePage(PROFILE_HTML, 'another_user', 5), null);
  assert.equal(parsePublicProfilePage(PROFILE_HTML, 'openai', 21), null);
});
