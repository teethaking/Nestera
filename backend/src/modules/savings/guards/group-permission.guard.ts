import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SavingsGroupMember,
  SavingsGroupRole,
} from '../entities/savings-group-member.entity';
import {
  SavingsGroup,
  SavingsGroupStatus,
} from '../entities/savings-group.entity';

export const GROUP_ADMIN_KEY = 'group_admin_only';
export const GROUP_MEMBER_KEY = 'group_member_only';
export const GROUP_OPEN_KEY = 'group_open_only';

@Injectable()
export class GroupPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(SavingsGroupMember)
    private readonly memberRepo: Repository<SavingsGroupMember>,
    @InjectRepository(SavingsGroup)
    private readonly groupRepo: Repository<SavingsGroup>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const requireAdmin = this.reflector.getAllAndOverride<boolean>(
      GROUP_ADMIN_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requireMember = this.reflector.getAllAndOverride<boolean>(
      GROUP_MEMBER_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requireOpen = this.reflector.getAllAndOverride<boolean>(
      GROUP_OPEN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireAdmin && !requireMember && !requireOpen) {
      return true;
    }

    const groupId = request.params?.id;
    if (!groupId) {
      throw new NotFoundException('Group ID required');
    }

    if (requireOpen) {
      const group = await this.groupRepo.findOne({ where: { id: groupId } });
      if (!group || group.status !== SavingsGroupStatus.OPEN) {
        throw new ForbiddenException('Group is not open for this operation');
      }
    }

    if (requireAdmin || requireMember) {
      const member = await this.memberRepo.findOne({
        where: { groupId, userId: user.id },
      });

      if (requireAdmin) {
        if (!member || member.role !== SavingsGroupRole.ADMIN) {
          throw new ForbiddenException('Group admin access required');
        }
      } else if (requireMember && !member) {
        throw new ForbiddenException('Group membership required');
      }
    }

    return true;
  }
}
