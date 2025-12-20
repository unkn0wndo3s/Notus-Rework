import { Card } from "@/components/ui";
import { BaseRepository } from "@/lib/repositories/BaseRepository";
import StatsContent from "@/components/admin/StatsContent";

class StatsRepository extends BaseRepository {
  async initializeTables(): Promise<void> {
    // No need to initialize for stats
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
    // Ensure share_at column exists
    await this.ensureSharesShareAt();
    
    // Check if column exists before making the query
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
      // If column still doesn't exist, return total
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
}

async function getStats() {
  try {
    const statsRepository = new StatsRepository();
    
    const [
      totalUsers,
      totalDocuments,
      totalShares,
      usersLast7Days,
      usersLast30Days,
      documentsLast7Days,
      documentsLast30Days,
      sharesLast7Days,
      sharesLast30Days,
      verifiedUsers,
      bannedUsers,
      adminUsers,
    ] = await Promise.all([
      statsRepository.getTotalUsers(),
      statsRepository.getTotalDocuments(),
      statsRepository.getTotalShares(),
      statsRepository.getUsersCreatedSince(7),
      statsRepository.getUsersCreatedSince(30),
      statsRepository.getDocumentsCreatedSince(7),
      statsRepository.getDocumentsCreatedSince(30),
      statsRepository.getSharesCreatedSince(7),
      statsRepository.getSharesCreatedSince(30),
      statsRepository.getVerifiedUsers(),
      statsRepository.getBannedUsers(),
      statsRepository.getAdminUsers(),
    ]);

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        banned: bannedUsers,
        admins: adminUsers,
        last7Days: usersLast7Days,
        last30Days: usersLast30Days,
      },
      documents: {
        total: totalDocuments,
        last7Days: documentsLast7Days,
        last30Days: documentsLast30Days,
      },
      shares: {
        total: totalShares,
        last7Days: sharesLast7Days,
        last30Days: sharesLast30Days,
      },
    };
  } catch (error) {
    console.error("❌ Error retrieving stats:", error);
    return null;
  }
}

export default async function AdminStatsPage() {
  const stats = await getStats();

  return (
    <main className="space-y-6">
      <header className="text-center pt-10">
        <h1 className="text-3xl font-bold text-foreground">
          Application Statistics
        </h1>
        <p className="mt-2 text-muted-foreground">
          Notus data overview
        </p>
      </header>

      {stats && <StatsContent stats={stats} />}
      {!stats && (
        <section className="max-w-4xl mx-auto">
          <Card className="bg-background">
            <Card.Content className="p-8 text-center">
              <p className="text-muted-foreground">
                Unable to load statistics
              </p>
            </Card.Content>
          </Card>
        </section>
      )}
    </main>
  );
}

