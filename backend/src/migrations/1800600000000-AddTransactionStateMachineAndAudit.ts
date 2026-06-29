import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionStateMachineAndAudit1800600000000
  implements MigrationInterface
{
  name = 'AddTransactionStateMachineAndAudit1800600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'CREATED';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'PENDING_CONFIRMATION';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'CONFIRMED';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'REVERSED';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'DISPUTED';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ALTER COLUMN "status" SET DEFAULT 'CREATED';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transaction_status_transitions" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "transactionId" UUID NOT NULL,
        "fromStatus" "transactions_status_enum",
        "toStatus" "transactions_status_enum" NOT NULL,
        "actor" VARCHAR(128) NOT NULL DEFAULT 'system',
        "reason" VARCHAR(255),
        "metadata" JSONB,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transaction_status_transitions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transaction_status_transitions_transaction" FOREIGN KEY ("transactionId")
          REFERENCES "transactions"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transaction_status_transitions_tx_created"
      ON "transaction_status_transitions" ("transactionId", "createdAt");
    `);

    await queryRunner.query(`
      INSERT INTO "transaction_status_transitions" ("transactionId", "fromStatus", "toStatus", "actor", "reason", "metadata")
      SELECT t."id", NULL, t."status", 'migration', 'Initial backfill of current transaction status', NULL
      FROM "transactions" t
      WHERE NOT EXISTS (
        SELECT 1
        FROM "transaction_status_transitions" s
        WHERE s."transactionId" = t."id"
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_transaction_status_transitions_tx_created";
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "transaction_status_transitions";
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
      ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
    `);
  }
}
