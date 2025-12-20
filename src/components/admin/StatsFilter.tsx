"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type StatsFilterType = "all" | "users" | "documents" | "shares";

interface StatsFilterProps {
  value: StatsFilterType;
  onValueChange: (value: StatsFilterType) => void;
  className?: string;
}

export default function StatsFilter({ value, onValueChange, className }: StatsFilterProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label htmlFor="stats-filter" className="text-sm font-medium text-foreground">
        Filter by:
      </label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="stats-filter" className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statistics</SelectItem>
          <SelectItem value="users">Users only</SelectItem>
          <SelectItem value="documents">Documents only</SelectItem>
          <SelectItem value="shares">Shared notes only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

