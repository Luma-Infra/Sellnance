// ui_control.js
// --- 📱 UI/UX 컨트롤 로직 ---

function toggleTheme() {
  const body = document.body;
  const btn = document.getElementById("theme-toggle-btn");
  const isCurrentlyDark = body.classList.contains("theme-binance");

  if (isCurrentlyDark) {
    body.classList.remove("theme-binance");
    currentTheme = "upbit-light";
    if (btn) btn.innerHTML = "🌙 다크";
  } else {
    body.classList.add("theme-binance");
    currentTheme = "binance";
    if (btn) btn.innerHTML = "☀️ 라이트";
  }
  setTimeout(() => {
    initChart();
  }, 10);
}

// 데스크탑: 좌측 패널 접기/펴기
function toggleSidebar() {
  const leftPanel = document.getElementById("left-panel");
  const openBtn = document.getElementById("sidebar-open-btn");

  isSidebarOpen = !isSidebarOpen;

  if (isSidebarOpen) {
    // 사이드바 열기
    leftPanel.classList.remove("md:hidden");
    leftPanel.classList.add("md:flex");
    openBtn.classList.add("hidden");
  } else {
    // 사이드바 숨기기
    leftPanel.classList.remove("md:flex");
    leftPanel.classList.add("md:hidden");
    openBtn.classList.remove("hidden");
  }

  // UI 변경 후 차트 크기 강제 재계산
  setTimeout(() => {
    if (window.chartResizeObserver && chart) {
      const container = document.getElementById("chart-container");
      chart.resize(container.clientWidth, container.clientHeight);
    }
  }, 200);
}

// 모바일: 리스트/차트 화면 전환
function switchMobileView(view) {
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  const btnList = document.getElementById("mob-btn-list");
  const btnChart = document.getElementById("mob-btn-chart");

  if (view === "list") {
    leftPanel.classList.remove("hidden");
    leftPanel.classList.add("flex");
    rightPanel.classList.remove("flex");
    rightPanel.classList.add("hidden");

    btnList.classList.replace("border-transparent", "border-theme-accent");
    btnList.classList.replace("opacity-50", "text-theme-accent");
    btnChart.classList.replace("border-theme-accent", "border-transparent");
    btnChart.classList.replace("text-theme-accent", "opacity-50");
  } else {
    leftPanel.classList.remove("flex");
    leftPanel.classList.add("hidden");
    rightPanel.classList.remove("hidden");
    rightPanel.classList.add("flex");

    btnChart.classList.replace("border-transparent", "border-theme-accent");
    btnChart.classList.replace("opacity-50", "text-theme-accent");
    btnList.classList.replace("border-theme-accent", "border-transparent");
    btnList.classList.replace("text-theme-accent", "opacity-50");

    // 차트 화면 렌더링 최적화
    setTimeout(() => {
      const container = document.getElementById("chart-container");
      if (chart && container.clientWidth > 0) {
        chart.resize(container.clientWidth, container.clientHeight);
      }
    }, 200);
  }
}

function showMobileChart() {
  // 1. PC/태블릿 모드 검문 (SCREEN_WIDTH 기준)
  if (window.innerWidth >= SCREEN_WIDTH) return;

  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const content = document.getElementById("mobile-chart-content");
  const rightPanel = document.getElementById("right-panel");

  // 2. 중복 이사 방지
  if (content.contains(rightPanel)) {
    // 이미 이사 와 있다면 오버레이만 다시 보여주기
    overlay.classList.remove("hidden");
    overlay.style.pointerEvents = "auto";
    return;
  }

  // 3. 이사 시작 (물리적 이동)
  content.appendChild(rightPanel);

  // 4. 레이아웃 초기화
  overlay.classList.remove("hidden");
  overlay.style.pointerEvents = "auto";
  rightPanel.classList.remove("hidden", "md:flex"); // PC용 클래스 잠시 제거
  rightPanel.classList.add("flex");

  // 5. 애니메이션 및 리사이즈
  setTimeout(() => {
    overlay.style.opacity = "1";
    panel.style.transform = "translateY(0)";

    // 🚀 [핵심] 차트가 새 집의 크기를 강제로 인식하게 만들어야 함!
    if (window.chart) {
      const newWidth = content.clientWidth;
      const newHeight = content.clientHeight - 60; // 헤더 공간 제외

      window.chart.resize(newWidth, newHeight);
      window.chart.timeScale().fitContent();
    }
  }, 200);
}
function closeMobileChart() {
  const overlay = document.getElementById("mobile-chart-overlay");
  const panel = document.getElementById("mobile-chart-panel");
  const rightPanel = document.getElementById("right-panel");
  const mainContainer = document.querySelector(".max-w-\\[1600px\\]"); // 메인 부모

  panel.style.transform = "translateY(100%)";
  overlay.style.opacity = "0";
  overlay.style.pointerEvents = "none"; // 👈 터치 즉시 비활성화 (유리벽 제거)

  setTimeout(() => {
    overlay.classList.add("hidden");
    // 🚀 [복구] PC 버전 유지를 위해 우측 패널을 원래 자리로 돌려놓기!
    if (rightPanel && mainContainer) {
      mainContainer.appendChild(rightPanel);
      // 만약 PC에서 리스트를 보고 있었다면 다시 hidden 처리할지 로직 체크 필요
    }
  }, 200);
}

// ⭐️ 1. 탭 전환 기능 (차트 ↔ 시뮬레이터) ⭐️
function switchChartTab(mode) {
  const btnSim = document.getElementById("tab-btn-sim");
  if (mode === "chart" && btnSim.classList.contains("active")) {
    Swal.fire({
      title: "시뮬레이션 종료 🚨",
      text: "그려둔 가상 캔들이 모두 초기화되고 실제 차트로 돌아갑니다. 종료하시겠습니까?",
      icon: "warning",
      showCancelButton: true,
      background: "var(--panel)",
      color: "var(--text)",
      confirmButtonColor: "var(--down)",
      cancelButtonColor: "var(--border)",
      confirmButtonText: "네, 초기화할게요 🗑️",
      cancelButtonText: "아니요, 계속할게요",
    }).then((result) => {
      if (result.isConfirmed) executeTabSwitch(mode);
    });
  } else {
    executeTabSwitch(mode);
  }
}

// 2. 🚨 진짜 탭을 바꾸고 화면을 업데이트하는 알맹이 로직 (여기로 분리!)
function executeTabSwitch(mode) {
  const btnChart = document.getElementById("tab-btn-chart"),
    btnSim = document.getElementById("tab-btn-sim"),
    controls = document.getElementById("sim-controls");
  if (mode === "chart") {
    btnChart.classList.add("active");
    btnSim.classList.remove("active");
    controls.style.display = "none";
    if (typeof fetchHistory === "function") fetchHistory();
  } else {
    btnSim.classList.add("active");
    btnChart.classList.remove("active");
    controls.style.display = "flex";
    if (currentWs) {
      currentWs.close();
      currentWs = null;
      document.getElementById("status-dot").style.background = "gray";
      document.getElementById("status-text").innerText = "SIMULATION MODE";
    }
  }
  if (window.chart) {
    setTimeout(() => {
      const container = document.getElementById("chart-container");
      if (container.clientWidth > 0 && container.clientHeight > 0)
        window.chart.resize(container.clientWidth, container.clientHeight);
    }, 200);
  }
}

