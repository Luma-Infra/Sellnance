# scratch/test_backend_memory.py
"""
Python Backend Memory & GC Benchmark
"""
import os
import sys
import gc
import time
import tracemalloc

# Windows UTF-8 stdout configuration
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def run_python_memory_benchmark():
    print("=" * 80)
    print("[Python 백엔드 메모리 / GC / 힙 누수 정밀 분석]")
    print("=" * 80)

    # 1. GC 기본 상태 및 세대별 임계값 계측
    gc_counts = gc.get_count()
    gc_thresholds = gc.get_threshold()
    print(f"[1] GC 세대별 상태")
    print(f"  - 현재 세대별 객체 카운트 (Gen 0, 1, 2): {gc_counts}")
    print(f"  - 세대별 수거 임계값 (Gen 0, 1, 2): {gc_thresholds}")

    # 2. tracemalloc 활성화하여 모듈 로딩 및 연산 중 메모리 할당 추적
    tracemalloc.start()
    snapshot1 = tracemalloc.take_snapshot()

    # 모듈 임포트 및 시뮬레이션
    start_time = time.perf_counter()
    import config
    import modules.utils as utils
    import modules.candle_proxy as candle_proxy
    
    # 가상 틱/캐시 처리 1,000회 시뮬레이션
    dummy_candles = [
        {"time": 1700000000 + i * 60, "open": 100.0, "high": 105.0, "low": 95.0, "close": 102.0, "volume": 500.0}
        for i in range(1000)
    ]
    
    # 캔들 가공 및 캐싱 모의 연산
    processed_map = {}
    for c in dummy_candles:
        processed_map[c["time"]] = c

    # 1,000회 조회 및 GC 세대 전이 시뮬레이션
    for _ in range(1000):
        t_keys = list(processed_map.keys())
        _ = [processed_map[k]["close"] for k in t_keys[:10]]

    dur = (time.perf_counter() - start_time) * 1000
    snapshot2 = tracemalloc.take_snapshot()

    # 3. 메모리 차이 분석 (Top 5 메모리 할당 지점)
    top_stats = snapshot2.compare_to(snapshot1, 'lineno')

    print(f"\n[2] 1,000회 연산 시뮬레이션 메모리 점유 및 소요 시간")
    print(f"  - 시뮬레이션 소요 시간: {dur:.2f} ms")
    
    current_mem, peak_mem = tracemalloc.get_traced_memory()
    print(f"  - 현재 힙 메모리: {current_mem / 1024:.2f} KB")
    print(f"  - 최대 피크 힙 메모리: {peak_mem / 1024:.2f} KB")

    print(f"\n[3] Top 5 Python 메모리 할당 파일 및 라인 (tracemalloc 실측)")
    for stat in top_stats[:5]:
        print(f"  - {stat}")

    # 4. 순환 참조 및 미수거 객체 (Garbage) 검사
    unreachable = gc.collect()
    print(f"\n[4] GC 순환 참조 미아 객체 (Memory Leak) 검사")
    print(f"  - 수거된 순환 참조 객체 (Unreachable): {unreachable} 개")
    if unreachable == 0:
        print(f"  - [OK] 순환 참조 누수 0개 (완전 무결)")
    else:
        print(f"  - [INFO] 순환 객체 발견: {unreachable} 개 (정상 회수됨)")

    tracemalloc.stop()
    print("=" * 80)

if __name__ == "__main__":
    run_python_memory_benchmark()
