import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Patch,
  Param,
  Body,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { format as csvFormat } from '@fast-csv/format';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminExportService } from './services/admin-export.service';
import { AdminTransactionFilterDto } from './dto/admin-transaction-filter.dto';
import {
  AdminExportJobResponseDto,
  AdminTransactionExportRequestDto,
} from './dto/admin-export.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageOptionsDto } from '../../common/dto/page-options.dto';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SuspiciousTransactionDto } from './dto/suspicious-transaction.dto';
import { TransactionStatsQueryDto } from './dto/transaction-stats-query.dto';
import { TransactionStatsDto } from './dto/transaction-stats.dto';
import { FlagTransactionDto } from './dto/flag-transaction.dto';
import { AddAdminNoteDto } from './dto/add-admin-note.dto';
import { AdminTransactionNote } from './entities/admin-transaction-note.entity';

@ApiTags('admin')
@Controller('admin/transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST)
@ApiBearerAuth()
export class AdminTransactionsController {
  constructor(
    private readonly adminTransactionsService: AdminTransactionsService,
    private readonly adminExportService: AdminExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all transactions with advanced filtering' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
    type: PageDto<Transaction>,
  })
  async listTransactions(
    @Query() query: AdminTransactionFilterDto,
  ): Promise<PageDto<Transaction>> {
    return this.adminTransactionsService.findAll(query);
  }

  @Get('suspicious')
  @ApiOperation({ summary: 'List suspicious transactions' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of suspicious transactions',
    type: PageDto<SuspiciousTransactionDto>,
  })
  async listSuspicious(
    @Query() query: PageOptionsDto,
  ): Promise<PageDto<SuspiciousTransactionDto>> {
    return this.adminTransactionsService.findSuspicious(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiResponse({
    status: 200,
    description: 'Transaction statistics grouped by period and type',
    type: [TransactionStatsDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - period parameter missing or invalid',
  })
  async getStats(
    @Query() query: TransactionStatsQueryDto,
  ): Promise<TransactionStatsDto[]> {
    return this.adminTransactionsService.getStats(query);
  }

  @Get('export')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST)
  @ApiOperation({ summary: 'Export transactions to CSV' })
  @ApiResponse({
    status: 200,
    description: 'CSV file containing filtered transactions',
  })
  async exportCsv(
    @Query() query: AdminTransactionFilterDto,
    @CurrentUser() user: { id: string; role: Role },
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="admin_transactions_export.csv"',
    );

    const csvStream = csvFormat({ headers: true, quoteColumns: true });
    csvStream.pipe(res);

    await this.adminExportService.streamTransactionsCsv(
      user.role,
      query,
      csvStream,
    );
  }

  @Post('export/async')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST)
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent({ ttlSeconds: 86400 })
  @ApiOperation({ summary: 'Queue an async transactions CSV export job' })
  @ApiResponse({
    status: 202,
    description: 'Export job accepted for processing',
    type: AdminExportJobResponseDto,
  })
  async exportAsync(
    @Body() body: AdminTransactionExportRequestDto,
    @CurrentUser() user: { id: string; role: Role },
  ): Promise<AdminExportJobResponseDto> {
    return this.adminExportService.requestTransactionsExportJob(
      user.id,
      user.role,
      body,
    );
  }

  @Get('export/jobs/:jobId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST)
  @ApiOperation({ summary: 'Get transactions export job status' })
  @ApiParam({ name: 'jobId', description: 'Export job UUID' })
  @ApiResponse({
    status: 200,
    description: 'Export job status',
    type: AdminExportJobResponseDto,
  })
  async getExportJobStatus(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string },
  ): Promise<AdminExportJobResponseDto> {
    return this.adminExportService.getExportJobStatus(user.id, jobId);
  }

  @Get('export/jobs/:jobId/download')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.ANALYST)
  @ApiOperation({ summary: 'Download a completed transactions export job' })
  @ApiParam({ name: 'jobId', description: 'Export job UUID' })
  @ApiResponse({ status: 200, description: 'CSV export file download' })
  async downloadExportJob(
    @Param('jobId') jobId: string,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ): Promise<void> {
    const download = await this.adminExportService.getExportJobDownload(
      user.id,
      jobId,
    );

    res.setHeader('Content-Type', download.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${download.fileName}"`,
    );
    res.sendFile(download.filePath);
  }

  @Patch(':id/flag')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Flag a transaction for review' })
  @ApiResponse({
    status: 200,
    description: 'Transaction flagged successfully',
    type: Transaction,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async flagTransaction(
    @Param('id') id: string,
    @Body() body: FlagTransactionDto,
  ): Promise<Transaction> {
    return this.adminTransactionsService.flagTransaction(id, body.flagged);
  }

  @Post(':id/notes')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(201)
  @Idempotent({ ttlSeconds: 86400 })
  @ApiOperation({ summary: 'Add an admin note to a transaction' })
  @ApiResponse({
    status: 201,
    description: 'Admin note created successfully',
    type: AdminTransactionNote,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async addNote(
    @Param('id') id: string,
    @Body() body: AddAdminNoteDto,
    @CurrentUser() user: any,
  ): Promise<AdminTransactionNote> {
    return this.adminTransactionsService.addNote(id, user.id, body.content);
  }
}
