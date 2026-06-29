import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral } from './entities/referral.entity';
import { ReferralCampaign } from './entities/referral-campaign.entity';
import { ReferralFraudAudit } from './entities/referral-fraud-audit.entity';
import { ProcessedReferralEvent } from './entities/processed-referral-event.entity';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { ReferralsService } from './referrals.service';
import { CampaignsService } from './campaigns.service';
import { ReferralAnalyticsService } from './referral-analytics.service';
import { ReferralFraudDetectionService } from './referral-fraud-detection.service';
import { ReferralsController } from './referrals.controller';
import { AdminReferralsController } from './admin-referrals.controller';
import { UserReferralsController } from './user-referrals.controller';
import { ReferralAnalyticsController } from './referral-analytics.controller';
import { ReferralEventsListener } from './referral-events.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Referral,
      ReferralCampaign,
      ReferralFraudAudit,
      ProcessedReferralEvent,
      User,
      Transaction,
      Notification,
    ]),
  ],
  controllers: [
    ReferralsController,
    AdminReferralsController,
    UserReferralsController,
    ReferralAnalyticsController,
  ],
  providers: [
    ReferralsService,
    CampaignsService,
    ReferralAnalyticsService,
    ReferralFraudDetectionService,
    ReferralEventsListener,
  ],
  exports: [
    ReferralsService,
    CampaignsService,
    ReferralAnalyticsService,
    ReferralFraudDetectionService,
  ],
})
export class ReferralsModule {}
