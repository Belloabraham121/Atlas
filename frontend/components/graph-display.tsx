"use client";

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Interface definitions based on FRONTEND_DISPLAY_SPEC.md
interface PriceChartConfig {
  type: 'line' | 'candlestick' | 'bar';
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      backgroundColor?: string;
      fill?: boolean;
    }>;
  };
  options?: {
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    scales?: any;
    plugins?: any;
  };
}

interface TokenMetrics {
  price: number;
  marketCap: number;
  volume24h: number;
  supply: number;
  holders: number;
}

interface PriceHistory {
  timeframe: string;
  data: Array<{
    timestamp: string;
    price: number;
    volume?: number;
  }>;
}

interface GenerateGraphData {
  intent: 'generate_graph';
  displayType: 'price_chart';
  symbol: string;
  timeframe: string;
  chartConfig: PriceChartConfig;
  metadata: {
    currentPrice: number;
    change24h: number;
    volume24h: number;
  };
}

interface GenerateTokenChartData {
  intent: 'generate_token_chart';
  displayType: 'token_chart';
  symbol: string;
  tokenId: string;
  chartConfig: PriceChartConfig;
  tokenMetrics: TokenMetrics;
  priceHistory: PriceHistory;
}

type GraphData = GenerateGraphData | GenerateTokenChartData;

interface GraphDisplayProps {
  graphData: any; // Make it flexible to handle different data structures
  className?: string;
}

// Helper function to format currency
const formatCurrency = (value: number): string => {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toLocaleString()}`;
};

// Helper function to format large numbers
const formatNumber = (value: number): string => {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  }
  return value.toLocaleString();
};

// Helper function to convert chart data to recharts format
const convertToRechartsData = (chartConfig: PriceChartConfig) => {
  const { labels, datasets } = chartConfig.data;
  
  return labels.map((label, index) => {
    const dataPoint: any = { name: label };
    datasets.forEach((dataset, datasetIndex) => {
      dataPoint[`dataset${datasetIndex}`] = dataset.data[index] || 0;
      dataPoint[`label${datasetIndex}`] = dataset.label;
    });
    return dataPoint;
  });
};

// Chart configuration for recharts
const defaultChartConfig = {
  dataset0: {
    label: "Price",
    color: "hsl(var(--chart-1))",
  },
  dataset1: {
    label: "Volume",
    color: "hsl(var(--chart-2))",
  },
};

export function GraphDisplay({ graphData, className }: GraphDisplayProps) {
  console.log('🔍 GraphDisplay received data:', graphData);
  
  // Handle case where graphData might not have the expected structure
  if (!graphData) {
    console.error('❌ GraphDisplay: No graphData provided');
    return <div className="text-red-500">Error: No graph data provided</div>;
  }
  
  // Check for the actual backend data structure: data, options, type
  if (!graphData.data || !graphData.data.datasets || !graphData.type) {
    console.error('❌ GraphDisplay: Invalid data structure. Expected data.datasets and type, got:', graphData);
    return <div className="text-red-500">Error: Invalid graph data structure</div>;
  }
  
  // Convert the backend data structure to the format expected by convertToRechartsData
  const chartConfig = {
    type: graphData.type,
    data: graphData.data,
    options: graphData.options || {}
  };
  
  const rechartsData = convertToRechartsData(chartConfig);

  const renderChart = () => {
    const { type } = chartConfig;
    
    switch (type) {
      case 'line':
        return (
          <LineChart data={rechartsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.data.datasets.map((dataset: any, index: number) => (
              <Line
                key={index}
                type="monotone"
                dataKey={`dataset${index}`}
                stroke={dataset.borderColor || `var(--color-dataset${index})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        );
      
      case 'bar':
        return (
          <BarChart data={rechartsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.data.datasets.map((dataset: any, index: number) => (
              <Bar
                key={index}
                dataKey={`dataset${index}`}
                fill={dataset.backgroundColor || `var(--color-dataset${index})`}
              />
            ))}
          </BarChart>
        );
      
      default:
        return (
          <LineChart data={rechartsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            {chartConfig.data.datasets.map((dataset: any, index: number) => (
              <Line
                key={index}
                type="monotone"
                dataKey={`dataset${index}`}
                stroke={dataset.borderColor || `var(--color-dataset${index})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        );
    }
  };

  const renderTokenHeader = () => {
    if (graphData.intent === 'generate_token_chart') {
      const { tokenMetrics } = graphData;
      return (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{graphData.symbol}</h3>
            <Badge variant="secondary">{graphData.tokenId}</Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(tokenMetrics.price)}</div>
          </div>
        </div>
      );
    }
    
    if (graphData.intent === 'generate_graph') {
      const { metadata } = graphData;
      const changeColor = metadata.change24h >= 0 ? 'text-green-500' : 'text-red-500';
      const changeSign = metadata.change24h >= 0 ? '+' : '';
      
      return (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{graphData.symbol}</h3>
            <Badge variant="secondary">{graphData.timeframe}</Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(metadata.currentPrice)}</div>
            <div className={`text-sm ${changeColor}`}>
              {changeSign}{metadata.change24h.toFixed(2)}%
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  const renderMetricsPanel = () => {
    if (graphData.intent === 'generate_token_chart') {
      const { tokenMetrics } = graphData;
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Market Cap</div>
            <div className="font-semibold">{formatCurrency(tokenMetrics.marketCap)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">24h Volume</div>
            <div className="font-semibold">{formatCurrency(tokenMetrics.volume24h)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Supply</div>
            <div className="font-semibold">{formatNumber(tokenMetrics.supply)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Holders</div>
            <div className="font-semibold">{formatNumber(tokenMetrics.holders)}</div>
          </div>
        </div>
      );
    }
    
    if (graphData.intent === 'generate_graph') {
      const { metadata } = graphData;
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Current Price</div>
            <div className="font-semibold">{formatCurrency(metadata.currentPrice)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">24h Change</div>
            <div className={`font-semibold ${metadata.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {metadata.change24h >= 0 ? '+' : ''}{metadata.change24h.toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">24h Volume</div>
            <div className="font-semibold">{formatCurrency(metadata.volume24h)}</div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        {renderTokenHeader()}
      </CardHeader>
      <CardContent>
        <ChartContainer config={defaultChartConfig} className="h-[400px] w-full">
          {renderChart()}
        </ChartContainer>
        {renderMetricsPanel()}
      </CardContent>
    </Card>
  );
}