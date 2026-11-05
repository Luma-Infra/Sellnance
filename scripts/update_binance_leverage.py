"""
scripts/update_binance_leverage.py
바이낸스 선물(Binance Futures) 전용 레버리지 브래킷 수집기
공식 API(/fapi/v1/leverageBracket)를 호출하여 최신 레버리지(급등락 삭감치 포함)를 
static/binance_leverage.json으로 저장합니다. (타 거래소 폴백 없음)
"""
import os
import sys
import json
import time
import hmac
import hashlib
import urllib.request
import urllib.parse

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

STATIC_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "binance_leverage.json")

def load_env():
    env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    env = {}
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("'\"")
    return env

def fetch_from_binance_futures(api_key, api_secret):
    print("🌐 바이낸스 선물 거래 정보(exchangeInfo) 및 서버 시간 조회 중...")
    
    # 1. 서버 시간 동기화 (로컬 시계 오차로 인한 -1021 에러 방지)
    try:
        time_res = json.loads(urllib.request.urlopen("https://fapi.binance.com/fapi/v1/time", timeout=5).read().decode("utf-8"))
        timestamp = time_res.get("serverTime", int(time.time() * 1000))
    except Exception:
        timestamp = int(time.time() * 1000)

    # 2. 현재 실제 거래 중(TRADING)인 활성 무기한 선물 심볼 목록 수집
    active_symbols = set()
    base_to_sym = {}
    try:
        ex_req = urllib.request.Request("https://fapi.binance.com/fapi/v1/exchangeInfo", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(ex_req, timeout=10) as resp:
            ex_data = json.loads(resp.read().decode("utf-8"))
            for s in ex_data.get("symbols", []):
                if s.get("status") == "TRADING":
                    sym = s.get("symbol", "")
                    active_symbols.add(sym)
                    base = s.get("baseAsset", "")
                    if base:
                        base_to_sym[base] = sym
    except Exception as e:
        print(f"⚠️ exchangeInfo 조회 실패, 전체 브래킷으로 폴백: {e}")

    print("🔑 바이낸스 선물 공식 API (/fapi/v1/leverageBracket) 호출 중...")
    url = "https://fapi.binance.com/fapi/v1/leverageBracket"
    query_string = f"timestamp={timestamp}&recvWindow=10000"
    signature = hmac.new(api_secret.encode("utf-8"), query_string.encode("utf-8"), hashlib.sha256).hexdigest()
    full_url = f"{url}?{query_string}&signature={signature}"
    
    req = urllib.request.Request(full_url, headers={
        "X-MBX-APIKEY": api_key,
        "User-Agent": "Mozilla/5.0"
    })
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    lev_map = {}
    
    # [1단계] 활성 거래 중인 정규 USDT/USDC 마켓 우선 수집
    for item in data:
        sym = item.get("symbol", "")
        # 활성 심볼 목록이 있다면 비활성/폐지 마켓 제외
        if active_symbols and sym not in active_symbols:
            continue
            
        brackets = item.get("brackets", [])
        if brackets:
            max_lev = int(brackets[0].get("initialLeverage", 20))
            lev_map[sym] = max_lev
            clean_sym = sym.replace("USDT", "").replace("USDC", "").replace("BUSD", "")
            
            # USDT 마켓이 우선권을 가지도록 매핑
            if clean_sym not in lev_map or sym.endswith("USDT"):
                lev_map[clean_sym] = max_lev
                
            # 1000PEPE -> PEPE, 1000000MOG -> MOG 등 프리픽스 티커 매핑
            if clean_sym.startswith("1000"):
                lev_map[clean_sym[4:]] = max_lev
            elif clean_sym.startswith("1000000"):
                lev_map[clean_sym[7:]] = max_lev

    # [2단계] mapping.json의 DUPLICATED_LIST 기반 선물 티커 <-> 현물/표준 티커 동적 연동 (하드코딩 제거)
    mapping_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mapping.json")
    if os.path.exists(mapping_path):
        try:
            with open(mapping_path, "r", encoding="utf-8") as f:
                mapping_data = json.load(f)
            dup_list = mapping_data.get("DUPLICATED_LIST", {})
            
            # UID별로 binance_futures 티커와 현물/표준 티커 그룹화
            uid_to_fut = {}
            uid_to_spots = {}
            for k, v in dup_list.items():
                if isinstance(v, list) and len(v) >= 4:
                    uid = str(v[0])
                    ex_ticker = str(v[2]).upper()
                    ex_name = str(v[3]).lower()
                    if "binance_futures" in ex_name:
                        uid_to_fut[uid] = ex_ticker
                    else:
                        base_tick = k.split("(")[0].upper()
                        uid_to_spots.setdefault(uid, set()).add(ex_ticker)
                        uid_to_spots[uid].add(base_tick)
            
            for uid, fut_tick in uid_to_fut.items():
                fut_lev = lev_map.get(fut_tick) or lev_map.get(f"{fut_tick}USDT")
                if fut_lev:
                    for spot_tick in uid_to_spots.get(uid, []):
                        if spot_tick not in lev_map:
                            lev_map[spot_tick] = fut_lev
                            print(f"🔗 mapping.json 기반 자동 연동 (UID {uid}): {spot_tick} <-> {fut_tick} (x{fut_lev})")
        except Exception as e:
            print(f"⚠️ mapping.json 연동 중 예외: {e}")

    # [3단계] 활성 목록에 없었더라도 미등록된 심볼 보완 (기존 값 덮어쓰기 금지)
    for item in data:
        sym = item.get("symbol", "")
        if sym in lev_map:
            continue
        brackets = item.get("brackets", [])
        if brackets:
            max_lev = int(brackets[0].get("initialLeverage", 20))
            lev_map[sym] = max_lev
            clean_sym = sym.replace("USDT", "").replace("USDC", "").replace("BUSD", "")
            if clean_sym not in lev_map:
                lev_map[clean_sym] = max_lev

    return lev_map

def main():
    env = load_env()
    api_key = env.get("BINANCE_API_KEY") or os.environ.get("BINANCE_API_KEY")
    api_secret = env.get("BINANCE_API_SECRET") or os.environ.get("BINANCE_API_SECRET")
    
    if not api_key or not api_secret:
        print("❌ [.env 오류] BINANCE_API_KEY 또는 BINANCE_API_SECRET이 설정되지 않았습니다.")
        print("💡 .env 파일에 바이낸스 읽기 전용 API 키를 입력해 주세요:")
        print("   BINANCE_API_KEY=your_key_here")
        print("   BINANCE_API_SECRET=your_secret_here")
        sys.exit(1)
        
    try:
        lev_map = fetch_from_binance_futures(api_key, api_secret)
        print(f"✅ 바이낸스 선물 공식 API로부터 {len(lev_map)}개 심볼 레버리지 브래킷 수집 성공!")
    except Exception as e:
        print(f"❌ 바이낸스 선물 API 호출 실패: {e}")
        sys.exit(1)
            
    os.makedirs(os.path.dirname(STATIC_PATH), exist_ok=True)
    with open(STATIC_PATH, "w", encoding="utf-8") as f:
        json.dump(lev_map, f, indent=2, ensure_ascii=False)
        
    print(f"💾 {STATIC_PATH} 저장 완료 ({len(lev_map)}개 바이낸스 선물 코인)")

if __name__ == "__main__":
    main()
