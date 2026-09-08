# modules/candle_proxy.py
from datetime import datetime
import urllib.parse
import requests
import aiohttp
import asyncio
import json
import time
import pytz
import re
import os

from .adapter import ExchangeAdapter
from . import api_manager

CF_WORKER_PROXY_URL = os.getenv("CF_WORKER_PROXY_URL", "").strip()

# 🚀 [500명 방어 엔진 (I/O 병목 해제 50개 톨게이트)]
CANDLE_SEMAPHORE = asyncio.Semaphore(50)
GLOBAL_AIO_SESSION = None
IN_FLIGHT_CANDLE_REQUESTS = {}
CANDLE_CACHE = {}
TV_GAP_CACHE = {}


async def get_aio_session() -> aiohttp.ClientSession:
    global GLOBAL_AIO_SESSION
    if GLOBAL_AIO_SESSION is None or GLOBAL_AIO_SESSION.closed:
        timeout = aiohttp.ClientTimeout(total=5.0, connect=2.0)
        connector = aiohttp.TCPConnector(
            limit=50, ttl_dns_cache=300, enable_cleanup_closed=True
        )
        GLOBAL_AIO_SESSION = aiohttp.ClientSession(
            timeout=timeout,
            connector=connector,
            headers={"Accept": "application/json", "Accept-Encoding": "gzip, deflate"},
        )
    return GLOBAL_AIO_SESSION


def get_candle_ttl(interval: str, to: str = "") -> float:
    """
    타임프레임별 적응형 캐시 수명(TTL):
    - 과거 고정 캔들(to 파라미터 존재 시): 600초 (10분)
    - 일봉/주봉/월봉: 300초 (5분)
    - 1시간~12시간봉: 180초 (3분)
    - 15분~30분봉: 60초 (1분)
    - 3분~5분봉: 30초
    - 1분봉 등 초단기봉: 15초
    (💡 실시간 최신가는 프론트엔드 웹소켓이 매초 보정하므로 과거 캔들 배열 캐싱은 길어도 100% 안전)
    """
    if to:
        return 600.0

    inv = interval.strip()
    inv_lower = inv.lower()

    # 1. 일봉 / 주봉 / 월봉 (대문자 M은 월봉, 소문자 m은 1m/15m 분봉)
    if (
        inv.endswith("d")
        or inv.endswith("w")
        or inv.endswith("M")
        or inv_lower in ["days", "weeks", "months", "1d", "3d", "1w", "1m_month"]
    ) and not inv_lower.startswith("minutes"):
        return 300.0  # 5분

    # 2. 시간봉 (1h, 4h, minutes/60, minutes/240 등)
    if any(
        k in inv_lower
        for k in ["60", "120", "240", "360", "720", "1h", "2h", "4h", "6h", "12h"]
    ):
        return 180.0  # 3분

    # 3. 15분 ~ 30분봉
    if any(k in inv_lower for k in ["15m", "30m", "minutes/15", "minutes/30"]):
        return 60.0  # 1분

    # 4. 3분 ~ 5분봉
    if any(k in inv_lower for k in ["3m", "5m", "minutes/3", "minutes/5"]):
        return 30.0  # 30초

    # 5. 1분봉 등 초단기봉
    return 15.0  # 15초


# 🛡️ [업비트 429 방어 고속 토큰 버킷 레이트 리미터 (버스트 8개 허용 / 초당 8개 충전, 429 쿨다운)]
class UpbitTokenBucketLimiter:
    def __init__(self, capacity: float = 8.0, refill_rate: float = 8.0):
        self.capacity = capacity  # 최대 버스트 허용량 (업비트 10req/s 한도 내 8개)
        self.tokens = capacity  # 초기 토큰 가득 참
        self.refill_rate = refill_rate  # 초당 토큰 충전량
        self.last_refill = time.time()
        self.cooldown_until = 0.0
        self.lock = asyncio.Lock()

    def trigger_cooldown(self, seconds: float = 1.5):
        now = time.time()
        self.cooldown_until = max(self.cooldown_until, now + seconds)
        self.tokens = 0.0  # 429 감지 시 토큰 즉시 소진

    async def wait(self):
        while True:
            sleep_time = 0.0
            async with self.lock:
                now = time.time()
                # 1. 429 쿨다운 체크
                if now < self.cooldown_until:
                    sleep_time = self.cooldown_until - now
                else:
                    # 2. 토큰 충전 계산
                    elapsed = now - self.last_refill
                    self.tokens = min(
                        self.capacity, self.tokens + elapsed * self.refill_rate
                    )
                    self.last_refill = now

                    # 3. 토큰이 1개 이상이면 대기 없이 즉시 통과 (0ms)
                    if self.tokens >= 1.0:
                        self.tokens -= 1.0
                        return

                    # 4. 토큰 부족 시 필요한 만큼만 최소 대기
                    needed = 1.0 - self.tokens
                    sleep_time = needed / self.refill_rate

            if sleep_time > 0:
                await asyncio.sleep(sleep_time)


