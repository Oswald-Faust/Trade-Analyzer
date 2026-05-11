/**
 * PHINEA TRADE ANALYZER - Main Application
 * Entry point and UI controller
 */

class TradeAnalyzerApp {
    constructor() {
        // Parsers and managers
        this.mt5Parser = new MT5Parser();
        this.csvParser = new CSVParser();
        this.chartManager = new ChartManager();
        this.simulation = new SimulationEngine();
        
        // State
        this.state = {
            mtData: null,
            assetData: null,
            currentSection: 'import'
        };
        
        // DOM elements cache
        this.elements = {};
        
        // Initialize
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.setupDropzones();
        this.initTheme();
    }

    cacheElements() {
        // Sections
        this.elements.sectionImport = document.getElementById('section-import');
        this.elements.sectionAnalysis = document.getElementById('section-analysis');
        this.elements.sectionSimulation = document.getElementById('section-simulation');
        
        // Navigation
        this.elements.navBtns = document.querySelectorAll('.nav-btn');
        
        // Import section
        this.elements.dropzoneMt = document.getElementById('dropzone-mt');
        this.elements.dropzoneAsset = document.getElementById('dropzone-asset');
        this.elements.fileMt = document.getElementById('file-mt');
        this.elements.fileAsset = document.getElementById('file-asset');
        this.elements.btnBrowseMt = document.getElementById('btn-browse-mt');
        this.elements.btnBrowseAsset = document.getElementById('btn-browse-asset');
        this.elements.btnAnalyze = document.getElementById('btn-analyze');
        this.elements.previewMt = document.getElementById('preview-mt');
        this.elements.previewAsset = document.getElementById('preview-asset');
        
        // Analysis section
        this.elements.btnBackImport = document.getElementById('btn-back-import');
        this.elements.btnGoSimulation = document.getElementById('btn-go-simulation');
        this.elements.tradesTable = document.getElementById('trades-tbody');
        this.elements.filterBtns = document.querySelectorAll('.filter-btn');
        
        // Simulation section
        this.elements.btnBackAnalysis = document.getElementById('btn-back-analysis');
        this.elements.btnRecalculate = document.getElementById('btn-recalculate');
        this.elements.simCapital = document.getElementById('sim-capital');
        this.elements.simDateStart = document.getElementById('sim-date-start');
        this.elements.simDateEnd = document.getElementById('sim-date-end');
        this.elements.simLeverage = document.getElementById('sim-leverage');
        this.elements.leverageDisplay = document.getElementById('leverage-display');
        this.elements.presetBtns = document.querySelectorAll('.preset-btn:not(.date-preset)');
        this.elements.datePresetBtns = document.querySelectorAll('.date-preset');
        
        // Loading & toasts
        this.elements.loadingOverlay = document.getElementById('loading-overlay');
        this.elements.toastContainer = document.getElementById('toast-container');
        
        // Theme toggle
        this.elements.themeToggle = document.getElementById('themeToggle');
        
        // Configuration section (capital and colors)
        this.elements.initialCapital = document.getElementById('initial-capital');
        this.elements.colorStrategy = document.getElementById('color-strategy');
        this.elements.colorCsv = document.getElementById('color-csv');
        this.elements.colorStrategyLabel = document.getElementById('color-strategy-label');
        this.elements.colorCsvLabel = document.getElementById('color-csv-label');
        
        // Date range for filtering
        this.elements.configDateStart = document.getElementById('config-date-start');
        this.elements.configDateEnd = document.getElementById('config-date-end');
    }

