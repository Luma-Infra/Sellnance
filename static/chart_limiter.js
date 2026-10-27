// static/chart_limiter.js
// [업비트/바이낸스 공식 가이드 준수: 토큰 버킷, 롤링 윈도우, 2200 하드 캡 & 브라우저 멀티 탭(BroadcastChannel) 실시간 동기화]

export const UPBIT_PACING_MS = 125; // 1000ms / 8회 = 125ms (초당 8회 안전 간격)

// ==========================================
// 1. 업비트 브라우저 레이트 리미터 (멀티 탭 동기화 지원)
// ==========================================
export class UpbitBrowserLimiter {
  constructor(capacity = 8, refillRate = 8) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = performance.now();
    this.activeRequests = 0;
    this.cooldownUntil = 0;
    this._initBroadcast();
  }

  _initBroadcast() {
    if (
      typeof window === "undefined" ||
      typeof BroadcastChannel === "undefined"
    )
      return;
    try {
      this.channel = new BroadcastChannel("upbit_rate_limit_sync");
      this.channel.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === "TOKEN_CONSUMED") {
          // 다른 탭에서 토큰을 소모했을 때 토큰 차감 공유
          this.tokens = Math.max(0, this.tokens - 1);
        } else if (msg.type === "COOLDOWN") {
          // 다른 탭에서 429 감지 시 모든 탭 일괄 쿨다운
          this._applyCooldown(msg.seconds);
        } else if (msg.type === "REMAINING_REQ") {
          // 다른 탭에서 업비트 헤더 수신 시 잔여 토큰 동기화
          this.tokens = Math.min(
            this.tokens,
            Math.max(0, msg.remainingSec - 1),
          );
          this.lastRefill = performance.now();
        }
      };
    } catch (e) {}
  }

  _broadcast(data) {
    if (this.channel) {
      try {
        this.channel.postMessage(data);
      } catch (e) {}
    }
  }

  canRequest() {
    const now = performance.now();
    if (now < this.cooldownUntil) return false;

    // 동시 진행 중인 통신선 요청 8개 초과 시 차단
    if (this.activeRequests >= 8) return false;

    // 경과 시간에 따른 토큰 충전
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSec * this.refillRate,
    );
    this.lastRefill = now;

    if (this.tokens >= 1.0) {
      this.tokens -= 1.0;
      this.activeRequests++;
      // 다른 브라우저 탭들에게 토큰 소모 공유
      this._broadcast({ type: "TOKEN_CONSUMED" });
      return true;
    }
    return false;
  }

  // 토큰이 충전될 때까지 안전하게 대기하는 비동기 메서드
  async waitForToken(maxWaitMs = 500) {
    const start = performance.now();
    while (performance.now() - start < maxWaitMs) {
      if (this.canRequest()) {
        return true;
      }
      // 토큰 1개 충전 주기만큼 대기
      await new Promise((r) => setTimeout(r, UPBIT_PACING_MS));
    }
    return false;
  }

  // 요청 완료 시 activeRequest 감소
  release() {
    if (this.activeRequests > 0) this.activeRequests--;
  }

  // 업비트 응답 헤더 'Remaining-Req: group=candles; sec=X' 파싱 및 잔여 토큰 실시간 동기화
  syncRemainingReq(headerVal) {
    if (!headerVal) return;
    try {
      const match = headerVal.match(/sec=(\d+)/i);
      if (match && match[1]) {
        const remainingSec = parseInt(match[1], 10);
        if (!isNaN(remainingSec)) {
          this.tokens = Math.min(this.tokens, Math.max(0, remainingSec - 1));
          this.lastRefill = performance.now();
          this._broadcast({ type: "REMAINING_REQ", remainingSec });
        }
      }
    } catch (e) {}
  }

  _applyCooldown(seconds) {
    const now = performance.now();
    this.cooldownUntil = Math.max(this.cooldownUntil, now + seconds * 1000);
    this.tokens = 0;
    this.activeRequests = 0;
  }

  triggerCooldown(seconds = 5.0) {
    this._applyCooldown(seconds);
    this._broadcast({ type: "COOLDOWN", seconds });
  }
}

export const upbitBrowserLimiter = new UpbitBrowserLimiter(8, 8);

// ==========================================
// 2. 바이낸스 브라우저 레이트 리미터 (2200 하드 캡 & 멀티 탭 동기화)
// ==========================================
export const BINANCE_WEIGHT_LIMIT = 2400;
export const BINANCE_MAX_WEIGHT_CEILING = 2200; // 절대 넘지 못하는 안전 상한선

export class BinanceBrowserLimiter {
  constructor(maxWeight = BINANCE_MAX_WEIGHT_CEILING) {
    this.maxWeight = maxWeight;
    this.rollingRequests = []; // [{ time: ms, weight: 2 }]
    this.serverUsedWeight = 0;
    this.serverWeightUpdatedAt = 0;
    this.activeRequests = 0;
    this.cooldownUntil = 0;
    this.minIntervalMs = 70; // 초당 최대 약 14회 버스트 제한
    this.lastRequestTime = 0;
    this._initBroadcast();
  }

