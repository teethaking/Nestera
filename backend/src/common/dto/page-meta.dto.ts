import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
export interface PageMetaDtoParameters {
  pageOptionsDto: {
    page?: number;
    pageSize?: number;
  };
  totalItemCount?: number;
  nextCursor?: string | null;
}

export class PageMetaDto {
  @ApiProperty({ description: 'Current page number (1-based)' })
  readonly page: number;

  @ApiProperty({ description: 'Number of items per page' })
  readonly pageSize: number;

  @ApiPropertyOptional({ description: 'Maximum allowed page size' })
  readonly take?: number;

  @ApiProperty({ description: 'Total number of items matching the query' })
  readonly totalItemCount?: number;

  @ApiProperty({ description: 'Alias for totalItemCount', required: false })
  readonly totalCount?: number;

  @ApiProperty({ description: 'Total number of pages' })
  readonly pageCount: number | null;

  @ApiProperty({ description: 'Whether there is a previous page' })
  readonly hasPreviousPage: boolean;

  @ApiProperty({ description: 'Whether there is a next page' })
  readonly hasNextPage: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Cursor token for fetching the next page',
  })
  readonly nextCursor: string | null;

  constructor({
    pageOptionsDto,
    totalItemCount,
    nextCursor,
  }: PageMetaDtoParameters) {
    this.page = pageOptionsDto.page ?? 1;
    this.pageSize = pageOptionsDto.pageSize ?? 10;
    this.take = pageOptionsDto.pageSize ?? 10;
    this.totalItemCount = totalItemCount;
    this.totalCount = totalItemCount;
    this.pageCount =
      typeof totalItemCount === 'number'
        ? Math.ceil(totalItemCount / this.pageSize)
        : null;
    this.hasPreviousPage = this.page > 1;
    this.nextCursor = nextCursor ?? null;
    this.hasNextPage =
      typeof totalItemCount === 'number'
        ? this.page < (this.pageCount ?? 0)
        : Boolean(this.nextCursor);
  }
}
