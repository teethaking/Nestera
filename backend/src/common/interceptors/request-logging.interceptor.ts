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
import { randomUUID } from 'crypto';
import { Logger } from 'nestjs-pino';
import { LogSanitizerService } from '../services/log-sanitizer.service';
import { ApmService } from '../../modules/apm/apm.service';

const SKIP_LOG_PATHS = new Set([
  '/api/health',
  '/api/metrics',
  '/api/v1/health',
  '/api/v2/health',
  '/favicon.ico',
]);

const isErrorStatus = (status: number) => status >= 400;

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
      randomUUID();

    const startTime = Date.now();
    const { method, ip } = request;
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

    this.pinoLogger.log({
      msg: `→ ${method} ${url}`,
      type: 'REQUEST',
      correlationId,
      method,
      url,
      ip,
      userId,
      address: address ? this.sanitizer?.maskAddress(address) : undefined,
      userAgent: request.headers['user-agent'],
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

        this.apmService?.trackHttpRequest(
          method,
          rawPath,
          statusCode,
          duration,
        );

        const logPayload = {
          msg: `✗ ${method} ${url} ${statusCode} (${duration}ms) — ${error.message}`,
          type: 'ERROR',
          correlationId,
          method,
          url,
          statusCode,
          duration,
          userId,
          errorMessage: error.message,
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
}
