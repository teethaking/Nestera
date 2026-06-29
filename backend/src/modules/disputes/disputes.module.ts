import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import {
  Dispute,
  DisputeMessage,
  DisputeTimeline,
} from './entities/dispute.entity';
import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { MedicalClaim } from '../claims/entities/medical-claim.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispute,
      DisputeMessage,
      DisputeTimeline,
      DisputeEvidence,
      MedicalClaim,
    ]),
    StorageModule,
    // JobQueueModule is @Global(), so JobQueueService is available without
    // re-importing it here.
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService, Dispute, DisputeTimeline],
})
export class DisputesModule {}
