import type { ProfileRecord } from './types.js';

export interface ReportRow {
  username: string;
  displayName: string;
  profileUrl: string;
  dataSource: ProfileRecord['dataSource'];
  dataQuality: ProfileRecord['dataQuality'];
  trackingStatus: ProfileRecord['trackingStatus'];
  observationCount: number | null;
  followersCount: number | null;
  followersDelta: number | null;
  followersGrowthPercent: number | null;
  followersPerDay: number | null;
  followingCount: number | null;
  followingDelta: number | null;
  tweetsCount: number | null;
  tweetsDelta: number | null;
  postsPerWeek: number | null;
  recentPostsReturned: number;
  averageLikes: number | null;
  averageViews: number | null;
  averageEngagements: number | null;
  changedFields: string[];
  growthSignals: string[];
  observedAt: string;
}

export interface MonitoringReport {
  schemaVersion: 1;
  generatedAt: string;
  trackGrowth: boolean;
  monitorName: string | null;
  requestedProfiles: number;
  savedProfiles: number;
  failedProfiles: number;
  stateWriteFailures: number;
  tracking: Record<string, number>;
  signals: Record<string, number>;
  profiles: ReportRow[];
}

export function buildMonitoringReport(
  profiles: ProfileRecord[],
  requestedProfiles: number,
  trackGrowth: boolean,
  monitorName: string,
  stateWriteFailures: number,
): MonitoringReport {
  const rows = profiles.map((profile): ReportRow => ({
    username: profile.username,
    displayName: profile.displayName,
    profileUrl: profile.profileUrl,
    dataSource: profile.dataSource,
    dataQuality: profile.dataQuality,
    trackingStatus: profile.trackingStatus ?? null,
    observationCount: profile.observationCount ?? null,
    followersCount: profile.followersCount,
    followersDelta: profile.followersDelta ?? null,
    followersGrowthPercent: profile.followersGrowthPercent ?? null,
    followersPerDay: profile.followersPerDay ?? null,
    followingCount: profile.followingCount,
    followingDelta: profile.followingDelta ?? null,
    tweetsCount: profile.tweetsCount,
    tweetsDelta: profile.tweetsDelta ?? null,
    postsPerWeek: profile.postsPerWeek ?? null,
    recentPostsReturned: profile.recentPostSummary.postsReturned,
    averageLikes: profile.recentPostSummary.averageLikes,
    averageViews: profile.recentPostSummary.averageViews,
    averageEngagements: profile.recentPostSummary.averageEngagements,
    changedFields: profile.changedFields ?? [],
    growthSignals: profile.growthSignals ?? [],
    observedAt: profile.scrapedAt,
  }));
  const tracking: Record<string, number> = {};
  const signals: Record<string, number> = {};
  for (const row of rows) {
    if (row.trackingStatus) tracking[row.trackingStatus] = (tracking[row.trackingStatus] ?? 0) + 1;
    for (const signal of row.growthSignals) signals[signal] = (signals[signal] ?? 0) + 1;
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    trackGrowth,
    monitorName: trackGrowth ? monitorName : null,
    requestedProfiles,
    savedProfiles: rows.length,
    failedProfiles: requestedProfiles - rows.length,
    stateWriteFailures,
    tracking,
    signals,
    profiles: rows,
  };
}

const COLUMNS: (keyof ReportRow)[] = [
  'username', 'displayName', 'profileUrl', 'dataSource', 'dataQuality', 'trackingStatus', 'observationCount',
  'followersCount', 'followersDelta', 'followersGrowthPercent', 'followersPerDay', 'followingCount',
  'followingDelta', 'tweetsCount', 'tweetsDelta', 'postsPerWeek', 'recentPostsReturned', 'averageLikes',
  'averageViews', 'averageEngagements', 'changedFields', 'growthSignals', 'observedAt',
];

function csvCell(value: unknown): string {
  const raw = Array.isArray(value) ? value.join('|') : value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function monitoringReportCsv(report: MonitoringReport): string {
  const lines = [COLUMNS.map(csvCell).join(',')];
  for (const row of report.profiles) lines.push(COLUMNS.map((column) => csvCell(row[column])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
