/**
 * PHINEA TRADE ANALYZER - MT4/MT5 & CSV Parser
 * Parses trading reports and asset price data
 */

class MT5Parser {
    constructor() {
        this.trades = [];
        this.accountInfo = {};
        this.summary = {};
    }

    async parse(htmlContent) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            this.extractAccountInfo(doc);
            this.extractPositions(doc);
            this.calculateSummary();
            
            console.log('Parsed trades:', this.trades.length);
            if (this.trades.length > 0) {
                console.log('First trade:', this.trades[0]);
            }
            
            return {
                success: true,
                accountInfo: this.accountInfo,
                trades: this.trades,
                summary: this.summary
            };
        } catch (error) {
            console.error('MT5 Parser Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    extractAccountInfo(doc) {
        const ths = doc.querySelectorAll('th');
        
        ths.forEach((th, index) => {
            const text = th.textContent.trim();
            const nextTh = ths[index + 1];
            
            if ((text === 'Name:' || text.includes('Name:')) && nextTh) {
                this.accountInfo.name = nextTh.textContent.trim();
            }
            if ((text === 'Account:' || text.includes('Account:')) && nextTh) {
                this.accountInfo.account = nextTh.textContent.trim().replace(/\s+/g, ' ');
            }
            if ((text === 'Company:' || text.includes('Company:')) && nextTh) {
                this.accountInfo.company = nextTh.textContent.trim();
            }
            if ((text === 'Date:' || text.includes('Date:')) && nextTh) {
                this.accountInfo.reportDate = nextTh.textContent.trim();
            }
        });
        
        if (this.accountInfo.account) {
            const match = this.accountInfo.account.match(/^(\d+)/);
            if (match) this.accountInfo.accountNumber = match[1];
            
            const currencyMatch = this.accountInfo.account.match(/\(([A-Z]{3})/);
            if (currencyMatch) this.accountInfo.currency = currencyMatch[1];
        }
    }

    extractPositions(doc) {
        const rows = doc.querySelectorAll('tr');
        let inTradesSection = false;
        let format = null; // 'mt5' or 'mt4'
        
        for (const row of rows) {
            const rowText = row.textContent.trim();
            
            // === MT5 Format: Look for "Positions" section ===
            if (rowText.includes('Positions') && row.querySelector('th')) {
                inTradesSection = true;
                format = 'mt5';
                console.log('Entering MT5 Positions section');
                continue;
            }
            
            // === MT4 Format: Look for "Closed Transactions" section ===
            if (rowText.includes('Closed Transactions:')) {
                inTradesSection = true;
                format = 'mt4';
                console.log('Entering MT4 Closed Transactions section');
                continue;
            }
            
            // Exit on other sections (for both formats)
            const isHeaderRow = row.querySelector('th') || 
                (row.querySelector('td b') && rowText.match(/^(Open Trades|Working Orders|Summary|Details)/));
            
            if (isHeaderRow && 
                (rowText.includes('Open Trades:') || rowText.includes('Working Orders:') || 
                 rowText.includes('Orders') || rowText.includes('Deals') || 
                 rowText.includes('Summary:') || rowText.includes('Total'))) {
                if (inTradesSection) {
                    console.log('Exiting trades section, found:', this.trades.length, 'trades');
                }
                inTradesSection = false;
                continue;
            }
            
            // Skip header rows with column names
            if (rowText.includes('Ticket') && rowText.includes('Open Time') && rowText.includes('Profit')) {
                continue; // MT4 header
            }
            if (rowText.includes('Time') && rowText.includes('Position') && rowText.includes('Volume')) {
                continue; // MT5 header
            }
            
            if (!inTradesSection) continue;
            
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) continue;
            
            const trade = format === 'mt4' 
                ? this.parseMT4Row(cells)
                : this.parsePositionRow(cells);
                
            if (trade) {
                this.trades.push(trade);
            }
        }
        
        this.trades.sort((a, b) => (a.openTime || 0) - (b.openTime || 0));
        console.log('Total trades parsed:', this.trades.length);
    }

    /**
     * Parse an MT4 "Closed Transactions" row.
     * MT4 format columns: Ticket | Open Time | Type | Size | Item | Price | S/L | T/P | Close Time | Price | Commission | Taxes | Swap | Profit
     */
    parseMT4Row(cells) {
        try {
            const values = Array.from(cells).map(cell => cell.textContent.trim());
            
            // Check if this row has the expected structure
            // First cell is ticket number, second is open time
            if (values.length < 10) {
                return null;
            }
            
            const ticket = values[0];
            const openTimeText = values[1];
            const type = values[2].toLowerCase();
            
            // Skip non-trade rows (like balance entries)
            if (!type.includes('buy') && !type.includes('sell')) {
                // Skip balance, deposit, withdrawal, etc.
                return null;
            }
            
            // Parse lot size - handle format like "0.07"
            const size = this.parseNumber(values[3]);
            const symbol = values[4];
            const entryPrice = this.parseNumber(values[5]);
            // values[6] = S/L
            // values[7] = T/P
            const closeTimeText = values[8];
            const exitPrice = this.parseNumber(values[9]);
            const commission = this.parseNumber(values[10]);
            // values[11] = Taxes (usually 0)
            const swap = this.parseNumber(values[12]);
            const profit = this.parseNumber(values[13]);
            
            const openTime = this.parseDateTime(openTimeText);
            const closeTime = this.parseDateTime(closeTimeText);
            
            if (!openTime) {
                return null;
            }
            
            return {
                id: ticket,
                orderId: ticket,
                symbol: symbol,
                type: type.includes('buy') ? 'buy' : 'sell',
                volume: size,
                entryPrice: entryPrice,
                exitPrice: exitPrice,
                openTime: openTime,
                closeTime: closeTime || openTime,
                commission: commission,
                fee: 0,
                swap: swap,
                profit: profit,
                netProfit: profit + commission + swap
            };
        } catch (error) {
            console.error('Error parsing MT4 row:', error);
            return null;
        }
    }

    /**
     * Parse a number from MT4/MT5 format (handles spaces as thousand separators)
     */
    parseNumber(str) {
        if (!str) return 0;
        // Remove spaces and replace formatting
        const cleaned = str.replace(/\s/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }

    /**
     * Parse a Positions row (MT5 format).
     * The HTML has a hidden cell with colspan="8" that we need to skip.
     * 
     * Visual columns: Time | Position | Symbol | Type | Volume | Price | S/L | T/P | Time | Price | Commission | Swap | Profit
     * But there's a hidden <td class="hidden" colspan="8"> after Type
     */
    parsePositionRow(cells) {
        try {
            // Collect values, skipping hidden cells
            const values = [];
            
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const isHidden = cell.classList.contains('hidden');
                
                // Skip hidden cells entirely
                if (isHidden) {
                    continue;
                }
                
                values.push(cell.textContent.trim());
            }
            
            // Minimum values needed
            if (values.length < 10) {
                return null;
            }
            
            // First value should be a date
            if (!values[0].match(/^\d{4}\.\d{2}\.\d{2}/)) {
                return null;
            }
            
            // Parse the values
            // Expected order after filtering hidden: 
            // [0] Open Time, [1] Position ID, [2] Symbol, [3] Type, 
            // [4] Volume, [5] Entry Price, [6] S/L, [7] T/P, 
            // [8] Close Time, [9] Exit Price, [10] Commission, [11] Swap, [12] Profit
            
            const openTimeText = values[0];
            const positionId = values[1];
            const symbol = values[2];
            const type = values[3].toLowerCase();
            
            // Skip non-trade rows
            if (!type.includes('buy') && !type.includes('sell')) {
                return null;
            }
            
            const volume = parseFloat(values[4]) || 0;
            const entryPrice = parseFloat(values[5]) || 0;
            const closeTimeText = values[8] || openTimeText;
            const exitPrice = parseFloat(values[9]) || entryPrice;
            const commission = parseFloat(values[10]) || 0;
            const swap = parseFloat(values[11]) || 0;
            const profit = parseFloat(values[12]) || 0;
            
            const openTime = this.parseDateTime(openTimeText);
            const closeTime = this.parseDateTime(closeTimeText);
            
            if (!openTime) {
                return null;
            }
            
            return {
                id: positionId,
                orderId: positionId,
                symbol: symbol,
                type: type.includes('buy') ? 'buy' : 'sell',
                volume: volume,
                entryPrice: entryPrice,
                exitPrice: exitPrice,
                openTime: openTime,
                closeTime: closeTime || openTime,
                commission: commission,
                fee: 0,
                swap: swap,
                profit: profit,
                netProfit: profit + commission + swap
            };
        } catch (error) {
            console.error('Error parsing row:', error);
            return null;
        }
    }

    parseDateTime(dateStr) {
        if (!dateStr) return null;
        
        const parts = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/);
        
        if (parts) {
            const [, year, month, day, hour, minute, second = '00'] = parts;
            return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        }
        
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    calculateSummary() {
        const trades = this.trades;
        
        const wins = trades.filter(t => t.profit > 0);
        const losses = trades.filter(t => t.profit < 0);
        
        const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
        const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));
        
        let startDate = null;
        let endDate = null;
        
        if (trades.length > 0) {
            const dates = trades.map(t => t.openTime).filter(d => d).sort((a, b) => a - b);
            if (dates.length > 0) {
                startDate = dates[0];
                endDate = dates[dates.length - 1];
            }
        }
        
        let maxDrawdown = 0;
        let peak = 0;
        let equity = 0;
        
        trades.forEach(trade => {
            equity += trade.profit;
            if (equity > peak) peak = equity;
            const drawdown = peak - equity;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        });
        
        const durations = trades
            .filter(t => t.openTime && t.closeTime)
            .map(t => (t.closeTime - t.openTime) / (1000 * 60));
        
        const avgDuration = durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0;
        
        this.summary = {
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
            totalProfit,
            grossProfit,
            grossLoss,
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
            avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
            avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
            maxDrawdown,
            maxDrawdownPercent: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
            startDate,
            endDate,
            avgDuration,
            // Add initial balance (we estimate it as 0 since MT5 reports don't always include it)
            // The user can override this with the Capital Initial field
            initialBalance: 1000
        };
    }
}

