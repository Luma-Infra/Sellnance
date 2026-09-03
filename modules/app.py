# app.py
from starlette.middleware.gzip import GZipMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from tvDatafeed import TvDatafeed, Interval
from fastapi import FastAPI, Request, Body
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
import pandas as pd
import webbrowser
import threading
import requests
import aiohttp
import hashlib
import asyncio
import pytz
import json
import time
import sys
import io
import os
import re

# Windows 환경 콘솔 이모지 인코딩 보호
if sys.platform == "win32":
    try:
        if isinstance(sys.stdout, io.TextIOWrapper):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if isinstance(sys.stderr, io.TextIOWrapper):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import config  # 🚀 설정 모듈 임포트

# 🚀 [표준 로깅 시스템] KST 타임스탬프 로거 및 안전한 print 브릿지
import builtins
from .logger import logger
from . import utils

_orig_print = builtins.print


def safe_print(*args, **kwargs):
    # 특수 출력(file 지정, end 지정 등)은 원본 print를 유지하여 타 라이브러리/프로그레스바 간섭 방지
    if kwargs.get("file") is not None or kwargs.get("end", "\n") != "\n":
        _orig_print(*args, **kwargs)
        return
    msg = " ".join(str(a) for a in args)
    logger.info(msg)


builtins.print = safe_print

from . import trace_hooking
from . import api_manager
from . import config_manager
from .adapter import ExchangeAdapter  # 🔌 통합 지휘소 영입
from .candle_proxy import (
    fetch_candles_guarded,
)  # 🛡️ 캔들 3중 방어 엔진 (세마포어/합승/캐시)

# 🚀 터미널 인코딩은 환경변수(PYTHONIOENCODING)로 처리합니다.


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ⧆️ 9시 정각 감시 스레드 시작
    threading.Thread(target=auto_reset_scheduler, daemon=True).start()

    # ⧆️ 데이터 긁어오기 (이건 배포든 로칼이든 필수!)
    threading.Thread(target=api_manager.get_cached_data, args=(True,)).start()

    # 🚀 상장일 데이터 시스템 초기화 (LISTING_DATES 메모리 로드 + 바이낸스 API 콜)
    threading.Thread(target=_init_listing_dates, daemon=True).start()

    # 🚀 로칼(127.0.0.1) 환경이고, 아직 브라우저 안 열었을 때만 실행
    if not os.environ.get("RAILWAY_STATIC_URL") and not os.environ.get(
        "BROWSER_OPENED"
    ):
        threading.Timer(1.5, open_browser).start()
        os.environ["BROWSER_OPENED"] = "1"

    yield


app = FastAPI(title="Blueprint Terminal", lifespan=lifespan)

# 🚀 유저 동시 접속 대비 10배 네트워크 압축 (2.5MB -> 250KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🚀 모든 도메인(폰 포함) 허용!
    allow_credentials=True,
    allow_methods=["*"],  # 🚀 GET, POST 등 모든 방식 허용!
    allow_headers=["*"],  # 🚀 모든 헤더 허용!
)

BASE_DIR = Path(__file__).resolve().parent.parent

# 🚀 Vite 빌드본(dist/) 우선 서빙 및 개발 모드 폴백 하이브리드 엔진
DIST_DIR = BASE_DIR / "dist"
IS_PRODUCTION = bool(
    os.environ.get("RAILWAY_STATIC_URL") or os.environ.get("RAILWAY_ENVIRONMENT")
)

if IS_PRODUCTION and DIST_DIR.exists():
    print("🚀 [ENV] Production (Railway) - Serving from /dist")
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")
    STATIC_DIR = BASE_DIR / "static"
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    templates = Jinja2Templates(directory=str(DIST_DIR))
else:
    print("🛠️ [ENV] Local Dev - Serving raw templates/ and static/")
    STATIC_DIR = BASE_DIR / "static"
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


# =================================================
# 📅 상장일(Listing Date) 데이터 시스템 — listing.json 독립 파일 운용
# =================================================
LISTING_FILE = BASE_DIR / "listing.json"
LISTING_DATES: dict = {}
_listing_dates_lock = threading.Lock()


