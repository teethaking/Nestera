import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Readable } from 'stream';
import { format as csvFormat } from '@fast-csv/format';
import { LedgerTransaction } from '../blockchain/entities/transaction.entity';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { AutoCategorizationService } from './auto-categorization.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(LedgerTransaction)
    private readonly transactionRepository: Repository<LedgerTransaction>,
    private readonly autoCategorizationService: AutoCategorizationService,
  ) {}

  async findAllForUser(
    userId: string,
    queryDto: TransactionQueryDto,
  ): Promise<PageDto<TransactionResponseDto>> {
    const queryBuilder = this.buildQuery(userId, queryDto);

    // Apply pagination
    queryBuilder.skip(queryDto.skip).take(queryDto.limit ?? 10);

    const [data, totalItemCount] = await queryBuilder.getManyAndCount();

    // Transform to response DTOs with formatted dates
    const transformedData = data.map((transaction) =>
      this.transformToResponseDto(transaction),
    );

    const meta = new PageMetaDto({
      pageOptionsDto: queryDto,
      totalItemCount,
    });

    return new PageDto(transformedData, meta);
  }

  async streamTransactionsCsv(
    userId: string,
    queryDto: TransactionQueryDto,
  ): Promise<Readable> {
    const chunkSize = Number(queryDto.limit ?? 1000);
    let offset = 0;

    const csvStream = csvFormat({ headers: true, quoteColumns: true });

    (async () => {
      try {
        while (true) {
          const batch = await this.buildQuery(userId, queryDto)
            .skip(offset)
            .take(chunkSize)
            .getMany();

          if (!batch.length) {
            break;
          }

          for (const tx of batch) {
            const dto = this.transformToResponseDto(tx);
            csvStream.write({
              id: dto.id,
              userId: dto.userId,
              type: dto.type,
              amount: dto.amount,
              amountFormatted: dto.amountFormatted?.display ?? '',
              publicKey: dto.publicKey ?? '',
              eventId: dto.eventId,
              transactionHash: dto.transactionHash ?? '',
              category: dto.category ?? '',
              tags: dto.tags ? dto.tags.join(';') : '',
              ledgerSequence: dto.ledgerSequence ?? '',
              poolId: dto.poolId ?? '',
              assetId: dto.assetId ?? '',
              metadata: dto.metadata ? JSON.stringify(dto.metadata) : '',
              createdAt: dto.createdAt,
            });
          }

          offset += chunkSize;
        }
      } catch (error) {
        csvStream.destroy(error);
      } finally {
        csvStream.end();
      }
    })();

    return csvStream;
  }

  private buildQuery(
    userId: string,
    queryDto: TransactionQueryDto,
  ): SelectQueryBuilder<LedgerTransaction> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId });

    // Filter by transaction types
    if (queryDto.type && queryDto.type.length > 0) {
      queryBuilder.andWhere('transaction.type IN (:...types)', {
        types: queryDto.type,
      });
    }

    // Filter by date range
    if (queryDto.startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate: new Date(queryDto.startDate),
      });
    }

    if (queryDto.endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', {
        endDate: new Date(queryDto.endDate),
      });
    }

    // Filter by pool ID
    if (queryDto.poolId) {
      queryBuilder.andWhere('transaction.poolId = :poolId', {
        poolId: queryDto.poolId,
      });
    }

    // Filter by category
    if (queryDto.category) {
      queryBuilder.andWhere('transaction.category = :category', {
        category: queryDto.category,
      });
    }

    // Filter by tags (any overlap)
    if (queryDto.tags && queryDto.tags.length > 0) {
      // Use Postgres array overlap operator (&&)
      queryBuilder.andWhere('transaction.tags && :tags', {
        tags: queryDto.tags,
      });
    }

    // Apply ordering
    queryBuilder.orderBy('transaction.createdAt', queryDto.order ?? 'DESC');

    return queryBuilder;
  }

  private transformToResponseDto(
    transaction: LedgerTransaction,
  ): TransactionResponseDto {
    const createdAt = new Date(transaction.createdAt);

    // Extract asset ID from metadata or use default USDC
    const assetId = this.extractAssetId(transaction);

    return {
      id: transaction.id,
      userId: transaction.userId,
      type: transaction.type,
      amount: transaction.amount,
      publicKey: transaction.publicKey,
      eventId: transaction.eventId,
      transactionHash: transaction.transactionHash,
      category: transaction.category ?? null,
      tags: transaction.tags ?? [],
      ledgerSequence: transaction.ledgerSequence,
      poolId: transaction.poolId,
      metadata: transaction.metadata,
      createdAt: createdAt.toISOString(),
      formattedDate: createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      formattedTime: createdAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      // Add assetId for interceptor formatting (will be enriched by interceptor)
      assetId,
    } as TransactionResponseDto;
  }

  async tagTransaction(userId: string, transactionId: string, payload: any) {
    const tx = await this.transactionRepository.findOne({
      where: { id: transactionId, userId },
    });

    if (!tx) {
      return { ok: false, message: 'Transaction not found' };
    }

    // Handle tags
    if (payload?.tags) {
      const current = tx.tags ?? [];
      const incoming = Array.isArray(payload.tags) ? payload.tags : [];

      if (payload.action === 'remove') {
        tx.tags = current.filter((t) => !incoming.includes(t));
      } else if (payload.action === 'set') {
        tx.tags = incoming;
      } else {
        // add
        const set = new Set(current.concat(incoming));
        tx.tags = Array.from(set);
      }
    }

    if (typeof payload?.category === 'string') {
      tx.category = payload.category;
    }

    await this.transactionRepository.save(tx);

    return { ok: true, transaction: this.transformToResponseDto(tx) };
  }

  async listCategories(userId: string) {
    const rows = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('DISTINCT transaction.category', 'category')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.category IS NOT NULL')
      .orderBy('transaction.category', 'ASC')
      .getRawMany();

    return rows.map((r) => r.category);
  }

  async bulkTag(userId: string, body: any) {
    // Support ids-based operations for now
    if (!body?.ids || !Array.isArray(body.ids) || !body.ids.length) {
      return { ok: false, message: 'No ids provided' };
    }

    const txs = await this.transactionRepository.findBy({
      id: body.ids,
      userId,
    });

    for (const tx of txs) {
      if (body.tags) {
        const current = tx.tags ?? [];
        const incoming = Array.isArray(body.tags) ? body.tags : [];

        if (body.action === 'remove') {
          tx.tags = current.filter((t) => !incoming.includes(t));
        } else if (body.action === 'set') {
          tx.tags = incoming;
        } else {
          const set = new Set(current.concat(incoming));
          tx.tags = Array.from(set);
        }
      }

      if (typeof body.category === 'string') {
        tx.category = body.category;
      }
    }

    await this.transactionRepository.save(txs);

    return { ok: true, count: txs.length };
  }

  /**
   * Extract asset ID from transaction metadata or return default
   */
  private extractAssetId(transaction: LedgerTransaction): string {
    // Check metadata for asset information
    if (transaction.metadata?.assetId) {
      return transaction.metadata.assetId as string;
    }

    if (transaction.metadata?.contractId) {
      return transaction.metadata.contractId as string;
    }

    // Check if poolId corresponds to a known asset
    // For now, default to USDC as it's the primary asset
    return 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
  }

  async autoCategorizeTransaction(userId: string, transactionId: string) {
    const tx = await this.transactionRepository.findOne({
      where: { id: transactionId, userId },
    });

    if (!tx) {
      return { ok: false, message: 'Transaction not found' };
    }

    const category = this.autoCategorizationService.predictCategory(tx.metadata);
    if (category) {
      tx.category = category;
      await this.transactionRepository.save(tx);
    }

    return { ok: true, transaction: this.transformToResponseDto(tx) };
  }

  async autoCategorizeAll(userId: string) {
    const txs = await this.transactionRepository.findBy({
      userId,
      category: null,
    });

    let updatedCount = 0;
    for (const tx of txs) {
      const category = this.autoCategorizationService.predictCategory(tx.metadata);
      if (category) {
        tx.category = category;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await this.transactionRepository.save(txs);
    }

    return { ok: true, updated: updatedCount };
  }

  async getTagAnalytics(userId: string) {
    const tagCounts = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('unnest(transaction.tags)', 'tag')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.userId = :userId', { userId })
      .groupBy('tag')
      .orderBy('count', 'DESC')
      .getRawMany();

    const categoryStats = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('transaction.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.category IS NOT NULL')
      .groupBy('transaction.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      tags: tagCounts.map(t => ({ tag: t.tag, count: parseInt(t.count) })),
      categories: categoryStats.map(c => ({ category: c.category, count: parseInt(c.count) })),
    };
  }
}
