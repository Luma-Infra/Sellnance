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

from . import api_manager, alpha_rules
from .adapter import ExchangeAdapter

CF_WORKER_PROXY_URL = os.getenv("CF_WORKER_PROXY_URL", "").strip()

# [500명 방어 엔진 (I/O 병목 해제 50개 톨게이트)]
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
    (💡 실시간 최신가는 프론트엔드 웹소켓이 매초 보정하므로 과거 캔들 배열 캐싱은 길어도 안전하게)
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


# [업비트 429 방어 고속 토큰 버킷 레이트 리미터 (버스트 8개 허용 / 초당 8개 충전, 429 쿨다운)]
class UpbitTokenBucketLimiter:
    def __init__(self, capacity: float = 8.0, refill_rate: float = 8.0):
        self.capacity = capacity  # 최대 버스트 허용량 (업비트 10req/s 한도 내 8개)
        self.tokens = capacity  # 초기 토큰 가득 참
        self.refill_rate = refill_rate  # 초당 토큰 충전량
        self.last_refill = time.time()
        self.cooldown_until = 0.0
        self.last_request_time = 0.0
        self.lock = asyncio.Lock()

    def trigger_cooldown(self, seconds: float = 1.5):
        now = time.time()
        self.cooldown_until = max(self.cooldown_until, now + seconds)
        self.tokens = 0.0  # 429 감지 시 토큰 즉시 소진

    def sync_remaining_req(self, header_val: str):
        """업비트 Remaining-Req: group=candles; sec=X 헤더 파싱 후 잔여 토큰 실시간 동기화"""
        if not header_val:
            return
        try:
            m = re.search(r"sec=(\d+)", header_val, re.IGNORECASE)
            if m:
                rem_sec = int(m.group(1))
                now = time.time()
                # 업비트 잔여 한도가 현재 토큰보다 작으면 안전하게 하향 조정
                self.tokens = min(self.tokens, max(0.0, float(rem_sec - 1)))
                self.last_refill = now
        except Exception:
            pass

    async def wait(self):
        min_pacing = 1.0 / self.refill_rate  # 125ms (초당 8회 안전 간격)
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

                    # 3. 최소 125ms 페이싱(간격) 체크 (8개 방어)
                    elapsed_since_last = now - self.last_request_time
                    pacing_wait = max(0.0, min_pacing - elapsed_since_last)

                    # 4. 토큰 1개 이상이고 페이싱 통과 시 즉시 발송
                    if self.tokens >= 1.0 and pacing_wait <= 0.0:
                        self.tokens -= 1.0
                        self.last_request_time = now
                        return

                    # 5. 토큰 또는 페이싱 대기 시간 산출
                    token_wait = max(0.0, (1.0 - self.tokens) / self.refill_rate)
                    sleep_time = max(pacing_wait, token_wait)

            if sleep_time > 0:
                await asyncio.sleep(sleep_time)


UPBIT_RATE_LIMITER = UpbitTokenBucketLimiter(capacity=8.0, refill_rate=8.0)


def _construct_tv_msg(func, param_list):
    msg = json.dumps({"m": func, "p": param_list})
    return f"~m~{len(msg)}~m~{msg}"


