# 🎯 [Sellnance 핵심 3대 과제 해결 계획서] (개정판)
**작성일시:** 2026-08-31
**우선순위:** Critical (실전 트레이딩 신뢰도 및 프레임 레이트 확보)
**핵심 레퍼런스:** `mapping.json`, `listing.json`, `!asset_identity_design.md`, `!rule_for_backend.txt`

---

## 📌 개요
Sellnance 엔진 고도화를 위해 반드시 해결해야 하는 3대 핵심 병목을 진단하고, 이미 구축된 프로젝트 자산(`mapping.json`, `listing.json`)의 아키텍처에 맞춘 실전 해결 방안을 정의합니다.

1. **데이터 정합성 (Data Consistency):** `mapping.json` (CMC UID / DUPLICATED_LIST) 기반 런타임 자산 식별 및 도킹 정합성
2. **렌더링 렉 & 프레임 드랍 개선:** 초당 수백 개 웹소켓 틱 폭주 시 DOM/캔버스 병목 해소 (배치 렌더링)
3. **김프(Kimchi Premium) 수치 일치:** 차트와 테이블 간 김프 불일치 동기화 (단일 소스화)

---

## 🧭 과제 1: `mapping.json` 기반 거래소 간 데이터 정합성 & 자산 식별자(UID) 도킹

### 🚨 현상 및 핵심 병목
이미 시스템에 `mapping.json`과 `listing.json`이라는 강력한 정규화 메커니즘이 존재하지만, **실시간 런타임 스트림 유입 시점**에 다음과 같은 정합성 왜곡이 발생함:

1. **동일 자산 상이 티커(Discrepancy) 도킹 누락:**
   - 리브랜딩/스왑 및 거래소별 명칭 차이: `BTT` ↔ `BTTC`, `BEAM` ↔ `BEAMX`, `AMP` ↔ `AMP2`, `MET` ↔ `MET2`
   - 바이낸스 선물 배수 단위 티커: `1000PEPE`, `1000SHIB`, `1000BONK`, `1000000BOB`
   - 런타임에 소켓으로 날아온 문자열 티커가 `DUPLICATED_LIST`나 `SYMBOL_TO_ID_MAP`을 거치지 못하고 원시 텍스트로 처리될 경우 김프 연산/호가 결합이 쪼개짐
2. **동명이인 코인(Ticker Collision)의 장부 오염:**
   - 심볼은 같으나 서로 다른 체인의 독립 프로젝트: 예) `BOB` (빗썸 Build on Bitcoin [UID: 38970] vs 바이낸스 1000000BOB [UID: 34422])
   - UID 분기 없이 심볼로만 매핑되면 두 코인의 시세와 호가가 겹쳐서 차트가 크래시되는 현상(Overlap)
3. **신규 상장 및 미등록 티커 런타임 유입:**
   - `mapping.json`에 아직 UID가 등록되지 않은 신규 감지 코인이 들어올 때 CMC API 쿼터 고갈 및 레이스 컨디션 발생
4. **`listing.json`과의 메타데이터 동기화 지연:**
   - 거래소별 상장일자(`binance_listing` 등)와 거래소 뱃지 표기가 실시간 피드와 어긋나는 문제

### 🛠️ 해결 방안 (`mapping.json` & `listing.json` 중심)

```
[외부 소켓 유입] (KRW-AMP2 / 1000PEPEUSDT)
       │
       ▼ (부패 방지 계층 ACL: 접미사/배수 제거)
[순수 심볼 정화] (AMP2 / PEPE, 배율 1000 기록)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ 🔍 mapping.json 3단계 룩업 파이프라인                         │
│  1. DUPLICATED_LIST 검사: [UID, Chain, ExchangeTicker, Name] │
│     -> UID 일치 시 동일 코인 도킹, UID 다르면 독립 분기     │
│  2. SYMBOL_TO_ID_MAP 검사: 표준 CMC UID 추출                │
│  3. SPECIAL_SYMBOL_MAP / EXCLUSION_LIST 검사                 │
└─────────────────────────────────────────────────────────────┘
       │
       ▼ (단일 UID 확정)
[정규화된 자산 엔티티] (UID: 6945 -> 업비트 AMP2 + 바이낸스 AMP 시세 도킹)
```

1. **소켓 진입부의 부패 방지 계층(ACL) 정규화 표준화:**
   - `feed_*.js` 및 백엔드 어댑터에서 모든 티커를 즉시 `mapping.json`의 `SYMBOL_TO_ID_MAP` 및 `DUPLICATED_LIST`와 대조하여 **내부 단일 식별자(`UID`)**로 변환
   - 선물 배수(`1000`, `1M`, `1000000`)는 감지 즉시 `multiplier` 플래그(x1000 등)를 메타데이터로 부여하고 기본 티커로 정규화
2. **`DUPLICATED_LIST` 우선 판별 규칙 엄격 적용 (`!rule_for_backend.txt` 준수):**
   - 동일 심볼 유입 시 `DUPLICATED_LIST`를 1순위로 조회:
     - `UID`가 동일하면: 동일 자산으로 판정, 업비트-바이낸스 가격 도킹(김프 정상 계산)
     - `UID`가 다르면: 완전히 다른 자산으로 분리하여 각각 독립 행/차트 렌더링
