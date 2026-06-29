import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import {
  OBSERVABILITY_DASHBOARDS,
  DashboardConfig,
  PanelConfig,
  MetricQuery,
} from './observability-dashboard.config';

@Injectable()
export class ObservabilityDashboardService {
  private readonly logger = new Logger(ObservabilityDashboardService.name);

  constructor(private readonly metrics: MetricsService) {}

  getDashboard(id: string): DashboardConfig | undefined {
    return OBSERVABILITY_DASHBOARDS.find((d) => d.id === id);
  }

  getAllDashboards(): DashboardConfig[] {
    return OBSERVABILITY_DASHBOARDS;
  }

  async getPanelData(
    panel: PanelConfig,
    timeRange: { start: Date; end: Date },
  ) {
    const query = panel.query;
    const data = this.executeQuery(query, timeRange);

    return {
      panelId: panel.id,
      title: panel.title,
      type: panel.type,
      data,
    };
  }

  private executeQuery(
    query: MetricQuery,
    timeRange: { start: Date; end: Date },
  ) {
    const metricData = this.metrics.getMetrics(query.metric, timeRange);
    const histogramData = this.metrics.getHistogram(query.metric, timeRange);

    let result: any[] = [];

    if (query.aggregation === 'percentile') {
      const percentiles = this.metrics.calculatePercentiles(
        query.metric,
        query.filters?.percentile
          ? [parseInt(query.filters.percentile)]
          : [50, 95, 99],
      );
      result = Object.entries(percentiles).map(([p, value]) => ({
        percentile: p,
        value,
      }));
    } else if (query.aggregation === 'sum') {
      const filtered = this.applyFilters(metricData, query.filters);
      const grouped = this.groupBy(filtered, query.groupBy);
      result = Object.entries(grouped).map(([key, values]) => ({
        group: key,
        value: values.reduce((sum, m) => sum + m.value, 0),
      }));
    } else if (query.aggregation === 'avg') {
      const filtered = this.applyFilters(histogramData, query.filters);
      const grouped = this.groupBy(filtered, query.groupBy);
      result = Object.entries(grouped).map(([key, values]) => ({
        group: key,
        value: values.reduce((sum, h) => sum + h.value, 0) / values.length,
      }));
    } else if (query.aggregation === 'count') {
      const filtered = this.applyFilters(metricData, query.filters);
      const grouped = this.groupBy(filtered, query.groupBy);
      result = Object.entries(grouped).map(([key, values]) => ({
        group: key,
        value: values.length,
      }));
    }

    return result;
  }

  private applyFilters(data: any[], filters?: Record<string, string>): any[] {
    if (!filters) return data;

    return data.filter((item) => {
      return Object.entries(filters).every(([key, value]) => {
        return item.tags?.[key] === value;
      });
    });
  }

  private groupBy(data: any[], groupBy?: string[]): Record<string, any[]> {
    if (!groupBy || groupBy.length === 0) {
      return { all: data };
    }

    const grouped: Record<string, any[]> = {};

    for (const item of data) {
      const key = groupBy
        .map((field) => item.tags?.[field] || 'unknown')
        .join(':');

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped;
  }

  getDashboardDocumentation(): string {
    return `
# Observability Dashboards Documentation

## Available Dashboards

### 1. API Latency Dashboard
- **ID**: api-latency
- **Description**: Shows latency percentiles (p50, p95, p99) by endpoint
- **Metrics**: http_request_duration_seconds
- **Usage**: Monitor API response times and identify slow endpoints

### 2. Error Rate Dashboard
- **ID**: error-rate
- **Description**: Error rate breakdown by endpoint and error code
- **Metrics**: http_requests_total
- **Usage**: Track error rates and identify problematic endpoints

### 3. Dependency Performance Dashboard
- **ID**: dependency-performance
- **Description**: Dependency call latency and failures
- **Metrics**: dependency_call_duration_seconds, dependency_calls_total
- **Usage**: Monitor external service performance and availability

### 4. Queue Job Performance Dashboard
- **ID**: queue-performance
- **Description**: Queue job durations and throughput
- **Metrics**: queue_job_duration_seconds, queue_jobs_processed_total, queue_depth
- **Usage**: Monitor background job performance and queue health

## Metrics Instrumentation

To add metrics to your code:

\`\`\`typescript
import { MetricsService } from './common/metrics/metrics.service';

// In your service or controller
constructor(private readonly metrics: MetricsService) {}

// Record request duration
this.metrics.recordHistogram('http_request_duration_seconds', duration, {
  endpoint: '/api/users',
  method: 'GET',
});

// Increment request counter
this.metrics.incrementCounter('http_requests_total', 1, {
  endpoint: '/api/users',
  method: 'GET',
  status: 'success',
});

// Record error
this.metrics.incrementCounter('http_requests_total', 1, {
  endpoint: '/api/users',
  method: 'GET',
  status: 'error',
  error_code: '500',
});
\`\`\`

## Accessing Dashboards

Use the ObservabilityDashboardService to fetch dashboard data:

\`\`\`typescript
const dashboard = dashboardService.getDashboard('api-latency');
const panelData = await dashboardService.getPanelData(panel, {
  start: new Date(Date.now() - 3600000),
  end: new Date(),
});
\`\`\`
`;
  }
}
