# Retry Policy Documentation

This document describes the retry, backoff, and timeout policies used when making external calls in the Nestera backend system.

## Overview

External service calls are subject to transient failures due to network issues, rate limiting, or service unavailability. All retry policies follow industry best practices with exponential backoff to prevent cascading failures and thundering herd problems.

---

## 1. Blockchain RPC Calls

### Service: `@stellar/stellar-sdk` RPC Client Wrapper

**Location:** `backend/src/modules/blockchain/rpc-client.wrapper.ts`

### Configuration

| Setting | Default Value | Environment Variable |
|---------|--------------|---------------------|
| Max Retries | 3 | `RPC_MAX_RETRIES` |
| Retry Delay Base | 1000ms | `RPC_RETRY_DELAY` |
| Timeout | 10000ms | `RPC_TIMEOUT` |

### Policy Details

- **Backoff Strategy:** Exponential backoff (`delay * 2^retry`)
- **Max Attempts:** 3 retries per endpoint (with endpoint failover)
- **Endpoint Failover:** Automatically tries next priority endpoint on failure
- **Timeout:** 10 seconds per request

### Rationale

Blockchain RPC nodes can experience:
- Temporary network partitions
- Rate limiting during high network activity
- Node-specific issues during ledger catch-up

Exponential backoff prevents overwhelming recovering nodes while the multi-endpoint configuration ensures high availability.

### Example

```typescript
// With exponential backoff: 1s, 2s, 4s between retries
// Total max time: ~7s per endpoint × number of endpoints
```

---

## 2. Email Service

### Queue: `email`

**Location:** `backend/src/modules/job-queue/processors/email.processor.ts`

### Configuration

| Setting | Value |
|---------|-------|
| Attempts | 3 |
| Backoff | Exponential, 2000ms base delay |
| Remove on Complete | Keep 500 completed jobs |
| Remove on Fail | Keep 1000 failed jobs |

### Rationale

Email delivery can fail due to:
- SMTP server temporary unavailability
- Network connectivity issues
- Rate limiting by email provider

Failed email jobs are retained for replay capability. After 3 attempts, the job moves to the dead-letter queue (DLQ) for manual inspection.

---

## 3. Notification Service

### Queue: `notifications`

**Location:** `backend/src/modules/job-queue/processors/notification.processor.ts`

### Configuration

| Setting | Value |
|---------|-------|
| Attempts | 3 |
| Backoff | Exponential, 2000ms base delay |
| Remove on Complete | Keep 500 completed jobs |
| Remove on Fail | Keep 1000 failed jobs |

### Rationale

In-app notifications are idempotent and can be retried safely. Users should receive notifications even if there's a temporary delivery failure.

---

## 4. Blockchain Event Processing

### Queue: `blockchain`

**Location:** `backend/src/modules/job-queue/processors/blockchain.processor.ts`

### Configuration

| Setting | Value |
|---------|-------|
| Attempts | 5 |
| Backoff | Exponential, 5000ms base delay |
| Remove on Complete | Keep 500 completed jobs |
| Remove on Fail | Move to DLQ |

### Rationale

Smart contract events must be processed reliably. Longer backoff (5s) accounts for:
- Blockchain node recovery time
- Contract state verification requirements
- Avoiding duplicate transaction submissions

---

## 5. Report Generation

### Queue: `reports`

**Location:** `backend/src/modules/job-queue/processors/report.processor.ts`

### Configuration

| Setting | Value |
|---------|-------|
| Attempts | 3 |
| Backoff | Exponential, 2000ms base delay |
| Remove on Complete | Keep 500 completed jobs |
| Remove on Fail | Keep 1000 failed jobs |

### Rationale

Report generation is CPU-intensive and may fail due to:
- Database connection timeouts
- Large dataset processing requirements
- Memory constraints

Each retry allows the database connection to recover gracefully.

---

## 6. Audit Log Export

### Queue: `audit-log-export`

**Location:** `backend/src/modules/job-queue/processors/audit-log-export.processor.ts`

### Configuration

| Setting | Value |
|---------|-------|
| Attempts | 3 |
| Backoff | Exponential, 2000ms base delay |
| Remove on Complete | Keep 100 completed jobs |
| Remove on Fail | Keep 500 failed jobs |

### Rationale

Audit log exports can involve large datasets and may timeout. Queue-based processing:
- Prevents blocking admin endpoints
- Handles large exports asynchronously
- Allows for download retries

---

## 7. Dispute Evidence Processing

### Queue: `dispute-evidence`

**Location:** `backend/src/modules/job-queue/processors/dispute-evidence.processor.ts`

### Configuration

| Setting | Value |
|---------|-------|
| Attempts | 3 |
| Backoff | Exponential, 3000ms base delay |
| Remove on Complete | Keep 200 completed jobs |
| Remove on Fail | Keep 500 failed jobs |

### Rationale

Evidence processing requires:
- File storage accessibility
- Content analysis operations
- Database transaction commits

The longer backoff (3s) accounts for storage system recovery.

---

## 8. Database Operations

### Service: Connection Pool

**Location:** `backend/src/common/database/typeorm-pool.config.ts`

### Configuration

| Setting | Default Value | Environment Variable |
|---------|--------------|---------------------|
| Max Retries | 5 | `DB_MAX_RETRIES` |
| Initial Delay | 500ms | `DB_RETRY_INITIAL_DELAY` |
| Max Delay | 30000ms | `DB_RETRY_MAX_DELAY` |
| Backoff Multiplier | 2.0 | `DB_RETRY_BACKOFF` |
| Jitter | 100ms | `DB_RETRY_JITTER` |

### Rationale

PostgreSQL connection pool may temporarily exhaust available connections during:
- Traffic spikes
- Long-running transactions
- Connection leaks

Jitter prevents synchronized retry storms across multiple instances.

---

## Retry Policy Summary Table

| Service | Max Retries | Base Delay | Backoff | Timeout |
|---------|-------------|------------|---------|---------|
| RPC | 3 | 1000ms | Exponential | 10s |
| Email | 3 | 2000ms | Exponential | - |
| Notifications | 3 | 2000ms | Exponential | - |
| Blockchain Events | 5 | 5000ms | Exponential | - |
| Reports | 3 | 2000ms | Exponential | - |
| Audit Log Export | 3 | 2000ms | Exponential | - |
| Dispute Evidence | 3 | 3000ms | Exponential | - |
| Database | 5 | 500ms | Exponential + Jitter | - |

---

## Dead Letter Queue (DLQ)

Jobs that exceed their retry count are moved to the dead-letter queue for investigation. DLQ sizes are exposed via:

- `GET /admin/queues/:queueName/dlq-size` - Get DLQ size for specific queue
- `GET /admin/queues/:queueName/failed` - List failed jobs for manual retry

### DLQ Monitoring

The `getQueueStatus` endpoint returns `dlqSize` as part of the queue statistics, allowing operators to monitor failure rates and trigger alerts when thresholds are exceeded.

---

## Best Practices

1. **Always use exponential backoff** - Prevents thundering herd on recovering services
2. **Set appropriate timeouts** - Avoid hanging requests blocking resources
3. **Implement circuit breakers** - See `backend/src/common/circuit-breaker/`
4. **Monitor DLQ sizes** - Failed jobs represent operational issues
5. **Log retry attempts** - Use structured logging for debugging
6. **Consider idempotency** - Jobs may be delivered multiple times