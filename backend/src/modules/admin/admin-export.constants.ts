export const ADMIN_EXPORT_QUEUE = 'admin-exports';
export const ADMIN_EXPORT_JOB_NAME = 'generate-admin-export';
export const ADMIN_EXPORT_FILE_DIR = 'nestera-admin-exports';
export const ADMIN_EXPORT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const TRANSACTION_SENSITIVE_FIELDS = [
  'publicKey',
  'txHash',
  'eventId',
  'ledgerSequence',
  'metadata',
] as const;

export const DISPUTE_SENSITIVE_FIELDS = [
  'disputedBy',
  'evidence',
  'resolution',
] as const;

export const ADMIN_EXPORT_ROLES = ['ADMIN', 'SUPER_ADMIN', 'ANALYST'] as const;
export const ADMIN_MUTATION_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;
