import { Controller, Get, Post, Body, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import compression from 'compression';

@Controller()
class CompressionTestController {
  @Get('large-payload')
  getLargePayload() {
    return {
      items: Array.from({ length: 5000 }, (_, index) => ({
        id: index + 1,
        value: `Payload entry number ${index + 1}`,
      })),
    };
  }

  @Get('small-payload')
  getSmallPayload() {
    return { items: [{ id: 1, value: 'small' }] };
  }

  @Post('post-large')
  postLargePayload(@Body() body: { items: unknown[] }) {
    return { items: body.items };
  }
}

@Module({
  controllers: [CompressionTestController],
})
class CompressionTestModule {}

describe('Compression middleware', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CompressionTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(
      compression({
        threshold: 1024,
        brotli: { enabled: true },
        filter: (req, res) => {
          const contentType = res.getHeader('Content-Type') as string;
          if (contentType?.includes('application/pdf')) {
            return false;
          }
          return compression.filter(req, res);
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('compresses large responses using gzip when requested', async () => {
    await request(app.getHttpServer())
      .get('/large-payload')
      .set('Accept-Encoding', 'gzip')
      .expect('Content-Encoding', /gzip/)
      .expect(200);
  });

  it('compresses large responses using brotli when requested', async () => {
    await request(app.getHttpServer())
      .get('/large-payload')
      .set('Accept-Encoding', 'br')
      .expect('Content-Encoding', /br/)
      .expect(200);
  });

  it('does not compress small responses below threshold', async () => {
    await request(app.getHttpServer())
      .get('/small-payload')
      .set('Accept-Encoding', 'gzip')
      .expect((res) => {
        if (res.headers['content-encoding']) {
          throw new Error('Small response should not be compressed');
        }
      })
      .expect(200);
  });

  it('returns uncompressed response when client does not accept encoding', async () => {
    await request(app.getHttpServer())
      .get('/large-payload')
      .unset('Accept-Encoding')
      .expect((res) => {
        if (res.headers['content-encoding']) {
          throw new Error('Response should not be compressed without Accept-Encoding');
        }
      })
      .expect(200);
  });

  it('handles POST requests with large payloads', async () => {
    const largeItems = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      data: 'x'.repeat(100),
    }));

    await request(app.getHttpServer())
      .post('/post-large')
      .set('Accept-Encoding', 'gzip')
      .set('Content-Type', 'application/json')
      .send({ items: largeItems })
      .expect(201);
  });
});