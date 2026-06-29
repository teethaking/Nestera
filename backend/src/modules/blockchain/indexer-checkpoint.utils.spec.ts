import {
  computeCheckpointChecksum,
  isCheckpointChecksumValid,
} from './indexer-checkpoint.utils';

describe('indexer-checkpoint.utils', () => {
  it('computes deterministic checksums', () => {
    const snapshot = {
      streamId: 'savings-indexer',
      lastProcessedLedger: 100,
      lastProcessedEventCursor: 'cursor-1',
      totalEventsProcessed: 5,
      totalEventsFailed: 1,
    };

    const first = computeCheckpointChecksum(snapshot);
    const second = computeCheckpointChecksum(snapshot);
    expect(first).toBe(second);
  });

  it('validates checksum integrity', () => {
    const snapshot = {
      streamId: 'savings-indexer',
      lastProcessedLedger: 100,
      lastProcessedEventCursor: null,
      totalEventsProcessed: 0,
      totalEventsFailed: 0,
    };

    const checksum = computeCheckpointChecksum(snapshot);
    expect(isCheckpointChecksumValid(snapshot, checksum)).toBe(true);
    expect(
      isCheckpointChecksumValid(
        { ...snapshot, lastProcessedLedger: 101 },
        checksum,
      ),
    ).toBe(false);
  });
});
