# Sellnance $0 유지비 서버리스(Serverless) 이관 가이드

본 문서는 24시간 상시 가동되어 요금을 유발하는 **Railway 컨테이너 서버**를 폐기하고, **Vercel(무료 호스팅) + Supabase(무료 데이터베이스)** 조합으로 전환하여 **유지 비용을 완전히 $0원**으로 만들기 위한 상세 이관 프로세스를 설명합니다.

---

## 🏗️ 1. 목표 아키텍처 비교

### [기존 구조] (유료 가동)
* **프론트엔드**: HTML/JS 정적 에셋을 FastAPI 서버가 호스팅.
* **백엔드 (FastAPI)**: Railway 서버가 24시간 켜져 있으면서 API 호출 수신, 로컬 파일(상장일 데이터 등) 저장 관리.
* **비용**: 가상 머신(RAM/CPU) 상시 구동 비용 발생 (월 $5 한도 초과 시 과금).

### [변경 구조] (평생 무료 $0원)
* **프론트엔드**: **Vercel** 또는 **GitHub Pages**에 정적 배포 (**$0원**)
* **백엔드**: **Vercel Serverless Functions** (호출될 때만 일시적으로 깨어나 처리 후 자동 종료, **$0원**)
* **데이터베이스**: **Supabase Free Tier (PostgreSQL)** (클라우드 데이터베이스 무료 슬롯 사용, **$0원**)

---

## 🛠️ 2. 단계별 마이그레이션 방법

### 1단계: Supabase 데이터베이스 생성 및 연동 (무료 DB)
기존에 서버 하드디스크에 저장하던 `listing_dates` (상장일 파일 등)를 클라우드 무료 DB인 Supabase로 이관합니다.

1. [Supabase 공식 홈페이지](https://supabase.com)에 가입 후 새 프로젝트를 생성합니다. (무료 플랜 선택)
2. **Table Editor** 또는 **SQL Editor**에서 상장일을 저장할 테이블을 생성합니다.
   ```sql
   create table listing_dates (
     symbol text primary key,
     binance_listing text,
     upbit_listing text,
     bithumb_listing text,
     bybit_listing text,
     updated_at timestamp default now()
   );
   ```
3. 프로젝트 설정(`Settings` -> `API`)에서 **Project URL**과 **anon/public API key**를 메모해 둡니다.

---

### 2단계: 백엔드 코드를 Vercel Serverless Function으로 변환 (FastAPI 유지)
Vercel은 파이썬과 FastAPI를 **서버리스 함수**로 네이티브 지원합니다. 기존 코드를 거의 수정하지 않고 그대로 서버리스로 작동시킬 수 있습니다.

1. 프로젝트 루트 디렉터리에 `api` 폴더를 생성하고, 기존 `app.py` (또는 메인 서버 실행 파일)을 `api/index.py`로 복사/이동합니다.
2. Vercel용 핸들러 연동을 위해 `api/index.py` 파일의 하단 또는 상단에 아래 설정을 적용합니다.
   ```python
   # api/index.py
   from fastapi import FastAPI
   
   app = FastAPI()
   
   # 기존 라우터(API 엔드포인트) 코드는 그대로 둠
   @app.get("/api/market-data")
   async def get_market_data():
       # ...기존 코드...
       pass
   ```
3. 프로젝트 루트에 `vercel.json` 파일을 생성하여 라우팅 규칙을 지정합니다.
   ```json
   {
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api/index.py" },
       { "source": "/(.*)", "destination": "/dist/$1" }
     ]
   }
   ```
4. 로컬 파일 입출력 코드를 Supabase API 호출로 교체합니다 (`httpx` 또는 `supabase-py` 라이브러리 사용).
   ```python
   # 예시: 상장일 저장 API 수정
   import httpx
   
   SUPABASE_URL = "메모해둔_프로젝트_URL"
   SUPABASE_KEY = "메모해둔_anon_키"
   
   @app.post("/api/listing-dates")
   async def save_listing_date(data: dict):
       headers = {
           "apikey": SUPABASE_KEY,
           "Authorization": f"Bearer {SUPABASE_KEY}",
           "Content-Type": "application/json"
       }
       # Supabase upsert API 호출 (서버리스 환경에서 안전하게 보관)
       async with httpx.AsyncClient() as client:
           await client.post(f"{SUPABASE_URL}/rest/v1/listing_dates", json=data, headers=headers)
       return {"status": "success"}
   ```

---

### 3단계: 프론트엔드 빌드 경로 및 빌드 명령어 조정
Vercel은 Git 리포지토리와 연동하여 자동으로 프론트엔드를 빌드하고 정적 에셋을 배포합니다.

1. `package.json`의 빌드 설정을 확인합니다. Vercel이 빌드를 돌릴 때 `npx vite build`를 실행하여 최종 결과물을 `dist` 폴더에 생성하도록 세팅합니다.
2. Vercel 대시보드에서 `Import Project`를 눌러 깃허브 리포지토리를 연동합니다.
3. **Build & Development Settings**를 다음과 같이 지정합니다:
   * **Framework Preset**: `Vite` (또는 Other)
   * **Build Command**: `npx vite build` (또는 `npm run build`)
   * **Output Directory**: `dist`
4. **Environment Variables** (환경 변수)에 기존 Railway에 등록했던 API key(CoinMarketCap API 키 등)와 Supabase URL/Key를 등록합니다.

---

## 🏆 3. 이관 완료 후의 장점 요약

1. **상시 구동 요금 소각 ($0원)**:
   사용자가 사이트를 열 때만 Vercel의 서버리스 함수가 0.1초 동안 잠깐 켜져서 API 데이터를 반환하고 곧바로 꺼집니다. Vercel은 이 서버리스 함수 호출을 **매월 100,000회 무상 제공**하므로 요금이 나오지 않습니다.
2. **데이터 유실 방지**:
   로컬 컴퓨터나 Railway 컨테이너 내부에 임시로 저장되던 데이터(상장일 JSON 파일 등)가 클라우드 상시 백업 DB인 `Supabase`에 안전하게 영구 보관됩니다.
3. **속도 가속**:
   프론트엔드 정적 파일이 글로벌 CDN(Vercel Edge Network)을 타고 배포되므로 전 세계 어디서든 기존 Railway 서버보다 접속 및 로딩 속도가 2배 이상 빨라집니다.