    bindEvents() {
        // Navigation
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => this.navigateTo(btn.dataset.section));
        });
        
        // Import buttons
        this.elements.btnBrowseMt.addEventListener('click', () => this.elements.fileMt.click());
        this.elements.btnBrowseAsset.addEventListener('click', () => this.elements.fileAsset.click());
        
        // File inputs
        this.elements.fileMt.addEventListener('change', (e) => this.handleMtFile(e.target.files[0]));
        this.elements.fileAsset.addEventListener('change', (e) => this.handleAssetFile(e.target.files[0]));
        
        // Analyze button
        this.elements.btnAnalyze.addEventListener('click', () => this.runAnalysis());
        
        // Navigation buttons
        this.elements.btnBackImport.addEventListener('click', () => this.navigateTo('import'));
        this.elements.btnGoSimulation.addEventListener('click', () => this.navigateTo('simulation'));
        this.elements.btnBackAnalysis.addEventListener('click', () => this.navigateTo('analysis'));
        
        // Trade filters
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => this.filterTrades(btn.dataset.filter));
        });
        
        // Simulation controls
        this.elements.simCapital.addEventListener('input', () => this.onCapitalChange());
        this.elements.simLeverage.addEventListener('input', () => this.onLeverageChange());
        this.elements.simDateStart.addEventListener('change', () => this.onDateChange());
        this.elements.simDateEnd.addEventListener('change', () => this.onDateChange());
        this.elements.btnRecalculate.addEventListener('click', () => this.runSimulation());
        
        // Capital presets
        this.elements.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.simCapital.value = btn.dataset.value;
                this.updatePresetActive(btn, this.elements.presetBtns);
                this.onCapitalChange();
            });
        });
        
        // Date presets
        this.elements.datePresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setDatePreset(btn.dataset.range);
                this.updatePresetActive(btn, this.elements.datePresetBtns);
            });
        });
        
        // Remove file buttons
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.import-card');
                if (card.id === 'mt-import') {
                    this.removeMtFile();
                } else {
                    this.removeAssetFile();
                }
            });
        });
        
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Color pickers
        if (this.elements.colorStrategy) {
            this.elements.colorStrategy.addEventListener('input', (e) => {
                this.elements.colorStrategyLabel.textContent = e.target.value;
                // Update legend dot color
                const legendDot = document.querySelector('#legend-strategy .legend-dot');
                if (legendDot) legendDot.style.background = e.target.value;
            });
        }
        if (this.elements.colorCsv) {
            this.elements.colorCsv.addEventListener('input', (e) => {
                this.elements.colorCsvLabel.textContent = e.target.value;
                // Update legend dot color
                const legendDot = document.querySelector('#legend-csv .legend-dot');
                if (legendDot) legendDot.style.background = e.target.value;
            });
        }
    }

    setupDropzones() {
        [this.elements.dropzoneMt, this.elements.dropzoneAsset].forEach(dropzone => {
            if (!dropzone) return;
            
            ['dragenter', 'dragover'].forEach(type => {
                dropzone.addEventListener(type, (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                });
            });
            
            ['dragleave', 'drop'].forEach(type => {
                dropzone.addEventListener(type, (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                });
            });
            
            dropzone.addEventListener('drop', (e) => {
                const file = e.dataTransfer.files[0];
                if (file) {
                    if (dropzone.id === 'dropzone-mt') {
                        this.handleMtFile(file);
                    } else {
                        this.handleAssetFile(file);
                    }
                }
            });
        });
    }

    // File handling
    async handleMtFile(file) {
        if (!file) return;
        
        try {
            const content = await this.readFile(file);
            const result = await this.mt5Parser.parse(content);
            
            if (result.success) {
                this.state.mtData = result;
                this.updateMtPreview(file.name, result);
                this.showToast('Rapport MT5 importé avec succès', 'success');
            } else {
                throw new Error(result.error || 'Erreur de parsing');
            }
        } catch (error) {
            console.error('MT File Error:', error);
            this.showToast('Erreur lors de l\'importation du rapport', 'error');
        }
        
        this.updateAnalyzeButton();
    }

    async handleAssetFile(file) {
        if (!file) return;
        
        try {
            const content = await this.readFile(file);
            const result = await this.csvParser.parse(content);
            
            if (result.success) {
                this.state.assetData = result;
                this.updateAssetPreview(file.name, result);
                this.showToast('Données de l\'actif importées avec succès', 'success');
            } else {
                throw new Error(result.error || 'Erreur de parsing');
            }
        } catch (error) {
            console.error('Asset File Error:', error);
            this.showToast('Erreur lors de l\'importation des données', 'error');
        }
        
        this.updateAnalyzeButton();
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            
            // Determine encoding
            if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
                reader.readAsText(file, 'UTF-16LE');
            } else {
                reader.readAsText(file);
            }
        });
    }

    updateMtPreview(filename, result) {
        const dropzone = this.elements.dropzoneMt;
        const content = dropzone.querySelector('.dropzone-content');
        const success = dropzone.querySelector('.dropzone-success');
        
        content.hidden = true;
        success.hidden = false;
        success.querySelector('.success-filename').textContent = filename;
        
        // Update stats
        this.elements.previewMt.hidden = false;
        document.getElementById('stat-account').textContent = result.accountInfo.accountNumber || '-';
        document.getElementById('stat-trades').textContent = result.summary.totalTrades || 0;
        
        if (result.summary.startDate && result.summary.endDate) {
            const start = result.summary.startDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            const end = result.summary.endDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            document.getElementById('stat-period').textContent = `${start} - ${end}`;
        }
        
        const pnl = result.summary.totalProfit || 0;
        const pnlEl = document.getElementById('stat-pnl');
        pnlEl.textContent = this.formatCurrency(pnl);
        pnlEl.className = `stat-value ${pnl >= 0 ? 'positive' : 'negative'}`;
    }

    updateAssetPreview(filename, result) {
        const dropzone = this.elements.dropzoneAsset;
        const content = dropzone.querySelector('.dropzone-content');
        const success = dropzone.querySelector('.dropzone-success');
        
        content.hidden = true;
        success.hidden = false;
        success.querySelector('.success-filename').textContent = filename;
        
        // Update stats
        this.elements.previewAsset.hidden = false;
        
        // Extract asset name from filename
        const assetName = filename.replace(/\.csv$/i, '').replace(/historical data/i, '').trim();
        document.getElementById('stat-asset-name').textContent = assetName || 'Actif';
        document.getElementById('stat-datapoints').textContent = result.summary.dataPoints || 0;
        
        if (result.summary.startDate && result.summary.endDate) {
            const start = result.summary.startDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            const end = result.summary.endDate.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
            document.getElementById('stat-asset-period').textContent = `${start} - ${end}`;
        }
        
        const change = result.summary.changePercent || 0;
        const changeEl = document.getElementById('stat-asset-change');
        changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
        changeEl.className = `stat-value ${change >= 0 ? 'positive' : 'negative'}`;
    }

    removeMtFile() {
        this.state.mtData = null;
        this.elements.fileMt.value = '';
        
        const dropzone = this.elements.dropzoneMt;
        dropzone.querySelector('.dropzone-content').hidden = false;
        dropzone.querySelector('.dropzone-success').hidden = true;
        this.elements.previewMt.hidden = true;
        
        this.updateAnalyzeButton();
    }

    removeAssetFile() {
        this.state.assetData = null;
        this.elements.fileAsset.value = '';
        
        const dropzone = this.elements.dropzoneAsset;
        dropzone.querySelector('.dropzone-content').hidden = false;
        dropzone.querySelector('.dropzone-success').hidden = true;
        this.elements.previewAsset.hidden = true;
        
        this.updateAnalyzeButton();
    }

    updateAnalyzeButton() {
        const canAnalyze = this.state.mtData !== null;
        this.elements.btnAnalyze.disabled = !canAnalyze;
    }

    // Navigation
    navigateTo(section) {
        // Update sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`section-${section}`).classList.add('active');
        
        // Update nav
        this.elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
        
        this.state.currentSection = section;
        
        // Initialize section-specific content
        if (section === 'simulation' && this.state.mtData) {
            this.initSimulation();
        }
    }

    enableNavigation() {
        this.elements.navBtns.forEach(btn => {
            btn.disabled = false;
        });
    }

    // Analysis
    async runAnalysis() {
        this.showLoading(true);
        
        try {
            // Short delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Get data
            const mtData = this.state.mtData;
            const assetData = this.state.assetData;
            
            // Get configuration values
            const initialCapital = parseFloat(this.elements.initialCapital?.value) || 1000;
            const chartColors = {
                strategy: this.elements.colorStrategy?.value || '#00f5d4',
                csv: this.elements.colorCsv?.value || '#f59e0b'
            };
            
            // Get date filters
            const startDateStr = this.elements.configDateStart?.value;
            const endDateStr = this.elements.configDateEnd?.value;
            const startDate = startDateStr ? new Date(startDateStr) : null;
            const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;
            
            // Filter trades by date range
            let filteredTrades = mtData.trades;
            if (startDate || endDate) {
                filteredTrades = mtData.trades.filter(trade => {
                    const tradeDate = trade.closeTime || trade.openTime;
                    if (!tradeDate) return true;
                    if (startDate && tradeDate < startDate) return false;
                    if (endDate && tradeDate > endDate) return false;
                    return true;
                });
            }
            
            // Calculate the scaling factor for dynamic capital simulation
            // Original capital from report (we'll assume it's based on the first balance or a default)
            const originalCapital = mtData.summary.initialBalance || 1000;
            const scaleFactor = initialCapital / originalCapital;
            
            // Scale the profits proportionally
            const scaledTrades = filteredTrades.map(trade => ({
                ...trade,
                profit: trade.profit * scaleFactor,
                originalProfit: trade.profit
            }));
            
            // Recalculate summary for filtered and scaled trades
            const scaledSummary = this.calculateScaledSummary(scaledTrades, initialCapital);
            
            // Store for later use
            this.state.initialCapital = initialCapital;
            this.state.chartColors = chartColors;
            this.state.filteredTrades = scaledTrades;
            this.state.scaleFactor = scaleFactor;
            
            // Update analysis header
            const tradeCount = scaledTrades.length;
            document.getElementById('analysis-subtitle').textContent = 
                `Compte ${mtData.accountInfo.accountNumber || '-'} • ${tradeCount} trades analysés • Capital: $${initialCapital.toLocaleString()}`;
            
            // Update KPIs with scaled summary
            this.updateKPIs(scaledSummary);
            
            // Create charts with filtered/scaled trades
            if (assetData) {
                // Filter asset data by date range too
                let filteredAssetData = assetData.data;
                if (startDate || endDate) {
                    filteredAssetData = assetData.data.filter(d => {
                        if (startDate && d.date < startDate) return false;
                        if (endDate && d.date > endDate) return false;
                        return true;
                    });
                }
                
                this.chartManager.createAssetChart(
                    'chart-asset',
                    filteredAssetData,
                    scaledTrades
                );
            }
            
            // Create equity chart with TWO curves (Balance & Equity)
            this.chartManager.createEquityChart(
                'chart-equity',
                scaledTrades,
                initialCapital,
                { balance: chartColors.strategy, equity: '#7b2cbf' } // Use strategy color for balance
            );
            
            // Create comparison chart (MT4/MT5 vs CSV) if CSV data is available
            if (assetData && assetData.data) {
                let filteredCsvData = assetData.data;
                if (startDate || endDate) {
                    filteredCsvData = assetData.data.filter(d => {
                        if (startDate && d.date < startDate) return false;
                        if (endDate && d.date > endDate) return false;
                        return true;
                    });
                }
                
                this.chartManager.createComparisonChart(
                    'chart-comparison',
                    scaledTrades,
                    filteredCsvData,
                    initialCapital,
                    chartColors
                );
            } else {
                // If no CSV data, still create the comparison chart with just MT4/MT5 data
                this.chartManager.createComparisonChart(
                    'chart-comparison',
                    scaledTrades,
                    [],
                    initialCapital,
                    chartColors
                );
            }
            
            this.chartManager.createDistributionChart(
                'chart-distribution',
                scaledTrades
            );
            
            // Populate trades table with scaled trades
            this.populateTradesTable(scaledTrades);
            
            // Initialize simulation engine with scaled data
            this.simulation.initialize(scaledTrades, scaledSummary);
            
            // Enable navigation
            this.enableNavigation();
            
            // Navigate to analysis
            this.navigateTo('analysis');
            
        } catch (error) {
            console.error('Analysis Error:', error);
            this.showToast('Erreur lors de l\'analyse', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Calculate summary statistics for scaled trades
     */
    calculateScaledSummary(trades, initialCapital) {
        const wins = trades.filter(t => t.profit > 0);
        const losses = trades.filter(t => t.profit < 0);
        
        const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
        const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
        
        // Calculate max drawdown
        let peak = initialCapital;
        let maxDrawdown = 0;
        let runningBalance = initialCapital;
        
        trades.forEach(trade => {
            runningBalance += trade.profit || 0;
            if (runningBalance > peak) peak = runningBalance;
            const drawdown = peak - runningBalance;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });
        
        const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
        
        // Calculate average trade duration
        let totalDuration = 0;
        let durationCount = 0;
        trades.forEach(trade => {
            if (trade.openTime && trade.closeTime) {
                totalDuration += (trade.closeTime - trade.openTime) / (1000 * 60); // minutes
                durationCount++;
            }
        });
        
        return {
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
            totalProfit: totalProfit,
            grossProfit: grossProfit,
            grossLoss: grossLoss,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
            avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
            avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
            maxDrawdown: maxDrawdown,
            maxDrawdownPercent: maxDrawdownPercent,
            avgDuration: durationCount > 0 ? totalDuration / durationCount : 0,
            initialBalance: initialCapital,
            finalBalance: initialCapital + totalProfit,
            returnPercent: initialCapital > 0 ? (totalProfit / initialCapital) * 100 : 0,
            startDate: trades.length > 0 ? trades[0].closeTime : null,
            endDate: trades.length > 0 ? trades[trades.length - 1].closeTime : null
        };
    }

    updateKPIs(summary) {
        // Profit
        document.getElementById('kpi-profit').textContent = this.formatCurrency(summary.totalProfit);
        const profitPct = document.getElementById('kpi-profit-pct');
        const pctValue = summary.profitFactor > 0 ? '+' + summary.winRate.toFixed(0) + '% WR' : '0%';
        profitPct.textContent = pctValue;
        profitPct.className = `kpi-change ${summary.totalProfit >= 0 ? 'positive' : 'negative'}`;
        
        // Win rate
        document.getElementById('kpi-winrate').textContent = `${summary.winRate.toFixed(1)}%`;
        document.getElementById('kpi-wins-losses').textContent = 
            `${summary.winningTrades}W / ${summary.losingTrades}L`;
        
        // Trades
        document.getElementById('kpi-total-trades').textContent = summary.totalTrades;
        const avgTrade = summary.totalTrades > 0 ? summary.totalProfit / summary.totalTrades : 0;
        document.getElementById('kpi-avg-trade').textContent = `Moy: ${this.formatCurrency(avgTrade)}`;
        
        // Drawdown
        document.getElementById('kpi-drawdown').textContent = `-${summary.maxDrawdownPercent.toFixed(1)}%`;
        document.getElementById('kpi-drawdown-val').textContent = this.formatCurrency(-summary.maxDrawdown);
        
        // Profit factor
        const pf = summary.profitFactor === Infinity ? '∞' : summary.profitFactor.toFixed(2);
        document.getElementById('kpi-profit-factor').textContent = pf;
        
        const avgWin = summary.avgWin || 0;
        const avgLoss = summary.avgLoss || 0;
        document.getElementById('kpi-rr').textContent = avgLoss > 0 
            ? `R:R ${(avgWin / avgLoss).toFixed(1)}:1` 
            : '-';
        
        // Duration
        const duration = summary.avgDuration || 0;
        if (duration < 60) {
            document.getElementById('kpi-avg-duration').textContent = `${Math.round(duration)}m`;
        } else if (duration < 1440) {
            document.getElementById('kpi-avg-duration').textContent = `${(duration / 60).toFixed(1)}h`;
        } else {
            document.getElementById('kpi-avg-duration').textContent = `${(duration / 1440).toFixed(1)}j`;
        }
        document.getElementById('kpi-duration-range').textContent = 'Durée moyenne';
    }

    populateTradesTable(trades, filter = 'all') {
        const tbody = this.elements.tradesTable;
        tbody.innerHTML = '';
        
        let filteredTrades = trades;
        if (filter === 'win') {
            filteredTrades = trades.filter(t => t.profit > 0);
        } else if (filter === 'loss') {
            filteredTrades = trades.filter(t => t.profit < 0);
        }
        
        filteredTrades.forEach(trade => {
            const row = document.createElement('tr');
            
            // Date
            const dateStr = trade.closeTime 
                ? trade.closeTime.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : '-';
            
            // Duration
            let durationStr = '-';
            if (trade.openTime && trade.closeTime) {
                const mins = (trade.closeTime - trade.openTime) / (1000 * 60);
                if (mins < 60) {
                    durationStr = `${Math.round(mins)}m`;
                } else if (mins < 1440) {
                    durationStr = `${(mins / 60).toFixed(1)}h`;
                } else {
                    durationStr = `${(mins / 1440).toFixed(1)}j`;
                }
            }
            
            row.innerHTML = `
                <td>${dateStr}</td>
                <td class="${trade.type === 'buy' ? 'type-buy' : 'type-sell'}">${trade.type.toUpperCase()}</td>
                <td>${trade.volume?.toFixed(2) || '-'}</td>
                <td>${this.formatPrice(trade.entryPrice)}</td>
                <td>${this.formatPrice(trade.exitPrice)}</td>
                <td class="${trade.profit >= 0 ? 'pnl-positive' : 'pnl-negative'}">${this.formatCurrency(trade.profit)}</td>
                <td>${durationStr}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    filterTrades(filter) {
        this.elements.filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        if (this.state.mtData) {
            this.populateTradesTable(this.state.mtData.trades, filter);
        }
    }

    // Simulation
    initSimulation() {
        // Set date range
        const dateRange = this.simulation.getDateRange();
        
        if (dateRange.min) {
            this.elements.simDateStart.value = this.formatDateInput(dateRange.min);
            this.elements.simDateStart.min = this.formatDateInput(dateRange.min);
        }
        
        if (dateRange.max) {
            this.elements.simDateEnd.value = this.formatDateInput(dateRange.max);
            this.elements.simDateEnd.max = this.formatDateInput(dateRange.max);
        }
        
        // Run initial simulation
        this.runSimulation();
    }

    onCapitalChange() {
        // Update preset buttons
        const value = this.elements.simCapital.value;
        this.elements.presetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }

    onLeverageChange() {
        const value = parseFloat(this.elements.simLeverage.value);
        this.elements.leverageDisplay.textContent = value.toFixed(1);
    }

    onDateChange() {
        // Clear date preset active state
        this.elements.datePresetBtns.forEach(btn => btn.classList.remove('active'));
    }

    setDatePreset(range) {
        const dateRange = this.simulation.getDateRange();
        if (!dateRange.max) return;
        
        let startDate = dateRange.min;
        const endDate = dateRange.max;
        
        switch (range) {
            case '1m':
                startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case '3m':
                startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 3);
                break;
            case '6m':
                startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 6);
                break;
            case 'all':
            default:
                startDate = dateRange.min;
                break;
        }
        
        // Ensure start date is not before min date
        if (dateRange.min && startDate < dateRange.min) {
            startDate = dateRange.min;
        }
        
        this.elements.simDateStart.value = this.formatDateInput(startDate);
        this.elements.simDateEnd.value = this.formatDateInput(endDate);
    }

    updatePresetActive(activeBtn, allBtns) {
        allBtns.forEach(btn => {
            btn.classList.toggle('active', btn === activeBtn);
        });
    }

    runSimulation() {
        const params = {
            capital: parseFloat(this.elements.simCapital.value) || 10000,
            startDate: this.elements.simDateStart.value ? new Date(this.elements.simDateStart.value) : null,
            endDate: this.elements.simDateEnd.value ? new Date(this.elements.simDateEnd.value) : null,
            leverage: parseFloat(this.elements.simLeverage.value) || 1
        };
        
        const results = this.simulation.simulate(params);
        const comparison = this.simulation.getComparisonData();
        
        // Update comparison cards
        this.updateComparisonCards(comparison);
        
        // Update metrics
        this.updateSimulationMetrics(results);
        
        // Update chart
        const originalCurve = this.simulation.getOriginalEquityCurve();
        this.chartManager.createSimulationChart(
            'chart-simulation',
            originalCurve,
            results.equityCurve
        );
    }

    updateComparisonCards(comparison) {
        if (!comparison) return;
        
        // Original
        document.getElementById('orig-capital').textContent = this.formatCurrency(comparison.original.capital);
        document.getElementById('orig-profit').textContent = this.formatCurrency(comparison.original.profit, true);
        document.getElementById('orig-return').textContent = 
            `${comparison.original.return >= 0 ? '+' : ''}${comparison.original.return.toFixed(2)}%`;
        document.getElementById('orig-final').textContent = this.formatCurrency(comparison.original.final);
        
        // Simulated
        document.getElementById('sim-capital-display').textContent = this.formatCurrency(comparison.simulated.capital);
        document.getElementById('sim-profit').textContent = this.formatCurrency(comparison.simulated.profit, true);
        document.getElementById('sim-return').textContent = 
            `${comparison.simulated.return >= 0 ? '+' : ''}${comparison.simulated.return.toFixed(2)}%`;
        document.getElementById('sim-final').textContent = this.formatCurrency(comparison.simulated.final);
        
        // Update classes
        document.getElementById('sim-profit').className = 
            `stat-value ${comparison.simulated.profit >= 0 ? 'positive' : 'negative'}`;
    }

    updateSimulationMetrics(results) {
        document.getElementById('sim-trades-count').textContent = results.totalTrades;
        
        document.getElementById('sim-best-trade').textContent = this.formatCurrency(results.bestTrade, true);
        document.getElementById('sim-worst-trade').textContent = this.formatCurrency(results.worstTrade);
        
        document.getElementById('sim-avg-gain').textContent = this.formatCurrency(results.avgGain);
        document.getElementById('sim-monthly-return').textContent = 
            `${results.monthlyReturn >= 0 ? '+' : ''}${results.monthlyReturn.toFixed(2)}%`;
        document.getElementById('sim-yearly-projection').textContent = this.formatCurrency(results.yearlyProjection, true);
    }

    // UI Helpers
    showLoading(show) {
        this.elements.loadingOverlay.hidden = !show;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;
        
        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        
        this.elements.toastContainer.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Theme management
    initTheme() {
        // Check for saved theme preference, default to dark
        const savedTheme = localStorage.getItem('phinea-theme') || 'dark';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
        
        // Show feedback toast
        const themeLabel = newTheme === 'light' ? 'clair' : 'sombre';
        this.showToast(`Mode ${themeLabel} activé`, 'info');
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('phinea-theme', theme);
        
        // Update chart colors if charts exist
        if (this.chartManager && typeof this.chartManager.updateTheme === 'function') {
            this.chartManager.updateTheme(theme);
        }
    }

    // Formatting helpers
    formatCurrency(value, showSign = false) {
        if (typeof value !== 'number' || isNaN(value)) return '$0.00';
        
        const sign = showSign && value > 0 ? '+' : '';
        const formatted = Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        return `${value < 0 ? '-' : sign}$${formatted}`;
    }

    formatPrice(value) {
        if (typeof value !== 'number' || isNaN(value)) return '-';
        
        if (value >= 1000) {
            return value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        return value.toFixed(5);
    }

    formatDateInput(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TradeAnalyzerApp();
});
