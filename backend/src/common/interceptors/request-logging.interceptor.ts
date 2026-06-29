import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { SecretsConfigService } from '../services/secrets-config.service';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'nestjs-pino';
import { LogSanitizerService } from '../services/log-sanitizer.service';
import { ApmService } from '../../modules/apm/apm.service';

const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
]);

function sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (REDACTED_HEADERS.has(key.toLowerCase())) {
      safe[key] = '[REDACTED]';
    } else if (
      typeof value === 'string' &&
      SecretsConfigService.isSensitiveKey(key)
    ) {
      safe[key] = '[REDACTED]';
    } else {
      safe[key] = String(value);
    }
  }
  return safe;
}

const SKIP_LOG_PATHS = new Set([
  '/api/health',
  '/api/metrics',
  '/api/v1/health',
  '/api/v2/health',
  '/favicon.ico',
]);

const isErrorStatus = (status: number) => status >= 400;

export interface DomainIdentifiers {
  savingsId?: string;
  proposalId?: string;
  userId?: string;
  referralCode?: string;
  transactionId?: string;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly pinoLogger: Logger,
    @Optional()
    @Inject(LogSanitizerService)
    private readonly sanitizer: LogSanitizerService | null,
    @Optional()
    @Inject(ApmService)
    private readonly apmService: ApmService | null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const correlationId =
      (request as Request & { correlationId?: string }).correlationId ||
      (request.headers['x-correlation-id'] as string) ||
      uuidv4();

    const startTime = Date.now();
    const { method, ip, url: requestUrl } = request;
    const url = this.sanitizer?.sanitizeUrl(request.url) ?? request.url;
    const rawPath = request.path ?? request.url;

    (request as Request & { correlationId?: string }).correlationId =
      correlationId;
    response.setHeader('x-correlation-id', correlationId);

    if (SKIP_LOG_PATHS.has(rawPath)) {
      return next.handle();
    }

    const reqWithUser = request as Request & {
      user?: { id?: string; address?: string; email?: string };
    };
    const userId = reqWithUser.user?.id;
    const address = reqWithUser.user?.address;

    const domainIdentifiers = this.extractDomainIdentifiers(request);

    void this.sanitizer?.sanitizeHeaders(request.headers);

    this.pinoLogger.log({
      msg: `→ ${method} ${url}`,
      type: 'REQUEST',
      correlationId,
      method,
      url,
      ip,
      userId,
      address: address ? this.sanitizer?.maskAddress(address) : undefined,
      ...domainIdentifiers,
      userAgent: request.headers['user-agent'],
      contentLength: request.headers['content-length'],
      referer: request.headers['referer'],
      body:
        method !== 'GET' && this.sanitizer
          ? this.sanitizer.sanitizeBody(request.body)
          : undefined,
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.apmService?.trackHttpRequest(
          method,
          rawPath,
          statusCode,
          duration,
        );

        const logPayload = {
          msg: `← ${method} ${url} ${statusCode} (${duration}ms)`,
          type: 'RESPONSE',
          correlationId,
          method,
          url,
          statusCode,
          duration,
          userId,
          ...domainIdentifiers,
        };

        if (isErrorStatus(statusCode)) {
          this.pinoLogger.warn(logPayload);
        } else {
          this.pinoLogger.log(logPayload);
        }
      }),
      catchError((error: Error & { status?: number }) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status ?? 500;
        const isClientError = statusCode < 500;

        this.apmService?.trackHttpRequest(
          method,
          rawPath,
          statusCode,
          duration,
        );
        if (!isClientError) {
          this.apmService?.trackError(error, {
            route: rawPath,
            method,
            statusCode,
            userId,
            ...domainIdentifiers,
          });
        }

        const logPayload = {
          msg: `✗ ${method} ${url} ${statusCode} (${duration}ms) — ${error.message}`,
          type: 'ERROR',
          correlationId,
          method,
          url,
          statusCode,
          duration,
          userId,
          ...domainIdentifiers,
          errorMessage: error.message,
          errorName: error.constructor?.name,
          stack: !isClientError ? error.stack : undefined,
        };

        if (statusCode < 500) {
          this.pinoLogger.warn(logPayload);
        } else {
          this.pinoLogger.error(logPayload);
        }

        return throwError(() => error);
      }),
    );
  }

  private extractDomainIdentifiers(request: Request): DomainIdentifiers {
    const identifiers: DomainIdentifiers = {};
    const params = (request as any).params || {};
    const body = (request as any).body || {};

    // Extract from route params
    if (params.savingsId) identifiers.savingsId = params.savingsId;
    if (params.proposalId) identifiers.proposalId = params.proposalId;
    if (params.userId) identifiers.userId = params.userId;
    if (params.referralCode) identifiers.referralCode = params.referralCode;
    if (params.transactionId) identifiers.transactionId = params.transactionId;

    // Extract from body for POST/PUT requests
    if (body.savingsId) identifiers.savingsId = body.savingsId;
    if (body.proposalId) identifiers.proposalId = body.proposalId;
    if (body.referralCode) identifiers.referralCode = body.referralCode;
    if (body.transactionId) identifiers.transactionId = body.transactionId;

    return identifiers;
  }
}
