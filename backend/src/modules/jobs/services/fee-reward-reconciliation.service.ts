import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReconciliationRecord } from '../entities/reconciliation-record.entity';

@Injectable()
export class FeeRewardReconciliationService {
  private readonly logger = new Logger(FeeRewardReconciliationService.name);

  constructor(
    @InjectRepository(ReconciliationRecord)
    private readonly reconciliationRepo: Repository<ReconciliationRecord>,
  ) {}

  // Main reconciliation method: compares expected vs actual fees/rewards
  // and records discrepancies, optionally auto-correcting within safe bounds.
  async reconcile(): Promise<{ totalChecked: number; discrepancies: number; corrected: number }> {
    this.logger.log('Starting fee/reward reconciliation...');

    // Placeholder: In production, fetch expected and actual data from respective sources.
    // For example:
    // - Expected fees from fee schedule or off-chain calculations
    // - Actual fees from transactions ledger
    // - Expected rewards from reward profiles
    // - Actual rewards from reward payout records

    // We simulate a batch of records to process
    const itemsToCheck = await this.fetchItemsToReconcile();

    let discrepancies = 0;
    let corrected = 0;

    for (const item of itemsToCheck) {
      const discrepancy = item.expectedAmount - item.actualAmount;
      const absDiscrepancy = Math.abs(discrepancy);

      if (absDiscrepancy > 0) {
        discrepancies++;

        // Define safe bounds (e.g., small rounding errors within 0.01 or 0.1%)
        const safeBound = 0.01; // adjust as needed
        const percentageBound = 0.001 * item.expectedAmount;
        const maxAllowedDiscrepancy = Math.max(safeBound, percentageBound);

        if (absDiscrepancy <= maxAllowedDiscrepancy) {
          // Auto-correct within safe bounds
          await this.autoCorrect(item, discrepancy);
          corrected++;
        } else {
          // Report discrepancy (e.g., create admin ticket, log alert)
          await this.reportDiscrepancy(item, discrepancy);
        }
      }

      // Save reconciliation record
      const record = this.reconciliationRepo.create({
        recordType: item.recordType,
        referenceId: item.referenceId,
        expectedAmount: item.expectedAmount,
        actualAmount: item.actualAmount,
        discrepancy: discrepancy,
        status: absDiscrepancy === 0 ? 'pending' : (absDiscrepancy <= maxAllowedDiscrepancy ? 'corrected' : 'discrepancy_reported'),
        autoCorrected: absDiscrepancy > 0 && absDiscrepancy <= maxAllowedDiscrepancy,
        correctedAt: absDiscrepancy > 0 && absDiscrepancy <= maxAllowedDiscrepancy ? new Date() : null,
        notes: `Discrepancy: ${discrepancy}. ${absDiscrepancy > maxAllowedDiscrepancy ? 'Reported for manual review.' : 'Auto-corrected.'}`,
      });
      await this.reconciliationRepo.save(record);
    }

    this.logger.log(`Reconciliation completed: ${itemsToCheck.length} checked, ${discrepancies} discrepancies, ${corrected} auto-corrected.`);
    return { totalChecked: itemsToCheck.length, discrepancies, corrected };
  }

  // In production, implement actual data fetching from appropriate sources.
  private async fetchItemsToReconcile(): Promise<Array<{
    recordType: string;
    referenceId: string;
    expectedAmount: number;
    actualAmount: number;
  }>> {
    // Simulated data
    return [
      { recordType: 'fee', referenceId: 'txn-001', expectedAmount: 0.50, actualAmount: 0.50 },
      { recordType: 'fee', referenceId: 'txn-002', expectedAmount: 1.00, actualAmount: 1.05 }, // small discrepancy
      { recordType: 'reward', referenceId: 'user-100', expectedAmount: 100.00, actualAmount: 98.50 }, // larger discrepancy
    ];
  }

  private async autoCorrect(item: { recordType: string; referenceId: string; expectedAmount: number; actualAmount: number; }, discrepancy: number): Promise<void> {
    this.logger.warn(`Auto-correcting discrepancy of ${discrepancy} for ${item.recordType} ${item.referenceId}. Expected ${item.expectedAmount}, actual ${item.actualAmount}.`);
    // TODO: Implement actual correction logic:
    // - For fees: adjust transaction record or create adjustment entry.
    // - For rewards: adjust reward payout or user balance.
    // Simulate by logging (in production, perform safe update).
  }

  private async reportDiscrepancy(item: { recordType: string; referenceId: string; expectedAmount: number; actualAmount: number; }, discrepancy: number): Promise<void> {
    this.logger.error(`Significant discrepancy for ${item.recordType} ${item.referenceId}: expected ${item.expectedAmount}, actual ${item.actualAmount}, diff ${discrepancy}.`);
    // TODO: Create admin ticket via ticketing system, send notification, etc.
    // Simulate by logging.
  }
}
