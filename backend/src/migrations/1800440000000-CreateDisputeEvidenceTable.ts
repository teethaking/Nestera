import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDisputeEvidenceTable1800440000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for processing status
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE evidence_processing_status AS ENUM (
          'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'dispute_evidence',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'disputeId', type: 'uuid', isNullable: false },
          { name: 'originalFilename', type: 'varchar', isNullable: false },
          { name: 'storagePath', type: 'varchar', isNullable: false },
          { name: 'mimeType', type: 'varchar', isNullable: false },
          { name: 'fileSize', type: 'int', isNullable: false },
          { name: 'uploadedBy', type: 'varchar', isNullable: false },
          {
            name: 'processingStatus',
            type: 'evidence_processing_status',
            default: "'PENDING'",
            isNullable: false,
          },
          { name: 'jobId', type: 'varchar', isNullable: true },
          { name: 'processingError', type: 'text', isNullable: true },
          { name: 'processingMetadata', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'dispute_evidence',
      new TableForeignKey({
        columnNames: ['disputeId'],
        referencedTableName: 'disputes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'dispute_evidence',
      new TableIndex({
        name: 'IDX_DISPUTE_EVIDENCE_DISPUTE_ID',
        columnNames: ['disputeId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('dispute_evidence');
    await queryRunner.query(
      `DROP TYPE IF EXISTS evidence_processing_status;`,
    );
  }
}
