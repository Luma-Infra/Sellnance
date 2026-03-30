// table.js
let originalTableData = []; // ⭐️ 원본 백업용 변수 추가
let currentTableData = [];
let currentSortCol = '';
let sortState = ''; // 'desc'(내림) -> 'asc'(오름) -> ''(제자리)

// ⭐️ 파일 위쪽 전역 변수 모여있는 곳에 2줄 추가
let tableObserver = null;
let visibleSymbols = new Set(); // 현재 화면에 보이는 코인들만 담을 바구니

// 1. 데이터 로드 함수
async function loadTableData(force = false) {
    const modal = document.getElementById('loading-modal');
    const updateTimeSpan = document.getElementById('update-time');

    modal.classList.remove('hidden');
    updateTimeSpan.innerText = "업데이트 중...";

    try {
        console.log("1. 파이썬 서버에 데이터 요청 시작!"); // ⭐️ 추가
        const res = await fetch(`/api/market-data?force=${force}`);
        console.log("2. 파이썬 서버가 응답 완료!"); // ⭐️ 추가
        const result = await res.json();
        updateTimeSpan.innerText = `마지막 업데이트: ${result.last_updated}`;

        // ⭐️ 데이터를 받아오자마자 원본을 깊은 복사로 백업해둡니다.
        originalTableData = JSON.parse(JSON.stringify(result.data));
        currentTableData = JSON.parse(JSON.stringify(result.data));

        // 처음엔 화살표 없이 원본(시총순) 그대로 그림
        renderTable();

    } catch (error) {
        console.error("데이터 로드 에러:", error);
        alert("서버에서 데이터를 가져오지 못했습니다.");
        updateTimeSpan.innerText = "업데이트 실패";
    } finally {
        modal.classList.add('hidden');
    }
}

// 2. ⭐️ 3단계 정렬 핵심 로직 ⭐️
function sortTable(colKey) {
    // 같은 기둥(컬럼)을 눌렀을 때 3단계 사이클
    if (currentSortCol === colKey) {
        if (sortState === '') sortState = 'desc';       // 1타: 내림차순
        else if (sortState === 'desc') sortState = 'asc'; // 2타: 오름차순
        else sortState = '';                            // 3타: 제자리 복구
    } else {
        // 다른 기둥을 누르면 무조건 '내림차순'부터 1타 시작
        currentSortCol = colKey;
        sortState = 'desc';
    }

    // 화살표 지우기 및 현재 상태 표시
    document.querySelectorAll('.sort-arrow').forEach(el => el.innerText = '');
    const arrowEl = document.getElementById(`sort-${colKey}`);

    // 3타(제자리) 일 때: 원본 데이터 덮어씌우기
    if (sortState === '') {
        currentTableData = JSON.parse(JSON.stringify(originalTableData));
        if (arrowEl) arrowEl.innerText = '';
    }
    // 1타, 2타 일 때: 정렬 가동
    else {
        if (arrowEl) arrowEl.innerText = sortState === 'asc' ? '▲' : '▼';

        currentTableData.sort((a, b) => {
            let valA = a[colKey];
            let valB = b[colKey];

            // 숫자/퍼센트/가격 등은 문자를 제거하고 퓨어 숫자로 변환
            // 기존 코드에서 colKey === 'Volume' 조건을 추가합니다!
            if (colKey === 'Price' || colKey === 'Change_24h' || colKey === 'MarketCap' || colKey === 'Volume' || colKey === 'Change_Today') {
                if (colKey === 'Change_24h' || colKey === 'Change_Today') {
                    valA = parseFloat(a[colKey].toString().replace(/<[^>]*>?/gm, ''));
                    valB = parseFloat(b[colKey].toString().replace(/<[^>]*>?/gm, ''));
                } else if (colKey === 'Price') {
                    valA = parseFloat(a[colKey].toString().replace(/,/g, ''));
                    valB = parseFloat(b[colKey].toString().replace(/,/g, ''));
                }

                // Volume, MarketCap은 파이썬에서 보내준 순수 숫자 사용
                valA = isNaN(valA) ? 0 : valA;
                valB = isNaN(valB) ? 0 : valB;
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }

            // 오름/내림 방향 결정
            const isAsc = (sortState === 'asc');
            if (valA < valB) return isAsc ? -1 : 1;
            if (valA > valB) return isAsc ? 1 : -1;
            return 0;
        });
    }

    // 화면 다시 그리기
    renderTable();
}

