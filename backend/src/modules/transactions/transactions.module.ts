import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ReceiptService } from './receipt.service';
import { AutoCategorizationService } from './auto-categorization.service';
import { LedgerTransaction } from '../blockchain/entities/transaction.entity';
import { TransactionFormattingInterceptor } from '../../common/interceptors/transaction-formatting.interceptor';
import { TransactionSavedSearch } from './entities/transaction-saved-search.entity';
import { TransactionStatusTransition } from './entities/transaction-status-transition.entity';
import { TransactionStateMachineService } from './transaction-state-machine.service';
import { Receipt } from './entities/receipt.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LedgerTransaction,
      TransactionSavedSearch,
      TransactionStatusTransition,
      Receipt,
      User,
    ]),
  ],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    ReceiptService,
    TransactionStateMachineService,
    AutoCategorizationService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionFormattingInterceptor,
    },
  ],
  exports: [TransactionsService, TransactionStateMachineService, ReceiptService],
})
export class TransactionsModule {}
