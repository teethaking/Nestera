export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  BLOCKCHAIN: 'blockchain',
  EMAIL: 'email',
  REPORTS: 'reports',
  ANALYTICS_AGGREGATION: 'analytics-aggregation',
  DISPUTE_EVIDENCE: 'dispute-evidence',
  AVATAR: 'avatar',
  AUDIT_LOG_EXPORT: 'audit-log-export',
} as const;

export const JOB_NAMES = {
  SEND_NOTIFICATION: 'send-notification',
  SEND_EMAIL: 'send-email',
  PROCESS_BLOCKCHAIN_EVENT: 'process-blockchain-event',
  GENERATE_REPORT: 'generate-report',
  PROCESS_AGGREGATION: 'process-aggregation',
  PROCESS_DISPUTE_EVIDENCE: 'process-dispute-evidence',
  PROCESS_AVATAR: 'process-avatar',
  EXPORT_AUDIT_LOGS: 'export-audit-logs',
} as const;

export const DLQ_SUFFIX = '-dlq';
