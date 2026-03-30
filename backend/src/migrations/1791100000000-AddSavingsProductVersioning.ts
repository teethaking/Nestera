import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddSavingsProductVersioning1791100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('savings_products', [
      new TableColumn({
        name: 'version',
        type: 'int',
        default: 1,
      }),
      new TableColumn({
        name: 'versionGroupId',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'previousVersionId',
        type: 'uuid',
        isNullable: true,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'savings_product_version_audits',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'productId', type: 'uuid' },
          { name: 'versionGroupId', type: 'uuid' },
          { name: 'sourceProductId', type: 'uuid', isNullable: true },
          { name: 'targetProductId', type: 'uuid', isNullable: true },
          { name: 'actorId', type: 'uuid', isNullable: true },
          { name: 'action', type: 'varchar' },
          { name: 'metadata', type: 'jsonb', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
        ],
      }),
    );

    await queryRunner.query(`
      UPDATE savings_products
      SET "versionGroupId" = id
      WHERE "versionGroupId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('savings_product_version_audits');
    await queryRunner.dropColumn('savings_products', 'previousVersionId');
    await queryRunner.dropColumn('savings_products', 'versionGroupId');
    await queryRunner.dropColumn('savings_products', 'version');
  }
}
