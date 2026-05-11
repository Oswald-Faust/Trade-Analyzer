/**
 * PHINEA TRADE ANALYZER - Simulation Engine
 * Handles capital adjustments and performance projections
 */

class SimulationEngine {
    constructor() {
        this.originalData = null;
        this.originalCapital = 0;
        this.currentParams = {
            capital: 10000,
            startDate: null,
            endDate: null,
            leverage: 1
        };
        this.results = null;
    }

    /**
     * Initialize with original trading data
     */
    initialize(trades, summary) {
        this.originalData = {
            trades: [...trades],
            summary: { ...summary }
        };
        
        // Calculate original capital from trades
        this.originalCapital = this.estimateOriginalCapital(trades);
        
        // Set default date range
        if (summary.startDate) {
            this.currentParams.startDate = summary.startDate;
        }
        if (summary.endDate) {
            this.currentParams.endDate = summary.endDate;
        }
        
        return this;
    }

    /**
     * Estimate original capital from trade data
     */
    estimateOriginalCapital(trades) {
        if (!trades || trades.length === 0) return 1000;
        
        // Try to find initial balance from first trade
        const firstTrade = trades[0];
        if (firstTrade.balance) {
            // Initial balance = final balance after trade - profit of that trade
            return firstTrade.balance - (firstTrade.profit || 0);
        }
        
        // Fallback: use total profit and assume a reasonable return percentage
        const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
        
        // Assume 20% return if profit positive, otherwise use fixed default
        if (totalProfit > 0) {
            return totalProfit / 0.2; // Assume 20% return
        }
        
        return 1000; // Default
    }

    /**
     * Run simulation with current parameters
     */
    simulate(params = {}) {
        // Update parameters
        this.currentParams = {
            ...this.currentParams,
            ...params
        };
        
        const { capital, startDate, endDate, leverage } = this.currentParams;
        
        // Filter trades by date range
        let filteredTrades = [...this.originalData.trades];
        
        if (startDate) {
            filteredTrades = filteredTrades.filter(t => 
                t.closeTime && t.closeTime >= new Date(startDate)
            );
        }
        
        if (endDate) {
            filteredTrades = filteredTrades.filter(t => 
                t.closeTime && t.closeTime <= new Date(endDate)
            );
        }
        
        // Calculate scaling factor based on capital difference
        const scaleFactor = (capital / this.originalCapital) * leverage;
        
        // Scale trade profits
        const scaledTrades = filteredTrades.map(trade => ({
            ...trade,
            scaledProfit: (trade.profit || 0) * scaleFactor
        }));
        
        // Calculate simulation results
        this.results = this.calculateResults(scaledTrades, capital);
        
        return this.results;
    }

    /**
     * Calculate comprehensive results
     */
    calculateResults(trades, startingCapital) {
        // Basic calculations
        const totalTrades = trades.length;
        const wins = trades.filter(t => t.scaledProfit > 0);
        const losses = trades.filter(t => t.scaledProfit < 0);
        
        const totalProfit = trades.reduce((sum, t) => sum + t.scaledProfit, 0);
        const grossProfit = wins.reduce((sum, t) => sum + t.scaledProfit, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.scaledProfit, 0));
        
        // Return percentages
        const returnPercent = (totalProfit / startingCapital) * 100;
        const finalCapital = startingCapital + totalProfit;
        
        // Win rate
        const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
        
        // Best and worst trades
        const bestTrade = trades.length > 0 
            ? Math.max(...trades.map(t => t.scaledProfit)) 
            : 0;
        const worstTrade = trades.length > 0 
            ? Math.min(...trades.map(t => t.scaledProfit)) 
            : 0;
        
        // Average gain/loss
        const avgGain = wins.length > 0 ? grossProfit / wins.length : 0;
        const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
        
        // Calculate drawdown
        let maxDrawdown = 0;
        let peak = startingCapital;
        let equity = startingCapital;
        
        const equityCurve = [{
            x: trades.length > 0 && trades[0].closeTime 
                ? new Date(trades[0].closeTime.getTime() - 86400000)
                : new Date(),
            y: startingCapital
        }];
        
