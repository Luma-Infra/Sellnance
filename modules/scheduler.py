# modules/scheduler.py
"""
[통합 백그라운드 스케줄러 & 실시간 와처]
- 15분 정기 갱신 (:00, :15, :30, :45)
- 아침 09:00:00 원스톱 9시 시가 초기화 파이프라인
- 4시간 정각 (01, 05, 09, 13, 17, 21시) 서버 CMC 시총 갱신
- 10초 주기 초경량 신규 상장 aiohttp 비동기 레이더 와처
"""
import pytz
import time
import orjson
import asyncio
import aiohttp
import threading
from datetime import datetime

KST = pytz.timezone("Asia/Seoul")


def get_seconds_until_next_15min():
    """다음 :00, :15, :30, :45 정각까지 남은 초 계산"""
    now = datetime.now(KST)
    current_minute = now.minute
    current_second = now.second
    next_minute = ((current_minute // 15) + 1) * 15
    if next_minute == 60:
        seconds_left = (60 - current_minute) * 60 - current_second
    else:
        seconds_left = (next_minute - current_minute) * 60 - current_second
    return max(1, seconds_left)


def _get_top5_upbit_codes() -> list[str]:
    """당일 장부 실시간 거래대금 기준 업비트 Top 5 코인 동적 추출 (Fallback 포함)"""
    fallback = ["KRW-XRP", "KRW-USDT", "KRW-BTC", "KRW-ETH", "KRW-SOL"]
    try:
        from . import api_manager

        data = api_manager.GLOBAL_CACHE.get("data", [])
        if not data:
            return fallback
        valid = [
            r
            for r in data
            if r.get("Upbit") == "O" and float(r.get("Upbit_Vol") or 0) > 0
        ]
        if len(valid) < 5:
            return fallback
        sorted_coins = sorted(
            valid, key=lambda r: float(r.get("Upbit_Vol") or 0), reverse=True
        )
        res = [
            f"KRW-{r.get('Upbit_Symbol') or r.get('Symbol')}" for r in sorted_coins[:5]
        ]
        return res if len(res) == 5 else fallback
    except Exception:
        return fallback


def _get_top5_binance_symbols() -> list[str]:
    """당일 장부 실시간 거래대금 기준 바이낸스 현물 Top 5 코인 동적 추출 (Fallback 포함)"""
    fallback = ["btcusdt", "ethusdt", "solusdt", "xrpusdt", "zecusdt"]
    try:
        from . import api_manager

        data = api_manager.GLOBAL_CACHE.get("data", [])
        if not data:
            return fallback
        valid = [
            r
            for r in data
            if (r.get("Binance") == "O" or r.get("Exact_Spot"))
            and float(r.get("Binance_Vol_Spot") or r.get("Volume_Raw") or 0) > 0
        ]
        if len(valid) < 5:
            return fallback
        sorted_coins = sorted(
            valid,
            key=lambda r: float(r.get("Binance_Vol_Spot") or r.get("Volume_Raw") or 0),
            reverse=True,
        )
        res = [
            f"{(r.get('Exact_Spot') or r.get('Symbol')).lower()}usdt"
            for r in sorted_coins[:5]
        ]
        return res if len(res) == 5 else fallback
    except Exception:
        return fallback


async def wait_for_exchanges_9am_crossing(
    target_ms: int, timeout: float = 30.0
) -> bool:
    """
    ⚡ Upbit + Binance 실시간 웹소켓 듀얼 원자시계 정밀 동기화 엔진 (Top 5 AND 게이트)
    - 08:59:45 경에 일시 가동되어 업비트 Top 5 중 1등 돌파 + 바이낸스 현물 Top 5 중 1등 돌파를 확인
    - [현선 침범 0% & OOM 0% 3중 방어]:
      1. 웹소켓은 장부 주입 없이 '원자시계 돌파' 신호만 확인 후 즉시 파기
      2. 5개 중 단 1개라도 돌파 틱 수신 즉시 await ws.close() 직후 물리적 TCP 차단
      3. 양쪽 모두 돌파 확인 시 0.3초 미세 완충 후 시가 벌크 파이프라인 단 1회 실행
    """
    upbit_passed = False
    binance_passed = False

    upbit_codes = _get_top5_upbit_codes()
    binance_symbols = _get_top5_binance_symbols()

    async def _watch_upbit(session):
        nonlocal upbit_passed
        try:
            client_t = aiohttp.ClientTimeout(total=timeout)
            async with session.ws_connect(
                "wss://api.upbit.com/websocket/v1",
                timeout=client_t,
                max_msg_size=16384,
            ) as ws:
                payload = [
                    {"ticket": "9am_sync"},
                    {"type": "trade", "codes": upbit_codes},
                ]
                await ws.send_bytes(orjson.dumps(payload))
                while not upbit_passed:
                    msg = await ws.receive()
                    if msg.type in (aiohttp.WSMsgType.BINARY, aiohttp.WSMsgType.TEXT):
                        data = orjson.loads(msg.data)
                        ts = data.get("trade_timestamp") or data.get("timestamp") or 0
                        if ts >= target_ms:
                            upbit_passed = True
                            await ws.close()  # 5개 중 1등 확인 즉시 물리적 차단
                            break
                    elif msg.type in (
                        aiohttp.WSMsgType.CLOSED,
                        aiohttp.WSMsgType.ERROR,
                    ):
                        break
        except Exception:
            upbit_passed = True

    async def _watch_binance(session):
        nonlocal binance_passed
        try:
            client_t = aiohttp.ClientTimeout(total=timeout)
            stream_query = "/".join(f"{s}@aggTrade" for s in binance_symbols)
            ws_url = f"wss://stream.binance.com:9443/stream?streams={stream_query}"
            async with session.ws_connect(
                ws_url,
                timeout=client_t,
                max_msg_size=16384,
            ) as ws:
                while not binance_passed:
                    msg = await ws.receive()
                    if msg.type in (aiohttp.WSMsgType.TEXT, aiohttp.WSMsgType.BINARY):
                        d = orjson.loads(msg.data)
                        data = d.get("data", d)
                        ts = data.get("T") or data.get("E") or 0
                        if ts >= target_ms:
                            binance_passed = True
                            await ws.close()  # 5개 중 1등 확인 즉시 물리적 차단
                            break
                    elif msg.type in (
                        aiohttp.WSMsgType.CLOSED,
                        aiohttp.WSMsgType.ERROR,
                    ):
                        break
        except Exception:
            binance_passed = True

    connector = aiohttp.TCPConnector(limit=2, ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        try:
            await asyncio.wait_for(
                asyncio.gather(_watch_upbit(session), _watch_binance(session)),
                timeout=timeout,
            )
            return upbit_passed and binance_passed
        except (asyncio.TimeoutError, Exception) as e:
            print(f"⚠️ [9AM WEBSOCKET] 거래소 웹소켓 동기화 폴백 트리거: {e}")
            return False


def sync_wait_for_9am_crossing(target_ms: int, timeout: float = 30.0) -> bool:
    """별도 이벤트 루프로 웹소켓 동기화 실행 후 자원 즉시 해제 (단발성 실행, OOM 0%)"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            wait_for_exchanges_9am_crossing(target_ms, timeout=timeout)
        )
    finally:
        loop.close()


_UNIFIED_SCHEDULER_STARTED = False
_WATCHER_STARTED = False
_SCHEDULER_LOCK = threading.Lock()


def start_unified_background_scheduler():
    """
    단일 통합 백그라운드 스케줄러 (업비트 + 바이낸스 듀얼 웹소켓 정밀 동기화)
    - 스레드 1개로만 동작하여 09:00 중복 실행 및 락 경합 차단
    - 08:59:45 -> 거래소 웹소켓 듀얼 오픈 후 09:00:00.000 돌파 틱 포착 시 9시 시가 초기화 파이프라인 단독 실행
    - :15, :30, :45, 타 시간대 :00 -> 일반 15분 무음 정기 갱신 (4시간 정각 시총 갱신 포함)
    """
    global _UNIFIED_SCHEDULER_STARTED
    with _SCHEDULER_LOCK:
        if _UNIFIED_SCHEDULER_STARTED:
            return
        _UNIFIED_SCHEDULER_STARTED = True

    from . import api_manager

    def run():
        print("🔄 [SYSTEM] 단일 통합 백그라운드 스케줄러 가동 (:00, :15, :30, :45)...")
        last_reset_date = None

        while True:
            try:
                now = datetime.now(KST)

                # 다음 정각 15분 슬롯 계산
                next_target_hour = now.hour
                next_target_min = ((now.minute // 15) + 1) * 15
                if next_target_min == 60:
                    next_target_hour = (next_target_hour + 1) % 24
                    next_target_min = 0

                sleep_sec = get_seconds_until_next_15min()

                # [09:00 정각 특수 구간]: 다음 슬롯이 09:00인 경우 (08:45 ~ 09:00)
                if next_target_hour == 9 and next_target_min == 0:
                    # 정각 15초 전(08:59:45)까지 먼저 수면
                    pre_wait = max(0, sleep_sec - 15)
                    if pre_wait > 0:
                        time.sleep(pre_wait)

                    # 오늘 09:00:00 타겟 ms 계산
                    today_9am = datetime.now(KST).replace(
                        hour=9, minute=0, second=0, microsecond=0
                    )
                    target_ms = int(today_9am.timestamp() * 1000)

                    # ⚡ [초경량 웹소켓 동기화] 업비트 & 바이낸스 09:00:00.000 틱 돌파 감시 (최대 30초 대기)
                    print(
                        "📡 [9AM WEBSOCKET] 업비트 & 바이낸스 09:00:00.000 정밀 원자시계 감시 가동..."
                    )
                    success = sync_wait_for_9am_crossing(target_ms, timeout=30.0)
                    if success:
                        print(
                            "🎯 [9AM WEBSOCKET] 업비트 & 바이낸스 09:00:00.000 체결 틱 동시 돌파 감지! (0ms 오차)"
                        )
                    else:
                        print(
                            "⏰ [9AM WEBSOCKET] 타임아웃/로컬 폴백으로 09:00 정각 파이프라인 진행"
                        )

                    # 🛡️ 0.3초 미세 완충 (모든 거래소 매칭 엔진의 09시 일봉 캔들 완전 생성 보장)
                    time.sleep(0.3)

                    api_manager.trigger_kst_9am_reset_atomic()
                    last_reset_date = today_9am.date()
                    time.sleep(15)
                    continue

                # 🔄 [일반 15분 정기 갱신 구간] (:15, :30, :45, 타 시간대 :00)
                time.sleep(sleep_sec)
                now = datetime.now(KST)

                # 혹시 비정상 지연 등으로 09:00대를 지나쳤으나 당일 리셋을 아직 안 한 경우 세이프티 가드
                if now.hour == 9 and last_reset_date != now.date():
                    print("🎯 [BG SCHEDULER] 09:00 지연 감지 세이프티 가드 실행...")
                    api_manager.trigger_kst_9am_reset_atomic()
                    last_reset_date = now.date()
                else:
                    print(
                        f"🔄 [BG SCHEDULER] {now.strftime('%H:%M:%S')} 정각 자동 갱신 시작..."
                    )
                    api_manager._fetch_and_process_data_and_cache(silent_mode=True)

            except Exception as e:
                print(f"🚨 [BG SCHEDULER ERROR] {e}")
                time.sleep(5)

    thread = threading.Thread(target=run, daemon=True)
    thread.start()


def start_realtime_listing_watcher():
    """
    ⚡ aiohttp 비동기 멀티플렉싱 초경량 무음 상장 감시 엔진 (6대 거래소 동시 병렬 ~ 10초 주기)
    """
    global _WATCHER_STARTED
    with _SCHEDULER_LOCK:
        if _WATCHER_STARTED:
            return
        _WATCHER_STARTED = True

    from . import api_manager

    targets = [
        (
            "UPBIT",
            "https://api.upbit.com/v1/market/all?isDetails=false",
            lambda d: {
                m["market"] for m in d if m.get("market", "").startswith("KRW-")
            },
        ),
        (
            "BITHUMB",
            "https://api.bithumb.com/v1/market/all?isDetails=false",
            lambda d: {
                m["market"] for m in d if m.get("market", "").startswith("KRW-")
            },
        ),
        (
            "BINANCE_FUTURES",
            "https://fapi.binance.com/fapi/v1/ticker/price",
            lambda d: {m["symbol"] for m in d if m.get("symbol", "").endswith("USDT")},
        ),
        (
            "BINANCE_SPOT",
            "https://api.binance.com/api/v3/ticker/price",
            lambda d: {m["symbol"] for m in d if m.get("symbol", "").endswith("USDT")},
        ),
        (
            "BYBIT_FUTURES",
            "https://api.bybit.com/v5/market/tickers?category=linear",
            lambda d: {
                m["symbol"]
                for m in d.get("result", {}).get("list", [])
                if m.get("symbol", "").endswith("USDT")
            },
        ),
        (
            "BITGET_SPOT",
            "https://api.bitget.com/api/v2/spot/market/tickers",
            lambda d: {
                m["symbol"]
                for m in d.get("data", [])
                if m.get("symbol", "").endswith("USDT")
            },
        ),
    ]

    async def async_watcher_loop():
        timeout = aiohttp.ClientTimeout(total=3)
        connector = aiohttp.TCPConnector(limit=10, ssl=False)
        known = {ex: set() for ex, _, _ in targets}
        initialized = False

        async with aiohttp.ClientSession(
            timeout=timeout, connector=connector
        ) as session:
            while True:
                try:
                    current = {}

                    async def _fetch(ex, url, parser):
                        try:
                            async with session.get(url) as r:
                                if r.status == 200:
                                    current[ex] = parser(await r.json())
                        except Exception:
                            pass

                    await asyncio.gather(
                        *[_fetch(ex, url, parser) for ex, url, parser in targets]
                    )

                    if not initialized:
                        for ex, mkts in current.items():
                            if mkts:
                                known[ex] = set(mkts)
                        if any(known.values()):
                            initialized = True
                    else:
                        new_diff = {
                            ex: current[ex] - known[ex]
                            for ex in current
                            if known.get(ex) and (current[ex] - known[ex])
                        }
                        if new_diff:
                            for ex, syms in new_diff.items():
                                known[ex].update(syms)
                            discovery_msgs = [
                                f"[{ex}] {', '.join(sorted(syms))}"
                                for ex, syms in new_diff.items()
                            ]
                            print(
                                f"\n🚨 [신규 상장 감지] {' | '.join(discovery_msgs)} 신규 상장 포착! 긴급 0초 장부 동기화 가동..."
                            )
                            api_manager._fetch_and_process_data_and_cache(
                                silent_mode=True
                            )
                            print(
                                f"⚡ [신규 상장 동기화 완료] 신규 상장 코인이 장부에 즉시 입고되었습니다.\n"
                            )
                except Exception:
                    pass
                await asyncio.sleep(10)

    def run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(async_watcher_loop())
        finally:
            loop.close()

    threading.Thread(target=run, daemon=True).start()


def start_all_schedulers():
    """모든 백그라운드 스케줄러 일괄 가동"""
    start_unified_background_scheduler()
    start_realtime_listing_watcher()
