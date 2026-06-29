import { BadRequestException } from '@nestjs/common';

export interface CursorPayload {
  createdAt: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(raw) as CursorPayload;
    if (!payload?.createdAt || !payload?.id) {
      throw new Error('Invalid cursor payload');
    }
    if (Number.isNaN(new Date(payload.createdAt).getTime())) {
      throw new Error('Invalid cursor timestamp');
    }
    return payload;
  } catch {
    throw new BadRequestException('Invalid pagination cursor');
  }
}
