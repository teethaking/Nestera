import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavingsGoal } from '../entities/savings-goal.entity';
import { SavingsProduct } from '../entities/savings-product.entity';
import { ProductApySnapshot } from '../entities/product-apy-snapshot.entity';

export interface ProjectionResult {
  months: number;
  startingBalance: number;
  monthlyContribution: number;
  annualRate: number;
  totalContributions: number;
  totalInterest: number;
  endingBalance: number;
  monthlyBreakdown: MonthlyBreakdown[];
}

export interface MonthlyBreakdown {
  month: number;
  startingBalance: number;
  contribution: number;
  interest: number;
  endingBalance: number;
}

export interface GoalProjection {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  percentageComplete: number;
  monthlyContribution: number;
  estimatedMonthsToGoal: number;
  estimatedDateToGoal: Date;
}

export interface CompoundInterestInput {
  principal: number;
  monthlyContribution: number;
  annualRate: number;
  months: number;
  compoundFrequency: number;
}

export interface GoalProgress {
  percentageComplete: number;
  amountRemaining: number;
  daysRemaining: number | null;
  onTrack: boolean;
}

@Injectable()
export class SavingsCalculatorService {
  constructor(
    @InjectRepository(SavingsGoal)
    private readonly goalRepo: Repository<SavingsGoal>,
    @InjectRepository(SavingsProduct)
    private readonly productRepo: Repository<SavingsProduct>,
    @InjectRepository(ProductApySnapshot)
    private readonly snapshotRepo: Repository<ProductApySnapshot>,
  ) {}

  calculateProjection(input: CompoundInterestInput): ProjectionResult {
    const {
      principal,
      monthlyContribution,
      annualRate,
      months,
      compoundFrequency = 12,
    } = input;

    const monthlyRate = annualRate / 100 / compoundFrequency;
    const breakdown: MonthlyBreakdown[] = [];
    let balance = principal;
    let totalContributions = 0;
    let totalInterest = 0;

    for (let month = 1; month <= months; month++) {
      const startBalance = balance;
      const contribution = monthlyContribution;
      totalContributions += contribution;
      balance += contribution;

      const interest = balance * monthlyRate;
      totalInterest += interest;
      balance += interest;

      breakdown.push({
        month,
        startingBalance: Math.round(startBalance * 100) / 100,
        contribution,
        interest: Math.round(interest * 100) / 100,
        endingBalance: Math.round(balance * 100) / 100,
      });
    }

    return {
      months,
      startingBalance: principal,
      monthlyContribution,
      annualRate,
      totalContributions,
      totalInterest: Math.round(totalInterest * 100) / 100,
      endingBalance: Math.round(balance * 100) / 100,
      monthlyBreakdown: breakdown,
    };
  }

  async projectGoal(
    goalId: string,
    monthlyContribution: number,
    currentAmount: number = 0,
  ): Promise<GoalProjection> {
    const goal = await this.goalRepo.findOne({ where: { id: goalId } });
    if (!goal) {
      throw new Error(`Savings goal ${goalId} not found`);
    }

    const targetAmount = Number(goal.targetAmount);
    const remaining = targetAmount - currentAmount;

    let monthlyRate = 0;
    const apy = await this.getCurrentApyForGoal(goalId);
    monthlyRate = apy / 100 / 12;

    let months = 0;
    let balance = currentAmount;
    while (balance < targetAmount && months < 1200) {
      months++;
      balance += monthlyContribution;
      balance += balance * monthlyRate;
    }

    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + months);

    return {
      goalId: goal.id,
      goalName: goal.goalName,
      targetAmount,
      currentAmount,
      percentageComplete:
        targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0,
      monthlyContribution,
      estimatedMonthsToGoal: months,
      estimatedDateToGoal: estimatedDate,
    };
  }

  async calculateGoalProgress(
    goalId: string,
    currentAmount: number = 0,
  ): Promise<GoalProgress> {
    const goal = await this.goalRepo.findOne({ where: { id: goalId } });
    if (!goal) {
      throw new Error(`Savings goal ${goalId} not found`);
    }

    const targetAmount = Number(goal.targetAmount);
    const percentageComplete =
      targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const amountRemaining = targetAmount - currentAmount;

    let daysRemaining: number | null = null;
    let onTrack = true;

    if (goal.targetDate) {
      const now = new Date();
      const targetDate = new Date(goal.targetDate);
      daysRemaining = Math.max(
        0,
        Math.ceil(
          (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );

      if (daysRemaining > 0 && amountRemaining > 0) {
        const requiredDaily = amountRemaining / daysRemaining;
        const elapsedDays = Math.max(
          1,
          Math.ceil(
            (now.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          ),
        );
        const actualDaily = currentAmount / elapsedDays;
        onTrack = actualDaily >= requiredDaily;
      }
    }

    return {
      percentageComplete: Math.round(percentageComplete * 100) / 100,
      amountRemaining: Math.round(amountRemaining * 100) / 100,
      daysRemaining,
      onTrack,
    };
  }

  async getCurrentApy(productId: string): Promise<number> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { productId },
      order: { snapshotDate: 'DESC' },
    });
    return snapshot ? Number(snapshot.apy) : 0;
  }

  private async getCurrentApyForGoal(goalId: string): Promise<number> {
    const snapshot = await this.snapshotRepo.find({
      order: { snapshotDate: 'DESC' },
      take: 1,
    });
    return snapshot.length > 0 ? Number(snapshot[0].apy) : 0;
  }

  async compareProducts(productIds: string[]): Promise<
    Array<{
      productId: string;
      name: string;
      apy: number;
      minDeposit: number;
      maxCapacity: number;
      currentUtilization: number;
    }>
  > {
    const products = await this.productRepo.findByIds(productIds);
    return products.map((p) => ({
      productId: p.id,
      name: p.name,
      apy: Number(p.interestRate),
      minDeposit: Number(p.minAmount),
      maxCapacity: Number(p.maxCapacity),
      currentUtilization:
        Number(p.maxCapacity) > 0
          ? (Number(p.tvlAmount) / Number(p.maxCapacity)) * 100
          : 0,
    }));
  }
}
