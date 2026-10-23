# scratch/recommit_split.py
# ==============================================================================
# [Sellnance] 임시 커밋 일괄 재분할 및 날짜/메시지 커스텀 스크립트
#
# ⚠️ 주의: 이 스크립트는 지금 실행되지 않았습니다!
# 아래 COMMITS 리스트에서 [제목 1줄 + 설명 3줄 요약] 및 날짜를
# 원하는 대로 직접 검토 및 편집하신 후 아래 명령어로 실행하시면 됩니다:
#
#   uv run python scratch/recommit_split.py
#   (또는 python scratch/recommit_split.py)
#
# 안전장치:
# - 실행 즉시 현재 상태를 'backup-before-split' 브랜치로 자동 백업합니다.
# - 언제든 롤백하려면: git reset --hard backup-before-split
# ==============================================================================

import os
import sys
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 기준 커밋 (임시 커밋 5개 직전의 커밋 해시)
BASE_COMMIT = "edca752"

# ==============================================================================
# 📝 커밋 분할 설정 테이블 (제목 1줄 + 설명 3줄 요약)
# ==============================================================================
COMMITS = [
    # -------------------------------------------------------------------------
    # [파트 1] 10월 10일 ~ 10월 13일 (웹소켓 피드, 헤더, 기본 차트)
    # -------------------------------------------------------------------------
    {
        "date": "2026-10-10 14:20:00",
        "title": "feat(feed): 바이낸스 선물/현물 웹소켓 피드 안정화 및 재연결 로직 보완",
        "body": """- 바이낸스 fstream 및 spot 소켓 파이프라인 에러 핸들링 강화
- 실시간 버퍼 플러시 주기 조율을 통한 브라우저 렌더링 렉 완화
- 업비트 및 바이낸스 소켓 재연결 시 상태 복원 신뢰성 개선""",
        "files": [
            "static/feed_binance_futures.js",
            "static/feed_binance_spot.js",
            "static/feed_upbit.js",
            "static/stream_table.js",
        ],
    },
    {
        "date": "2026-10-12 16:45:00",
        "title": "feat(ui): 상단 헤더 디스플레이 및 타임프레임 전환 인터랙션 개선",
        "body": """- 헤더 내 24h 변동률, 시가총액, 거래량 전광판 지표 표기 통일
- 타임프레임(TF) 버튼 전환 시 차트 갱신 지연 최소화
- 반응형 레이아웃에 맞춘 헤더 폰트 및 모바일 오버레이 최적화""",
        "files": [
            "static/header_display.js",
            "static/ui_timeframe.js",
            "static/ui_control.js",
        ],
    },
    {
        "date": "2026-10-13 18:30:00",
        "title": "feat(chart): 메인 차트 캔들 페칭 파이프라인 및 김프 비교 차트 안정화",
        "body": """- 메인 차트 캔들 데이터 페칭 지연 및 타임아웃 예외 처리 보강
- 김프 비교 서브 패널과의 시간축(TimeScale) 정렬 정합성 확보
- 타임프레임 변경 시 가상 캔들 버퍼 초기화 및 메모리 정리""",
        "files": [
            "static/chart_fetch.js",
            "static/chart_history_kimchi.js",
            "static/chart_layout.js",
        ],
    },

    # -------------------------------------------------------------------------
    # [파트 2] 10월 15일 ~ 10월 18일 (티커 매처, High/Low, 테이블 필터)
    # -------------------------------------------------------------------------
    {
        "date": "2026-10-15 11:15:00",
        "title": "feat(matcher): 거래소 티커 자동 매칭 엔진(ticker_matcher) 및 진단 도구 구축",
        "body": """- 업비트-바이낸스-빗썸 심볼 및 DisplayTicker 매핑 자동화 스크립트 구축
- 매칭 진단 및 오매칭 수동 보정을 위한 matcher.html 웹 인터페이스 추가
- 매칭 결과 JSON 캐시 구조 정의 및 검색 정합성 검증""",
        "files": [
            "modules/ticker_matcher.py",
            "static/matcher.html",
            "static/ticker_matcher_results.json",
        ],
    },
    {
        "date": "2026-10-16 15:40:00",
        "title": "feat(indicator): 차트 High/Low 최저 + 최고가 자동 마킹 인디케이터 추가",
        "body": """- 뷰포트 내 최고가 및 최저가 지점 자동 계산 및 캔버스 라벨 마킹
- 크로스헤어 등락률(%) 오버레이 및 자(Ruler) 측정 인터랙션 연동
- 캔들 데이터 변경 시 인디케이터 좌표 동적 재계산 최적화""",
        "files": [
            "static/chart_high_low.js",
            "static/chart_crosshair.js",
            "static/chart_measure.js",
        ],
    },
    {
        "date": "2026-10-17 17:20:00",
        "title": "feat(table): 테이블 거래소 필터링 고도화 및 모바일 가상 스크롤 반응성 개선",
        "body": """- 거래소별 상장 뱃지 필터 및 다중 조건 커스텀 필터링 로직 세분화
- 모바일 터치 스크롤 마스크 인디케이터 및 고무줄 바운스 효과 구현
- 다크/라이트 테마 변경 시 테이블 및 차트 컬러 토큰 실시간 동기화""",
        "files": [
            "static/table.js",
            "static/table_filter.js",
            "static/table_filter_exch.js",
            "static/ui_mobile.js",
            "static/theme_manager.js",
        ],
    },
    {
        "date": "2026-10-18 20:10:00",
        "title": "refactor(backend): 알파 규칙 및 멀티 거래소 심볼 매핑 테이블 동기화",
        "body": """- 백엔드 알파 엔진 룰셋 및 거래소 심볼 매핑 테이블 최신화
- run2 CLI 및 패키지 진입점 구조 정리
- 프로세스 메모리 감사(mem_audit) 모듈 점검 및 유틸리티 정돈""",
        "files": [
            "modules/alpha_rules.py",
            "modules/exchange_api.py",
            "modules/mem_audit.py",
            "modules/utils.py",
            "mapping.json",
            "listing.json",
            "run2.py",
            "src/sellnance/run2_cli.py",
            "pyproject.toml",
            "vite.config.js",
        ],
    },

    # -------------------------------------------------------------------------
    # [파트 3 & 4] 10월 19일 ~ 10월 22일 (백엔드 빌더, 테이블 렌더러, CMC 캐시)
    # -------------------------------------------------------------------------
    {
        "date": "2026-10-19 14:00:00",
        "title": "feat(builder): 바이낸스·업비트 마켓 데이터 빌더 병합 최적화",
        "body": """- 마켓 시세 빌더의 비동기 수집 병합 처리 속도 개선
- 대량 시세 집계 시 프로세스 메모리 누수 방지 및 파싱 최적화
- FastAPI 엔드포인트 핸들러의 캐시 반환 경로 효율화""",
        "files": [
            "modules/builder.py",
            "modules/builder_binance.py",
            "modules/builder_upbit.py",
            "modules/api_manager.py",
            "modules/app.py",
            "run.py",
        ],
    },
    {
        "date": "2026-10-20 16:10:00",
        "title": "perf(table): 테이블 행 빌더 DOM 가상화 및 렌더링 성능 개선",
        "body": """- 행 렌더링 시 불필요한 DOM 조작을 줄이고 DocumentFragment 캐싱 강화
- 실시간 스트림 렌더러의 테이블 셀 업데이트 주기 조율
- 행 호버 및 선택 시 하이라이트 인터랙션 반응성 향상""",
        "files": [
            "static/table_row_builder.js",
            "static/table_render.js",
            "static/stream_render.js",
        ],
    },
    {
        "date": "2026-10-21 15:30:00",
        "title": "feat(cmc): CMC 오너 캐시 동기화 및 심볼 선택 시 예외 핸들링 강화",
        "body": """- CoinMarketCap 오너 정보 및 시총 데이터 로컬 캐시 동기화
- 테이블 코인 행 클릭 시 상태 전달 및 라우팅 경로 처리 보강
- 미상장 코인 및 예외 티커 처리 시 폴백 로직 강화""",
        "files": [
            "modules/cmc_api.py",
            "static/cmc_owner_cache.json",
            "static/ui_selection.js",
            "static/chart.js",
            "static/chart_utils.js",
            "static/_market_rules.js",
            "static/_store.js",
        ],
    },
    {
        "date": "2026-10-22 18:45:00",
        "title": "chore: 일일 마켓 데이터 캐시 및 UTC0 기준가 테이블 갱신",
        "body": """- 일일 정기 마켓 데이터 캐시(market_data_cache.json) 갱신
- FX 환율 히스토리 및 UTC0 종가 기준선 데이터 동기화
- 신규 원시 거래소 리스팅 목록 캐시 반영""",
        "files": [
            "static/utc0_prices.json",
            "static/fx_history_cache.json",
            "static/exchange_raw_listings_cache.json",
        ],
    },

    # -------------------------------------------------------------------------
    # [파트 5] 10월 23일 ~ 10월 24일 (매칭 진단, 호가창 픽스, 스케일 동기화, 로딩 속도)
    # -------------------------------------------------------------------------
    {
        "date": "2026-10-23 21:00:00",
        "title": "feat(matcher): 티커 매칭 오매칭 진단 스크립트 추가 및 검증 완료",
        "body": """- 거래소 간 티커 오매칭 및 중복 티커 전수 검사 스크립트 작성
- 매칭 테이블 정합성 검증 및 예외 케이스 매핑 보정
- 매칭 테스트 러너를 통한 신규 상장 심볼 분류 확인""",
        "files": [
            "scratch/investigate_mismatch.py",
            "scratch/scan_all_mismatches.py",
            "scratch/scan_dup_mismatches.py",
            "scratch/test_fixed_matching.py",
        ],
    },
    {
        "date": "2026-10-24 04:15:00",
        "title": "fix(orderbook): 호가창 DOM 닫는 태그 누락 수정 및 차트 우측 병렬 배치 복원",
        "body": """- #chart-wrapper 닫는 태그 누락으로 호가창이 차트 내부에 갇히던 DOM 버그 수정
- flex-col 대신 가로 flex-row 컨테이너 유지 및 호가창 260px 폭 고정
- 호가창 토글 시 차트 캔버스 리사이즈(applyChartLayout) 동기화 트리거 보완""",
        "files": [
            "templates/index.html",
            "static/z_style.css",
            "static/orderbook.js",
        ],
    },
    {
        "date": "2026-10-24 05:10:00",
        "title": "feat(scale): 상하 차트 좌측 Y축 실시간 동적 측정 동기화 및 심볼 전환 시 축 너비 리셋",
        "body": """- 상하 차트 좌측 Y축 폭을 Math.max 동적 측정으로 락킹하여 크로스헤어 수직선 정렬
- 코인 변경 시 기존 락킹된 우측/좌측 축 너비를 초기화(resetPriceScaleWidthSync)
- 브라우저 창 크기 및 타임프레임 전환 시 스케일 너비 자동 재계산""",
        "files": [
            "static/chart_sync.js",
        ],
    },
    {
        "date": "2026-10-24 05:40:00",
        "title": "perf(init): 대시보드 로딩 시 직전 차트 캔들 선제 병렬 페칭 및 SWR 테이블 캐시 즉시 렌더링",
        "body": """- 테이블 2.4MB 다운로드를 기다리지 않고 차트 캔들부터 병렬 페칭하여 체감 로딩 단축
- 로컬 캐시 전체를 SWR 패턴으로 즉시 화면에 노출하여 로딩 스피너 제거
- 서버 최신 장부 수신 완료 시 백그라운드에서 부드럽게 시세 갱신""",
        "files": [
            "static/main_init.js",
            "static/table_api.js",
        ],
    },
    {
        "date": "2026-10-24 06:05:00",
        "title": "chore: 최신 마켓 데이터 캐시 및 프로덕션 번들 빌드 반영",
        "body": """- 최신 마켓 데이터 캐시 동기화 반영
- Tailwind CSS 및 Vite 프로덕션 클라이언트 번들 최적화 빌드
- z_style.min.css 및 최종 배포 에셋 업데이트""",
        "files": [
            "static/market_data_cache.json",
            "static/z_style.min.css",
            "dist/",
        ],
    },
]


