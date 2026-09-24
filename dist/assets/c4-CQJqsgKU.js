import{A as e,M as t,a as n,d as r,dt as i,f as a,gt as o,ht as s,i as c,it as l,l as u,n as d,nt as f,o as p,p as m,r as h,t as g,u as ee}from"./c1-dnSAKw4z.js";import{n as _,t as te}from"./c2-DOHTfbK5.js";function ne(e){!e||e._fallbackApplied||(e._fallbackApplied=!0,e.classList.add(`fallback-logo`),e.src=document.body.classList.contains(`theme-upbit`)?`/static/luma-deer-svg-light.svg`:`/static/luma-deer-svg-dark.svg`)}window.handleLogoError=ne,window.addEventListener(`error`,e=>{if(e.target&&e.target.tagName===`IMG`){let t=e.target;(t.src.includes(`coinmarketcap.com/static/img/coins`)||t.closest(`.col-asset`)||t.closest(`#head-asset-name`))&&ne(t)}},!0);function re(){try{if(s.originalTableData&&s.originalTableData.length>0)return;let e=localStorage.getItem(`sellnance_market_data_cache`);if(!e)return;let t=JSON.parse(e);if(!t||!Array.isArray(t.data)||t.data.length===0)return;s.originalTableData=t.data,(!s.currentTableData||s.currentTableData.length===0)&&(s.currentTableData=t.data),s.tickerRowMap&&t.data.forEach(e=>{if(!e)return;let t=e.UID?String(e.UID):null,n=e.Symbol?String(e.Symbol).toUpperCase():null,r=e.DisplayTicker?String(e.DisplayTicker).toUpperCase():null,i=e.Ticker?String(e.Ticker).toUpperCase():null;t&&s.tickerRowMap.set(t,e),n&&!s.tickerRowMap.has(n)&&s.tickerRowMap.set(n,e),r&&!s.tickerRowMap.has(r)&&s.tickerRowMap.set(r,e),i&&!s.tickerRowMap.has(i)&&s.tickerRowMap.set(i,e)})}catch(e){console.warn(`로컬 캐시 선제 동기화 실패:`,e)}}window.preloadCachedMarketData=re;function ie(){try{if(re(),m(),localStorage.getItem(`sellnance_sidebar_collapsed`)===`true`){s.isSidebarOpen=!1;let e=document.getElementById(`left-panel`);e&&(e.classList.remove(`md:flex`),e.classList.add(`md:hidden`));let t=document.getElementById(`sidebar-toggle-text`);t&&(t.innerText=`▶ 펼치기`)}if(localStorage.getItem(`sellnance_header_collapsed`)===`true`){let e=document.getElementById(`head-asset-row`),t=document.getElementById(`head-info-row`),n=document.getElementById(`head-badges-row`),r=document.getElementById(`toggle-header-top-btn`);[e,t,n].forEach(e=>{e&&(e.style.display=`none`,e.classList.add(`hidden`))}),r&&(r.innerText=`▼ 헤더 펼치기`)}let e=localStorage.getItem(`sellnance_panel_swapped`)===`true`;if(document.documentElement.classList.toggle(`panel-swapped-mode`,e),e){let e=document.getElementById(`panel-split-container`),t=document.getElementById(`left-panel`);e&&(e.style.setProperty(`flex-direction`,`row-reverse`,`important`),e.classList.remove(`flex-row`,`md:flex-row`),e.classList.add(`panel-swapped`,`flex-row-reverse`)),t&&(t.style.borderRightWidth=`0px`,t.style.borderLeftWidth=`1px`)}let t=localStorage.getItem(`sellnance_table_view_mode`);if(!t||t===`simple`){t=`basic`;try{localStorage.setItem(`sellnance_table_view_mode`,`basic`)}catch{}}typeof p==`function`&&p(t,!1),typeof window.restoreControlPanelUI==`function`&&window.restoreControlPanelUI(),typeof window.updateCandleThemeButtons==`function`&&window.updateCandleThemeButtons(),typeof window.updateSortUI==`function`&&window.updateSortUI(s.currentSortCol,s.sortState)}catch{}}var v=null;function y(){return v||(v=(async()=>{ie(),typeof window.restoreControlPanelUI==`function`&&window.restoreControlPanelUI(),typeof te==`function`&&te();try{typeof window.initChart==`function`?await window.initChart():typeof u==`function`&&await u(),await Promise.all([c(),f()]),s.currentTableData&&s.currentTableData.length>0&&(h(),g(),d(),typeof window.initInfiniteScroll==`function`&&window.initInfiniteScroll(),typeof window.initAllExchangeFeeds==`function`&&window.initAllExchangeFeeds(),s.isEngineStarted=!0,_())}catch(e){console.error(`Dashboard engine init error:`,e)}})(),v)}window.initDashboardEngine=y;function b(){let e=document.getElementById(`status-timer`),t=document.getElementById(`status-users`),n=document.getElementById(`tooltip-timer`),r=document.getElementById(`tooltip-users`),i=document.getElementById(`status-tooltip-text`),a=document.getElementById(`status-timer-dot`),o=s.activeUsers||1;if(t&&(t.innerText=`${o} Active`),r&&(r.innerText=`${o} Active`),!s.lastUpdatedRaw&&!s.nextUpdateRaw){e&&(e.innerText=`--:-- 이후 갱신`),n&&(n.innerText=`--:--`);return}let c=Math.floor(Date.now()/1e3),l=localStorage.getItem(`CMC_API_KEY`)&&localStorage.getItem(`CMC_API_KEY`).trim()!==``,u=0;if(s.nextUpdateRaw)u=Math.floor(s.nextUpdateRaw-c);else if(s.lastUpdatedRaw){let e=l?900:14400,t=Math.floor(s.lastUpdatedRaw)+e;u=Math.floor(t-c)}else{e&&(e.innerText=`--:-- 이후 갱신`),n&&(n.innerText=`--:--`);return}if(u<=0){let t=`대기 중...`;e&&(e.innerText=t),n&&(n.innerText=t);let r=Date.now();(!s._lastAutoSilentFetch||r-s._lastAutoSilentFetch>1e4)&&(s._lastAutoSilentFetch=r,typeof window.loadTableDataSilent==`function`&&window.loadTableDataSilent());return}let d=`<svg class="inline-block w-3 h-3 mr-1 align-middle text-theme-text opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,f=Math.floor(u/3600),p=Math.floor(u%3600/60),m=`${f.toString().padStart(2,`0`)}:${p.toString().padStart(2,`0`)}`;l?s.cmcStatus===`INVALID_KEY`?(e&&(e.innerHTML=`${d}${m} (키 오류)`,e.title=`CMC API 키 오류 (서버 정기 캐시 유지)`,e.style.cursor=`default`),n&&(n.innerHTML=`<span class="text-rose-400 font-bold">⚠️ CMC API 키 오류</span>`),i&&(i.innerHTML=`<span class="text-rose-400 font-bold">입력하신 개인 CMC API 키가 유효하지 않아요</span><br/>실시간 시세 및 차트는 정상 작동하며, 시가총액은 서버 캐시로 안전하게 유지할게요<br/><span class="text-xs opacity-75 text-theme-accent">설정에서 유효한 키인지 다시 확인해 주세요</span>`),a&&(a.className=`inline-block w-2 h-2 min-[1200px]:w-1.5 min-[1200px]:h-1.5 rounded-full bg-rose-500 animate-pulse`)):(e&&(e.innerText=`${m} 이후 갱신`,e.title=``,e.style.cursor=`default`),n&&(n.innerHTML=`<svg class="inline-block w-3.5 h-3.5 mr-1 align-middle text-theme-text opacity-85" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>${m} 남음 (15분 주기)`),i&&(i.innerHTML=`개인 CMC API 키 연동 완료 <svg class="inline-block w-3.5 h-3.5 ml-1 align-middle text-theme-text opacity-85" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path></svg><br/>15분 주기로 시총이 자동 갱신됩니다.`),a&&(a.className=`inline-block w-2 h-2 min-[1200px]:w-1.5 min-[1200px]:h-1.5 rounded-full bg-emerald-500 animate-pulse`)):(e&&(e.innerHTML=`${d}${m} (정기 캐시)`,e.title=``,e.style.cursor=`default`),n&&(n.innerHTML=`${d}${m} (정기 캐시)`),i&&(i.innerHTML=`개인 CMC API 키 미입력 상태에요<br/>서버 정기 캐시 모드(4시간 주기)로 시총을 갱신할게요`),a&&(a.className=`inline-block w-2 h-2 min-[1200px]:w-1.5 min-[1200px]:h-1.5 rounded-full bg-amber-400 animate-pulse`))}function ae(e){if(e&&e.stopPropagation(),window.innerWidth<1200){let e=document.getElementById(`mobile-chart-overlay`);if(e&&e.style.opacity===`1`&&!e.classList.contains(`hidden`)||window.store&&window.store._currentMobileTab===`chart`)return}let t=document.getElementById(`status-cache-tooltip`);t&&(t.classList.contains(`opacity-100`)?(t.classList.remove(`opacity-100`,`pointer-events-auto`,`translate-y-0`),t.classList.add(`opacity-0`,`pointer-events-none`,`translate-y-1`)):(b(),t.classList.remove(`opacity-0`,`pointer-events-none`,`translate-y-1`),t.classList.add(`opacity-100`,`pointer-events-auto`,`translate-y-0`)))}typeof document<`u`&&document.addEventListener(`click`,e=>{if(window.innerWidth<1200){let t=document.getElementById(`server-status-badge`),n=document.getElementById(`status-cache-tooltip`);n&&n.classList.contains(`opacity-100`)&&(!t||!t.contains(e.target))&&(n.classList.remove(`opacity-100`,`pointer-events-auto`,`translate-y-0`),n.classList.add(`opacity-0`,`pointer-events-none`,`translate-y-1`))}}),window.toggleStatusTooltip=ae,window.updateStatusBadge=b;function x(){if(!s.bypassCounters)return;let e=Object.values(s.bypassCounters).reduce((e,t)=>e+t,0),t=document.getElementById(`perf-total-bypass`);t&&(t.innerText=`Total: ${e}`),[`leftDom`,`tabScroll`,`tableUpdate`,`kimchi`,`radarBatch`,`mouseEvent`,`dynamicHtml`,`throttleBypass`,`throttlePass`].forEach(e=>{let t=document.getElementById(`bypass-cnt-${e}`);t&&(t.textContent=s.bypassCounters[e]||0)});let n=document.getElementById(`perf-top-risk-analysis`);if(n){let e=-1,t=`NONE`;Object.entries(s.bypassCounters).forEach(([n,r])=>{r>e&&(e=r,t=n)}),e===0?(n.innerText=`안정 (소켓 수급 정체 혹은 렉 유발 없음)`,n.className=`text-[8.5px] font-semibold text-emerald-400 opacity-90 leading-tight bg-white/2 p-1 rounded font-sans`):(n.innerText=`⚠️ ${{leftDom:`좌측 테이블 DOM 최적화 차단`,chartDom:`우측 차트 렌더러 지연 차단`,orderbook:`실시간 호가창 렌더링 락`,legend:`상단 가격 레전드 문자열 덮어쓰기`,resize:`차트 리사이즈 오버헤드`,mouseEvent:`차트 십자선 마우스 이벤트 지연`,sort:`테이블 실시간 순위 재배치 루프`,tabScroll:`테이블 전체 리렌더링 리플로우`,tableUpdate:`개별 행 셀 텍스트 갱신 과부하`,kimchi:`3초 주기 김프 연산 전파 루프`,radarBatch:`3초 레이더 일괄 갱신 차단`,dynamicHtml:`김프 전파 HTML 동적 렌더링 과부하`}[t]||t} (${e}회 Bypass)`,n.className=`text-[8.5px] font-semibold text-rose-400 opacity-90 leading-tight bg-white/2 p-1 rounded font-sans`)}}window.updatePerformanceDebugger=x;var S=null,C=null;function oe(){S&&clearInterval(S),C=Date.now(),s.bypassCounters&&Object.keys(s.bypassCounters).forEach(e=>{s.bypassCounters[e]=0});let e=document.getElementById(`perf-run-time-display`);e&&(e.innerText=`(0s 경과)`),x(),S=setInterval(()=>{if(C){let e=Math.floor((Date.now()-C)/1e3),t=document.getElementById(`perf-run-time-display`);t&&(t.innerText=`(${e}s 경과)`)}x()},1e3)}window.startPerformanceDebugger=oe;function se(){S&&=(clearInterval(S),null)}window.stopPerformanceDebugger=se;function w(){let e=window.location.pathname.replace(/^\/+|\/+$/g,``);return e&&![`api`,`static`,`assets`,`index.html`,`favicon.ico`].includes(e.toLowerCase())?decodeURIComponent(e):window.location.hash&&window.location.hash.length>1?decodeURIComponent(window.location.hash.substring(1)):null}window.getInitialRouteSymbol=w;function ce(){let e=new Date,t=new Date;t.setUTCHours(0,0,0,0),e>=t&&t.setUTCDate(t.getUTCDate()+1);let n=t.getTime()-e.getTime();setTimeout(()=>{let e=s.marketDataMap?.krw_usd_rate||1e3;s.currentTableData&&Array.isArray(s.currentTableData)&&(s.currentTableData.forEach(t=>{t.Binance_Price_Futures&&(t.futures_utc0_open_Raw=t.Binance_Price_Futures),t.Binance_Price_Spot&&(t.spot_utc0_open_Raw=t.Binance_Price_Spot),(t.Price_KRW||t.Price_Raw&&e>0)&&(t.utc0_open_KRW=t.Price_KRW||t.Price_Raw*e),t.Price_Raw&&(t.utc0_open_Raw=t.Price_Raw),t.Change_Today_Raw=0,t.Change_Today_Futures=0,t.Change_Today_Spot=0,t.Change_Today_Binance=0,t.Change_Today_Upbit=0,t.Change_Today_Bithumb=0,t.Change_Today_Bybit=0}),typeof window.renderTable==`function`&&window.renderTable()),s.currentAsset&&typeof window.selectSymbol==`function`&&window.selectSymbol(s.currentAsset),setTimeout(()=>{typeof window.loadTableData==`function`&&window.loadTableData(!0,!0)},2e3),ce()},n)}function le(){try{let e=localStorage.getItem(`sellnance_last_tf`);e&&[`1m`,`3m`,`5m`,`15m`,`30m`,`1h`,`4h`,`12h`,`1d`,`3d`,`1w`,`1M`].includes(e)&&(s.currentTF=e)}catch{}let e=w();if(e&&s.isEngineStarted)typeof n==`function`&&n(e);else if(window.innerWidth<1200)try{(sessionStorage.getItem(`sellnance_active_mobile_tab`)||`list`)===`chart`&&typeof switchMobileTab==`function`&&switchMobileTab(`chart`)}catch{}let t=()=>{let e=w();e&&s.isEngineStarted&&typeof n==`function`&&n(e)};window.addEventListener(`popstate`,t),window.addEventListener(`hashchange`,t)}function ue(){let e=0,t=()=>{if(typeof document<`u`&&document.visibilityState!==`visible`)return;let t=e>0?Date.now()-e:0;typeof window.flushRealtimeRender==`function`&&window.flushRealtimeRender(),typeof window.refreshSniperTarget==`function`&&window.refreshSniperTarget(),t>10*1e3&&s.currentAsset&&s.candleSeries&&!s.isFetchingChart&&!s.isSilentSyncing&&typeof window.fetchHistory==`function`&&window.fetchHistory(s.currentAsset,!1,!1,!1,s.currentUid,!0),t>30*1e3&&(typeof window.syncSniperSubscriptions==`function`&&window.syncSniperSubscriptions(),typeof window.initAllExchangeFeeds==`function`&&window.initAllExchangeFeeds(),typeof window.loadTableDataSilent==`function`?window.loadTableDataSilent():typeof window.loadTableData==`function`&&window.loadTableData(!1,!0)),e=0};typeof document<`u`&&document.addEventListener(`visibilitychange`,()=>{document.visibilityState===`hidden`?e=Date.now():document.visibilityState===`visible`&&t()}),typeof window<`u`&&window.addEventListener(`focus`,()=>{e>0&&t()})}var T={cycleIntervalMs:3e3,goldenRatio:`1.618 / 1`,deckWidth:`100%`,deckMaxWidth:`800px`,compassCycle:[`NW`,`NE`],tiltAngle:[5,5,-5,-5],scale:1,perspective:1200,exitDurationMs:200,auraInset:`0px`,auraBorderRadius:`20px`,auraBlur:`14px`,auraOpacity:.07,auraBackground:`radial-gradient(ellipse at center, var(--accent) 0%, transparent 60%)`,auraBoxShadow:`0 0 12px var(--accent)`},E=[{layout:`spread`,tf:`4h`,candleMode:`unique`},{layout:`overlap`,tf:`1d`,candleMode:`unique`},{layout:`spread`,tf:`4h`,candleMode:`default`},{layout:`overlap`,tf:`1d`,candleMode:`default`}],de={NE:{rx:1,ry:-1,rz:1},NW:{rx:1,ry:1,rz:-1},SW:{rx:-1,ry:1,rz:1},SE:{rx:-1,ry:-1,rz:-1},N:{rx:1.2,ry:0,rz:0},S:{rx:-1.2,ry:0,rz:0},E:{rx:0,ry:-1.2,rz:0},W:{rx:0,ry:1.2,rz:0},CENTER:{rx:0,ry:0,rz:0}},D=0;function O(e=1){let t=T.compassCycle,n=de[t[D%t.length]||`NE`]||de.NE,r=Array.isArray(T.tiltAngle)?T.tiltAngle:[T.tiltAngle],i=r[D%r.length]??10;return`rotateX(${(n.rx*i).toFixed(1)}deg) rotateY(${(n.ry*i).toFixed(1)}deg) rotateZ(${(n.rz*(i/4)).toFixed(1)}deg) scale(${(T.scale*e).toFixed(3)})`}function fe(e=1){return O(1.03*e)}function pe(){return`
    <style>
      #start-screen {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100dvh;
        background-color: color-mix(in srgb, var(--bg) 80%, transparent);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        font-family: var(--font-sans);
        perspective: ${T.perspective}px;
        overflow: hidden;
        transition: opacity ${T.exitDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${T.exitDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1);
        will-change: opacity, transform;
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
        width: ${T.deckWidth};
        max-width: ${T.deckMaxWidth};
        aspect-ratio: ${T.goldenRatio};
        perspective: ${T.perspective}px;
        transform-style: preserve-3d;
        pointer-events: none;
        overflow: visible !important;
        margin: auto;
      }

      @media (max-width: 767px) {
        #start-qv-preview-container,
        .start-qv-preview-wrapper {
          display: none !important;
        }
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
        animation: startBorderProgress ${T.cycleIntervalMs}ms linear infinite;
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
        aspect-ratio: ${T.goldenRatio};
        transform-origin: center center;
        transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: opacity, transform;
        transform: ${O(1)};
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
        inset: ${T.auraInset};
        border-radius: ${T.auraBorderRadius};
        background: ${T.auraBackground};
        box-shadow: ${T.auraBoxShadow};
        filter: blur(${T.auraBlur});
        opacity: ${T.auraOpacity};
        pointer-events: none;
        z-index: 0;
        transform-origin: center center;
        transition: transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.85s ease;
        transform: ${fe(1)};
      }

      #start-qv-overlap-view {
        position: absolute;
        inset: 0;
        border-radius: 20px;
        aspect-ratio: ${T.goldenRatio};
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
        transform: ${O(.96)};
        opacity: 0;
      }
      .start-qv-card {
        position: relative;
        aspect-ratio: ${T.goldenRatio};
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
      id="start-screen" style="${localStorage.getItem(`sellnance_skip_start`)===`true`?`display: none;`:`display: flex;`}"
      class="fixed inset-0 z-[500] flex items-center justify-center overflow-hidden p-4 md:p-8 bg-theme-bg text-theme-text"
    >
      <div class="w-full max-w-6xl h-full max-h-[820px] flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 sm:gap-5 md:gap-8 relative z-10">
        
        <!-- 🚀 [좌측 (58% 비중)]: 3D 아이소메트릭 쿼터뷰 4대장 차트 덱 (PC 전용, 모바일 숨김, 순수 전시용으로 클릭 간섭 0% 차단) -->
        <div class="start-qv-preview-wrapper hidden md:flex w-full md:w-[58%] h-auto md:h-[75vh] max-h-[240px] md:max-h-none relative items-center justify-center overflow-visible mb-2 md:mb-0 pointer-events-none select-none">
          <div id="start-qv-preview-container" class="w-full relative overflow-visible pointer-events-none opacity-90 my-auto">
            <!-- 🚀 3D 덱 하단 바닥 투영 앰비언트 섀도우 (800px 황금비 직사각형 덱 전용) -->
            <div class="start-qv-floor-shadow pointer-events-none"></div>

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
            <div id="start-qv-spread-view" class="pointer-events-none">
              <!-- 🚀 4개 카드 전체 둘레를 감싸는 단 1개의 3D 외곽 프로그레스 바 -->
              <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="var(--border)" stroke-width="0.7" />
                <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
              </svg>
              <div id="start-qv-cards-grid" class="pointer-events-none"></div>
            </div>

            <!-- 2. Overlap 3D 레이어 (내부 직접 3D 투영 프로그레스) -->
            <div id="start-qv-overlap-view" class="pointer-events-none">
              <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="var(--border)" stroke-width="0.7" />
                <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
              </svg>
            </div>
          </div>
        </div>

        <!-- 🚀 [우측 (42% 비중)]: CMC 로그인 & 메인 대시보드 진입 패널 (최상위 z-50 및 pointer-events-auto 보장) -->
        <div class="w-full md:w-[42%] max-w-md flex flex-col justify-center my-auto -translate-y-5 sm:-translate-y-8 md:translate-y-0 md:my-0 relative z-50 pointer-events-auto">
          <div class="start-main-card relative z-50 pointer-events-auto p-4 sm:p-6 md:p-8 w-full flex flex-col gap-3.5 md:gap-5 text-center">
            <!-- 🚀 우측 상단 다크/라이트 모드 토글 버튼 -->
            <button
              type="button"
              id="start-theme-toggle-btn"
              onclick="if (window.toggleTheme) window.toggleTheme();"
              class="absolute top-3 sm:top-4 right-3 sm:right-4 w-8 h-8 rounded-xl flex items-center justify-center text-sm bg-theme-bg/60 hover:bg-theme-bg border border-theme-border text-theme-text active:scale-90 cursor-pointer shadow-sm z-30 select-none transition-transform"
              title="다크 / 라이트 테마 전환"
            >
              ${document.documentElement.classList.contains(`theme-upbit`)||document.body?.classList.contains(`theme-upbit`)||localStorage.getItem(`sellnance_theme`)===`upbit`?`☀️`:`🌙`}
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
                  placeholder="Paste your CMC API Key..."
                  class="w-full bg-theme-bg text-theme-text border-2 border-theme-border pl-4 pr-11 py-2.5 md:py-3.5 rounded-xl text-center font-medium text-sm focus:outline-none focus:border-theme-accent shadow-inner transition-colors cursor-text"
                  autocomplete="off"
                  spellcheck="false"
                />
                <!-- 🚀 감각적인 X 클리어 버튼 (입력 시 부드러운 스케일+페이드인) -->
                <button
                  type="button"
                  id="btn-clear-cmc-key"
                  class="absolute right-3 z-10 w-6 h-6 rounded-full flex items-center justify-center bg-theme-panel hover:bg-theme-border border border-theme-border text-theme-text/60 hover:text-theme-accent active:scale-90 transition-transform opacity-0 pointer-events-none scale-75 cursor-pointer"
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
                onclick="saveAndStart()"
                class="w-full py-3 md:py-3.5 bg-theme-accent text-white font-bold rounded-xl shadow-sm hover:brightness-105 active:scale-[0.98] transition-transform tracking-widest uppercase cursor-pointer pointer-events-auto text-xs md:text-sm"
              >
                Start Dashboard
              </button>

              <!-- 2. 바로 이동 (서브 액션) -->
              <button
                id="btn-skip-start"
                onclick="skipAndStart()"
                class="w-full py-2.5 md:py-3 bg-theme-bg/40 text-theme-text border border-theme-border font-medium rounded-xl hover:bg-theme-panel active:scale-[0.98] transition-transform tracking-wide opacity-70 hover:opacity-100 cursor-pointer pointer-events-auto text-xs"
              >
                바로 이동 (서버 캐시 모드, 느린 갱신)
              </button>

              <!-- 3. 🚀 시작 화면 자동 건너뛰기 공통 설정 (두 버튼 모두에 대응) -->
              <div class="flex items-center justify-center pt-1">
                <label
                  class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-theme-border/20 cursor-pointer select-none group transition-all pointer-events-auto"
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
    `}var k=``;function A(e){if(!e)return``;let t=e.length;if(t<=8)return e;let n=e.slice(0,4),r=e.slice(-4);return`${n}${`*`.repeat(t-8)}${r}`}var j=[{symbol:`BTCUSDT`,ticker:`BTC`,icon:`/static/coins/btc.png`,color:`#f0b90b`,rgba:`rgba(240, 185, 11, 0.65)`},{symbol:`ETHUSDT`,ticker:`ETH`,icon:`/static/coins/eth.png`,color:`#3b82f6`,rgba:`rgba(59, 130, 246, 0.65)`},{symbol:`XRPUSDT`,ticker:`XRP`,icon:`/static/coins/xrp.png`,color:`#26a69a`,rgba:`rgba(38, 166, 154, 0.65)`},{symbol:`SOLUSDT`,ticker:`SOL`,icon:`/static/coins/sol.png`,color:`#a855f7`,rgba:`rgba(168, 85, 247, 0.65)`}],M=[],N=[],P=[],F=[],I=null,L=null,R=`15m`,z=0;async function me(){let e=document.getElementById(`start-qv-spread-view`),t=document.getElementById(`start-qv-overlap-view`);if(!e||!t||(M=[],N=[],P=[],F=[],typeof LightweightCharts>`u`&&await new Promise(e=>{let t=setInterval(()=>{typeof LightweightCharts<`u`&&(clearInterval(t),e())},20);setTimeout(()=>{clearInterval(t),e()},4e3)}),typeof LightweightCharts>`u`))return;e.innerHTML=`
    <!-- 🚀 4개 카드 전체 둘레를 감싸는 단 1개의 3D 외곽 프로그레스 바 -->
    <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="rgba(0, 209, 255, 0.08)" stroke-width="0.7" />
      <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
    </svg>
    <div id="start-qv-cards-grid"></div>
  `;let n=document.getElementById(`start-qv-cards-grid`);j.forEach((e,t)=>{let r=document.createElement(`div`);r.className=`start-qv-card`,r.id=`start-qv-spread-card-${t}`,r.innerHTML=`
      <div class="start-qv-badge flex items-center gap-1.5">
        <img src="${e.icon}" class="w-3.5 h-3.5 rounded-full object-cover shadow-sm flex-shrink-0" alt="${e.ticker}" />
        <span class="text-xs font-bold" style="color: ${e.color}">${e.ticker}</span>
        <span id="start-qv-spread-tf-${t}" class="text-[9px] px-1 py-0.2 font-mono font-bold rounded bg-theme-accent/20 border border-theme-accent/40 text-theme-accent">15M</span>
        <span id="start-qv-spread-price-${t}" class="text-[10px] text-white/80 font-medium ml-1">Loading...</span>
      </div>
      <div class="start-qv-canvas" id="start-qv-spread-canvas-${t}"></div>
    `,n.appendChild(r);let i=r.querySelector(`.start-qv-canvas`),a=LightweightCharts.createChart(i,{layout:{background:{color:`transparent`},textColor:`rgba(255,255,255,0.4)`,fontSize:9,fontFamily:`Outfit, sans-serif`,attributionLogo:!1},grid:{vertLines:{color:`rgba(255,255,255,0.03)`},horzLines:{color:`rgba(255,255,255,0.03)`}},crosshair:{vertLine:{visible:!1},horzLine:{visible:!1}},rightPriceScale:{visible:!1,borderVisible:!1},timeScale:{visible:!1,borderVisible:!1,rightOffset:1,fixLeftEdge:!1},handleScroll:!1,handleScale:!1}),o={upColor:e.color,downColor:e.color,wickUpColor:e.color,wickDownColor:e.color,borderVisible:!1},s=typeof a.addCandlestickSeries==`function`?a.addCandlestickSeries(o):a.addSeries(window.LightweightCharts.CandlestickSeries,o);M.push(a),N.push(s)}),t.innerHTML=`
    <!-- 🚀 3D 투영 완전 일치 내장 프로그레스 테두리 -->
    <svg class="start-qv-inner-progress pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <rect x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="rgba(0, 209, 255, 0.08)" stroke-width="0.7" />
      <rect class="start-qv-progress-rect" x="0.5" y="0.5" width="99" height="99" rx="3.5" ry="3.5" fill="none" stroke="url(#startProgressGlow)" stroke-width="1.2" stroke-linecap="round" pathLength="100" stroke-dasharray="100.2 100.2" stroke-dashoffset="100.2" />
    </svg>
    <div class="start-qv-overlap-legend">
      <span class="text-[10px] uppercase tracking-wider text-theme-accent font-bold">OVERLAP</span>
      <span id="start-qv-overlap-tf" class="text-[9px] px-1.5 py-0.2 font-mono font-bold rounded bg-theme-accent/20 border border-theme-accent/40 text-theme-accent">15M</span>
      <div class="flex items-center gap-2 ml-2">
        ${j.map((e,t)=>`
          <div class="start-qv-legend-item flex items-center gap-1 cursor-pointer px-1.5 py-0.5" data-idx="${t}">
            <img src="${e.icon}" class="w-3 h-3 rounded-full object-cover flex-shrink-0" alt="${e.ticker}" />
            <span style="color: ${e.color}">${e.ticker}</span>
            <span id="start-qv-overlap-price-${t}" class="text-[10px] text-white/70 font-medium">...</span>
          </div>`).join(``)}
      </div>
    </div>
    <div class="relative w-full flex-1 min-h-[80px]">
      ${j.map((e,t)=>`<div class="start-qv-canvas absolute inset-0 w-full h-full" id="start-qv-overlap-canvas-${t}"></div>`).join(``)}
    </div>
  `,t.querySelectorAll(`.start-qv-legend-item`).forEach(e=>{let t=parseInt(e.getAttribute(`data-idx`));e.addEventListener(`mouseenter`,()=>he(t)),e.addEventListener(`mouseleave`,()=>he(-1))}),j.forEach((e,t)=>{let n=document.getElementById(`start-qv-overlap-canvas-${t}`);if(!n)return;let r=LightweightCharts.createChart(n,{layout:{background:{color:`transparent`},textColor:`rgba(255,255,255,0.4)`,fontSize:9,fontFamily:`Outfit, sans-serif`,attributionLogo:!1},grid:{vertLines:{color:t===0?`rgba(255,255,255,0.03)`:`transparent`},horzLines:{color:t===0?`rgba(255,255,255,0.03)`:`transparent`}},crosshair:{vertLine:{visible:!1},horzLine:{visible:!1}},rightPriceScale:{visible:!1,borderVisible:!1},timeScale:{visible:!1,borderVisible:!1,rightOffset:1,fixLeftEdge:!1},handleScroll:!1,handleScale:!1}),i={upColor:e.rgba,downColor:e.rgba,wickUpColor:e.rgba,wickDownColor:e.rgba,borderVisible:!1},a=typeof r.addCandlestickSeries==`function`?r.addCandlestickSeries(i):r.addSeries(window.LightweightCharts.CandlestickSeries,i);P.push(r),F.push(a)}),ge(R),_e(R),L&&clearInterval(L),H(),L=setInterval(()=>{be()},T.cycleIntervalMs),window.removeEventListener(`resize`,U),window.addEventListener(`resize`,U),requestAnimationFrame(()=>{U()})}function he(e){j.forEach((t,n)=>{let r=document.getElementById(`start-qv-overlap-canvas-${n}`),i=document.querySelector(`.start-qv-legend-item[data-idx="${n}"]`);r&&(e===-1?(r.style.opacity=`0.55`,i&&(i.style.borderColor=`transparent`,i.style.opacity=`1`)):n===e?(r.style.opacity=`1`,i&&(i.style.borderColor=t.color,i.style.opacity=`1`)):(r.style.opacity=`0.2`,i&&(i.style.borderColor=`transparent`,i.style.opacity=`0.4`)))})}async function ge(e){let t=j.map(async(t,n)=>{try{let r=await(await fetch(`https://api.binance.com/api/v3/klines?symbol=${t.symbol}&interval=${e}&limit=60`)).json();if(Array.isArray(r)){let e=r.map(e=>({time:Math.floor(e[0]/1e3),open:parseFloat(e[1]),high:parseFloat(e[2]),low:parseFloat(e[3]),close:parseFloat(e[4])}));N[n]&&(N[n].setData(e),M[n]&&(M[n].timeScale().fitContent(),M[n].timeScale().applyOptions({rightOffset:1}))),F[n]&&(F[n].setData(e),P[n]&&(P[n].timeScale().fitContent(),P[n].timeScale().applyOptions({rightOffset:1})));let t=e[e.length-1]?.close;if(t){let e=document.getElementById(`start-qv-spread-price-${n}`),r=document.getElementById(`start-qv-overlap-price-${n}`);e&&(e.innerText=`$${t.toLocaleString()}`),r&&(r.innerText=`$${t.toLocaleString()}`)}}}catch{}});await Promise.all(t)}var B={},V=[];function _e(e){let t=j.map(t=>`${t.symbol.toLowerCase()}@kline_${e}`),n=t.join(`/`);if(I&&(I.readyState===WebSocket.OPEN||I.readyState===WebSocket.CONNECTING)){if(I.readyState===WebSocket.OPEN)try{V.length>0&&I.send(JSON.stringify({method:`UNSUBSCRIBE`,params:V,id:Date.now()})),I.send(JSON.stringify({method:`SUBSCRIBE`,params:t,id:Date.now()+1}))}catch{}V=t;return}if(I){try{I.onopen=null,I.onmessage=null,I.onerror=null,I.onclose=null,I.close()}catch{}I=null}V=t,B={};try{I=new WebSocket(`wss://stream.binance.com:9443/stream?streams=${n}`),I.onopen=()=>{if(I&&V.length>0)try{I.send(JSON.stringify({method:`SUBSCRIBE`,params:V,id:Date.now()}))}catch{}},I.onmessage=e=>{try{let t=JSON.parse(e.data);if(!t.data||!t.data.k)return;let n=t.data.k,r=t.data.s,i=Date.now();if(B[r]&&i-B[r]<500)return;B[r]=i;let a=j.findIndex(e=>e.symbol===r);if(a!==-1){let e={time:Math.floor(n.t/1e3),open:parseFloat(n.o),high:parseFloat(n.h),low:parseFloat(n.l),close:parseFloat(n.c)};N[a]&&N[a].update(e),F[a]&&F[a].update(e);let t=document.getElementById(`start-qv-spread-price-${a}`),r=document.getElementById(`start-qv-overlap-price-${a}`);t&&(t.innerText=`$${e.close.toLocaleString()}`),r&&(r.innerText=`$${e.close.toLocaleString()}`)}}catch{}},I.onerror=()=>{},I.onclose=()=>{I=null,V=[]}}catch{}}function ve(e){j.forEach((t,n)=>{let r=t.color,i=t.color,a=t.rgba,o=t.rgba;e==="default"&&(r=`#0ecb81`,i=`#f6465d`,a=`rgba(14, 203, 129, 0.65)`,o=`rgba(246, 70, 93, 0.65)`),N[n]&&N[n].applyOptions({upColor:r,downColor:i,wickUpColor:r,wickDownColor:i}),F[n]&&F[n].applyOptions({upColor:a,downColor:o,wickUpColor:a,wickDownColor:o})})}async function ye(e){j.forEach((t,n)=>{let r=document.getElementById(`start-qv-spread-tf-${n}`);r&&(r.innerText=e.toUpperCase())});let t=document.getElementById(`start-qv-overlap-tf`);t&&(t.innerText=e.toUpperCase()),await ge(e),_e(e)}function H(){let e=document.querySelectorAll(`.start-qv-progress-rect`);e.forEach(e=>{e.style.animation=`none`}),requestAnimationFrame(()=>{requestAnimationFrame(()=>{e.forEach(e=>{e.style.animation=`startBorderProgress ${T.cycleIntervalMs}ms linear infinite`})})})}function be(){let e=document.getElementById(`start-qv-spread-view`),t=document.getElementById(`start-qv-overlap-view`);if(!e||!t)return;z=(z+1)%E.length;let n=E[z];ve(n.candleMode),R!==n.tf&&(R=n.tf,ye(n.tf));let r=document.getElementById(`start-qv-spread-card-0`),i=document.getElementById(`start-qv-spread-card-1`),a=document.getElementById(`start-qv-spread-card-2`),o=document.getElementById(`start-qv-spread-card-3`);D++,n.layout===`spread`?(e.style.opacity=`1`,e.style.transform=O(1),e.style.pointerEvents=`none`,r&&(r.style.transform=`translate(0, 0)`),i&&(i.style.transform=`translate(0, 0)`),a&&(a.style.transform=`translate(0, 0)`),o&&(o.style.transform=`translate(0, 0)`),t.style.opacity=`0`,t.style.transform=O(.96),t.style.pointerEvents=`none`):(e.style.opacity=`0`,e.style.transform=O(1.04),e.style.pointerEvents=`none`,r&&(r.style.transform=`translate(18%, 18%)`),i&&(i.style.transform=`translate(-18%, 18%)`),a&&(a.style.transform=`translate(18%, -18%)`),o&&(o.style.transform=`translate(-18%, -18%)`),t.style.opacity=`1`,t.style.transform=O(1),t.style.pointerEvents=`none`),H();let s=document.querySelector(`.start-qv-floor-shadow`);if(s){let e=n.layout===`spread`?1.04:.96;s.style.transform=fe(e),s.style.opacity=(T.auraOpacity*(n.layout===`spread`?1:.8)).toFixed(2)}U(),setTimeout(()=>{U()},860)}function U(){M.forEach((e,t)=>{if(!e)return;let n=document.getElementById(`start-qv-spread-canvas-${t}`);n&&n.clientWidth>0&&n.clientHeight>0&&(e.resize(n.clientWidth,n.clientHeight),e.timeScale().fitContent(),e.timeScale().applyOptions({rightOffset:1}))}),P.forEach((e,t)=>{if(!e)return;let n=document.getElementById(`start-qv-overlap-canvas-${t}`);n&&n.clientWidth>0&&n.clientHeight>0&&(e.resize(n.clientWidth,n.clientHeight),e.timeScale().fitContent(),e.timeScale().applyOptions({rightOffset:1}))})}function xe(){if(L&&=(clearInterval(L),null),I){try{I.close()}catch{}I=null}window.removeEventListener(`resize`,U),M.forEach(e=>{if(e)try{e.remove()}catch{}}),P.forEach(e=>{if(e)try{e.remove()}catch{}}),M=[],N=[],P=[],F=[]}async function W(){document.body.insertAdjacentHTML(`beforeend`,pe());let e=document.getElementById(`cmc-api-input`),t=document.getElementById(`btn-start-engine`),n=document.getElementById(`btn-skip-start`);k=(localStorage.getItem(`CMC_API_KEY`)||``).trim(),k&&e&&(e.value=A(k));let r=document.getElementById(`btn-clear-cmc-key`);function i(){r&&(k||e&&e.value?(r.classList.remove(`opacity-0`,`pointer-events-none`,`scale-75`),r.classList.add(`opacity-100`,`pointer-events-auto`,`scale-100`)):(r.classList.remove(`opacity-100`,`pointer-events-auto`,`scale-100`),r.classList.add(`opacity-0`,`pointer-events-none`,`scale-75`)))}i(),r&&r.addEventListener(`click`,t=>{t.preventDefault(),t.stopPropagation(),k=``,e&&(e.value=``,e.focus()),localStorage.removeItem(`CMC_API_KEY`),i()});let a=document.getElementById(`chk-auto-skip`);if(a&&(a.checked=localStorage.getItem(`sellnance_skip_start`)===`true`,a.addEventListener(`change`,e=>{e.target.checked?localStorage.setItem(`sellnance_skip_start`,`true`):localStorage.removeItem(`sellnance_skip_start`)})),e&&(e.addEventListener(`focus`,()=>{e.value=k,i()}),e.addEventListener(`input`,t=>{k=e.value.replace(/[^a-zA-Z0-9]/g,``),e.value=k,i()}),e.addEventListener(`blur`,()=>{e.value=A(k),i()})),localStorage.getItem(`sellnance_skip_start`)===`true`){G();return}window.history&&window.history.replaceState&&(window.location.pathname!==`/`||window.location.hash)&&window.history.replaceState(null,null,`/`),document.documentElement.classList.add(`start-screen-active`);let o=document.getElementById(`main-dashboard-content`);o&&(o.style.display=`none`),e&&(e.disabled=!1,e.placeholder=`Paste your CMC API Key...`,e.classList.remove(`opacity-50`,`cursor-not-allowed`)),t&&(t.disabled=!1,t.innerText=`Start Dashboard`,t.className=`flex-1 py-3.5 bg-theme-accent text-white font-semibold rounded-xl shadow-sm hover:brightness-105 active:scale-[0.98] transition-transform tracking-widest uppercase cursor-pointer pointer-events-auto border border-theme-accent/40`),n&&(n.disabled=!1,n.innerText=`바로 이동 (서버 캐시 모드, 느린 갱신)`,n.className=`w-full py-3 bg-theme-bg/40 text-theme-text border border-theme-border font-medium rounded-xl hover:bg-theme-panel active:scale-[0.98] transition-transform tracking-wide opacity-70 hover:opacity-100 cursor-pointer pointer-events-auto`);let s=document.getElementById(`start-screen`);s&&(s.style.display=`flex`),await me()}async function Se(){let e=!!(s&&s.isEngineStarted),t=document.getElementById(`cmc-api-input`);t&&!t.value.includes(`*`)&&(k=t.value.replace(/[^a-zA-Z0-9]/g,``).trim());let n=(k||``).trim();if(n.length!==32){t&&(t.classList.add(`!border-red-500/80`,`shadow-[0_0_15px_rgba(239,68,68,0.3)]`),setTimeout(()=>{t.classList.remove(`!border-red-500/80`,`shadow-[0_0_15px_rgba(239,68,68,0.3)]`)},2e3),t.focus()),l(`CMC API 키는 32자여야 합니다 (${n.length}/32자)`,`warning`,2500);return}let r=document.getElementById(`chk-auto-skip`);r&&r.checked?localStorage.setItem(`sellnance_skip_start`,`true`):localStorage.removeItem(`sellnance_skip_start`);let i=(localStorage.getItem(`CMC_API_KEY`)||``)!==n,a=document.getElementById(`btn-start-engine`);a&&(a.innerText=`VERIFYING KEY...`,a.style.pointerEvents=`none`);try{let r=await(await fetch(`/api/settings`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({CMC_API_KEY:n})})).json();if(!r||r.valid===!1||r.status===`error`){t&&(t.classList.add(`!border-red-500/80`,`shadow-[0_0_15px_rgba(239,68,68,0.3)]`),setTimeout(()=>{t.classList.remove(`!border-red-500/80`,`shadow-[0_0_15px_rgba(239,68,68,0.3)]`)},2e3),t.focus()),a&&(a.innerText=e?`Save & Apply Key`:`Start Dashboard`,a.style.pointerEvents=`auto`),l(r?.message||`CMC API Key 인증에 실패했습니다. 키를 다시 확인해주세요.`,`warning`,3e3);return}requestAnimationFrame(()=>{setTimeout(()=>{localStorage.setItem(`CMC_API_KEY`,n),G(),e&&i&&typeof f==`function`&&f(!0,!0)},0)})}catch(t){console.error(`CMC validation error in start screen:`,t),a&&(a.innerText=e?`Save & Apply Key`:`Start Dashboard`,a.style.pointerEvents=`auto`),l(`서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`,`error`,3e3)}}function Ce(){let e=!!(s&&s.isEngineStarted),t=document.getElementById(`chk-auto-skip`);t&&t.checked?localStorage.setItem(`sellnance_skip_start`,`true`):localStorage.removeItem(`sellnance_skip_start`);let n=document.getElementById(`btn-skip-start`);n&&(n.innerText=e?`CLOSING...`:`ENTERING CACHE MODE...`,n.style.pointerEvents=`none`),requestAnimationFrame(()=>{setTimeout(()=>{G()},0)})}function G(){xe(),document.documentElement.classList.remove(`start-screen-active`);let e=document.getElementById(`main-dashboard-content`);if(e&&(e.style.display=`flex`),s.isEngineStarted||(typeof y==`function`?y():typeof window.initDashboardEngine==`function`&&window.initDashboardEngine()),typeof window.restoreControlPanelUI==`function`&&window.restoreControlPanelUI(),s.isEngineStarted&&s.currentSelectedSymbol&&window.history&&window.history.replaceState){let e=s.currentSelectedSymbol,t=e.startsWith(`/`)?e:`/${e}`;window.location.pathname!==t&&!window.location.hash&&window.history.replaceState(null,null,t)}let t=document.getElementById(`start-screen`);t?(t.style.transform=`scale(0.98) translateY(6px)`,t.style.opacity=`0`,setTimeout(()=>{t.style.display=`none`,typeof window.showOnboardingModal==`function`&&window.showOnboardingModal()},T.exitDurationMs)):typeof window.showOnboardingModal==`function`&&window.showOnboardingModal()}async function we(){let e=!!(s&&s.isEngineStarted);document.documentElement.classList.add(`start-screen-active`);let t=document.getElementById(`main-dashboard-content`);t&&(t.style.display=`none`);let n=document.getElementById(`start-screen`);if(!n){await W();return}let r=document.getElementById(`btn-start-engine`),i=document.getElementById(`btn-skip-start`);r&&(r.innerText=e?`Save & Apply Key`:`Start Dashboard`,r.style.pointerEvents=`auto`),i&&(i.innerText=e?`대시보드로 돌아가기`:`바로 이동 (서버 캐시 모드, 느린 갱신)`,i.style.pointerEvents=`auto`);let a=document.getElementById(`cmc-api-input`),o=document.getElementById(`btn-clear-cmc-key`);k=(localStorage.getItem(`CMC_API_KEY`)||``).trim(),a&&(a.value=A(k)),o&&(k||a&&a.value?(o.classList.remove(`opacity-0`,`pointer-events-none`,`scale-75`),o.classList.add(`opacity-100`,`pointer-events-auto`,`scale-100`)):(o.classList.remove(`opacity-100`,`pointer-events-auto`,`scale-100`),o.classList.add(`opacity-0`,`pointer-events-none`,`scale-75`)));let c=document.getElementById(`chk-auto-skip`);c&&(c.checked=localStorage.getItem(`sellnance_skip_start`)===`true`);let l=document.getElementById(`start-theme-toggle-btn`);if(l&&(l.innerHTML=document.body.classList.contains(`theme-upbit`)||localStorage.getItem(`sellnance_theme`)===`upbit`?`☀️`:`🌙`),z=0,D=0,R=E[0].tf,L&&=(clearInterval(L),null),I){try{I.close()}catch{}I=null}(!M||M.length===0)&&await me();let u=E[0];ve(u.candleMode);let d=document.getElementById(`start-qv-spread-view`),f=document.getElementById(`start-qv-overlap-view`),p=document.getElementById(`start-qv-spread-card-0`),m=document.getElementById(`start-qv-spread-card-1`),h=document.getElementById(`start-qv-spread-card-2`),g=document.getElementById(`start-qv-spread-card-3`);d&&f&&(d.style.opacity=`1`,d.style.transform=O(1),d.style.pointerEvents=`none`,p&&(p.style.transform=`translate(0, 0)`),m&&(m.style.transform=`translate(0, 0)`),h&&(h.style.transform=`translate(0, 0)`),g&&(g.style.transform=`translate(0, 0)`),f.style.opacity=`0`,f.style.transform=O(.96),f.style.pointerEvents=`none`),L&&clearInterval(L),H(),L=setInterval(()=>{be()},T.cycleIntervalMs),n.style.display=`flex`,n.style.pointerEvents=`auto`,requestAnimationFrame(()=>{n.style.transform=`scale(1) translateY(0px)`,n.style.opacity=`1`,U()}),window.history&&window.history.pushState&&(window.location.pathname!==`/`||window.location.hash)&&window.history.pushState(null,null,`/`)}document.readyState===`loading`?window.addEventListener(`DOMContentLoaded`,W):W(),window.saveAndStart=Se,window.skipAndStart=Ce,window.showStartScreen=we;var K={baseTarget:`ALL`,sortType:``,page:1,timeframe:`1h`,layout:`spread`,activeAssets:[],charts:[],series:[],candlesData:[],binanceWs:null,binanceFuturesWs:null,upbitWs:null,bithumbWs:null,focusIndex:-1,candleColorMode:`default`,maxPage:1,barCounts:[]},q=[`#3b82f6`,`#26a69a`,`#ef5350`,`#f0b90b`,`#a855f7`,`#ec4899`,`#f97316`,`#06b6d4`];async function J(){let e=document.getElementById(`quickview-container`);e&&(e.classList.remove(`hidden`),e.classList.add(`qv-modal`),e.style.display=`flex`);let t=document.getElementById(`quickview-init-overlay`);if(!K.sortType){t&&t.classList.remove(`hidden`);return}t&&t.classList.add(`hidden`),document.querySelectorAll(`.qv-sort-btn`).forEach(e=>{e.id===`qv-sort-${K.sortType}`?e.className=`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-white bg-theme-accent`:e.className=`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-theme-text opacity-50 hover:opacity-100`}),document.querySelectorAll(`.qv-tf-btn`).forEach(e=>{e.id===`qv-tf-${K.timeframe}`?e.className=`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-white bg-theme-accent`:e.className=`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-theme-text opacity-50 hover:opacity-100`}),$(K.layout),Ee();let n=document.getElementById(`qv-page-indicator`);n&&(n.innerText=`PAGE ${K.page} / ${K.maxPage}`),await Oe(),Ne()}function Te(){Pe(),K.charts.forEach(e=>{if(e)try{e.remove()}catch(e){console.error(`Chart destroy error:`,e)}}),K.charts=[],K.series=[],K.candlesData=[],K.barCounts=[],K.activeAssets=[],K.focusIndex=-1;let e=document.getElementById(`qv-charts-wrapper`);e&&(e.innerHTML=``);let t=document.getElementById(`qv-overlap-legend`);t&&(t._initTimeout&&=(clearTimeout(t._initTimeout),null),t.innerHTML=``,t.classList.add(`hidden`),t.classList.remove(`collapsed`));let n=document.getElementById(`quickview-container`);n&&(n.classList.remove(`qv-modal`),n.classList.add(`hidden`),n.style.display=`none`)}function Ee(){let e=[...s.currentTableData||s.originalTableData||[]];if(e=e.filter(e=>!(e.Binance_Alpha===`O`||e.is_alpha||e.Listed_Exchanges?.includes(`BINANCE_ALPHA`))),K.baseTarget===`FAV`){let t=JSON.parse(localStorage.getItem(`sellnance_favs`)||`[]`).map(String),n=new Set(t);e=e.filter(e=>e.UID&&n.has(String(e.UID)))}else if(K.baseTarget===`FAV2`){let t=JSON.parse(localStorage.getItem(`sellnance_favs2`)||`[]`).map(String),n=new Set(t);e=e.filter(e=>e.UID&&n.has(String(e.UID)))}if(e.length===0){K.activeAssets=[];return}K.sortType===`24h`?e.sort((e,t)=>(t.Change_24h_Raw||0)-(e.Change_24h_Raw||0)):K.sortType===`day`?e.sort((e,t)=>(t.Change_Today_Raw||0)-(e.Change_Today_Raw||0)):K.sortType===`mcap`&&e.sort((e,t)=>(t.MarketCap_Raw||0)-(e.MarketCap_Raw||0)),K.maxPage=Math.max(1,Math.ceil(e.length/8)),K.page>K.maxPage&&(K.page=K.maxPage);let t=(K.page-1)*8;K.activeAssets=e.slice(t,t+8)}function De(t){let n=``,r=``,a=e(t),o=a.hasBithumb||t.Bithumb===`O`||!!t.Bithumb_Symbol;a.hasBinanceFutures?(n=`binance_futures`,r=t.Exact_Futures||i(t.Ticker||t.Symbol),r&&!r.endsWith(`USDT`)&&(r=`${r}USDT`)):a.hasBinanceSpot?(n=`binance_spot`,r=t.Exact_Spot||i(t.Ticker||t.Symbol),r&&!r.endsWith(`USDT`)&&(r=`${r}USDT`)):a.hasUpbit?(n=`upbit`,r=t.Upbit_Symbol||i(t.Symbol||t.Ticker)):o?(n=`bithumb`,r=t.Bithumb_Symbol||i(t.Symbol||t.Ticker)):a.hasBybitFutures?(n=`bybit_futures`,r=t.Exact_Futures||i(t.Ticker||t.Symbol),r&&!r.endsWith(`USDT`)&&(r=`${r}USDT`)):a.hasBybitSpot&&(n=`bybit_spot`,r=t.Exact_Spot||i(t.Ticker||t.Symbol),r&&!r.endsWith(`USDT`)&&(r=`${r}USDT`)),t.resolvedExchange=n,t.resolvedSymbol=r}async function Oe(){let e=document.getElementById(`qv-charts-wrapper`);if(!e)return;K.charts.forEach(e=>{e&&e.remove()}),K.charts=[],K.series=[],K.candlesData=[],K.barCounts=[],e.innerHTML=``,K.layout===`spread`?e.className=`qv-spread-mode w-full h-full relative`:e.className=`qv-overlap-mode w-full h-full relative`;let t=K.activeAssets.map(async(t,n)=>{De(t);let r=document.createElement(`div`);r.className=`qv-chart-card`,r.id=`qv-card-${n}`,r.setAttribute(`data-index`,n),r.addEventListener(`mouseenter`,()=>{K.layout===`overlap`&&je(n)});let i=document.createElement(`div`);i.className=`qv-chart-header`;let a=t.resolvedExchange.replace(`_`,` `).toUpperCase(),o=t.resolvedExchange===`upbit`,s=o?`text-upbit-color`:t.resolvedExchange===`bithumb`?`text-[#f37321]`:`text-[#f0b90b]`,c=o?`style="color: var(--upbit-blue);"`:``;t.resolvedExchange===`upbit`||t.resolvedExchange===`bithumb`?`${Number(t.Price_KRW||0).toLocaleString()}`:`${Number(t.Price_Raw||0).toLocaleString()}`;let l=K.sortType===`day`?t.Change_Today_Raw||0:t.Change_24h_Raw||0,u=`${l>0?`+`:``}${l.toFixed(2)}%`,d=l>0?`text-theme-up`:l<0?`text-theme-down`:``;i.innerHTML=`
      <div class="flex items-center gap-1.5">
        <span class="text-[8px] font-bold uppercase ${s}" ${c}>${a}</span>
        <div class="w-4 h-4 flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-white/5 [&>img]:w-full [&>img]:h-full [&>img]:object-contain">
          ${t.Logo||``}
        </div>
        <span class="text-xs text-theme-text font-bold">${t.Ticker}</span>
      </div>
      <div class="flex items-center gap-2 font-medium">
        <span id="qv-change-${n}" class="text-[10px] font-bold ${d}">${u}</span>
      </div>
    `,r.appendChild(i);let f=document.createElement(`div`);f.className=`qv-chart-canvas-area relative w-full h-full`,f.id=`qv-canvas-${n}`;let p=document.createElement(`div`);return p.id=`qv-loader-${n}`,p.className=`qv-card-loader absolute inset-0 flex items-center justify-center pointer-events-none z-10 transition-opacity duration-200 bg-theme-panel/20 backdrop-blur-[1px] opacity-0`,p.innerHTML=`<div class="neon-tapered-spinner !w-6 !h-6 !border-2"></div>`,f.appendChild(p),p._delayTimer=setTimeout(()=>{document.getElementById(`qv-loader-${n}`)&&(p.classList.remove(`opacity-0`),p.classList.add(`opacity-100`))},200),r.appendChild(f),e.appendChild(r),ke(f,t,n)});await Promise.all(t),Z(70);let n=!1;K.charts.forEach((e,t)=>{e&&e.timeScale().subscribeVisibleLogicalRangeChange(e=>{if(n||!e)return;n=!0;let r=K.barCounts&&K.barCounts[t]||100,i=Math.max(0,r-1),a=e.to-i,o=e.to-e.from;K.charts.forEach((e,n)=>{if(n!==t&&e){let t=K.barCounts&&K.barCounts[n]||100,r=Math.max(0,t-1)+a,i=r-o;try{e.timeScale().setVisibleLogicalRange({from:i,to:r})}catch{}}}),requestAnimationFrame(()=>{n=!1})})}),Y(),Q(),setTimeout(Q,50),setTimeout(Q,250)}async function ke(e,n,i){let o=document.body.classList.contains(`theme-binance`),s=o?`rgba(42, 46, 57, 0.2)`:`rgba(213, 213, 213, 0.2)`,c=o?`#8a8d97`:`#4a4a4a`,l={layout:{background:{color:`transparent`},textColor:c,fontSize:9,fontFamily:`Outfit, sans-serif`,attributionLogo:!1},grid:{vertLines:{color:s,style:2},horzLines:{color:s,style:2}},crosshair:{vertLine:{visible:!0},horzLine:{visible:!1}},rightPriceScale:{borderVisible:!1,textColor:c,visible:!0},timeScale:{borderVisible:!1,textColor:c,visible:!0,timeVisible:!0,secondsVisible:!1,rightOffset:3,tickMarkFormatter:(e,t)=>ee(e,t,K.timeframe)},localization:{locale:navigator.language,timeFormatter:e=>r(e,K.timeframe)},handleScale:{mouseWheel:!0,pinch:!0,axisPressedMouseMove:!0},handleScroll:{mouseWheel:!0,pressedMouseMove:!0}},u=LightweightCharts.createChart(e,l),{up:d,down:f}=a(),p=d||(o?`#26a69a`:`#c84a31`),m=f||(o?`#ef5350`:`#1261c4`),h=q[i],g=K.candleColorMode===`asset`,_=u.addSeries(window.LightweightCharts.CandlestickSeries,{upColor:g?h:p,downColor:g?h:m,wickUpColor:g?h:p,wickDownColor:g?h:m,borderVisible:!1});K.charts[i]=u,K.series[i]=_;try{let e=[];n.resolvedExchange||De(n);let r=n.resolvedExchange,a=n.resolvedSymbol;if(r===`upbit`){let n=t(`upbit`,K.timeframe),r=String(a).trim().toUpperCase(),o=r===`USDT`||r===`KRW-USDT`?`USDT`:r.replace(/^KRW-?/i,``).replace(/KRW$/i,``).replace(/USDT$/i,``).trim(),s=null;try{i>0&&await new Promise(e=>setTimeout(e,i*50));let e=await fetch(`/api/candles?exchange=upbit&symbol=KRW-${o}&interval=${n}&limit=100`);e.ok&&(s=await e.json())}catch{}Array.isArray(s)&&(e=s.map(e=>({time:new Date(e.candle_date_time_utc+`Z`).getTime()/1e3,open:e.opening_price,high:e.high_price,low:e.low_price,close:e.trade_price})).reverse())}else if(r===`bithumb`){let t={"1m":`1m`,"15m":`30m`,"1h":`1h`,"4h":`6h`,"1d":`24h`}[K.timeframe]||`24h`,n=String(a).trim().toUpperCase(),r=`${n===`USDT`||n===`USDT_KRW`?`USDT`:n.replace(/_?KRW$/i,``).replace(/USDT$/i,``).trim()}_KRW`,i=await(await fetch(`https://api.bithumb.com/public/candlestick/${r}/${t}`)).json();i&&i.status===`0000`&&Array.isArray(i.data)&&(e=i.data.slice(-100).map(e=>({time:Number(e[0])/1e3,open:Number(e[1]),close:Number(e[2]),high:Number(e[3]),low:Number(e[4])})))}else if(r===`binance_futures`||r===`binance_spot`){a&&!a.endsWith(`USDT`)&&(a=`${a}USDT`),n.resolvedSymbol=a;let t=await(await fetch(`${r===`binance_futures`?`https://fapi.binance.com/fapi/v1/klines`:`https://api.binance.com/api/v3/klines`}?symbol=${a}&interval=${K.timeframe}&limit=100`)).json();Array.isArray(t)&&t.length>0&&(e=t.map(e=>({time:Number(e[0])/1e3,open:Number(e[1]),high:Number(e[2]),low:Number(e[3]),close:Number(e[4])})))}e.length>0?(K.candlesData[i]=e,K.barCounts[i]=e.length,_.setData(e)):(K.candlesData[i]=[],K.barCounts[i]=0)}catch(e){console.error(`Failed to fetch history for ${n.Ticker}:`,e)}finally{let e=document.getElementById(`qv-loader-${i}`);e&&(e._delayTimer&&=(clearTimeout(e._delayTimer),null),e.classList.remove(`opacity-100`),e.classList.add(`opacity-0`),setTimeout(()=>e.remove(),200))}}function Ae(){let e=K.layout===`overlap`;K.charts.forEach((t,n)=>{if(!t)return;let r=!e||n===K.focusIndex,i=document.body.classList.contains(`theme-binance`)?`#8a8d97`:`#4a4a4a`;t.applyOptions({rightPriceScale:{visible:r,textColor:r?i:`transparent`},timeScale:{visible:r,textColor:r?i:`transparent`}});let a=document.getElementById(`qv-card-${n}`);a&&(e&&n===K.focusIndex?a.classList.add(`qv-focus-active`):a.classList.remove(`qv-focus-active`))})}function je(e){K.focusIndex=e,Ae(),document.querySelectorAll(`.qv-legend-item`).forEach(t=>{parseInt(t.getAttribute(`data-index`))===e?(t.classList.add(`active`),t.style.borderColor=q[e]):(t.classList.remove(`active`),t.style.borderColor=`transparent`)})}function Y(){let e=document.getElementById(`qv-overlap-legend`);if(e){if(K.layout===`spread`){e.classList.add(`hidden`),e.innerHTML=``;return}if(e.classList.remove(`hidden`),e.innerHTML=`
    <div class="qv-legend-header text-[10px] font-bold text-theme-accent border-b border-theme-border/20 flex items-center justify-between uppercase">
    </div>
  `,K.activeAssets.forEach((t,n)=>{let r=document.createElement(`div`);r.className=`qv-legend-item border border-transparent rounded-lg transition-all`,r.setAttribute(`data-index`,n);let i=q[n],a=K.sortType===`day`?t.Change_Today_Raw||0:t.Change_24h_Raw||0,o=`${a>0?`+`:``}${a.toFixed(2)}%`,s=a>0?`text-theme-up`:a<0?`text-theme-down`:``;r.innerHTML=`
      <span class="qv-legend-color-dot" style="background-color: ${i}; box-shadow: 0 0 6px ${i}"></span>
      <span class="text-[10px] text-theme-text font-bold">${t.Ticker}</span>
      <span class="ml-auto font-medium text-[9px] ${s}">${o}</span>
    `,r.addEventListener(`mouseenter`,()=>{je(n)}),e.appendChild(r)}),je(0),!e.dataset.eventsBound){let t=null;e.addEventListener(`mouseenter`,()=>{t&&=(clearTimeout(t),null),e.classList.remove(`collapsed`)}),e.addEventListener(`mouseleave`,()=>{t&&clearTimeout(t),t=setTimeout(()=>{e.classList.add(`collapsed`)},1e3)}),e.dataset.eventsBound=`true`}e.classList.remove(`collapsed`),e._initTimeout&&clearTimeout(e._initTimeout),e._initTimeout=setTimeout(()=>{e.matches(`:hover`)||e.classList.add(`collapsed`)},1e3)}}function Me(e,t,n,r=0){let i=K.series[e],a=K.charts[e];if(!i||!a)return;K.candlesData[e]||(K.candlesData[e]=[]);let s=K.candlesData[e],c=o[K.timeframe]||3600,l=Math.floor(n?n/1e3:Date.now()/1e3),u=Math.floor(l/c)*c;if(s.length>0){let e=s[s.length-1];if(e.time===u||l>=e.time&&l<e.time+c){e.close=t,e.high=Math.max(e.high,t),e.low=Math.min(e.low,t),r>0&&typeof e.volume==`number`&&(e.volume+=r);try{i.update(e)}catch{}return}}let d={time:u,open:t,high:t,low:t,close:t,volume:r||0};s.push(d),K.barCounts[e]=s.length;try{i.update(d)}catch{}}window._getQvUpbitCodes=function(){let e=[];return K.activeAssets.forEach(t=>{if(t.resolvedExchange===`upbit`){let n=String(t.resolvedSymbol||t.Ticker||t.Symbol).trim().toUpperCase(),r=n===`USDT`||n===`KRW-USDT`?`USDT`:n.replace(/^KRW-?/i,``).replace(/KRW$/i,``).replace(/USDT$/i,``).trim();e.push(`KRW-${r}`)}}),e};function Ne(){Pe();let e=K.activeAssets.filter(e=>e.resolvedExchange===`binance_spot`),t=K.activeAssets.filter(e=>e.resolvedExchange===`binance_futures`),n=K.activeAssets.filter(e=>e.resolvedExchange===`upbit`),r=K.activeAssets.filter(e=>e.resolvedExchange===`bithumb`),i=K.timeframe,a=(e,t)=>{let n=JSON.parse(e.data);if(!n.data)return;let r=n.data,i=r.e;if(i!==`kline`&&i!==`aggTrade`)return;let a=r.s.toUpperCase(),o=K.activeAssets.findIndex(e=>{if(!e.resolvedSymbol)return!1;let t=e.resolvedSymbol.toUpperCase();return t===a||`${t}USDT`===a});if(o===-1)return;let s=K.series[o],c=K.charts[o];if(!(!s||!c)){if(i===`kline`){let e=r.k,t={time:Math.floor(e.t/1e3),open:parseFloat(e.o),high:parseFloat(e.h),low:parseFloat(e.l),close:parseFloat(e.c),volume:parseFloat(e.v)};try{K.candlesData[o]||(K.candlesData[o]=[]);let n=K.candlesData[o];n.length>0&&n[n.length-1].time===t.time?n[n.length-1]=t:(n.push(t),K.barCounts[o]=n.length),s.update(t),X(o,t.close,e.P||`0.0`)}catch{}}else if(i===`aggTrade`){let e=parseFloat(r.p),t=parseFloat(r.q)||0;if(isNaN(e))return;Me(o,e,r.E,t);let n=K.activeAssets[o];X(o,e,(K.sortType===`day`?n.Change_Today_Raw||0:n.Change_24h_Raw||0).toString(),!0)}}};if(e.length>0){let t=[];e.forEach(e=>{if(e.resolvedSymbol){let n=e.resolvedSymbol.toLowerCase();t.push(`${n}@kline_${i}`),t.push(`${n}@aggtrade`)}});let n=t.join(`/`);K.binanceWs=new WebSocket(`wss://stream.binance.com:9443/stream?streams=`+n),K.binanceWs.onmessage=e=>a(e,!1)}if(t.length>0){let e=[];t.forEach(t=>{if(t.resolvedSymbol){let n=t.resolvedSymbol.toLowerCase();e.push(`${n}@kline_${i}`),e.push(`${n}@aggtrade`)}});let n=e.join(`/`);K.binanceFuturesWs=new WebSocket(`wss://fstream.binance.com/stream?streams=`+n),K.binanceFuturesWs.onmessage=e=>a(e,!0)}n.length>0?(typeof window.syncUpbitRadarSubscription==`function`&&window.syncUpbitRadarSubscription(),window._qvUpbitHandler=e=>{try{if(!e||!e.code)return;let t=e.code.replace(`KRW-`,``).toUpperCase(),n=K.activeAssets.findIndex(e=>e.resolvedExchange===`upbit`?String(e.resolvedSymbol||e.Ticker||e.Symbol).replace(/^KRW-?/i,``).replace(/KRW$/i,``).replace(/USDT$/i,``).toUpperCase().trim()===t:!1);if(n===-1)return;let r=parseFloat(e.trade_price);if(isNaN(r))return;Me(n,r,e.timestamp),X(n,r,(e.signed_change_rate*100).toString(),!0)}catch{}}):window._qvUpbitHandler=null,r.length>0?window._qvBithumbHandler=e=>{try{if(!e||!e.symbol)return;let t=e.symbol.replace(`_KRW`,``).toUpperCase(),n=parseFloat(e.contPrice);if(isNaN(n))return;let r=K.activeAssets.findIndex(e=>e.resolvedExchange===`bithumb`?String(e.resolvedSymbol||e.Ticker||e.Symbol).replace(/_?KRW$/i,``).replace(/USDT$/i,``).toUpperCase().trim()===t:!1);if(r===-1)return;Me(r,n,Date.now());let i=K.activeAssets[r];X(r,n,(K.sortType===`day`?i.Change_Today_Raw||0:i.Change_24h_Raw||0).toString(),!0)}catch(e){console.error(`퀵뷰 빗썸 이벤트 처리 에러:`,e)}}:window._qvBithumbHandler=null}function Pe(){if(K.binanceWs){K.binanceWs.onmessage=null,K.binanceWs.onerror=null,K.binanceWs.onclose=null;try{K.binanceWs.close(1e3,`Normal Closure`)}catch{}K.binanceWs=null}if(K.binanceFuturesWs){K.binanceFuturesWs.onmessage=null,K.binanceFuturesWs.onerror=null,K.binanceFuturesWs.onclose=null;try{K.binanceFuturesWs.close(1e3,`Normal Closure`)}catch{}K.binanceFuturesWs=null}if(window._qvUpbitHandler=null,K.upbitWs){K.upbitWs.onmessage=null,K.upbitWs.onerror=null,K.upbitWs.onclose=null;try{K.upbitWs.close(1e3,`Normal Closure`)}catch{}K.upbitWs=null}if(window._qvBithumbHandler=null,K.bithumbWs){K.bithumbWs.onmessage=null,K.bithumbWs.onerror=null,K.bithumbWs.onclose=null;try{K.bithumbWs.close(1e3,`Normal Closure`)}catch{}K.bithumbWs=null}}function X(e,t,n,r=!1){let i=K.activeAssets[e];if(!i)return;let a=document.getElementById(`qv-price-${e}`),o=document.getElementById(`qv-change-${e}`);i.resolvedExchange===`upbit`||i.resolvedExchange===`bithumb`?(i.Price_KRW=t,a&&(a.innerText=`${t.toLocaleString()} ₩`)):(i.Price_Raw=t,a&&(a.innerText=`$ ${t.toLocaleString()}`));let s=parseFloat(n);if(o&&(o.innerText=`${s>0?`+`:``}${s.toFixed(2)}%`,o.className=`text-[10px] font-bold ${s>0?`text-theme-up`:s<0?`text-theme-down`:``}`),r&&a){let e=document.body.classList.contains(`theme-binance`);a.style.transition=`color 0.1s ease`,a.style.color=e?`#ffffff`:`#000000`,a._flashTimeout&&clearTimeout(a._flashTimeout),a._flashTimeout=setTimeout(()=>{a.style.color=``},200)}let c=document.querySelector(`.qv-legend-item[data-index="${e}"]`);if(c){let e=c.querySelector(`span:last-child`);e&&(e.innerText=`${s>0?`+`:``}${s.toFixed(2)}%`,e.className=`ml-auto font-medium text-[9px] ${s>0?`text-theme-up`:s<0?`text-theme-down`:``}`)}}function Fe(e){if(K.layout===e)return;K.layout=e,$(e);let t=document.getElementById(`qv-charts-wrapper`);if(!t)return;let n=Array.from(t.querySelectorAll(`.qv-chart-card`));if(!n.length){t.className=K.layout===`spread`?`qv-spread-mode w-full h-full relative`:`qv-overlap-mode w-full h-full relative`,Y(),Ae();return}Ae();let r=t.getBoundingClientRect();if(K.layout===`overlap`){let e=n.map(e=>e.getBoundingClientRect());t.className=`qv-overlap-mode w-full h-full relative`,Y(),n.forEach((t,n)=>{let i=e[n],a=i.left-r.left+i.width/2,o=i.top-r.top+i.height/2,s=r.width/2,c=r.height/2,l=a-s,u=o-c,d=i.width/r.width,f=i.height/r.height;t.style.transition=`none`,t.style.transform=`translate(${l}px, ${u}px) scale(${d}, ${f})`,t.style.transformOrigin=`center`,t.style.opacity=`1`,t.style.zIndex=`5`,requestAnimationFrame(()=>{requestAnimationFrame(()=>{t.style.transition=`transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease`,t.style.transform=`translate(0, 0) scale(1)`,t.style.opacity=`0.4`})})}),setTimeout(()=>{n.forEach(e=>{e.style.cssText=``}),requestAnimationFrame(()=>{Q()})},380)}else{t.className=`qv-spread-mode w-full h-full relative`,Y();let e=n.map(e=>e.getBoundingClientRect());n.forEach((t,n)=>{let i=e[n],a=i.left-r.left+i.width/2,o=i.top-r.top+i.height/2,s=r.width/2,c=r.height/2,l=s-a,u=c-o,d=r.width/i.width,f=r.height/i.height;t.style.transition=`none`,t.style.transform=`translate(${l}px, ${u}px) scale(${d}, ${f})`,t.style.transformOrigin=`center`,t.style.opacity=`0.4`,t.style.zIndex=`10`,requestAnimationFrame(()=>{requestAnimationFrame(()=>{t.style.transition=`transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease`,t.style.transform=`translate(0, 0) scale(1)`,t.style.opacity=`1`})})}),setTimeout(()=>{n.forEach(e=>{e.style.cssText=``}),requestAnimationFrame(()=>{Q()})},380)}}function Ie(e){K.sortType!==e&&(K.sortType=e,K.page=1,document.querySelectorAll(`.qv-sort-btn`).forEach(t=>{t.id===`qv-sort-${e}`?t.className=`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-white bg-theme-accent`:t.className=`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all qv-sort-btn text-theme-text opacity-50 hover:opacity-100`}),J())}function Le(e){K.timeframe!==e&&(K.timeframe=e,document.querySelectorAll(`.qv-tf-btn`).forEach(t=>{t.id===`qv-tf-${e}`?t.className=`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-white bg-theme-accent`:t.className=`px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all qv-tf-btn text-theme-text opacity-50 hover:opacity-100`}),J())}function Re(e){K.maxPage||=1;let t=K.page+e;if(t<1&&(t=1),t>K.maxPage&&(t=K.maxPage),t===K.page)return;K.page=t;let n=document.getElementById(`qv-page-indicator`);n&&(n.innerText=`PAGE ${t} / ${K.maxPage}`),J()}function ze(e){Ie(e);let t=document.getElementById(`quickview-init-overlay`);t&&(t.classList.add(`hidden`),t.style.display=`none`)}function Z(e=70){K.charts.forEach((t,n)=>{if(!t)return;let r=K.barCounts&&K.barCounts[n]||100,i=Math.max(0,r-1)+3,a=i-e;try{t.timeScale().setVisibleLogicalRange({from:a,to:i})}catch{}})}function Q(){K.charts.forEach((e,t)=>{if(!e)return;let n=document.getElementById(`qv-canvas-${t}`);if(n){let t=n.clientWidth,r=n.clientHeight;t>0&&r>0?e.resize(t,r):requestAnimationFrame(()=>{let t=n.clientWidth,r=n.clientHeight;t>0&&r>0&&e.resize(t,r)})}}),Z(70)}window.addEventListener(`resize`,()=>{let e=document.getElementById(`quickview-container`);e&&!e.classList.contains(`hidden`)&&Q()});function Be(){K.sortType=``,K.page=1,Te();let e=document.getElementById(`quickview-container`);e&&(e.classList.remove(`hidden`),e.classList.add(`qv-modal`),e.style.display=`flex`);let t=document.getElementById(`quickview-init-overlay`);t&&(t.classList.remove(`hidden`),t.style.display=`flex`)}function Ve(){let e=typeof window<`u`&&window.store&&window.store.previousChartTab||`chart`;typeof window.switchChartTab==`function`&&window.switchChartTab(e)}function He(){K.candleColorMode=K.candleColorMode===`asset`?`default`:`asset`;let e=document.getElementById(`qv-color-toggle-btn`);e&&(K.candleColorMode===`asset`?e.className=`px-3 py-1.5 text-[10px] font-bold rounded-lg border border-theme-accent text-white bg-theme-accent transition-all flex items-center gap-1.5 cursor-pointer`:e.className=`px-3 py-1.5 text-[10px] font-bold rounded-lg border border-theme-border/50 hover:border-theme-accent text-theme-text hover:text-theme-accent bg-transparent transition-all flex items-center gap-1.5 cursor-pointer`),Ge()}function Ue(e){if(K.baseTarget===e)return;K.baseTarget=e;let t=document.getElementById(`qv-base-all`),n=document.getElementById(`qv-base-fav`),r=document.getElementById(`qv-base-fav2`);if(t&&n){[t,n,r].forEach(e=>{e&&(e.className=`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all text-theme-text opacity-50 hover:opacity-100 cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0`)});let i=e===`ALL`?t:e===`FAV`?n:r;i&&(i.className=`px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all text-white bg-theme-accent cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0`)}}function We(){Z(70)}window.initQuickView=J,window.destroyQuickView=Te,window.setQuickViewBase=Ue,window.alignQuickViewChartsToEnd=Z,window.resetQuickViewChartsScale=We,window.setQuickViewLayout=Fe,window.changeQuickViewSort=Ie,window.changeQuickViewTF=Le,window.changeQuickViewPage=Re,window.selectQuickViewInitSort=ze,window.triggerResizeQuickView=Q,window.resetQuickView=Be,window.closeQuickViewModal=Ve,window.toggleQuickViewCandleColor=He;function $(e){let t=document.getElementById(`qv-layout-spread`),n=document.getElementById(`qv-layout-overlap`),r=document.getElementById(`qv-layout-slider`);if(t&&n&&r)if(e===`spread`)t.className=`relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-white cursor-pointer`,n.className=`relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-theme-text opacity-60 hover:opacity-100 cursor-pointer`,r.style.transform=`translateX(0px)`;else{t.className=`relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-theme-text opacity-60 hover:opacity-100 cursor-pointer`,n.className=`relative z-10 px-4 py-2 text-xs font-bold rounded-md transition-all text-white cursor-pointer`;let e=n.offsetLeft-t.offsetLeft;r.style.transform=`translateX(${e}px)`}}window.updateLayoutToggleUI=$;function Ge(){let e=document.body.classList.contains(`theme-binance`),t=e?`rgba(42, 46, 57, 0.2)`:`rgba(213, 213, 213, 0.2)`,n=e?`#8a8d97`:`#4a4a4a`,{up:r,down:i}=a(),o=r||(e?`#26a69a`:`#c84a31`),s=i||(e?`#ef5350`:`#1261c4`);$(K.layout),K.charts.forEach((e,r)=>{if(!e)return;let i=K.layout!==`overlap`||r===K.focusIndex;e.applyOptions({layout:{textColor:i?n:`transparent`},grid:{vertLines:{color:t},horzLines:{color:t}},rightPriceScale:{textColor:i?n:`transparent`},timeScale:{textColor:i?n:`transparent`}});let a=K.series[r];if(a)if(K.candleColorMode===`asset`){let e=q[r];a.applyOptions({upColor:e,downColor:e,wickUpColor:e,wickDownColor:e})}else a.applyOptions({upColor:o,downColor:s,wickUpColor:o,wickDownColor:s})})}window.updateQuickViewTheme=Ge;function Ke(){if(!K.charts||K.charts.length===0)return;let e=(e,t)=>ee(e,t,K.timeframe),t=e=>r(e,K.timeframe);K.charts.forEach(n=>{n&&n.applyOptions({timeScale:{tickMarkFormatter:e},localization:{timeFormatter:t}})})}window.updateQuickViewTimezone=Ke,window.initQuickView=J,window.destroyQuickView=Te;export{oe as a,ue as i,ce as n,b as o,le as r,ie as t};