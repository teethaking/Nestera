import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { Transaction } from './entities/transaction.entity';
import { User } from '../user/entities/user.entity';
import { Receipt } from './entities/receipt.entity';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  async generateReceipt(
    userId: string,
    transactionId: string,
  ): Promise<Buffer> {
    const transaction = await this.transactionRepository.findOne({
      where: { id: transactionId, userId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const pdfBuffer = this.createPdfReceipt(transaction, user);

    // Store receipt with access control
    const verificationRef = this.generateVerificationRef(transaction);
    const accessKey = uuidv4();
    
    const receipt = this.receiptRepository.create({
      userId,
      transactionId,
      pdfData: pdfBuffer,
      verificationReference: verificationRef,
      accessKey,
      isPublic: false,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      accessCount: 0,
    });

    await this.receiptRepository.save(receipt);
    this.logger.log(`Receipt generated and stored for transaction ${transactionId}`);

    return pdfBuffer;
  }

  async getReceipt(
    userId: string,
    receiptId: string,
    accessKey?: string,
  ): Promise<{ pdfData: Buffer; contentType: string }> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    // Access control check
    if (receipt.userId !== userId && !receipt.isPublic) {
      if (!accessKey || receipt.accessKey !== accessKey) {
        throw new NotFoundException('Access denied');
      }
    }

    // Check expiration
    if (receipt.expiresAt && receipt.expiresAt < new Date()) {
      throw new NotFoundException('Receipt has expired');
    }

    // Update access tracking
    receipt.lastAccessedAt = new Date();
    receipt.accessCount += 1;
    await this.receiptRepository.save(receipt);

    return {
      pdfData: receipt.pdfData,
      contentType: 'application/pdf',
    };
  }

  async listReceipts(userId: string): Promise<Receipt[]> {
    return this.receiptRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteReceipt(userId: string, receiptId: string): Promise<void> {
    const receipt = await this.receiptRepository.findOne({
      where: { id: receiptId, userId },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    await this.receiptRepository.delete(receiptId);
    this.logger.log(`Receipt ${receiptId} deleted by user ${userId}`);
  }

  private createPdfReceipt(transaction: Transaction, user: User): Buffer {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {});

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Nestera Payment Receipt', {
      align: 'center',
    });
    doc.moveDown();

    // Receipt details
    doc.fontSize(12).font('Helvetica');
    doc.text(`Receipt ID: ${transaction.id}`, { align: 'right' });
    doc.text(`Date: ${transaction.createdAt.toLocaleDateString()}`, {
      align: 'right',
    });
    doc.text(`Time: ${transaction.createdAt.toLocaleTimeString()}`, {
      align: 'right',
    });
    doc.moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Transaction details
    doc.fontSize(14).font('Helvetica-Bold').text('Transaction Details');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    this.addReceiptField(doc, 'Transaction Type', transaction.type);
    this.addReceiptField(doc, 'Amount', `${transaction.amount} XLM`);
    this.addReceiptField(doc, 'Status', transaction.status);
    this.addReceiptField(doc, 'Transaction Hash', transaction.txHash || 'N/A');
    this.addReceiptField(doc, 'Event ID', transaction.eventId || 'N/A');
    this.addReceiptField(doc, 'Ledger Sequence', transaction.ledgerSequence || 'N/A');
    this.addReceiptField(doc, 'Pool ID', transaction.poolId || 'N/A');
    this.addReceiptField(doc, 'Category', transaction.category || 'N/A');
    
    if (transaction.tags && transaction.tags.length > 0) {
      this.addReceiptField(doc, 'Tags', transaction.tags.join(', '));
    }

    doc.moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // User details
    doc.fontSize(14).font('Helvetica-Bold').text('User Information');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    this.addReceiptField(doc, 'User ID', user.id);
    this.addReceiptField(doc, 'Name', user.name || 'N/A');
    this.addReceiptField(doc, 'Email', user.email);
    this.addReceiptField(doc, 'Public Key', user.publicKey || 'N/A');

    doc.moveDown();

    // Divider
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Verification section
    doc.fontSize(14).font('Helvetica-Bold').text('Verification');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    this.addReceiptField(doc, 'Verification Reference', this.generateVerificationRef(transaction));
    this.addReceiptField(doc, 'Generated At', new Date().toISOString());

    doc.moveDown();

    // Footer
    doc.fontSize(9).font('Helvetica').text(
      'This is an official receipt from Nestera. For verification purposes, please contact support@nestera.io.',
      { align: 'center' },
    );

    doc.end();

    return Buffer.concat(chunks);
  }

  private addReceiptField(doc: PDFDocument, label: string, value: string): void {
    doc.fontSize(10).font('Helvetica-Bold').text(`${label}:`, { continued: true });
    doc.fontSize(10).font('Helvetica').text(` ${value}`);
    doc.moveDown(0.3);
  }

  private generateVerificationRef(transaction: Transaction): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const txIdShort = transaction.id.slice(0, 8).toUpperCase();
    return `REF-${txIdShort}-${timestamp}`;
  }
}
