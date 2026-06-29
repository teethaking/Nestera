import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UserSubscription } from '../savings/entities/user-subscription.entity';
import { LedgerTransaction } from '../blockchain/entities/transaction.entity';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import {
  AdminUserListItemDto,
  AdminUserDetailDto,
  BulkActionDto,
} from './dto/admin-user.dto';
import { MailService } from '../mail/mail.service';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import {
  decodeCursor,
  encodeCursor,
} from '../../common/helpers/cursor-pagination.helper';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(UserSubscription)
    private readonly subscriptions: Repository<UserSubscription>,
    @InjectRepository(LedgerTransaction)
    private readonly transactions: Repository<LedgerTransaction>,
    private readonly mail: MailService,
  ) {}

  async listUsers(query: AdminUsersQueryDto): Promise<PageDto<AdminUserListItemDto>> {
    const qb = this.buildBaseQuery(query);
    const pageSize = query.pageSize;

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere(
        '(u.createdAt < :cursorCreatedAt OR (u.createdAt = :cursorCreatedAt AND u.id < :cursorId))',
        {
          cursorCreatedAt: new Date(cursor.createdAt),
          cursorId: cursor.id,
        },
      );
    } else {
      qb.skip(query.skip);
    }

    const users = await qb.take(pageSize + 1).getMany();
    const hasMore = users.length > pageSize;
    const rows = hasMore ? users.slice(0, pageSize) : users;

    const data = await Promise.all(rows.map((u) => this.toListItem(u)));
    const nextCursor =
      hasMore && rows.length > 0
        ? encodeCursor({
            createdAt: rows[rows.length - 1].createdAt.toISOString(),
            id: rows[rows.length - 1].id,
          })
        : null;
    const totalItemCount = query.shouldIncludeTotal
      ? await this.buildBaseQuery(query).getCount()
      : undefined;

    return new PageDto(
      data,
      new PageMetaDto({ pageOptionsDto: query, totalItemCount, nextCursor }),
    );
  }

  async getUserDetails(id: string): Promise<AdminUserDetailDto> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const [totalSavings, txCount, activeSubs, totalInterest] =
      await Promise.all([
        this.sumSavings(id),
        this.countTransactions(id),
        this.countActiveSubscriptions(id),
        this.sumInterest(id),
      ]);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      publicKey: user.publicKey,
      walletAddress: user.walletAddress,
      role: user.role,
      kycStatus: user.kycStatus,
      tier: user.tier,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt ?? undefined,
      totalSavings,
      transactionCount: txCount,
      activeSubscriptions: activeSubs,
      totalInterestEarned: totalInterest,
      createdAt: user.createdAt,
    };
  }

  async updateRole(
    id: string,
    role: 'USER' | 'ADMIN',
  ): Promise<{ id: string; role: string }> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.users.update(id, { role });
    return { id, role };
  }

  async updateStatus(
    id: string,
    isActive: boolean,
  ): Promise<{ id: string; isActive: boolean }> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.users.update(id, { isActive });
    return { id, isActive };
  }

  async bulkAction(
    dto: BulkActionDto,
  ): Promise<{ affected: number; action: string }> {
    const { action, userIds } = dto;

    if (action === 'activate' || action === 'deactivate') {
      await this.users
        .createQueryBuilder()
        .update()
        .set({ isActive: action === 'activate' })
        .whereInIds(userIds)
        .execute();
      return { affected: userIds.length, action };
    }

    if (action === 'email') {
      const usersToEmail = await this.users.findByIds(userIds);
      await Promise.allSettled(
        usersToEmail.map((u) =>
          this.mail.sendRawMail(
            u.email,
            dto.emailSubject ?? 'Message from Nestera',
            dto.emailBody ?? '',
          ),
        ),
      );
      return { affected: usersToEmail.length, action };
    }

    if (action === 'export') {
      // Export is handled client-side from GET /admin/users — signal count only
      return { affected: userIds.length, action };
    }

    return { affected: 0, action };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildBaseQuery(query: AdminUsersQueryDto): SelectQueryBuilder<User> {
    const qb = this.users
      .createQueryBuilder('u')
      .orderBy('u.createdAt', 'DESC');
    qb.addOrderBy('u.id', 'DESC');

    if (query.search) {
      qb.andWhere('(u.email ILIKE :s OR u.name ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.kycStatus)
      qb.andWhere('u.kycStatus = :kyc', { kyc: query.kycStatus });
    if (query.status)
      qb.andWhere('u.isActive = :active', {
        active: query.status === 'active',
      });
    if (query.registeredFrom)
      qb.andWhere('u.createdAt >= :from', {
        from: new Date(query.registeredFrom),
      });
    if (query.registeredTo)
      qb.andWhere('u.createdAt <= :to', { to: new Date(query.registeredTo) });

    return qb;
  }

  private async toListItem(user: User): Promise<AdminUserListItemDto> {
    const [totalSavings, transactionCount] = await Promise.all([
      this.sumSavings(user.id),
      this.countTransactions(user.id),
    ]);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      kycStatus: user.kycStatus,
      isActive: user.isActive,
      totalSavings,
      transactionCount,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
    };
  }

  private async sumSavings(userId: string): Promise<number> {
    const result = await this.subscriptions
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.amount), 0)', 'total')
      .where('s.userId = :userId', { userId })
      .getRawOne<{ total: string }>();
    return parseFloat(result?.total ?? '0');
  }

  private async countTransactions(userId: string): Promise<number> {
    return this.transactions.count({ where: { userId } });
  }

  private async countActiveSubscriptions(userId: string): Promise<number> {
    return this.subscriptions.count({
      where: { userId, status: 'ACTIVE' as any },
    });
  }

  private async sumInterest(userId: string): Promise<number> {
    const result = await this.subscriptions
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.totalInterestEarned), 0)', 'total')
      .where('s.userId = :userId', { userId })
      .getRawOne<{ total: string }>();
    return parseFloat(result?.total ?? '0');
  }
}
