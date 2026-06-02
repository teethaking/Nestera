import { GracefulShutdownService } from '../services/graceful-shutdown.service';

export function ShutdownTrackedTask(taskName?: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      return descriptor;
    }

    descriptor.value = async function (...args: unknown[]) {
      const resolvedTaskName =
        taskName ?? `${target.constructor.name}.${String(propertyKey)}`;

      return GracefulShutdownService.runTrackedTask(resolvedTaskName, () =>
        Promise.resolve(originalMethod.apply(this, args)),
      );
    };

    return descriptor;
  };
}
