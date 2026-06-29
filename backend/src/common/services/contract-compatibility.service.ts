import { Injectable, Logger } from '@nestjs/common';

export interface ContractVersion {
  name: string;
  version: string;
  deployedAt: Date;
  schemaHash: string;
}

export interface BackendVersion {
  version: string;
  supportedContractVersions: string[];
  minCompatibleContractVersion: string;
  maxCompatibleContractVersion: string;
}

export interface CompatibilityCheckResult {
  compatible: boolean;
  contractName: string;
  contractVersion: string;
  backendVersion: string;
  issues: string[];
  severity: 'error' | 'warning';
}

@Injectable()
export class ContractCompatibilityService {
  private readonly logger = new Logger(ContractCompatibilityService.name);

  private readonly backendVersion: BackendVersion = {
    version: '2.0.0',
    supportedContractVersions: ['1.0.0', '1.1.0', '1.2.0', '2.0.0'],
    minCompatibleContractVersion: '1.0.0',
    maxCompatibleContractVersion: '2.0.0',
  };

  private readonly knownContracts: Map<string, ContractVersion> = new Map([
    [
      'SavingsPool',
      {
        name: 'SavingsPool',
        version: '2.0.0',
        deployedAt: new Date('2024-01-15'),
        schemaHash: 'abc123def456',
      },
    ],
    [
      'Governance',
      {
        name: 'Governance',
        version: '1.2.0',
        deployedAt: new Date('2024-02-01'),
        schemaHash: 'ghi789jkl012',
      },
    ],
    [
      'Token',
      {
        name: 'Token',
        version: '1.0.0',
        deployedAt: new Date('2023-12-01'),
        schemaHash: 'mno345pqr678',
      },
    ],
  ]);

  constructor() {
    this.logger.log('ContractCompatibilityService initialized');
  }

  /**
   * Perform compatibility check on backend startup
   * Throws error if critical incompatibilities are found
   */
  async performStartupCheck(): Promise<void> {
    this.logger.log('Starting contract-backend compatibility check...');

    const results: CompatibilityCheckResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [name, contract] of this.knownContracts.entries()) {
      const result = this.checkCompatibility(contract);
      results.push(result);

      if (result.severity === 'error') {
        errors.push(...result.issues);
      } else if (result.severity === 'warning') {
        warnings.push(...result.issues);
      }
    }

    // Log results
    this.logger.log(
      `Compatibility check completed: ${results.length} contracts checked`,
    );

    if (warnings.length > 0) {
      this.logger.warn(`Compatibility warnings:\n${warnings.join('\n')}`);
    }

    if (errors.length > 0) {
      this.logger.error(`Compatibility errors:\n${errors.join('\n')}`);
      throw new Error(
        `Contract-backend compatibility check failed:\n${errors.join('\n')}`,
      );
    }

    this.logger.log('All contracts are compatible with backend version');
  }

  /**
   * Check compatibility of a specific contract
   */
  checkCompatibility(contract: ContractVersion): CompatibilityCheckResult {
    const issues: string[] = [];
    let severity: 'error' | 'warning' = 'warning';

    const { version } = contract;
    const {
      supportedContractVersions,
      minCompatibleContractVersion,
      maxCompatibleContractVersion,
    } = this.backendVersion;

    // Check if version is explicitly supported
    if (!supportedContractVersions.includes(version)) {
      issues.push(
        `Contract version ${version} is not in the list of explicitly supported versions: ${supportedContractVersions.join(', ')}`,
      );
      severity = 'error';
    }

    // Check version range
    const versionCompare = this.compareVersions(
      version,
      minCompatibleContractVersion,
    );
    const maxVersionCompare = this.compareVersions(
      version,
      maxCompatibleContractVersion,
    );

    if (versionCompare < 0) {
      issues.push(
        `Contract version ${version} is below minimum compatible version ${minCompatibleContractVersion}`,
      );
      severity = 'error';
    } else if (maxVersionCompare > 0) {
      issues.push(
        `Contract version ${version} is above maximum compatible version ${maxCompatibleContractVersion}. Backend may not support new features.`,
      );
      severity = 'warning';
    }

    return {
      compatible: severity !== 'error',
      contractName: contract.name,
      contractVersion: contract.version,
      backendVersion: this.backendVersion.version,
      issues,
      severity,
    };
  }

  /**
   * Register or update a contract version
   */
  registerContract(contract: ContractVersion): void {
    this.knownContracts.set(contract.name, contract);
    this.logger.log(
      `Registered contract: ${contract.name} version ${contract.version}`,
    );
  }

  /**
   * Get backend version info
   */
  getBackendVersion(): BackendVersion {
    return { ...this.backendVersion };
  }

  /**
   * Get all known contracts
   */
  getKnownContracts(): ContractVersion[] {
    return Array.from(this.knownContracts.values());
  }

  /**
   * Compare two version strings (semver-like)
   * Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  /**
   * Validate schema hash (for detecting contract changes)
   */
  validateSchemaHash(contractName: string, expectedHash: string): boolean {
    const contract = this.knownContracts.get(contractName);
    if (!contract) {
      this.logger.warn(`Unknown contract: ${contractName}`);
      return false;
    }

    const isValid = contract.schemaHash === expectedHash;
    if (!isValid) {
      this.logger.error(
        `Schema hash mismatch for ${contractName}: expected ${contract.schemaHash}, got ${expectedHash}`,
      );
    }

    return isValid;
  }
}
