import { SetMetadata } from '@nestjs/common';
import {
  GROUP_ADMIN_KEY,
  GROUP_MEMBER_KEY,
  GROUP_OPEN_KEY,
} from '../guards/group-permission.guard';

export const GroupAdminOnly = () => SetMetadata(GROUP_ADMIN_KEY, true);
export const GroupMemberOnly = () => SetMetadata(GROUP_MEMBER_KEY, true);
export const GroupOpenOnly = () => SetMetadata(GROUP_OPEN_KEY, true);
