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
export class DependencyMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DependencyMetricsInterceptor.name);

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    const dependencyName = `${className}.${handlerName}`;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        // Record dependency call duration
        this.metrics.recordHistogram(
          'dependency_call_duration_seconds',
          duration / 1000,
          {
            dependency_name: dependencyName,
            status: 'success',
          },
        );

        // Increment dependency call counter
        this.metrics.incrementCounter('dependency_calls_total', 1, {
          dependency_name: dependencyName,
          status: 'success',
        });

        this.logger.debug(
          `Dependency metrics recorded: ${dependencyName} - ${duration}ms`,
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const errorCode = error.code || 'DEPENDENCY_ERROR';

        // Record error duration
        this.metrics.recordHistogram(
          'dependency_call_duration_seconds',
          duration / 1000,
          {
            dependency_name: dependencyName,
            status: 'error',
            error_code: errorCode,
          },
        );

        // Increment error counter
        this.metrics.incrementCounter('dependency_calls_total', 1, {
          dependency_name: dependencyName,
          status: 'error',
          error_code: errorCode,
        });

        this.logger.error(
          `Dependency error metrics recorded: ${dependencyName} - ${errorCode} - ${duration}ms`,
        );
        throw error;
      }),
    );
  }
}
