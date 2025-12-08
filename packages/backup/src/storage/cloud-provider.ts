/**
 * Cloud Provider Implementations - v13 Section 5.4
 *
 * Abstractions for different cloud storage backends.
 */

import type {
  CloudProvider,
  BackupManifest,
  BackupHistoryEntry,
} from '../types.js';

/**
 * OwnYou Cloud Provider
 *
 * Uses OwnYou's managed backup service.
 */
export class OwnYouCloudProvider implements CloudProvider {
  private endpoint: string;
  private authToken: string;

  constructor(endpoint: string, authToken: string) {
    this.endpoint = endpoint;
    this.authToken = authToken;
  }

  async upload(
    backupId: string,
    data: Uint8Array,
    manifest: BackupManifest
  ): Promise<void> {
    const formData = new FormData();
    formData.append('backup', new Blob([data]), `${backupId}.enc`);
    formData.append('manifest', JSON.stringify(manifest));

    const response = await fetch(`${this.endpoint}/backups/${backupId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
  }

  async download(
    backupId: string
  ): Promise<{ data: Uint8Array; manifest: BackupManifest }> {
    const response = await fetch(`${this.endpoint}/backups/${backupId}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const manifest = JSON.parse(
      response.headers.get('X-Backup-Manifest') || '{}'
    ) as BackupManifest;
    const data = new Uint8Array(await response.arrayBuffer());

    return { data, manifest };
  }

  async list(): Promise<BackupHistoryEntry[]> {
    const response = await fetch(`${this.endpoint}/backups`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`List failed: ${response.statusText}`);
    }

    return response.json();
  }

  async delete(backupId: string): Promise<void> {
    const response = await fetch(`${this.endpoint}/backups/${backupId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  async getStorageUsage(): Promise<{ used: number; limit: number }> {
    const response = await fetch(`${this.endpoint}/storage/usage`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Get storage usage failed: ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * In-Memory Cloud Provider (for testing)
 */
export class InMemoryCloudProvider implements CloudProvider {
  private backups = new Map<
    string,
    { data: Uint8Array; manifest: BackupManifest }
  >();

  async upload(
    backupId: string,
    data: Uint8Array,
    manifest: BackupManifest
  ): Promise<void> {
    this.backups.set(backupId, { data, manifest });
  }

  async download(
    backupId: string
  ): Promise<{ data: Uint8Array; manifest: BackupManifest }> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }
    return backup;
  }

  async list(): Promise<BackupHistoryEntry[]> {
    return Array.from(this.backups.entries()).map(([backupId, { manifest }]) => ({
      backupId,
      timestamp: manifest.createdAt,
      size: manifest.compressedSize,
      isIncremental: manifest.isIncremental,
      namespaceCount: manifest.namespaces.length,
      recordCount: Object.values(manifest.recordCounts).reduce((a, b) => a + b, 0),
    }));
  }

  async delete(backupId: string): Promise<void> {
    this.backups.delete(backupId);
  }

  async getStorageUsage(): Promise<{ used: number; limit: number }> {
    let used = 0;
    for (const { data } of this.backups.values()) {
      used += data.byteLength;
    }
    return { used, limit: 1024 * 1024 * 1024 }; // 1GB limit
  }

  // Test helpers
  clear(): void {
    this.backups.clear();
  }

  getBackupCount(): number {
    return this.backups.size;
  }
}

/**
 * S3-Compatible Cloud Provider
 *
 * Works with AWS S3, MinIO, DigitalOcean Spaces, etc.
 */
export class S3CloudProvider implements CloudProvider {
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private endpoint?: string;

  constructor(config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  }) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.endpoint = config.endpoint;
  }

  async upload(
    backupId: string,
    data: Uint8Array,
    manifest: BackupManifest
  ): Promise<void> {
    // In production, use AWS SDK or fetch with SigV4
    // This is a simplified placeholder
    const url = this.getObjectUrl(backupId);

    // Upload backup data
    await fetch(url, {
      method: 'PUT',
      body: data,
      headers: this.getAuthHeaders('PUT', backupId),
    });

    // Upload manifest as separate object
    await fetch(`${url}.manifest`, {
      method: 'PUT',
      body: JSON.stringify(manifest),
      headers: {
        ...this.getAuthHeaders('PUT', `${backupId}.manifest`),
        'Content-Type': 'application/json',
      },
    });
  }

  async download(
    backupId: string
  ): Promise<{ data: Uint8Array; manifest: BackupManifest }> {
    const url = this.getObjectUrl(backupId);

    // Download backup data
    const dataResponse = await fetch(url, {
      headers: this.getAuthHeaders('GET', backupId),
    });

    if (!dataResponse.ok) {
      throw new Error(`Download failed: ${dataResponse.statusText}`);
    }

    // Download manifest
    const manifestResponse = await fetch(`${url}.manifest`, {
      headers: this.getAuthHeaders('GET', `${backupId}.manifest`),
    });

    const data = new Uint8Array(await dataResponse.arrayBuffer());
    const manifest = (await manifestResponse.json()) as BackupManifest;

    return { data, manifest };
  }

  async list(): Promise<BackupHistoryEntry[]> {
    // In production, use ListObjectsV2
    // This is a placeholder
    throw new Error('S3 list not implemented - use AWS SDK');
  }

  async delete(backupId: string): Promise<void> {
    const url = this.getObjectUrl(backupId);

    await fetch(url, {
      method: 'DELETE',
      headers: this.getAuthHeaders('DELETE', backupId),
    });

    await fetch(`${url}.manifest`, {
      method: 'DELETE',
      headers: this.getAuthHeaders('DELETE', `${backupId}.manifest`),
    });
  }

  async getStorageUsage(): Promise<{ used: number; limit: number }> {
    // Would need to sum object sizes
    throw new Error('S3 storage usage not implemented - use AWS SDK');
  }

  private getObjectUrl(key: string): string {
    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/ownyou-backups/${key}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/ownyou-backups/${key}`;
  }

  private getAuthHeaders(
    _method: string,
    _key: string
  ): Record<string, string> {
    // In production, implement AWS SigV4 signing
    // This is a placeholder
    return {};
  }
}
