import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/solid";
import { TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

export interface ChartDataPoint {
    close: number;
    date: string;
}

interface StockCardProps {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    name?: string;
    chart?: ChartDataPoint[];
    onRemove: () => void;
}

function Sparkline({
    data,
    color,
    showAxes = false,
    width = 80,
    height = 30,
}: {
    data: ChartDataPoint[];
    color: string;
    showAxes?: boolean;
    width?: number;
    height?: number;
}) {
    if (!data || data.length < 2) return null;
    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const viewBoxX = showAxes ? -25 : -2;
    const viewBoxY = showAxes ? -5 : -2;
    const viewBoxW = showAxes ? width + 30 : width + 4;
    const viewBoxH = showAxes ? height + 15 : height + 4;

    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val.close - min) / range) * height;
        return { x, y, val };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

    const firstDate = new Date(data[0].date);
    const lastDate = new Date(data[data.length - 1].date);
    const diffMs = lastDate.getTime() - firstDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const formatDate = (ds: string) => {
        const d = new Date(ds);
        let options: Intl.DateTimeFormatOptions;

        if (diffDays < 1.5) {
            // Intraday
            options = { hour: "numeric", minute: "2-digit" };
        } else if (diffDays > 300) {
            // 1 Year+
            options = { month: "numeric", day: "numeric", year: "2-digit" };
        } else {
            // 30 Days
            options = { month: "numeric", day: "numeric" };
        }

        return d.toLocaleDateString(undefined, options);
    };

    return (
        <svg
            width="100%"
            height="auto"
            viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
            className="sparkline-svg"
        >
            {showAxes && (
                <>
                    <polyline
                        points={`0,0 0,${height} ${width},${height}`}
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                    />
                    <text
                        x="-4"
                        y="4"
                        fill="var(--text-muted)"
                        fontSize="8"
                        textAnchor="end"
                    >
                        ${max.toFixed(1)}
                    </text>
                    <text
                        x="-4"
                        y={height}
                        fill="var(--text-muted)"
                        fontSize="8"
                        textAnchor="end"
                    >
                        ${min.toFixed(1)}
                    </text>
                    <text
                        x="0"
                        y={height + 10}
                        fill="var(--text-muted)"
                        fontSize="8"
                        textAnchor="start"
                    >
                        {formatDate(data[0].date)}
                    </text>
                    <text
                        x={width}
                        y={height + 10}
                        fill="var(--text-muted)"
                        fontSize="8"
                        textAnchor="end"
                    >
                        {formatDate(data[data.length - 1].date)}
                    </text>
                </>
            )}
            <polyline
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sparkline-path"
            />
            {points.map((p, i) => (
                <circle
                    key={`dot-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="1.5"
                    fill={color}
                />
            ))}
            {points.map((p, i) => (
                <circle
                    key={`hit-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="transparent"
                    stroke="transparent"
                    className="sparkline-hit-area"
                >
                    <title>{`Price: $${p.val.close.toFixed(2)}\nDate: ${new Date(p.val.date).toLocaleString()}`}</title>
                </circle>
            ))}
        </svg>
    );
}

