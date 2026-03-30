import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SavingsProduct } from './savings-product.entity';

@Entity('product_apy_snapshots')
@Index('IDX_apy_snapshots_product_date', ['productId', 'snapshotDate'])
export class ProductApySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  /** APY at the time of snapshot (%) */
  @Column('decimal', { precision: 5, scale: 2 })
  apy: number;

  /** Total Value Locked at snapshot time */
  @Column('decimal', { precision: 14, scale: 2, default: 0 })
  tvlAmount: number;

  /** Number of active subscribers at snapshot time */
  @Column('int', { default: 0 })
  activeSubscribers: number;

  @Column({ type: 'date' })
  snapshotDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => SavingsProduct, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: SavingsProduct;
}
