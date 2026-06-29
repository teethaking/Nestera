import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class EnhanceIndexerCheckpoint1800500000000 implements MigrationInterface {
  name = 'EnhanceIndexerCheckpoint1800500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('indexer_state');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('stream_id')) {
      await queryRunner.addColumn(
        'indexer_state',
        new TableColumn({
          name: 'stream_id',
          type: 'varchar',
          length: '64',
          isNullable: false,
          default: `'savings-indexer'`,
        }),
      );
    }

    if (!table.findColumnByName('last_processed_event_cursor')) {
      await queryRunner.addColumn(
        'indexer_state',
        new TableColumn({
          name: 'last_processed_event_cursor',
          type: 'varchar',
          length: '128',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('checkpoint_checksum')) {
      await queryRunner.addColumn(
        'indexer_state',
        new TableColumn({
          name: 'checkpoint_checksum',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }

    const updated = await queryRunner.getTable('indexer_state');
    const hasStreamIndex = updated?.indices.some(
      (idx) => idx.name === 'idx_indexer_state_stream_id',
    );
    if (!hasStreamIndex) {
      await queryRunner.createIndex(
        'indexer_state',
        new TableIndex({
          name: 'idx_indexer_state_stream_id',
          columnNames: ['stream_id'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('indexer_state', 'idx_indexer_state_stream_id');
    await queryRunner.dropColumn('indexer_state', 'checkpoint_checksum');
    await queryRunner.dropColumn(
      'indexer_state',
      'last_processed_event_cursor',
    );
    await queryRunner.dropColumn('indexer_state', 'stream_id');
  }
}
