import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { PredictiveEvaluatorService } from './services/predictive-evaluator.service';
import { MilestoneService } from './services/milestone.service';
import { RecommendationService } from './services/recommendation.service';
import { SavingsProduct } from './entities/savings-product.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { SavingsGoal } from './entities/savings-goal.entity';
import { SavingsGoalMilestone } from './entities/savings-goal-milestone.entity';
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
import { SavingsGroup } from './entities/savings-group.entity';
import { SavingsGroupMember } from './entities/savings-group-member.entity';
import { SavingsGroupActivity } from './entities/savings-group-activity.entity';
import { GroupInvitation } from './entities/group-invitation.entity';
import { ActivityTimeline } from './entities/activity-timeline.entity';
import { MilestoneNotification } from './entities/milestone-notification.entity';
import { GroupSavingsService } from './group-savings.service';
import { GroupSavingsController } from './group-savings.controller';
import { AutoDepositSchedule } from './entities/auto-deposit-schedule.entity';
import { AutoDepositService } from './services/auto-deposit.service';
import {
  GoalTransferSchedule,
  GoalTransferExecution,
} from './entities/goal-transfer-schedule.entity';
import { GoalTransferService } from './services/goal-transfer.service';
import { SavingsGoalShare } from './entities/savings-goal-share.entity';
import { SavingsGoalShareEvent } from './entities/savings-goal-share-event.entity';
import { SavingsGoalSharingService } from './savings-goal-sharing.service';
import { SavingsGoalSharingController } from './savings-goal-sharing.controller';
import { ActivityTimelineService } from './services/activity-timeline.service';
import { MilestoneNotificationEngineService } from './services/milestone-notification-engine.service';
import { SavingsCalculatorService } from './services/savings-calculator.service';
import { GroupPermissionGuard } from './guards/group-permission.guard';
import { MailModule } from '../mail/mail.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MailModule,
    TransactionsModule,
    TypeOrmModule.forFeature([
      SavingsProduct,
      UserSubscription,
      SavingsGoal,
      SavingsGoalMilestone,
      ProductApySnapshot,
      WithdrawalRequest,
      Transaction,
      User,
      WaitlistEntry,
      WaitlistEvent,
      SavingsExperiment,
      SavingsExperimentAssignment,
      SavingsGroup,
      SavingsGroupMember,
      SavingsGroupActivity,
      GroupInvitation,
      ActivityTimeline,
      MilestoneNotification,
      AutoDepositSchedule,
      GoalTransferSchedule,
      GoalTransferExecution,
      SavingsGoalShare,
      SavingsGoalShareEvent,
    ]),
  ],
  controllers: [
    SavingsController,
    WaitlistController,
    GroupSavingsController,
    SavingsGoalSharingController,
  ],
  providers: [
    SavingsService,
    PredictiveEvaluatorService,
    MilestoneService,
    RecommendationService,
    WaitlistService,
    ExperimentsService,
    GroupSavingsService,
    AutoDepositService,
    GoalTransferService,
    SavingsGoalSharingService,
    ActivityTimelineService,
    MilestoneNotificationEngineService,
    SavingsCalculatorService,
    GroupPermissionGuard,
  ],
  exports: [
    SavingsService,
    WaitlistService,
    ExperimentsService,
    SavingsGoalSharingService,
  ],
})
export class SavingsModule {}
