"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsChart from "./StatsChart";
import { cn } from "@/lib/utils";
import { getAdminStatsAction } from "@/actions/adminActions";


type StatPeriod = 'day' | 'week' | 'month' | 'year';
type StatType = 'users' | 'documents' | 'shares';

interface StatChartSectionProps {
  type: StatType;
  title: string;
  initialPeriod?: StatPeriod;
  className?: string;
}

export default function StatChartSection({ 
  type, 
  title, 
  initialPeriod = 'week',
  className 
}: Readonly<StatChartSectionProps>) {
  const [period, setPeriod] = useState<StatPeriod>(initialPeriod);
  const [chartData, setChartData] = useState<Array<{ date: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await getAdminStatsAction(type, period);
        if (!mounted) return;

        if (result.success && result.data) {
          setChartData(result.data);
        }
      } catch (error) {
        if (mounted) {
          console.error(`❌ Error retrieving ${type} data:`, error);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [type, period]);

  // Reusable function to process period data
  const processPeriodData = (
    data: Array<{ date: string; count: number }>,
    periodType: StatPeriod
  ): Array<{ name: string; value: number; date: string }> => {
    // Create a map of existing data with dates from the API
    const dataMap = new Map<string, number>();
    if (data && data.length > 0) {
      data.forEach((item) => {
        dataMap.set(item.date, item.count);
      });
    }

    // Helper for week processing
    if (periodType === 'week') {
      return processWeekData(dataMap);
    }

    // Define configuration based on period type
    const config = getPeriodConfig(periodType);
    if (!config) return [];

    const { count, dateFormat, dateLabel, dateModifier } = config;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periods: Array<{ name: string; value: number; date: string }> = [];

    // Generate all periods
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(today);
        dateModifier(date, i);
        
        const dateStr = dateFormat(date);
        periods.push({
          name: dateLabel(date),
          value: dataMap.get(dateStr) || 0,
          date: dateStr,
        });
    }

    return periods;
  };

  const processWeekData = (dataMap: Map<string, number>) => {
      const periods: Array<{ name: string; value: number; date: string }> = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate Monday of the current week
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentWeekMonday = new Date(today);
      currentWeekMonday.setDate(today.getDate() - daysToMonday);
      currentWeekMonday.setHours(0, 0, 0, 0);
      
      const formatDate = (d: Date) => {
        const day = d.getDate();
        const month = d.getMonth() + 1;
        return `${day}/${month}`;
      };
      
      // Generate the last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekMonday = new Date(currentWeekMonday);
        weekMonday.setDate(currentWeekMonday.getDate() - (i * 7));
        
        const weekEnd = new Date(weekMonday);
        weekEnd.setDate(weekMonday.getDate() + 6);
        
        const dateStr = weekMonday.toISOString().split('T')[0];
        
        // Search in dataMap with the exact date
        let value = dataMap.get(dateStr) || 0;
        
        // If not found, try to normalize API dates and compare
        if (value === 0 && dataMap.size > 0) {
          for (const [apiDate, apiCount] of dataMap.entries()) {
            const apiDateNormalized = new Date(apiDate + 'T00:00:00').toISOString().split('T')[0];
            if (apiDateNormalized === dateStr) {
              value = apiCount;
              break;
            }
          }
        }
        
        periods.push({
          name: `${formatDate(weekMonday)}-${formatDate(weekEnd)}`,
          value: value,
          date: dateStr,
        });
      }
      return periods;
  };

  const getPeriodConfig = (pType: StatPeriod) => {
    switch (pType) {
        case 'day':
          return {
            count: 7,
            dateFormat: (d: Date) => d.toISOString().split("T")[0],
            dateLabel: (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`,
            dateModifier: (d: Date, i: number) => {
                d.setDate(d.getDate() - i);
                d.setHours(0, 0, 0, 0);
            }
          };
        case 'month':
          return {
            count: 12,
            dateFormat: (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
            dateLabel: (d: Date) => {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            },
            dateModifier: (d: Date, i: number) => {
                d.setMonth(d.getMonth() - i);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
            }
          };
        case 'year':
          return {
            count: 10,
            dateFormat: (d: Date) => `${d.getFullYear()}-01-01`,
            dateLabel: (d: Date) => String(d.getFullYear()),
            dateModifier: (d: Date, i: number) => {
                d.setFullYear(d.getFullYear() - i);
                d.setMonth(0);
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
            }
          };
        default:
          return null;
    }
  };

  const periodData = processPeriodData(chartData, period);

  const periodLabel = {
    day: 'day',
    week: 'week',
    month: 'month',
    year: 'year',
  }[period];

  const typeLabel = {
    users: 'users',
    documents: 'documents',
    shares: 'shared notes',
  }[type];

  return (
    <Card className={cn("bg-background", className)}>
      <Card.Header>
        <div className="flex items-center justify-between">
          <Card.Title className="text-foreground text-2xl font-semibold">

            {title}
          </Card.Title>
          <Select value={period} onValueChange={(value) => setPeriod(value as StatPeriod)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">By day (last 7 days)</SelectItem>
              <SelectItem value="week">By week (last 4 weeks)</SelectItem>
              <SelectItem value="month">By month</SelectItem>
              <SelectItem value="year">By year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card.Header>
      <Card.Content>
        {(() => {
          if (loading) {
            return (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            );
          }
          if (periodData.length > 0) {
            return (
              <StatsChart
                data={periodData}
                type="line"
                dataKey="value"
                title={`Number of ${typeLabel} created per ${periodLabel}`}
              />
            );
          }
          return (
            <div className="flex items-center justify-center h-[300px]">
              <p className="text-muted-foreground">No data available</p>
            </div>
          );
        })()}
      </Card.Content>
    </Card>
  );
}
