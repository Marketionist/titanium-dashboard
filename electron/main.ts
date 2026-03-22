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

app.whenReady().then(() => {
    ipcMain.handle("get-stock-quotes", async (_event, symbols: string[]) => {
        try {
            if (!symbols || symbols.length === 0) return [];
            const results = await yf.quote(symbols);
            const quotesArr = Array.isArray(results) ? results : [results];

            // Fetch chart data for the current day (approximate last 40 data points = 10 hours at 15m intervals)
            const period1 = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days buffer for weekends

            const enrichedQuotes = await Promise.all(
                quotesArr.map(async (q: any) => {
                    try {
                        const chartData = await yf.chart(q.symbol, {
                            period1,
                            interval: "15m",
                        });
                        const validClose = chartData.quotes
                            .filter((c: any) => c.close !== null)
                            .map((c: any) => ({
                                close: c.close,
                                date: new Date(c.date).toISOString(),
                            }));

                        // Only take the last 30 data points representing recent day trading
                        const recentClose = validClose.slice(-30);
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
            return [];
        }
    });

    ipcMain.handle("get-historical-charts", async (_event, symbol: string) => {
        try {
            const period30d = new Date(Date.now() - 30 * 86400000);
            const period1y = new Date(Date.now() - 365 * 86400000);

            const [res30d, res1y] = await Promise.all([
                yf.chart(symbol, { period1: period30d, interval: "1d" }),
                yf.chart(symbol, { period1: period1y, interval: "1wk" }),
            ]);

            return {
                chart30d: res30d.quotes
                    .filter((q: any) => q.close !== null)
                    .map((q: any) => ({
                        close: q.close,
                        date: new Date(q.date).toISOString(),
                    })),
                chart1y: res1y.quotes
                    .filter((q: any) => q.close !== null)
                    .map((q: any) => ({
                        close: q.close,
                        date: new Date(q.date).toISOString(),
                    })),
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