  _initBroadcast() {
    if (
      typeof window === "undefined" ||
      typeof BroadcastChannel === "undefined"
    )
      return;
    try {
      this.channel = new BroadcastChannel("binance_rate_limit_sync");
      this.channel.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === "WEIGHT_ACQUIRED") {
          // 다른 탭에서 바이낸스 요청을 전송했을 때 내 슬라이딩 윈도우에도 누적
          this.rollingRequests.push({
            time: performance.now(),
            weight: msg.weight,
          });
          this.lastRequestTime = performance.now();
        } else if (msg.type === "SYNC_USED_WEIGHT") {
          // 다른 탭에서 수신한 바이낸스 서버 실측 헤더 동기화
          this.serverUsedWeight = msg.used;
          this.serverWeightUpdatedAt = performance.now();
          if (msg.used >= this.maxWeight) {
            this._applyCooldown(5.0);
          }
        } else if (msg.type === "COOLDOWN") {
          // 다른 탭에서 429/418 감지 시 모든 탭 일괄 쿨다운
          this._applyCooldown(msg.seconds);
        }
      };
    } catch (e) {}
  }

  _broadcast(data) {
    if (this.channel) {
      try {
        this.channel.postMessage(data);
      } catch (e) {}
    }
  }

  // 60초 롤링 윈도우 정리 및 현재 브라우저 누적 Weight 계산
  getEffectiveWeight() {
    const now = performance.now();
    // 60초 이전 요청 기록 만료 정리
    while (
      this.rollingRequests.length > 0 &&
      now - this.rollingRequests[0].time > 60000
    ) {
      this.rollingRequests.shift();
    }

    const localWeight = this.rollingRequests.reduce(
      (sum, r) => sum + r.weight,
      0,
    );

    // 서버 실측 헤더가 60초 이내에 들어왔다면 서버 실측치와 로컬 추정치 중 더 큰 값을 기준으로 관리
    if (now - this.serverWeightUpdatedAt < 60000) {
      return Math.max(localWeight, this.serverUsedWeight);
    }
    return localWeight;
  }

  // 바이낸스 응답 헤더 'x-mbx-used-weight-1m' 동기화
  syncUsedWeight(headerVal) {
    if (!headerVal) return;
    try {
      const used = parseInt(headerVal, 10);
      if (!isNaN(used)) {
        this.serverUsedWeight = used;
        this.serverWeightUpdatedAt = performance.now();
        this._broadcast({ type: "SYNC_USED_WEIGHT", used });
        if (used >= this.maxWeight) {
          this.triggerCooldown(5.0);
        }
      }
    } catch (e) {}
  }

  // [핵심] 2200 한도 이내에서 weight를 확보하고, 한도 초과 시 윈도우가 풀릴 때까지 브라우저 단에서 페이싱(대기)
  async acquireWeight(weight = 2, maxWaitMs = 1500) {
    const start = performance.now();

    while (performance.now() - start < maxWaitMs) {
      const now = performance.now();
      if (now < this.cooldownUntil) {
        await new Promise((r) =>
          setTimeout(r, Math.min(150, this.cooldownUntil - now)),
        );
        continue;
      }

      // 초당 버스트 간격 보장 (최소 70ms)
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.minIntervalMs) {
        await new Promise((r) =>
          setTimeout(r, this.minIntervalMs - timeSinceLast),
        );
        continue;
      }

      const currentWeight = this.getEffectiveWeight();
      // 2200을 초과할 수 없도록 관리
      if (currentWeight + weight <= this.maxWeight) {
        this.lastRequestTime = performance.now();
        this.rollingRequests.push({ time: this.lastRequestTime, weight });
        this.activeRequests++;
        // 다른 브라우저 탭들에게 Weight 사용 내역 공유
        this._broadcast({ type: "WEIGHT_ACQUIRED", weight });
        return true;
      }

      // 2200에 도달했으면 가장 오래된 요청이 60초 윈도우 밖으로 빠져나갈 때까지 대기
      const oldest = this.rollingRequests[0];
      const waitTime = oldest ? Math.max(50, 60000 - (now - oldest.time)) : 150;
      await new Promise((r) => setTimeout(r, Math.min(waitTime, 200)));
    }

    // 대기 시간을 초과해도 2200 미만으로 내려오지 않으면 요청 차단 (바이낸스로 전송하지 않음)
    return false;
  }

  release() {
    if (this.activeRequests > 0) this.activeRequests--;
  }

  _applyCooldown(seconds) {
    const now = performance.now();
    this.cooldownUntil = Math.max(this.cooldownUntil, now + seconds * 1000);
    this.activeRequests = 0;
  }

  // 429 감지 시 최소 10초, 418(IP Ban) 감지 시 지정 초만큼 브라우저 호출 전면 차단
  triggerCooldown(seconds = 10.0) {
    this._applyCooldown(seconds);
    this._broadcast({ type: "COOLDOWN", seconds });
  }
}

export const binanceBrowserLimiter = new BinanceBrowserLimiter(
  BINANCE_MAX_WEIGHT_CEILING,
);
