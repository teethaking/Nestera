import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BlockchainReplayService } from './blockchain-replay.service';
import { CreateReplayJobDto, ReplayJobResponseDto } from './dto/replay.dto';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import {
  AuditAction,
  AuditResourceType,
} from '../../common/entities/audit-log.entity';

@ApiTags('admin/blockchain-replay')
@ApiBearerAuth()
@Controller('admin/blockchain/replay')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminBlockchainReplayController {
  constructor(private readonly replayService: BlockchainReplayService) {}

  @Post()
  @ApiOperation({ summary: 'Create a manual blockchain event replay job' })
  @ApiResponse({ status: 201, type: ReplayJobResponseDto })
  @AuditLog({
    action: AuditAction.CREATE,
    resourceType: AuditResourceType.SYSTEM,
    description: 'Admin requested blockchain replay',
  })
  async createReplayJob(
    @Body() dto: CreateReplayJobDto,
    @CurrentUser() user: { id: string },
  ) {
    const job = await this.replayService.createReplayJob(dto, user.id);
    return this.replayService.toProgress(job);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get replay job status and progress' })
  @ApiResponse({ status: 200, type: ReplayJobResponseDto })
  async getReplayJob(@Param('id') id: string) {
    const job = await this.replayService.getReplayJob(id);
    return this.replayService.toProgress(job);
  }
}