3. **`listing.json` 기반 상장 상태 및 뱃지 캐시화:**
   - `listing.json`을 백엔드 Go 캐시(`cache.go`) 및 프론트 전역 스토어(`_store.js`)에 인메모리 로드
   - 티커 검색 및 테이블 렌더 시 `listing.json`의 상장 일자를 조회해 뱃지(바낸/업비트/빗썸 상장 여부)를 O(1)로 즉시 렌더링

---

## ⚡ 과제 2: 김프 포함한 렌더링 렉 개선 (프레임 드랍 방어)

### 🚨 현상 및 원인
- **틱 폭주에 의한 DOM 강제 리플로우(Reflow):** 거래소 4곳에서 쏟아지는 웹소켓 틱을 받을 때마다 테이블 행(`<tr>`, `<td>`)의 텍스트와 스타일을 직접 수정하여 브라우저 렌더링 엔진 과부하
- **Lightweight Charts 캔버스 업데이트 경합:** 탭 전환이나 차트 스크롤 중 대량 과거 데이터 로드와 실시간 틱 주입이 메인 스레드에서 충돌 (과거 `!report_0531.md` 크래시 원인)

### 🛠️ 해결 방안
1. **배치 렌더링 & 쓰로틀링 (Batching & Throttling) 도입**
   - 웹소켓 수신부: 데이터가 올 때마다 DOM을 건드리지 않고 인메모리 큐(`pendingUpdatesMap`)에 적재
   - 렌더러 루프: `requestAnimationFrame` 또는 `100ms` 간격(`setInterval`)으로 큐에 쌓인 변경점만 모아서 **한 프레임에 1회 일괄 갱신**
2. **테이블 가상 스크롤(Virtual Scroll) 또는 상위 노출 우선 렌더링**
   - 수백 개 코인 전체를 DOM에 유지하지 않고, 화면 뷰포트에 보이는 30~40개 행만 실시간 갱신 처리
   - 비활성화된(화면 밖) 행은 배경 계산만 돌리고 DOM 조작 중단
3. **김프 및 지표 연산 Web Worker 분리 (선택 옵션)**
   - 메인 스레드는 순수 UI 렌더링(차트, DOM)만 담당하고,
   - 환율 환산, 김프 계산, 테이블 정렬/필터링은 백그라운드 Web Worker(`kimp_worker.js`)로 격리하여 60fps 유지

---

## 🎯 과제 3: 차트와 테이블의 김프 수치 불일치 동기화

### 🚨 현상 및 원인
- **계산 파이프라인의 분리 (Two Sources of Truth):**
  - 테이블 김프: 실시간 체결가 틱(`trade`) 기준으로 계산 (`stream_korea.js` 등)
  - 차트 김프: 캔들 종가(`close`) 또는 별도 과거 캔들 배열 기준으로 계산 (`chart_data_kimchi.js`)
- **참조 데이터 불일치:**
  - 테이블은 바이낸스 **현물(Spot)** 가격을 참조하는데, 차트는 **선물(Futures)** 가격을 참조하는 케이스 존재
  - 캔들 봉 완성 시점과 실시간 체결 시점의 시간차로 인해 숫자가 몇 퍼센트씩 벌어짐

### 🛠️ 해결 방안
1. **단일 김프 계산 엔진 (Single Source of Truth: `KimpEngine`) 수립**
   - 김프 계산 공식을 한 곳에만 선언하고 다른 곳에서 복붙 계산 금지:
     $$\text{Kimp}(\%) = \left(\frac{\text{Upbit KRW Price}}{\text{Binance USD Price} \times \text{DEFAULT\_KRW\_USD\_RATE}} - 1\right) \times 100$$
   - `mapping.json`의 `DEFAULT_KRW_USD_RATE` 및 실시간 환율 브로드캐스터를 공통 분모로 사용
2. **데이터 참조 기준 엄격 고정**
   - 기준 해외 거래소: `Binance Spot BTCUSDT` (기본값)
   - 기준 국내 거래소: `Upbit KRW-BTC` (기본값)
   - 옵션 토글(선물 vs 현물) 변경 시 테이블과 차트에 동일 이벤트(`KIMP_BASE_CHANGED`) 디스패치
3. **최신 캔들 종가(Close) = 현재 틱(Tick) 강제 동기화**
   - 실시간 웹소켓에서 마지막 김프가 갱신되면, 차트의 마지막 봉(진행 중인 봉)의 종가와 테이블의 현재 김프 셀이 **동일한 단일 변수(`store.currentKimp[symbol]`)**를 참조하도록 단방향 바인딩 구축

---

## 📋 액션 아이템 요약 체크리스트

- [ ] **Step 1 (정합성):** 소켓 진입 시 `mapping.json`의 `DUPLICATED_LIST` & `SYMBOL_TO_ID_MAP` 통과시켜 UID 기반으로만 거래소 간 시세/호가 도킹
- [ ] **Step 2 (배수 정규화):** `1000PEPE`, `1000000BOB` 등 바이낸스 선물 배수 티커의 자동 정규화(`x1000`) 필터 확립
- [ ] **Step 3 (상장 메타):** `listing.json` 인메모리 룩업으로 테이블/차트 상장 뱃지 O(1) 동기화
- [ ] **Step 4 (동기화):** `chart_data_kimchi.js`와 `table_render.js`가 같은 `KimpEngine.calculate()`를 쓰도록 연결
- [ ] **Step 5 (렉 개선):** 웹소켓 수신부 틱 버퍼링(배치 큐) 적용하여 DOM 렌더링 주기 100ms로 제한
