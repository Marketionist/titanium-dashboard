/**
 * A lightweight replacement for yahoo-finance2 using direct fetch calls
 * to the unofficial Yahoo Finance API (query1.finance.yahoo.com).
 */

export interface QuoteOptions {
    symbols: string[];
}

export interface ChartOptions {
    period1: Date | number;
    period2?: Date | number;
    interval?: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "90m" | "1h" | "1d" | "5d" | "1wk" | "1mo" | "3mo";
}

/**
 * Standard headers to mimic a browser request.
 */
const BASE_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    Accept: "*/*",
    Origin: "https://finance.yahoo.com",
    Referer: "https://finance.yahoo.com",
};

/**
 * Manages the crumb and session cookies for Yahoo Finance API.
 */
class CrumbManager {
    private cookie: string | null = null;
    private crumb: string | null = null;
    private lastRefresh: number = 0;
    private isRefreshing: Promise<void> | null = null;

    private async refresh() {
        if (this.isRefreshing) return this.isRefreshing;

        this.isRefreshing = (async () => {
            try {
                // 1. Get initial cookie from a landing page
                const initialResponse = await fetch("https://fc.yahoo.com/", {
                    headers: BASE_HEADERS,
                    redirect: "manual",
                });
                
                const setCookie = initialResponse.headers.get("set-cookie");
                if (setCookie) {
                    // Extract only the part before the first semicolon (the core cookie)
                    this.cookie = setCookie.split(";")[0];
                }

                // 2. Fetch the crumb using the cookie
                let crumbResponse: Response | null = null;
                for (let attempt = 0; attempt < 3; attempt++) {
                    crumbResponse = await fetch(
                        "https://query1.finance.yahoo.com/v1/test/getcrumb",
                        {
                            headers: {
                                ...BASE_HEADERS,
                                Cookie: this.cookie || "",
                            },
                        },
                    );

                    if (crumbResponse.ok) {
                        break;
                    }

                    console.log(`Failed to fetch crumb (${crumbResponse.status}). Retrying in 1000ms...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                if (!crumbResponse || !crumbResponse.ok) {
                    console.warn(`Warning: Failed to fetch crumb: ${crumbResponse?.statusText || "Unknown"}. Proceeding without it...`);
                    this.crumb = null;
                    this.lastRefresh = Date.now();
                } else {
                    this.crumb = await crumbResponse.text();
                    this.lastRefresh = Date.now();
                    console.log(`Successfully refreshed Yahoo crumb: ${this.crumb ? "***" : "FAILED"}`);
                }
            } catch (error) {
                console.error("Error refreshing Yahoo crumb:", error);
                throw error;
            } finally {
                this.isRefreshing = null;
            }
        })();

        return this.isRefreshing;
    }

    async getCredentials() {
        // Refresh every 30 minutes or if never fetched
        if (!this.crumb || Date.now() - this.lastRefresh > 30 * 60 * 1000) {
            await this.refresh();
        }
        return { cookie: this.cookie, crumb: this.crumb };
    }

    invalidate() {
        this.crumb = null;
    }
}

const crumbManager = new CrumbManager();

/**
 * Fetches real-time quotes for the given symbols.
 */
export async function fetchQuote(symbols: string[]) {
    if (symbols.length === 0) return [];

    const { cookie, crumb } = await crumbManager.getCredentials();
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}${crumb ? `&crumb=${crumb}` : ""}`;
    
    const response = await fetch(url, {
        headers: {
            ...BASE_HEADERS,
            Cookie: cookie || "",
        },
    });

    if (response.status === 401) {
        crumbManager.invalidate();
        // Simple one-time retry
        const { cookie: newCookie, crumb: newCrumb } = await crumbManager.getCredentials();
        const retryUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}${newCrumb ? `&crumb=${newCrumb}` : ""}`;
        const retryResponse = await fetch(retryUrl, {
            headers: {
                ...BASE_HEADERS,
                Cookie: newCookie || "",
            },
        });
        if (!retryResponse.ok) {
            throw new Error(`Yahoo Finance Quote API error after retry: ${retryResponse.statusText}`);
        }
        const data = await retryResponse.json();
        return data.quoteResponse?.result || [];
    }

    if (!response.ok) {
        throw new Error(`Yahoo Finance Quote API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.quoteResponse?.result || [];
}

/**
 * Fetches chart data for a single symbol.
 */
export async function fetchChart(symbol: string, options: ChartOptions) {
    const { period1, period2, interval = "1d" } = options;

    const p1 =
        period1 instanceof Date
            ? Math.floor(period1.getTime() / 1000)
            : period1;
    const p2 = period2
        ? period2 instanceof Date
            ? Math.floor(period2.getTime() / 1000)
            : period2
        : Math.floor(Date.now() / 1000);

    const { cookie, crumb } = await crumbManager.getCredentials();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=${interval}${crumb ? `&crumb=${crumb}` : ""}`;
    
    const response = await fetch(url, {
        headers: {
            ...BASE_HEADERS,
            Cookie: cookie || "",
        },
    });

    if (response.status === 401) {
        crumbManager.invalidate();
        const { cookie: newCookie, crumb: newCrumb } = await crumbManager.getCredentials();
        const retryUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=${interval}${newCrumb ? `&crumb=${newCrumb}` : ""}`;
        const retryResponse = await fetch(retryUrl, {
            headers: {
                ...BASE_HEADERS,
                Cookie: newCookie || "",
            },
        });
        if (!retryResponse.ok) {
            throw new Error(`Yahoo Finance Chart API error after retry: ${retryResponse.statusText}`);
        }
        const data = await retryResponse.json();
        const result = data.chart?.result?.[0];
        if (!result) return { quotes: [] };
        
        const timestamps = result.timestamp || [];
        const indicators = result.indicators?.quote?.[0] || {};
        const closes = indicators.close || [];
        const quotes = timestamps.map((timestamp: number, index: number) => ({
            date: new Date(timestamp * 1000),
            close: closes[index],
        }));
        return { meta: result.meta, quotes };
    }

    if (!response.ok) {
        throw new Error(`Yahoo Finance Chart API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result) {
        return { quotes: [] };
    }

    const timestamps = result.timestamp || [];
    const indicators = result.indicators?.quote?.[0] || {};
    const closes = indicators.close || [];

    // Map to the format expected by the app (array of { date, close })
    const quotes = timestamps.map((timestamp: number, index: number) => ({
        date: new Date(timestamp * 1000),
        close: closes[index],
    }));

    return {
        meta: result.meta,
        quotes,
    };
}

export default {
    quote: fetchQuote,
    chart: fetchChart,
};
