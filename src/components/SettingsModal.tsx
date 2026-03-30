import { useEffect, useState } from "react";
import { XMarkIcon, TrashIcon, PlusIcon, CheckIcon } from "@heroicons/react/24/outline";

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    tickers: string[];
    refreshRate: number;
    timezone: string;
    onSave: (tickers: string[], rate: number, timezone: string) => void;
    onReset: () => void;
}

export function SettingsModal({
    isOpen,
    onClose,
    tickers,
    refreshRate,
    timezone,
    onSave,
    onReset,
}: SettingsModalProps) {
    const [newTicker, setNewTicker] = useState("");
    const [localTickers, setLocalTickers] = useState<string[]>(tickers);
    const [localRate, setLocalRate] = useState<number>(refreshRate);
    const [localTimezone, setLocalTimezone] = useState<string>(timezone);

    // Sync local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalTickers(tickers);
            setLocalRate(refreshRate);
            setLocalTimezone(timezone);
        }
    }, [isOpen, tickers, refreshRate, timezone]);

    if (!isOpen) return null;

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const symbols = newTicker
            .split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean);
        if (symbols.length > 0) {
            const addedSymbols = symbols.filter(
                (s) => !localTickers.includes(s),
            );
            if (addedSymbols.length > 0) {
                setLocalTickers([...localTickers, ...addedSymbols]);
            }
        }
        setNewTicker("");
    };

    const handleRemoveLocal = (symbol: string) => {
        setLocalTickers(localTickers.filter((t) => t !== symbol));
    };

    const handleSave = () => {
        onSave(localTickers, localRate, localTimezone);
    };

    return (
        <div 
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">Dashboard Settings</h2>
                    <button
                        className="icon-btn"
                        onClick={onClose}
                    >
                        <XMarkIcon />
                    </button>
                </div>

                <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                    <label>Dashboard Timezone</label>
                    <select
                        value={localTimezone}
                        onChange={(e) => setLocalTimezone(e.target.value)}
                    >
                        {[
                            {
                                value: "Local",
                                label: "Local (System Default)",
                            },
                            {
                                value: "America/New_York",
                                label: "New York (Eastern Time)",
                            },
                            {
                                value: "Europe/London",
                                label: "London (Greenwich Mean Time)",
                            },
                            {
                                value: "Asia/Tokyo",
                                label: "Tokyo (Japan Standard Time)",
                            },
                            {
                                value: "Asia/Shanghai",
                                label: "Shanghai (China Standard Time)",
                            },
                            {
                                value: "Australia/Sydney",
                                label: "Sydney (Australian Eastern Time)",
                            },
                        ].map((tz) => {
                            let offset = new Intl.DateTimeFormat("en-US", {
                                timeZone:
                                    tz.value === "Local" ? undefined : tz.value,
                                timeZoneName: "shortOffset",
                            })
                                .formatToParts(new Date())
                                .find((p) => p.type === "timeZoneName")
                                ?.value.replace("GMT", "UTC") || "UTC+0";

                            // Ensure UTC+0 format instead of just UTC
                            if (offset === "UTC") offset = "UTC+0";

                            return (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label} ({offset})
                                </option>
                            );
                        })}
                    </select>
                    <div className="settings-hint">
                        {(() => {
                            const resolvedTz =
                                localTimezone === "Local"
                                    ? Intl.DateTimeFormat().resolvedOptions()
                                          .timeZone
                                    : localTimezone;
                            let off = new Intl.DateTimeFormat("en-US", {
                                timeZone: resolvedTz,
                                timeZoneName: "shortOffset",
                            })
                                .formatToParts(new Date())
                                .find((p) => p.type === "timeZoneName")
                                ?.value.replace("GMT", "UTC") || "UTC+0";
                            if (off === "UTC") off = "UTC+0";
                            return `Current: ${resolvedTz} (${off})`;
                        })()}
                    </div>
                </div>

                <div className="form-group">
                    <label>Refresh Rate (seconds)</label>
                    <select
                        value={localRate}
                        onChange={(e) => setLocalRate(Number(e.target.value))}
                    >
                        <option value={5}>5 seconds</option>
                        <option value={10}>10 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>
                        Manage Tickers (comma separated to add multiple)
                    </label>
                    <form className="input-flex" onSubmit={handleAdd}>
                        <input
                            type="text"
                            placeholder="e.g. AAPL, NVDA"
                            value={newTicker}
                            onChange={(e) => setNewTicker(e.target.value)}
                        />
                        <button type="submit" className="icon-btn">
                            <PlusIcon />
                        </button>
                    </form>

                    <div className="ticker-list">
                        {localTickers.map((ticker) => (
                            <div key={ticker} className="ticker-item">
                                <span className="ticker-item-text metallic-gold">
                                    {ticker}
                                </span>
                                <button
                                    className="btn-remove icon-btn"
                                    onClick={() => handleRemoveLocal(ticker)}
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        ))}
                        {localTickers.length === 0 && (
                            <div className="ticker-empty-msg">
                                No tickers added.
                            </div>
                        )}
                    </div>
                </div>

                <div className="settings-footer settings-footer-compact">
                    <button
                        className="btn-remove icon-btn"
                        onClick={() => {
                            if (
                                window.confirm(
                                    "Are you sure you want to reset all storage?",
                                )
                            ) {
                                onReset();
                            }
                        }}
                    >
                        <TrashIcon />
                    </button>
                    <button className="icon-btn" onClick={handleSave}>
                        <CheckIcon />
                    </button>
                </div>
            </div>
        </div>
    );
}
