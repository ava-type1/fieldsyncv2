import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing sync
vi.mock('../db', () => ({
  db: {
    syncQueue: {
      add: vi.fn().mockResolvedValue(1),
      count: vi.fn().mockResolvedValue(0),
      where: vi.fn().mockReturnValue({
        below: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
        aboveOrEqual: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
          modify: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    phases: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
    photos: {
      get: vi.fn().mockResolvedValue(null),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
    issues: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
    materials: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          modify: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  },
}));

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
      }),
    },
  },
}));

// Import after mocks are set up
import { syncEngine } from '../sync';

describe('SyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('should add a listener and return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = syncEngine.subscribe(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should remove listener when unsubscribe is called', () => {
      const callback = vi.fn();
      const unsubscribe = syncEngine.subscribe(callback);
      unsubscribe();

      // Callback should not be called after unsubscribe
      // (we'd need to trigger an event to fully test this)
    });
  });

  describe('getPendingCount', () => {
    it('should return the count of pending items', async () => {
      const count = await syncEngine.getPendingCount();
      expect(typeof count).toBe('number');
    });
  });

  describe('getFailedCount', () => {
    it('should return the count of failed items', async () => {
      const count = await syncEngine.getFailedCount();
      expect(typeof count).toBe('number');
    });
  });

  describe('queueOperation', () => {
    it('should queue an insert operation', async () => {
      const callback = vi.fn();
      syncEngine.subscribe(callback);

      await syncEngine.queueOperation({
        type: 'insert',
        table: 'phases',
        data: { id: 'test-123', status: 'completed' },
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'operation-queued',
        })
      );
    });

    it('should queue an update operation', async () => {
      const callback = vi.fn();
      syncEngine.subscribe(callback);

      await syncEngine.queueOperation({
        type: 'update',
        table: 'phases',
        data: { id: 'test-123', status: 'in_progress' },
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'operation-queued',
        })
      );
    });
  });

  describe('processQueue', () => {
    it('should emit sync-start and sync-complete events', async () => {
      const callback = vi.fn();
      syncEngine.subscribe(callback);

      await syncEngine.processQueue();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync-start' })
      );
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync-complete' })
      );
    });

    it('should not process when offline', async () => {
      // Simulate offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

      const callback = vi.fn();
      syncEngine.subscribe(callback);

      await syncEngine.processQueue();

      // Should not emit any events when offline
      expect(callback).not.toHaveBeenCalled();

      // Restore online status
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
    });
  });

  describe('retryFailed', () => {
    it('should reset attempts for failed items', async () => {
      await syncEngine.retryFailed();
      // This should not throw
    });
  });

  describe('clearFailed', () => {
    it('should delete failed items from queue', async () => {
      await syncEngine.clearFailed();
      // This should not throw
    });
  });
});