// 표 그리기 함수 수정
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    // ⭐️ 기존 감시 카메라 끄고 초기화 (정렬 누를 때 대비)
    if (tableObserver) tableObserver.disconnect();
    visibleSymbols.clear();

    // ⭐️ 새 감시 카메라 설치 (위아래 100px 정도 여유를 두고 미리 감지)
    tableObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const sym = entry.target.dataset.sym; // 코인 이름 가져오기
            if (entry.isIntersecting) visibleSymbols.add(sym);    // 화면에 들어오면 추가
            else visibleSymbols.delete(sym);                      // 화면 밖으로 나가면 삭제
        });
    }, { root: document.querySelector('.table-container'), rootMargin: "100px 0px" });

    currentTableData.forEach(row => {
        const tr = document.createElement('tr');
        const pureSymbol = row.Symbol || row.symbol;

        // ⭐️ 감시 카메라가 누군지 알 수 있게 이름표 부착
        tr.dataset.sym = pureSymbol;

        tr.onclick = () => {
            if (pureSymbol) selectSymbol(pureSymbol);
        };

        tr.innerHTML = `
    <td><div style="display:flex; align-items:center; gap:8px;">
        ${row.Logo || ''}
        <div><b>${row.Ticker}</b><br><span style="font-size:10px;opacity:0.6">${row.Name || ''}</span></div>
    </div></td>

    <td id="price-${pureSymbol}" class="price-cell">$ ${row.Price}</td>
    <td id="change-${pureSymbol}">${row.Change_24h}</td>
    <td id="today-${pureSymbol}">${row.Change_Today}</td>

    <td>${row.Volume_Formatted || '-'}</td>
    <td>${row.MarketCap_Formatted}</td>
    <td style="text-align:center;">${row.Upbit === 'O' ? '🔵' : '⚫'}</td>
    <td style="font-size:11px; opacity:0.8;">${row.Note || ''}</td>
    `;
        tbody.appendChild(tr);

        // ⭐️ 카메라에 이 줄(tr) 감시하라고 명령
        tableObserver.observe(tr);
    });
}
// ⭐️ 1. 탭 전환 기능 (차트 ↔ 시뮬레이터) ⭐️
// 1. 탭 전환의 진입점 (여기서 검사만 합니다)
function switchChartTab(mode) {
    const btnSim = document.getElementById('tab-btn-sim');

    // 🚨 핵심: 시뮬레이터에서 '차트' 탭으로 넘어가려 할 때 경고창 띄우기
    if (mode === 'chart' && btnSim.classList.contains('active')) {

        // 못생긴 confirm 대신 쫀득한 스윗얼럿 출동
        Swal.fire({
            title: '시뮬레이션 종료 🚨',
            text: "그려둔 가상 캔들이 모두 초기화되고 실제 차트로 돌아갑니다. 종료하시겠습니까?",
            icon: 'warning',
            showCancelButton: true,
            // ⭐️ 테마 변수를 그대로 먹여서 모달창도 이질감 없이 렌더링!
            background: 'var(--panel)',
            color: 'var(--text)',
            confirmButtonColor: 'var(--down)', // 데이터가 날아가는 경고니까 빨간색(down) 
            cancelButtonColor: 'var(--border)',
            confirmButtonText: '네, 초기화할게요 🗑️',
            cancelButtonText: '아니요, 계속할게요'
        }).then((result) => {
            if (result.isConfirmed) {
                // '네' 눌렀을 때만 진짜 탭 전환 로직 실행
                executeTabSwitch(mode);
            }
        });

    } else {
        // 시뮬레이터로 들어갈 때나, 이미 같은 탭일 때는 경고 없이 바로 실행
        executeTabSwitch(mode);
    }
}

// 2. 🚨 진짜 탭을 바꾸고 화면을 업데이트하는 알맹이 로직 (여기로 분리!)
function executeTabSwitch(mode) {
    const btnChart = document.getElementById('tab-btn-chart');
    const btnSim = document.getElementById('tab-btn-sim');
    const controls = document.getElementById('sim-controls');

    // 탭 버튼 Active 토글
    if (mode === 'chart') {
        btnChart.classList.add('active');
        btnSim.classList.remove('active');
        // Tailwind 쓰셨으니 flex 대신 hidden 제거/추가로 하셔도 됩니다 (아래는 범용)
        controls.style.display = 'none';

        // 🚨 시뮬레이터를 껐으니 실제 데이터를 다시 불러옴
        fetchHistory();
    } else {
        btnSim.classList.add('active');
        btnChart.classList.remove('active');
        controls.style.display = 'flex'; // Tailwind면 controls.classList.remove('hidden') 등

        // 🚨 시뮬레이터 켰을 때 웹소켓 연결 끊기 (선택 사항)
        if (currentWs) {
            currentWs.close();
            currentWs = null;
            document.getElementById('status-dot').style.background = 'gray';
            document.getElementById('status-text').innerText = 'SIMULATION MODE';
        }
    }

    // 차트 크기 꼬임 방지용 리사이즈 (기존 코드 유지)
    if (window.chart) {
        setTimeout(() => {
            const container = document.getElementById('chart-container');
            if (container.clientWidth > 0 && container.clientHeight > 0) {
                window.chart.resize(container.clientWidth, container.clientHeight);
            }
        }, 10);
    }
}

// ⭐️ 2. 좌우 넓이 드래그 조절 기능 ⭐️
const resizer = document.getElementById('drag-resizer');
const leftPanel = document.getElementById('left-panel');
let isResizing = false;

let animationFrameId = null;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.classList.add('resizing-active'); // 🚨 1번 CSS 적용
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // 🚨 핵심: 이전 프레임이 대기 중이면 취소하고 최신 것만 실행
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    animationFrameId = requestAnimationFrame(() => {
        const containerWidth = document.body.clientWidth;
        let newWidth = (e.clientX / containerWidth) * 100;

        if (newWidth < 25) newWidth = 25;
        if (newWidth > 75) newWidth = 75;

        // 1. 패널 크기 변경
        leftPanel.style.width = newWidth + '%';

        // 2. 차트 리사이즈 (가장 무거운 작업)
        if (window.chart) {
            const container = document.getElementById('chart-container');
            window.chart.resize(container.clientWidth, container.clientHeight);
        }
    });
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.classList.remove('resizing-active'); // 🚨 효과 해제
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

// ⭐️ 이 코드가 있어야 웹페이지가 켜지자마자 데이터를 가져옵니다!
window.addEventListener('DOMContentLoaded', () => {
    loadTableData();
});