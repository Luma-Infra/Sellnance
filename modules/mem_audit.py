# modules/mem_audit.py
"""
[독립 메모리 감사 데몬 스레드]
- 1시간 주기 절대시간 매시 30분 정각(:30 KST)에 프로세스 RSS 및 주요 객체/캐시 델타 감사 로그 출력
- 리눅스(/proc/self/status) 및 윈도우(psapi) 범용 지원 (외부 패키지 의존 및 메모리 오버헤드 최소화)
- 기존 스케줄러와 완전 격리된 별도 데몬 스레드로 무중단 운용
"""
import os
import sys
import gc
import time
import pytz
import threading
from datetime import datetime, timedelta

KST = pytz.timezone("Asia/Seoul")

_AUDIT_STARTED = False
_AUDIT_LOCK = threading.Lock()


def get_seconds_until_next_half_hour() -> float:
    """다음 매시 30분 정각(:30:00 KST)까지 남은 초 계산"""
    now = datetime.now(KST)
    target = now.replace(minute=30, second=0, microsecond=0)
    if now >= target:
        target += timedelta(hours=1)
    return max(1.0, (target - now).total_seconds())


def get_process_rss_mb() -> float:
    """OS 프로세스 물리 메모리(RSS MB) 측정 (Windows/Linux 범용, 외부 패키지 불필요)"""
    # 1. Linux (/proc/self/status - Railway 프로덕션)
    try:
        if os.path.exists("/proc/self/status"):
            with open("/proc/self/status", "r") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        return round(float(line.split()[1]) / 1024.0, 2)
    except Exception:
        pass

    # 2. Windows (ctypes GetProcessMemoryInfo - 로컬 개발)
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                ]

            ctypes.windll.psapi.GetProcessMemoryInfo.argtypes = [
                wintypes.HANDLE,
                ctypes.POINTER(PROCESS_MEMORY_COUNTERS),
                wintypes.DWORD,
            ]
            ctypes.windll.psapi.GetProcessMemoryInfo.restype = wintypes.BOOL

            counters = PROCESS_MEMORY_COUNTERS()
            counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS)
            handle = ctypes.windll.kernel32.GetCurrentProcess()
            if ctypes.windll.psapi.GetProcessMemoryInfo(
                handle, ctypes.byref(counters), counters.cb
            ):
                return round(counters.WorkingSetSize / (1024.0 * 1024.0), 2)
        except Exception:
            pass

    return 0.0


def start_hourly_memory_audit():
    """
    1시간 주기 절대시간 :30분 독립 메모리 감사 데몬 스레드 가동
    """
    global _AUDIT_STARTED
    with _AUDIT_LOCK:
        if _AUDIT_STARTED:
            return
        _AUDIT_STARTED = True

    from . import api_manager
    from . import candle_proxy

    def run():
        time.sleep(5)  # 서버 부팅 직후 5초 대기 후 초기 베이스라인 1회 로깅
        prev_rss = get_process_rss_mb()
        prev_counts = {}
        for obj in gc.get_objects():
            t = type(obj)
            if t in (dict, list, set):
                prev_counts[t.__name__] = prev_counts.get(t.__name__, 0) + 1

        now_str = datetime.now(KST).strftime("%H:%M:%S")
        print(
            f"📊 [MEM AUDIT BASELINE {now_str}] 초기 프로세스 RAM: {prev_rss:.1f} MB (독립 감사 데몬 가동 완료)"
        )

        while True:
            try:
                sleep_sec = get_seconds_until_next_half_hour()
                time.sleep(sleep_sec)

                now = datetime.now(KST)
                time_str = now.strftime("%H:%M")
                curr_rss = get_process_rss_mb()
                diff_rss = curr_rss - prev_rss

                # 힙 주요 컨테이너 개수 집계 (순수 순회)
                curr_counts = {}
                for obj in gc.get_objects():
                    t = type(obj)
                    if t in (dict, list, set):
                        curr_counts[t.__name__] = (
                            curr_counts.get(t.__name__, 0) + 1
                        )

                diff_list = (
                    curr_counts.get("list", 0) - prev_counts.get("list", 0)
                )
                diff_dict = (
                    curr_counts.get("dict", 0) - prev_counts.get("dict", 0)
                )
                diff_set = curr_counts.get("set", 0) - prev_counts.get("set", 0)

                # 전역 캐시 현황
                candle_cache_cnt = len(getattr(candle_proxy, "CANDLE_CACHE", {}))
                gap_cache_cnt = len(getattr(candle_proxy, "TV_GAP_CACHE", {}))
                global_cache_data = getattr(
                    api_manager, "GLOBAL_CACHE", {}
                ).get("data", [])
                coin_cnt = (
                    len(global_cache_data)
                    if isinstance(global_cache_data, list)
                    else 0
                )

                rss_sign = "+" if diff_rss >= 0 else ""
                list_sign = "+" if diff_list >= 0 else ""
                dict_sign = "+" if diff_dict >= 0 else ""
                set_sign = "+" if diff_set >= 0 else ""

                print(
                    f"\n{'='*22} 📊 [HOURLY MEMORY AUDIT {time_str} KST] {'='*22}\n"
                    f"  • Process RSS  : {curr_rss:.1f} MB ({rss_sign}{diff_rss:.1f} MB/hr)\n"
                    f"  • Candle Cache : {candle_cache_cnt} items | Gap Cache: {gap_cache_cnt} items\n"
                    f"  • Global Cache : {coin_cnt} coins\n"
                    f"  • Heap Objects : list={curr_counts.get('list',0)} ({list_sign}{diff_list}), "
                    f"dict={curr_counts.get('dict',0)} ({dict_sign}{diff_dict}), "
                    f"set={curr_counts.get('set',0)} ({set_sign}{diff_set})\n"
                    f"{'='*68}\n"
                )

                # 기준 갱신
                prev_rss = curr_rss
                prev_counts = curr_counts

            except Exception as e:
                print(f"⚠️ [MEM AUDIT ERROR] {e}")
                time.sleep(60)

    threading.Thread(
        target=run, daemon=True, name="HourlyMemoryAuditThread"
    ).start()
