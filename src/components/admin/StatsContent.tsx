"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import StatCard from "@/components/admin/StatCard";
import StatChartSection from "@/components/admin/StatChartSection";
import StatsFilter, { StatsFilterType } from "./StatsFilter";

interface StatsData {
  users: {
    total: number;
    verified: number;
    banned: number;
    admins: number;
    last7Days: number;
    last30Days: number;
  };
  documents: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
  shares: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
}

interface StatsContentProps {
  stats: StatsData;
}

export default function StatsContent({ stats }: StatsContentProps) {
  const [filter, setFilter] = useState<StatsFilterType>("all");

  const showUsers = filter === "all" || filter === "users";
  const showDocuments = filter === "all" || filter === "documents";
  const showShares = filter === "all" || filter === "shares";

  return (
    <>
      <div className="max-w-4xl mx-auto flex justify-center">
        <StatsFilter value={filter} onValueChange={setFilter} />
      </div>

      {showUsers && (
        <section className="max-w-4xl mx-auto space-y-6 text-card-foreground rounded-2xl border border-border p-6 bg-background">
          <Card className="bg-background border-none p-0">
            <Card.Header>
              <Card.Title className="text-foreground text-2xl font-semibold">
                Users
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total users"
                  value={stats.users.total}
                  icon="users"
                />
                <StatCard
                  title="Verified users"
                  value={stats.users.verified}
                  icon="circleCheck"
                  subtitle={`${Math.round((stats.users.verified / stats.users.total) * 100) || 0}% of the total`}
                />
                <StatCard
                  title="Banned users"
                  value={stats.users.banned}
                  icon="alert"
                />
                <StatCard
                  title="Administrators"
                  value={stats.users.admins}
                  icon="shieldCheck"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <StatCard
                  title="New users (7 days)"
                  value={stats.users.last7Days}
                  icon="users"
                />
                <StatCard
                  title="New users (30 days)"
                  value={stats.users.last30Days}
                  icon="users"
                />
              </div>
            </Card.Content>
          </Card>
          <StatChartSection
            type="users"
            title="Evolution"
            initialPeriod="week"
            className="border-none p-0"
          />
        </section>
      )}

      {showDocuments && (
        <section className="max-w-4xl mx-auto space-y-6 text-card-foreground rounded-2xl border border-border p-6 bg-background">
          <Card className="bg-background border-none p-0">
            <Card.Header>
              <Card.Title className="text-foreground text-2xl font-semibold">
                Documents
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Total documents"
                  value={stats.documents.total}
                  icon="document"
                />
                <StatCard
                  title="Documents created (7 days)"
                  value={stats.documents.last7Days}
                  icon="document"
                />
                <StatCard
                  title="Documents created (30 days)"
                  value={stats.documents.last30Days}
                  icon="document"
                />
              </div>
            </Card.Content>
          </Card>
          <StatChartSection
            type="documents"
            title="Evolution"
            initialPeriod="week"
            className="border-none p-0"
          />
        </section>
      )}

      {showShares && (
        <section className="max-w-4xl mx-auto space-y-6 text-card-foreground rounded-2xl border border-border p-6 bg-background">
          <Card className="bg-background border-none p-0">
            <Card.Header>
              <Card.Title className="text-foreground text-2xl font-semibold">
                Shares
              </Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  title="Total shares"
                  value={stats.shares.total}
                  icon="share"
                />
                <StatCard
                  title="Shares created (7 days)"
                  value={stats.shares.last7Days}
                  icon="share"
                />
                <StatCard
                  title="Shares created (30 days)"
                  value={stats.shares.last30Days}
                  icon="share"
                />
              </div>
            </Card.Content>
          </Card>
          <StatChartSection
            type="shares"
            title="Evolution"
            initialPeriod="week"
            className="border-none p-0"
          />
        </section>
      )}
    </>
  );
}

