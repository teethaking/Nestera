import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export type RequestWithCorrelation = Request & {
  correlationId: string;
  requestId: string;
  startTime: number;
};

/**
 * Correlation ID Middleware
 *
 * Runs before every request to ensure:
 * - A unique correlation ID exists (from header or generated)
 * - The ID is attached to req.correlationId for use in all handlers
 * - The ID is forwarded in response headers for client tracing
 * - Request start time is recorded for duration calculation
 *
 * Clients can pre-set X-Correlation-ID to trace cross-service requests.
 * The same ID should be forwarded when making downstream service calls.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const reqWithCorrelation = req as RequestWithCorrelation;

    // Extract requestId from X-Request-ID header, or generate a unique UUID
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    reqWithCorrelation.requestId = requestId;

    // Extract correlationId from X-Correlation-ID header, default to requestId
    const correlationId =
      (req.headers['x-correlation-id'] as string) || requestId;
    reqWithCorrelation.correlationId = correlationId;
    reqWithCorrelation.startTime = Date.now();

    // Echo back in response headers — lowercase per HTTP/2 convention
    res.setHeader('x-correlation-id', correlationId);

    // Also expose in CORS if needed
    res.locals['correlationId'] = correlationId;

    next();
  }
}
