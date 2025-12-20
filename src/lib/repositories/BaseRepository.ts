import { Pool } from "pg";
import { QueryResult } from "../types";

type InitializationState = {
  initialized: boolean;
  promise: Promise<void> | null;
};

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Connection test
pool.on("connect", () => {});

pool.on("error", (err: Error) => {
  console.error("❌ PostgreSQL connection error:", err);
  process.exit(-1);
});

const repositoryInitialization = new Map<string, InitializationState>();

// Base class for repositories
export abstract class BaseRepository {
  protected pool = pool;

  public async query<T = unknown>(text: string, params?: unknown[], retries: number = 3): Promise<QueryResult<T>> {
    const start = Date.now();
    let lastError: unknown;
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await this.pool.query(text, params);
        const duration = Date.now() - start;
        return res;
      } catch (error: any) {
        lastError = error;
        
        // Retry on deadlock (PostgreSQL error code 40P01)
        if (error?.code === '40P01' && attempt < retries - 1) {
          const backoffMs = Math.min(100 * Math.pow(2, attempt), 1000);
          console.warn(`⚠️ Deadlock detected, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        
        console.error("❌ Query error:", error);
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Ensure that heavy initialization logic only runs once per repository (and that
   * concurrent calls await the same promise).
   */
  protected async ensureInitialized(initializer: () => Promise<void>): Promise<void> {
    const key = this.constructor.name;
    const existing = repositoryInitialization.get(key);

    if (existing?.initialized) {
      return;
    }

    if (existing?.promise) {
      await existing.promise;
      return;
    }

    const initPromise = (async () => {
      try {
        await initializer();
        repositoryInitialization.set(key, { initialized: true, promise: null });
      } catch (error) {
        repositoryInitialization.delete(key);
        throw error;
      }
    })();

    repositoryInitialization.set(key, { initialized: false, promise: initPromise });
    await initPromise;
  }

  /**
   * Acquire an advisory lock to serialize initialization operations.
   * Uses a hash of the class name to generate a unique lock ID.
   */
  protected async withAdvisoryLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockId = this.getAdvisoryLockId();
    const client = await this.pool.connect();
    
    try {
      // Try to acquire the lock (non-blocking would be pg_advisory_lock_try, but we use blocking for safety)
      // We use pg_advisory_lock which blocks until the lock is available
      await client.query('SELECT pg_advisory_lock($1)', [lockId]);
      
      try {
        return await operation();
      } finally {
        // Always release the lock
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Generate a unique advisory lock ID based on the class name.
   * Uses a simple hash function to convert the class name to a number.
   */
  private getAdvisoryLockId(): number {
    const className = this.constructor.name;
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      const char = className.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Use a large number range to avoid conflicts (PostgreSQL advisory locks use int8)
    // We'll use the lower 32 bits and add a base offset
    return Math.abs(hash) + 1000000;
  }

  // Method to initialize tables (to be implemented in specialized repositories)
  abstract initializeTables(): Promise<void>;
}

export { pool };
