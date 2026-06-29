import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';
import { DataExportProcessor } from './data-export.processor';
import { DataExportRequest } from './entities/data-export-request.entity';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SavingsGoal } from '../savings/entities/savings-goal.entity';
import { MailModule } from '../mail/mail.module';
import { DATA_EXPORT_QUEUE } from './data-export.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataExportRequest,
      User,
      Transaction,
      Notification,
      SavingsGoal,
    ]),
    BullModule.registerQueue({ name: DATA_EXPORT_QUEUE }),
    MailModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService, DataExportProcessor],
})
export class DataExportModule {}
