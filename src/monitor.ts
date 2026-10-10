import { createHash } from 'node:crypto';
import type { ProfileRecord } from './types.js';

interface Observation {
  capturedAt: string;
  dataQuality: ProfileRecord['dataQuality'];
  displayName: string;
  bio: string;
  followersCount: number | null;
  followingCount: number | null;
  tweetsCount: number | null;
  websiteUrl: string | null;
  verificationType: string | null;
  latestPostAt: string | null;
}

export interface ProfileMonitorState {
  version: 1;
  firstSeenAt: string;
  observationCount: number;
  observations: Observation[];
}

export interface MonitorStore {
  getValue<T>(key: string): Promise<T | null>;
  setValue<T>(key: string, value: T): Promise<void>;
}

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function monitorStoreName(name: string): string {
  return `x-creator-growth-${hash(name.trim().toLowerCase()).slice(0, 24)}`;
}

export function monitorRecordKey(username: string): string {
  return `PROFILE_${hash(username.trim().toLowerCase()).slice(0, 32)}`;
}

function toObservation(profile: ProfileRecord): Observation {
  return {
    capturedAt: profile.scrapedAt,
    dataQuality: profile.dataQuality,
    displayName: profile.displayName,
    bio: profile.bio,
    followersCount: profile.followersCount,
    followingCount: profile.followingCount,
    tweetsCount: profile.tweetsCount,
    websiteUrl: profile.websiteUrl,
    verificationType: profile.verificationType,
    latestPostAt: profile.recentPostSummary.latestPostAt,
  };
}

function numericDelta(changed: string[], field: string, current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  const noiseFloor = field === 'followersCount' ? Math.max(1, Math.ceil(Math.abs(previous) * 0.0001)) : 1;
  if (Math.abs(delta) < noiseFloor) return null;
  if (delta !== 0) changed.push(field);
  return delta;
}

export function applyGrowthTracking(
  profile: ProfileRecord,
  previousState: ProfileMonitorState | null,
  monitorName: string,
  historyLimit: number,
): { profile: ProfileRecord; state: ProfileMonitorState } {
  const current = toObservation(profile);
  const previous = [...(previousState?.observations ?? [])].reverse().find((item) => item.dataQuality === 'detailed') ?? null;
  const changedFields: string[] = [];
  const followersDelta = previous ? numericDelta(changedFields, 'followersCount', profile.followersCount, previous.followersCount) : null;
  const followingDelta = previous ? numericDelta(changedFields, 'followingCount', profile.followingCount, previous.followingCount) : null;
  const tweetsDelta = previous ? numericDelta(changedFields, 'tweetsCount', profile.tweetsCount, previous.tweetsCount) : null;
  if (previous) {
    if (profile.displayName !== previous.displayName) changedFields.push('displayName');
    if (profile.bio !== previous.bio) changedFields.push('bio');
    if (profile.websiteUrl !== previous.websiteUrl) changedFields.push('websiteUrl');
    if (profile.verificationType !== previous.verificationType) changedFields.push('verificationType');
    if (profile.recentPostSummary.latestPostAt !== previous.latestPostAt) changedFields.push('latestPostAt');
  }

  const elapsedDays = previous ? (Date.parse(profile.scrapedAt) - Date.parse(previous.capturedAt)) / 86_400_000 : null;
  const rateInterval = elapsedDays !== null && Number.isFinite(elapsedDays) && elapsedDays >= 1 / 24;
  const followersGrowthPercent = followersDelta !== null && (previous?.followersCount ?? 0) > 0
    ? round((followersDelta / previous!.followersCount!) * 100) : null;
  const followersPerDay = followersDelta !== null && rateInterval ? round(followersDelta / elapsedDays!, 2) : null;
  const postsPerWeek = tweetsDelta !== null && rateInterval ? round((tweetsDelta / elapsedDays!) * 7, 2) : null;
  const growthSignals: string[] = [];
  if (rateInterval && (followersDelta ?? 0) > 0) growthSignals.push('followers_growing');
  if (rateInterval && (followersDelta ?? 0) < 0) growthSignals.push('followers_declining');
  if (rateInterval && followersGrowthPercent !== null && elapsedDays! <= 7 && followersGrowthPercent >= 5) growthSignals.push('follower_spike');
  if (rateInterval && followersGrowthPercent !== null && elapsedDays! <= 7 && followersGrowthPercent <= -5) growthSignals.push('follower_drop');
  if ((tweetsDelta ?? 0) > 0 || changedFields.includes('latestPostAt')) growthSignals.push('new_posts');
  if (changedFields.some((field) => ['displayName', 'bio', 'websiteUrl'].includes(field))) growthSignals.push('profile_updated');
  if (changedFields.includes('verificationType')) growthSignals.push('verification_changed');

  const trackingStatus: NonNullable<ProfileRecord['trackingStatus']> = profile.dataQuality === 'profile-only'
    ? 'partial' : !previous ? 'baseline' : changedFields.length > 0 ? 'updated' : 'unchanged';
  const nextCount = (previousState?.observationCount ?? 0) + 1;
  const firstSeenAt = previousState?.firstSeenAt ?? profile.scrapedAt;
  const previousSeenAt = previousState?.observations.at(-1)?.capturedAt ?? null;
  return {
    profile: {
      ...profile,
      monitorName,
      trackingStatus,
      firstSeenAt,
      previousSeenAt,
      observationCount: nextCount,
      changedFields,
      previousFollowersCount: previous?.followersCount ?? null,
      followersDelta,
      followersGrowthPercent,
      followersPerDay,
      previousFollowingCount: previous?.followingCount ?? null,
      followingDelta,
      previousTweetsCount: previous?.tweetsCount ?? null,
      tweetsDelta,
      postsPerWeek,
      growthSignals,
    },
    state: {
      version: 1,
      firstSeenAt,
      observationCount: nextCount,
      observations: [...(previousState?.observations ?? []), current].slice(-historyLimit),
    },
  };
}

export async function loadProfileState(store: MonitorStore, username: string): Promise<ProfileMonitorState | null> {
  const state = await store.getValue<ProfileMonitorState>(monitorRecordKey(username));
  return state?.version === 1 && Array.isArray(state.observations) ? state : null;
}

export async function saveProfileState(store: MonitorStore, username: string, state: ProfileMonitorState): Promise<void> {
  await store.setValue(monitorRecordKey(username), state);
}
