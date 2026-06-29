import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationProcessor } from './processors/notification.processor';
import { BlockchainProcessor } from './processors/blockchain.processor';
import { ReconciliationProcessor } from './processors/reconciliation.processor';
import { FeeRewardReconciliationService } from './services/fee-reward-reconciliation.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'blockchain' },
      { name: 'reconciliation' },
    ),
  ],
  providers: [
    NotificationProcessor,
    BlockchainProcessor,
    ReconciliationProcessor,
    FeeRewardReconciliationService,
  ],
})
export class JobsModule {}
