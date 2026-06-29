import { rpc } from '@stellar/stellar-sdk';

export const mockEvent = (overrides: Partial<rpc.Api.EventResponse> = {}) => {
  const base: rpc.Api.EventResponse = {
    id: 'event-1',
    ledger: 100,
    pagingToken: 'paging-1',
    contractId: 'contract-1' as any,
    txHash: 'tx-1',
    inSuccessfulContractCall: true,
    ledgerClosedAt: '2020-01-01T00:00:00Z',
    type: 'contract',
    topic: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: { toXDR: () => 'AAAA' } as any,
  };

  return { ...base, ...overrides };
};

