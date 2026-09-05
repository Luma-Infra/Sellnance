// start.js
// 🚀 스타트뷰 엔진: 실시간 키 마스킹 + env 연동 + 유효성 검사
// 🚀 4대장 코인(BTC, ETH, XRP, SOL) 실시간 퀵뷰 프리뷰 쇼케이스 엔진

// ===================================================================================
// 🧭 [3D 퀵뷰 프리뷰 8방위 시선 각도 & 황금비율(Golden Ratio) 설정소]
// 💡 [공식 기술 용어 레퍼런스]
//   1. 아이소메트릭 틸트 / 쿼터뷰 (Isometric Tilt / Quarter View): 사선(NE/NW/SW/SE) 투영 기법
//   2. 3D 패럴랙스 틸트 & 오비탈 뷰 (Parallax Tilt / Orbital Camera): 방위각(Azimuth)에 따른 시선 이동
//   3. 오일러 각 3축 제어 (Euler Angles): rx(Pitch:상하), ry(Yaw:좌우), rz(Roll:기울임)
// ===================================================================================
// 8방위 프리셋: NE(북동), NW(북서), SW(남서), SE(남동), N(북), S(남), E(동), W(서), CENTER(정면)

const START_3D_CONFIG = {
  // ⏱️ [전환 타이머 설정] 쇼케이스 순환 주기 (밀리초 단위, 기본 4000ms = 4초)
  cycleIntervalMs: 3000,

  // 📐 [황금비 직사각형 규격 설정 (Golden Ratio: 1.618 : 1)]
  goldenRatio: "1.618 / 1", // 덱 전체 및 4개 개별 카드의 가로:세로 황금비율
  deckWidth: "100%", // 좌측 영역 내 덱 가로폭
  deckMaxWidth: "800px", // 최대 가로폭 (세로 높이는 황금비로 100% 자동 계산됨)

  // 🧭 화면 전환 시 순환할 방위 목록
  compassCycle: ["NW", "NE"], // 10시(북서) ➡️ 2시(북동)

  tiltAngle: [5, 5, -5, -5], // 📐 단계별 틸트 각도 (시계 방향으로 균일하게 매끄럽게 회전)
  scale: 1.0, // 기본 스케일 배율
  perspective: 1200, // 3D 원근 깊이 (px)

  // 🌟 [3D 바닥 앰비언트 오라 / 백라이트 커스텀 설정소]
  auraInset: "0px", // 덱 외곽 확장 폭 (예: -20px ~ -60px)
  auraBorderRadius: "20px", // 오라 모서리 둥글기 (px)
  auraBlur: "14px", // 블러 번짐 반경 (px)
  auraOpacity: 0.07, // 오라 투명도 (0.0 ~ 1.0)
  auraBackground:
    "radial-gradient(ellipse at center, var(--accent) 0%, transparent 60%)",
  auraBoxShadow: "0 0 12px var(--accent)",
};

// ===================================================================================
// ⏱️ [쇼케이스 순환 상태 & 단계별 시간봉(TF) 커스텀 설정소]
// 💡 지원 시간봉(tf): "1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d", "1w"
// 💡 레이아웃(layout): "spread" (4개 2x2 바둑판 분할), "overlap" (중앙 1개 통합 겹침)
// 💡 캔들 색상(candleMode): "unique" (코인별 고유 네온색), "default" (클래식 녹색 양봉 / 적색 음봉)
// ===================================================================================
const START_SHOWCASE_STATES = [
  { layout: "spread", tf: "4h", candleMode: "unique" }, // 1단계: 4개 분할 + 4시간봉 + 고유 네온색
  { layout: "overlap", tf: "1d", candleMode: "unique" }, // 2단계: 모으기   + 1일봉 + 고유 네온색
  { layout: "spread", tf: "4h", candleMode: "default" }, // 3단계: 4개 분할 + 4시간봉 + 클래식 양/음봉
  { layout: "overlap", tf: "1d", candleMode: "default" }, // 4단계: 모으기   + 1일봉 + 클래식 양/음봉
];

// 🧭 8방위 축별 오일러 각(Pitch/Yaw/Roll) 틸트 맵 (회전이 아닌 동서남북 3D 시선 방향)
const COMPASS_DIRECTIONS = {
  NE: { rx: 1, ry: -1, rz: 1 }, // 북동 (North-East: 우상단 아이소메트릭)
  NW: { rx: 1, ry: 1, rz: -1 }, // 북서 (North-West: 좌상단 아이소메트릭)
  SW: { rx: -1, ry: 1, rz: 1 }, // 남서 (South-West: 좌하단 아이소메트릭)
  SE: { rx: -1, ry: -1, rz: -1 }, // 남동 (South-East: 우하단 아이소메트릭)
  N: { rx: 1.2, ry: 0, rz: 0 }, // 북 (North / Top Pitch)
  S: { rx: -1.2, ry: 0, rz: 0 }, // 남 (South / Bottom Pitch)
  E: { rx: 0, ry: -1.2, rz: 0 }, // 동 (East / Right Yaw)
  W: { rx: 0, ry: 1.2, rz: 0 }, // 서 (West / Left Yaw)
  CENTER: { rx: 0, ry: 0, rz: 0 }, // 정면 (Front View)
};

let startCompassStep = 0;

