# trace_hooking.py
import functools
import sys
from . import api_manager, cmc_api, exchange_api

def simple_trace(msg_prefix):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # 🚀 터미널에 강제로 흔적 남기기 (눈에 띄게!)
            print(f"\n{'='*30}")
            print(f"🔥 [TRACE] {msg_prefix} -> {func.__name__} 실행 시작!")
            print(f"{'='*30}\n")
            sys.stdout.flush() # 👈 버퍼에 머물지 말고 즉시 뱉어라!
            
            result = func(*args, **kwargs)
            
            print(f"✅ [TRACE] {msg_prefix} 완료!")
            sys.stdout.flush()
            return result
        return wrapper
    return decorator

def apply_traces(manager_broadcast=None):
    # 🚀 함수 바꿔치기 (Monkey Patching)
    # api_manager.py의 지휘관 함수
    api_manager._fetch_and_process_data = simple_trace("BOSS 엔진")(api_manager._fetch_and_process_data)
    
    # exchange_api.py의 수집 함수
    exchange_api.fetch_exchange_market_data = simple_trace("거래소 데이터 수집")(exchange_api.fetch_exchange_market_data)
    
    # cmc_api.py의 족보 대조 함수
    cmc_api.fetch_cmc_market_data = simple_trace("CMC 족보 매칭")(cmc_api.fetch_cmc_market_data)
    
    print("\n🛠️ [System] 모든 함수에 자동 트레이싱 후크 설치 완료!\n")
    sys.stdout.flush()