def _load_listing_file() -> dict:
    """listing.json 읽기. 없으면 빈 dict 반환."""
    try:
        if LISTING_FILE.exists():
            with open(LISTING_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print(f"🚨 [LISTING] listing.json 읽기 실패: {e}")
    return {}


def _save_listing_file(data: dict):
    """listing.json 쓰기 (알파벳 정렬 및 원자적 저장)."""
    try:
        utils.atomic_save_json(
            LISTING_FILE,
            dict(sorted(data.items())),
            indent=2,
            ensure_ascii=False,
        )
    except Exception as e:
        print(f"🚨 [LISTING] listing.json 저장 실패: {e}")


def _init_listing_dates():
    """1. listing.json 로드 → 메모리 초기화. 2. 바이낸스 선물 API (신규 코인만)."""
    global LISTING_DATES
    saved = _load_listing_file()
    with _listing_dates_lock:
        LISTING_DATES.update(saved)
    print(f"📅 [LISTING] listing.json에서 {len(saved)}개 상장일 로드")

    # 🚀 [비활성화] 요금 절감 및 기동 시간 최적화를 위해 바이낸스 API 호출 주석 처리
    # try:
    #     res = requests.get("https://fapi.binance.com/fapi/v1/exchangeInfo", timeout=10)
    #     res.raise_for_status()
    #     symbols_info = res.json().get("symbols", [])
    #     updated = 0
    #     dirty = False
    #     for s in symbols_info:
    #         if s.get("quoteAsset") != "USDT" or s.get("contractType") != "PERPETUAL":
    #             continue
    #         base = s.get("baseAsset", "").upper()
    #         ts_ms = s.get("onboardDate", 0)
    #         if not base or not ts_ms:
    #             continue
    #         date_str = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
    #         with _listing_dates_lock:
    #             entry = LISTING_DATES.setdefault(base, {})
    #             if "binance_listing" not in entry:
    #                 entry["binance_listing"] = date_str
    #                 dirty = True
    #                 updated += 1
    #     if dirty:
    #         with _listing_dates_lock:
    #             _save_listing_file(dict(LISTING_DATES))
    #         print(f"📅 [LISTING] 바이낸스 선물 onboardDate {updated}개 신규 저장 → listing.json")
    #     else:
    #         print("📅 [LISTING] 바이낸스 상장일 전체 이미 저장됨 - API 스킵")
    # except Exception as e:
    #     print(f"🚨 [LISTING] 바이낸스 exchangeInfo 호출 실패: {e}")


@app.get("/api/listing-dates")
def get_listing_dates():
    """LISTING_DATES 메모리 전체 반환 (Frontend 초기화 시 1회)"""
    with _listing_dates_lock:
        return dict(LISTING_DATES)


@app.post("/api/listing-dates")
def update_listing_date(data: dict = Body(...)):
    """업비트/빗썸 등 캔들 역산 날짜 업데이트.
    body: { symbol: "BTC", exchange_key: "upbit_listing", date: "2017-10-15" }
    - 더 오래된 날짜만 덮어쓰기.
    """
    symbol = data.get("symbol", "").upper().strip()
    exchange_key = data.get("exchange_key", "").strip()
    new_date = data.get("date", "").strip()

    if not symbol or not exchange_key or not new_date:
        return {"status": "error", "msg": "symbol, exchange_key, date 필수"}
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", new_date):
        return {"status": "error", "msg": "date 포맷은 YYYY-MM-DD"}

    updated = False
    with _listing_dates_lock:
        entry = LISTING_DATES.setdefault(symbol, {})
        existing = entry.get(exchange_key, "")
        if not existing or new_date < existing:
            entry[exchange_key] = new_date
            updated = True

    if updated:
        with _listing_dates_lock:
            _save_listing_file(dict(LISTING_DATES))
        return {
            "status": "updated",
            "symbol": symbol,
            "key": exchange_key,
            "date": new_date,
        }
    return {"status": "skipped"}


@app.get("/.well-known/appspecific/com.chrome.devtools.json")
def chrome_devtools_dummy():
    """Chrome DevTools F12 404 콘솔 로그 방어용 더미 핸들러"""
    return {}


@app.get("/")
async def home(request: Request):
    # 뼈대만 렌더링하고 데이터는 AJAX로 그림
    return templates.TemplateResponse(request=request, name="index.html")


load_dotenv()


@app.get("/api/get-env-key")
def get_env_cmc_key():
    """서버 환경변수에 설정된 CMC_API_KEY의 존재 여부만 반환합니다 (보안 유출 방지)."""
    env_key = os.environ.get("CMC_API_KEY", "")
    return {"exists": env_key != ""}


# 👥 초경량 접속자 세션 트래커 (서버 메모리 상에 상주)
ACTIVE_SESSIONS = {}  # { "ip_address": timestamp }
SESSION_LOCK = threading.Lock()


def track_user_session(request: Request):
    """요청자 IP를 기반으로 최근 30초 내에 활동한 세션 수를 카운트합니다."""
    # 프록시(Cloudflare, Railway 등)를 거친 경우 원래 IP 획득 시도
    client_ip = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else "unknown"
    )
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    now = time.time()
    with SESSION_LOCK:
        ACTIVE_SESSIONS[client_ip] = now
        # 30초 이상 지난 세션 제거
        expired = [ip for ip, t in ACTIVE_SESSIONS.items() if now - t > 30]
        for ip in expired:
            del ACTIVE_SESSIONS[ip]
        return len(ACTIVE_SESSIONS)


