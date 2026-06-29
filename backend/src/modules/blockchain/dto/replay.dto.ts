import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReplayJobMode } from '../entities/blockchain-replay-job.entity';

export class CreateReplayJobDto {
  @ApiProperty({ enum: ReplayJobMode })
  @IsEnum(ReplayJobMode)
  mode: ReplayJobMode;

  @ApiPropertyOptional({
    description: 'Start ledger (inclusive) for ledger_range mode',
  })
  @ValidateIf((o) => o.mode === ReplayJobMode.LEDGER_RANGE)
  @IsInt()
  @Min(0)
  startLedger?: number;

  @ApiPropertyOptional({
    description: 'End ledger (inclusive) for ledger_range mode',
  })
  @ValidateIf((o) => o.mode === ReplayJobMode.LEDGER_RANGE)
  @IsInt()
  @Min(0)
  endLedger?: number;

  @ApiPropertyOptional({ description: 'Event cursor for event_cursor mode' })
  @ValidateIf((o) => o.mode === ReplayJobMode.EVENT_CURSOR)
  @IsString()
  eventCursor?: string;

  @ApiPropertyOptional({
    description: 'Optional end ledger when replaying from cursor',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  endLedgerForCursor?: number;
}

export class ReplayJobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: ReplayJobMode })
  mode: ReplayJobMode;

  @ApiProperty()
  status: string;

  @ApiProperty()
  eventsProcessed: number;

  @ApiProperty()
  eventsFailed: number;

  @ApiProperty()
  eventsSkipped: number;

  @ApiProperty()
  totalEvents: number;

  @ApiPropertyOptional()
  lastError?: string | null;

  @ApiProperty()
  progressPercent: number;
}
