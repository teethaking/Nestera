import { Test, TestingModule } from '@nestjs/testing';
import { DataScopeService } from './data-scope.service';
import { Role } from '../enums/role.enum';

describe('DataScopeService', () => {
  let service: DataScopeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataScopeService],
    }).compile();

    service = module.get<DataScopeService>(DataScopeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow SUPER_ADMIN to view all data', () => {
    expect(service.canViewAllData(Role.SUPER_ADMIN)).toBe(true);
    expect(service.canViewSensitiveData(Role.SUPER_ADMIN)).toBe(true);
  });

  it('should restrict ANALYST time range to 90 days', () => {
    const maxRange = service.getMaxTimeRange(Role.ANALYST);
    expect(maxRange).toBe(90);
  });

  it('should restrict SUPPORT time range to 30 days', () => {
    const maxRange = service.getMaxTimeRange(Role.SUPPORT);
    expect(maxRange).toBe(30);
  });

  it('should restrict USER time range to 7 days', () => {
    const maxRange = service.getMaxTimeRange(Role.USER);
    expect(maxRange).toBe(7);
  });

  it('should apply date range filter correctly', () => {
    const filtered = service.applyDateRangeFilter(Role.ANALYST, 365);
    expect(filtered).toBe(90); // Limited to 90 days
  });

  it('should filter sensitive fields for non-admin roles', () => {
    const data = { id: 1, name: 'John', ssn: '123-45-6789' };
    const filtered = service.filterSensitiveFields(Role.USER, data, ['ssn']);
    expect(filtered).toEqual({ id: 1, name: 'John' });
    expect(filtered['ssn']).toBeUndefined();
  });

  it('should not filter sensitive fields for SUPER_ADMIN', () => {
    const data = { id: 1, name: 'John', ssn: '123-45-6789' };
    const filtered = service.filterSensitiveFields(Role.SUPER_ADMIN, data, [
      'ssn',
    ]);
    expect(filtered).toEqual(data);
  });
});
