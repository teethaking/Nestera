import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { PortfolioTimelineQueryDto } from './dto/portfolio-timeline-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('portfolio')
  @ApiOperation({ 
    summary: 'Generate portfolio net worth timeline',
    description: 'Returns a time-series dataset of user balances for chart visualization.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Chronological array of portfolio value over time',
    schema: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                date: { type: 'string', example: 'Oct 25, 2023' },
                value: { type: 'number', example: 124500.00 }
            }
        }
    }
  })
  async getPortfolioTimeline(
    @Request() req,
    @Query() query: PortfolioTimelineQueryDto,
  ) {
    return this.analyticsService.getPortfolioTimeline(req.user.id, query.timeframe);
  }
}
