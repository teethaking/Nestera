import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBlockchainReplayJobs1800500000001 implements MigrationInterface {
  name = 'CreateBlockchainReplayJobs1800500000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'blockchain_replay_jobs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'mode',
            type: 'varchar',
            length: '32',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: `'pending'`,
          },
          {
            name: 'start_ledger',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'end_ledger',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'event_cursor',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'events_processed',
            type: 'int',
            default: 0,
          },
          {
            name: 'events_failed',
            type: 'int',
            default: 0,
          },
          {
            name: 'events_skipped',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_events',
            type: 'int',
            default: 0,
          },
          {
            name: 'lock_owner_id',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'requested_by_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'last_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'blockchain_replay_jobs',
      new TableIndex({
        name: 'idx_blockchain_replay_jobs_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('blockchain_replay_jobs');
  }
}
