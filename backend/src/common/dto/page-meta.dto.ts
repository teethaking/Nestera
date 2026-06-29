import { ApiProperty } from '@nestjs/swagger';
export interface PageMetaDtoParameters {
  pageOptionsDto: {
    page?: number;
    pageSize?: number;
  };
  totalItemCount?: number;
  nextCursor?: string | null;
}

export class PageMetaDto {
  @ApiProperty({ description: 'Current page number' })
  readonly page: number;

  @ApiProperty({ description: 'Number of items per page' })
  readonly limit: number;

  @ApiProperty({ description: 'Standardized page size field' })
  readonly pageSize: number;

  @ApiProperty({ description: 'Total number of items' })
  readonly totalItemCount?: number;

  @ApiProperty({ required: false, description: 'Optional total count field' })
  readonly totalCount?: number;

  @ApiProperty({ description: 'Total number of pages' })
  readonly pageCount: number | null;

  @ApiProperty({ description: 'Whether there is a previous page' })
  readonly hasPreviousPage: boolean;

  @ApiProperty({ description: 'Whether there is a next page' })
  readonly hasNextPage: boolean;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Cursor token for the next page',
  })
  readonly nextCursor: string | null;

  constructor({
    pageOptionsDto,
    totalItemCount,
    nextCursor,
  }: PageMetaDtoParameters) {
    this.page = pageOptionsDto.page ?? 1;
    this.limit = pageOptionsDto.pageSize ?? 10;
    this.pageSize = pageOptionsDto.pageSize ?? 10;
    this.totalItemCount = totalItemCount;
    this.totalCount = totalItemCount;
    this.pageCount =
      typeof totalItemCount === 'number'
        ? Math.ceil(totalItemCount / this.limit)
        : null;
    this.hasPreviousPage = this.page > 1;
    this.nextCursor = nextCursor ?? null;
    this.hasNextPage =
      typeof totalItemCount === 'number'
        ? this.page < (this.pageCount ?? 0)
        : Boolean(this.nextCursor);
  }
}
