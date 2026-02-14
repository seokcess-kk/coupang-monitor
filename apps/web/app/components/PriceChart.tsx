"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Snapshot {
  id: string;
  optionKey: string;
  price: number | null;
  statusCode: string;
  checkedAt: string;
}

interface PriceChartProps {
  snapshots: Snapshot[];
  variantFilter?: string | null;
}

export default function PriceChart({ snapshots, variantFilter }: PriceChartProps) {
  const chartData = useMemo(() => {
    // Filter and process snapshots
    const filtered = variantFilter
      ? snapshots.filter((s) => s.optionKey === variantFilter)
      : snapshots;

    // Group by date and calculate min price per day
    const dailyData = new Map<string, { date: string; minPrice: number; prices: number[] }>();

    filtered.forEach((s) => {
      if (s.price === null || s.statusCode !== "OK") return;

      const date = new Date(s.checkedAt).toISOString().split("T")[0];
      const existing = dailyData.get(date);

      if (existing) {
        existing.prices.push(s.price);
        existing.minPrice = Math.min(existing.minPrice, s.price);
      } else {
        dailyData.set(date, {
          date,
          minPrice: s.price,
          prices: [s.price],
        });
      }
    });

    // Convert to array and sort by date
    return Array.from(dailyData.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: formatDateShort(d.date),
        price: d.minPrice,
        avgPrice: Math.round(d.prices.reduce((sum, p) => sum + p, 0) / d.prices.length),
      }));
  }, [snapshots, variantFilter]);

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        <p>가격 데이터가 없습니다.</p>
      </div>
    );
  }

  const minPrice = Math.min(...chartData.map((d) => d.price));
  const maxPrice = Math.max(...chartData.map((d) => d.price));
  const padding = Math.max((maxPrice - minPrice) * 0.1, 1000);

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="date"
            stroke="#666"
            fontSize={12}
            tickMargin={10}
          />
          <YAxis
            domain={[minPrice - padding, maxPrice + padding]}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            stroke="#666"
            fontSize={12}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()}원`, "가격"]}
            labelStyle={{ color: "#333" }}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="price"
            name="최저가"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ fill: "#2563eb", strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
