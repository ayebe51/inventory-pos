import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

// Minimal Redis client mock
const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

// ioredis exports Redis as default; jest.mock must mirror that shape
jest.mock('ioredis', () => {
  function RedisMock() {
    return redisMock;
  }
  RedisMock.Cluster = function ClusterMock() {
    return {
      ...redisMock,
      nodes: jest.fn(() => [redisMock]),
    };
  };
  return { default: RedisMock, Cluster: RedisMock.Cluster };
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    redisMock.quit.mockResolvedValue('OK');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const cfg: Record<string, unknown> = {
                'redis.isCluster': false,
                'redis.host': 'localhost',
                'redis.port': 6379,
                'redis.password': undefined,
                'redis.ttlSeconds': 300,
              };
              return cfg[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('get', () => {
    it('returns parsed value when key exists', async () => {
      redisMock.get.mockResolvedValue(JSON.stringify({ id: '1', name: 'Product A' }));
      const result = await service.get<{ id: string; name: string }>('master:product:1');
      expect(result).toEqual({ id: '1', name: 'Product A' });
    });

    it('returns null when key does not exist', async () => {
      redisMock.get.mockResolvedValue(null);
      const result = await service.get('missing-key');
      expect(result).toBeNull();
    });

    it('returns null and does not throw on Redis error', async () => {
      redisMock.get.mockRejectedValue(new Error('connection refused'));
      await expect(service.get('key')).resolves.toBeNull();
    });
  });

  describe('set', () => {
    it('stores JSON-serialized value with default TTL', async () => {
      redisMock.set.mockResolvedValue('OK');
      await service.set('master:product:1', { id: '1' });
      expect(redisMock.set).toHaveBeenCalledWith(
        'master:product:1',
        JSON.stringify({ id: '1' }),
        'EX',
        300,
      );
    });

    it('uses custom TTL when provided', async () => {
      redisMock.set.mockResolvedValue('OK');
      await service.set('key', 'value', 60);
      expect(redisMock.set).toHaveBeenCalledWith('key', JSON.stringify('value'), 'EX', 60);
    });

    it('does not throw on Redis error', async () => {
      redisMock.set.mockRejectedValue(new Error('timeout'));
      await expect(service.set('key', 'value')).resolves.toBeUndefined();
    });
  });

  describe('del', () => {
    it('deletes a key', async () => {
      redisMock.del.mockResolvedValue(1);
      await service.del('master:product:1');
      expect(redisMock.del).toHaveBeenCalledWith('master:product:1');
    });

    it('does not throw on Redis error', async () => {
      redisMock.del.mockRejectedValue(new Error('timeout'));
      await expect(service.del('key')).resolves.toBeUndefined();
    });
  });

  describe('delByPattern', () => {
    it('scans and deletes matching keys', async () => {
      redisMock.scan
        .mockResolvedValueOnce(['0', ['master:product:1', 'master:product:2']]);
      redisMock.del.mockResolvedValue(2);

      await service.delByPattern('master:product:*');
      expect(redisMock.del).toHaveBeenCalledWith('master:product:1', 'master:product:2');
    });

    it('does not throw on Redis error', async () => {
      redisMock.scan.mockRejectedValue(new Error('timeout'));
      await expect(service.delByPattern('master:*')).resolves.toBeUndefined();
    });
  });

  describe('key helpers', () => {
    it('masterKey returns correct format', () => {
      expect(service.masterKey('product', 'abc-123')).toBe('master:product:abc-123');
    });

    it('masterListKey returns deterministic key for same filters', () => {
      const filters = { page: 1, search: 'test' };
      const key1 = service.masterListKey('product', filters);
      const key2 = service.masterListKey('product', filters);
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^master:product:list:[a-f0-9]{8}$/);
    });

    it('masterListKey returns different keys for different filters', () => {
      const key1 = service.masterListKey('product', { page: 1 });
      const key2 = service.masterListKey('product', { page: 2 });
      expect(key1).not.toBe(key2);
    });

    it('masterPattern returns wildcard pattern', () => {
      expect(service.masterPattern('product')).toBe('master:product:*');
    });
  });
});
