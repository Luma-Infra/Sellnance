# utils.py
import re
from decimal import Decimal, ROUND_HALF_UP


# --- ⭐️ FORMATTING FUNCTIONS ⭐️ ---
def format_market_cap_string(mc):
    if mc is None or mc == 0:
        return "0"
    if mc >= 1_000_000_000_000:
        return f"{mc / 1_000_000_000_000:,.2f} T"
    if mc >= 1_000_000_000:
        return f"{mc / 1_000_000_000:,.2f} B"
    if mc >= 1_000_000:
        return f"{mc / 1_000_000:,.2f} M"
    return f"{mc:,.0f}"


def format_volume_string(vol):
    if vol is None or vol == 0:
        return "0"
    if vol >= 1_000_000_000:
        return f"{vol / 1_000_000_000:,.2f} B"
    if vol >= 1_000_000:
        return f"{vol / 1_000_000:,.2f} M"
    return f"{vol:,.0f}"


def format_volume_krw_string(vol_krw):
    if vol_krw is None or vol_krw == 0:
        return "0"
    if vol_krw >= 1_000_000_000_000:
        return f"{vol_krw / 1_000_000_000_000:,.2f}조"
    if vol_krw >= 100_000_000:
        return f"{vol_krw / 100_000_000:,.0f}억"
    if vol_krw >= 1_000_000:
        return f"{vol_krw / 1_000_000:,.0f}백만"
    return f"{vol_krw:,.0f}"


def js_round(number, decimals=0):
    # 🚀 숫자를 Decimal 객체로 변환
    d = Decimal(str(number))
    # 🚀 사사오입(ROUND_HALF_UP) 적용
    quantize_str = "1" if decimals == 0 else f"1.{'0' * decimals}"
    return float(d.quantize(Decimal(quantize_str), rounding=ROUND_HALF_UP))


# 1. 초기화 단계에서 딱 한 번만 계산 (JavaScript든 Python이든 로직 동일)
def get_precision(tick_size_str):
    """문자열 형태의 틱사이즈에서 소수점 자릿수 추출 (예: "0.0001" -> 4)"""
    if not tick_size_str or "." not in str(tick_size_str):
        return 0
    # 뒤에 붙은 의미 없는 0을 지우고 소수점 아래 길이를 잽니다.
    return len(str(tick_size_str).split(".")[-1].rstrip("0"))


# 2. 포맷팅 함수 (초간단)
def format_dynamic_price(price, precision):
    if price is None or price == 0:
        return

    # 거래소가 준 정밀도(precision) 그대로 사용!
    return f"{price:,.{precision}f}"


# --- ⭐️ UX SETTINGS ⭐️ ---
# ✅ [수정 후] 테마를 지원하는 클린 포맷터
def format_change(percent):
    if percent is None or not isinstance(percent, (int, float)):
        return '<span class="text-theme-text opacity-50">N/A</span>'

    # 🚀 하드코딩 색상 빼고 테마 클래스로 변경!
    theme_class = (
        "text-theme-up"
        if percent > 0
        else "text-theme-down" if percent < 0 else "text-theme-text opacity-50"
    )

    # 🚀 인라인 스타일(font-weight) 대신 Tailwind 클래스로 통일
    weight_class = "font-medium" if abs(percent) >= 5.0 else "font-normal"

    # style="..." 은 완전히 삭제하고 class="..." 만 넘겨줍니다.
    return f'<span class="{theme_class} {weight_class}">{percent:+.2f} %</span>'


def create_image_tag(url):
    if not url:
        return ""
    return f'<img src="{url}" loading="lazy" style="width: 24px; height: 24px; vertical-align: middle; border-radius: 50%;">'


def get_pure_base_asset(ticker):
    # 🚀 mapping.json의 HARDCODE_VERIFY_SKIP_LIST 예외 캐시 조회 시 바로 반환 (스킵 가드)
    if _SKIP_LIST_CACHE and ticker in _SKIP_LIST_CACHE:
        return ticker

    # 1. Quote(결제자산)를 뒤에서부터 안전하게 제거
    # USDT, KRW 외에 다른 마켓이 추가되어도 대응 가능하도록 리스트화
    for quote in ["USDT", "KRW", "BTC", "ETH"]:
        if ticker.endswith(quote):
            # 단, 'BTC', 'ETH' 순수한 티커는 자르면 안되므로 길이 체크 추가
            if len(ticker) > len(quote):
                ticker = ticker[: -len(quote)]
                break

    # 2. 정규식으로 배율과 순수 심볼 분리
    # ^(10+|1[MB])? : 시작부분의 10, 100, 1M, 1B 등을 그룹 캡처
    # (?P<symbol>.+) : 나머지를 전부 'symbol' 그룹으로 캡처
    match = re.match(r"^(?P<scale>10+|1[MB])?(?P<symbol>.+)$", ticker)
    if match:
        return match.group("symbol")
    return ticker


def is_scaled_symbol(symbol):
    return bool(re.match(r"^(10+)|^(1[MB])", symbol))


def get_multiplier(ticker):
    if not ticker:
        return 1
    # Quote 제거 후 스케일 찾기 (예: 1000SHIBUSDT -> 1000SHIB)
    for quote in ["USDT", "KRW", "BTC", "ETH"]:
        if ticker.endswith(quote):
            if len(ticker) > len(quote):
                ticker = ticker[: -len(quote)]
                break
    match = re.match(r"^(?P<scale>10+|1[MB])", ticker, re.IGNORECASE)
    if not match:
        return 1
    p = match.group("scale").upper()
    if p == "1M":
        return 1000000
    if p == "1B":
        return 1000000000
    try:
        return int(p)
    except ValueError:
        return 1


_SKIP_LIST_CACHE: list | None = None


def is_valid_ticker(ticker, skip_list=None):
    """
    영어 대문자, 숫자 이외의 문자가 섞여 있으면 거부합니다.
    (한자, 특수문자, 소문자, 이모지 등 온갖 잡다구리한 쓰레기 티커들 사전에 차단)
    단, HARDCODE_VERIFY_SKIP_LIST에 들어있는 한글/한자/특수문자 티커는 허용합니다.
    """
    global _SKIP_LIST_CACHE
    if skip_list is None:
        if _SKIP_LIST_CACHE is None:
            try:
                from modules import config_manager

                mapping = config_manager.load_mapping_data()
                _SKIP_LIST_CACHE = mapping.get("HARDCODE_VERIFY_SKIP_LIST", [])
            except:
                _SKIP_LIST_CACHE = []
        skip_list = _SKIP_LIST_CACHE

    if skip_list and ticker in skip_list:
        return True

    # ^[A-Z0-9]+$ : 시작부터 끝까지 영어 대문자와 숫자로만 이루어져야 함
    if re.match(r"^[A-Z0-9]+$", ticker):
        return True
    return False
