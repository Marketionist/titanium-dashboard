import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function run() {
    try {
        const period30d = new Date(Date.now() - 30 * 86400000);
        const res30d = await yf.chart("AAPL", {
            period1: period30d,
            interval: "1d",
        });
        console.log("First point:", res30d.quotes[0]);
    } catch (e) {
        console.error("CHART ERROR:", e.message);
    }
}

run();
