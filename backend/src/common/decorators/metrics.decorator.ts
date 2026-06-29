import { SetMetadata } from '@nestjs/common';

export const METRICS_KEY = 'metrics';

export interface MetricsOptions {
  trackDependency?: boolean;
  customLabels?: Record<string, string>;
}

export const Metrics = (options: MetricsOptions = {}) =>
  SetMetadata(METRICS_KEY, options);
