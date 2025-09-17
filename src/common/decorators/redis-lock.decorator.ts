import { SetMetadata } from '@nestjs/common';

export const REDIS_LOCK_KEY = 'redis_lock';
export const RedisLock = (lockKey: string, ttl: number = 60000) =>
  SetMetadata(REDIS_LOCK_KEY, { lockKey, ttl });
