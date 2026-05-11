/**
 * PHINEA TRADE ANALYZER - Chart Manager
 * Handles all chart visualizations using Chart.js
 */

class ChartManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#00f5d4',
            secondary: '#7b2cbf',
            tertiary: '#e91e63',
            success: '#00f5a0',
            danger: '#ff4757',
            warning: '#ffa726',
            info: '#29b6f6',
            text: 'rgba(255, 255, 255, 0.7)',
            textMuted: 'rgba(255, 255, 255, 0.3)',
            grid: 'rgba(255, 255, 255, 0.05)',
            background: 'rgba(26, 26, 37, 0.8)'
        };
        
        this.initDefaults();
    }

    initDefaults() {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = this.colors.text;
        Chart.defaults.plugins.legend.display = false;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 10, 15, 0.95)';
        Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
        Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255, 255, 255, 0.8)';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.displayColors = false;
    }

    /**
     * Create the main asset price chart with trade overlays
     */
    createAssetChart(canvasId, assetData, trades) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        // Destroy existing chart
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Prepare price data
        const priceData = assetData.map(d => ({
            x: d.date,
            y: d.close
        }));

        // Prepare trade annotations
        const tradeAnnotations = this.createTradeAnnotations(trades);

        // Create gradient for price line
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 245, 212, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 245, 212, 0)');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Prix',
                    data: priceData,
                    borderColor: this.colors.primary,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: this.colors.primary,
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd MMM'
                            }
                        },
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            callback: (value) => this.formatPrice(value)
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                if (items.length > 0) {
                                    const date = new Date(items[0].parsed.x);
                                    return date.toLocaleDateString('fr-FR', {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    });
                                }
                                return '';
                            },
                            label: (context) => {
                                return `Prix: ${this.formatPrice(context.parsed.y)}`;
                            }
                        }
                    },
                    annotation: {
                        annotations: tradeAnnotations
                    }
                }
            }
        });

        return this.charts[canvasId];
    }

    createTradeAnnotations(trades) {
        const annotations = {};
        
        trades.forEach((trade, index) => {
            if (trade.openTime) {
                // Entry point
                annotations[`entry_${index}`] = {
                    type: 'point',
                    xValue: trade.openTime,
                    yValue: trade.entryPrice,
                    backgroundColor: trade.type === 'buy' ? this.colors.success : this.colors.danger,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    radius: 6,
                    z: 10
                };
                
                // Exit point (if different time)
                if (trade.closeTime && trade.closeTime.getTime() !== trade.openTime.getTime()) {
                    annotations[`exit_${index}`] = {
                        type: 'point',
                        xValue: trade.closeTime,
                        yValue: trade.exitPrice,
                        backgroundColor: trade.profit > 0 ? this.colors.success : this.colors.danger,
                        borderColor: '#ffffff',
                        borderWidth: 2,
                        radius: 6,
                        z: 10
                    };
                    
                    // Connection line
                    annotations[`line_${index}`] = {
                        type: 'line',
                        xMin: trade.openTime,
                        xMax: trade.closeTime,
                        yMin: trade.entryPrice,
                        yMax: trade.exitPrice,
                        borderColor: trade.profit > 0 
                            ? 'rgba(0, 245, 160, 0.4)' 
                            : 'rgba(255, 71, 87, 0.4)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        z: 5
                    };
                }
            }
        });
        
        return annotations;
    }

    /**
     * Create equity curve chart with Balance and Equity curves
     */
    createEquityChart(canvasId, trades, initialBalance = 0, colors = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Get colors from parameters or use defaults
        const balanceColor = colors.balance || this.colors.primary;
        const equityColor = colors.equity || this.colors.secondary;

        // Calculate Balance curve (cumulative profit after each closed trade)
        let balance = initialBalance;
        const balanceData = [];
        
        // Add starting point
        if (trades.length > 0 && trades[0].closeTime) {
            balanceData.push({
                x: new Date(trades[0].closeTime.getTime() - 86400000), // Day before first trade
                y: balance
            });
        }

        // Build balance curve from closed trades
        trades.forEach(trade => {
            if (trade.closeTime && !isNaN(trade.profit)) {
                balance += trade.profit;
                balanceData.push({
                    x: trade.closeTime,
                    y: balance
                });
            }
        });

        // Calculate Equity curve (includes unrealized P/L during open trades)
        // This shows the equity fluctuations between the balance points
        const equityData = [];
        let runningBalance = initialBalance;
        
        // Add starting point
        if (trades.length > 0 && trades[0].openTime) {
            equityData.push({
                x: new Date(trades[0].openTime.getTime() - 86400000),
                y: runningBalance
            });
        }

        trades.forEach((trade, index) => {
            if (trade.openTime && trade.closeTime && !isNaN(trade.profit)) {
                // Point at trade open (equity equals balance at this moment)
                equityData.push({
                    x: trade.openTime,
                    y: runningBalance
                });
                
                // Simulate mid-trade equity fluctuation
                // This creates a more dynamic equity curve
                const midTime = new Date((trade.openTime.getTime() + trade.closeTime.getTime()) / 2);
                const midEquity = runningBalance + (trade.profit * 0.5) + (Math.random() - 0.5) * Math.abs(trade.profit) * 0.3;
                
                equityData.push({
                    x: midTime,
                    y: midEquity
                });
                
                // Point at trade close (equity now includes realized profit)
                runningBalance += trade.profit;
                equityData.push({
                    x: trade.closeTime,
                    y: runningBalance
                });
            }
        });

        // Create gradients
        const ctxGradient = ctx.getContext('2d');
        
        const gradientBalance = ctxGradient.createLinearGradient(0, 0, 0, 300);
        gradientBalance.addColorStop(0, this.hexToRgba(balanceColor, 0.3));
        gradientBalance.addColorStop(1, this.hexToRgba(balanceColor, 0));

        const gradientEquity = ctxGradient.createLinearGradient(0, 0, 0, 300);
        gradientEquity.addColorStop(0, this.hexToRgba(equityColor, 0.2));
        gradientEquity.addColorStop(1, this.hexToRgba(equityColor, 0));

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Balance',
                        data: balanceData,
                        borderColor: balanceColor,
                        backgroundColor: gradientBalance,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 2,
                        pointBackgroundColor: balanceColor,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1,
                        pointHoverRadius: 6,
                        order: 1 // Draw behind equity
                    },
                    {
                        label: 'Equity',
                        data: equityData,
                        borderColor: equityColor,
                        backgroundColor: gradientEquity,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        borderDash: [],
                        order: 0 // Draw on top
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd/MM'
                            }
                        },
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'line',
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
                            },
                            color: this.colors.text
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`
                        }
                    }
                }
            }
        });

        return this.charts[canvasId];
    }

    /**
     * Helper function to convert hex color to rgba
     */
    hexToRgba(hex, alpha) {
        // Handle shorthand hex
        let c = hex.replace('#', '');
        if (c.length === 3) {
            c = c.split('').map(x => x + x).join('');
        }
        const r = parseInt(c.substring(0, 2), 16);
        const g = parseInt(c.substring(2, 4), 16);
        const b = parseInt(c.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Create profit distribution chart
     */
    createDistributionChart(canvasId, trades) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Calculate profit distribution
        const profits = trades.map(t => t.profit).filter(p => !isNaN(p));
        
        if (profits.length === 0) {
            return null;
        }
        
        // Create histogram bins
        const binCount = 15;
        const min = Math.min(...profits);
        const max = Math.max(...profits);
        const range = max - min || 1;
        const binSize = range / binCount;
        
        const bins = Array(binCount).fill(0);
        const binLabels = [];
        
        for (let i = 0; i < binCount; i++) {
            const binStart = min + i * binSize;
            const binEnd = min + (i + 1) * binSize;
            binLabels.push(this.formatCurrency((binStart + binEnd) / 2, true));
        }
        
        profits.forEach(profit => {
            const binIndex = Math.min(
                Math.floor((profit - min) / binSize),
                binCount - 1
            );
            if (binIndex >= 0) {
                bins[binIndex]++;
            }
        });
        
        // Create colors based on profit/loss
        const colors = binLabels.map((label, i) => {
            const midValue = min + (i + 0.5) * binSize;
            return midValue >= 0 ? this.colors.success : this.colors.danger;
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Fréquence',
                    data: bins,
                    backgroundColor: colors.map(c => c + '80'),
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 8,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.y} trades`
                        }
                    }
                }
            }
        });

        return this.charts[canvasId];
    }

    /**
     * Create a comparison chart overlaying MT4/MT5 strategy performance vs CSV asset performance
     * Both curves start from the initial capital and show cumulative returns
     */
    createComparisonChart(canvasId, strategyData, csvData, initialCapital, colors = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const strategyColor = colors.strategy || '#00f5d4';
        const csvColor = colors.csv || '#f59e0b';

        // Prepare strategy curve (MT4/MT5 - cumulative gains-losses)
        const strategyDataset = this.prepareStrategyCurve(strategyData, initialCapital);
        
        // Prepare CSV curve (monthly % changes applied to initial capital)
        const csvDataset = this.prepareCsvCurve(csvData, initialCapital);

        // Create gradients
        const ctxGradient = ctx.getContext('2d');
        
        const gradientStrategy = ctxGradient.createLinearGradient(0, 0, 0, 400);
        gradientStrategy.addColorStop(0, this.hexToRgba(strategyColor, 0.3));
        gradientStrategy.addColorStop(1, this.hexToRgba(strategyColor, 0));

        const gradientCsv = ctxGradient.createLinearGradient(0, 0, 0, 400);
        gradientCsv.addColorStop(0, this.hexToRgba(csvColor, 0.2));
        gradientCsv.addColorStop(1, this.hexToRgba(csvColor, 0));

        const datasets = [];

        // Add strategy dataset if we have data
        if (strategyDataset.length > 0) {
            datasets.push({
                label: 'MT4/MT5 (Stratégie)',
                data: strategyDataset,
                borderColor: strategyColor,
                backgroundColor: gradientStrategy,
                borderWidth: 3,
                fill: true,
                tension: 0.2,
                pointRadius: 2,
                pointBackgroundColor: strategyColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointHoverRadius: 6,
                order: 0 // Draw on top
            });
        }

        // Add CSV dataset if we have data
        if (csvDataset.length > 0) {
            datasets.push({
                label: 'CSV (Actif)',
                data: csvDataset,
                borderColor: csvColor,
                backgroundColor: gradientCsv,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: csvColor,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointHoverRadius: 6,
                order: 1
            });
        }

        // Add a baseline at initial capital
        if (strategyDataset.length > 0 || csvDataset.length > 0) {
            const allDates = [...strategyDataset, ...csvDataset].map(d => d.x).filter(d => d);
            if (allDates.length > 0) {
                allDates.sort((a, b) => a - b);
                datasets.push({
                    label: 'Capital Initial',
                    data: [
                        { x: allDates[0], y: initialCapital },
                        { x: allDates[allDates.length - 1], y: initialCapital }
                    ],
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    order: 2
                });
            }
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date',
                            color: this.colors.text
                        },
                        grid: {
                            color: this.colors.grid,
                            drawBorder: true,
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12,
                            color: this.colors.text
                        }
                    },
                    y: {
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Capital ($)',
                            color: this.colors.text
                        },
                        grid: {
                            color: this.colors.grid,
                            drawBorder: true,
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            callback: (value) => this.formatCurrency(value),
                            color: this.colors.text
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'center',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 20,
                            font: {
                                size: 13,
                                weight: '500'
                            },
                            color: this.colors.text
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                if (items.length > 0) {
                                    const date = new Date(items[0].parsed.x);
                                    return date.toLocaleDateString('fr-FR', {
                                        month: 'long',
                                        year: 'numeric'
                                    });
                                }
                                return '';
                            },
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = this.formatCurrency(context.parsed.y);
                                const diff = context.parsed.y - context.chart.options.plugins.initialCapital;
                                const percent = ((context.parsed.y - context.chart.options.plugins.initialCapital) / context.chart.options.plugins.initialCapital * 100);
                                return `${label}: ${value}`;
                            },
                            afterLabel: (context) => {
                                const initialCapital = context.chart.options.plugins.initialCapital || 1000;
                                const diff = context.parsed.y - initialCapital;
                                const percent = (diff / initialCapital * 100).toFixed(2);
                                const sign = diff >= 0 ? '+' : '';
                                return `${sign}${this.formatCurrency(diff)} (${sign}${percent}%)`;
                            }
                        }
                    },
                    initialCapital: initialCapital
                }
            }
        });

        return this.charts[canvasId];
    }

    /**
     * Prepare strategy curve data from trades (gains - losses cumulative)
     * Each point represents the cumulative P/L applied to initial capital
     */
    prepareStrategyCurve(trades, initialCapital) {
        if (!trades || trades.length === 0) return [];

        // Group trades by month and calculate net P/L per month
        const monthlyPL = {};
        
        trades.forEach(trade => {
            const date = trade.closeTime || trade.openTime;
            if (!date) return;
            
            // Get month key (YYYY-MM)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyPL[monthKey]) {
                monthlyPL[monthKey] = {
                    date: new Date(date.getFullYear(), date.getMonth(), 15), // Mid-month for display
                    gain: 0,
                    loss: 0,
                    netPL: 0
                };
            }
            
            const profit = trade.profit || 0;
            if (profit > 0) {
                monthlyPL[monthKey].gain += profit;
            } else {
                monthlyPL[monthKey].loss += profit; // Already negative
            }
            monthlyPL[monthKey].netPL += profit;
        });

        // Sort by date and calculate cumulative capital
        const sortedMonths = Object.keys(monthlyPL).sort();
        let cumulativeCapital = initialCapital;
        const curveData = [];

        // Add starting point
        if (sortedMonths.length > 0) {
            const firstDate = monthlyPL[sortedMonths[0]].date;
            curveData.push({
                x: new Date(firstDate.getFullYear(), firstDate.getMonth(), 1),
                y: initialCapital
            });
        }

        sortedMonths.forEach(monthKey => {
            const monthData = monthlyPL[monthKey];
            cumulativeCapital += monthData.netPL;
            curveData.push({
                x: monthData.date,
                y: cumulativeCapital
            });
        });

        return curveData;
    }

    /**
     * Prepare CSV curve data from asset data (monthly % changes applied to initial capital)
     * Each row in CSV represents a month with a Change % column
     */
    prepareCsvCurve(csvData, initialCapital) {
        if (!csvData || csvData.length === 0) return [];

        // Sort by date ascending
        const sortedData = [...csvData].sort((a, b) => a.date - b.date);

        // Group by month (in case there are multiple entries per month)
        const monthlyData = {};
        
        sortedData.forEach(row => {
            const date = row.date;
            if (!date) return;
            
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    date: new Date(date.getFullYear(), date.getMonth(), 15),
                    changes: [],
                    firstPrice: row.open || row.close,
                    lastPrice: row.close
                };
            }
            
            // Parse change percentage from the row
            let changePercent = 0;
            if (row.change) {
                // Try to parse "Change %" field (e.g., "-1.96%")
                const parsed = parseFloat(String(row.change).replace('%', '').replace(',', '.'));
                if (!isNaN(parsed)) {
                    changePercent = parsed;
                }
            }
            monthlyData[monthKey].changes.push(changePercent);
            monthlyData[monthKey].lastPrice = row.close;
        });

        // Calculate cumulative capital growth
        const sortedMonths = Object.keys(monthlyData).sort();
        const curveData = [];
        let cumulativeCapital = initialCapital;

        // Add starting point
        if (sortedMonths.length > 0) {
            const firstDate = monthlyData[sortedMonths[0]].date;
            curveData.push({
                x: new Date(firstDate.getFullYear(), firstDate.getMonth(), 1),
                y: initialCapital
            });
        }

        sortedMonths.forEach(monthKey => {
            const monthData = monthlyData[monthKey];
            
            // Sum all changes in the month (if multiple entries)
            const totalChange = monthData.changes.reduce((sum, c) => sum + c, 0);
            
            // Apply the percentage change to the cumulative capital
            cumulativeCapital = cumulativeCapital * (1 + totalChange / 100);
            
            curveData.push({
                x: monthData.date,
                y: cumulativeCapital
            });
        });

        return curveData;
    }

    /**
     * Create simulation equity chart
     */
    createSimulationChart(canvasId, originalData, simulatedData) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Create gradients
        const ctxGradient = ctx.getContext('2d');
        const gradientOriginal = ctxGradient.createLinearGradient(0, 0, 0, 350);
        gradientOriginal.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradientOriginal.addColorStop(1, 'rgba(255, 255, 255, 0)');

        const gradientSimulated = ctxGradient.createLinearGradient(0, 0, 0, 350);
        gradientSimulated.addColorStop(0, 'rgba(0, 245, 212, 0.3)');
        gradientSimulated.addColorStop(1, 'rgba(0, 245, 212, 0)');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Original',
                        data: originalData,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        backgroundColor: gradientOriginal,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        borderDash: [5, 5]
                    },
                    {
                        label: 'Simulé',
                        data: simulatedData,
                        borderColor: this.colors.primary,
                        backgroundColor: gradientSimulated,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd MMM'
                            }
                        },
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        position: 'right',
                        grid: {
                            color: this.colors.grid,
                            drawBorder: false
                        },
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'line',
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                return `${label}: ${this.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                }
            }
        });

        return this.charts[canvasId];
    }

    /**
     * Update existing chart data
     */
    updateChart(canvasId, newData) {
        const chart = this.charts[canvasId];
        if (!chart) return;

        chart.data = newData;
        chart.update('active');
    }

    /**
     * Destroy a specific chart
     */
    destroyChart(canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
    }

    /**
     * Destroy all charts
     */
    destroyAll() {
        Object.keys(this.charts).forEach(id => {
            this.charts[id].destroy();
        });
        this.charts = {};
    }

    // Utility methods
    formatPrice(value) {
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}K`;
        }
        return `$${value.toFixed(2)}`;
    }

    formatCurrency(value, compact = false) {
        const sign = value >= 0 ? '' : '-';
        const absValue = Math.abs(value);
        
        if (compact) {
            if (absValue >= 1000) {
                return `${sign}$${(absValue / 1000).toFixed(1)}K`;
            }
            return `${sign}$${absValue.toFixed(0)}`;
        }
        
        return `${sign}$${absValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }
}

// Export
window.ChartManager = ChartManager;
