# modules/tv_singleton.py
"""
TradingView tvDatafeed 단일 싱글톤 및 실시간 환율 캐시 모듈.
매 루프마다 새 TvDatafeed 객체를 생성하지 않고 단일 인스턴스를 재활용하여
백그라운드 웹소켓 좀비 스레드 누수 및 메모리 팽창을 원천 차단합니다.
"""
import threading
import time
from typing import Optional

_tv_lock = threading.Lock()
_tv_instance = None

_rate_cache_lock = threading.Lock()
_cached_rate: Optional[float] = None
_cached_rate_time: float = 0.0
RATE_CACHE_TTL: float = 60.0  # 60초 캐시 유지


def get_tv_datafeed():
    """TvDatafeed 단일 싱글톤 인스턴스 반환 (Thread-safe)"""
    global _tv_instance
    if _tv_instance is None:
        with _tv_lock:
            if _tv_instance is None:
                try:
                    from tvDatafeed import TvDatafeed

                    _tv_instance = TvDatafeed()
                except Exception as e:
                    print(f"⚠️ [TvDatafeed] 싱글톤 초기화 실패: {e}")
                    return None
    return _tv_instance


def get_cached_usdkrw_rate(fallback_rate: float = 0.0) -> float:
    """
    TvDatafeed 싱글톤을 활용한 실시간 USD/KRW 환율 수집 (60초 TTL 캐시)
    """
    global _cached_rate, _cached_rate_time
    now = time.time()

    with _rate_cache_lock:
        if _cached_rate is not None and (now - _cached_rate_time < RATE_CACHE_TTL):
            return _cached_rate

    tv = get_tv_datafeed()
    if tv is None:
        return _cached_rate if _cached_rate is not None else fallback_rate

    try:
        from tvDatafeed import Interval

        df = tv.get_hist(
            symbol="USDKRW",
            exchange="FX_IDC",
            interval=Interval.in_1_minute,
            n_bars=1,
        )
        if df is not None and not df.empty:
            new_rate = float(df["close"].iloc[-1])
            if new_rate > 0:
                with _rate_cache_lock:
                    _cached_rate = new_rate
                    _cached_rate_time = time.time()
                return new_rate
    except Exception as e:
        print(f"⚠️ [TvDatafeed] USD/KRW 실시간 환율 수집 실패: {e}")

    return _cached_rate if _cached_rate is not None else fallback_rate
