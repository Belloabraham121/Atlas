import { A2ABus, A2AMessage } from '../utils/bus.js';
import { marketDataService, TokenChartData, PortfolioTokenChart } from '../services/marketData.js';

export class GraphAgent {
  private agentName = 'graph@portfolio.guard';

  constructor(bus: A2ABus) {
    bus.registerAgent(this.agentName);
    this.setupMessageHandlers(bus);
  }

  private setupMessageHandlers(bus: A2ABus): void {
    bus.on(`message:${this.agentName}`, (message: A2AMessage) => {
      console.log(`📈 Graph Agent received: ${message.type} from ${message.from}`);
      this.handleMessage(message, bus);
    });
  }

  private async handleMessage(message: A2AMessage, bus: A2ABus): Promise<void> {
    try {
      switch (message.type) {
        case 'generate_graph':
          await this.generateGraph(message, bus);
          break;
        case 'generate_token_chart':
          await this.generateTokenChart(message, bus);
          break;
        case 'generate_portfolio_chart':
          await this.generatePortfolioChart(message, bus);
          break;
        case 'generate_correlation_chart':
          await this.generateCorrelationChart(message, bus);
          break;
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message ${message.type}:`, error);
      this.sendErrorResponse(message, bus, error as Error);
    }
  }

  private async generateGraph(message: A2AMessage, bus: A2ABus): Promise<void> {
    try {
      const { userId, timeframe = '24h' } = message.payload;
      const config = this.createChartConfiguration(userId, timeframe);
      
      bus.sendMessage({
        type: 'graph_ready',
        from: this.agentName,
        to: message.from,
        payload: {
          chart_id: `graph_${Date.now()}`,
          config
        }
      });
    } catch (error) {
      this.sendErrorResponse(message, bus, error as Error);
    }
  }

  private async generateTokenChart(message: A2AMessage, bus: A2ABus): Promise<void> {
    try {
      const { token, timeframe = '24h', chartType = 'line' } = message.payload;
      
      const tokenChartData = await marketDataService.getTokenChartData(token, timeframe, chartType);
      if (!tokenChartData) {
        throw new Error(`Unable to fetch chart data for token: ${token}`);
      }

      const config = this.createTokenChartConfig(tokenChartData);
      
      bus.sendMessage({
        type: 'token_chart_ready',
        from: this.agentName,
        to: message.from,
        payload: {
          chart_id: `token_${token}_${Date.now()}`,
          config,
          metadata: tokenChartData.metadata
        }
      });
    } catch (error) {
      this.sendErrorResponse(message, bus, error as Error);
    }
  }

  private async generatePortfolioChart(message: A2AMessage, bus: A2ABus): Promise<void> {
    try {
      const { accountId, chartType = 'value' } = message.payload;
      
      const portfolioData = await marketDataService.getPortfolioChartData(accountId);
      if (!portfolioData) {
        throw new Error(`Unable to fetch portfolio data for account: ${accountId}`);
      }

      let config: any;
      switch (chartType) {
        case 'value':
          config = this.createPortfolioValueChart(portfolioData);
          break;
        case 'diversification':
          config = this.createDiversificationChart(portfolioData);
          break;
        case 'performance':
          config = this.createTokenPerformanceChart(portfolioData);
          break;
        default:
          config = this.createPortfolioValueChart(portfolioData);
      }
      
      bus.sendMessage({
        type: 'portfolio_chart_ready',
        from: this.agentName,
        to: message.from,
        payload: {
          chart_id: `portfolio_${accountId}_${Date.now()}`,
          config,
          totalValue: portfolioData.totalValue,
          totalChange24h: portfolioData.totalChange24h
        }
      });
    } catch (error) {
      this.sendErrorResponse(message, bus, error as Error);
    }
  }

  private async generateCorrelationChart(message: A2AMessage, bus: A2ABus): Promise<void> {
    try {
      const { tokens, timeframe = '30d' } = message.payload;
      
      const correlationData = await marketDataService.getMultiTokenCorrelation(tokens, timeframe);
      if (!correlationData) {
        throw new Error(`Unable to fetch correlation data for tokens: ${tokens.join(', ')}`);
      }

      const config = this.createCorrelationChartConfig(correlationData);
      
      bus.sendMessage({
        type: 'correlation_chart_ready',
        from: this.agentName,
        to: message.from,
        payload: {
          chart_id: `correlation_${Date.now()}`,
          config,
          correlationMatrix: correlationData.correlationMatrix
        }
      });
    } catch (error) {
      this.sendErrorResponse(message, bus, error as Error);
    }
  }

  private sendErrorResponse(message: A2AMessage, bus: A2ABus, error: Error): void {
    bus.sendMessage({
      type: 'graph_error',
      from: this.agentName,
      to: message.from,
      payload: {
        error: error.message,
        originalType: message.type
      }
    });
  }

  private createChartConfiguration(userId: string, timeframe: string): any {
    return this.generateChartConfig(userId, timeframe);
  }

  private createTokenChartConfig(tokenChartData: TokenChartData): any {
    const timestamps = tokenChartData.data.map(point => new Date(point.timestamp).toLocaleDateString());
    const prices = tokenChartData.data.map(point => point.price);

    return {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [{
          label: `${tokenChartData.symbol} Price`,
          data: prices,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: `${tokenChartData.name} (${tokenChartData.symbol})`
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Price ($)'
            }
          }
        }
      }
    };
  }

  private createPortfolioValueChart(portfolioData: PortfolioTokenChart): any {
    // Calculate portfolio value over time by aggregating all token values
    const timestamps = portfolioData.tokens[0]?.data.map(point => 
      new Date(point.timestamp).toLocaleDateString()
    ) || [];
    
    const portfolioValues = timestamps.map((_, index) => {
      return portfolioData.tokens.reduce((total, token) => {
        return total + (token.data[index]?.price || 0);
      }, 0);
    });

    return {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [{
          label: 'Portfolio Value',
          data: portfolioValues,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Portfolio Value Over Time'
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Value ($)'
            }
          }
        }
      }
    };
  }

  private createDiversificationChart(portfolioData: PortfolioTokenChart): any {
    return {
      type: 'doughnut',
      data: {
        labels: portfolioData.diversification.map(d => d.token),
        datasets: [{
          data: portfolioData.diversification.map(d => d.percentage),
          backgroundColor: [
            '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
            '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6b7280'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Portfolio Diversification'
          }
        }
      }
    };
  }

  private createTokenPerformanceChart(portfolioData: PortfolioTokenChart): any {
    const tokenPerformance = portfolioData.tokens.map(token => {
      const data = token.data;
      if (data.length < 2) return { symbol: token.symbol, change: 0 };
      
      const latest = data[data.length - 1].price;
      const previous = data[data.length - 2].price;
      const change = ((latest - previous) / previous) * 100;
      
      return { symbol: token.symbol, change };
    });

    return {
      type: 'bar',
      data: {
        labels: tokenPerformance.map(t => t.symbol),
        datasets: [{
          label: '24h Change (%)',
          data: tokenPerformance.map(t => t.change),
          backgroundColor: tokenPerformance.map(t => 
            t.change >= 0 ? '#10b981' : '#ef4444'
          )
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Token Performance (24h)'
          }
        },
        scales: {
          y: {
            title: {
              display: true,
              text: 'Change (%)'
            }
          }
        }
      }
    };
  }

  private createCorrelationChartConfig(correlationData: any): any {
    const scatterData = [];
    
    // Create scatter plot data from correlation matrix
    for (let i = 0; i < correlationData.tokens.length; i++) {
      for (let j = i + 1; j < correlationData.tokens.length; j++) {
        const token1Data = correlationData.chartData[i].data;
        const token2Data = correlationData.chartData[j].data;
        
        const dataPoints = token1Data.map((point: any, index: number) => ({
          x: point.price,
          y: token2Data[index]?.price || 0
        }));
        
        scatterData.push({
          label: `${correlationData.tokens[i]} vs ${correlationData.tokens[j]}`,
          data: dataPoints,
          backgroundColor: `hsl(${(i + j) * 60}, 70%, 50%)`,
          borderColor: `hsl(${(i + j) * 60}, 70%, 40%)`
        });
      }
    }

    return {
      type: 'scatter',
      data: {
        datasets: scatterData
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Token Price Correlation'
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Token 1 Price ($)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Token 2 Price ($)'
            }
          }
        }
      }
    };
  }

  // Legacy method for backward compatibility
  private generateChartConfig(userId: string, timeframe: string): any {
    const timeLabels = this.generateTimeLabels(timeframe);
    const portfolioData = this.generatePortfolioData(timeLabels);
    const sentimentData = this.generateSentimentData(timeLabels);

    return {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: [
          {
            label: 'Portfolio Value ($)',
            data: portfolioData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'X Sentiment Score',
            data: sentimentData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y1',
            tension: 0.4,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index' as const,
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: `Portfolio Trends & Sentiment Analysis (${timeframe})`,
          },
          legend: {
            display: true,
            position: 'top' as const,
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            type: 'linear' as const,
            display: true,
            position: 'left' as const,
            title: {
              display: true,
              text: 'Portfolio Value ($)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
          y1: {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            title: {
              display: true,
              text: 'Sentiment Score',
            },
            min: -1,
            max: 1,
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    };
  }

  private generateTimeLabels(timeframe: string): string[] {
    const now = new Date();
    const labels: string[] = [];
    
    let intervals: number;
    let stepMs: number;
    
    switch (timeframe) {
      case '1h':
        intervals = 12;
        stepMs = 5 * 60 * 1000; // 5 minutes
        break;
      case '24h':
        intervals = 24;
        stepMs = 60 * 60 * 1000; // 1 hour
        break;
      case '7d':
        intervals = 7;
        stepMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      case '30d':
        intervals = 30;
        stepMs = 24 * 60 * 60 * 1000; // 1 day
        break;
      default:
        intervals = 24;
        stepMs = 60 * 60 * 1000;
    }
    
    for (let i = intervals - 1; i >= 0; i--) {
      const time = new Date(now.getTime() - (i * stepMs));
      if (timeframe === '1h') {
        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } else if (timeframe === '24h') {
        labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit' }));
      } else {
        labels.push(time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
    }
    
    return labels;
  }

  private generatePortfolioData(labels: string[]): number[] {
    const baseValue = 10000;
    const data: number[] = [];
    let currentValue = baseValue;
    
    for (let i = 0; i < labels.length; i++) {
      const change = (Math.random() - 0.5) * 500;
      currentValue += change;
      currentValue = Math.max(currentValue, baseValue * 0.7);
      data.push(Math.round(currentValue * 100) / 100);
    }
    
    return data;
  }

  private generateSentimentData(labels: string[]): number[] {
    return labels.map(() => (Math.random() - 0.5) * 2);
  }
}

// Export instance for backward compatibility
import { bus } from '../utils/bus.js';
export const graphAgent = new GraphAgent(bus);
