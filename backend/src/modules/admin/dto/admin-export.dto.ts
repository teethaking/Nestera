import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminTransactionFilterDto } from './admin-transaction-filter.dto';
import { DisputeFilterDto } from './admin-dispute.dto';
import {
  AdminExportDataType,
  AdminExportStatus,
} from '../entities/admin-export-job.entity';

export class AdminTransactionExportRequestDto extends AdminTransactionFilterDto {}

export class AdminDisputeExportRequestDto extends DisputeFilterDto {}

export class AdminExportJobResponseDto {
  @ApiProperty()
  requestId!: string;

  @ApiProperty({ enum: AdminExportStatus })
  status!: AdminExportStatus;

  @ApiProperty({ enum: AdminExportDataType })
  dataType!: AdminExportDataType;

  @ApiPropertyOptional()
  fileName?: string;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  createdAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  expiresAt?: Date | null;
}
