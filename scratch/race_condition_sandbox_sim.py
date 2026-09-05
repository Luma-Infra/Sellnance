import random
import time
import sys
import io
import heapq

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def get_pure_base(sym: str) -> str:
    if not sym:
        return ""
    return sym.upper().replace("USDT", "").replace("KRW-", "").replace("_KRW", "").replace("KRW", "")

from typing import Optional

class FastDiscreteEventSimulator:
    def __init__(self, mode: str):
        self.mode = mode
        self.current_asset = "DOGE"
        self.current_selected_symbol = "DOGE"
        self.is_fetching_chart = False
        self.main_candle_close = 0.1
        self.main_candle_count = 1
        
        self.latest_active_candle_close: Optional[float] = None
        self.latest_active_candle_sym: Optional[str] = None
        self.latest_symbol: Optional[str] = None
        self.realtime_update_pending = False
        self.last_chart_render_time = 0.0
        self.realtime_throttle_ms = 50.0
        
        self.events = []
        self.current_time_ms = 0.0
        self.event_counter = 0
        self.contamination_count = 0

    def schedule(self, delay_ms: float, callback_type: int, payload: tuple):
        self.event_counter += 1
        heapq.heappush(self.events, (self.current_time_ms + delay_ms, self.event_counter, callback_type, payload))

    def render_realtime_update(self, candle_close: float, candle_sym: Optional[str] = None, tick_symbol: Optional[str] = None):
        if self.is_fetching_chart:
            return
            
        if self.mode == "AFTER":
            # 🛡️ [Symbol Guard in renderRealtimeUpdate]
            symbol_to_check = tick_symbol or candle_sym
            if symbol_to_check:
                current_active = get_pure_base(self.current_selected_symbol or self.current_asset)
                tick_sym = get_pure_base(symbol_to_check)
                if current_active and tick_sym and current_active != tick_sym:
                    return # DROPPED!

        if self.main_candle_count == 0:
            return
            
        self.main_candle_close = candle_close
        if self.current_asset == "AAVE" and self.main_candle_close < 5.0:
            self.contamination_count += 1

    def broadcast_candle_update(self, candle_close: Optional[float], symbol: Optional[str]):
        if candle_close is None or symbol is None:
            return
            
        self.latest_active_candle_close = candle_close
        self.latest_active_candle_sym = symbol
        self.latest_symbol = symbol

        now = self.current_time_ms
        if self.realtime_update_pending:
            return
            
        if now - self.last_chart_render_time < self.realtime_throttle_ms:
            self.schedule(self.realtime_throttle_ms, 1, (candle_close, symbol))
            return

        self.realtime_update_pending = True
        raf_delay = random.uniform(1.0, 16.6)
        self.schedule(raf_delay, 2, (candle_close, symbol))

    def on_raf_trigger(self):
        self.realtime_update_pending = False
        self.last_chart_render_time = self.current_time_ms
        
        if self.is_fetching_chart:
            return

        if self.mode == "AFTER":
            # 🛡️ [Symbol Guard in rAF]
            current_active = get_pure_base(self.current_selected_symbol or self.current_asset)
            tick_sym = get_pure_base(self.latest_symbol or "")
            if not current_active or not tick_sym or current_active != tick_sym:
                return # DROPPED!

        candle_close = self.latest_active_candle_close
        if candle_close is None:
            return

        self.render_realtime_update(candle_close, self.latest_active_candle_sym, self.latest_symbol)

    def simulate_switch_trial(self):
        self.current_asset = "DOGE"
        self.current_selected_symbol = "DOGE"
        self.is_fetching_chart = False
        self.main_candle_close = 0.1
        self.main_candle_count = 1
        
        for _ in range(random.randint(3, 6)):
            tick_time = random.uniform(0.5, 20.0)
            self.schedule(tick_time, 0, (0.1, "DOGE"))

        switch_time = random.uniform(10.0, 30.0)
        self.schedule(switch_time, 3, ())

        for _ in range(random.randint(1, 3)):
            late_tick_time = switch_time + random.uniform(2.0, 45.0)
            self.schedule(late_tick_time, 0, (0.1, "DOGE"))

        while self.events:
            ev_time, _, cb_type, payload = heapq.heappop(self.events)
            self.current_time_ms = ev_time
            
            if cb_type == 0:
                self.broadcast_candle_update(payload[0], payload[1])
            elif cb_type == 1:
                self.broadcast_candle_update(self.latest_active_candle_close, self.latest_symbol)
            elif cb_type == 2:
                self.on_raf_trigger()
            elif cb_type == 3:
                self.current_asset = "AAVE"
                self.current_selected_symbol = "AAVE"
                self.is_fetching_chart = True
                fetch_delay = random.uniform(15.0, 60.0)
                self.schedule(fetch_delay, 4, ())
            elif cb_type == 4:
                self.is_fetching_chart = False
                self.main_candle_close = 100.0

        self.events.clear()
        self.current_time_ms = 0.0
        self.realtime_update_pending = False
        self.latest_active_candle_close = None
        self.latest_active_candle_sym = None
        self.latest_symbol = None

def run_test(trials=50000):
    sim_b = FastDiscreteEventSimulator(mode="BEFORE")
    t0 = time.time()
    for _ in range(trials):
        sim_b.simulate_switch_trial()
    t_b = time.time() - t0
    
    b_defects = sim_b.contamination_count
    b_defect_rate = (b_defects / trials) * 100
    b_integrity = 100.0 - b_defect_rate

    sim_a = FastDiscreteEventSimulator(mode="AFTER")
    t0 = time.time()
    for _ in range(trials):
        sim_a.simulate_switch_trial()
    t_a = time.time() - t0
    
    a_defects = sim_a.contamination_count
    a_defect_rate = (a_defects / trials) * 100
    a_integrity = 100.0 - a_defect_rate

    print(f"BEFORE Defect Rate: {b_defect_rate:.2f}% | Integrity: {b_integrity:.2f}%")
    print(f"AFTER  Defect Rate: {a_defect_rate:.2f}% | Integrity: {a_integrity:.2f}%")

if __name__ == "__main__":
    run_test(50000)