class CSVParser {
    constructor() {
        this.data = [];
        this.summary = {};
    }

    async parse(csvContent) {
        try {
            const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
            
            if (lines.length < 2) {
                throw new Error('CSV file is empty or has no data rows');
            }
            
            const header = this.parseCSVLine(lines[0]);
            const columnMap = this.mapColumns(header);
            
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                const row = this.parseDataRow(values, columnMap);
                
                if (row && row.date && !isNaN(row.close)) {
                    this.data.push(row);
                }
            }
            
            this.data.sort((a, b) => a.date - b.date);
            this.calculateSummary();
            
            return {
                success: true,
                data: this.data,
                summary: this.summary
            };
        } catch (error) {
            console.error('CSV Parser Error:', error);
            return { success: false, error: error.message };
        }
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));
        return values;
    }

    mapColumns(header) {
        const map = {};
        const lowerHeader = header.map(h => h.toLowerCase().trim());
        
        const mappings = {
            date: ['date', 'datetime', 'time', 'timestamp'],
            open: ['open', 'o', 'opening'],
            high: ['high', 'h', 'max'],
            low: ['low', 'l', 'min'],
            close: ['close', 'c', 'price', 'closing', 'last'],
            volume: ['volume', 'vol', 'v'],
            change: ['change', 'change %', 'change%', 'pct_change']
        };
        
        for (const [key, aliases] of Object.entries(mappings)) {
            for (let i = 0; i < lowerHeader.length; i++) {
                if (aliases.some(alias => lowerHeader[i].includes(alias))) {
                    map[key] = i;
                    break;
                }
            }
        }
        return map;
    }

    parseDataRow(values, columnMap) {
        try {
            const dateStr = values[columnMap.date];
            const date = this.parseDate(dateStr);
            if (!date) return null;
            
            const parseNum = (str) => str ? parseFloat(str.replace(/,/g, '')) : NaN;
            
            return {
                date,
                open: parseNum(values[columnMap.open]),
                high: parseNum(values[columnMap.high]),
                low: parseNum(values[columnMap.low]),
                close: parseNum(values[columnMap.close]) || parseNum(values[columnMap.open]),
                volume: parseNum(values[columnMap.volume]) || 0,
                change: values[columnMap.change] || null
            };
        } catch (error) {
            return null;
        }
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        
        let match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (match) {
            return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        }
        
        match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        
        match = dateStr.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
        if (match) {
            return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    calculateSummary() {
        if (this.data.length === 0) {
            this.summary = {};
            return;
        }
        
        const firstPrice = this.data[0].close;
        const lastPrice = this.data[this.data.length - 1].close;
        const change = lastPrice - firstPrice;
        const changePercent = (change / firstPrice) * 100;
        
        const highs = this.data.map(d => d.high).filter(h => !isNaN(h));
        const lows = this.data.map(d => d.low).filter(l => !isNaN(l));
        
        this.summary = {
            dataPoints: this.data.length,
            startDate: this.data[0].date,
            endDate: this.data[this.data.length - 1].date,
            firstPrice,
            lastPrice,
            change,
            changePercent,
            highestPrice: highs.length > 0 ? Math.max(...highs) : lastPrice,
            lowestPrice: lows.length > 0 ? Math.min(...lows) : firstPrice,
            avgVolume: this.data.reduce((sum, d) => sum + (d.volume || 0), 0) / this.data.length
        };
    }
}

window.MT5Parser = MT5Parser;
window.CSVParser = CSVParser;
