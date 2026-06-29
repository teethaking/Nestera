import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MetricsInterceptor.name);

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const endpoint = this.getEndpoint(request);
    const method = request.method;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Record request duration
        this.metrics.recordHistogram(
          'http_request_duration_seconds',
          duration / 1000,
          {
            endpoint,
            method,
            status: statusCode.toString(),
          },
        );

        // Increment request counter
        this.metrics.incrementCounter('http_requests_total', 1, {
          endpoint,
          method,
          status: statusCode < 400 ? 'success' : 'error',
          status_code: statusCode.toString(),
        });

        this.logger.debug(
          `Request metrics recorded: ${method} ${endpoint} - ${statusCode} - ${duration}ms`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        const errorCode = error.code || 'INTERNAL_ERROR';

        // Record error duration
        this.metrics.recordHistogram(
          'http_request_duration_seconds',
          duration / 1000,
          {
            endpoint,
            method,
            status: 'error',
            error_code: errorCode,
          },
        );

        // Increment error counter
        this.metrics.incrementCounter('http_requests_total', 1, {
          endpoint,
          method,
          status: 'error',
          status_code: statusCode.toString(),
          error_code: errorCode,
        });

        // Increment error count by error code
        this.metrics.incrementCounter('http_errors_total', 1, {
          endpoint,
          method,
          error_code: errorCode,
          status_code: statusCode.toString(),
        });

        this.logger.error(
          `Request error metrics recorded: ${method} ${endpoint} - ${errorCode} - ${duration}ms`,
        );
        throw error;
      }),
    );
  }

  private getEndpoint(request: any): string {
    return request.route?.path || request.url || 'unknown';
  }
}
