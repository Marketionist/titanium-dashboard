import { app, BrowserWindow, ipcMain } from "electron";
import yahooFinance from "yahoo-finance2";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// @ts-ignore
globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, "public")
    : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
        },
    });

    // Test active push message to Renderer-process.
    win.webContents.on("did-finish-load", () => {
        win?.webContents.send(
            "main-process-message",
            new Date().toLocaleString(),
        );
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(RENDERER_DIST, "index.html"));
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
        win = null;
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Handle ESM default import interop for Node.js
const yf = new (yahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

/**
 * Safely extracts and formats quotes from Yahoo Finance chart data,
 * even if the data was only partially validated.
 */
function getSafeChartQuotes(chartData: any) {
    if (!chartData || !chartData.quotes) return [];
    return chartData.quotes
        .filter((q: any) => q && q.close !== null && q.date !== null)
        .map((q: any) => ({
            close: q.close,
            date: new Date(q.date).toISOString(),
        }));
}

/**
 * Fetches chart data with graceful handling of validation errors.
 */
async function fetchChartSafe(symbol: string, options: any) {
    try {
        return await yf.chart(symbol, options);
    } catch (err: any) {
        // Log and re-throw so the caller can return a safe empty object
        throw err;
    }
}

app.whenReady().then(() => {
    ipcMain.handle(
        "get-stock-quotes",
        async (_event, symbols: string[], timezone: string) => {
            try {
                if (!symbols || symbols.length === 0) return [];
                const results = await yf.quote(symbols);
                const quotesArr = Array.isArray(results) ? results : [results];

                // Fetch chart data for the current day (approximate last 4 days for buffer)
                const period1 = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

                const enrichedQuotes = await Promise.all(
                    quotesArr.map(async (q: any) => {
                        try {
                            const chartData = await fetchChartSafe(q.symbol, {
                                period1,
                                interval: "15m",
                            });
                            const validClose = getSafeChartQuotes(chartData);

                            // Only take data from 9:30 AM onwards of the most recent trading day in the selected timezone
                            let recentClose = validClose;
                            if (validClose.length > 0) {
                                const latestDate = new Date(
                                    validClose[validClose.length - 1].date,
                                );

                                let sessionStart: Date;

                                if (timezone === "UTC") {
                                    sessionStart = new Date(
                                        Date.UTC(
                                            latestDate.getUTCFullYear(),
                                            latestDate.getUTCMonth(),
                                            latestDate.getUTCDate(),
                                            9,
                                            30,
                                            0,
                                            0,
                                        ),
                                    );
                                } else if (timezone === "Local" || !timezone) {
                                    sessionStart = new Date(
                                        latestDate.getFullYear(),
                                        latestDate.getMonth(),
                                        latestDate.getDate(),
                                        9,
                                        30,
                                        0,
                                        0,
                                    );
                                } else {
                                    // Handle specific IANA timezones
                                    try {
                                        const getZoned930 = (date: Date) => {
                                            const formatter =
                                                new Intl.DateTimeFormat(
                                                    "en-US",
                                                    {
                                                        timeZone: timezone,
                                                        year: "numeric",
                                                        month: "numeric",
                                                        day: "numeric",
                                                        timeZoneName:
                                                            "longOffset",
                                                    },
                                                );
                                            const parts =
                                                formatter.formatToParts(date);
                                            const y = parts.find(
                                                (p) => p.type === "year",
                                            )!.value;
                                            const m = parts.find(
                                                (p) => p.type === "month",
                                            )!.value;
                                            const d = parts.find(
                                                (p) => p.type === "day",
                                            )!.value;
                                            const offsetPart = parts.find(
                                                (p) =>
                                                    p.type === "timeZoneName",
                                            )!.value; // e.g. "GMT-04:00"
                                            const offset = offsetPart.replace(
                                                "GMT",
                                                "",
                                            );
                                            return new Date(
                                                `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T09:30:00${offset === "" ? "Z" : offset}`,
                                            );
                                        };

                                        // Find 9:30 AM in target timezone starting from the latest point's day
                                        sessionStart = getZoned930(latestDate);

                                        // If the latest point is BEFORE its own day's 9:30 AM (e.g. Saturday in Tokyo looking at US Friday close),
                                        // or if we simply have no data for that day yet, look back for the previous day's 9:30 AM start.
                                        let lookbackDays = 0;
                                        while (
                                            sessionStart.getTime() >
                                                latestDate.getTime() &&
                                            lookbackDays < 7
                                        ) {
                                            lookbackDays++;
                                            sessionStart = getZoned930(
                                                new Date(
                                                    latestDate.getTime() -
                                                        lookbackDays * 86400000,
                                                ),
                                            );
                                        }
                                    } catch (e) {
                                        // Fallback to local if timezone invalid
                                        sessionStart = new Date(
                                            latestDate.getFullYear(),
                                            latestDate.getMonth(),
                                            latestDate.getDate(),
                                            9,
                                            30,
                                            0,
                                            0,
                                        );
                                    }
                                }

                                recentClose = validClose.filter(
                                    (p: any) =>
                                        new Date(p.date).getTime() >=
                                        sessionStart.getTime(),
                                );
                            }

                            return { ...q, chart: recentClose };
                        } catch (err) {
                            console.error(`Failed chart for ${q.symbol}`, err);
                            return { ...q, chart: [] };
                        }
                    }),
                );

                return enrichedQuotes;
            } catch (error: any) {
                console.error("Failed to fetch stock quotes:", error);
                throw error; // Re-throw to trigger recovery UI in renderer
            }
        },
    );

    ipcMain.handle("get-historical-charts", async (_event, symbol: string) => {
        try {
            const period30d = new Date(Date.now() - 30 * 86400000);
            const period1y = new Date(Date.now() - 365 * 86400000);

            const [res30d, res1y] = await Promise.all([
                fetchChartSafe(symbol, { period1: period30d, interval: "1d" }),
                fetchChartSafe(symbol, { period1: period1y, interval: "1wk" }),
            ]);

            return {
                chart30d: getSafeChartQuotes(res30d),
                chart1y: getSafeChartQuotes(res1y),
            };
        } catch (error: any) {
            console.error(
                `Failed to fetch historical charts for ${symbol}:`,
                error,
            );
            return { chart30d: [], chart1y: [] };
        }
    });

    createWindow();
});
