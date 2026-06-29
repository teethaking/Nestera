import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum Order {
  ASC = 'ASC',
  DESC = 'DESC',
}

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export class PageOptionsDto {
  @ApiPropertyOptional({ enum: Order, default: Order.ASC })
  @IsEnum(Order)
  @IsOptional()
  readonly order?: Order = Order.ASC;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  readonly page?: number = 1;

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
  readonly limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({
    description: 'Opaque cursor for cursor-based pagination',
  })
  @IsOptional()
  @IsString()
  readonly cursor?: string;

  @ApiPropertyOptional({
    description: 'Set to true to include totalCount metadata',
    default: false,
  })
  @IsOptional()
  @IsBooleanString()
  readonly includeTotal?: string;

  get pageSize(): number {
    const candidate = this.limit ?? DEFAULT_PAGE_SIZE;
    return Math.min(Math.max(candidate, 1), MAX_PAGE_SIZE);
  }

  /** Calculated offset for the database query */
  get skip(): number {
    return ((this.page ?? 1) - 1) * this.pageSize;
  }

  get shouldIncludeTotal(): boolean {
    return String(this.includeTotal).toLowerCase() === 'true';
  }
}
