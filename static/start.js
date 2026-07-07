// start.js
// 🚀 스타트뷰 엔진: 실시간 마스킹 + env 연동 + 유효성 검사
// 🚀 스타트뷰 엔진: 무한 확장 마스킹 버전
// 🚀 스타트뷰 엔진: 완전 가변형 마스킹 (글자수 무제한)
// 🚀 [UI업그레이드 V2] Zero-Delay, 버그 수정, Organic & Speedy Magician Dynamic Network
// 🚀 [성능 최적화] Pixi.js (WebGL) 도입 - DOM 렌더링을 GPU 가속 스크립트로 대체하여 렉 제거
// 🚀 [회전 수정] 라디안 단위 혼선 해결 및 자연스러운 회전 적용

// (필수) HTML head에 아래 라이브러리 스크립트가 포함되어 있어야 합니다.
// <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js"></script>

function getStartScreenHTML() {
  return `
    <style>
      #start-screen {
        background: #06070a !important; 
        font-family: 'Outfit', sans-serif;
        perspective: 1200px;
        overflow: hidden; /* Pixi 캔버스 넘침 방지 */
      }
      
      /* 🚀 PixiJS WebGL 캔버스가 그려질 컨테이너 */
      #pixi-canvas-container {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
      }

      /* 드로퍼(Dropper) 느낌의 다이내믹 등장 애니메이션 */
      @keyframes dynamicDropIn {
        0% { transform: translateZ(-200px) translateY(-50px) scale(0.8); opacity: 0; }
        100% { transform: translateZ(0) translateY(0) scale(1); opacity: 1; }
      }

      /* 메인 글래스 카드 */
      .glass-card {
        background: linear-gradient(145deg, rgba(15, 17, 26, 0.75), rgba(6, 7, 10, 0.95)) !important;
        backdrop-filter: blur(35px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(35px) saturate(200%) !important;
        border: 1px solid rgba(0, 209, 255, 0.2) !important;
        box-shadow: 0 40px 120px rgba(0, 0, 0, 0.9), 
                    0 0 50px rgba(0, 209, 255, 0.08),
                    inset 0 1px 2px rgba(255, 255, 255, 0.15) !important;
        border-radius: 24px !important;
        animation: dynamicDropIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: all 0.3s ease;
      }
      .glass-card:focus-within {
        border-color: rgba(0, 209, 255, 0.6) !important;
        box-shadow: 0 40px 120px rgba(0, 0, 0, 0.9), 
                    0 0 80px rgba(0, 209, 255, 0.25) !important;
      }
    </style>

    <div
      id="start-screen"
      class="fixed items-center justify-center inset-0 z-[1000] flex transition-opacity duration-500 pt-16"
    >
      <!-- 🚀 기존 Canvas/DOM 방식 대신 WebGL 컨테이너 배치 -->
      <div id="pixi-canvas-container"></div>
      
      <div
        class="relative z-10 glass-card p-8 w-[90%] max-w-md flex flex-col gap-6 text-center"
      >
        <div>
          <h1
            class="text-4xl font-medium text-theme-accent uppercase tracking-widest mb-2 drop-shadow-[0_0_20px_rgba(0,209,255,0.6)]"
          >
            sellance
          </h1>
          <p class="text-theme-text opacity-80 text-sm font-medium tracking-wide">
            Enter CMC API Key to initialize.
          </p>

          <div
            class="mt-3 py-2 px-3 bg-black/40 rounded-lg border border-theme-accent/20"
          >
            <p class="text-[11px] text-theme-text opacity-60 leading-relaxed">
              API 키가 없으신가요?
            </p>
            <div class="mt-1">
              <a
                href="https://coinmarketcap.com/api/"
                target="_blank"
                class="text-theme-accent font-medium underline hover:text-white transition-colors ml-1 text-[11px] drop-shadow-md"
              >
                CoinMarketCap API Dashboard
              </a>
              <span class="text-[11px] text-theme-text opacity-60">에서 무료 키를 발급받을 수 있습니다.</span>
            </div>
            <p class="text-[10px] text-theme-text opacity-40 mt-1.5 border-t border-theme-accent/10 pt-1.5 leading-normal text-center">
              💡 무료 기본 한도: 월 20,000 크레딧 (분당 최대 50회 호출 제한)
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <input
            type="text"
            id="cmc-api-input"
            placeholder="Loading..."
            disabled
            class="w-full bg-black/60 text-theme-text border-2 border-theme-border/50 px-4 py-3.5 rounded-xl text-center font-tempTestDss text-sm focus:outline-none focus:border-theme-accent transition-all shadow-inner opacity-50 cursor-not-allowed"
            autocomplete="off"
            spellcheck="false"
          />

          <div class="flex flex-col gap-1 mt-1 px-1">
            <p class="text-[10px] text-theme-text opacity-40 text-left">
              * Key is securely stored in your local browser.
            </p>
            <p
              class="text-[10px] text-theme-accent/70 text-left font-medium italic"
            >
              ** 키가 없어도 Skip을 누르면 서버 캐시 데이터로 대시보드 진입이
              가능합니다.
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-3 mt-2">
          <button
            id="btn-start-engine"
            disabled
            onclick="saveAndStart()"
            class="w-full py-3.5 bg-theme-accent/60 text-white/50 font-medium rounded-xl shadow-lg transition-all tracking-widest uppercase cursor-not-allowed pointer-events-none"
          >
            ?1 불러오는 중.. 📡
          </button>
          <button
            id="btn-skip-start"
            disabled
            onclick="skipAndStart()"
            class="w-full py-3 bg-transparent text-theme-text/50 border border-theme-border/50 font-medium rounded-xl transition-all tracking-wide opacity-50 cursor-not-allowed pointer-events-none"
          >
            ?2 불러오는 중.. 📡
          </button>
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

// 🚀 [추가:성능최적화] PixiJS를 이용한 GPU 가속 백그라운드 엔진
let pixiApp = null; // 대시보드 진입 시 메모리 및 Ticker 정지를 위한 변수

async function initPixiBackground() {
  // 🚀 PIXI 라이브러리가 로드될 때까지 안전하게 대기 (비동기 스크립트 로딩 대응)
  if (typeof PIXI === "undefined") {
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (typeof PIXI !== "undefined") {
          clearInterval(checkInterval);
          resolve();
        }
      }, 20);
      // 최대 5초간 대기 후 타임아웃
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }

  if (typeof PIXI === "undefined") {
    console.error("🚨 PIXI is not defined. PixiJS background initialization skipped.");
    return;
  }

  const container = document.getElementById('pixi-canvas-container');
  if (!container) return;

  // 1. Pixi Application 생성 (WebGL 자동 선택, 렉 제거의 핵심)
  const app = new PIXI.Application({
    backgroundAlpha: 0, // 배경 투명 (CSS 배경 사용)
    resizeTo: container, // 컨테이너 크기에 맞춤
    antialias: false, // 안티앨리어싱 비활성화 (렉 방지 극대화)
    resolution: window.devicePixelRatio || 1, // 레티나 디스플레이 대응
    autoDensity: true
  });
  pixiApp = app; // 외부 참조용 변수에 저장
  container.appendChild(app.view); // 캔버스 삽입

  // 2. 코인 텍스처 (이미지) 미리 로드 (24개에서 8개로 대폭 감축)
  const coinIds = [1, 1027, 5426, 52, 2010, 5805, 74, 6636];

  // 텍스처 로딩 중 화면이 끊기지 않게 비동기로 처리
  const textures = coinIds.map(id => PIXI.Texture.from(`https://s2.coinmarketcap.com/static/img/coins/64x64/${id}.png`));

  // 3. 그래픽 레이어 생성 (체인 네트워크 파티클)
  const graphics = new PIXI.Graphics();
  app.stage.addChild(graphics);

  const particles = [];
  // 파티클 수 대폭 감축 (고정 25개로 축소하여 연산량 및 드로잉 부하 극단적 최소화)
  const numParticles = 25;

  for (let i = 0; i < numParticles; i++) {
    particles.push({
      x: Math.random() * app.screen.width,
      y: Math.random() * app.screen.height,
      vx: (Math.random() - 0.5) * 1.8, // 스피디함 유지
      vy: (Math.random() - 0.5) * 1.8,
      radius: Math.random() * 2 + 1
    });
  }

  // 4. 스프라이트 레이어 생성 (코인 버블) - 일괄 처리를 위해 Container 사용
  const coinContainer = new PIXI.Container();
  app.stage.addChild(coinContainer);

  const coinSprites = [];
  textures.forEach((texture, index) => {
    // 깊이감(z-index 효과)을 위한 랜덤값
    const depth = Math.random();

    // Pixi Sprite 생성 (DOM 요소보다 훨씬 가벼움)
    const sprite = new PIXI.Sprite(texture);

    // 스프라이트 중심점 설정
    sprite.anchor.set(0.5);

    // 네온 글로우 효과를 위한 블렌드 모드 (성능 부하 적음)
    sprite.blendMode = PIXI.BLEND_MODES.ADD;

    // 깊이에 따른 크기, 투명도 설정 (블러 제거)
    const baseSize = 45 + depth * 65; // 45px ~ 110px
    sprite.width = sprite.height = baseSize;
    sprite.alpha = 0.2 + depth * 0.6; // 0.2 ~ 0.8

    // 🚀 극단적 성능 최적화를 위해 무거운 BlurFilter 제거

    coinContainer.addChild(sprite);

    // 애니메이션 데이터 저장
    coinSprites.push({
      sprite,
      baseX: Math.random() * app.screen.width,
      y: Math.random() * app.screen.height,
      speed: 0.7 + depth * 2.2, // 스피디한 움직임
      depth: depth,
      // 깊이에 따른 마스 반응 계수 (Parallax)
      parallaxFactor: (depth + 0.3) * 70,
      // 유기적 움직임을 위한 사인곡선 변수
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      wobbleAmount: 18 + Math.random() * 35
    });
  });

  // 5. 마우스 인터랙션 좌표 관리
  let mouseX = 0;
  let mouseY = 0;
  let currentMouseX = 0;
  let currentMouseY = 0;

  // start-screen 위에서만 마우스 감지하도록 수정하여 성능 소폭 향상
  const screenEl = document.getElementById('start-screen');
  if (screenEl) {
    screenEl.addEventListener("mousemove", (e) => {
      mouseX = (e.clientX / window.innerWidth) - 0.5;
      mouseY = (e.clientY / window.innerHeight) - 0.5;
    });
  }

  // 6. 🚀 [핵심:성능최적화] GPU 가속 애니메이션 루프 (PIXI Ticker 사용)
  // 자바스크립트 메인 스레드를 거의 먹지 않아 버벅거림이 사라짐
  app.ticker.add((delta) => {
    // delta 값을 이용해 프레임 보정 (속도 일정하게)
    const dt = delta;

    // 마우스 보간 (부드러운 반응성 개선)
    currentMouseX += (mouseX - currentMouseX) * 0.1 * dt;
    currentMouseY += (mouseY - currentMouseY) * 0.1 * dt;

    // A. 체인 네트워크 업데이트 (GPU 드로잉)
    graphics.clear(); // 매 프레임 초기화

    // 계산 단순화를 위해 화면 중심 좌표 미리 계산
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;

    // 모든 파티클의 위치를 먼저 일괄 업데이트하고 점(Node)을 그립니다.
    particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // 화면 밖으로 나가면 반대편으로 워프 (Wrap)
      if (p.x < 0) p.x = app.screen.width;
      if (p.x > app.screen.width) p.x = 0;
      if (p.y < 0) p.y = app.screen.height;
      if (p.y > app.screen.height) p.y = 0;

      // 노드 그리기
      graphics.beginFill(0x00d1ff, 0.7);
      graphics.drawCircle(p.x, p.y, p.radius);
      graphics.endFill();
    });

    // 라인 연결 최적화 (이중 루프 대신 단방향 for-loop를 사용하여 연산량/드로잉을 1/2로 감축)
    const numPart = particles.length;
    for (let i = 0; i < numPart; i++) {
      const p = particles[i];
      for (let j = i + 1; j < numPart; j++) {
        const p2 = particles[j];
        // 거리 계산 피타고라스 (루트 연산 생략으로 속도 향상)
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const distSq = dx * dx + dy * dy;
        const maxDistSq = 135 * 135;

        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq); // 그릴 때만 루트 연산
          // 거리에 따른 투명도 조절
          graphics.lineStyle(1, 0x00d1ff, 0.2 - dist / 675);
          graphics.moveTo(p.x, p.y);
          graphics.lineTo(p2.x, p2.y);
        }
      }

      // 마우스 인터랙션 라인
      const mouseAbsX = currentMouseX * window.innerWidth + centerX;
      const mouseAbsY = currentMouseY * window.innerHeight + centerY;

      const mdx = p.x - mouseAbsX;
      const mdy = p.y - mouseAbsY;
      const mDistSq = mdx * mdx + mdy * mdy;
      const mMaxDistSq = 190 * 190;

      if (mDistSq < mMaxDistSq) {
        const mDist = Math.sqrt(mDistSq);
        graphics.lineStyle(1.5, 0x00d1ff, 0.45 - mDist / 422);
        graphics.moveTo(p.x, p.y);
        graphics.lineTo(mouseAbsX, mouseAbsY);
      }
    }

    // B. 코인 스프라이트 업데이트 (GPU 트랜스폼 관리)
    coinSprites.forEach(coin => {
      // 상승 이동
      coin.y -= coin.speed * dt;

      // 유기적 움직임 사인곡선 (좌우 Wobble)
      coin.wobblePhase += coin.wobbleSpeed * dt;
      const currentX = coin.baseX + Math.sin(coin.wobblePhase) * coin.wobbleAmount;

      // 화면 위로 완전히 벗어나면 아래에서 재생성 (Warp)
      // 확 튀지 않게 위아래 여유 공간 배치 (-150, +150)
      if (coin.y < -150) {
        coin.y = app.screen.height + 150;
        coin.baseX = Math.random() * app.screen.width;
      }

      // 마우스 패럴랙스 (깊이에 따른 반응성 차별화)
      const pX = currentMouseX * coin.parallaxFactor * 2.8;
      const pY = currentMouseY * coin.parallaxFactor * 2.8;

      // 🚀 회전 계산 수정 (라디안 단위 고려 및 자연스러운 움직임)
      // 1. 마우스 반대 방향으로 미세하게 회전 (* -0.05) - 패럴랙스 효과 보강
      // 2. wobble 사인 곡선에 따른 꿀렁거리는 회전 추가 (* 0.15) - 유기적 움직임 보강
      // 3. PIXI는 라디안 단위를 사용하므로 PI를 곱해주어 범위 조정 (선택사항, 여기서는 제외)
      const rotate = (currentMouseX * coin.parallaxFactor * -0.05) + (Math.sin(coin.wobblePhase) * 0.15);

      // DOM 조작 없이 GPU가 관리하는 스프라이트 속성 직접 변경 (Zero-Reflow)
      // 이 부분이 렉 제거의 핵심
      coin.sprite.x = currentX + pX;
      coin.sprite.y = coin.y + pY;
      coin.sprite.rotation = rotate; // 라디안 단위
    });
  });
}

