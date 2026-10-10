# Resume Notes — X (Twitter) Profile Scraper & Growth Monitor

## Current status

The 1.1 candidate is locally complete and should remain private until bounded cloud verification passes.

- Direct public X profile page is the default; no login, API key, browser, or proxy is required.
- Official X API v2 remains an optional bring-your-own-token data source.
- Direct HTTP is always attempted before one optional user-configured proxy retry.
- Public-page mode returns exact profile totals plus up to 20 recent posts.
- Price remains `$0.004` for each successfully saved profile, including available posts and monitoring fields.
- Candidate defaults: 256 MB, no proxy, 300-second timeout.

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

## Required cloud gate before publication

1. Create one staging build from the GitHub-pushed candidate.
2. Run one default OpenAI profile at 256 MB, no proxy.
3. Run the exact same input again to verify persistent comparison state.
4. Require complete output, five recent posts, working JSON/CSV links, zero state-write failures, and peak memory below 230.4 MiB.
5. Calculate recurring margin from the reported platform cost after Apify's 20% share; require at least 25%.
6. Publish the exact verified build only if every gate passes. Keep the Actor private otherwise.

No cloud build, paid verification, or Apify publication is included in the local work recorded here.
