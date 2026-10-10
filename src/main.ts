import { Actor, log } from 'apify';
import { gotScraping } from 'got-scraping';

import { fetchXApiProfile } from './api.js';
import { applyGrowthTracking, loadProfileState, monitorStoreName, saveProfileState } from './monitor.js';
import { parsePublicProfilePage, summarizeRecentPosts } from './public-page.js';
import { buildMonitoringReport, monitoringReportCsv } from './report.js';
import type { ActorInput, ProfileResult } from './types.js';

const MAX_PROFILES = 25;
const MAX_PUBLIC_POSTS = 20;
const MAX_API_POSTS = 100;
const MAX_HTML_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 20_000;

function normalizeUsernames(values: unknown): string[] {
    if (!Array.isArray(values)) throw new Error('usernames must be an array.');

    const normalized = values.map((value) => {
        if (typeof value !== 'string') throw new Error('Every username must be text.');
        const target = value.trim();
        let username = target.replace(/^@/, '');
        if (/^https?:\/\//i.test(target)) {
            let url: URL;
            try {
                url = new URL(target);
            } catch {
                throw new Error(`Invalid X profile URL: ${value}.`);
            }
            if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) {
                throw new Error(`Unsupported profile host: ${url.hostname}. Use x.com or twitter.com.`);
            }
            username = url.pathname.split('/').filter(Boolean)[0] ?? '';
        }
        username = username.toLowerCase();
        if (!/^[a-z0-9_]{1,15}$/i.test(username)) {
            throw new Error(`Invalid X username: ${value}. Use 1-15 letters, numbers, or underscores.`);
        }
        return username;
    });

    const unique = [...new Set(normalized)];
    if (unique.length === 0) throw new Error('Add at least one public X username.');
    if (unique.length > MAX_PROFILES) throw new Error(`A single run supports up to ${MAX_PROFILES} profiles.`);
    return unique;
}

interface NormalizedInput {
    usernames: string[];
    dataSource: NonNullable<ActorInput['dataSource']>;
    xApiBearerToken?: string;
    maxTweetsPerProfile: number;
    includeReplies: boolean;
    includeRetweets: boolean;
    trackGrowth: boolean;
    monitorName: string;
    observationHistoryLimit: number;
    proxyConfiguration?: ActorInput['proxyConfiguration'];
}

function normalizeInput(input: ActorInput | null): NormalizedInput {
    const value = input ?? ({ usernames: ['openai'] } as ActorInput);
    const dataSource = value.dataSource ?? 'auto';
    if (!['auto', 'public-page', 'api'].includes(dataSource)) throw new Error('dataSource must be auto, public-page, or api.');

    const maxTweetsPerProfile = Math.floor(value.maxTweetsPerProfile ?? 5);
    if (maxTweetsPerProfile < 0 || maxTweetsPerProfile > MAX_API_POSTS) {
        throw new Error(`maxTweetsPerProfile must be between 0 and ${MAX_API_POSTS}.`);
    }
    if (dataSource === 'api' && !value.xApiBearerToken?.trim()) {
        throw new Error('xApiBearerToken is required when dataSource is api.');
    }

    return {
        usernames: normalizeUsernames(value.usernames),
        dataSource,
        xApiBearerToken: value.xApiBearerToken?.trim() || undefined,
        maxTweetsPerProfile,
        includeReplies: value.includeReplies ?? false,
        includeRetweets: value.includeRetweets ?? false,
        trackGrowth: value.trackGrowth ?? true,
        monitorName: (value.monitorName ?? 'default').trim().slice(0, 80) || 'default',
        observationHistoryLimit: Math.max(2, Math.min(90, Math.floor(value.observationHistoryLimit ?? 30))),
        proxyConfiguration: value.proxyConfiguration,
    };
}

async function createProxyConfiguration(input?: ActorInput['proxyConfiguration']) {
    if (!input) return undefined;
    if (!input.useApifyProxy && !input.proxyUrls?.length) return undefined;

    return Actor.createProxyConfiguration({
        useApifyProxy: input.useApifyProxy,
        apifyProxyGroups: input.apifyProxyGroups,
        apifyProxyCountry: input.apifyProxyCountry,
        proxyUrls: input.proxyUrls,
    });
}

async function fetchPublicPage(username: string, proxyUrl?: string): Promise<ProfileResult> {
    const url = `https://x.com/${encodeURIComponent(username)}`;
    const response = await gotScraping({
        url,
        proxyUrl,
        headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
        },
        retry: { limit: 0 },
        throwHttpErrors: false,
        timeout: { request: REQUEST_TIMEOUT_MS },
    });

    if (response.statusCode !== 200) throw new Error(`X returned HTTP ${response.statusCode}.`);
    const html = response.body;
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) throw new Error('X returned an unexpectedly large page.');
    const parsed = parsePublicProfilePage(html, username, MAX_PUBLIC_POSTS);
    if (!parsed) throw new Error('X returned a page without a complete matching public profile.');
    return parsed;
}

