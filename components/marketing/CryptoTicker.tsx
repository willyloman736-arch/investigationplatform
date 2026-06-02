"use client";

import { useEffect, useRef } from "react";

/**
 * Live crypto market ticker — TradingView's free, embeddable "Ticker Tape"
 * widget (no API key required). Renders a thin scrolling strip of live prices
 * and 24h change for major crypto assets.
 *
 * Notes:
 * - Loads a third-party script from s3.tradingview.com and renders an iframe
 *   from tradingview.com. If you later add a strict Content-Security-Policy
 *   (see DEPLOYMENT.md), allowlist script-src / frame-src / connect-src for
 *   https://*.tradingview.com and https://s3.tradingview.com.
 * - TradingView's terms require keeping the attribution link visible — do not
 *   remove the "Track all markets on TradingView" link below.
 * - This is informational market context only; Digital Asset Investigations is not a trading venue and
 *   does not custody or trade these assets.
 *
 * To change the assets shown, edit SYMBOLS.
 */

const SYMBOLS = [
  { proName: "BINANCE:BTCUSDT", title: "Bitcoin" },
  { proName: "BINANCE:ETHUSDT", title: "Ethereum" },
  { proName: "BINANCE:SOLUSDT", title: "Solana" },
  { proName: "BINANCE:XRPUSDT", title: "XRP" },
  { proName: "BINANCE:BNBUSDT", title: "BNB" },
  { proName: "BINANCE:ADAUSDT", title: "Cardano" },
  { proName: "BINANCE:DOGEUSDT", title: "Dogecoin" },
  { proName: "COINBASE:USDCUSD", title: "USD Coin" },
];

const WIDGET_SRC =
  "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";

export function CryptoTicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const injectedRef = useRef(false);

  useEffect(() => {
    // Inject the widget script exactly once per mount (guards against React 18
    // StrictMode's double-invoke in development). The static children below —
    // including the required attribution link — are left intact.
    if (injectedRef.current) return;
    const container = containerRef.current?.querySelector(
      ".tradingview-widget-container__widget"
    );
    if (!container) return;
    injectedRef.current = true;

    const script = document.createElement("script");
    script.src = WIDGET_SRC;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      symbols: SYMBOLS,
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    });
    container.appendChild(script);
  }, []);

  return (
    <div
      className="border-y border-white/10 bg-background/60 backdrop-blur-sm"
      aria-label="Live crypto market prices"
    >
      <div className="mx-auto w-full max-w-[100vw]">
        <div className="tradingview-widget-container" ref={containerRef}>
          <div className="tradingview-widget-container__widget" />
          <div className="tradingview-widget-copyright px-4 py-1 text-[10px] text-muted-foreground/60">
            <a
              href="https://www.tradingview.com/"
              rel="noopener nofollow"
              target="_blank"
              className="hover:text-muted-foreground"
            >
              Market data by TradingView
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CryptoTicker;