function get3DTransform(extraScale = 1) {
  const cycle = START_3D_CONFIG.compassCycle;
  const currentKey = cycle[startCompassStep % cycle.length] || "NE";
  const comp = COMPASS_DIRECTIONS[currentKey] || COMPASS_DIRECTIONS.NE;

  // 💡 단일 숫자 또는 단계별 각도 배열([20, 10, 10, 20]) 완벽 대응
  const angles = Array.isArray(START_3D_CONFIG.tiltAngle)
    ? START_3D_CONFIG.tiltAngle
    : [START_3D_CONFIG.tiltAngle];
  const angle = angles[startCompassStep % angles.length] ?? 10;

  const rx = (comp.rx * angle).toFixed(1);
  const ry = (comp.ry * angle).toFixed(1);
  const rz = (comp.rz * (angle / 4)).toFixed(1);
  const s = (START_3D_CONFIG.scale * extraScale).toFixed(3);

  return `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
}

// 🌑 [네 모서리 끝단을 100% 보장하는 3D 직사각형 동기화 그림자 엔진]
function getShadowTransform(extraScale = 1) {
  // 💡 억지 2D 이동 대신 실제 3D 덱과 1:1로 일치하는 3D 원근 투영을 적용하여 네 모서리가 항상 완벽하게 보장됨
  return get3DTransform(1.03 * extraScale);
}

function getStartScreenHTML() {
  return `
    <style>
      #start-screen {
        font-family: var(--font-sans);
        perspective: ${START_3D_CONFIG.perspective}px;
        overflow: hidden;
      }

      /* 🚀 [기존 코드 주석 보존] PixiJS WebGL 캔버스 스타일
      #pixi-canvas-container {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
      }
      */

      /* 🚀 좌측 3D 쿼터뷰 프리뷰 컨테이너 (황금비 직사각형 덱) */
      #start-qv-preview-container {
        position: relative;
        width: ${START_3D_CONFIG.deckWidth};
        max-width: ${START_3D_CONFIG.deckMaxWidth};
        aspect-ratio: ${START_3D_CONFIG.goldenRatio};
        perspective: ${START_3D_CONFIG.perspective}px;
        transform-style: preserve-3d;
        pointer-events: none;
        overflow: visible !important;
        margin: auto;
      }
      
      /* 🚀 3D 투영 완전 일치: 3차원 글래스 평면 내부에 직접 렌더링되는 테두리 프로그레스 */
      .start-qv-inner-progress {
        position: absolute;
        inset: -2px;
        width: calc(100% + 4px);
        height: calc(100% + 4px);
        pointer-events: none;
        z-index: 25;
        overflow: visible;
        border-radius: inherit;
      }
      .start-qv-progress-rect {
        stroke-dasharray: 100.2 100.2;
        stroke-dashoffset: 100.2;
        stroke-linecap: round;
        filter: drop-shadow(0 0 4px var(--accent));
        animation: startBorderProgress ${START_3D_CONFIG.cycleIntervalMs}ms linear infinite;
      }
      @keyframes startBorderProgress {
        0% { stroke-dashoffset: 100.2; opacity: 0.15; }
        4% { opacity: 0.8; }
        96% { stroke-dashoffset: 0; opacity: 0.8; }
        100% { stroke-dashoffset: 0; opacity: 0.15; }
      }

      #start-qv-spread-view {
        position: absolute;
        inset: 0;
        aspect-ratio: ${START_3D_CONFIG.goldenRatio};
        transform-origin: center center;
        transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: opacity, transform;
        transform: ${get3DTransform(1)};
        opacity: 1;
        overflow: visible;
      }
      #start-qv-cards-grid {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        gap: 14px;
        width: 100%;
        height: 100%;
      }
      /* 🚀 3D 덱 하단 바닥 투영 은은한 앰비언트 섀도우 (눈이 편안한 약한 발광) */
      .start-qv-floor-shadow {
        position: absolute;
        inset: ${START_3D_CONFIG.auraInset};
        border-radius: ${START_3D_CONFIG.auraBorderRadius};
        background: ${START_3D_CONFIG.auraBackground};
        box-shadow: ${START_3D_CONFIG.auraBoxShadow};
        filter: blur(${START_3D_CONFIG.auraBlur});
        opacity: ${START_3D_CONFIG.auraOpacity};
        pointer-events: none;
        z-index: 0;
        transform-origin: center center;
        transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.85s ease;
        transform: ${getShadowTransform(1)};
      }

      #start-qv-overlap-view {
        position: absolute;
        inset: 0;
        border-radius: 20px;
        aspect-ratio: ${START_3D_CONFIG.goldenRatio};
        background: var(--panel);
        border: 1px solid var(--border);
        box-shadow: 0 20px 48px -8px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform-origin: center center;
        transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: opacity, transform;
        transform: ${get3DTransform(0.96)};
        opacity: 0;
      }
      .start-qv-card {
        position: relative;
        aspect-ratio: ${START_3D_CONFIG.goldenRatio};
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        overflow: hidden;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        display: flex;
        flex-direction: column;
        box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.25);
        transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.85s ease;
        will-change: transform;
      }
      .start-qv-badge {
        position: absolute;
        top: 10px;
        left: 14px;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.05em;
      }
      .start-qv-badge [id^="start-qv-spread-price"],
      [id^="start-qv-overlap-price"] {
        color: var(--text);
        font-weight: 700;
      }
      .start-qv-overlap-legend {
        position: absolute;
        top: 12px;
        left: 16px;
        z-index: 10;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        font-size: 11px;
        font-weight: 800;
      }
      .start-qv-canvas {
        width: 100%;
        flex: 1;
        min-height: 80px;
      }
      #start-qv-overlap-view .start-qv-canvas {
        opacity: 0.55;
        transition: opacity 0.25s ease;
      }
      .start-qv-legend-item {
        transition: all 0.2s ease;
        border: 1px solid transparent;
        border-radius: 6px;
      }
      .start-qv-legend-item:hover {
        background: var(--border);
      }

      /* 드로퍼 다이내믹 등장 애니메이션 */
      @keyframes dynamicDropIn {
        0% { transform: translateY(20px) scale(0.96); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }

      /* 🚀 메인 대시보드 테마 일체화 스타일 카드 (눈 편한 미니멀 스타일) */
      .start-main-card {
        background: var(--panel) !important;
        border: 1px solid var(--border) !important;
        box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.2) !important;
        border-radius: 24px !important;
        animation: dynamicDropIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .start-main-card:focus-within {
        border-color: var(--border) !important;
        box-shadow: 0 20px 40px -4px rgba(0, 0, 0, 0.25) !important;
      }
    </style>

    <div
      id="start-screen" style="${localStorage.getItem('sellnance_skip_start') === 'true' ? 'display: none;' : 'display: flex;'}"
      class="fixed inset-0 z-[1000] flex items-center justify-center transition-opacity duration-500 overflow-hidden p-4 md:p-8 bg-theme-bg text-theme-text"
    >
      <div class="w-full max-w-6xl h-full max-h-[820px] flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 sm:gap-5 md:gap-8 relative z-10">
        
        <!-- 🚀 [좌측 (58% 비중)]: 3D 아이소메트릭 쿼터뷰 4대장 차트 덱 -->
        <div class="w-full md:w-[58%] h-auto md:h-[75vh] max-h-[240px] md:max-h-none relative flex items-center justify-center overflow-visible mb-2 md:mb-0">
          <div id="start-qv-preview-container" class="w-full relative overflow-visible pointer-events-none opacity-90 my-auto">
            <!-- 🚀 3D 덱 하단 바닥 투영 앰비언트 섀도우 (800px 황금비 직사각형 덱 전용) -->
            <div class="start-qv-floor-shadow"></div>

            <!-- 🚀 글로벌 그라데이션 SVG 정의 -->
            <svg width="0" height="0" class="absolute pointer-events-none">
              <defs>
                <linearGradient id="startProgressGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.8" />
                  <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.3" />
                </linearGradient>
              </defs>
            </svg>

            <!-- 1. Spread 3D 레이어 (4개 덱 전체를 아우르는 단일 외곽 프로그레스) -->
            <div id="start-qv-spread-view">
              <!-- 🚀 4개 카드 전체 둘레를 감싸는 단 1개의 3D 외곽 프로그레스 바 -->
              <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="var(--border)" stroke-width="0.7" />
                <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
              </svg>
              <div id="start-qv-cards-grid"></div>
            </div>

            <!-- 2. Overlap 3D 레이어 (내부 직접 3D 투영 프로그레스) -->
            <div id="start-qv-overlap-view">
              <svg class="start-qv-inner-progress" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="var(--border)" stroke-width="0.7" />
                <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
              </svg>
            </div>
          </div>
        </div>

        <!-- 🚀 [우측 (42% 비중)]: CMC 로그인 & 메인 대시보드 진입 패널 -->
        <div class="w-full md:w-[42%] max-w-md flex flex-col justify-center">
          <div class="start-main-card relative p-4 sm:p-6 md:p-8 w-full flex flex-col gap-3.5 md:gap-5 text-center">
            <!-- 🚀 우측 상단 다크/라이트 모드 토글 버튼 -->
            <button
              type="button"
              id="start-theme-toggle-btn"
              onclick="if (window.toggleTheme) window.toggleTheme();"
              class="absolute top-3 sm:top-4 right-3 sm:right-4 w-8 h-8 rounded-xl flex items-center justify-center text-sm bg-theme-bg/60 hover:bg-theme-bg border border-theme-border text-theme-text active:scale-90 cursor-pointer shadow-sm z-30 select-none transition-transform"
              title="다크 / 라이트 테마 전환"
            >
              ${(document.documentElement.classList.contains('theme-upbit') || document.body?.classList.contains('theme-upbit') || localStorage.getItem('sellnance_theme') === 'upbit') ? '🌙' : '☀️'}
            </button>
            <div>
              <h1 class="text-2xl md:text-4xl font-extrabold text-theme-accent uppercase tracking-widest mb-1">
                SELLNANCE
              </h1>
              <p class="text-theme-text opacity-70 text-xs md:text-sm font-medium tracking-wide">
                Enter CMC API Key to initialize dashboard
              </p>

              <div class="mt-2.5 px-3 py-2 bg-theme-bg/50 rounded-xl border border-theme-border/60 flex flex-col items-center justify-center gap-1 text-center">
                <div class="flex items-center justify-center gap-2">
                  <p class="text-[11px] text-theme-text opacity-70 font-medium">
                    API 키가 없으신가요?
                  </p>
                  <a
                    href="https://coinmarketcap.com/api/"
                    target="_blank"
                    class="text-theme-accent font-bold underline hover:opacity-80 transition-opacity text-[11px]"
                  >
                    무료 키 발급 ↗
                  </a>
                </div>
                <p class="text-[10px] text-theme-text opacity-50 border-t border-theme-border/30 pt-1.5 leading-tight text-center w-full">
                  💡 기본 1.5만 크레딧 (1회 약 3크레딧 소모 / 하루 100회 조회도 넉넉해요)
                </p>
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="relative w-full flex items-center">
                <input
                  type="text"
                  id="cmc-api-input"
                  placeholder="Loading..."
                  disabled
                  class="w-full bg-theme-bg text-theme-text border-2 border-theme-border pl-4 pr-11 py-2.5 md:py-3.5 rounded-xl text-center font-tempTestDss text-sm focus:outline-none focus:border-theme-accent shadow-inner opacity-50 cursor-not-allowed"
                  autocomplete="off"
                  spellcheck="false"
                />
                <!-- 🚀 감각적인 X 클리어 버튼 (입력 시 부드러운 스케일+페이드인) -->
                <button
                  type="button"
                  id="btn-clear-cmc-key"
                  class="absolute right-3 w-6 h-6 rounded-full flex items-center justify-center bg-theme-panel hover:bg-theme-border border border-theme-border text-theme-text/60 hover:text-theme-accent active:scale-90 transition-transform opacity-0 pointer-events-none scale-75"
                  title="입력 내용 지우기"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div class="flex flex-col gap-0.5 mt-0.5 px-1">
                <p class="text-[10px] text-theme-text opacity-40 text-left">
                  * Key is securely stored in your local browser.
                </p>
                <p class="text-[10px] text-theme-accent/80 text-left font-medium">
                  ** 키 없이도 서버에서 제공되는 일일 캐시 모드로 이용 가능해요
                </p>
              </div>
            </div>

            <div class="flex flex-col gap-2 mt-0.5">
              <!-- 1. 키 저장 및 대시보드 시작 (메인 액션) -->
              <button
                id="btn-start-engine"
                disabled
                onclick="saveAndStart()"
                class="w-full py-3 md:py-3.5 bg-theme-accent text-white font-bold rounded-xl shadow-sm hover:brightness-105 active:scale-[0.98] transition-transform tracking-widest uppercase cursor-not-allowed pointer-events-none text-xs md:text-sm"
              >
                불러오는 중.. 📡
              </button>

              <!-- 2. 바로 이동 (서브 액션) -->
              <button
                id="btn-skip-start"
                disabled
                onclick="skipAndStart()"
                class="w-full py-2.5 md:py-3 bg-theme-bg/40 text-theme-text border border-theme-border font-medium rounded-xl hover:bg-theme-panel active:scale-[0.98] transition-transform tracking-wide opacity-70 hover:opacity-100 cursor-not-allowed pointer-events-none text-xs"
              >
                불러오는 중...
              </button>

              <!-- 3. 🚀 시작 화면 자동 건너뛰기 공통 설정 (두 버튼 모두에 대응) -->
              <div class="flex items-center justify-center pt-1">
                <label
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-theme-border/20 cursor-pointer select-none group transition-all"
                >
                  <input type="checkbox" id="chk-auto-skip" class="accent-theme-accent w-3.5 h-3.5 rounded cursor-pointer" />
                  <span class="text-[11px] text-theme-text/70 group-hover:text-theme-text font-medium transition-colors">다음부터 시작 화면 건너뛰기</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
    `;
}

let rawCmcKey = "";

function maskApiKey(key) {
  if (!key) return "";
  const len = key.length;
  if (len <= 8) return key;

  const start = key.slice(0, 4);
  const end = key.slice(-4);
  const dots = "*".repeat(len - 8);
  return `${start}${dots}${end}`;
}

// ================= 4대장 퀵뷰 프리뷰 쇼케이스 엔진 =================
const START_ASSETS = [
  {
    symbol: "BTCUSDT",
    ticker: "BTC",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",
    color: "#f0b90b",
    rgba: "rgba(240, 185, 11, 0.65)",
  },
  {
    symbol: "ETHUSDT",
    ticker: "ETH",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
    color: "#3b82f6",
    rgba: "rgba(59, 130, 246, 0.65)",
  },
  {
    symbol: "XRPUSDT",
    ticker: "XRP",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png",
    color: "#26a69a",
    rgba: "rgba(38, 166, 154, 0.65)",
  },
  {
    symbol: "SOLUSDT",
    ticker: "SOL",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
    color: "#a855f7",
    rgba: "rgba(168, 85, 247, 0.65)",
  },
];

let startQvSpreadCharts = [];
let startQvSpreadSeries = [];
let startQvOverlapCharts = [];
let startQvOverlapSeries = [];
let startQvWs = null;
let startQvTimer = null;
let startQvCurrentTF = "15m";
let startQvCandleMode = "unique";
let startShowcaseStep = 0;

async function initStartQuickViewPreview() {
  const spreadView = document.getElementById("start-qv-spread-view");
  const overlapView = document.getElementById("start-qv-overlap-view");
  if (!spreadView || !overlapView) return;

  startQvSpreadCharts = [];
  startQvSpreadSeries = [];
  startQvOverlapCharts = [];
  startQvOverlapSeries = [];

  // 🚀 LightweightCharts 라이브러리 비동기 로드 대기
  if (typeof LightweightCharts === "undefined") {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (typeof LightweightCharts !== "undefined") {
          clearInterval(checkInterval);
          resolve();
        }
      }, 20);
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 4000);
    });
  }
  if (typeof LightweightCharts === "undefined") return;

  // 1️⃣ [Spread 뷰] 4개 2x2 카드 그리드 래퍼 & 단일 3D 외곽 프로그레스 바 생성
  spreadView.innerHTML = `
    <!-- 🚀 4개 카드 전체 둘레를 감싸는 단 1개의 3D 외곽 프로그레스 바 -->
    <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="rgba(0, 209, 255, 0.08)" stroke-width="0.7" />
      <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
    </svg>
    <div id="start-qv-cards-grid"></div>
  `;

  const cardsGrid = document.getElementById("start-qv-cards-grid");
  START_ASSETS.forEach((asset, idx) => {
    const card = document.createElement("div");
    card.className = "start-qv-card";
    card.id = `start-qv-spread-card-${idx}`;
    card.innerHTML = `
      <div class="start-qv-badge flex items-center gap-1.5">
        <img src="${asset.icon}" class="w-3.5 h-3.5 rounded-full object-cover shadow-sm flex-shrink-0" alt="${asset.ticker}" />
        <span class="text-xs font-bold" style="color: ${asset.color}">${asset.ticker}</span>
        <span id="start-qv-spread-tf-${idx}" class="text-[9px] px-1 py-0.2 font-mono font-bold rounded bg-theme-accent/20 border border-theme-accent/40 text-theme-accent">15M</span>
        <span id="start-qv-spread-price-${idx}" class="text-[10px] text-white/80 font-tempTestDss ml-1">Loading...</span>
      </div>
      <div class="start-qv-canvas" id="start-qv-spread-canvas-${idx}"></div>
    `;
    cardsGrid.appendChild(card);

    const canvasArea = card.querySelector(".start-qv-canvas");
    const chart = LightweightCharts.createChart(canvasArea, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.4)",
        fontSize: 9,
        fontFamily: "Outfit, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      rightPriceScale: { visible: false, borderVisible: false },
      timeScale: {
        visible: false,
        borderVisible: false,
        rightOffset: 1,
        fixLeftEdge: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    const seriesOptions = {
      upColor: asset.color,
      downColor: asset.color,
      wickUpColor: asset.color,
      wickDownColor: asset.color,
      borderVisible: false,
    };
    const series =
      typeof chart.addCandlestickSeries === "function"
        ? chart.addCandlestickSeries(seriesOptions)
        : chart.addSeries(
          window.LightweightCharts.CandlestickSeries,
          seriesOptions,
        );

    startQvSpreadCharts.push(chart);
    startQvSpreadSeries.push(series);
  });

  // 2️⃣ [Overlap 뷰] 중앙 통합 4대장 독립 캔들스틱 겹침(오버레이) 카드 생성 (반투명 캔들 블렌딩)
  overlapView.innerHTML = `
    <!-- 🚀 3D 투영 완전 일치 내장 프로그레스 테두리 -->
    <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="rgba(0, 209, 255, 0.08)" stroke-width="0.7" />
      <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
    </svg>
    <div class="start-qv-overlap-legend">
      <span class="text-[10px] uppercase tracking-wider text-theme-accent font-bold">OVERLAP</span>
      <span id="start-qv-overlap-tf" class="text-[9px] px-1.5 py-0.2 font-mono font-bold rounded bg-theme-accent/20 border border-theme-accent/40 text-theme-accent">15M</span>
      <div class="flex items-center gap-2 ml-2">
        ${START_ASSETS.map(
    (a, i) => `
          <div class="start-qv-legend-item flex items-center gap-1 cursor-pointer px-1.5 py-0.5" data-idx="${i}">
            <img src="${a.icon}" class="w-3 h-3 rounded-full object-cover flex-shrink-0" alt="${a.ticker}" />
            <span style="color: ${a.color}">${a.ticker}</span>
            <span id="start-qv-overlap-price-${i}" class="text-[10px] text-white/70 font-tempTestDss">...</span>
          </div>`,
  ).join("")}
      </div>
    </div>
    <div class="relative w-full flex-1 min-h-[80px]">
      ${START_ASSETS.map(
    (a, i) =>
      `<div class="start-qv-canvas absolute inset-0 w-full h-full" id="start-qv-overlap-canvas-${i}"></div>`,
  ).join("")}
    </div>
  `;

  const legendItems = overlapView.querySelectorAll(".start-qv-legend-item");
  legendItems.forEach((item) => {
    const idx = parseInt(item.getAttribute("data-idx"));
    item.addEventListener("mouseenter", () => setStartOverlapFocus(idx));
    item.addEventListener("mouseleave", () => setStartOverlapFocus(-1));
  });

  START_ASSETS.forEach((asset, idx) => {
    const overlapCanvasArea = document.getElementById(
      `start-qv-overlap-canvas-${idx}`,
    );
    if (!overlapCanvasArea) return;

    const chart = LightweightCharts.createChart(overlapCanvasArea, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.4)",
        fontSize: 9,
        fontFamily: "Outfit, sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          color: idx === 0 ? "rgba(255,255,255,0.03)" : "transparent",
        },
        horzLines: {
          color: idx === 0 ? "rgba(255,255,255,0.03)" : "transparent",
        },
      },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      rightPriceScale: { visible: false, borderVisible: false },
      timeScale: {
        visible: false,
        borderVisible: false,
        rightOffset: 1,
        fixLeftEdge: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    // 🚀 반투명(Translucent) 캔들 기본 적용 (서로 가리지 않는 자연스러운 오버레이)
    const seriesOptions = {
      upColor: asset.rgba,
      downColor: asset.rgba,
      wickUpColor: asset.rgba,
      wickDownColor: asset.rgba,
      borderVisible: false,
    };
    const series =
      typeof chart.addCandlestickSeries === "function"
        ? chart.addCandlestickSeries(seriesOptions)
        : chart.addSeries(
          window.LightweightCharts.CandlestickSeries,
          seriesOptions,
        );

    startQvOverlapCharts.push(chart);
    startQvOverlapSeries.push(series);
  });

  // 3️⃣ 바이낸스 데이터 최초 로드
  await loadStartPreviewKlines(startQvCurrentTF);

  // 4️⃣ 바이낸스 실시간 멀티 웹소켓 가동
  startStartPreviewWebSocket(startQvCurrentTF);

  // 5️⃣ cycleIntervalMs 주기 4-State 크로스페이드 루프 및 프로그레스 바 정밀 동기화 가동
  if (startQvTimer) clearInterval(startQvTimer);
  resetAndStartProgressBar();
  startQvTimer = setInterval(() => {
    toggleStartQuickViewLayout();
  }, START_3D_CONFIG.cycleIntervalMs);

  // 6️⃣ 윈도우 리사이즈 시 왜곡 없는 동기화 리사이즈 바인딩
  window.removeEventListener("resize", resizeStartQuickViewCharts);
  window.addEventListener("resize", resizeStartQuickViewCharts);

  setTimeout(() => {
    resizeStartQuickViewCharts();
  }, 100);
}

// 🎯 겹치기 모드 범례 호버 시 특정 코인 강조 & 나머지 반투명 디밍
function setStartOverlapFocus(focusIdx) {
  START_ASSETS.forEach((asset, i) => {
    const canvas = document.getElementById(`start-qv-overlap-canvas-${i}`);
    const legendItem = document.querySelector(
      `.start-qv-legend-item[data-idx="${i}"]`,
    );
    if (!canvas) return;
    if (focusIdx === -1) {
      canvas.style.opacity = "0.55";
      if (legendItem) {
        legendItem.style.borderColor = "transparent";
        legendItem.style.opacity = "1";
      }
    } else if (i === focusIdx) {
      canvas.style.opacity = "1";
      if (legendItem) {
        legendItem.style.borderColor = asset.color;
        legendItem.style.opacity = "1";
      }
    } else {
      canvas.style.opacity = "0.2";
      if (legendItem) {
        legendItem.style.borderColor = "transparent";
        legendItem.style.opacity = "0.4";
      }
    }
  });
}

// 📡 과거 봉 데이터 로드
async function loadStartPreviewKlines(tf) {
  const promises = START_ASSETS.map(async (asset, idx) => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${asset.symbol}&interval=${tf}&limit=60`,
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        const candles = data.map((d) => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        }));

        if (startQvSpreadSeries[idx]) {
          startQvSpreadSeries[idx].setData(candles);
          if (startQvSpreadCharts[idx]) {
            startQvSpreadCharts[idx].timeScale().fitContent();
            startQvSpreadCharts[idx]
              .timeScale()
              .applyOptions({ rightOffset: 1 });
          }
        }

        if (startQvOverlapSeries[idx]) {
          startQvOverlapSeries[idx].setData(candles);
          if (startQvOverlapCharts[idx]) {
            startQvOverlapCharts[idx].timeScale().fitContent();
            startQvOverlapCharts[idx]
              .timeScale()
              .applyOptions({ rightOffset: 1 });
          }
        }

        const lastPrice = candles[candles.length - 1]?.close;
        if (lastPrice) {
          const spEl = document.getElementById(`start-qv-spread-price-${idx}`);
          const ovEl = document.getElementById(`start-qv-overlap-price-${idx}`);
          if (spEl) spEl.innerText = `$${lastPrice.toLocaleString()}`;
          if (ovEl) ovEl.innerText = `$${lastPrice.toLocaleString()}`;
        }
      }
    } catch (e) { }
  });
  await Promise.all(promises);
}

