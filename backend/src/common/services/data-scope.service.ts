import { Injectable, Logger } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export interface DataScope {
  canViewAllData: boolean;
  allowedRegions?: string[];
  allowedDepartments?: string[];
  maxTimeRange?: number; // in days
  excludeSensitiveData?: boolean;
}

@Injectable()
export class DataScopeService {
  private readonly logger = new Logger(DataScopeService.name);

  private roleScopes: Record<Role, DataScope> = {
    [Role.SUPER_ADMIN]: {
      canViewAllData: true,
      excludeSensitiveData: false,
    },
    [Role.ADMIN]: {
      canViewAllData: true,
      excludeSensitiveData: true,
    },
    [Role.ANALYST]: {
      canViewAllData: false,
      allowedRegions: ['US', 'EU'],
      maxTimeRange: 90,
      excludeSensitiveData: true,
    },
    [Role.SUPPORT]: {
      canViewAllData: false,
      maxTimeRange: 30,
      excludeSensitiveData: true,
    },
    [Role.USER]: {
      canViewAllData: false,
      maxTimeRange: 7,
      excludeSensitiveData: true,
    },
  };

  getDataScope(role: Role): DataScope {
    const scope = this.roleScopes[role] || this.roleScopes[Role.USER];
    this.logger.debug(`Data scope for role ${role}:`, scope);
    return scope;
  }

  canViewAllData(role: Role): boolean {
    return this.getDataScope(role).canViewAllData;
  }

  canViewSensitiveData(role: Role): boolean {
    return !this.getDataScope(role).excludeSensitiveData;
  }

  getMaxTimeRange(role: Role): number {
    return this.getDataScope(role).maxTimeRange || 30;
  }

  isRegionAllowed(role: Role, region: string): boolean {
    const scope = this.getDataScope(role);
    if (scope.canViewAllData) return true;
    if (!scope.allowedRegions) return false;
    return scope.allowedRegions.includes(region);
  }

  isDepartmentAllowed(role: Role, department: string): boolean {
    const scope = this.getDataScope(role);
    if (scope.canViewAllData) return true;
    if (!scope.allowedDepartments) return false;
    return scope.allowedDepartments.includes(department);
  }

  applyDateRangeFilter(role: Role, requestedRange: number): number {
    const maxRange = this.getMaxTimeRange(role);
    return Math.min(requestedRange, maxRange);
  }

  filterSensitiveFields<T>(
    role: Role,
    data: T,
    sensitiveFields: string[],
  ): Partial<T> {
    if (this.canViewSensitiveData(role)) {
      return data;
    }

    const filtered: any = { ...data };
    for (const field of sensitiveFields) {
      delete filtered[field];
    }
    return filtered;
  }

  filterSensitiveFieldsArray<T>(
    role: Role,
    data: T[],
    sensitiveFields: string[],
  ): Partial<T>[] {
    if (this.canViewSensitiveData(role)) {
      return data;
    }

    return data.map((item) =>
      this.filterSensitiveFields(role, item, sensitiveFields),
    );
  }
}
