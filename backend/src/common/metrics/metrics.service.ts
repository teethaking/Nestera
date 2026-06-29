import { Injectable, Logger } from '@nestjs/common';

interface MetricData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

interface HistogramData {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: Date;
}

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metrics: Map<string, MetricData[]> = new Map();
  private histograms: Map<string, HistogramData[]> = new Map();

  incrementCounter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>,
  ) {
    const metric: MetricData = {
      name,
      value,
      tags,
      timestamp: new Date(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);
    this.logger.debug(`Counter incremented: ${name} +${value}`);
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>) {
    const histogram: HistogramData = {
      name,
      value,
      tags,
      timestamp: new Date(),
    };

    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    this.histograms.get(name)!.push(histogram);
    this.logger.debug(`Histogram recorded: ${name} = ${value}`);
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>) {
    const metric: MetricData = {
      name,
      value,
      tags,
      timestamp: new Date(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);
    this.logger.debug(`Gauge recorded: ${name} = ${value}`);
  }

  getMetrics(
    name: string,
    timeRange?: { start: Date; end: Date },
  ): MetricData[] {
    const data = this.metrics.get(name) || [];
    if (!timeRange) return data;

    return data.filter(
      (m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end,
    );
  }

  getHistogram(
    name: string,
    timeRange?: { start: Date; end: Date },
  ): HistogramData[] {
    const data = this.histograms.get(name) || [];
    if (!timeRange) return data;

    return data.filter(
      (h) => h.timestamp >= timeRange.start && h.timestamp <= timeRange.end,
    );
  }

  calculatePercentiles(
    name: string,
    percentiles: number[],
  ): Record<number, number> {
    const data = this.histograms.get(name) || [];
    if (data.length === 0) return {};

    const values = data.map((h) => h.value).sort((a, b) => a - b);
    const result: Record<number, number> = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * values.length) - 1;
      result[p] = values[index] || 0;
    }

    return result;
  }

  calculateRate(name: string, timeRange: { start: Date; end: Date }): number {
    const data = this.getMetrics(name, timeRange);
    const durationMs = timeRange.end.getTime() - timeRange.start.getTime();
    const durationSec = durationMs / 1000;

    const total = data.reduce((sum, m) => sum + m.value, 0);
    return total / durationSec;
  }

  getErrorRate(
    endpoint: string,
    timeRange: { start: Date; end: Date },
  ): number {
    const errors = this.getMetrics('http_requests_total', timeRange).filter(
      (m) => m.tags?.endpoint === endpoint && m.tags?.status === 'error',
    );
    const total = this.getMetrics('http_requests_total', timeRange).filter(
      (m) => m.tags?.endpoint === endpoint,
    );

    if (total.length === 0) return 0;
    const errorCount = errors.reduce((sum, m) => sum + m.value, 0);
    const totalCount = total.reduce((sum, m) => sum + m.value, 0);
    return (errorCount / totalCount) * 100;
  }

  clearMetrics(name?: string) {
    if (name) {
      this.metrics.delete(name);
      this.histograms.delete(name);
    } else {
      this.metrics.clear();
      this.histograms.clear();
    }
  }
}