# ==============================================================================
# ⚙️ 실행 엔진 (수정할 필요 없음)
# ==============================================================================
def run_cmd(cmd, env=None, check=True, input_text=None):
    print(f"▶ {cmd}")
    res = subprocess.run(
        cmd,
        shell=True,
        env=env,
        input=input_text,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    if check and res.returncode != 0:
        print(f"❌ 오류 발생:\n{res.stderr}")
        sys.exit(res.returncode)
    return res.stdout.strip()


def main():
    print("=" * 70)
    print("🚀 Sellnance 커밋 재분할 스크립트")
    print("=" * 70)

    # 1. 안전 백업 브랜치 생성
    backup_branch = "backup-before-split"
    print(f"\n[1/4] 안전 백업 브랜치 생성: '{backup_branch}'")
    run_cmd(f"git branch -f {backup_branch} HEAD")
    print(f"  ✓ 백업 브랜치가 생성되었습니다. 문제 시 'git reset --hard {backup_branch}' 로 복구 가능.")

    # 2. 기준 커밋으로 리셋 (코드는 100% 보존)
    print(f"\n[2/4] 기준 커밋({BASE_COMMIT})으로 소프트 리셋")
    run_cmd(f"git reset --soft {BASE_COMMIT}")
    run_cmd("git reset HEAD")
    print("  ✓ 모든 변경 파일이 언스테이지 상태로 대기 중입니다.")

    # 3. 커밋 순차 생성
    print(f"\n[3/4] 총 {len(COMMITS)}개 커밋 생성 시작")
    base_env = os.environ.copy()

    for idx, c in enumerate(COMMITS, 1):
        date_str = c["date"]
        title = c["title"].strip()
        body = c["body"].strip()
        files = c["files"]

        # 환경변수로 커밋 날짜와 작성자 날짜를 동일하게 고정
        commit_env = base_env.copy()
        commit_env["GIT_AUTHOR_DATE"] = date_str
        commit_env["GIT_COMMITTER_DATE"] = date_str

        # 파일 스테이징
        for f in files:
            run_cmd(f'git add "{f}"', check=False)

        # 스테이지에 올라온 파일이 있는지 확인
        staged = run_cmd("git diff --cached --name-only")
        if not staged:
            print(f"  ⚠️  [{idx}/{len(COMMITS)}] 변경사항 없음 건너뜀: {title}")
            continue

        # 커밋 메시지 구성 (stdin으로 안전하게 전달하여 Windows 멀티라인 보존)
        commit_msg = f"{title}\n\n{body}\n"
        run_cmd("git commit -F -", env=commit_env, input_text=commit_msg)
        print(f"  ✅ [{idx}/{len(COMMITS)}] ({date_str}) {title}")

    # 4. 남은 잔여 파일이 있는지 확인
    print("\n[4/4] 잔여 파일 확인")
    remaining = run_cmd("git status --porcelain")
    if remaining:
        print("  ⚠️ 아직 커밋되지 않고 남은 파일이 있습니다:")
        print(remaining)
        print("\n  👉 남은 파일도 최종 정리 커밋으로 묶으시려면 스크립트 목록에 추가하세요.")
    else:
        print("  🎉 모든 파일이 완벽하게 커밋되었습니다! 남은 변경사항 없음.")

    print("\n" + "=" * 70)
    print("✨ 작업 완료!")
    print("커밋 로그 확인: git log -n 20 --oneline --decorate")
    print("원격 강제 푸시: git push origin main --force-with-lease")
    print("=" * 70)


if __name__ == "__main__":
    main()