async function initStartScreen() {
  // 🚀 Start Screen HTML을 body에 동적으로 추가
  document.body.insertAdjacentHTML("beforeend", getStartScreenHTML());

  // 🚀 [추가:성능최적화] DOM 애니메이션 로직 삭제 및 PixiJS WebGL 엔진 구동
  // 즉시 실행으로 렉 유발 요인 제거
  await initPixiBackground();

  const input = document.getElementById("cmc-api-input");
  const btnStart = document.getElementById("btn-start-engine");
  const btnSkip = document.getElementById("btn-skip-start");

  // ============== 기존 비즈니스 로직 철통 보존 (단 1줄도 안건드림) ==============
  // 1. 서버 환경변수(env)에서 키 가져오기 (확실히 올 때까지 기다림)
  try {
    // Xconsole.log("📡 서버에서 env 키 조회 중...");
    const res = await fetch("/api/get-env-key");
    const data = await res.json();

    if (data.key && data.key.trim() !== "") {
      rawCmcKey = data.key;
      // Xconsole.log("✅ env 키 로드 성공!");

      // 🚀 env 키가 존재하면 즉시 로컬 스토리지에 저장하고 시작 화면을 스킵합니다.
      localStorage.setItem("CMC_API_KEY", rawCmcKey);
      hideStartScreen();
      return;
    } else {
      // env에 없으면 로컬 스토리지 확인
      rawCmcKey = localStorage.getItem("CMC_API_KEY") || "";
      // Xconsole.log("ℹ️ env에 키가 없어 로컬 스토리지를 확인했습니다.");
    }
  } catch (e) {
    console.error("🚨 서버 통신 실패, 로컬 스토리지로 대체합니다.");
    rawCmcKey = localStorage.getItem("CMC_API_KEY") || "";
  } finally {
    // 🚀 공백이든 값 없든 무조건 불러오기 작업 이후 활성화!
    if (input) {
      input.disabled = false;
      input.placeholder = "Paste your CMC API Key...";
      input.classList.remove("opacity-50", "cursor-not-allowed");
    }

    if (btnStart) {
      btnStart.disabled = false;
      btnStart.innerText = "Start DASHBOARD";
      // 비주얼 선명도 증가
      btnStart.className =
        "w-full py-3.5 bg-theme-accent text-white font-medium rounded-xl shadow-[0_0_25px_rgba(0,209,255,0.5)] hover:shadow-[0_0_40px_rgba(0,209,255,0.8)] hover:brightness-125 active:scale-[0.98] transition-all tracking-widest uppercase cursor-pointer pointer-events-auto border border-theme-accent/50";
    }

    if (btnSkip) {
      btnSkip.disabled = false;
      btnSkip.innerText = "Skip (Use Cached Data)";
      // 비주얼 선명도 증가
      btnSkip.className =
        "w-full py-3 bg-transparent text-theme-text border border-theme-border font-medium rounded-xl hover:bg-white/5 hover:border-white/30 active:scale-[0.98] transition-all tracking-wide opacity-60 hover:opacity-100 cursor-pointer pointer-events-auto";
    }
  }

  // 2. 가져온 키가 있다면 "즉시" 인풋 박스에 마스킹해서 보여줌
  if (rawCmcKey && input) {
    input.value = maskApiKey(rawCmcKey);
  }

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
  });

  // 클릭 시 새로 입력 모드 (기존 유지)
  input.addEventListener("focus", () => {
    if (rawCmcKey) {
      input.value = "";
      rawCmcKey = ""; // 9글자 버그 방지를 위해 포커스 시 깔끔하게 비우고 시작
    }
  });

  input.addEventListener("blur", () => {
    input.value = maskApiKey(rawCmcKey);
  });
}

