import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ProcessedStellarEvent } from '../blockchain/entities/processed-event.entity';
import { SavingsService as BlockchainSavingsService } from '../blockchain/savings.service';
import { PortfolioTimeframe } from './dto/portfolio-timeline-query.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ProcessedStellarEvent)
    private readonly eventRepository: Repository<ProcessedStellarEvent>,
    private readonly blockchainSavingsService: BlockchainSavingsService,
  ) {}

  async getPortfolioTimeline(userId: string, timeframe: PortfolioTimeframe) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'publicKey'],
    });

    if (!user || !user.publicKey) {
      return [];
    }

    // 1. Get current balance (anchor)
    const currentSavings = await this.blockchainSavingsService.getUserSavingsBalance(user.publicKey);
    const currentTotal = currentSavings.total;

    // 2. Define intervals based on timeframe
    const now = new Date();
    let startDate: Date;
    let intervalMs: number;
    let points: number;

    switch (timeframe) {
      case PortfolioTimeframe.DAY:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        intervalMs = 60 * 60 * 1000; // 1 hour
        points = 24;
        break;
      case PortfolioTimeframe.WEEK:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
        points = 7;
        break;
      case PortfolioTimeframe.MONTH:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
        points = 30;
        break;
      case PortfolioTimeframe.YTD:
        startDate = new Date(now.getFullYear(), 0, 1);
        intervalMs = 24 * 60 * 60 * 1000; // 1 day
        points = Math.ceil((now.getTime() - startDate.getTime()) / intervalMs);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        intervalMs = 24 * 60 * 60 * 1000;
        points = 7;
    }

    // 3. Fetch all events for the user in this timeframe
    // We filter events where the user's public key is involved.
    // In a real Soroban contract, the user's public key is encoded in topics.
    // For this implementation, we assume the listener records these events and 
    // we use a broad query or specific JSONB filtering if available.
    
    const events = await this.eventRepository.find({
      where: {
        processedAt: Between(startDate, now),
        // Simplification: In a real system, we'd use JSONB filter to match user public key
        // eventData: Raw(alias => `${alias} @> '{"topics": ["${user.publicKey}"]}'`)
      },
      order: { processedAt: 'DESC' },
    });

    // Mock filtering for the user (since we can't easily do JSONB @> with TypeORM find without Raw)
    // In production, this logic would be in the database query.
    const userEvents = events.filter(event => {
        const xdr = JSON.stringify(event.eventData);
        return xdr.includes(user.publicKey!);
    });

    // 4. Group events by period and calculate net change per period
    const timeline: { date: string; value: number }[] = [];
    let runningBalance = currentTotal;

    // Generate intervals
    for (let i = 0; i < points; i++) {
        const periodEnd = new Date(now.getTime() - i * intervalMs);
        const periodStart = new Date(now.getTime() - (i + 1) * intervalMs);

        // Find events in this period
        const periodEvents = userEvents.filter(e => 
            e.processedAt <= periodEnd && e.processedAt > periodStart
        );

        // Calculate net change in this period
        // NetChange = Sum(Deposits) + Sum(Interest) - Sum(Withdrawals)
        let netChange = 0;
        for (const event of periodEvents) {
            const amount = this.extractAmount(event);
            if (event.eventType.toLowerCase().includes('deposit') || 
                event.eventType.toLowerCase().includes('interest')) {
                netChange += amount;
            } else if (event.eventType.toLowerCase().includes('withdraw')) {
                netChange -= amount;
            }
        }

        timeline.push({
            date: this.formatDate(periodEnd, timeframe),
            value: runningBalance,
        });

        // Update running balance for the previous period
        runningBalance -= netChange;
    }

    return timeline.reverse();
  }

  private extractAmount(event: ProcessedStellarEvent): number {
    try {
        // Assume amount is in eventData.value or one of the topics
        // This is a placeholder for real XDR decoding logic
        const data = event.eventData as any;
        return data.amount || 0; 
    } catch (e) {
        return 0;
    }
  }

  private formatDate(date: Date, timeframe: PortfolioTimeframe): string {
    if (timeframe === PortfolioTimeframe.DAY) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
  }
}