let startQvLastUpdateTimes = {};

// 🌐 실시간 웹소켓 가동 (🚀 시작 화면 최적화: 1초 쓰로틀링 적용)
function startStartPreviewWebSocket(tf) {
  if (startQvWs) {
    const oldWs = startQvWs;
    oldWs.onmessage = null;
    oldWs.onclose = null;
    oldWs.onerror = null;
    if (oldWs.readyState === WebSocket.CONNECTING) {
      oldWs.onopen = () => {
        try {
          oldWs.close(1000, "Normal Closure");
        } catch (e) { }
      };
    } else {
      try {
        oldWs.close(1000, "Normal Closure");
      } catch (e) { }
    }
    startQvWs = null;
  }
  startQvLastUpdateTimes = {};
  try {
    const streams = START_ASSETS.map(
      (a) => `${a.symbol.toLowerCase()}@kline_${tf}`,
    ).join("/");
    startQvWs = new WebSocket(
      `wss://stream.binance.com:9443/stream?streams=${streams}`,
    );
    startQvWs.onmessage = (e) => {
      try {
        const res = JSON.parse(e.data);
        if (!res.data || !res.data.k) return;
        const k = res.data.k;
        const symbol = res.data.s;

        // 🚀 [1초 쓰로틀]: 틱이 아무리 쏟아져도 코인별로 정확히 1초(1000ms)에 1회만 캔버스/시세 갱신
        const now = Date.now();
        if (
          startQvLastUpdateTimes[symbol] &&
          now - startQvLastUpdateTimes[symbol] < 500
        ) {
          return;
        }
        startQvLastUpdateTimes[symbol] = now;

        const idx = START_ASSETS.findIndex((a) => a.symbol === symbol);
        if (idx !== -1) {
          const candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          };
          if (startQvSpreadSeries[idx]) startQvSpreadSeries[idx].update(candle);
          if (startQvOverlapSeries[idx])
            startQvOverlapSeries[idx].update(candle);

          const spEl = document.getElementById(`start-qv-spread-price-${idx}`);
          const ovEl = document.getElementById(`start-qv-overlap-price-${idx}`);
          if (spEl) spEl.innerText = `$${candle.close.toLocaleString()}`;
          if (ovEl) ovEl.innerText = `$${candle.close.toLocaleString()}`;
        }
      } catch (err) { }
    };
  } catch (err) { }
}