# ⭐️ async 삭제됨!
@app.get("/api/market-data")
def get_market_data(request: Request, force: bool = False):
    """프론트엔드의 표(Table)를 그리기 위한 데이터를 JSON으로 반환합니다."""
    # 🚀 [CMC API 키 Stateless 동기화] 클라이언트 헤더에 전달된 키가 있으면 메모리에 반영
    cmc_key = request.headers.get("X-CMC-API-KEY")

    user_count = track_user_session(request)
    data, last_updated = api_manager.get_cached_data(
        force_reload=force, user_api_key=cmc_key
    )

    # 쿨타임 타이머용 raw 타임스탬프 획득
    if cmc_key and cmc_key.strip() != "":
        key_hash = hashlib.sha256(cmc_key.strip().encode()).hexdigest()
        user_cache = api_manager.USER_CMC_CACHES.get(key_hash, {})
        cache_timestamp = user_cache.get("timestamp", datetime.min)
    else:
        cache_timestamp = api_manager.GLOBAL_CACHE.get("timestamp", datetime.min)

    # 🚀 [FIX] datetime.min일 때 mktime 오버플로우 방지 가드
    if cache_timestamp == datetime.min:
        raw_ts = 0.0
    else:
        # timezone-aware 대응
        if cache_timestamp.tzinfo is not None:
            raw_ts = cache_timestamp.timestamp()
        else:
            raw_ts = time.mktime(cache_timestamp.timetuple())

    return {
        "data": data,
        "last_updated": last_updated,
        "last_updated_raw": raw_ts,
        "active_users": user_count,
    }


@app.get("/api/market-data-silent")
def get_market_data_silent(request: Request):
    """🚀 [캐시 즉시 반환] 유저 요청 시 수집 없이 GLOBAL_CACHE만 뿌림.
    수집은 서버 자체 15분 백그라운드 스케줄러가 전담 (유저 500명 와도 수집 0번).
    """
    cmc_key = request.headers.get("X-CMC-API-KEY")
    user_count = track_user_session(request)

    if cmc_key and cmc_key.strip() != "":
        # 유저 키가 있는 경우 유저 개별 캐싱 데이터를 15분 쿨타임에 맞춰 반환
        data, last_updated = api_manager.get_cached_data(
            force_reload=False, silent_mode=True, user_api_key=cmc_key
        )
        key_hash = hashlib.sha256(cmc_key.strip().encode()).hexdigest()
        user_cache = api_manager.USER_CMC_CACHES.get(key_hash, {})
        cache_timestamp = user_cache.get("timestamp", datetime.min)
    else:
        data = api_manager.GLOBAL_CACHE.get("data", [])
        last_updated = api_manager.GLOBAL_CACHE.get("last_updated_str", "")
        cache_timestamp = api_manager.GLOBAL_CACHE.get("timestamp", datetime.min)

    # 🚀 [FIX] datetime.min일 때 mktime 오버플로우 방지 가드
    if cache_timestamp == datetime.min:
        raw_ts = 0.0
    else:
        if cache_timestamp.tzinfo is not None:
            raw_ts = cache_timestamp.timestamp()
        else:
            raw_ts = time.mktime(cache_timestamp.timetuple())

    if isinstance(data, dict):
        data = list(data.values())
    return {
        "data": data,
        "last_updated": last_updated,
        "last_updated_raw": raw_ts,
        "active_users": user_count,
    }


