"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface ChartData {
  name: string;
  value?: number;
  [key: string]: string | number | undefined;
}

interface StatsChartProps {
  readonly data: ChartData[];
  readonly type?: "bar" | "line" | "pie";
  readonly dataKey?: string;
  readonly series?: string[];
  readonly title?: string;
  readonly className?: string;
  readonly colors?: string[];
}

// Function to get the computed color from a CSS variable
const getComputedColor = (cssVar: string): string => {
  if (typeof globalThis.window === "undefined") {
    // SSR Fallback - approximate values based on tokens
    const fallbacks: Record<string, string> = {
      "var(--primary)": "#9d4edd",
      "var(--accent)": "#9d4edd",
      "var(--success)": "#4ade80",
      "var(--warning)": "#fbbf24",
      "var(--destructive)": "#ef4444",
    };
    return fallbacks[cssVar] || "#9d4edd";
  }
  
  const tempEl = globalThis.window.document.createElement("div");
  tempEl.style.color = cssVar;
  globalThis.window.document.body.appendChild(tempEl);
  const computed = globalThis.window.getComputedStyle(tempEl).color;
  globalThis.window.document.body.removeChild(tempEl);
  
  // Convert rgb/rgba to hex if necessary
  if (computed.startsWith("rgb")) {
    const rgb = computed.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const r = parseInt(rgb[0], 10).toString(16).padStart(2, "0");
      const g = parseInt(rgb[1], 10).toString(16).padStart(2, "0");
      const b = parseInt(rgb[2], 10).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }
  }
  
  return computed || "#9d4edd";
};

const DEFAULT_COLORS = [
  "var(--primary)",
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--destructive)",
];

export default function StatsChart({
  data,
  type = "bar",
  dataKey = "value",
  series,
  title,
  className,
  colors = DEFAULT_COLORS,
}: StatsChartProps) {
  // Convert CSS colors to usable values (client-side only)
  const [computedColors, setComputedColors] = useState<string[]>(() => {
    // SSR Fallback - approximate values
    return colors.map((color) => {
      if (color.startsWith("var(")) {
        const fallbacks: Record<string, string> = {
          "var(--primary)": "#9d4edd",
          "var(--accent)": "#9d4edd",
          "var(--success)": "#4ade80",
          "var(--warning)": "#fbbf24",
          "var(--destructive)": "#ef4444",
        };
        return fallbacks[color] || "#9d4edd";
      }
      return color;
    });
  });

  useEffect(() => {
    // Calculate actual colors on the client side
    const newColors = colors.map((color) => 
      color.startsWith("var(") ? getComputedColor(color) : color
    );
    setComputedColors(newColors);
  }, [colors]);

  const chartConfig = {
    text: "var(--foreground)",
    grid: "var(--border)",
    tooltip: {
      backgroundColor: "var(--card)",
      border: "var(--border)",
      text: "var(--foreground)",
    },
  };

  const renderChart = () => {
    switch (type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartConfig.grid} />
              <XAxis
                dataKey="name"
                stroke={chartConfig.text}
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke={chartConfig.text}
                style={{ fontSize: "12px" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Legend
                wrapperStyle={{ color: "var(--foreground)" }}
              />
              {series && series.length > 0 ? (
                series.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={computedColors[index % computedColors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))
              ) : (
                <Bar dataKey={dataKey} fill={computedColors[0]} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartConfig.grid} />
              <XAxis
                dataKey="name"
                stroke={chartConfig.text}
                style={{ fontSize: "12px" }}
              />
              <YAxis
                stroke={chartConfig.text}
                style={{ fontSize: "12px" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Legend
                wrapperStyle={{ color: "var(--foreground)" }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={computedColors[0]}
                strokeWidth={2}
                dot={{ fill: computedColors[0], r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={80}
                fill={computedColors[0]}
                dataKey={dataKey}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={computedColors[index % computedColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--foreground)",
                }}
              />
              <Legend
                wrapperStyle={{ color: "var(--foreground)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <figure className={cn("w-full", className)}>
      {title && (
        <figcaption className="text-sm font-semibold text-foreground mb-4">
          {title}
        </figcaption>
      )}
      {renderChart()}
    </figure>
  );
}