// ⏱️ 캔들 색상 동적 전환 (네온 고유색 vs 클래식 양음봉)
function applyStartCandleTheme(candleMode) {
  START_ASSETS.forEach((asset, idx) => {
    let upSpread = asset.color;
    let downSpread = asset.color;
    let upOverlap = asset.rgba;
    let downOverlap = asset.rgba;

    if (candleMode === "default") {
      upSpread = "#0ecb81";
      downSpread = "#f6465d";
      upOverlap = "rgba(14, 203, 129, 0.65)";
      downOverlap = "rgba(246, 70, 93, 0.65)";
    }

    if (startQvSpreadSeries[idx]) {
      startQvSpreadSeries[idx].applyOptions({
        upColor: upSpread,
        downColor: downSpread,
        wickUpColor: upSpread,
        wickDownColor: downSpread,
      });
    }

    if (startQvOverlapSeries[idx]) {
      startQvOverlapSeries[idx].applyOptions({
        upColor: upOverlap,
        downColor: downOverlap,
        wickUpColor: upOverlap,
        wickDownColor: downOverlap,
      });
    }
  });
}

// ⏱️ 타임프레임 동적 순환
async function switchStartPreviewTF(tf) {
  START_ASSETS.forEach((asset, idx) => {
    const spTf = document.getElementById(`start-qv-spread-tf-${idx}`);
    if (spTf) spTf.innerText = tf.toUpperCase();
  });
  const ovTf = document.getElementById("start-qv-overlap-tf");
  if (ovTf) ovTf.innerText = tf.toUpperCase();

  await loadStartPreviewKlines(tf);
  startStartPreviewWebSocket(tf);
}

