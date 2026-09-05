import os
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from modules.app import app
from modules.adapter import ExchangeAdapter
from modules.candle_proxy import get_candle_ttl
import config


def test_kimchi_premium_formula():
    """1. 김프 공식 단위 테스트 (정상가, 역프, 0 나누기 방어)"""
    def calc_kimchi(upbit_krw: float, binance_usd: float, ex_rate: float) -> float:
        if binance_usd <= 0 or ex_rate <= 0:
            return 0.0
        binance_krw = binance_usd * ex_rate
        return ((upbit_krw / binance_krw) - 1.0) * 100.0

    # 케이스 1: 정상 김프 (+5.0%)
    # 업비트 105,000 KRW, 바이낸스 100 USD, 환율 1,000 KRW/USD -> 105000 / 100000 = 1.05 -> +5.0%
    assert round(calc_kimchi(105000.0, 100.0, 1000.0), 2) == 5.00

    # 케이스 2: 역프 (-2.0%)
    # 업비트 98,000 KRW, 바이낸스 100 USD, 환율 1,000 KRW/USD -> 98000 / 100000 = 0.98 -> -2.0%
    assert round(calc_kimchi(98000.0, 100.0, 1000.0), 2) == -2.00

    # 케이스 3: 환율 0 또는 바이낸스 가격 0 방어
    assert calc_kimchi(100000.0, 0.0, 1400.0) == 0.0
    assert calc_kimchi(100000.0, 100.0, 0.0) == 0.0


def test_candle_ttl_cache_policy():
    """2. 캔들 TTL 적응형 캐시 수명 테스트"""
    # 과거 캔들 (to 파라미터 지정) -> 600초 고정
    assert get_candle_ttl("1m", to="1680000000") == 600.0
    assert get_candle_ttl("1d", to="2026-01-01") == 600.0

    # 일봉/주봉/월봉 -> 300초
    assert get_candle_ttl("1d") == 300.0
    assert get_candle_ttl("1w") == 300.0
    assert get_candle_ttl("1M") == 300.0

    # 시간봉 -> 180초
    assert get_candle_ttl("1h") == 180.0
    assert get_candle_ttl("4h") == 180.0

    # 15분~30분봉 -> 60초
    assert get_candle_ttl("15m") == 60.0
    assert get_candle_ttl("30m") == 60.0

    # 초단기봉 (1m) -> 기본 15초
    assert get_candle_ttl("1m") == 15.0


def test_upbit_adapter_normalization():
    """3. 업비트 수집기 및 심볼/인터벌 어댑터 단위 테스트"""
    # 심볼 정규화 (KRW- 접두사 보장)
    assert ExchangeAdapter.normalize_symbol("upbit", "BTC") == "KRW-BTC"
    assert ExchangeAdapter.normalize_symbol("upbit", "KRW-ETH") == "KRW-ETH"
    assert ExchangeAdapter.normalize_symbol("upbit", "SOL_KRW") == "KRW-SOL"
    assert ExchangeAdapter.normalize_symbol("upbit", "XRPUSDT") == "KRW-XRP"

    # 캔들 URL 생성
    url = ExchangeAdapter.get_candle_url("upbit", "BTC", "minutes/1", limit=100)
    assert "https://api.upbit.com/v1/candles/minutes/1?market=KRW-BTC&count=100" == url


def test_binance_adapter_normalization():
    """4. 바이낸스 선물/스팟 수집기 및 URL 어댑터 단위 테스트"""
    # 심볼 정규화 (특수문자 제거 대문자)
    assert ExchangeAdapter.normalize_symbol("binance_futures", "BTC-USDT") == "BTCUSDT"
    assert ExchangeAdapter.normalize_symbol("binance_spot", "eth_usdt") == "ETHUSDT"

    # 인터벌 정규화
    assert ExchangeAdapter.normalize_interval("binance_futures", "days") == "1d"
    assert ExchangeAdapter.normalize_interval("binance_spot", "minutes/15") == "15m"

    # 캔들 URL 생성
    futures_url = ExchangeAdapter.get_candle_url("binance_futures", "BTCUSDT", "15m", limit=50)
    assert "https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=50" == futures_url

    spot_url = ExchangeAdapter.get_candle_url("binance_spot", "ETHUSDT", "1d", limit=100)
    assert "https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d&limit=100" == spot_url


def test_security_cmc_key_isolation_and_endpoints():
    """5. 보안: CMC 키 클라이언트 노출 차단 및 설정 엔드포인트 검증"""
    client = TestClient(app)

    # 1) /api/settings 호출 시 평문 CMC_API_KEY가 노출되지 않는지 확인
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert data.get("CMC_API_KEY") == ""
    assert "has_cmc_key" in data

    # 2) 제거된 /api/get-env-key 호출 시 404 확인 (키 평문 반환 차단)
    res_env = client.get("/api/get-env-key")
    assert res_env.status_code == 404


def test_mapping_json_integrity_and_safeguards():
    """6. 족보(mapping.json) 무결성 및 증발 방어 세이프가드 테스트"""
    from modules import config_manager
    import json

    # 1) mapping.json 파일 로드 검증
    mapping_data = config_manager.load_mapping_data()
    assert isinstance(mapping_data, dict), "mapping_data는 dict 형식이어야 합니다."
    assert "TICKER_DATA" in mapping_data, "TICKER_DATA 필수 키가 누락되었습니다."
    assert "DUPLICATED_LIST" in mapping_data, "DUPLICATED_LIST 필수 키가 누락되었습니다."
    assert "DEFAULT_KRW_USD_RATE" in mapping_data, "DEFAULT_KRW_USD_RATE 환율 키가 누락되었습니다."

    ticker_data = mapping_data.get("TICKER_DATA", {})
    dup_list = mapping_data.get("DUPLICATED_LIST", {})

    # 전체 매핑된 코인 수량 검증 (최소 500개 이상)
    assert len(ticker_data) >= 500, f"TICKER_DATA 개수({len(ticker_data)})가 비정상적으로 적습니다."
    assert len(dup_list) >= 10, f"DUPLICATED_LIST 개수({len(dup_list)})가 비정상적으로 적습니다."

    # 2) 대표 메이저 코인(BTC, ETH, SOL) 족보 구조 검증 ([cmc_id, logo, name, symbol, type])
    assert "BTC" in ticker_data, "BTC 족보가 누락되었습니다."
    btc_entry = ticker_data["BTC"]
    assert isinstance(btc_entry, list), "TICKER_DATA 항목은 리스트 형태여야 합니다."
    assert btc_entry[0] == "1", f"BTC의 CMC ID는 '1'이어야 합니다. (현재: {btc_entry[0]})"
    assert btc_entry[2] == "Bitcoin", "BTC 코인명이 올바르지 않습니다."

    assert "ETH" in ticker_data, "ETH 족보가 누락되었습니다."
    eth_entry = ticker_data["ETH"]
    assert eth_entry[0] == "1027", f"ETH의 CMC ID는 '1027'이어야 합니다. (현재: {eth_entry[0]})"
    assert eth_entry[2] == "Ethereum", "ETH 코인명이 올바르지 않습니다."

    # 3) 데이터 증발 방어막(Critical Safeguard) 검증: 빈 데이터 덮어쓰기 시도 차단
    corrupt_data = {"TICKER_DATA": {}, "DUPLICATED_LIST": {}}
    save_result = config_manager.save_mapping_data(corrupt_data)
    assert save_result is False, "비어있는 비정상 족보 저장은 차단되어야 합니다."

