import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type SavingsProductVersionAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'VERSION_CREATED'
  | 'SUBSCRIPTIONS_MIGRATED';

@Entity('savings_product_version_audits')
@Index(['productId', 'createdAt'])
@Index(['versionGroupId', 'createdAt'])
export class SavingsProductVersionAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @Column('uuid')
  versionGroupId: string;

  @Column({ type: 'uuid', nullable: true })
  sourceProductId: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetProductId: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar' })
  action: SavingsProductVersionAuditAction;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