// ⏱️ 3D 투영 프로그레스 바 0% 리셋 및 정밀 타이머 동기화 엔진
function resetAndStartProgressBar() {
  const progressRects = document.querySelectorAll(".start-qv-progress-rect");
  progressRects.forEach((rect) => {
    rect.style.animation = "none";
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progressRects.forEach((rect) => {
        rect.style.animation = `startBorderProgress ${START_3D_CONFIG.cycleIntervalMs}ms linear infinite`;
      });
    });
  });
}

// 🚀 [왜곡 없는 크로스페이드 & 자연스러운 모핑 모으기/뿌리기 전환 엔진] 4가지 경우의 수 순환
function toggleStartQuickViewLayout() {
  const spreadView = document.getElementById("start-qv-spread-view");
  const overlapView = document.getElementById("start-qv-overlap-view");
  if (!spreadView || !overlapView) return;

  // 1. 4가지 경우의 수 순환
  startShowcaseStep = (startShowcaseStep + 1) % START_SHOWCASE_STATES.length;
  const currentShowcase = START_SHOWCASE_STATES[startShowcaseStep];

  // 2. 유니크 캔들 색상 적용
  applyStartCandleTheme(currentShowcase.candleMode);

  // 3. 타임프레임 전환
  if (startQvCurrentTF !== currentShowcase.tf) {
    startQvCurrentTF = currentShowcase.tf;
    switchStartPreviewTF(currentShowcase.tf);
  }

  // 4. 개별 카드 물리적 모핑 (중앙으로 스르륵 모이고 퍼지는 유기적 물리 움직임)
  const card0 = document.getElementById("start-qv-spread-card-0");
  const card1 = document.getElementById("start-qv-spread-card-1");
  const card2 = document.getElementById("start-qv-spread-card-2");
  const card3 = document.getElementById("start-qv-spread-card-3");

  // 🧭 화면 전환 시 동서남북 8방위 시선 틸트 한 단계 순환 (예: 북동 ➡️ 북서 ➡️ 남서 ➡️ 남동)
  startCompassStep++;

  if (currentShowcase.layout === "spread") {
    // 🚀 모였다가 4개 모서리 제자리로 스르륵 퍼짐 (설정된 3D 각도 연동)
    spreadView.style.opacity = "1";
    spreadView.style.transform = get3DTransform(1);
    spreadView.style.pointerEvents = "auto";
    if (card0) card0.style.transform = "translate(0, 0)";
    if (card1) card1.style.transform = "translate(0, 0)";
    if (card2) card2.style.transform = "translate(0, 0)";
    if (card3) card3.style.transform = "translate(0, 0)";

    overlapView.style.opacity = "0";
    overlapView.style.transform = get3DTransform(0.96);
    overlapView.style.pointerEvents = "none";
  } else {
    // 🚀 4개 코너에서 중앙으로 스르륵 모임 (설정된 3D 각도 연동)
    spreadView.style.opacity = "0";
    spreadView.style.transform = get3DTransform(1.04);
    spreadView.style.pointerEvents = "none";
    if (card0) card0.style.transform = "translate(18%, 18%)";
    if (card1) card1.style.transform = "translate(-18%, 18%)";
    if (card2) card2.style.transform = "translate(18%, -18%)";
    if (card3) card3.style.transform = "translate(-18%, -18%)";

    overlapView.style.opacity = "1";
    overlapView.style.transform = get3DTransform(1);
    overlapView.style.pointerEvents = "auto";
  }

  // ⏱️ 3D 투영 일치 프로그레스 바 애니메이션 0%부터 정밀 재시작
  resetAndStartProgressBar();

  // 🌑 3D 각도별 광원 반사 오프셋 & 스케일 실시간 동기화 (시선 방향의 정반대 축으로 완벽 투영)
  const floorShadow = document.querySelector(".start-qv-floor-shadow");
  if (floorShadow) {
    const scale = currentShowcase.layout === "spread" ? 1.04 : 0.96;
    floorShadow.style.transform = getShadowTransform(scale);
    floorShadow.style.opacity = (
      START_3D_CONFIG.auraOpacity *
      (currentShowcase.layout === "spread" ? 1.0 : 0.8)
    ).toFixed(2);
  }

  resizeStartQuickViewCharts();
  setTimeout(() => {
    resizeStartQuickViewCharts();
  }, 860);
}

