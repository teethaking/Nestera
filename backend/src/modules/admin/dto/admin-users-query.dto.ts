import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../common/dto/page-options.dto';

export class AdminUsersQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @IsOptional()
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: 'Opaque cursor for cursor-based pagination',
    example: 'eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInRpc3RhbG1lc3NhZzojVHJhbnNhY3Rpb24ifQ==',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Set to true to include totalCount metadata',
    default: false,
    example: 'true',
  })
  @IsOptional()
  @IsBooleanString()
  includeTotal?: string;

  @ApiPropertyOptional({ description: 'Search by name or email', example: 'john.doe@example.com' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['USER', 'ADMIN'], example: 'USER' })
  @IsEnum(['USER', 'ADMIN'])
  @IsOptional()
  role?: 'USER' | 'ADMIN';

  @ApiPropertyOptional({
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
    example: 'APPROVED',
  })
  @IsEnum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'])
  @IsOptional()
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'ISO 8601 — registrations from this date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  registeredFrom?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 — registrations up to this date',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsISO8601()
  @IsOptional()
  registeredTo?: string;

  @ApiPropertyOptional({
    enum: ['active', 'inactive'],
    description: 'Account status',
    example: 'active',
  })
  @IsEnum(['active', 'inactive'])
  @IsOptional()
  status?: 'active' | 'inactive';

  get skip(): number {
    return ((this.page ?? 1) - 1) * this.pageSize;
  }

  get pageSize(): number {
    const candidate = this.limit ?? DEFAULT_PAGE_SIZE;
    return Math.min(Math.max(candidate, 1), MAX_PAGE_SIZE);
  }

  get shouldIncludeTotal(): boolean {
    return String(this.includeTotal).toLowerCase() === 'true';
  }
}
