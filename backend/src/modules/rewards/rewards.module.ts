import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UserRewardProfile } from './entities/user-reward-profile.entity';
import { UserSubscription } from '../savings/entities/user-subscription.entity';
import { FeeReconciliation } from './entities/fee-reconciliation.entity';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { FeeReconciliationService } from './services/fee-reconciliation.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      UserRewardProfile,
      UserSubscription,
      FeeReconciliation,
    ]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService, FeeReconciliationService],
  exports: [RewardsService, FeeReconciliationService],
})
export class RewardsModule {}
