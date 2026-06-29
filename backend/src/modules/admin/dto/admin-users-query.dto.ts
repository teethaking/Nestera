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
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE_SIZE,
    default: DEFAULT_PAGE_SIZE,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @IsOptional()
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: 'Opaque cursor for cursor-based pagination',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Set to true to include totalCount metadata',
    default: false,
  })
  @IsOptional()
  @IsBooleanString()
  includeTotal?: string;

  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['USER', 'ADMIN'] })
  @IsEnum(['USER', 'ADMIN'])
  @IsOptional()
  role?: 'USER' | 'ADMIN';

  @ApiPropertyOptional({
    enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'],
  })
  @IsEnum(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'])
  @IsOptional()
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'ISO 8601 — registrations from this date',
  })
  @IsISO8601()
  @IsOptional()
  registeredFrom?: string;

  @ApiPropertyOptional({
    description: 'ISO 8601 — registrations up to this date',
  })
  @IsISO8601()
  @IsOptional()
  registeredTo?: string;

  @ApiPropertyOptional({
    enum: ['active', 'inactive'],
    description: 'Account status',
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
