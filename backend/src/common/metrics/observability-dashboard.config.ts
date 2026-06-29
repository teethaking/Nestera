export interface DashboardConfig {
  id: string;
  title: string;
  description: string;
  panels: PanelConfig[];
}

export interface PanelConfig {
  id: string;
  title: string;
  type: 'graph' | 'stat' | 'table' | 'heatmap';
  query: MetricQuery;
  visualization?: {
    yAxis?: string;
    xAxis?: string;
    color?: string;
  };
}

export interface MetricQuery {
  metric: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'percentile';
  filters?: Record<string, string>;
  groupBy?: string[];
  timeRange?: string;
}

export const OBSERVABILITY_DASHBOARDS: DashboardConfig[] = [
  {
    id: 'api-latency',
    title: 'API Latency Dashboard',
    description: 'Latency percentiles by endpoint',
    panels: [
      {
        id: 'p50-latency',
        title: 'p50 Latency by Endpoint',
        type: 'graph',
        query: {
          metric: 'http_request_duration_seconds',
          aggregation: 'percentile',
          filters: { percentile: '50' },
          groupBy: ['endpoint'],
          timeRange: '1h',
        },
      },
      {
        id: 'p95-latency',
        title: 'p95 Latency by Endpoint',
        type: 'graph',
        query: {
          metric: 'http_request_duration_seconds',
          aggregation: 'percentile',
          filters: { percentile: '95' },
          groupBy: ['endpoint'],
          timeRange: '1h',
        },
      },
      {
        id: 'p99-latency',
        title: 'p99 Latency by Endpoint',
        type: 'graph',
        query: {
          metric: 'http_request_duration_seconds',
          aggregation: 'percentile',
          filters: { percentile: '99' },
          groupBy: ['endpoint'],
          timeRange: '1h',
        },
      },
    ],
  },
  {
    id: 'error-rate',
    title: 'Error Rate Dashboard',
    description: 'Error rate breakdown by endpoint and error code',
    panels: [
      {
        id: 'error-rate-by-endpoint',
        title: 'Error Rate by Endpoint',
        type: 'graph',
        query: {
          metric: 'http_requests_total',
          aggregation: 'sum',
          filters: { status: 'error' },
          groupBy: ['endpoint'],
          timeRange: '1h',
        },
      },
      {
        id: 'error-code-breakdown',
        title: 'Error Code Breakdown',
        type: 'table',
        query: {
          metric: 'http_requests_total',
          aggregation: 'count',
          filters: { status: 'error' },
          groupBy: ['error_code'],
          timeRange: '1h',
        },
      },
      {
        id: 'total-errors',
        title: 'Total Errors',
        type: 'stat',
        query: {
          metric: 'http_requests_total',
          aggregation: 'sum',
          filters: { status: 'error' },
          timeRange: '1h',
        },
      },
    ],
  },
  {
    id: 'dependency-performance',
    title: 'Dependency Performance Dashboard',
    description: 'Dependency call latency and failures',
    panels: [
      {
        id: 'dependency-latency',
        title: 'Dependency Call Latency',
        type: 'graph',
        query: {
          metric: 'dependency_call_duration_seconds',
          aggregation: 'avg',
          groupBy: ['dependency_name'],
          timeRange: '1h',
        },
      },
      {
        id: 'dependency-failures',
        title: 'Dependency Failures',
        type: 'graph',
        query: {
          metric: 'dependency_calls_total',
          aggregation: 'sum',
          filters: { status: 'error' },
          groupBy: ['dependency_name'],
          timeRange: '1h',
        },
      },
      {
        id: 'dependency-success-rate',
        title: 'Dependency Success Rate',
        type: 'graph',
        query: {
          metric: 'dependency_calls_total',
          aggregation: 'sum',
          filters: { status: 'success' },
          groupBy: ['dependency_name'],
          timeRange: '1h',
        },
      },
    ],
  },
  {
    id: 'queue-performance',
    title: 'Queue Job Performance Dashboard',
    description: 'Queue job durations and throughput',
    panels: [
      {
        id: 'job-duration',
        title: 'Job Duration by Queue',
        type: 'graph',
        query: {
          metric: 'queue_job_duration_seconds',
          aggregation: 'avg',
          groupBy: ['queue_name'],
          timeRange: '1h',
        },
      },
      {
        id: 'job-throughput',
        title: 'Job Throughput',
        type: 'graph',
        query: {
          metric: 'queue_jobs_processed_total',
          aggregation: 'sum',
          groupBy: ['queue_name'],
          timeRange: '1h',
        },
      },
      {
        id: 'job-failures',
        title: 'Job Failures',
        type: 'graph',
        query: {
          metric: 'queue_jobs_failed_total',
          aggregation: 'sum',
          groupBy: ['queue_name'],
          timeRange: '1h',
        },
      },
      {
        id: 'queue-depth',
        title: 'Queue Depth',
        type: 'stat',
        query: {
          metric: 'queue_depth',
          aggregation: 'sum',
          groupBy: ['queue_name'],
          timeRange: '5m',
        },
      },
    ],
  },
];
