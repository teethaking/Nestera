import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
} from 'typeorm';

export class CreateProcessedReferralEventsTable1802722841000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'processed_referral_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'eventType',
            type: 'enum',
            enum: ['signup', 'first_deposit', 'referral_completed', 'reward_distribute'],
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'referralId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'campaignId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create unique indexes for idempotency
    await queryRunner.createIndex(
      'processed_referral_events',
      new TableIndex({
        name: 'IDX_PROCESSED_REFERRAL_EVENT_TYPE_USER',
        columnNames: ['eventType', 'userId'],
        isUnique: true,
        where: 'userId IS NOT NULL',
      }),
    );

    await queryRunner.createIndex(
      'processed_referral_events',
      new TableIndex({
        name: 'IDX_PROCESSED_REFERRAL_EVENT_TYPE_REFERRAL',
        columnNames: ['eventType', 'referralId'],
        isUnique: true,
        where: 'referralId IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('processed_referral_events');
  }
}
