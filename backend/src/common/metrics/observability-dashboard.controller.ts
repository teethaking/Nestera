import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ObservabilityDashboardService } from './observability-dashboard.service';

@ApiTags('observability')
@Controller('observability')
export class ObservabilityDashboardController {
  constructor(
    private readonly dashboardService: ObservabilityDashboardService,
  ) {}

  @Get('dashboards')
  @ApiOperation({ summary: 'Get all available dashboards' })
  @ApiResponse({ status: 200, description: 'List of dashboards' })
  getAllDashboards() {
    return this.dashboardService.getAllDashboards();
  }

  @Get('dashboards/:id')
  @ApiOperation({ summary: 'Get specific dashboard by ID' })
  @ApiResponse({ status: 200, description: 'Dashboard configuration' })
  getDashboard(@Query('id') id: string) {
    return this.dashboardService.getDashboard(id);
  }

  @Get('panel-data')
  @ApiOperation({ summary: 'Get panel data for a specific panel' })
  @ApiResponse({ status: 200, description: 'Panel data' })
  async getPanelData(
    @Query('panelId') panelId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    const timeRange = {
      start: new Date(start),
      end: new Date(end),
    };

    // Find panel by ID (simplified - in production, you'd want proper panel lookup)
    const dashboards = this.dashboardService.getAllDashboards();
    let panel;
    for (const dashboard of dashboards) {
      panel = dashboard.panels.find((p) => p.id === panelId);
      if (panel) break;
    }

    if (!panel) {
      return { error: 'Panel not found' };
    }

    return this.dashboardService.getPanelData(panel, timeRange);
  }

  @Get('documentation')
  @ApiOperation({ summary: 'Get observability documentation' })
  @ApiResponse({ status: 200, description: 'Documentation text' })
  getDocumentation() {
    return {
      documentation: this.dashboardService.getDashboardDocumentation(),
    };
  }
}
