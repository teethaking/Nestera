import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { PageMetaDto } from './page-meta.dto';

export class PaginatedResponseDto<T> {
  @IsArray()
  @ApiProperty({ isArray: true, description: 'Items on the current page' })
  readonly items: T[];

  @ApiProperty({ type: () => PageMetaDto })
  readonly meta: PageMetaDto;

  constructor(items: T[], meta: PageMetaDto) {
    this.items = items;
    this.meta = meta;
  }
}

export class PageDto<T> {
  @IsArray()
  @ApiProperty({ isArray: true, description: 'Items on the current page' })
  readonly items: T[];

  @ApiProperty({ type: () => PageMetaDto })
  readonly meta: PageMetaDto;

  constructor(data: T[], meta: PageMetaDto) {
    this.items = data;
    this.meta = meta;
  }
}
