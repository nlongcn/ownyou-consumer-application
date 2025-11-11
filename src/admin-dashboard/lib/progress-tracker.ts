/**
 * Progress Tracker - IndexedDB-based job tracking for browser PWA
 *
 * Replaces Python's in-memory `running_jobs` dict with persistent browser storage.
 * Tracks email download and classification progress.
 */

export interface JobConfig {
  userId: string
  provider: 'gmail' | 'outlook' | 'both'
  maxEmails: number
  emailModel?: string
  taxonomyModel?: string
  skipSummarization?: boolean
}

export interface ProgressUpdate {
  jobId: string
  userId: string
  status: 'pending' | 'downloading' | 'classifying' | 'completed' | 'failed'
  step: 'download' | 'classify' | 'complete'
  processed: number
  total: number
  logs: string[]
  error?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export interface LogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error'
  message: string
  jobId: string
}

const DB_NAME = 'ownyou_progress'
const DB_VERSION = 1
const JOBS_STORE = 'jobs'
const LOGS_STORE = 'logs'

export class ProgressTracker {
  private db: IDBDatabase | null = null

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Jobs store
        if (!db.objectStoreNames.contains(JOBS_STORE)) {
          const jobStore = db.createObjectStore(JOBS_STORE, { keyPath: 'jobId' })
          jobStore.createIndex('userId', 'userId', { unique: false })
          jobStore.createIndex('status', 'status', { unique: false })
          jobStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // Logs store
        if (!db.objectStoreNames.contains(LOGS_STORE)) {
          const logStore = db.createObjectStore(LOGS_STORE, { keyPath: 'id', autoIncrement: true })
          logStore.createIndex('jobId', 'jobId', { unique: false })
          logStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  /**
   * Create a new job
   */
  async createJob(config: JobConfig): Promise<string> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const job: ProgressUpdate = {
      jobId,
      userId: config.userId,
      status: 'pending',
      step: 'download',
      processed: 0,
      total: config.maxEmails,
      logs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE], 'readwrite')
      const store = transaction.objectStore(JOBS_STORE)
      const request = store.add(job)

      request.onsuccess = () => {
        this.log('info', `Job created: ${jobId}`, jobId)
        resolve(jobId)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Update job progress
   */
  async updateProgress(jobId: string, update: Partial<ProgressUpdate>): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE], 'readwrite')
      const store = transaction.objectStore(JOBS_STORE)
      const getRequest = store.get(jobId)

      getRequest.onsuccess = () => {
        const job = getRequest.result
        if (!job) {
          reject(new Error(`Job not found: ${jobId}`))
          return
        }

        // Merge update
        const updatedJob: ProgressUpdate = {
          ...job,
          ...update,
          updatedAt: new Date(),
          completedAt: update.status === 'completed' || update.status === 'failed'
            ? new Date()
            : job.completedAt,
        }

        const putRequest = store.put(updatedJob)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ProgressUpdate | null> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE], 'readonly')
      const store = transaction.objectStore(JOBS_STORE)
      const request = store.get(jobId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get all jobs for a user
   */
  async getAllJobs(userId: string, limit: number = 50): Promise<ProgressUpdate[]> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE], 'readonly')
      const store = transaction.objectStore(JOBS_STORE)
      const index = store.index('userId')
      const request = index.getAll(userId)

      request.onsuccess = () => {
        const jobs = request.result || []
        // Sort by createdAt DESC, limit
        const sorted = jobs
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, limit)
        resolve(sorted)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Log a message
   */
  async log(level: 'info' | 'warn' | 'error', message: string, jobId: string): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const logEntry: Omit<LogEntry, 'id'> & { id?: number } = {
      timestamp: new Date(),
      level,
      message,
      jobId,
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([LOGS_STORE], 'readwrite')
      const store = transaction.objectStore(LOGS_STORE)
      const request = store.add(logEntry)

      request.onsuccess = () => {
        // Also add to job's logs array for quick access
        this.addLogToJob(jobId, message).catch(console.error)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Add log message to job's logs array
   */
  private async addLogToJob(jobId: string, message: string): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE], 'readwrite')
      const store = transaction.objectStore(JOBS_STORE)
      const getRequest = store.get(jobId)

      getRequest.onsuccess = () => {
        const job = getRequest.result
        if (!job) {
          resolve() // Job not found, ignore
          return
        }

        job.logs = [...(job.logs || []), message].slice(-100) // Keep last 100 logs
        job.updatedAt = new Date()

        const putRequest = store.put(job)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      }

      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  /**
   * Get logs for a job
   */
  async getLogs(jobId: string, limit: number = 100): Promise<LogEntry[]> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([LOGS_STORE], 'readonly')
      const store = transaction.objectStore(LOGS_STORE)
      const index = store.index('jobId')
      const request = index.getAll(jobId)

      request.onsuccess = () => {
        const logs = request.result || []
        // Sort by timestamp DESC, limit
        const sorted = logs
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit)
        resolve(sorted)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Delete a job and its logs
   */
  async deleteJob(jobId: string): Promise<void> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE, LOGS_STORE], 'readwrite')

      // Delete job
      const jobStore = transaction.objectStore(JOBS_STORE)
      const jobRequest = jobStore.delete(jobId)

      // Delete logs
      const logStore = transaction.objectStore(LOGS_STORE)
      const logIndex = logStore.index('jobId')
      const logRequest = logIndex.openCursor(IDBKeyRange.only(jobId))

      logRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  /**
   * Clear all completed jobs older than N days
   */
  async clearOldJobs(daysOld: number = 7): Promise<number> {
    await this.init()
    if (!this.db) throw new Error('Database not initialized')

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([JOBS_STORE], 'readwrite')
      const store = transaction.objectStore(JOBS_STORE)
      const index = store.index('status')
      const request = index.openCursor(IDBKeyRange.only('completed'))

      let deletedCount = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const job = cursor.value as ProgressUpdate
          if (job.completedAt && new Date(job.completedAt) < cutoffDate) {
            this.deleteJob(job.jobId).catch(console.error)
            deletedCount++
          }
          cursor.continue()
        } else {
          resolve(deletedCount)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Singleton instance
let trackerInstance: ProgressTracker | null = null

export function getProgressTracker(): ProgressTracker {
  if (!trackerInstance) {
    trackerInstance = new ProgressTracker()
  }
  return trackerInstance
}
