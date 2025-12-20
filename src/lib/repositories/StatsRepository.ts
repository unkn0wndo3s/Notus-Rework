import { BaseRepository } from "./BaseRepository";

export class StatsRepository extends BaseRepository {
  async initializeTables(): Promise<void> {
    // No initialization needed for stats
  }

  private async addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string): Promise<void> {
    try {
      await this.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinition}`);
    } catch (error) {
      // Ignore error if column already exists
    }
  }

  private async ensureSharesShareAt(): Promise<void> {
    await this.addColumnIfNotExists("shares", "share_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  }

  async getTotalUsers(): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users"
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getTotalDocuments(): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM documents"
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getTotalShares(): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM shares"
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getUsersCreatedSince(days: number): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '1 day' * $1",
      [days]
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getDocumentsCreatedSince(days: number): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM documents WHERE created_at >= NOW() - INTERVAL '1 day' * $1",
      [days]
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getSharesCreatedSince(days: number): Promise<number> {
    // Ensure the share_at column exists
    await this.ensureSharesShareAt();
    
    // Check if the column exists before making the query
    try {
      const result = await this.query<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM shares s
         JOIN documents d ON s.id_doc = d.id
         WHERE COALESCE(s.share_at, d.created_at) >= NOW() - INTERVAL '1 day' * $1`,
        [days]
      );
      return Number.parseInt(result.rows[0]?.count || "0", 10);

    } catch (error) {
      // If the column still doesn't exist, return the total
      console.warn("⚠️ share_at column not available for shares, using total");
      return await this.getTotalShares();
    }
  }

  async getVerifiedUsers(): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE email_verified = true"
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getBannedUsers(): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE is_banned = true"
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getAdminUsers(): Promise<number> {
    const result = await this.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE is_admin = true"
    );
    return Number.parseInt(result.rows[0]?.count || "0", 10);

  }

  async getUsersGroupedByPeriod(period: 'day' | 'week' | 'month' | 'year'): Promise<Array<{ date: string; count: number }>> {
    let dateFormat: string;
    let interval: string;
    let groupBy: string;
    
    switch (period) {
      case 'day':
        dateFormat = "TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD')";
        interval = "7 days";
        groupBy = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        dateFormat = "TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD')";
        interval = "4 weeks";
        groupBy = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateFormat = "TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD')";
        interval = "12 months";
        groupBy = "DATE_TRUNC('month', created_at)";
        break;
      case 'year':
        dateFormat = "TO_CHAR(DATE_TRUNC('year', created_at), 'YYYY-MM-DD')";
        interval = "10 years";
        groupBy = "DATE_TRUNC('year', created_at)";
        break;
    }

    try {
      const result = await this.query<{ date: string; count: string }>(
        `SELECT ${dateFormat} as date, COUNT(*) as count
         FROM users
         WHERE created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY ${groupBy}
         ORDER BY date ASC`
      );

      return result.rows.map(row => ({
        date: row.date,
        count: Number.parseInt(row.count || "0", 10),
      }));
    } catch (error) {
      console.warn("⚠️ Error retrieving grouped users:", error);
      return [];
    }
  }

  async getDocumentsGroupedByPeriod(period: 'day' | 'week' | 'month' | 'year'): Promise<Array<{ date: string; count: number }>> {
    let dateFormat: string;
    let interval: string;
    let groupBy: string;
    
    switch (period) {
      case 'day':
        dateFormat = "TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD')";
        interval = "7 days";
        groupBy = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        dateFormat = "TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD')";
        interval = "4 weeks";
        groupBy = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateFormat = "TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD')";
        interval = "12 months";
        groupBy = "DATE_TRUNC('month', created_at)";
        break;
      case 'year':
        dateFormat = "TO_CHAR(DATE_TRUNC('year', created_at), 'YYYY-MM-DD')";
        interval = "10 years";
        groupBy = "DATE_TRUNC('year', created_at)";
        break;
    }

    try {
      const result = await this.query<{ date: string; count: string }>(
        `SELECT ${dateFormat} as date, COUNT(*) as count
         FROM documents
         WHERE created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY ${groupBy}
         ORDER BY date ASC`
      );

      return result.rows.map(row => ({
        date: row.date,
        count: Number.parseInt(row.count || "0", 10),
      }));
    } catch (error) {
      console.warn("⚠️ Error retrieving grouped documents:", error);
      return [];
    }
  }

  async getSharesGroupedByPeriod(period: 'day' | 'week' | 'month' | 'year'): Promise<Array<{ date: string; count: number }>> {
    await this.ensureSharesShareAt();
    
    let dateFormat: string;
    let interval: string;
    let groupBy: string;
    
    switch (period) {
      case 'day':
        dateFormat = "TO_CHAR(DATE_TRUNC('day', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "7 days";
        groupBy = "DATE_TRUNC('day', COALESCE(s.share_at, d.created_at))";
        break;
      case 'week':
        dateFormat = "TO_CHAR(DATE_TRUNC('week', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "4 weeks";
        groupBy = "DATE_TRUNC('week', COALESCE(s.share_at, d.created_at))";
        break;
      case 'month':
        dateFormat = "TO_CHAR(DATE_TRUNC('month', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "12 months";
        groupBy = "DATE_TRUNC('month', COALESCE(s.share_at, d.created_at))";
        break;
      case 'year':
        dateFormat = "TO_CHAR(DATE_TRUNC('year', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "10 years";
        groupBy = "DATE_TRUNC('year', COALESCE(s.share_at, d.created_at))";
        break;
    }

    try {
      const result = await this.query<{ date: string; count: string }>(
        `SELECT ${dateFormat} as date, COUNT(*) as count
         FROM shares s
         JOIN documents d ON s.id_doc = d.id
         WHERE COALESCE(s.share_at, d.created_at) >= NOW() - INTERVAL '${interval}'
         GROUP BY ${groupBy}
         ORDER BY date ASC`
      );

      return result.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count || "0", 10),
      }));
    } catch (error) {
      console.warn("⚠️ Error retrieving grouped shares:", error);
      return [];
    }
  }
}