        trades.forEach(trade => {
            equity += trade.scaledProfit;
            
            if (trade.closeTime) {
                equityCurve.push({
                    x: trade.closeTime,
                    y: equity
                });
            }
            
            if (equity > peak) {
                peak = equity;
            }
            
            const drawdown = peak - equity;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });
        
        const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
        
        // Time-based calculations
        let periodDays = 30; // Default
        
        if (trades.length > 0 && trades[0].closeTime && trades[trades.length - 1].closeTime) {
            periodDays = Math.max(
                1,
                (trades[trades.length - 1].closeTime - trades[0].closeTime) / (1000 * 60 * 60 * 24)
            );
        }
        
        const monthlyReturn = (returnPercent / periodDays) * 30;
        const yearlyProjection = startingCapital * (1 + (monthlyReturn / 100)) ** 12 - startingCapital;
        
        // Profit factor
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0);
        
        return {
            // Capital
            startingCapital,
            finalCapital,
            totalProfit,
            returnPercent,
            
            // Trade stats
            totalTrades,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate,
            
            // Profit/Loss
            grossProfit,
            grossLoss,
            profitFactor,
            
            // Trade extremes
            bestTrade,
            worstTrade,
            avgGain,
            avgLoss,
            
            // Risk metrics
            maxDrawdown,
            maxDrawdownPercent,
            
            // Projections
            monthlyReturn,
            yearlyProjection,
            periodDays,
            
            // Data for charts
            equityCurve,
            trades
        };
    }

    /**
     * Get original equity curve for comparison
     */
    getOriginalEquityCurve() {
        if (!this.originalData || !this.originalData.trades) {
            return [];
        }
        
        const trades = this.originalData.trades;
        let equity = this.originalCapital;
        
        const curve = [{
            x: trades.length > 0 && trades[0].closeTime 
                ? new Date(trades[0].closeTime.getTime() - 86400000)
                : new Date(),
            y: equity
        }];
        
        trades.forEach(trade => {
            equity += trade.profit || 0;
            if (trade.closeTime) {
                curve.push({
                    x: trade.closeTime,
                    y: equity
                });
            }
        });
        
        return curve;
    }

    /**
     * Get comparison data between original and simulation
     */
    getComparisonData() {
        if (!this.results) {
            return null;
        }
        
        const originalTotalProfit = this.originalData.summary.totalProfit || 0;
        const originalReturn = this.originalCapital > 0 
            ? (originalTotalProfit / this.originalCapital) * 100 
            : 0;
        
        return {
            original: {
                capital: this.originalCapital,
                profit: originalTotalProfit,
                return: originalReturn,
                final: this.originalCapital + originalTotalProfit
            },
            simulated: {
                capital: this.currentParams.capital,
                profit: this.results.totalProfit,
                return: this.results.returnPercent,
                final: this.results.finalCapital
            }
        };
    }

    /**
     * Get date range from trades
     */
    getDateRange() {
        if (!this.originalData || !this.originalData.trades.length) {
            return { min: null, max: null };
        }
        
        const dates = this.originalData.trades
            .map(t => t.closeTime)
            .filter(d => d)
            .sort((a, b) => a - b);
        
        return {
            min: dates[0] || null,
            max: dates[dates.length - 1] || null
        };
    }

    /**
     * Calculate scenario projections
     */
    projectScenarios(baseCapital, months = 12) {
        if (!this.results) return [];
        
        const monthlyReturn = this.results.monthlyReturn / 100;
        const scenarios = [];
        
        // Conservative (-30% of average)
        const conservative = monthlyReturn * 0.7;
        
        // Average
        const average = monthlyReturn;
        
        // Optimistic (+30% of average)
        const optimistic = monthlyReturn * 1.3;
        
        for (let i = 0; i <= months; i++) {
            scenarios.push({
                month: i,
                conservative: baseCapital * Math.pow(1 + conservative, i),
                average: baseCapital * Math.pow(1 + average, i),
                optimistic: baseCapital * Math.pow(1 + optimistic, i)
            });
        }
        
        return scenarios;
    }
}

// Export
window.SimulationEngine = SimulationEngine;