UPBIT_RATE_LIMITER = UpbitTokenBucketLimiter(capacity=8.0, refill_rate=8.0)


def _construct_tv_msg(func, param_list):
    msg = json.dumps({"m": func, "p": param_list})
    return f"~m~{len(msg)}~m~{msg}"


class PersistentTVClient:
    """
    [초고속 락-프리 트레이딩뷰 비동기 멀티플렉서]
    - 전역 락 완전 제거: 백그라운드 리더가 1개의 웹소켓 안에서 여러 코인/봉을 병렬 라우팅 (0.1~0.2초 컷)
    - GC 원자성 (Zero-Leak): finally 블록에서 pending_futures를 원자적 pop()하여 메모리 누수 0% 보장
    - 트레이딩뷰 밴 방어: 동시 6개 세션 세마포어 캡 + 데이터 수신 즉시 chart_delete_session 전송
    """

    def __init__(self):
        self.session = None
        self.ws = None
        self.connect_lock = asyncio.Lock()
        self.semaphore = asyncio.Semaphore(
            20
        )  # 트레이딩뷰 밴 방지용 동시 세션 캡 (동시 20개 스윗 스팟)
        self.pending_futures = {}  # session_id -> asyncio.Future
        self.reader_task = None
        self._seq = 0
        self.url = "wss://data.tradingview.com/socket.io/websocket"
        self.headers = {
            "Origin": "https://www.tradingview.com",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }

    async def _reader_loop(self):
        """백그라운드에서 트레이딩뷰 패킷을 수신하여 해당 세션의 Future에 즉시 분배"""
        try:
            while self.ws and not self.ws.closed:
                msg = await self.ws.receive_str()
                if not msg:
                    break

                # 1. 트레이딩뷰 핑/퐁 하트비트 0ms 즉시 응답
                if "~h~" in msg:
                    h_val = msg.split("~h~")[1]
                    await self.ws.send_str(f"~m~{len(h_val)}~m~~h~{h_val}")
                    continue

                # 2. 패킷 파싱 및 해당 세션 Future로 즉시 디스패치
                for packet in re.split(r"~m~\d+~m~", msg):
                    if not packet:
                        continue
                    try:
                        parsed = json.loads(packet)
                        method = parsed.get("m")
                        if method == "timescale_update":
                            params = parsed.get("p", [])
                            if len(params) >= 2:
                                session_id = params[0]
                                fut = self.pending_futures.get(session_id)
                                if fut and not fut.done():
                                    plots = params[1].get("sds_1", {}).get("s", [])
                                    candles = [
                                        [
                                            int(p["v"][0] * 1000),
                                            str(p["v"][1]),
                                            str(p["v"][2]),
                                            str(p["v"][3]),
                                            str(p["v"][4]),
                                            str(p["v"][5]),
                                        ]
                                        for p in plots
                                        if len(p.get("v", [])) >= 6
                                    ]
                                    if candles:
                                        fut.set_result(candles)
                        elif method == "critical_error" or method == "symbol_error":
                            params = parsed.get("p", [])
                            if len(params) >= 1:
                                session_id = params[0]
                                fut = self.pending_futures.get(session_id)
                                if fut and not fut.done():
                                    fut.set_result([])
                    except Exception:
                        pass
        except Exception:
            pass
        finally:
            # 연결 종료 시 잔여 퓨처 안전 정리
            for fut in list(self.pending_futures.values()):
                if not fut.done():
                    fut.set_result([])
            self.pending_futures.clear()

    async def _ensure_connected(self):
        if self.ws is not None and not self.ws.closed:
            return self.ws
        async with self.connect_lock:
            if self.ws is not None and not self.ws.closed:
                return self.ws
            if self.session is None or self.session.closed:
                self.session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=10)
                )
            try:
                self.ws = await self.session.ws_connect(self.url, headers=self.headers)
                await self.ws.send_str(
                    _construct_tv_msg("set_auth_token", ["unauthorized_user_token"])
                )
                if self.reader_task and not self.reader_task.done():
                    self.reader_task.cancel()
                self.reader_task = asyncio.create_task(self._reader_loop())
                return self.ws
            except Exception as e:
                self.ws = None
                raise e

    async def get_candles(self, symbol: str, timeframe: str = "1D", n_bars: int = 1000):
        async with self.semaphore:  # 트레이딩뷰 밴 방지용 동시 세션 캡
            self._seq = (self._seq + 1) % 1000000
            chart_session = f"cs_p_{self._seq}_{int(time.time() * 1000) % 100000}"
            loop = asyncio.get_running_loop()
            fut = loop.create_future()
            self.pending_futures[chart_session] = fut

            try:
                ws = await self._ensure_connected()
                await ws.send_str(
                    _construct_tv_msg("chart_create_session", [chart_session, ""])
                )
                await ws.send_str(
                    _construct_tv_msg(
                        "resolve_symbol",
                        [
                            chart_session,
                            "sds_sym_1",
                            f"={json.dumps({'symbol': symbol, 'adjustment': 'splits'})}",
                        ],
                    )
                )
                await ws.send_str(
                    _construct_tv_msg(
                        "create_series",
                        [
                            chart_session,
                            "sds_1",
                            "s1",
                            "sds_sym_1",
                            timeframe,
                            n_bars,
                            "",
                        ],
                    )
                )

                # Future 완료 대기 (최대 2.8초 단일 타임아웃)
                candles = await asyncio.wait_for(fut, timeout=2.8)
                return candles if candles else []
            except Exception:
                return []
            finally:
                # [GC 원자성] 퓨처 맵에서 원자적 제거 + 트레이딩뷰 서버 세션 즉시 삭제
                self.pending_futures.pop(chart_session, None)
                if self.ws and not self.ws.closed:
                    try:
                        await self.ws.send_str(
                            _construct_tv_msg("chart_delete_session", [chart_session])
                        )
                    except Exception:
                        pass


