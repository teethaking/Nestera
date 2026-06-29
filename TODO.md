# TODO (BlackboxAI)

## Circuit Breaker UI/Monitoring + Notification Preferences + Localization Defaults

### Step 1: Add admin monitoring endpoints for dependency failures (TODO)

- Extend `backend/src/modules/admin/circuit-breaker.controller.ts` (done)

- Add endpoints:
  - `GET /api/admin/circuit-breaker/dependency-failures`
  - `GET /api/admin/circuit-breaker/dependency-failures/:name`
- Data source: `CircuitBreakerService.getMetrics()`

### Step 2: Add notification type + user preference flag (TODO)

- Update `backend/src/modules/notifications/entities/notification.entity.ts`
  - Add `DEPENDENCY_CIRCUIT_BREAKER_OPENED`
- Update `backend/src/modules/notifications/entities/notification-preference.entity.ts`
  - Add `dependencyFailureNotifications` boolean default true
  - Add `locale` column default 'en'
- Update `backend/src/modules/notifications/dto/update-notification-preference.dto.ts`
  - Add `dependencyFailureNotifications?: boolean`
  - Add `locale?: string`

### Step 3: Trigger notifications when circuit breaker opens (easiest approach, TODO)

- Update `backend/src/common/circuit-breaker/circuit-breaker.service.ts` and/or `circuit-breaker.config.ts` / `CircuitBreaker` implementation:
  - Emit Nest event when a breaker transitions to OPEN (best-effort)
- Update `backend/src/modules/notifications/notifications.service.ts`
  - Add `@OnEvent('dependency.circuit_breaker.opened')` handler
  - Create notification based on user preference flag

### Step 4: DB migration
- Add migration(s) under `backend/migrations/` to add the new columns:
  - `notification_preferences.dependencyFailureNotifications`
  - `notification_preferences.locale`

### Step 5: Compile/test
- Run backend typecheck/build
- (Optional) run unit tests for touched modules
# TODO

## Data Export Security Controls
- [ ] Inspect `DataExportRequest` entity + related DTOs for fields needed (userId, token, expiresAt, filePath)
- [ ] Update `data-export.controller.ts` download endpoint to include `@CurrentUser()` and verify token belongs to caller
- [x] Update `data-export.service.ts` `getExportFile()` to accept `userId` and validate ownership
- [x] Validate resolved `filePath` is within `EXPORT_DIR` before sending
- [ ] Add rate limiting/throttling for `GET /users/data/export/download/:token`
- [ ] Add/adjust tests for unauthorized access + expired link + path validation

## Improve Cache Warming for High-Traffic Endpoints
- [x] Implement controlled concurrency in `cache-warming.service.ts`
- [x] Add per-endpoint timeout when calling `cacheStrategy.warmCache`
- [x] Add anti-duplicate lock to prevent overlapping warming runs
- [x] Ensure metrics remain accurate under parallel execution
- [ ] Run backend tests / lint

