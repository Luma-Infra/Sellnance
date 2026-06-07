const fs = require('fs');
let code = fs.readFileSync('static/_main.js', 'utf8');

// Fix 1: duplicate headChg
code = code.replace(/const headChg24h = document\.getElementById\(\"head-chg-24h\"\);\s*const headChgDay = document\.getElementById\(\"head-chg-day\"\);\s*const headChg24h = document\.getElementById\(\"head-chg-24h\"\);\s*const headChgDay = document\.getElementById\(\"head-chg-day\"\);/g, 'const headChg24h = document.getElementById(\"head-chg-24h\");\\n  const headChgDay = document.getElementById(\"head-chg-day\");');

// Fix 2: duplicate setupButtonEvents
code = code.replace(/\/\/ ?? 버튼 호버 로직\s*function setupButtonEvents\(\) \{\s*const genBtn = document\.getElementById\(\"btn-generate\"\);\s*\}\);\s*\}\s*\/\/ ?? 버튼 호버 로직\s*function setupButtonEvents\(\) \{\s*const genBtn = document\.getElementById\(\"btn-generate\"\);\s*if \(genBtn\) \{\s*if \(store\.previewSeries\) store\.previewSeries\.setData\(\[\]\);\s*\};\s*\}/g, 
\// ?? 버튼 호버 로직
function setupButtonEvents() {
  const genBtn = document.getElementById(\"btn-generate\");
  if (genBtn) {
    if (store.previewSeries) store.previewSeries.setData([]);
  }
}\);

// Fix 3: flipToggle duplicates
code = code.replace(/\/\/ ?? flip-toggle \(경주마 애니메이션\) UI 바인딩\s*const flipToggle = document\.getElementById\(\"flip-toggle\"\);\s*if \(flipToggle\) \{\s*\};\s*\}\s*\/\/ ?? flip-toggle \(경주마 애니메이션\) UI 바인딩\s*const flipToggle = document\.getElementById\(\"flip-toggle\"\);\s*if \(flipToggle\) \{\s*store\.useFlip = flipToggle\.checked;/g,
\// ?? flip-toggle (경주마 애니메이션) UI 바인딩
const flipToggle = document.getElementById(\"flip-toggle\");
if (flipToggle) {
  store.useFlip = flipToggle.checked;\);

// Fix 4: setupSearchNavigation duplicates
code = code.replace(/\/\/ ?? 검색창 내 방향키 위\/아래 이동 및 엔터 선택 로직\s*function setupSearchNavigation\(\) \{\s*const symbolInput = document\.getElementById\(\"symbol-input\"\);\s*\}\s*\}\s*\/\/ ?? 검색창 내 방향키 위\/아래 이동 및 엔터 선택 로직\s*function setupSearchNavigation\(\) \{\s*const symbolInput = document\.getElementById\(\"symbol-input\"\);/g,
\// ?? 검색창 내 방향키 위/아래 이동 및 엔터 선택 로직
function setupSearchNavigation() {
  const symbolInput = document.getElementById(\"symbol-input\");\);

// Fix 5: document.addEventListener("visibilitychange" duplicates
code = code.replace(/\/\/ ?? 탭 활성화 감지 \(Sleep -> Wake Up 스턴 방어\)\s*let tabHiddenTime = 0;\s*document\.addEventListener\(\"visibilitychange\", \(\) => \{\s*\}\s*\}\);\s*\/\/ ?? 탭 활성화 감지 \(Sleep -> Wake Up 스턴 방어\)\s*let tabHiddenTime = 0;\s*document\.addEventListener\(\"visibilitychange\", \(\) => \{/g,
\// ?? 탭 활성화 감지 (Sleep -> Wake Up 스턴 방어)
let tabHiddenTime = 0;
document.addEventListener("visibilitychange", () => {\);

fs.writeFileSync('static/_main.js', code, 'utf8');
console.log('Fixed some duplicates');
