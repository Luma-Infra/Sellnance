# modules/adapter.py
# ==========================================
# 🔌 거래소 규격 통합 어댑터 (Normalization Layer)
# ==========================================


class ExchangeAdapter:
    @staticmethod
    def normalize_interval(exchange, interval):
        """거래소별 인터벌 규격을 통일합니다. (바낸, 업비트, 빗썸, 바이비트, 비트겟, 게이트아이오)"""
        # 1. BINANCE
        if exchange in ["binance_spot", "binance_futures"]:
            mapping = {"days": "1d", "weeks": "1w", "months": "1M"}
            if interval.startswith("minutes/"):
                return f"{interval.split('/')[1]}m"
            return mapping.get(interval, interval)

        # 2. UPBIT
        elif exchange == "upbit":
            # 업비트는 minutes/1, days, weeks, months 형식을 그대로 사용
            return interval

        # 3. BITHUMB
        elif exchange == "bithumb":
            mapping = {
                "1d": "24h",
                "days": "24h",
                "3d": "24h",
                "3D": "24h",
                "1w": "1w",
                "w": "1w",
                "weeks": "1w",
                "1M": "1M",
                "M": "1M",
                "months": "1M",
            }
            if interval.startswith("minutes/"):
                m = interval.split("/")[1]
                return f"{m}m"
            return mapping.get(interval, interval)

        # 4. BYBIT
        elif exchange in ["bybit_spot", "bybit_futures"]:
            mapping = {
                "1m": "1",
                "3m": "3",
                "5m": "5",
                "15m": "15",
                "30m": "30",
                "1h": "60",
                # "2h": "120",
                "4h": "240",
                "6h": "360",
                "12h": "720",
                "1d": "D",
                "days": "D",
                "3d": "D",
                "1w": "W",
                "1M": "M",
            }
            if interval.startswith("minutes/"):
                return interval.split("/")[1]
            return mapping.get(interval, interval)

        # 5. BITGET SPOT
        elif exchange in ["bitget", "bitget_spot"]:
            mapping = {
                "1m": "1min",
                "3m": "3min",
                "5m": "5min",
                "10m": "15min",
                "15m": "15min",
                "30m": "30min",
                "1h": "1h",
                "2h": "4h",
                "4h": "4h",
                "6h": "6h",
                "12h": "12h",
                "24h": "1day",
                "1d": "1day",
                "days": "1day",
                "3d": "1day",
                "3D": "1day",
                "1w": "1week",
                "weeks": "1week",
                "1M": "1M",
                "months": "1M",
            }
            if interval.startswith("minutes/"):
                m = interval.split("/")[1]
                return mapping.get(f"{m}m", "1min")
            return mapping.get(interval, interval)

        # 6. BITGET FUTURES
        elif exchange == "bitget_futures":
            mapping = {
                "1m": "1m",
                "3m": "3m",
                "5m": "5m",
                "10m": "15m",
                "15m": "15m",
                "30m": "30m",
                "1h": "1H",
                "2h": "4H",
                "4h": "4H",
                "6h": "6H",
                "12h": "12H",
                "24h": "1D",
                "1d": "1D",
                "days": "1D",
                "3d": "1D",
                "3D": "1D",
                "1w": "1W",
                "weeks": "1W",
                "1M": "1M",
                "months": "1M",
            }
            if interval.startswith("minutes/"):
                m = interval.split("/")[1]
                return mapping.get(f"{m}m", "1m")
            return mapping.get(interval, interval)

        # 7. GATEIO (V4 공식 규격: 10s, 1m, 5m, 15m, 30m, 1h, 4h, 8h, 1d, 7d, 30d)
        elif exchange in ["gateio", "gateio_spot", "gateio_futures"]:
            mapping = {
                "1m": "1m",
                "3m": "5m",
                "5m": "5m",
                "10m": "15m",
                "15m": "15m",
                "30m": "30m",
                "1h": "1h",
                "2h": "4h",
                "4h": "4h",
                "6h": "8h",
                "12h": "8h",
                "24h": "1d",
                "1d": "1d",
                "days": "1d",
                "3d": "1d",
                "1w": "7d",
                "weeks": "7d",
                "1M": "30d",
                "months": "30d",
            }
            if interval.startswith("minutes/"):
                m = interval.split("/")[1]
                return mapping.get(f"{m}m", "1m")
            return mapping.get(interval, interval)

        return interval

    @staticmethod
    def normalize_symbol(exchange, symbol):
        """거래소별 마켓 코드 형식을 통일합니다."""
        # 1. BINANCE, BYBIT, BITGET (BaseQuote 형식: BTCUSDT)
        if exchange in [
            "binance_spot",
            "binance_futures",
            "bybit_spot",
            "bybit_futures",
            "bitget",
            "bitget_spot",
            "bitget_futures",
        ]:
            clean = (
                symbol.replace("USDT.P", "USDT")
                .replace(".P", "")
                .replace("-", "")
                .replace("_", "")
                .upper()
            )
            return clean

        # 2. UPBIT & BITHUMB (Quote-Base 형식: KRW-BTC)
        elif exchange in ["upbit", "bithumb"]:
            core = symbol.replace("KRW-", "").replace("_KRW", "")
            if core.endswith("USDT") and core != "USDT":
                core = core[:-4]
            return f"KRW-{core}"

        # 3. GATEIO (Base_Quote 형식: BTC_USDT)
        elif exchange in ["gateio", "gateio_spot", "gateio_futures"]:
            clean = (
                symbol.replace("USDT.P", "")
                .replace(".P", "")
                .replace("-", "_")
                .upper()
            )
            if "_" not in clean and clean.endswith("USDT") and len(clean) > 4:
                return f"{clean[:-4]}_USDT"
            return clean

        return symbol

    @staticmethod
    def get_candle_url(exchange, symbol, interval, limit, to=None, start=None):
        """거래소별 캔들 조회 최종 URL 생성"""
        norm_sym = ExchangeAdapter.normalize_symbol(exchange, symbol)
        norm_int = ExchangeAdapter.normalize_interval(exchange, interval)

        # 1. BINANCE
        if exchange == "binance_futures":
            url = f"https://fapi.binance.com/fapi/v1/klines?symbol={norm_sym}&interval={norm_int}&limit={limit}"
            if to:
                url += f"&endTime={to}"
            if start:
                url += f"&startTime={start}"
            return url
        elif exchange == "binance_spot":
            url = f"https://api.binance.com/api/v3/klines?symbol={norm_sym}&interval={norm_int}&limit={limit}"
            if to:
                url += f"&endTime={to}"
            if start:
                url += f"&startTime={start}"
            return url

        # 2. UPBIT
        elif exchange == "upbit":
            upbit_count = min(int(limit or 200), 200)
            url = f"https://api.upbit.com/v1/candles/{norm_int}?market={norm_sym}&count={upbit_count}"
            if to:
                url += f"&to={to}"
            return url

        # 3. BITHUMB (Public API 기반)
        elif exchange == "bithumb":
            # 빗썸은 symbol_quote 형식 (예: BTC_KRW)
            clean_sym = norm_sym.replace("KRW-", "").replace("_KRW", "")
            b_sym = f"{clean_sym}_KRW"
            return f"https://api.bithumb.com/public/candlestick/{b_sym}/{norm_int}"

        # 4. BYBIT (V5 API)
        elif exchange == "bybit_spot":
            url = f"https://api.bybit.com/v5/market/kline?category=spot&symbol={norm_sym}&interval={norm_int}&limit={limit}"
            if to:
                url += f"&end={to}"
            return url
        elif exchange == "bybit_futures":
            url = f"https://api.bybit.com/v5/market/kline?category=linear&symbol={norm_sym}&interval={norm_int}&limit={limit}"
            if to:
                url += f"&end={to}"
            return url

        # 5. BITGET (V2 공식 REST API)
        elif exchange in ["bitget", "bitget_spot"]:
            limit_num = min(int(limit or 200), 1000)
            url = f"https://api.bitget.com/api/v2/spot/market/candles?symbol={norm_sym}&granularity={norm_int}&limit={limit_num}"
            if to:
                url += f"&endTime={to}"
            if start:
                url += f"&startTime={start}"
            return url
        elif exchange == "bitget_futures":
            limit_num = min(int(limit or 200), 1000)
            url = f"https://api.bitget.com/api/v2/mix/market/candles?symbol={norm_sym}&granularity={norm_int}&productType=USDT-FUTURES&limit={limit_num}"
            if to:
                url += f"&endTime={to}"
            if start:
                url += f"&startTime={start}"
            return url

        # 6. GATEIO (V4 공식 REST API)
        elif exchange in ["gateio", "gateio_spot"]:
            limit_num = min(int(limit or 200), 1000)
            url = f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={norm_sym}&interval={norm_int}&limit={limit_num}"
            if to:
                url += f"&to={to}"
            if start:
                url += f"&from={start}"
            return url
        elif exchange == "gateio_futures":
            limit_num = min(int(limit or 200), 1000)
            url = f"https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract={norm_sym}&interval={norm_int}&limit={limit_num}"
            if to:
                url += f"&to={to}"
            if start:
                url += f"&from={start}"
            return url

        return None
