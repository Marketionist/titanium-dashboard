import { app, BrowserWindow, ipcMain } from 'electron';
import yf from './yahoo-finance';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { StockQuote, ChartDataPoint, ChartOptions, HistoricalCharts } from '../src/types';

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MS_PER_SECOND = 1000;
const SECS_PER_MIN = 60;
const MINS_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MINS_PER_HOUR * SECS_PER_MIN * MS_PER_SECOND;
const DAYS_IN_YEAR = 365;
const BUFFER_DAYS = 4;
const LOOKBACK_DAYS_LIMIT = 7;
const SESSION_START_HOUR = 9;
const SESSION_START_MINUTE = 30;
const RECENT_HISTORY_DAYS = 30;
const TRADING_SESSION_START_TIME = '09:30:00';

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ?
    path.join(process.env.APP_ROOT, 'public') :
    RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow () {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        },
    });

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send(
            'main-process-message',
            new Date().toLocaleString()
        );
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL).catch((err) => {
            console.error('Failed to load URL:', err);
        });
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(RENDERER_DIST, 'index.html')).catch((err) => {
            console.error('Failed to load file:', err);
        });
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// No longer need yahooFinance interop for Node.js
// const yf = new (yahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

/**
 * Safely extracts and formats quotes from Yahoo Finance chart data,
 * even if the data was only partially validated.
 */
function getSafeChartQuotes (chartData: { quotes: ChartDataPoint[] }): ChartDataPoint[] {
    if (!chartData || !chartData.quotes) { return []; }
    return chartData.quotes
        .filter((q) => q && q.close !== null && q.date !== null)
        .map((q) => ({
            close: q.close,
            date: new Date(q.date).toISOString(),
        }));
}

/**
 * Fetches chart data with graceful handling of validation errors.
 */
async function fetchChartSafe (symbol: string, options: ChartOptions) {
    try {
        return await yf.chart(symbol, options);
    } catch (err: unknown) {
        // Log and re-throw so the caller can return a safe empty object
        throw err;
    }
}

/**
 * Calculates the 9:30 AM session start in a specific IANA timezone.
 */
function getZonedSessionStart (latestDate: Date, timezone: string): Date {
    try {
        const getZoned930 = (date: Date) => {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                timeZoneName: 'longOffset',
            });
            const parts = formatter.formatToParts(date);
            const y = parts.find((p) => p.type === 'year')!.value;
            const m = parts.find((p) => p.type === 'month')!.value;
            const d = parts.find((p) => p.type === 'day')!.value;
            const offsetPart = parts.find((p) => p.type === 'timeZoneName')!.value;
            const offset = offsetPart.replace('GMT', '');

            const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            const timeString = `${dateStr}T${TRADING_SESSION_START_TIME}`;

            return new Date(`${timeString}${offset === '' ? 'Z' : offset}`);
        };

        let sessionStart = getZoned930(latestDate);
        let lookbackDays = 0;

        while (
            sessionStart.getTime() > latestDate.getTime() &&
            lookbackDays < LOOKBACK_DAYS_LIMIT
        ) {
            lookbackDays++;
            sessionStart = getZoned930(
                new Date(latestDate.getTime() - lookbackDays * MS_PER_DAY)
            );
        }
        return sessionStart;
    } catch {
        return new Date(
            latestDate.getFullYear(),
            latestDate.getMonth(),
            latestDate.getDate(),
            SESSION_START_HOUR,
            SESSION_START_MINUTE,
            0,
            0
        );
    }
}

app.whenReady().then(() => {
    ipcMain.handle(
        'get-stock-quotes',
        async (_event, symbols: string[], timezone: string) => {
            try {
                if (!symbols || symbols.length === 0) { return []; }
                const results = await yf.quote(symbols);
                const quotesArr = Array.isArray(results) ? results : [results,];

                // Fetch chart data for the current day (approximate last 4 days for buffer)
                const period1 = new Date(Date.now() - BUFFER_DAYS * MS_PER_DAY);

                const enrichedQuotes = await Promise.all(
                    quotesArr.map(async (q: StockQuote) => {
                        try {
                            const chartData = await fetchChartSafe(q.symbol, {
                                period1,
                                interval: '15m',
                            });
                            const validClose = getSafeChartQuotes(chartData);

                            // Only take data from 9:30 AM onwards of the most recent trading day
                            // in the selected timezone
                            let recentClose = validClose;

                            if (validClose.length > 0) {
                                const latestDate = new Date(
                                    validClose[validClose.length - 1].date
                                );

                                let sessionStart: Date;

                                if (timezone === 'UTC') {
                                    sessionStart = new Date(
                                        Date.UTC(
                                            latestDate.getUTCFullYear(),
                                            latestDate.getUTCMonth(),
                                            latestDate.getUTCDate(),
                                            SESSION_START_HOUR,
                                            SESSION_START_MINUTE,
                                            0,
                                            0
                                        )
                                    );
                                } else if (timezone === 'Local' || !timezone) {
                                    sessionStart = new Date(
                                        latestDate.getFullYear(),
                                        latestDate.getMonth(),
                                        latestDate.getDate(),
                                        SESSION_START_HOUR,
                                        SESSION_START_MINUTE,
                                        0,
                                        0
                                    );
                                } else {
                                    sessionStart = getZonedSessionStart(
                                        latestDate,
                                        timezone
                                    );
                                }

                                recentClose = validClose.filter(
                                    (p) =>
                                        new Date(p.date).getTime() >=
                                        sessionStart.getTime()
                                );
                            }

                            return { ...q, chart: recentClose, };
                        } catch (err) {
                            console.error(`Failed chart for ${q.symbol}`, err);
                            return { ...q, chart: [], };
                        }
                    })
                );

                return enrichedQuotes;
            } catch (error: unknown) {
                console.error('Failed to fetch stock quotes:', error);
                throw error; // Re-throw to trigger recovery UI in renderer
            }
        }
    );

    ipcMain.handle('get-historical-charts', async (_event, symbol: string) => {
        try {
            const period30d = new Date(Date.now() - RECENT_HISTORY_DAYS * MS_PER_DAY);
            const period1y = new Date(Date.now() - DAYS_IN_YEAR * MS_PER_DAY);

            const [res30d, res1y,] = await Promise.all([
                fetchChartSafe(symbol, { period1: period30d, interval: '1d', }),
                fetchChartSafe(symbol, { period1: period1y, interval: '1wk', }),
            ]);

            return {
                chart30d: getSafeChartQuotes(res30d),
                chart1y: getSafeChartQuotes(res1y),
            } satisfies HistoricalCharts;
        } catch (error: unknown) {
            console.error(
                `Failed to fetch historical charts for ${symbol}:`,
                error
            );
            return { chart30d: [], chart1y: [], } satisfies HistoricalCharts;
        }
    });

    createWindow();
}).catch((err) => {
    console.error('Failed to initialize app:', err);
});