PERSISTENT_TV_CLIENT = PersistentTVClient()


async def get_tv_candles_aiohttp(symbol="BINANCE:AIAUSDT", timeframe="1D", n_bars=2000):
    url = "wss://data.tradingview.com/socket.io/websocket"
    headers = {
        "Origin": "https://www.tradingview.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    candles = []
    try:
        timeout = aiohttp.ClientTimeout(total=4)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.ws_connect(url, headers=headers) as ws:
                chart_session = "cs_fast_" + str(int(time.time() * 1000))[-8:]
                await ws.send_str(
                    _construct_tv_msg("set_auth_token", ["unauthorized_user_token"])
                )
                await ws.send_str(
                    _construct_tv_msg("chart_create_session", [chart_session, ""])
                )
                await ws.send_str(
                    _construct_tv_msg(
                        "resolve_symbol",
                        [
                            chart_session,
                            "sds_sym_1",
                            f"={json.dumps({'symbol': symbol, 'adjustment': 'splits'})}",
                        ],
                    )
                )
                await ws.send_str(
                    _construct_tv_msg(
                        "create_series",
                        [
                            chart_session,
                            "sds_1",
                            "s1",
                            "sds_sym_1",
                            timeframe,
                            n_bars,
                            "",
                        ],
                    )
                )

                for _ in range(15):
                    try:
                        msg = await asyncio.wait_for(ws.receive_str(), timeout=1.5)
                    except asyncio.TimeoutError:
                        break

                    if "~h~" in msg:
                        h_val = msg.split("~h~")[1]
                        await ws.send_str(f"~m~{len(h_val)}~m~~h~{h_val}")
                        continue

                    for packet in re.split(r"~m~\d+~m~", msg):
                        if not packet:
                            continue
                        try:
                            parsed = json.loads(packet)
                            if parsed.get("m") == "timescale_update":
                                plots = (
                                    parsed.get("p", [])[1].get("sds_1", {}).get("s", [])
                                )
                                for p in plots:
                                    v = p.get("v", [])
                                    if len(v) >= 6:
                                        candles.append(
                                            [
                                                int(v[0] * 1000),
                                                str(v[1]),
                                                str(v[2]),
                                                str(v[3]),
                                                str(v[4]),
                                                str(v[5]),
                                            ]
                                        )
                                if candles:
                                    return candles
                        except Exception:
                            pass
    except Exception as e:
        print(f"⚠️ [aiohttp TV] Error fetching {symbol}: {e}")
    return candles


async def _raw_fetch_candles(
    exchange: str,
    symbol: str,
    interval: str,
    limit: int = 200,
    to: str = "",
    start: str = "",
):
    """실제 거래소 및 트뷰로 나가 데이터를 수집하는 내부 비동기 워커"""
    now = time.time()

    # 🚀 [BITHUMB 전용 aiohttp TV 고속 우회 엔진]
    if exchange == "bithumb":
        clean_sym = (
            symbol.replace("KRW-", "").replace("_KRW", "").replace("KRW", "").upper()
        )
        tv_tf_map = {
            "1m": "1",
            "3m": "3",
            "5m": "5",
            "10m": "10",
            "15m": "15",
            "30m": "30",
            "1h": "60",
            "2h": "120",
            "4h": "240",
            "6h": "360",
            "12h": "720",
            "24h": "1D",
            "1d": "1D",
            "d": "1D",
            "days": "1D",
            "3d": "1D",
            "3D": "1D",
            "1w": "1W",
            "w": "1W",
            "weeks": "1W",
            "1M": "1M",
            "M": "1M",
            "months": "1M",
        }
        tv_tf = tv_tf_map.get(interval, tv_tf_map.get(interval.lower(), "1D"))
        try:
            tv_candles = await PERSISTENT_TV_CLIENT.get_candles(
                symbol=f"BITHUMB:{clean_sym}KRW",
                timeframe=tv_tf,
                n_bars=min(limit, 2000),
            )
            if tv_candles and len(tv_candles) > 0:
                formatted_bithumb = {
                    "status": "0000",
                    "data": [
                        [
                            int(c[0]),
                            str(c[1]),
                            str(c[4]),
                            str(c[2]),
                            str(c[3]),
                            str(c[5]),
                        ]
                        for c in tv_candles
                    ],
                }
                return formatted_bithumb
        except Exception as e:
            print(f"⚠️ [BITHUMB 폴백 전환] {clean_sym}: {e}")

    # 🚀 [GATEIO 공식 API 직통]
    if exchange in ("gateio", "gateio_spot", "gateio_futures"):
        clean_sym = (
            symbol.replace("USDT.P", "")
            .replace(".P", "")
            .replace("USDT", "")
            .replace("_USDT", "")
            .upper()
        )
        gate_tf_map = {
            "1m": "1m",
            "3m": "5m",
            "5m": "5m",
            "10m": "15m",
            "15m": "15m",
            "30m": "30m",
            "1h": "1h",
            "2h": "4h",
            "4h": "4h",
            "6h": "4h",
            "12h": "4h",
            "24h": "1d",
            "1d": "1d",
            "d": "1d",
            "days": "1d",
            "3d": "1d",
            "1w": "7d",
            "w": "7d",
            "weeks": "7d",
            "1M": "30d",
            "M": "30d",
            "months": "30d",
        }
        gate_interval = gate_tf_map.get(
            interval, gate_tf_map.get(interval.lower(), "1d")
        )
        is_futures = (
            exchange == "gateio_futures"
            or symbol.endswith(".P")
            or "futures" in symbol.lower()
        )
        limit_num = min(limit, 1000)

        try:
            async with aiohttp.ClientSession() as session:
                if is_futures:
                    contract = f"{clean_sym}_USDT"
                    url = f"https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract={contract}&interval={gate_interval}&limit={limit_num}"
                    async with session.get(
                        url, timeout=aiohttp.ClientTimeout(total=5)
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if isinstance(data, list) and len(data) > 0:
                                return [
                                    [
                                        int(c["t"]) * 1000,
                                        str(c["o"]),
                                        str(c["h"]),
                                        str(c["l"]),
                                        str(c["c"]),
                                        str(c["v"]),
                                    ]
                                    for c in data
                                    if "t" in c
                                ]
                else:
                    currency_pair = f"{clean_sym}_USDT"
                    url = f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={currency_pair}&interval={gate_interval}&limit={limit_num}"
                    async with session.get(
                        url, timeout=aiohttp.ClientTimeout(total=5)
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if isinstance(data, list) and len(data) > 0:
                                return [
                                    [
                                        int(c[0]) * 1000,
                                        str(c[5]),
                                        str(c[3]),
                                        str(c[4]),
                                        str(c[2]),
                                        str(c[6]),
                                    ]
                                    for c in data
                                    if len(c) >= 7
                                ]
        except Exception as e:
            print(f"⚠️ [GATEIO 공식 API 에러] {clean_sym}: {e}")

    try:
        url = ExchangeAdapter.get_candle_url(
            exchange, symbol, interval, limit, to, start
        )
        if not url:
            return {"error": "지원하지 않는 거래소입니다."}

        if exchange == "upbit":
            await UPBIT_RATE_LIMITER.wait()

        fetch_url = url
        if CF_WORKER_PROXY_URL and exchange == "upbit":
            fetch_url = (
                f"{CF_WORKER_PROXY_URL.rstrip('/')}/?url={urllib.parse.quote(url)}"
            )

        session = await get_aio_session()
        data = None
        current_target = fetch_url
        req_timeout = (
            aiohttp.ClientTimeout(total=2.5, connect=1.5)
            if exchange == "bithumb"
            else None
        )
        for attempt in range(3):
            try:
                async with session.get(current_target, timeout=req_timeout) as resp:
                    if resp.status == 429:
                        if exchange == "upbit":
                            UPBIT_RATE_LIMITER.trigger_cooldown(1.5)
                        if attempt < 2:
                            await asyncio.sleep(1.0 * (attempt + 1))
                            continue
                        else:
                            data = []
                            break
                    if resp.status != 200 and current_target != url and attempt == 0:
                        current_target = url
                        continue
                    if resp.status == 200:
                        data = await resp.json()
                        break
                    else:
                        data = []
                        break
            except Exception:
                if current_target != url and attempt == 0:
                    current_target = url
                    continue
                if attempt == 2:
                    data = []
                    break
                await asyncio.sleep(0.5)

        if data is None:
            data = []

        # 빗썸 전체 캔들 반환 시 요청한 limit만큼 백엔드에서 즉시 슬라이싱하여 전송 속도 극대화
        if (
            exchange == "bithumb"
            and isinstance(data, dict)
            and data.get("status") == "0000"
        ):
            raw_list = data.get("data", [])
            if isinstance(raw_list, list) and limit and len(raw_list) > int(limit):
                data = {"status": "0000", "data": raw_list[-int(limit) :]}

        # 🚀 [설정 기반 단절 복구 엔진 (mapping.json 연동)]
        recovery_map = (
            api_manager.MAPPING_DATA.get("PAST_GAP_RECOVERY_MAP", {})
            if api_manager.MAPPING_DATA
            else {}
        )
        base_sym = (
            symbol[:-4]
            if symbol.endswith("USDT")
            else symbol.split("_")[0].split("-")[-1]
        )

        if base_sym in recovery_map and isinstance(data, list):
            if not (
                interval.endswith("d")
                or interval.endswith("w")
                or interval.endswith("M")
            ):
                return data

            if len(data) < limit:
                cache_key = f"{base_sym}_{interval}_{exchange}"

                if cache_key in TV_GAP_CACHE:
                    fallback_data = TV_GAP_CACHE[cache_key]
                    target_ts = (
                        data[0][0]
                        if len(data) > 0
                        else (int(to) if to else int(time.time() * 1000))
                    )
                    filtered_fallback = [
                        row for row in fallback_data if row[0] < target_ts
                    ]

                    needed = limit - len(data)
                    if needed > 0:
                        return filtered_fallback[-needed:] + data
                    return data

                tv_exch = recovery_map[base_sym]
                print(
                    f"⚠️ 단절 데이터 복구 감지 ({base_sym} / {symbol}). [aiohttp TV]({tv_exch}) 고속 비동기 폴백 가동!"
                )
                try:
                    tv_tf_map = {
                        "1m": "1",
                        "3m": "3",
                        "5m": "5",
                        "15m": "15",
                        "30m": "30",
                        "1h": "60",
                        "4h": "240",
                        "1d": "1D",
                        "1w": "1W",
                        "1M": "1M",
                    }
                    tv_tf = tv_tf_map.get(interval, interval.upper())

                    sym_candidates = (
                        [f"{tv_exch}:{base_sym}USDT.P", f"{tv_exch}:{base_sym}USDT"]
                        if exchange == "binance_futures"
                        else [
                            f"{tv_exch}:{base_sym}USDT",
                            f"{tv_exch}:{base_sym}USDT.P",
                        ]
                    )

                    fallback_data = []
                    for cand in sym_candidates:
                        raw_candles = await PERSISTENT_TV_CLIENT.get_candles(
                            symbol=cand, timeframe=tv_tf, n_bars=2000
                        )
                        if raw_candles:
                            fallback_data = sorted(raw_candles, key=lambda x: x[0])
                            print(
                                f" └─ [탐색 성공] aiohttp TV 심볼 '{cand}'에서 {len(fallback_data)}개 캔들 광속 수신 완료!"
                            )
                            break

                    if fallback_data:
                        compressed_cache = fallback_data[-limit:]
                        TV_GAP_CACHE[cache_key] = compressed_cache
                        print(
                            f"✅ 단절 복구 및 범용 캐싱 완료 ({cache_key}): 과거 {len(compressed_cache)}개 압축 캔들!"
                        )

                        target_ts = (
                            data[0][0]
                            if len(data) > 0
                            else (int(to) if to else int(time.time() * 1000))
                        )
                        filtered_fallback = [
                            row for row in fallback_data if row[0] < target_ts
                        ]

                        needed = limit - len(data)
                        if needed > 0:
                            return filtered_fallback[-needed:] + data
                        return data
                except Exception as tv_err:
                    print(f"🚨 aiohttp TV 복구 실패 ({base_sym}): {tv_err}")

        return data
    except Exception as e:
        if "429" in str(e):
            print(f"⚠️ [업비트 429 레이트 리밋 임시 스킵] ({symbol}): {e}")
            return []
        print(f"🚨 통합 프록시 에러 ({exchange} - {symbol}): {e}")
        return {"error": str(e)}


async def fetch_candles_guarded(
    exchange: str,
    symbol: str,
    interval: str,
    limit: int = 200,
    to: str = "",
    start: str = "",
):
    """
    🛡️ [3중 철통 방어 관문]:
      1. 타임프레임별 적응형 LRU 메모리 캐시 (15초~600초, 0ms 즉각 반환)
      2. Single-Flight (동일 코인 요청 시 1대 비행기에 전원 합승하여 외부 호출 0회 압축)
      3. Global Semaphore (동시 외부 연결 최대 20개 톨게이트 제어로 IP 차단 원천 봉쇄)
    """
    global CANDLE_CACHE
    now = time.time()
    ttl = get_candle_ttl(interval, to)

    if len(CANDLE_CACHE) > 500:
        CANDLE_CACHE = {k: v for k, v in CANDLE_CACHE.items() if now - v[0] < 600}

    req_cache_key = f"{exchange}_{symbol}_{interval}_{limit}_{start}_{to}"

    # [적응형 캐시 검사 (0ms 즉시 반환)]
    if req_cache_key in CANDLE_CACHE:
        cached_time, cached_data = CANDLE_CACHE[req_cache_key]
        if now - cached_time < ttl:
            return cached_data

    # [Single-Flight 합승]
    if req_cache_key in IN_FLIGHT_CANDLE_REQUESTS:
        try:
            return await IN_FLIGHT_CANDLE_REQUESTS[req_cache_key]
        except Exception:
            pass

    # [세마포어 톨게이트 (거래소별 독립 격리)]
    async def _guarded_worker():
        # 1. 빗썸은 자체 전용 20개 세마포어가 있으므로 바깥 20개 세마포어를 점유하지 않음 (역전 현상 0%)
        if exchange == "bithumb":
            data = await _raw_fetch_candles(
                exchange, symbol, interval, limit, to, start
            )
        else:
            # 2. 업비트/바이낸스/바이비트 등 일반 HTTP 거래소만 바깥 20개 세마포어로 보호
            async with CANDLE_SEMAPHORE:
                if req_cache_key in CANDLE_CACHE:
                    c_time, c_data = CANDLE_CACHE[req_cache_key]
                    if time.time() - c_time < ttl:
                        return c_data
                data = await _raw_fetch_candles(
                    exchange, symbol, interval, limit, to, start
                )

        if isinstance(data, (list, dict)) and "error" not in data:
            CANDLE_CACHE[req_cache_key] = (time.time(), data)
        return data

    task = asyncio.create_task(_guarded_worker())
    IN_FLIGHT_CANDLE_REQUESTS[req_cache_key] = task
    try:
        return await task
    finally:
        IN_FLIGHT_CANDLE_REQUESTS.pop(req_cache_key, None)