function resizeStartQuickViewCharts() {
  startQvSpreadCharts.forEach((chart, idx) => {
    if (!chart) return;
    const canvas = document.getElementById(`start-qv-spread-canvas-${idx}`);
    if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      chart.resize(canvas.clientWidth, canvas.clientHeight);
      chart.timeScale().fitContent();
      chart.timeScale().applyOptions({ rightOffset: 1 });
    }
  });

  startQvOverlapCharts.forEach((chart, idx) => {
    if (!chart) return;
    const canvas = document.getElementById(`start-qv-overlap-canvas-${idx}`);
    if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      chart.resize(canvas.clientWidth, canvas.clientHeight);
      chart.timeScale().fitContent();
      chart.timeScale().applyOptions({ rightOffset: 1 });
    }
  });
}

function destroyStartQuickViewPreview() {
  if (startQvTimer) {
    clearInterval(startQvTimer);
    startQvTimer = null;
  }
  if (startQvWs) {
    try {
      startQvWs.close();
    } catch (e) { }
    startQvWs = null;
  }
  window.removeEventListener("resize", resizeStartQuickViewCharts);
  startQvSpreadCharts.forEach((c) => {
    if (c) {
      try {
        c.remove();
      } catch (e) { }
    }
  });
  startQvOverlapCharts.forEach((c) => {
    if (c) {
      try {
        c.remove();
      } catch (e) { }
    }
  });
  startQvSpreadCharts = [];
  startQvSpreadSeries = [];
  startQvOverlapCharts = [];
  startQvOverlapSeries = [];
}

