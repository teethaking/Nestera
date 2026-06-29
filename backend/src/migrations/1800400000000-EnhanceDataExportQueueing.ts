import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceDataExportQueueing1800400000000
  implements MigrationInterface
{
  name = 'EnhanceDataExportQueueing1800400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "export_status_enum" ADD VALUE IF NOT EXISTS 'cancelled';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "data_export_requests" ADD COLUMN IF NOT EXISTS "queueJobId" VARCHAR(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_export_requests" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_data_export_queueJobId" ON "data_export_requests" ("queueJobId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_data_export_queueJobId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_export_requests" DROP COLUMN IF EXISTS "errorMessage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "data_export_requests" DROP COLUMN IF EXISTS "queueJobId"`,
    );
  }
}
