import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";

interface NewsItem {
  title: string;
  source: string;
  description: string;
  url: string;
  publishedAt: string;
}

interface TokenAnalysis {
  token: string;
  news: NewsItem[];
  x?: {
    sentiment: string;
    tweets: any[];
    error?: string;
  };
}

interface MarketAnalysisData {
  searchTerms: string[];
  newsAnalysis: {
    combinedNews: NewsItem[];
    tokenAnalysis: TokenAnalysis[];
  };
}

interface MarketAnalysisDisplayProps {
  data: MarketAnalysisData;
}

export function MarketAnalysisDisplay({ data }: MarketAnalysisDisplayProps) {
  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "negative":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case "neutral":
        return <Info className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case "positive":
        return "bg-green-500/20 text-green-300 border-green-500/30";
      case "negative":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "neutral":
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
      default:
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Terms */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">Search Terms</h3>
        <div className="flex flex-wrap gap-2">
          {data.searchTerms.map((term, index) => (
            <Badge
              key={index}
              variant="outline"
              className="bg-blue-500/20 text-blue-300 border-blue-500/30"
            >
              {term}
            </Badge>
          ))}
        </div>
      </div>

      {/* Token Analysis */}
      {data.newsAnalysis.tokenAnalysis.map((tokenData, index) => (
        <Card key={index} className="bg-black/40 border-gray-600/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-white">
              <span className="text-lg">{tokenData.token}</span>
              {tokenData.x && (
                <div className="flex items-center gap-2">
                  {getSentimentIcon(tokenData.x.sentiment)}
                  <Badge className={getSentimentColor(tokenData.x.sentiment)}>
                    {tokenData.x.sentiment || "Unknown"}
                  </Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Token News */}
            {tokenData.news.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-300">Recent News</h4>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {tokenData.news.slice(0, 5).map((newsItem, newsIndex) => (
                    <div
                      key={newsIndex}
                      className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
                    >
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h5 className="text-sm font-medium text-white line-clamp-2">
                          {newsItem.title}
                        </h5>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(newsItem.publishedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                        {newsItem.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{newsItem.source}</span>
                        <a
                          href={newsItem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Read more →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* X/Twitter Analysis */}
            {tokenData.x?.error && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-300">
                    Twitter data unavailable: {tokenData.x.error}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* General Market News */}
      {data.newsAnalysis.combinedNews.length > 0 && (
        <Card className="bg-black/40 border-gray-600/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">Market News Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {data.newsAnalysis.combinedNews.slice(0, 8).map((newsItem, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
                >
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <h5 className="text-sm font-medium text-white line-clamp-2">
                      {newsItem.title}
                    </h5>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(newsItem.publishedAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                    {newsItem.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{newsItem.source}</span>
                    <a
                      href={newsItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Read more →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}