async function initStartScreen() {
  // 🚀 Start Screen HTML을 body에 동적으로 추가 (기본 style="display: none;" 상태로 삽입)
  document.body.insertAdjacentHTML("beforeend", getStartScreenHTML());

  const input = document.getElementById("cmc-api-input");
  const btnStart = document.getElementById("btn-start-engine");
  const btnSkip = document.getElementById("btn-skip-start");

  // ============== 기존 비즈니스 로직 철통 보존 (단 1줄도 안건드림) ==============
  // 1. 서버 환경변수(env)에서 키 가져오기 (확실히 올 때까지 기다림)
  try {
    // Xconsole.log("📡 서버에서 env 키 조회 중...");
    const res = await fetch("/api/get-env-key");
    const data = await res.json();

    const isAutoSkipEnabled =
      localStorage.getItem("sellnance_skip_start") === "true";
    rawCmcKey = localStorage.getItem("CMC_API_KEY") || "";

    const hasDirectSymbol =
      window.location.pathname &&
      window.location.pathname !== "/" &&
      window.location.pathname !== "";

    // 🚀 다이렉트 심볼 접근(/BTC 등) 또는 스킵 설정 시 즉시 대시보드로 진입!
    if (isAutoSkipEnabled || hasDirectSymbol) {
      hideStartScreen();
      return;
    }
  } catch (e) {
    // Xconsole.error("🚨 서버 통신 실패, 로컬 스토리지로 대체합니다.");
    rawCmcKey = localStorage.getItem("CMC_API_KEY") || "";
    const hasDirectSymbol =
      window.location.pathname &&
      window.location.pathname !== "/" &&
      window.location.pathname !== "";
    if (localStorage.getItem("sellnance_skip_start") === "true" || hasDirectSymbol) {
      hideStartScreen();
      return;
    }
  } finally {
    // 🚀 공백이든 값 없든 무조건 불러오기 작업 이후 활성화!
    if (input) {
      input.disabled = false;
      input.placeholder = "Paste your CMC API Key...";
      input.classList.remove("opacity-50", "cursor-not-allowed");
    }

    if (btnStart) {
      btnStart.disabled = false;
      btnStart.innerText = "Start Dashboard";
      btnStart.className =
        "flex-1 py-3.5 bg-theme-accent text-white font-semibold rounded-xl shadow-sm hover:brightness-105 active:scale-[0.98] transition-transform tracking-widest uppercase cursor-pointer pointer-events-auto border border-theme-accent/40";
    }

    if (btnSkip) {
      btnSkip.disabled = false;
      btnSkip.innerText = "바로 이동 (서버 캐시 모드, 느린 갱신)";
      btnSkip.className =
        "w-full py-3 bg-theme-bg/40 text-theme-text border border-theme-border font-medium rounded-xl hover:bg-theme-panel active:scale-[0.98] transition-transform tracking-wide opacity-70 hover:opacity-100 cursor-pointer pointer-events-auto";
    }
  }

  // 2. 가져온 키가 있다면 "즉시" 인풋 박스에 마스킹해서 보여줌
  if (rawCmcKey && input) {
    input.value = maskApiKey(rawCmcKey);
  }

  // 🚀 X 클리어 버튼 가시성 및 이원화(실제 키 + 마스킹 텍스트) 제어 함수
  const btnClearKey = document.getElementById("btn-clear-cmc-key");
  function updateClearBtnVisibility() {
    if (!btnClearKey) return;
    const hasValue = !!(rawCmcKey || (input && input.value));
    if (hasValue) {
      btnClearKey.classList.remove(
        "opacity-0",
        "pointer-events-none",
        "scale-75",
      );
      btnClearKey.classList.add(
        "opacity-100",
        "pointer-events-auto",
        "scale-100",
      );
    } else {
      btnClearKey.classList.remove(
        "opacity-100",
        "pointer-events-auto",
        "scale-100",
      );
      btnClearKey.classList.add("opacity-0", "pointer-events-none", "scale-75");
    }
  }

  // 초기 X 버튼 상태 업데이트
  updateClearBtnVisibility();

  // 🚀 X 클리어 버튼 클릭 이벤트: 실제 키 + 마스킹 텍스트 + 로컬스토리지 완전 이원화 동시 초기화
  if (btnClearKey) {
    btnClearKey.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      rawCmcKey = "";
      if (input) {
        input.value = "";
        input.focus();
      }
      localStorage.removeItem("CMC_API_KEY");
      updateClearBtnVisibility();
    });
  }

  // 🚀 Skip 체크박스 상태 동기화 및 실시간 저장
  const chkAutoSkip = document.getElementById("chk-auto-skip");
  if (chkAutoSkip) {
    chkAutoSkip.checked =
      localStorage.getItem("sellnance_skip_start") === "true";
    chkAutoSkip.addEventListener("change", (e) => {
      if (e.target.checked) {
        localStorage.setItem("sellnance_skip_start", "true");
      } else {
        localStorage.removeItem("sellnance_skip_start");
      }
    });
  }

  // 🚀 [선택한 해결방안 적용]: 자동 스킵되지 않고 화면을 실제로 노출해야 하는 상태
  // 이 단계에 도달했다는 것은 서버 env에 키가 없음을 뜻하므로 화면을 노출하고 PixiJS 엔진을 기동합니다.
  const startScreen = document.getElementById("start-screen");
  if (startScreen) {
    startScreen.style.display = "flex";
  }
  /* [기존 코드 주석 보존]
  await initPixiBackground();
  */
  await initStartQuickViewPreview();

  // 🚀 수정된 부분: beforeinput 이벤트 핸들러
  input.addEventListener("beforeinput", (e) => {
    // 1. 글자 추가 시 (e.data가 존재할 때)
    if (e.data) {
      // 💡 [핵심] 영어와 숫자만 허용하는 정규식 검사
      const isAlphaNumeric = /^[a-zA-Z0-9]+$/.test(e.data);

      if (isAlphaNumeric) {
        rawCmcKey += e.data;
      } else {
        // 영어/숫자가 아니면 입력을 무시하고 튕겨냄
        e.preventDefault();
        return;
      }
    }
    // 2. 백스페이스(삭제) 시
    else if (e.inputType === "deleteContentBackward") {
      rawCmcKey = rawCmcKey.slice(0, -1);
    }
    updateClearBtnVisibility();
  });

  // 🚀 붙여넣기(Paste) 시에도 필터링하고 싶다면 input 이벤트 수정
  input.addEventListener("input", (e) => {
    const val = e.target.value;

    // 붙여넣기 대응: 마스킹 별표가 없는 경우 (통째로 새로 들어온 경우)
    if (!val.includes("*") && val !== "") {
      // 영어와 숫자만 남기고 나머지(한글, 특수문자 등) 싹 제거
      rawCmcKey = val.replace(/[^a-zA-Z0-9]/g, "");
    }

    // 화면에는 마스킹된 결과만 출력
    input.value = maskApiKey(rawCmcKey);
    updateClearBtnVisibility();
  });

  // 포커스/블러 시 마스킹 상태 및 X 버튼 가시성 유지
  input.addEventListener("focus", () => {
    updateClearBtnVisibility();
  });

  input.addEventListener("blur", () => {
    input.value = maskApiKey(rawCmcKey);
    updateClearBtnVisibility();
  });
}

function saveAndStart() {
  const keyToSave = rawCmcKey.trim();
  // 🚨 32글자 유효성 검사 (확인/취소 버튼 없는 세련된 상단 토스트 알림)
  if (keyToSave.length !== 32) {
    const input = document.getElementById("cmc-api-input");
    if (input) {
      input.classList.add(
        "!border-red-500/80",
        "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
      );
      setTimeout(() => {
        input.classList.remove(
          "!border-red-500/80",
          "shadow-[0_0_15px_rgba(239,68,68,0.3)]",
        );
      }, 2000);
      input.focus();
    }

    if (window.Swal) {
      Swal.fire({
        toast: true,
        position: "top",
        icon: "warning",
        title: `CMC API 키는 32자여야 합니다 (${keyToSave.length}/32자)`,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        background: "rgba(18, 21, 28, 0.95)",
        color: "#ffffff",
        customClass: {
          popup:
            "border border-amber-500/30 rounded-xl shadow-2xl backdrop-blur-md text-xs",
        },
      });
    }
    return;
  }

  // 🚀 건너뛰기 체크박스 상태 저장
  const chk = document.getElementById("chk-auto-skip");
  if (chk && chk.checked) {
    localStorage.setItem("sellnance_skip_start", "true");
  } else {
    localStorage.removeItem("sellnance_skip_start");
  }

  // 🚀 [INP 최적화 1] 클릭 즉시 시각적 피드백 제공 (Next Paint 가속)
  const btn = document.querySelector("#start-screen button");
  if (btn) {
    btn.innerText = "STARTING DASHBOARD... 🚀";
    btn.style.pointerEvents = "none";
  }

  // 🚀 [INP 최적화 2] 브라우저가 화면을 즉시 페인트할 수 있도록 메인 스레드 양보 (Yielding to Main Thread)
  requestAnimationFrame(() => {
    setTimeout(() => {
      localStorage.setItem("CMC_API_KEY", keyToSave);
      hideStartScreen();
    }, 0);
  });
}

