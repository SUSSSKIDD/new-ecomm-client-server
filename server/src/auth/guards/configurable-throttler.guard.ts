import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard that can be disabled via THROTTLE_DISABLED=true env var.
 * Used in test/E2E environments where rate limiting blocks batch operations.
 */
@Injectable()
export class ConfigurableThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    if (process.env.THROTTLE_DISABLED === 'true') {
      return true;
    }
    return super.shouldSkip(_context);
  }
}