function filterPosts(result: ProfileResult, includeReplies: boolean, includeRetweets: boolean, limit: number): ProfileResult {
    const tweets = result.tweets
        .filter((tweet) => includeReplies || !tweet.isReply)
        .filter((tweet) => includeRetweets || !tweet.isRetweet)
        .slice(0, limit);

    return {
        ...result,
        tweets,
        profile: {
            ...result.profile,
            recentTweets: tweets,
            recentPostSummary: summarizeRecentPosts(tweets),
            dataQuality: tweets.length > 0 || limit === 0 ? 'detailed' : 'profile-only',
        },
    };
}

function safeReason(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message
        .replace(/bearer\s+[a-z0-9._~-]+/gi, 'bearer [redacted]')
        .replace(/(https?:\/\/)[^@\s/]+@/gi, '$1[redacted]@')
        .slice(0, 240);
}

async function collectProfile(
    username: string,
    input: ReturnType<typeof normalizeInput>,
    proxyConfiguration: Awaited<ReturnType<typeof createProxyConfiguration>>,
): Promise<ProfileResult> {
    const useApi = input.dataSource === 'api' || (input.dataSource === 'auto' && Boolean(input.xApiBearerToken));
    if (useApi) {
        const result = await fetchXApiProfile(
            username,
            input.xApiBearerToken!,
            Math.min(input.maxTweetsPerProfile, MAX_API_POSTS),
            input.includeReplies,
            input.includeRetweets,
        );
        if (!result) throw new Error('The X API did not return the requested profile.');
        return filterPosts(result, input.includeReplies, input.includeRetweets, input.maxTweetsPerProfile);
    }

    try {
        const result = await fetchPublicPage(username);
        return filterPosts(result, input.includeReplies, input.includeRetweets, Math.min(input.maxTweetsPerProfile, MAX_PUBLIC_POSTS));
    } catch (directError) {
        if (!proxyConfiguration) throw directError;
        log.warning(`Direct access failed for @${username}; retrying once with the configured proxy.`, {
            reason: safeReason(directError),
        });
        const proxyUrl = await proxyConfiguration.newUrl(username);
        const result = await fetchPublicPage(username, proxyUrl);
        return filterPosts(result, input.includeReplies, input.includeRetweets, Math.min(input.maxTweetsPerProfile, MAX_PUBLIC_POSTS));
    }
}

await Actor.main(async () => {
    const input = normalizeInput(await Actor.getInput<ActorInput>());
    const proxyConfiguration = await createProxyConfiguration(input.proxyConfiguration);
    const monitorStore = input.trackGrowth ? await Actor.openKeyValueStore(monitorStoreName(input.monitorName)) : null;
    const successfulProfiles: ProfileResult['profile'][] = [];
    const failedProfiles: Array<{ username: string; error: string }> = [];
    let stateWriteFailures = 0;

    await Actor.setStatusMessage(`Collecting ${input.usernames.length} X profile${input.usernames.length === 1 ? '' : 's'}…`);

    for (const username of input.usernames) {
        try {
            const collected = await collectProfile(username, input, proxyConfiguration);
            const previousState = monitorStore ? await loadProfileState(monitorStore, username) : null;
            const monitored = monitorStore
                ? applyGrowthTracking(collected.profile, previousState, input.monitorName, input.observationHistoryLimit)
                : { profile: collected.profile, state: null };

            const chargeResult = await Actor.pushData(monitored.profile, 'profile-scraped');
            const saved = (chargeResult.chargedCount ?? 0) > 0 || chargeResult.eventChargeLimitReached !== true;
            if (!saved) throw new Error('The profile could not be saved because the run reached its event charge limit.');

            if (monitorStore && monitored.state) {
                try {
                    await saveProfileState(monitorStore, username, monitored.state);
                } catch (error) {
                    stateWriteFailures += 1;
                    log.warning(`Saved @${username}, but its monitoring history could not be updated.`, { reason: safeReason(error) });
                }
            }
            successfulProfiles.push(monitored.profile);
            log.info(`Saved @${username}`, {
                source: monitored.profile.dataSource,
                recentPosts: monitored.profile.recentTweets.length,
                trackingStatus: monitored.profile.trackingStatus,
            });
        } catch (error) {
            const reason = safeReason(error);
            failedProfiles.push({ username, error: reason });
            log.error(`Could not collect @${username}`, { reason });
        }
    }

    if (successfulProfiles.length === 0) {
        throw new Error(`No profiles were saved. ${failedProfiles.map((item) => `@${item.username}: ${item.error}`).join(' | ')}`);
    }

    const report = buildMonitoringReport(
        successfulProfiles,
        input.usernames.length,
        input.trackGrowth,
        input.monitorName,
        stateWriteFailures,
    );
    await Actor.setValue('MONITORING-REPORT', report);
    await Actor.setValue('MONITORING-REPORT.csv', monitoringReportCsv(report), { contentType: 'text/csv; charset=utf-8' });
    await Actor.setValue('OUTPUT', { ...report, failures: failedProfiles });

    await Actor.setStatusMessage(
        `Saved ${successfulProfiles.length}/${input.usernames.length} profile${successfulProfiles.length === 1 ? '' : 's'} with ${successfulProfiles.reduce((sum, profile) => sum + profile.recentTweets.length, 0)} recent posts.`,
    );
});
