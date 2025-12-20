"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatsChart from "./StatsChart";
import { cn } from "@/lib/utils";

interface StatChartSectionProps {
  type: 'users' | 'documents' | 'shares';
  title: string;
  initialPeriod?: 'day' | 'week' | 'month' | 'year';
  className?: string;
}

export default function StatChartSection({ 
  type, 
  title, 
  initialPeriod = 'week',
  className 
}: Readonly<StatChartSectionProps>) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>(initialPeriod);
  const [chartData, setChartData] = useState<Array<{ date: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/stats?type=${type}&period=${period}`);
        const data = await response.json();
        if (data.success && data.data) {
          setChartData(data.data);
        }
      } catch (error) {
        console.error(`❌ Error retrieving ${type} data:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [type, period]);

  // Reusable function to process period data
  const processPeriodData = (
    data: Array<{ date: string; count: number }>,
    periodType: 'day' | 'week' | 'month' | 'year'
  ): Array<{ name: string; value: number; date: string }> => {
    // Create a map of existing data with dates from the API
    const dataMap = new Map<string, number>();
    if (data && data.length > 0) {
      data.forEach((item) => {
        dataMap.set(item.date, item.count);
      });
    }

    // For week, generate all 4 weeks and fill with 0
    if (periodType === 'week') {
      const periods: Array<{ name: string; value: number; date: string }> = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Calculate Monday of the current week (compatible with PostgreSQL DATE_TRUNC('week'))
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
        
        // Date format to match PostgreSQL (YYYY-MM-DD)
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
    }

    // For day, month, and year, generate all periods and fill with 0
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periods: Array<{ name: string; value: number; date: string }> = [];
    let count: number;
    let dateFormat: (date: Date) => string;
    let dateLabel: (date: Date) => string;

    switch (periodType) {
      case 'day':
        count = 7;
        dateFormat = (date: Date) => {
          return date.toISOString().split("T")[0];
        };
        dateLabel = (date: Date) => {
          const day = date.getDate();
          const month = date.getMonth() + 1;
          return `${day}/${month}`;
        };
        break;
      case 'month':
        count = 12;
        dateFormat = (date: Date) => {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        };
        dateLabel = (date: Date) => {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        };
        break;
      case 'year':
        count = 10;
        dateFormat = (date: Date) => {
          return `${date.getFullYear()}-01-01`;
        };
        dateLabel = (date: Date) => {
          return String(date.getFullYear());
        };
        break;
      default:
        return [];
    }

    // Generate all periods
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(today);
      
      if (periodType === 'day') {
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
      } else if (periodType === 'month') {
        date.setMonth(date.getMonth() - i);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
      } else if (periodType === 'year') {
        date.setFullYear(date.getFullYear() - i);
        date.setMonth(0);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
      }
      
      const dateStr = dateFormat(date);
      periods.push({
        name: dateLabel(date),
        value: dataMap.get(dateStr) || 0,
        date: dateStr,
      });
    }

    return periods;
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
          <Select value={period} onValueChange={(value) => setPeriod(value as 'day' | 'week' | 'month' | 'year')}>
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
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : periodData.length > 0 ? (
          <StatsChart
            data={periodData}
            type="line"
            dataKey="value"
            title={`Number of ${typeLabel} created per ${periodLabel}`}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
