import { of, firstValueFrom } from 'rxjs';
import { HttpException } from '@nestjs/common';
import { GracefulShutdownInterceptor } from './graceful-shutdown.interceptor';
import { GracefulShutdownService } from '../services/graceful-shutdown.service';

describe('GracefulShutdownInterceptor', () => {
  const createContext = () => ({
    context: {
      switchToHttp: () => ({
        getResponse: () => ({
          setHeader: jest.fn(),
        }),
      }),
    },
  });

  it('rejects new requests while shutdown is in progress', async () => {
    const gracefulShutdown = {
      isShutdown: jest.fn().mockReturnValue(true),
      incrementActiveRequests: jest.fn(),
      decrementActiveRequests: jest.fn(),
    } as unknown as GracefulShutdownService;
    const interceptor = new GracefulShutdownInterceptor(gracefulShutdown);
    const { context } = createContext();

    await expect(
      firstValueFrom(
        interceptor.intercept(
          context as never,
          {
            handle: () => of('ok'),
          } as never,
        ),
      ),
    ).rejects.toBeInstanceOf(HttpException);

    expect(gracefulShutdown.incrementActiveRequests).not.toHaveBeenCalled();
  });

  it('tracks accepted requests until completion', async () => {
    const gracefulShutdown = {
      isShutdown: jest.fn().mockReturnValue(false),
      incrementActiveRequests: jest.fn(),
      decrementActiveRequests: jest.fn(),
    } as unknown as GracefulShutdownService;
    const interceptor = new GracefulShutdownInterceptor(gracefulShutdown);
    const { context } = createContext();

    await firstValueFrom(
      interceptor.intercept(
        context as never,
        {
          handle: () => of('ok'),
        } as never,
      ),
    );

    expect(gracefulShutdown.incrementActiveRequests).toHaveBeenCalled();
    expect(gracefulShutdown.decrementActiveRequests).toHaveBeenCalled();
  });
});
