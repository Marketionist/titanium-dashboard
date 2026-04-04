import * as React from 'react';
import { useState } from 'react';
import { ArrowUpIcon, ArrowDownIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { ChartDataPoint, HistoricalCharts } from '../types';

interface StockCardProps {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    name?: string;
    chart?: ChartDataPoint[];
    onRemove: () => void;
}

const DEFAULT_SPARKLINE_WIDTH = 80;
const DEFAULT_SPARKLINE_HEIGHT = 30;
const VIEWBOX_X_AXES = -25;
const VIEWBOX_X_NO_AXES = -2;
const VIEWBOX_Y_AXES = -5;
const VIEWBOX_Y_NO_AXES = -2;
const VIEWBOX_W_EXTRA_AXES = 30;
const VIEWBOX_W_EXTRA_NO_AXES = 4;
const VIEWBOX_H_EXTRA_AXES = 15;
const VIEWBOX_H_EXTRA_NO_AXES = 4;
const MS_PER_SECOND = 1000;
const SECS_PER_MIN = 60;
const MINS_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MINS_PER_HOUR * SECS_PER_MIN * MS_PER_SECOND;
const ONE_AND_A_HALF_DAYS = 1.5;
const THREE_HUNDRED_DAYS = 300;

function Sparkline ({
    data,
    color,
    showAxes = false,
    width = DEFAULT_SPARKLINE_WIDTH,
    height = DEFAULT_SPARKLINE_HEIGHT,
}: {
    data: ChartDataPoint[];
    color: string;
    showAxes?: boolean;
    width?: number;
    height?: number;
}) {
    if (!data || data.length < 2) { return null; }
    const closes = data.map((d) => d.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;

    const viewBoxX = showAxes ? VIEWBOX_X_AXES : VIEWBOX_X_NO_AXES;
    const viewBoxY = showAxes ? VIEWBOX_Y_AXES : VIEWBOX_Y_NO_AXES;
    const viewBoxW = showAxes ? width + VIEWBOX_W_EXTRA_AXES : width + VIEWBOX_W_EXTRA_NO_AXES;
    const viewBoxH = showAxes ? height + VIEWBOX_H_EXTRA_AXES : height + VIEWBOX_H_EXTRA_NO_AXES;

    const points = data.map((val, i) => {
        const x = i / (data.length - 1) * width;
        const y = height - (val.close - min) / range * height;

        return { x, y, val, };
    });

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

    const firstDate = new Date(data[0].date);
    const lastDate = new Date(data[data.length - 1].date);
    const diffMs = lastDate.getTime() - firstDate.getTime();
    const diffDays = diffMs / MS_PER_DAY;

    const formatDate = (ds: string) => {
        const d = new Date(ds);
        let options: Intl.DateTimeFormatOptions;

        if (diffDays < ONE_AND_A_HALF_DAYS) {
            options = { hour: 'numeric', minute: '2-digit', };
        } else if (diffDays > THREE_HUNDRED_DAYS) {
            options = { month: 'numeric', day: 'numeric', year: '2-digit', };
        } else {
            options = { month: 'numeric', day: 'numeric', };
        }

        return d.toLocaleDateString(undefined, options);
    };

    return (
        <svg
            width="100%"
            viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
            className="sparkline-svg"
        >
            {showAxes &&
                <>
                    <polyline
                        points={`0,0 0,${height} ${width},${height}`}
                        fill="none"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="1"
                    />
                    <text x="-4" y="4" fill="var(--text-muted)" fontSize="8" textAnchor="end">
                        ${max.toFixed(1)}
                    </text>
                    <text x="-4" y={height} fill="var(--text-muted)" fontSize="8" textAnchor="end">
                        ${min.toFixed(1)}
                    </text>
                    <text x="0" y={height + 10} fill="var(--text-muted)" fontSize="8" textAnchor="start">
                        {formatDate(data[0].date)}
                    </text>
                    <text x={width} y={height + 10} fill="var(--text-muted)" fontSize="8" textAnchor="end">
                        {formatDate(data[data.length - 1].date)}
                    </text>
                </>
            }
            <polyline
                points={polylinePoints}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="sparkline-path"
            />
            {points.map((p, i) =>
                <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="1.5" fill={color} />
            )}
            {points.map((p, i) =>
                <circle
                    key={`hit-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="transparent"
                    stroke="transparent"
                    className="sparkline-hit-area"
                >
                    <title>{`Price: $${p.val.close.toFixed(2)}\nDate: ${new Date(
                        p.val.date
                    ).toLocaleString()}`}</title>
                </circle>
            )}
        </svg>
    );
}

function CardFront (props: StockCardProps) {
    const { symbol, price, change, changePercent, name, chart, onRemove, } = props;
    const isPositive = change >= 0;

    const ICON_SIZE = 16;
    const CHART_WIDTH = 240;
    const CHART_HEIGHT = 75;

    return (
        <div className="card-front">
            <div className="stock-header">
                <div>
                    <div className="stock-symbol metallic-gold">{symbol}</div>
                    {name &&
                        <div className="stock-name" title={name}>
                            {name}
                        </div>
                    }
                </div>
                <div className={`stock-change ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ?
                        <ArrowUpIcon className="w-4 h-4 inline" style={{ width: ICON_SIZE, height: ICON_SIZE, }} /> :
                        <ArrowDownIcon className="w-4 h-4 inline" style={{ width: ICON_SIZE, height: ICON_SIZE, }} />
                    }
                    <span>
                        {(typeof change === 'number' ? Math.abs(change) : 0).toFixed(2)} (
                        {(typeof changePercent === 'number' ? Math.abs(changePercent) : 0).toFixed(2)}%)
                    </span>
                </div>
            </div>
            <div className="stock-price stock-price-decorated">
                {typeof price === 'number' ?
                    <span className="metallic-gold">{`$${price.toFixed(2)}`}</span> :
                    <div className="na-container">
                        <span className="metallic-gold">N/A</span>
                        <button
                            className="btn-remove icon-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            title="Remove ticker"
                            aria-label="Remove ticker"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                }
            </div>
            {chart && chart.length > 0 &&
                <div className="sparkline-container sparkline-container-front">
                    <Sparkline
                        data={chart}
                        color={isPositive ? 'var(--success)' : 'var(--danger)'}
                        showAxes={true}
                        width={CHART_WIDTH}
                        height={CHART_HEIGHT}
                    />
                </div>
            }
        </div>
    );
}

interface CardBackProps {
    symbol: string;
    isLoading: boolean;
    show1Year: boolean;
    history30d: ChartDataPoint[] | null;
    history1y: ChartDataPoint[] | null;
    onToggleHistory: (e: React.MouseEvent) => void;
}

function CardBack (props: CardBackProps) {
    const { symbol, isLoading, show1Year, history30d, history1y, onToggleHistory, } = props;

    const historicalData = show1Year ? history1y : history30d;
    let historicalChange = 0;
    let absoluteChange = 0;

    const PERC_MULTIPLIER = 100;
    const MIN_DATA_POINTS = 2;

    if (historicalData && historicalData.length >= MIN_DATA_POINTS) {
        const start = historicalData[0].close;
        const end = historicalData[historicalData.length - 1].close;

        historicalChange = (end - start) / start * PERC_MULTIPLIER;
        absoluteChange = end - start;
    }

    const isHistoricalPositive = historicalChange >= 0;
    const CHART_WIDTH = 240;
    const CHART_HEIGHT_BACK = 80;
    const ICON_SIZE_BACK = 14;

    return (
        <div className="card-back">
            {isLoading ?
                <div className="loader"></div> :
                <>
                    <div className="card-back-header">
                        <div className="card-back-subtitle">
                            {symbol} • {show1Year ? '1 Year' : '30 Days'}
                        </div>
                    </div>

                    <div className="sparkline-container sparkline-container-back">
                        {historicalData && historicalData.length > 0 ?
                            <Sparkline
                                data={historicalData}
                                color={show1Year ? 'var(--text-muted)' : 'var(--accent-primary)'}
                                showAxes={true}
                                width={CHART_WIDTH}
                                height={CHART_HEIGHT_BACK}
                            /> :
                            <span className="card-back-empty">No historical data</span>
                        }
                    </div>

                    <div className="card-back-toggle" onClick={onToggleHistory}>
                        {show1Year ? 'Show 30 Days' : 'Show 1 Year'}
                    </div>

                    {historicalData && historicalData.length >= MIN_DATA_POINTS &&
                        <div
                            className={`stock-change ${isHistoricalPositive ? 'positive' : 'negative'} card-back-perf`}
                        >
                            {isHistoricalPositive ?
                                <ArrowUpIcon style={{ width: ICON_SIZE_BACK, height: ICON_SIZE_BACK, }} /> :
                                <ArrowDownIcon style={{ width: ICON_SIZE_BACK, height: ICON_SIZE_BACK, }} />
                            }
                            <span>
                                {Math.abs(absoluteChange).toFixed(2)} ({Math.abs(historicalChange).toFixed(2)}%)
                            </span>
                        </div>
                    }
                </>
            }
        </div>
    );
}

export function StockCard (props: StockCardProps) {
    const { symbol, } = props;
    const [isFlipped, setIsFlipped,] = useState(false);
    const [history30d, setHistory30d,] = useState<ChartDataPoint[] | null>(null);
    const [history1y, setHistory1y,] = useState<ChartDataPoint[] | null>(null);
    const [isLoadingHistory, setIsLoadingHistory,] = useState(false);
    const [show1Year, setShow1Year,] = useState(false);

    const handleFlip = async () => {
        setIsFlipped(!isFlipped);

        if (!isFlipped && history30d === null && !isLoadingHistory) {
            setIsLoadingHistory(true);
            try {
                type IpcInvoke = (channel: string, ...args: unknown[]) => Promise<HistoricalCharts>;
                const winWithIpc = window as unknown as { ipcRenderer: { invoke: IpcInvoke } };
                const ipcRenderer = winWithIpc.ipcRenderer;

                if (ipcRenderer && ipcRenderer.invoke) {
                    const data = await ipcRenderer.invoke('get-historical-charts', symbol);

                    setHistory30d(data.chart30d);
                    setHistory1y(data.chart1y);
                }
            } catch (error) {
                console.error('Failed to fetch historical charts', error);
            } finally {
                setIsLoadingHistory(false);
            }
        }
    };

    const onToggleHistory = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShow1Year(!show1Year);
    };

    return (
        <div
            className={`stock-card ${isFlipped ? 'is-flipped' : ''}`}
            onClick={() => {
                handleFlip().catch((err) => {
                    console.error('Flip failed', err);
                });
            }}
        >
            <div className="card-inner">
                <CardFront {...props} />
                <CardBack
                    symbol={symbol}
                    isLoading={isLoadingHistory}
                    show1Year={show1Year}
                    history30d={history30d}
                    history1y={history1y}
                    onToggleHistory={onToggleHistory}
                />
            </div>
        </div>
    );
}
