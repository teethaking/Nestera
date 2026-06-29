import { Controller, Post, Body, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import express from 'express';

@Controller()
class BodyLimitTestController {
  @Post('accept')
  accept(@Body() body: { data: string }) {
    return { received: body.data };
  }
}

@Module({
  controllers: [BodyLimitTestController],
})
class BodyLimitTestModule {}

describe('Request Body Size Limits', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BodyLimitTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(express.json({ limit: '100kb' }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts requests within size limit', async () => {
    const res = await request(app.getHttpServer())
      .post('/accept')
      .set('Content-Type', 'application/json')
      .send({ data: 'small payload' })
      .expect(201);

    expect(res.body).toEqual({ received: 'small payload' });
  });

  it('rejects requests exceeding size limit with 413', async () => {
    const largePayload = { data: 'x'.repeat(200 * 1024) };

    const res = await request(app.getHttpServer())
      .post('/accept')
      .set('Content-Type', 'application/json')
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('returns standardized error response format for oversized request', async () => {
    const largePayload = { data: 'x'.repeat(200 * 1024) };

    const res = await request(app.getHttpServer())
      .post('/accept')
      .set('Content-Type', 'application/json')
      .send(largePayload);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty('statusCode', 413);
    expect(res.body).toHaveProperty('errorCode');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('path');
  });
});