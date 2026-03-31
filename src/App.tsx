import { useEffect, useState } from "react";
import { Cog6ToothIcon, BoltIcon, BoltSlashIcon } from "@heroicons/react/24/solid";
import { StockCard } from "./components/StockCard";
import { SettingsModal } from "./components/SettingsModal";

const getDefaultTickers = (): string[] => {
    const envTickers = import.meta.env.STOCKS;
    if (envTickers && typeof envTickers === "string") {
        return envTickers
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return ["VOO", "VGT", "IBIT", "IAUM", "USDCAD=X"];
};

function App() {
    const [tickers, setTickers] = useState<string[]>([]);
    const [refreshRate, setRefreshRate] = useState<number>(10);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [timezone, setTimezone] = useState<string>("Local");
    const [isTeslaMode, setIsTeslaMode] = useState<boolean>(false);

    // Keyboard shortcut for Tesla Mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                setIsTeslaMode(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Load state from localStorage on mount
    useEffect(() => {
        const storedTickers = localStorage.getItem("dashboard_tickers");
        const storedRate = localStorage.getItem("dashboard_refreshRate");
        const storedTimezone = localStorage.getItem("dashboard_timezone");

        if (storedTickers) {
            setTickers(JSON.parse(storedTickers));
        } else {
            // Default tickers
            setTickers(getDefaultTickers());
        }

        if (storedRate) {
            setRefreshRate(Number(storedRate));
        }

        if (storedTimezone) {
            setTimezone(storedTimezone);
        }
    }, []);

    // Fetch data
    useEffect(() => {
        if (tickers.length === 0) {
            setQuotes([]);
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setHasError(false);
            try {
                const ipcRenderer = (window as any).ipcRenderer;
                if (ipcRenderer && ipcRenderer.invoke) {
                    const results = await ipcRenderer.invoke(
                        "get-stock-quotes",
                        tickers,
                        timezone,
                    );
                    setQuotes(results);
                    setLastUpdated(new Date());
                }
            } catch (error) {
                console.error("Failed to fetch quotes:", error);
                setHasError(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        const interval = setInterval(fetchData, refreshRate * 1000);
        return () => clearInterval(interval);
    }, [tickers, refreshRate, timezone]);

    const handleSaveSettings = (
        newTickers: string[],
        newRate: number,
        newTimezone: string,
    ) => {
        setTickers(newTickers);
        setRefreshRate(newRate);
        setTimezone(newTimezone);
        localStorage.setItem("dashboard_tickers", JSON.stringify(newTickers));
        localStorage.setItem("dashboard_refreshRate", newRate.toString());
        localStorage.setItem("dashboard_timezone", newTimezone);
        setIsSettingsOpen(false);
    };

    const handleResetStorage = () => {
        localStorage.removeItem("dashboard_tickers");
        localStorage.removeItem("dashboard_refreshRate");
        localStorage.removeItem("dashboard_timezone");
        setTickers(getDefaultTickers());
        setRefreshRate(10);
        setTimezone("Local");
    };

    const handleRemoveTicker = (symbol: string) => {
        const newTickers = tickers.filter((t) => t !== symbol);
        setTickers(newTickers);
        localStorage.setItem("dashboard_tickers", JSON.stringify(newTickers));
    };

    return (
        <>
            <header className="app-header">
                <h1 className="app-title">
                    <img
                        src="/icon.png"
                        width="32"
                        height="32"
                        alt="Titanium Dashboard Logo"
                        className="app-logo"
                    />
                    Titanium Dashboard
                </h1>
                <div className="header-actions">
                    <button
                        className="icon-btn"
                        onClick={() => setIsTeslaMode(!isTeslaMode)}
                        title={isTeslaMode ? "Disable Tesla Mode" : "Enable Tesla Mode"}
                    >
                        {isTeslaMode ? (
                            <BoltSlashIcon style={{ width: 20, height: 20 }} />
                        ) : (
                            <BoltIcon style={{ width: 20, height: 20 }} />
                        )}
                    </button>
                    <button
                        className="icon-btn"
                        onClick={() => setIsSettingsOpen(true)}
                    >
                        <Cog6ToothIcon style={{ width: 20, height: 20 }} />
                    </button>
                </div>
            </header>

            <main>
                {isTeslaMode ? (
                    <div className="tesla-mode-container">
                        <svg width="0" height="0" style={{ position: 'absolute' }}>
                            <filter id="lightning-wobble">
                                <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise">
                                    <animate attributeName="baseFrequency" values="0.04 0.04; 0.05 0.05; 0.04 0.04" dur="2s" repeatCount="indefinite" />
                                </feTurbulence>
                                <feDisplacementMap in="SourceGraphic" in2="noise" scale="35" xChannelSelector="R" yChannelSelector="G" />
                            </filter>
                        </svg>
                        <div className="tesla-sphere">
                            <div className="tesla-core"></div>
                            <div className="plasma-ray ray-1"></div>
                            <div className="plasma-ray ray-2"></div>
                            <div className="plasma-ray ray-3"></div>
                            <div className="plasma-ray ray-4"></div>
                            <div className="plasma-ray ray-5"></div>
                            <div className="plasma-ray ray-6"></div>
                            <div className="plasma-ray ray-7"></div>
                            <div className="plasma-ray ray-8"></div>
                        </div>
                    </div>
                ) : hasError && quotes.length === 0 ? (
                    <div className="loader-container">
                        <div className="error-message">
                            Unable to load market data
                        </div>
                        <button
                            className="btn-primary btn-centered btn-danger-recovery"
                            onClick={handleResetStorage}
                        >
                            Reset all storage
                        </button>
                    </div>
                ) : isLoading && quotes.length === 0 ? (
                    <div className="loader-container">
                        <div className="loader"></div>
                        <div>Loading market data...</div>
                    </div>
                ) : (
                    <div className="dashboard-grid">
                        {quotes.map((quote) => (
                            <StockCard
                                key={quote.symbol}
                                symbol={quote.symbol}
                                name={quote.shortName || quote.longName}
                                price={quote.regularMarketPrice}
                                change={quote.regularMarketChange}
                                changePercent={quote.regularMarketChangePercent}
                                chart={quote.chart}
                                onRemove={() => handleRemoveTicker(quote.symbol)}
                            />
                        ))}
                        {quotes.length === 0 && !isLoading && (
                            <div className="empty-state">
                                <h3>No Tickers</h3>
                                <p>
                                    Add some stock symbols in the settings to
                                    get started.
                                </p>
                                <button
                                    className="btn-primary btn-centered"
                                    onClick={() => setIsSettingsOpen(true)}
                                >
                                    Open Settings
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {!isTeslaMode && lastUpdated && quotes.length > 0 && (
                    <div className="last-updated">
                        Last updated: {lastUpdated.toLocaleTimeString()}{" "}
                        (Updates every {refreshRate}s)
                    </div>
                )}
            </main>

            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                tickers={tickers}
                refreshRate={refreshRate}
                timezone={timezone}
                onSave={handleSaveSettings}
                onReset={handleResetStorage}
            />
        </>
    );
}

export default App;