# app.py 내부 라우터 교체
@app.get("/api/market-map")
def get_market_map():
    """🚨 생짜 API 호출 삭제! 중앙 캐시에서 0.01초 만에 뽑아옵니다."""
    try:
        # 중앙 통제소에서 데이터 가져오기 (force=False 라서 크레딧 소모 0)
        cached_data, _ = api_manager.get_cached_data(force_reload=False)

        # 조립된 데이터 안에서 슥슥 뽑아내기만 하면 끝!
        upbit = [c["Symbol"] for c in cached_data if c.get("Upbit") == "O"]
        futures = [
            c["Symbol"]
            for c in cached_data
            if "BINANCE_FUTURES" in c.get("Listed_Exchanges", [])
        ]
        spot = [
            c["Symbol"]
            for c in cached_data
            if "BINANCE" in c.get("Listed_Exchanges", [])
        ]
        bithumb = [
            c["Symbol"]
            for c in cached_data
            if "BITHUMB" in c.get("Listed_Exchanges", [])
        ]
        all_assets = list(set(upbit + futures + spot + bithumb))
        fallback_rate = (
            float(api_manager.MAPPING_DATA.get("DEFAULT_KRW_USD_RATE", 0.0))
            if api_manager.MAPPING_DATA
            else 0.0
        )
        krw_usd_rate = (
            cached_data[0].get("krw_usd_rate", fallback_rate)
            if cached_data
            else fallback_rate
        )
        past_gap_map = (
            api_manager.MAPPING_DATA.get("PAST_GAP_RECOVERY_MAP", {})
            if api_manager.MAPPING_DATA
            else {}
        )
        duplicated_list = (
            api_manager.MAPPING_DATA.get("DUPLICATED_LIST", {})
            if api_manager.MAPPING_DATA
            else {}
        )

        return {
            "all_assets": all_assets,
            "upbit": upbit,
            "futures": futures,
            "spot": spot,
            "bithumb": bithumb,
            "krw_usd_rate": krw_usd_rate,
            "past_gap_map": past_gap_map,
            "duplicated_list": duplicated_list,
        }
    except Exception as e:
        return {"error": str(e)}


# ⭐️ async 삭제됨!
@app.get("/api/coin-info/{asset}")
def get_coin_info(asset: str):
    """캐시된 데이터에서 코인 정보를 찾아 반환합니다. (CMC 호출 안 함 = 크레딧 0원)"""
    try:
        # 🚀 접두사(BINANCE: 등) 및 접미사(_FUTURES, _SPOT 등) 정규화
        clean_asset = (
            asset.split(":")[-1]
            .replace("_FUTURES", "")
            .replace("_SPOT", "")
            .replace("_UPBIT", "")
            .replace("_BITHUMB", "")
            .strip()
            .upper()
        )
        clean_base = (
            clean_asset[:-4]
            if clean_asset.endswith("USDT")
            else (clean_asset[:-3] if clean_asset.endswith("KRW") else clean_asset)
        )

        cached_data, _ = api_manager.get_cached_data(force_reload=False)

        # 캐시된 800개 리스트 중에서 코인을 찾습니다
        for coin in cached_data:
            c_sym = str(coin.get("Symbol", "")).upper()
            c_dt = str(coin.get("DisplayTicker", "")).upper()
            c_t = str(coin.get("Ticker", "")).upper()

            if (
                c_sym == clean_asset
                or c_dt == clean_asset
                or c_t == clean_asset
                or c_sym == clean_base
                or c_dt == clean_base
                or c_t == clean_base
            ):
                return {
                    "asset": coin.get("DisplayTicker", coin.get("Symbol", clean_base)),
                    "symbol": coin.get("Symbol", clean_base),
                    "name": coin.get("Name", clean_base),
                    "market_cap": coin.get("MarketCap_Formatted", "정보 없음"),
                }

        # 캐시에 없으면 (신규 상장 등)
        return {
            "asset": clean_base,
            "symbol": clean_base.split("(")[0],
            "name": clean_base,
            "market_cap": "정보 없음",
        }
    except Exception as e:
        return {"asset": asset, "name": asset, "market_cap": "조회 실패"}


