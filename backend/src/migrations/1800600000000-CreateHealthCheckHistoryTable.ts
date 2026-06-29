import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateHealthCheckHistoryTable1800600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'health_check_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'service',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'responseTime',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'checkedAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'health_check_records',
      new TableIndex({
        name: 'IDX_health_check_records_service_checkedAt',
        columnNames: ['service', 'checkedAt'],
      }),
    );

    await queryRunner.createIndex(
      'health_check_records',
      new TableIndex({
        name: 'IDX_health_check_records_checkedAt',
        columnNames: ['checkedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('health_check_records');
  }
}