// 🚀 Skip (일일캐시 모드 진입)
function skipAndStart() {
  // Xconsole.log("⏭️ [스킵] 일일캐시 데이터로 진입합니다.");

  // 🚀 건너뛰기 체크박스 상태 저장
  const chk = document.getElementById("chk-auto-skip");
  if (chk && chk.checked) {
    localStorage.setItem("sellnance_skip_start", "true");
  } else {
    localStorage.removeItem("sellnance_skip_start");
  }

  // 🚀 [INP 최적화 1] 클릭 즉시 시각적 피드백 제공
  const buttons = document.querySelectorAll("#start-screen button");
  if (buttons.length > 1 && buttons[1]) {
    buttons[1].innerText = "ENTERING CACHE MODE...";
    buttons[1].style.pointerEvents = "none";
  }

  // 🚀 [INP 최적화 2] 메인 스레드 양보 (Yielding)로 클릭 지연 시간(INP)을 0ms 수준으로 단축!
  requestAnimationFrame(() => {
    setTimeout(() => {
      hideStartScreen();
    }, 0);
  });
}

function hideStartScreen() {
  /* 🚀 [기존 코드 주석 보존] Pixi Application 소각
  if (pixiApp) {
    try {
      pixiApp.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch (e) {
      Xconsole.error("Error destroying Pixi app:", e);
    }
    pixiApp = null;
  }
  */

  // 🚀 스타트 스크린 퇴장 시 4대장 퀵뷰 프리뷰 엔진 및 소켓 자원 소각
  destroyStartQuickViewPreview();

  // 🚀 [핵심] 사용자가 Start / Skip 버튼을 누른 바로 이 시점에 비로소 대시보드 데이터 및 실시간 엔진을 점화합니다!
  document.documentElement.classList.remove("start-screen-active");
  if (typeof window.initDashboardEngine === "function") {
    window.initDashboardEngine();
  }
  if (typeof window.restoreControlPanelUI === "function") {
    window.restoreControlPanelUI();
  }

  const screen = document.getElementById("start-screen");
  if (screen) {
    // 🚀 빨려 들어가는 듯한 스피디한 퇴장 이펙트 (blur는 무거우므로 부드럽게만 적용)
    screen.style.transform = "scale(1.2) translateZ(100px)";
    screen.style.opacity = "0";
    // screen.style.filter = "blur(8px)"; // backdrop-filter와 충돌 및 성능 저하 우려로 주석처리

    setTimeout(() => {
      screen.style.display = "none";
      if (typeof window.showOnboardingModal === "function") {
        window.showOnboardingModal();
      }
    }, 500);
  } else {
    if (typeof window.showOnboardingModal === "function") {
      window.showOnboardingModal();
    }
  }
}

export async function showStartScreen() {
  const screen = document.getElementById("start-screen");
  if (!screen) {
    await initStartScreen();
    return;
  }

  const btnStart = document.getElementById("btn-start-engine");
  const btnSkip = document.getElementById("btn-skip-start");
  if (btnStart) {
    btnStart.innerText = "Start Dashboard";
    btnStart.style.pointerEvents = "auto";
  }
  if (btnSkip) {
    btnSkip.innerText = "바로 이동 (서버 캐시 모드, 느린 갱신)";
    btnSkip.style.pointerEvents = "auto";
  }

  const chk = document.getElementById("chk-auto-skip");
  if (chk) {
    chk.checked = localStorage.getItem("sellnance_skip_start") === "true";
  }

  const themeBtn = document.getElementById("start-theme-toggle-btn");
  if (themeBtn) {
    const isUpbit = document.body.classList.contains("theme-upbit") || localStorage.getItem("sellnance_theme") === "upbit";
    themeBtn.innerHTML = isUpbit ? "🌙" : "☀️";
  }

  // 🚀 [쇼케이스 0초 및 1단계 완전 리셋]
  startShowcaseStep = 0;
  startCompassStep = 0;
  startQvCurrentTF = START_SHOWCASE_STATES[0].tf;

  // 1. 기존 타이머 및 소켓 안전 정리
  if (startQvTimer) {
    clearInterval(startQvTimer);
    startQvTimer = null;
  }
  if (startQvWs) {
    try {
      startQvWs.close();
    } catch (e) { }
    startQvWs = null;
  }

  // 2. 차트 인스턴스가 소각된 상태라면 재초기화
  if (!startQvSpreadCharts || startQvSpreadCharts.length === 0) {
    await initStartQuickViewPreview();
  }

  // 3. 1단계 상태(Spread 4분할, 4시간봉, 고유 네온 컬러) 즉시 복원 적용
  const currentShowcase = START_SHOWCASE_STATES[0];
  applyStartCandleTheme(currentShowcase.candleMode);

  const spreadView = document.getElementById("start-qv-spread-view");
  const overlapView = document.getElementById("start-qv-overlap-view");
  const card0 = document.getElementById("start-qv-spread-card-0");
  const card1 = document.getElementById("start-qv-spread-card-1");
  const card2 = document.getElementById("start-qv-spread-card-2");
  const card3 = document.getElementById("start-qv-spread-card-3");

  if (spreadView && overlapView) {
    spreadView.style.opacity = "1";
    spreadView.style.transform = get3DTransform(1);
    spreadView.style.pointerEvents = "auto";
    if (card0) card0.style.transform = "translate(0, 0)";
    if (card1) card1.style.transform = "translate(0, 0)";
    if (card2) card2.style.transform = "translate(0, 0)";
    if (card3) card3.style.transform = "translate(0, 0)";

    overlapView.style.opacity = "0";
    overlapView.style.transform = get3DTransform(0.96);
    overlapView.style.pointerEvents = "none";
  }

  // 4. 타이머 및 3D 프로그레스 바 0%부터 정밀 재생 시작
  if (startQvTimer) clearInterval(startQvTimer);
  resetAndStartProgressBar();
  startQvTimer = setInterval(() => {
    toggleStartQuickViewLayout();
  }, START_3D_CONFIG.cycleIntervalMs);

  screen.style.display = "flex";
  screen.style.pointerEvents = "auto";
  requestAnimationFrame(() => {
    screen.style.transform = "scale(1) translateZ(0px)";
    screen.style.opacity = "1";
    resizeStartQuickViewCharts();
  });

  if (window.history && window.history.pushState) {
    if (window.location.pathname !== "/" || window.location.hash) {
      window.history.pushState(null, null, "/");
    }
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initStartScreen);
} else {
  initStartScreen();
}

window.saveAndStart = saveAndStart;
window.skipAndStart = skipAndStart;
window.showStartScreen = showStartScreen;
