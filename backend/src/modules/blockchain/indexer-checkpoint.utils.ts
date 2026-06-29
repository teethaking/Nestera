import { createHash } from 'crypto';

export const INDEXER_STREAM_SAVINGS = 'savings-indexer';

export interface CheckpointSnapshot {
  streamId: string;
  lastProcessedLedger: number;
  lastProcessedEventCursor: string | null;
  totalEventsProcessed: number;
  totalEventsFailed: number;
}

export function computeCheckpointChecksum(
  snapshot: CheckpointSnapshot,
): string {
  const payload = [
    snapshot.streamId,
    snapshot.lastProcessedLedger,
    snapshot.lastProcessedEventCursor ?? '',
    snapshot.totalEventsProcessed,
    snapshot.totalEventsFailed,
  ].join('|');

  return createHash('sha256').update(payload).digest('hex');
}

export function isCheckpointChecksumValid(
  snapshot: CheckpointSnapshot,
  storedChecksum: string | null,
): boolean {
  if (!storedChecksum) {
    return true;
  }
  return computeCheckpointChecksum(snapshot) === storedChecksum;
}
