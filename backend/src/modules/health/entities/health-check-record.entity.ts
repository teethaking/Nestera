import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('health_check_records')
@Index(['service', 'checkedAt'])
@Index(['checkedAt'])
export class HealthCheckRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  service: string;

  @Column({ type: 'varchar', length: 16 })
  status: 'up' | 'down' | 'degraded';

  @Column({ type: 'int' })
  responseTime: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  checkedAt: Date;
}
