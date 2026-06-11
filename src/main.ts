import { Actor, log } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { runXApiMode } from './api.js';
import { extractUsername, parseSyndication, syndicationUrl } from './routes.js';
import type { ActorInput } from './types.js';

await Actor.init();

try {
  const input = (await Actor.getInput()) as ActorInput | null;

  if (!input?.usernames?.length) {
    throw new Error('Input "usernames" is required. Provide at least one Twitter/X username or URL.');
  }

  const {
    usernames,
    dataSource = 'auto',
    xApiBearerToken,
    maxTweetsPerProfile = 10,
    includeReplies = false,
    includeRetweets = false,
    proxyConfiguration: proxyConfig,
  } = input;

  const normalizedUsernames = usernames.map((u) => extractUsername(u));
  const shouldUseApi = (dataSource !== 'syndication' && Boolean(xApiBearerToken?.trim())) || dataSource === 'api';

  if (shouldUseApi) {
    log.info(xApiBearerToken?.trim()
      ? 'Using X API mode because xApiBearerToken was supplied.'
      : 'Using X API mode because dataSource is api.');
    await runXApiMode({ ...input, usernames: normalizedUsernames, maxTweetsPerProfile });
  } else {
    log.info('Using no-login syndication mode. This endpoint is rate-limited by X; use xApiBearerToken for reliable runs.');

    const proxyConfiguration = proxyConfig
      ? await Actor.createProxyConfiguration({
          groups: proxyConfig.apifyProxyGroups ?? ['RESIDENTIAL'],
          proxyUrls: proxyConfig.proxyUrls,
        })
      : await Actor.createProxyConfiguration({ groups: ['RESIDENTIAL'] });

    const profilesDataset = await Actor.openDataset();
    const tweetsDataset = await Actor.openDataset('tweets');
    const seenTweetIds = new Set<string>();

    const crawler = new PlaywrightCrawler({
      proxyConfiguration,
      sessionPoolOptions: {
        maxPoolSize: 30,
        sessionOptions: {
          maxAgeSecs: 1800,
          maxUsageCount: 5,
        },
      },
      retryOnBlocked: true,
      maxRequestRetries: 5,
      requestHandlerTimeoutSecs: 120,
      launchContext: {
        launchOptions: {
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ],
        },
      },
      async requestHandler({ page, request, log: ctxLog, session }) {
        const contextUsername = request.userData.username as string;
        ctxLog.info(`Scraping @${contextUsername}`);

        await page.waitForTimeout(1000 + Math.random() * 2000);

        const { profile, tweets, blocked } = await parseSyndication(
          page,
          contextUsername,
          maxTweetsPerProfile,
          includeReplies,
          includeRetweets,
          seenTweetIds,
        );

        if (blocked || !profile) {
          ctxLog.warning(`No data for @${contextUsername} (rate-limited or not found). Rotating session.`);
          session?.retire();
          throw new Error(`BLOCKED_OR_EMPTY: ${contextUsername}`);
        }

        await profilesDataset.pushData(profile);
        for (const tweet of tweets) {
          await tweetsDataset.pushData(tweet);
        }

        await Actor.charge({ eventName: 'profile-scraped' });
        ctxLog.info(`Done: @${contextUsername} - profile + ${tweets.length} tweets`);
      },
      async failedRequestHandler({ request, log: ctxLog }, error) {
        ctxLog.error(`Request failed for ${request.url}: ${(error as Error)?.message ?? 'unknown'}`);
      },
    });

    await crawler.run(
      normalizedUsernames.map((username) => ({
        url: syndicationUrl(username),
        userData: { username },
      })),
    );
  }

  log.info('Scraping complete. All datasets updated.');
} catch (error) {
  console.error('Actor failed:', error);
  throw error;
} finally {
  await Actor.exit();
}
