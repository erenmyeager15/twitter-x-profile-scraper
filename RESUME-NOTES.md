# Resume Notes — X (Twitter) Profile Scraper & Growth Monitor

## Current status

Version 1.1.1 is verified and public on Apify. Exact build `Y4ecGe5SzGUuPw8XK` is tagged `latest` and `staging`; GitHub source commit is `50a0a1e`.

- Direct public X profile page is the default; no login, API key, browser, or proxy is required.
- Official X API v2 remains an optional bring-your-own-token data source.
- Direct HTTP is always attempted before one optional user-configured proxy retry.
- Public-page mode returns exact profile totals plus up to 20 recent posts.
- Price remains `$0.004` for each successfully saved profile, including available posts and monitoring fields.
- Public defaults: 256 MB, no proxy, 300-second timeout.

## New product value

- Recent post text, time, engagement, views, media, and pinned status
- Per-profile recent engagement summaries
- Named persistent watchlists with bounded history
- Follower/post deltas, growth percentage, velocity, and posting pace
- Bio, name, website, verification, and latest-post change detection
- Conservative growth/change signals
- JSON run report and formula-safe CSV report
- Honest `detailed` versus `profile-only` quality labels
- Strong US creator, brand, PR, and competitor-monitoring Store copy

## Completed gates

- 6/6 regression tests
- TypeScript typecheck and production build
- Valid Apify input schema
- Production dependency audit: zero known vulnerabilities
- Live OpenAI direct-page parse: exact profile totals and five current posts
- Two isolated live no-proxy runs: baseline then unchanged, observation count 2
- Live Elon Musk direct-page checks: success without proxy
- Measured local Node peak: about 121.1 MiB, leaving about 134.9 MiB at 256 MB

## Cloud and publication gates

- Build `Y4ecGe5SzGUuPw8XK` / `1.1.1` succeeded and is the exact published build.
- Matching OpenAI checks `zWCVohcgcjbIkOCC8` and `YdGhLQWAdCYPL9527` both succeeded without a proxy.
- Runs finished in about 3.6 and 2.86 seconds and peaked at about 54.51 and 52.98 MiB.
- Both returned one complete profile and five recent posts. The repeat recorded observation count two as unchanged.
- Dataset, `OUTPUT`, JSON report and formula-safe CSV passed; state-write failures were zero.
- Platform usage was user-billed. Estimated creator share after Apify's 20% is about 80%; the conservative stress test is about 77.42-77.72%.
- Build, platform usage and conservatively added listed event fees total about $0.01455, below the $0.06 soft target.
- Store page returned HTTP 200: https://apify.com/fascinating_lentil/twitter-x-profile-scraper

Full receipt: `release/cloud-verification-20261011.json`. Results are owner-test evidence, not guaranteed customer demand or income.