export function StockCard({
    symbol,
    price,
    change,
    changePercent,
    name,
    chart,
    onRemove,
}: StockCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);
    const [history30d, setHistory30d] = useState<ChartDataPoint[] | null>(null);
    const [history1y, setHistory1y] = useState<ChartDataPoint[] | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [show1Year, setShow1Year] = useState(false);

    const isPositive = change >= 0;

    const historicalData = show1Year ? history1y : history30d;
    let historicalChange = 0;
    let absoluteHistoricalChange = 0;
    if (historicalData && historicalData.length >= 2) {
        const start = historicalData[0].close;
        const end = historicalData[historicalData.length - 1].close;
        historicalChange = ((end - start) / start) * 100;
        absoluteHistoricalChange = end - start;
    }

    const isHistoricalPositive = historicalChange >= 0;

    const handleFlip = async () => {
        setIsFlipped(!isFlipped);

        if (!isFlipped && history30d === null && !isLoadingHistory) {
            setIsLoadingHistory(true);
            try {
                const ipcRenderer = (window as any).ipcRenderer;
                if (ipcRenderer && ipcRenderer.invoke) {
                    const data = await ipcRenderer.invoke(
                        "get-historical-charts",
                        symbol,
                    );
                    setHistory30d(data.chart30d);
                    setHistory1y(data.chart1y);
                }
            } catch (error) {
                console.error("Failed to fetch historical charts", error);
            } finally {
                setIsLoadingHistory(false);
            }
        }
    };

    return (
        <div
            className={`stock-card ${isFlipped ? "is-flipped" : ""}`}
            onClick={handleFlip}
        >
            <div className="card-inner">
                {/* FRONT OF CARD */}
                <div className="card-front">
                    <div className="stock-header">
                        <div>
                            <div className="stock-symbol metallic-gold">{symbol}</div>
                            {name && (
                                <div className="stock-name" title={name}>
                                    {name}
                                </div>
                            )}
                        </div>
                        <div
                            className={`stock-change ${isPositive ? "positive" : "negative"}`}
                        >
                            {isPositive ? (
                                <ArrowUpIcon
                                    className="w-4 h-4 inline"
                                    style={{ width: 16, height: 16 }}
                                />
                            ) : (
                                <ArrowDownIcon
                                    className="w-4 h-4 inline"
                                    style={{ width: 16, height: 16 }}
                                />
                            )}
                            <span>
                                {(typeof change === 'number' ? Math.abs(change) : 0).toFixed(2)} (
                                {(typeof changePercent === 'number' ? Math.abs(changePercent) : 0).toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                    <div
                        className="stock-price stock-price-decorated"
                    >
                        {typeof price === "number" ? (
                            <span className="metallic-gold">{`$${price.toFixed(2)}`}</span>
                        ) : (
                            <div className="na-container">
                                <span className="metallic-gold">N/A</span>
                                    <button
                                        className="btn-remove icon-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemove();
                                        }}
                                        title="Remove this ticker"
                                    >
                                        <TrashIcon />
                                    </button>
                            </div>
                        )}
                    </div>
                    {chart && chart.length > 0 && (
                        <div className="sparkline-container sparkline-container-front">
                            <Sparkline
                                data={chart}
                                color={
                                    isPositive
                                        ? "var(--success)"
                                        : "var(--danger)"
                                }
                                showAxes={true}
                                width={240}
                                height={75}
                            />
                        </div>
                    )}
                </div>

                {/* BACK OF CARD */}
                <div className="card-back">
                    {isLoadingHistory ? (
                        <div className="loader"></div>
                    ) : (
                        <>
                            <div className="card-back-header">
                                <div className="card-back-subtitle">
                                    {symbol} •{" "}
                                    {show1Year ? "1 Year" : "30 Days"}
                                </div>
                            </div>

                            <div className="sparkline-container sparkline-container-back">
                                {(show1Year ? history1y : history30d) &&
                                    (show1Year ? history1y : history30d)!.length >
                                    0 ? (
                                    <Sparkline
                                        data={
                                            show1Year ? history1y! : history30d!
                                        }
                                        color={
                                            show1Year
                                                ? "var(--text-muted)"
                                                : "var(--accent-primary)"
                                        }
                                        showAxes={true}
                                        width={240}
                                        height={80}
                                    />
                                ) : (
                                    <span className="card-back-empty">
                                        No historical data
                                    </span>
                                )}
                            </div>

                            <div
                                className="card-back-toggle"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShow1Year(!show1Year);
                                }}
                            >
                                {show1Year ? "Show 30 Days" : "Show 1 Year"}
                            </div>

                            {historicalData && historicalData.length >= 2 && (
                                <div className={`stock-change ${isHistoricalPositive ? "positive" : "negative"} card-back-perf`}>
                                    {isHistoricalPositive ? (
                                        <ArrowUpIcon
                                            style={{ width: 14, height: 14 }}
                                        />
                                    ) : (
                                        <ArrowDownIcon
                                            style={{ width: 14, height: 14 }}
                                        />
                                    )}
                                    <span>
                                        {Math.abs(
                                            absoluteHistoricalChange,
                                        ).toFixed(2)}{" "}
                                        ({Math.abs(historicalChange).toFixed(2)}
                                        %)
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
