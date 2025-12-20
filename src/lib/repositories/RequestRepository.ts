import { BaseRepository } from "./BaseRepository";

export interface Request {
  id: number;
  user_id: number;
  type: "help" | "data_restoration" | "other";
  title: string;
  description: string;
  status: "pending" | "in_progress" | "resolved" | "rejected";
  validated: boolean;
  validated_by?: number | null;
  validated_at?: Date | null;
  created_at: Date;
  updated_at: Date;
  user_email?: string;
  user_name?: string;
  validator_email?: string;
  validator_name?: string;
}

export interface CreateRequestData {
  user_id: number;
  type: "help" | "data_restoration" | "other";
  title: string;
  description: string;
}

export interface UpdateRequestData {
  status?: "pending" | "in_progress" | "resolved" | "rejected";
  validated?: boolean;
  validated_by?: number | null;
  validated_at?: Date | null;
}

export interface RequestRepositoryResult<T> {
  success: boolean;
  data?: T;
  request?: T;
  requests?: T[];
  error?: string;
}

export class RequestRepository extends BaseRepository {
  async initializeTables(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      return;
    }

    return this.ensureInitialized(async () => {
      try {
        // User requests table
        await this.query(`
          CREATE TABLE IF NOT EXISTS user_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL DEFAULT 'other',
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            validated BOOLEAN DEFAULT FALSE,
            validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            validated_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Create indexes
        await this.createIndexes();

        // Create triggers
        await this.createTriggers();
      } catch (error) {
        console.error("❌ Error initializing user_requests table:", error);
        throw error;
      }
    });
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_user_requests_user_id ON user_requests(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_user_requests_status ON user_requests(status)",
      "CREATE INDEX IF NOT EXISTS idx_user_requests_validated ON user_requests(validated)",
      "CREATE INDEX IF NOT EXISTS idx_user_requests_created_at ON user_requests(created_at DESC)",
    ];

    for (const indexQuery of indexes) {
      await this.query(indexQuery);
    }
  }

  private async createTriggers(): Promise<void> {
    // Function to update updated_at
    await this.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Trigger for user_requests
    await this.query(`
      DROP TRIGGER IF EXISTS update_user_requests_updated_at ON user_requests;
      CREATE TRIGGER update_user_requests_updated_at
        BEFORE UPDATE ON user_requests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  async createRequest(data: CreateRequestData): Promise<RequestRepositoryResult<Request>> {
    try {
      const result = await this.query<Request>(
        `INSERT INTO user_requests (user_id, type, title, description, status, validated)
         VALUES ($1, $2, $3, $4, 'pending', FALSE)
         RETURNING id, user_id, type, title, description, status, validated, validated_by, validated_at, created_at, updated_at`,
        [data.user_id, data.type, data.title, data.description]
      );

      if (result.rows.length === 0) {
        return { success: false, error: "Error creating request" };
      }

      return { success: true, request: result.rows[0] };
    } catch (error) {
      console.error("❌ Error creating request:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getRequestById(id: number): Promise<RequestRepositoryResult<Request>> {
    try {
      const result = await this.query<Request & { user_email: string; user_name: string; validator_email: string; validator_name: string }>(
        `SELECT r.*, 
                u.email as user_email, 
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                v.email as validator_email,
                CONCAT(v.first_name, ' ', v.last_name) as validator_name
         FROM user_requests r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN users v ON r.validated_by = v.id
         WHERE r.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return { success: false, error: "Request not found" };
      }

      const row = result.rows[0];
      return {
        success: true,
        request: {
          ...row,
          user_email: row.user_email || "",
          user_name: row.user_name || "",
          validator_email: row.validator_email || "",
          validator_name: row.validator_name || "",
        },
      };
    } catch (error) {
      console.error("❌ Error retrieving request:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAllRequests(limit: number = 100, offset: number = 0): Promise<RequestRepositoryResult<Request>> {
    try {
      const result = await this.query<Request & { user_email: string; user_name: string; validator_email: string; validator_name: string }>(
        `SELECT r.*, 
                u.email as user_email, 
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                v.email as validator_email,
                CONCAT(v.first_name, ' ', v.last_name) as validator_name
         FROM user_requests r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN users v ON r.validated_by = v.id
         ORDER BY r.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const requests: Request[] = result.rows.map((row) => ({
        ...row,
        user_email: row.user_email || "",
        user_name: row.user_name || "",
        validator_email: row.validator_email || "",
        validator_name: row.validator_name || "",
      }));

      return { success: true, requests };
    } catch (error) {
      console.error("❌ Error retrieving requests:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requests: [],
      };
    }
  }

  async getRequestsByUser(userId: number): Promise<RequestRepositoryResult<Request>> {
    try {
      const result = await this.query<Request>(
        `SELECT * FROM user_requests 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      return { success: true, requests: result.rows };
    } catch (error) {
      console.error("❌ Error retrieving user requests:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        requests: [],
      };
    }
  }

  async updateRequest(id: number, data: UpdateRequestData): Promise<RequestRepositoryResult<Request>> {
    try {
      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(data.status);
        paramIndex++;
      }

      if (data.validated !== undefined) {
        updates.push(`validated = $${paramIndex}`);
        values.push(data.validated);
        paramIndex++;
      }

      if (data.validated_by !== undefined) {
        updates.push(`validated_by = $${paramIndex}`);
        values.push(data.validated_by);
        paramIndex++;
      }

      if (data.validated_at !== undefined) {
        updates.push(`validated_at = $${paramIndex}`);
        values.push(data.validated_at);
        paramIndex++;
      }

      if (updates.length === 0) {
        return { success: false, error: "No data to update" };
      }

      values.push(id);
      const result = await this.query<Request>(
        `UPDATE user_requests 
         SET ${updates.join(", ")} 
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return { success: false, error: "Request not found" };
      }

      return { success: true, request: result.rows[0] };
    } catch (error) {
      console.error("❌ Error updating request:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async deleteRequest(id: number): Promise<RequestRepositoryResult<void>> {
    try {
      await this.query("DELETE FROM user_requests WHERE id = $1", [id]);
      return { success: true };
    } catch (error) {
      console.error("❌ Error deleting request:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