@app.get("/api/candles")
async def get_proxy_candles(
    exchange: str,
    symbol: str,
    interval: str,
    limit: int = 200,
    to: str = "",
    start: str = "",
):
    """중앙 통제된 candle_proxy 모듈(세마포어 20 + Single-Flight 합승 + 30초 LRU 캐시)을 통해 통합 조회"""
    return await fetch_candles_guarded(exchange, symbol, interval, limit, to, start)


# 🚀 메모리 캐시 변수 추가
app.state.tv_gap_cache = {}
app.state.usdkrw_cache = None


@app.get("/api/usdkrw")
def get_usdkrw_history():
    """과거 FX 환율 디스크 캐시(usdkrw_cache.json) + 오늘 실시간 환율 하이브리드 병합"""
    try:
        cache_path = Path("usdkrw_cache.json")

        history_map = None

        # 1. 메모리 캐시 확인
        if app.state.usdkrw_cache is not None:
            history_map = app.state.usdkrw_cache

        # 2. 디스크 파일 캐시 로드 (서버 재시작 시 0ms 즉시 복원)
        if history_map is None and cache_path.exists():
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    history_map = json.load(f)
                    app.state.usdkrw_cache = history_map
                    print(
                        f"⚡ [환율 캐시] 디스크에서 {len(history_map)}일치 과거 환율 즉시 로드 (0ms)"
                    )
            except Exception as e:
                print(f"⚠️ [환율 캐시] 디스크 로드 실패, 재생성 진행: {e}")

        # 3. 디스크에도 없으면 트레이딩뷰에서 1회 수집 후 디스크 영구 보관
        if history_map is None:
            try:
                tv = TvDatafeed()
                df_fx = tv.get_hist(
                    symbol="USDKRW",
                    exchange="FX_IDC",
                    interval=Interval.in_daily,
                    n_bars=5000,
                )

                raw_map = {}
                if df_fx is not None and not df_fx.empty:
                    for date, row in df_fx.iterrows():
                        dt = pd.to_datetime(str(date))
                        ts = int(
                            datetime(
                                dt.year, dt.month, dt.day, tzinfo=pytz.UTC
                            ).timestamp()
                        )
                        raw_map[ts] = float(row["close"])

                if raw_map:
                    sorted_ts = sorted(raw_map.keys())
                    min_ts, max_ts = sorted_ts[0], sorted_ts[-1]

                    history_map = {}
                    curr_ts = min_ts
                    day_sec = 86400

                    while curr_ts <= max_ts:
                        if curr_ts in raw_map:
                            history_map[str(curr_ts)] = raw_map[curr_ts]
                        else:
                            prev_ts = max(
                                [ts for ts in sorted_ts if ts < curr_ts], default=None
                            )
                            if prev_ts:
                                history_map[str(curr_ts)] = raw_map[prev_ts]
                            else:
                                next_ts = min(
                                    [ts for ts in sorted_ts if ts > curr_ts],
                                    default=None,
                                )
                                if next_ts:
                                    history_map[str(curr_ts)] = raw_map[next_ts]
                        curr_ts += day_sec

                    # 디스크에 영구 원자적 저장
                    utils.atomic_save_json(cache_path, history_map)
                    print(
                        f"💾 [환율 캐시] {len(history_map)}일치 과거 환율 디스크 파일 영구 저장 완료!"
                    )
                    app.state.usdkrw_cache = history_map
            except Exception as e:
                print(f"⚠️ [환율 엔진] 트뷰 수집 실패: {e}")

        if not history_map:
            return {"error": "환율 데이터를 수집하지 못했습니다."}

        # 4. 🚀 [하이브리드 결합] 오늘 실시간 최신 환율을 마지막 타임라인에 덧붙임
        try:
            cached_data = api_manager.GLOBAL_CACHE.get("data", [])
            fallback_rate = (
                float(api_manager.MAPPING_DATA.get("DEFAULT_KRW_USD_RATE", 0.0))
                if api_manager.MAPPING_DATA
                else 0.0
            )
            live_rate = (
                cached_data[0].get("krw_usd_rate", fallback_rate)
                if cached_data
                else fallback_rate
            )
            if live_rate and float(live_rate) > 0:
                today_ts = int(
                    datetime.now(pytz.UTC)
                    .replace(hour=0, minute=0, second=0, microsecond=0)
                    .timestamp()
                )
                history_map[str(today_ts)] = float(live_rate)
        except Exception:
            pass

        return history_map

    except Exception as e:
        print(f"🚨 환율 보간 엔진 에러: {e}")
        return {"error": str(e)}


