import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAnalyticsAggregationJobsTable1800600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'analytics_aggregation_jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'aggregationType',
            type: 'varchar',
            length: '32',
          },
          {
            name: 'period',
            type: 'varchar',
            length: '16',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'pending'",
          },
          {
            name: 'startDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'endDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'isBackfill',
            type: 'boolean',
            default: false,
          },
          {
            name: 'backfillStatus',
            type: 'varchar',
            length: '32',
            isNullable: true,
          },
          {
            name: 'backfillStartDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'backfillEndDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'totalBackfillPeriods',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'processedBackfillPeriods',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'backfillProgress',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'queueJobId',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'result',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'recordsProcessed',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'recordsFailed',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'nextRetryAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'analytics_aggregation_jobs',
      new TableIndex({
        name: 'IDX_analytics_aggregation_jobs_aggregation_type_status',
        columnNames: ['aggregationType', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'analytics_aggregation_jobs',
      new TableIndex({
        name: 'IDX_analytics_aggregation_jobs_created_at',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'analytics_aggregation_jobs',
      new TableIndex({
        name: 'IDX_analytics_aggregation_jobs_is_backfill_backfill_status',
        columnNames: ['isBackfill', 'backfillStatus'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'analytics_aggregation_jobs',
      'IDX_analytics_aggregation_jobs_is_backfill_backfill_status',
    );
    await queryRunner.dropIndex(
      'analytics_aggregation_jobs',
      'IDX_analytics_aggregation_jobs_created_at',
    );
    await queryRunner.dropIndex(
      'analytics_aggregation_jobs',
      'IDX_analytics_aggregation_jobs_aggregation_type_status',
    );
    await queryRunner.dropTable('analytics_aggregation_jobs');
  }
}
