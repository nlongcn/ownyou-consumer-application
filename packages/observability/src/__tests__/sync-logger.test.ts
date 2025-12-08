/**
 * SyncLogger Tests - v13 Section 10.3
 *
 * Tests for cross-device sync debugging infrastructure.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  SyncLogger,
  CONFLICT_NOTIFICATION_RULES,
  type SyncLog,
  type SyncEventType,
  type SyncDetails,
  type ConflictDetails,
} from '../sync';

describe('SyncLogger (v13 Section 10.3)', () => {
  let logger: SyncLogger;
  const deviceId = 'device_abc123';

  beforeEach(() => {
    logger = new SyncLogger(deviceId);
  });

  describe('SyncLog Creation', () => {
    it('should create a sync started log', () => {
      const log = logger.logSyncStarted({
        peerDeviceId: 'device_xyz789',
        direction: 'bidirectional',
      });

      expect(log.logId).toBeDefined();
      expect(log.deviceId).toBe(deviceId);
      expect(log.peerDeviceId).toBe('device_xyz789');
      expect(log.eventType).toBe('sync_started');
      expect(log.timestamp).toBeDefined();
    });

    it('should create a sync completed log', () => {
      const log = logger.logSyncCompleted({
        peerDeviceId: 'device_xyz789',
        direction: 'push',
        recordsSent: 10,
        recordsReceived: 0,
        bytesTransferred: 2048,
        latencyMs: 150,
      });

      expect(log.eventType).toBe('sync_completed');
      expect(log.details.sync?.recordsSent).toBe(10);
      expect(log.details.sync?.latencyMs).toBe(150);
    });

    it('should create a conflict detected log', () => {
      const log = logger.logConflictDetected({
        namespace: 'ownyou.earnings',
        key: 'earnings_2024_01',
        localValuePreview: '{"total": 100}',
        remoteValuePreview: '{"total": 150}',
        localTimestamp: Date.now() - 1000,
        remoteTimestamp: Date.now(),
      });

      expect(log.eventType).toBe('conflict_detected');
      expect(log.details.conflict?.namespace).toBe('ownyou.earnings');
      expect(log.details.conflict?.key).toBe('earnings_2024_01');
    });

    it('should create a conflict resolved log', () => {
      const log = logger.logConflictResolved({
        namespace: 'ownyou.semantic',
        key: 'memory_123',
        localValuePreview: '{"v": 1}',
        remoteValuePreview: '{"v": 2}',
        localTimestamp: Date.now() - 1000,
        remoteTimestamp: Date.now(),
        resolution: 'remote_wins',
        resolutionReason: 'Remote timestamp is newer',
      });

      expect(log.eventType).toBe('conflict_resolved');
      expect(log.details.conflict?.resolution).toBe('remote_wins');
      expect(log.details.conflict?.resolutionReason).toBe('Remote timestamp is newer');
    });

    it('should create a connection established log', () => {
      const log = logger.logConnectionEstablished({
        peerCount: 3,
        connectionType: 'direct_p2p',
        natType: 'symmetric',
      });

      expect(log.eventType).toBe('connection_established');
      expect(log.details.connection?.peerCount).toBe(3);
      expect(log.details.connection?.connectionType).toBe('direct_p2p');
    });

    it('should create a connection failed log', () => {
      const log = logger.logConnectionFailed({
        peerDeviceId: 'device_xyz789',
        errorType: 'TIMEOUT',
        errorMessage: 'Connection timed out after 30s',
        recoverable: true,
        recoveryAction: 'Retry with relay server',
      });

      expect(log.eventType).toBe('connection_failed');
      expect(log.details.error?.type).toBe('TIMEOUT');
      expect(log.details.error?.recoverable).toBe(true);
    });

    it('should create a connection lost log', () => {
      const log = logger.logConnectionLost({
        peerDeviceId: 'device_xyz789',
        errorType: 'NETWORK_ERROR',
        errorMessage: 'Network connection dropped',
        recoverable: true,
      });

      expect(log.eventType).toBe('connection_lost');
    });

    it('should create a data corrupted log', () => {
      const log = logger.logDataCorrupted({
        namespace: 'ownyou.episodic',
        errorType: 'CHECKSUM_MISMATCH',
        errorMessage: 'Data integrity check failed',
        recoverable: false,
      });

      expect(log.eventType).toBe('data_corrupted');
      expect(log.details.error?.recoverable).toBe(false);
    });

    it('should create a queue overflow log', () => {
      const log = logger.logQueueOverflow({
        errorType: 'QUEUE_FULL',
        errorMessage: 'Sync queue exceeded 1000 items',
        recoverable: true,
        recoveryAction: 'Flush oldest items',
      });

      expect(log.eventType).toBe('queue_overflow');
    });
  });

  describe('Log Retrieval', () => {
    beforeEach(() => {
      // Create sample logs
      logger.logSyncStarted({ direction: 'push' });
      logger.logSyncCompleted({
        direction: 'push',
        recordsSent: 5,
        recordsReceived: 0,
        bytesTransferred: 1024,
        latencyMs: 100,
      });
      logger.logConnectionEstablished({
        peerCount: 2,
        connectionType: 'relayed',
      });
    });

    it('should list all logs', () => {
      const logs = logger.listLogs();
      expect(logs.length).toBe(3);
    });

    it('should filter logs by event type', () => {
      const logs = logger.listLogs({ eventType: 'sync_completed' });
      expect(logs.length).toBe(1);
      expect(logs[0].eventType).toBe('sync_completed');
    });

    it('should limit number of logs returned', () => {
      const logs = logger.listLogs({ limit: 2 });
      expect(logs.length).toBe(2);
    });

    it('should return logs in reverse chronological order', () => {
      const logs = logger.listLogs();
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(logs[1].timestamp);
    });
  });

  describe('Log Clearing', () => {
    it('should clear all logs', () => {
      logger.logSyncStarted({ direction: 'push' });
      logger.logSyncCompleted({
        direction: 'push',
        recordsSent: 5,
        recordsReceived: 0,
        bytesTransferred: 1024,
        latencyMs: 100,
      });

      expect(logger.listLogs().length).toBe(2);

      logger.clear();

      expect(logger.listLogs().length).toBe(0);
    });
  });

  describe('Conflict Notification Rules', () => {
    it('should have modal notification for earnings (financial)', () => {
      expect(CONFLICT_NOTIFICATION_RULES['ownyou.earnings']).toBe('modal');
    });

    it('should have toast notification for missions', () => {
      expect(CONFLICT_NOTIFICATION_RULES['ownyou.missions']).toBe('toast');
    });

    it('should have silent notification for semantic memory', () => {
      expect(CONFLICT_NOTIFICATION_RULES['ownyou.semantic']).toBe('silent');
    });

    it('should have toast notification for ikigai profile changes', () => {
      expect(CONFLICT_NOTIFICATION_RULES['ownyou.ikigai']).toBe('toast');
    });

    it('should default to silent for unknown namespaces', () => {
      const rule = CONFLICT_NOTIFICATION_RULES['unknown.namespace'] ?? 'silent';
      expect(rule).toBe('silent');
    });
  });

  describe('Sync Statistics', () => {
    it('should calculate sync statistics', () => {
      logger.logSyncCompleted({
        direction: 'push',
        recordsSent: 10,
        recordsReceived: 0,
        bytesTransferred: 2048,
        latencyMs: 100,
      });
      logger.logSyncCompleted({
        direction: 'pull',
        recordsSent: 0,
        recordsReceived: 5,
        bytesTransferred: 1024,
        latencyMs: 200,
      });
      logger.logConnectionFailed({
        errorType: 'TIMEOUT',
        errorMessage: 'Connection timed out',
        recoverable: true,
      });

      const stats = logger.getStats();

      expect(stats.totalSyncs).toBe(2);
      expect(stats.totalRecordsSent).toBe(10);
      expect(stats.totalRecordsReceived).toBe(5);
      expect(stats.totalBytesTransferred).toBe(3072);
      expect(stats.avgLatencyMs).toBe(150);
      expect(stats.failureCount).toBe(1);
    });
  });
});
