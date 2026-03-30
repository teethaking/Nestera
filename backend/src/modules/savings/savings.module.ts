import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { PredictiveEvaluatorService } from './services/predictive-evaluator.service';
import { RecommendationService } from './services/recommendation.service';
import { SavingsProduct } from './entities/savings-product.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { SavingsGoal } from './entities/savings-goal.entity';
import { ProductApySnapshot } from './entities/product-apy-snapshot.entity';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../user/entities/user.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { WaitlistEvent } from './entities/waitlist-event.entity';
import { WaitlistService } from './waitlist.service';
import { WaitlistController } from './waitlist.controller';
import { SavingsExperiment } from './entities/savings-experiment.entity';
import { SavingsExperimentAssignment } from './entities/savings-experiment-assignment.entity';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      SavingsProduct,
      UserSubscription,
      SavingsGoal,
      ProductApySnapshot,
      WithdrawalRequest,
      Transaction,
      User,
      WaitlistEntry,
      WaitlistEvent,
      SavingsExperiment,
      SavingsExperimentAssignment,
    ]),
  ],
  controllers: [SavingsController, WaitlistController],
  providers: [
    SavingsService,
    PredictiveEvaluatorService,
    WaitlistService,
    ExperimentsService,
  ],
  exports: [SavingsService, WaitlistService, ExperimentsService],
})
export class SavingsModule {}