@app.get("/api/settings")
def get_settings():
    return {"CMC_API_KEY": config.CMC_API_KEY, "THEME": "BINANCE"}  # 기본값


@app.post("/api/settings")
def update_settings(data: dict = Body(...)):
    if "CMC_API_KEY" in data:
        config.set_cmc_api_key(data["CMC_API_KEY"])
    return {"status": "success"}


# 서버 시작 시 브라우저 자동 실행 (기존 로직 유지)
def open_browser():
    webbrowser.open("http://127.0.0.1:8000")


def auto_reset_scheduler():
    while True:
        kst = pytz.timezone("Asia/Seoul")
        now_kst = datetime.now(kst)

        # 9시 0분 0초 ~ 30초 사이에만 한 번 트리거
        if now_kst.hour == 9 and now_kst.minute == 0 and now_kst.second < 30:
            print("⏰ 스케줄러: 9시 정각입니다. 캐시를 갱신합니다.")
            api_manager.get_cached_data(force_reload=True)
            time.sleep(30)  # 중복 실행 방지용 휴식

        time.sleep(10)  # 10초마다 시계 확인


@app.get("/api/progress")
async def progress_stream():
    """프론트엔드에 현재 진행 상황을 실시간으로 쏴주는 빨대"""

    async def event_generator():
        while True:
            # trace_hooking에 있는 status_list와 PHASES를 가져옴
            data = {
                "phases": trace_hooking.PHASES,
                "status": trace_hooking.status_list,
                "percent": int(
                    (
                        trace_hooking.status_list.count("완료!!")
                        / len(trace_hooking.PHASES)
                    )
                    * 100
                ),
            }
            yield f"data: {json.dumps(data)}\n\n"

            # 모든 단계가 완료되면 중단하거나 계속 대기
            if data["percent"] == 100:
                break
            await asyncio.sleep(0.5)  # 0.5초마다 업데이트

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# 🚀 [SPA HTML5 History 라우트] /BTC, /SKRUSDT 등 깔끔한 URL 직접 접근 지원
@app.get("/{symbol_path}")
async def dynamic_symbol_route(request: Request, symbol_path: str):
    # 정적 디렉토리 및 예약어 제외
    reserved = [
        "api",
        "static",
        "assets",
        "favicon.ico",
        "robots.txt",
        "sw.js",
        "manifest.json",
        "openapi.json",
        "docs",
        "redoc",
    ]
    if symbol_path.lower() in reserved:
        return {"error": "Not Found"}
    return templates.TemplateResponse(request=request, name="index.html")
