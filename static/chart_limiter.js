// static/chart_limiter.js
// [업비트 공식 가이드 준수: 초당 10회 제한 중 8회 버킷, Remaining-Req 헤더 피드백, 429 서킷 브레이커]

export const UPBIT_PACING_MS = 125; // 1000ms / 8회 = 125ms (초당 8회 안전 간격)

export class UpbitBrowserLimiter {
  constructor(capacity = 8, refillRate = 8) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = performance.now();
    this.activeRequests = 0;
    this.cooldownUntil = 0;
  }

  canRequest() {
    const now = performance.now();
    if (now < this.cooldownUntil) return false;

    // 1. 동시 진행 중인 통신선 요청 8개 초과 시 서버 프록시로 안전 토스
    if (this.activeRequests >= 8) return false;

    // 2. 경과 시간에 따른 토큰 충전
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSec * this.refillRate,
    );
    this.lastRefill = now;

    if (this.tokens >= 1.0) {
      this.tokens -= 1.0;
      this.activeRequests++;
      return true;
    }
    return false;
  }

  // 토큰이 충전될 때까지 안전하게 대기하는 비동기 메서드 (기본 500ms 상한)
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
        }
      }
    } catch (e) { }
  }

  // 429 감지 시 5초간 브라우저 호출 전면 중단 (418 격상 원천 방지)
  triggerCooldown(seconds = 5.0) {
    const now = performance.now();
    this.cooldownUntil = Math.max(this.cooldownUntil, now + seconds * 1000);
    this.tokens = 0;
    this.activeRequests = 0;
  }
}

export const upbitBrowserLimiter = new UpbitBrowserLimiter(8, 8);