function saveAndStart() {
  const keyToSave = rawCmcKey.trim();
  // 🚨 32글자 철벽 검사
  if (keyToSave.length !== 32) {
    Swal.fire({
      icon: "error",
      title: "Invalid Key!",
      text: `CMC API 키는 정확히 32글자여야 합니다. (현재: ${keyToSave.length}자)`,
      background: "var(--panel)",
      color: "var(--text)",
      confirmButtonColor: "var(--accent)",
    });
    return;
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

// 🚀 Skip (쌀먹 모드 유지)
function skipAndStart() {
  // Xconsole.log("⏭️ [스킵] 캐시 데이터로 진입합니다.");

  // 🚀 [INP 최적화 1] 클릭 즉시 시각적 피드백 제공
  const buttons = document.querySelectorAll("#start-screen button");
  if (buttons.length > 1 && buttons[1]) {
    buttons[1].innerText = "SKIPPING... ⏭️";
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
  // 🚀 스타트 스크런 퇴장 시 Pixi Application을 완전히 파괴하여 Ticker 및 WebGL 리소스를 해제합니다 (렉 유발 해결책)
  if (pixiApp) {
    try {
      pixiApp.destroy(true, { children: true, texture: true, baseTexture: true });
    } catch (e) {
      console.error("Error destroying Pixi app:", e);
    }
    pixiApp = null;
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

window.addEventListener("DOMContentLoaded", initStartScreen);

window.saveAndStart = saveAndStart;
window.skipAndStart = skipAndStart;