class PersistentTVClient:
    """
    [초고속 락-프리 트레이딩뷰 비동기 멀티플렉서]
    - 단일 TCP 웹소켓 연결 멀티플렉싱: 유저 500명 동시 접속에도 단 1개 소켓만 공유하여 백엔드/트뷰 부하 0%
    - aiohttp 비동기 스트림 리더: ping/close 프레임 안전 분기 처리 및 연결 유실 시 0초 자동 복구
    - GC 원자성 (Zero-Leak): finally 블록에서 pending_futures를 원자적 pop()하여 메모리 누수 최소화
    - 트레이딩뷰 밴 완벽 방어: 20개 동시 세션 세마포어 캡 + 데이터 수신 즉시 chart_delete_session 전송
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

    async def _ensure_connected(self):
        if (
            self.ws is not None
            and not self.ws.closed
            and self.reader_task is not None
            and not self.reader_task.done()
        ):
            return self.ws

        async with self.connect_lock:
            if (
                self.ws is not None
                and not self.ws.closed
                and self.reader_task is not None
                and not self.reader_task.done()
            ):
                return self.ws

            if self.session is None or self.session.closed:
                self.session = aiohttp.ClientSession(
                    timeout=aiohttp.ClientTimeout(total=10)
                )

            try:
                self.ws = await self.session.ws_connect(
                    self.url, headers=self.headers, heartbeat=20.0
                )
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

    async def _reader_loop(self):
        """백그라운드에서 트레이딩뷰 패킷을 수신하여 해당 세션의 Future에 즉시 분배"""
        try:
            async for msg in self.ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    raw_text = msg.data
                    # 1. 트레이딩뷰 핑/퐁 하트비트 0ms 즉시 응답
                    if "~h~" in raw_text:
                        h_val = raw_text.split("~h~")[1]
                        await self.ws.send_str(f"~m~{len(h_val)}~m~~h~{h_val}")
                        continue

                    # 2. 패킷 파싱 및 해당 세션 Future로 즉시 디스패치
                    for packet in re.split(r"~m~\d+~m~", raw_text):
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
                                                (
                                                    str(p["v"][5])
                                                    if len(p.get("v", [])) >= 6
                                                    else "0"
                                                ),
                                            ]
                                            for p in plots
                                            if len(p.get("v", [])) >= 5
                                        ]
                                        if candles:
                                            fut.set_result(candles)
                            elif method in ("critical_error", "symbol_error"):
                                params = parsed.get("p", [])
                                if len(params) >= 1:
                                    session_id = params[0]
                                    fut = self.pending_futures.get(session_id)
                                    if fut and not fut.done():
                                        fut.set_result([])
                        except Exception:
                            pass
                elif msg.type in (
                    aiohttp.WSMsgType.CLOSED,
                    aiohttp.WSMsgType.ERROR,
                    aiohttp.WSMsgType.CLOSING,
                ):
                    break
        except Exception:
            pass
        finally:
            self.ws = None
            # 연결 종료 시 잔여 퓨처 안전 정리
            for fut in list(self.pending_futures.values()):
                if not fut.done():
                    fut.set_result([])
            self.pending_futures.clear()

    async def get_candles(self, symbol: str, timeframe: str = "1D", n_bars: int = 1000):
        async with self.semaphore:  # 트레이딩뷰 밴 방지용 동시 세션 캡
            self._seq = (self._seq + 1) % 1000000
            chart_session = f"cs_p_{self._seq}_{int(time.time() * 1000) % 100000}"
            loop = asyncio.get_running_loop()
            fut = loop.create_future()
            self.pending_futures[chart_session] = fut

            try:
                ws = await self._ensure_connected()
                batch_msg = (
                    _construct_tv_msg("chart_create_session", [chart_session, ""])
                    + _construct_tv_msg(
                        "resolve_symbol",
                        [
                            chart_session,
                            "sds_sym_1",
                            f"={json.dumps({'symbol': symbol, 'adjustment': 'splits'})}",
                        ],
                    )
                    + _construct_tv_msg(
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
                await ws.send_str(batch_msg)

                # Future 완료 대기 (최대 3.5초 안전 타임아웃, 평시 0.2초)
                candles = await asyncio.wait_for(fut, timeout=3.5)
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


async def fetch_alpha_or_fallback_candles(
    clean_base: str,
    interval: str,
    limit: int = 500,
    to: str = "",
    start: str = "",
    is_alpha_coin: bool = False,
):
    """
    [바이낸스 알파 1순위 직행 & 타 거래소 공식 REST 엔드포인트 스마트 폴백]
    1. 알파 코인인 경우 -> 바이낸스 알파 Klines 공식 REST API (1순위)
    2. 타 거래소 폴백(Bybit, Bitget, Gate.io) -> 각 거래소 공식 REST API 엔드포인트 직접 호출
    3. 빗썸(Bithumb)만 트레이딩뷰 웹소켓(PERSISTENT_TV_CLIENT) 유지 (사용자 지정: 빗썸만 제외)
    """
    session = await get_aio_session()
    n_bars = int(limit) if limit else 500

    # 1. 🥇 [바이낸스 알파 공식 Klines API 1순위]
    alpha_id = None
    try:
        alpha_map = alpha_rules.fetch_binance_alpha_raw()
        alpha_item = alpha_map.get(clean_base.upper()) if alpha_map else None
        if isinstance(alpha_item, dict):
            alpha_id = alpha_item.get("alphaId")
    except Exception:
        pass

    if alpha_id or is_alpha_coin:
        target_id = alpha_id or clean_base
        norm_int = ExchangeAdapter.normalize_interval("binance_spot", interval)
        alpha_url = f"https://www.binance.com/bapi/defi/v1/public/alpha-trade/klines?symbol={target_id}USDT&interval={norm_int}&limit={n_bars}"
        if to:
            alpha_url += f"&endTime={to}"
        if start:
            alpha_url += f"&startTime={start}"
        try:
            async with session.get(
                alpha_url, timeout=aiohttp.ClientTimeout(total=3.5)
            ) as resp:
                if resp.status == 200:
                    res_json = await resp.json()
                    kdata = res_json.get("data")
                    if isinstance(kdata, list) and len(kdata) > 0:
                        sorted_k = sorted(kdata, key=lambda x: int(x[0]))
                        return sorted_k, None
        except Exception:
            pass

    # 2. 🥈 [타 거래소 공식 REST API 폴백: 기존 _raw_fetch_candles 파이프라인 재사용 (중복 제거)]
    fallback_targets = [
        ("bybit_spot", "BYBIT"),
        ("bitget_spot", "BITGET"),
        ("gateio_spot", "GATEIO"),
    ]
    for ex_key, ex_name in fallback_targets:
        try:
            cand, _ = await _raw_fetch_candles(
                exchange=ex_key,
                symbol=f"{clean_base}USDT",
                interval=interval,
                limit=n_bars,
                to=to,
                start=start,
            )
            if cand and isinstance(cand, list) and len(cand) > 0:
                return cand, ex_name
        except Exception:
            pass

    # 3. [BITHUMB 트레이딩뷰 웹소켓 유지 (빗썸만 제외하여 기존 TV 사용)]
    tv_tf_map = {
        "1m": "1",
        "3m": "3",
        "5m": "5",
        "15m": "15",
        "30m": "30",
        "1h": "60",
        "2h": "120",
        "4h": "240",
        "6h": "360",
        "12h": "720",
        "1d": "1D",
        "days": "1D",
        "3d": "3D",
        "1w": "1W",
        "weeks": "1W",
        "1M": "1M",
        "months": "1M",
    }
    tv_tf = tv_tf_map.get(interval, interval.upper())
    try:
        tv_cand = await PERSISTENT_TV_CLIENT.get_candles(
            symbol=f"BITHUMB:{clean_base}KRW", timeframe=tv_tf, n_bars=n_bars
        )
        if tv_cand and isinstance(tv_cand, list) and len(tv_cand) > 0:
            return sorted(tv_cand, key=lambda x: int(x[0])), "BITHUMB"
    except Exception:
        pass

    return None, None


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

    # [BITHUMB 전용 aiohttp TV 고속 우회 엔진]
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
        # [초고속 렌더링] 첫 진입(to 없음) 시 300개로 0.2초 초고속 렌더링, 과거 탐색 시 요청 limit 충실 반영
        req_bars = min(limit, 300) if not to else min(limit, 2000)
        try:
            tv_candles = await PERSISTENT_TV_CLIENT.get_candles(
                symbol=f"BITHUMB:{clean_sym}KRW",
                timeframe=tv_tf,
                n_bars=req_bars,
            )
            if tv_candles and len(tv_candles) > 0:
                if to:
                    try:
                        target_to = int(to)
                        tv_candles = [c for c in tv_candles if int(c[0]) <= target_to]
                        if limit and len(tv_candles) > int(limit):
                            tv_candles = tv_candles[-int(limit) :]
                    except Exception:
                        pass
                if not tv_candles:
                    return {"status": "0000", "data": []}, None
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
                return formatted_bithumb, None
        except Exception as e:
            print(f"⚠️ [BITHUMB 폴백 전환] {clean_sym}: {e}")

    # [BYBIT 공식 API 직통]
    if exchange in ("bybit", "bybit_spot", "bybit_futures"):
        try:
            url = ExchangeAdapter.get_candle_url(
                exchange, symbol, interval, limit, to, start
            )
            if url:
                session = await get_aio_session()
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        res_json = await resp.json()
                        raw_data = res_json.get("result", {}).get("list", [])
                        if isinstance(raw_data, list) and len(raw_data) > 0:
                            candles = [
                                [
                                    int(c[0]),
                                    str(c[1]),
                                    str(c[2]),
                                    str(c[3]),
                                    str(c[4]),
                                    str(c[5]),
                                ]
                                for c in raw_data
                                if len(c) >= 6
                            ]
                            return sorted(candles, key=lambda x: x[0]), None
        except Exception as e:
            print(f"⚠️ [BYBIT 공식 API 에러] {symbol}: {e}")

    # [BITGET 공식 API 직통]
    if exchange in ("bitget", "bitget_spot", "bitget_futures"):
        try:
            url = ExchangeAdapter.get_candle_url(
                exchange, symbol, interval, limit, to, start
            )
            if url:
                session = await get_aio_session()
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        res_json = await resp.json()
                        raw_data = res_json.get("data", [])
                        if isinstance(raw_data, list) and len(raw_data) > 0:
                            # 비트겟: [ts, open, high, low, close, volume, quoteVol]
                            candles = [
                                [
                                    int(c[0]),
                                    str(c[1]),
                                    str(c[2]),
                                    str(c[3]),
                                    str(c[4]),
                                    str(c[5]),
                                ]
                                for c in raw_data
                                if len(c) >= 6
                            ]
                            return sorted(candles, key=lambda x: x[0]), None
        except Exception as e:
            print(f"⚠️ [BITGET 공식 API 에러] {symbol}: {e}")

    # [GATEIO 공식 API 직통]
    if exchange in ("gateio", "gateio_spot", "gateio_futures"):
        try:
            url = ExchangeAdapter.get_candle_url(
                exchange, symbol, interval, limit, to, start
            )
            if url:
                session = await get_aio_session()
                async with session.get(
                    url, timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if isinstance(data, list) and len(data) > 0:
                            is_futures = (
                                exchange == "gateio_futures"
                                or symbol.endswith(".P")
                                or "futures" in symbol.lower()
                            )
                            if is_futures:
                                # 선물: [{"t": 1789464420, "o": "...", "h": "...", "l": "...", "c": "...", "v": ...}]
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
                                    if isinstance(c, dict) and "t" in c
                                ], None
                            else:
                                # 현물: [[ts, quoteVol, close, high, low, open, baseVol, isClosed], ...]
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
                                    if isinstance(c, list) and len(c) >= 7
                                ], None
        except Exception as e:
            print(f"⚠️ [GATEIO 공식 API 에러] {symbol}: {e}")

    # [바이낸스 알파 코인 직행]: 바이낸스 일반 현물(400 에러) 대신 바이낸스 알파 공식 Klines REST API로 1순위 즉시 서빙
    clean_base = (
        symbol.replace("USDT", "").replace("BUSD", "").replace("USDC", "").upper()
    )
    fallback_source = None
    is_alpha_coin = False
    if exchange in ("binance", "binance_spot") and api_manager.MAPPING_DATA:
        t_data = api_manager.MAPPING_DATA.get("TICKER_DATA", {}).get(clean_base)
        if (
            isinstance(t_data, list)
            and len(t_data) >= 6
            and str(t_data[5]).upper() == "ALPHA"
        ):
            is_alpha_coin = True

    if is_alpha_coin:
        cand, src = await fetch_alpha_or_fallback_candles(
            clean_base=clean_base,
            interval=interval,
            limit=int(limit) if limit else 500,
            to=to,
            start=start,
            is_alpha_coin=True,
        )
        if cand and len(cand) > 0:
            return cand, src

    try:
        url = ExchangeAdapter.get_candle_url(
            exchange, symbol, interval, limit, to, start
        )
        if not url:
            return {"error": "지원하지 않는 거래소입니다."}, None

        if exchange == "upbit":
            await UPBIT_RATE_LIMITER.wait()

        fetch_url = url
        session = await get_aio_session()
        data = None
        current_target = fetch_url
        req_timeout = (
            aiohttp.ClientTimeout(total=2.5, connect=1.5)
            if exchange == "bithumb"
            else aiohttp.ClientTimeout(total=3.0, connect=1.5)
        )
        for attempt in range(3):
            try:
                async with session.get(current_target, timeout=req_timeout) as resp:
                    if resp.status == 429:
                        if exchange == "upbit":
                            UPBIT_RATE_LIMITER.trigger_cooldown(1.5)
                            # 1차 실패 시 비상 Cloudflare Worker 프록시가 있으면 전환
                            if CF_WORKER_PROXY_URL and current_target == url:
                                current_target = f"{CF_WORKER_PROXY_URL.rstrip('/')}/?url={urllib.parse.quote(url)}"
                        if attempt < 2:
                            await asyncio.sleep(1.0 * (attempt + 1))
                            continue
                        else:
                            data = []
                            break
                    if resp.status == 200:
                        if exchange == "upbit":
                            rem_header = resp.headers.get("Remaining-Req")
                            if rem_header:
                                UPBIT_RATE_LIMITER.sync_remaining_req(rem_header)
                        data = await resp.json()
                        break
                    else:
                        if (
                            CF_WORKER_PROXY_URL
                            and exchange == "upbit"
                            and current_target == url
                            and attempt == 0
                        ):
                            current_target = f"{CF_WORKER_PROXY_URL.rstrip('/')}/?url={urllib.parse.quote(url)}"
                            continue
                        data = []
                        break
            except Exception:
                if (
                    CF_WORKER_PROXY_URL
                    and exchange == "upbit"
                    and current_target == url
                    and attempt == 0
                ):
                    current_target = f"{CF_WORKER_PROXY_URL.rstrip('/')}/?url={urllib.parse.quote(url)}"
                    continue
                if attempt == 2:
                    data = []
                    break
                await asyncio.sleep(0.5)

        if data is None:
            data = []

        # [바이낸스 캔들 스마트 폴백]: 오직 알파 코인인 경우에만 타 거래소 폴백 가동 (정규 바낸 스팟/퓨처는 폴백 대상 아님)
        if (
            is_alpha_coin
            and exchange in ("binance", "binance_spot")
            and (not data or len(data) == 0)
        ):
            clean_base = (
                symbol.replace("USDT", "")
                .replace("BUSD", "")
                .replace("USDC", "")
                .upper()
            )
            cand, src = await fetch_alpha_or_fallback_candles(
                clean_base=clean_base,
                interval=interval,
                limit=int(limit) if limit else 500,
                to=to,
                start=start,
                is_alpha_coin=False,
            )
            if cand and len(cand) > 0:
                data = cand
                fallback_source = src
                print(
                    f"✅ [알파/미상장 캔들 스마트 폴백 수신] {symbol} -> {src} ({len(data)}개)"
                )

        # 빗썸 전체 캔들 반환 시 요청한 limit만큼 백엔드에서 즉시 슬라이싱하여 전송 속도 극대화
        if (
            exchange == "bithumb"
            and isinstance(data, dict)
            and data.get("status") == "0000"
        ):
            raw_list = data.get("data", [])
            if isinstance(raw_list, list) and limit and len(raw_list) > int(limit):
                data = {"status": "0000", "data": raw_list[-int(limit) :]}

        # [설정 기반 단절 복구 엔진 (mapping.json 연동)]
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
                return data, fallback_source

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
                        return filtered_fallback[-needed:] + data, fallback_source
                    return data, fallback_source

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
                            return filtered_fallback[-needed:] + data, fallback_source
                        return data, fallback_source
                except Exception as tv_err:
                    print(f"🚨 aiohttp TV 복구 실패 ({base_sym}): {tv_err}")

        return data, fallback_source
    except Exception as e:
        if "429" in str(e):
            print(f"⚠️ [업비트 429 레이트 리밋 임시 스킵] ({symbol}): {e}")
            return [], None
        print(f"🚨 통합 프록시 에러 ({exchange} - {symbol}): {e}")
        return {"error": str(e)}, None


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

    if len(CANDLE_CACHE) > 100:
        # 1차: 300초(5분) 이상 경과한 캐시 즉시 퇴출
        CANDLE_CACHE = {k: v for k, v in CANDLE_CACHE.items() if now - v[0] < 300}
        # 2차: 그래도 100개 초과 시 가장 최신 80개만 남기고 즉시 제거
        if len(CANDLE_CACHE) > 100:
            sorted_items = sorted(
                CANDLE_CACHE.items(), key=lambda item: item[1][0], reverse=True
            )
            CANDLE_CACHE = dict(sorted_items[:80])

    req_cache_key = f"{exchange}_{symbol}_{interval}_{limit}_{start}_{to}"

    # [적응형 캐시 검사 (0ms 즉시 반환)]
    if req_cache_key in CANDLE_CACHE:
        cached_entry = CANDLE_CACHE[req_cache_key]
        if len(cached_entry) == 3:
            cached_time, cached_data, cached_source = cached_entry
        else:
            cached_time, cached_data = cached_entry
            cached_source = None
        if now - cached_time < ttl:
            return cached_data, cached_source

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
            data, source = await _raw_fetch_candles(
                exchange, symbol, interval, limit, to, start
            )
        else:
            # 2. 업비트/바이낸스/바이비트 등 일반 HTTP 거래소만 바깥 20개 세마포어로 보호
            async with CANDLE_SEMAPHORE:
                if req_cache_key in CANDLE_CACHE:
                    cached_entry = CANDLE_CACHE[req_cache_key]
                    if len(cached_entry) == 3:
                        c_time, c_data, c_source = cached_entry
                    else:
                        c_time, c_data = cached_entry
                        c_source = None
                    if time.time() - c_time < ttl:
                        return c_data, c_source
                data, source = await _raw_fetch_candles(
                    exchange, symbol, interval, limit, to, start
                )

        # 🚀 [유효성 검증] 유효한 캔들 데이터(len > 0)만 캐시 저장 (빈 배열 [] 캐싱 차단)
        if isinstance(data, list) and len(data) > 0:
            CANDLE_CACHE[req_cache_key] = (time.time(), data, source)
        elif isinstance(data, dict) and "error" not in data and bool(data):
            CANDLE_CACHE[req_cache_key] = (time.time(), data, source)
        return data, source

    task = asyncio.create_task(_guarded_worker())
    IN_FLIGHT_CANDLE_REQUESTS[req_cache_key] = task
    try:
        return await task
    finally:
        IN_FLIGHT_CANDLE_REQUESTS.pop(req_cache_key, None)
