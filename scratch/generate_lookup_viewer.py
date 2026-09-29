import os
import re
import json
from pathlib import Path

ROOT_DIR = Path(r"c:\Users\kmj\Sellnance")
OUTPUT_HTML = ROOT_DIR / "scratch" / "lookup_viewer.html"

# 검색 대상 확장자
ALLOWED_EXTS = {".py", ".js", ".go", ".html", ".css"}

# 제외할 폴더
IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".gemini",
    "dist",
    "build",
    "scratch",
    ".idea",
    ".vscode",
}

REGEX_STR = r'(?:기생|방어|원천|극대|극단|폭탄|하드코딩|무한|범인|한계|조기\s*탈출|짭|INP|입구|혁신|강제|고차원|절대|완전|소독|HTS|핵심|광속|잔상|무료|탈출|공짜|최종|운영|노이즈|수문|빨대|글로벌|초고속|주입|가드|가로채기|즉각|폭주|콩나물\s*대가리|덜그럭|보장|컷|쌀먹|녀석|달성|대망|쓰레기|\d+(?:\.\d+)?\s*(?:초|ms|ns|us|µs))'
PATTERN = re.compile(REGEX_STR)

def scan_files():
    results = []
    idx = 0
    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            p = Path(root) / f
            if p.suffix.lower() not in ALLOWED_EXTS:
                continue
            
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as fp:
                    lines = [line.rstrip("\r\n") for line in fp]
            except Exception:
                continue

            rel_path = str(p.relative_to(ROOT_DIR)).replace("\\", "/")
            full_path = str(p.resolve()).replace("\\", "/")

            for line_idx, line in enumerate(lines):
                matches = PATTERN.findall(line)
                if not matches:
                    continue

                # 5줄 문맥 (위 2줄, 해당 줄, 아래 2줄)
                start_i = max(0, line_idx - 2)
                end_i = min(len(lines), line_idx + 3)

                context_lines = []
                for cur_i in range(start_i, end_i):
                    context_lines.append({
                        "line_num": cur_i + 1,
                        "text": lines[cur_i],
                        "is_target": (cur_i == line_idx)
                    })

                unique_matches = list(dict.fromkeys(matches))

                idx += 1
                results.append({
                    "id": idx,
                    "file": rel_path,
                    "full_path": full_path,
                    "line_num": line_idx + 1,
                    "keywords": unique_matches,
                    "target_text": line,
                    "context": context_lines
                })
    return results

def build_html(data):
    json_data = json.dumps(data, ensure_ascii=False)
    
    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>문맥 5줄 룩업 뷰어 (Context Lookup Viewer)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {{
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }}
    .code-font {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }}
    .highlight-word {{
      background-color: rgba(234, 179, 8, 0.25);
      color: #facc15;
      font-weight: 600;
      padding: 1px 4px;
      border-radius: 3px;
      border-bottom: 1.5px solid #eab308;
    }}
    .target-line {{
      background-color: rgba(56, 189, 248, 0.1);
      border-left: 3px solid #38bdf8;
    }}
    .dimmed-line {{
      color: #6e7681;
    }}
    .reviewed {{
      opacity: 0.35;
      filter: grayscale(80%);
    }}
  </style>
</head>
<body class="min-h-screen flex flex-col">
  <!-- 상단 컨트롤 헤더 -->
  <header class="sticky top-0 z-50 bg-[#161b22]/95 backdrop-blur border-b border-[#30363d] px-6 py-4 shadow-lg">
    <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="text-xl font-bold text-white flex items-center gap-2">
          🔍 문맥 5줄 룩업 뷰어
        </span>
        <span id="total-count-badge" class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-900/60 text-blue-300 border border-blue-700">
          검색 중...
        </span>
        <span id="reviewed-count-badge" class="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700">
          완료: 0
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-3 flex-1 max-w-2xl justify-end">
        <!-- 실시간 검색어 필터 -->
        <div class="relative flex-1 min-w-[180px]">
          <input 
            type="text" 
            id="search-input" 
            placeholder="파일/단어/문장 실시간 검색..." 
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- 키워드 필터 셀렉트 -->
        <select id="keyword-filter" class="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="">전체 키워드</option>
        </select>

        <!-- 파일 확장자 필터 -->
        <select id="ext-filter" class="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="">전체 파일</option>
          <option value=".py">Python (.py)</option>
          <option value=".js">JavaScript (.js)</option>
          <option value=".go">Go (.go)</option>
        </select>

        <!-- 필터: 검토 완료 숨기기 토글 -->
        <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input type="checkbox" id="hide-reviewed" class="rounded bg-[#0d1117] border-[#30363d] text-blue-600 focus:ring-0">
          완료된 항목 숨김
        </label>
      </div>
    </div>
  </header>

  <!-- 메인 뷰어 목록 -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-6">
    <div id="cards-container" class="space-y-4"></div>
    <div id="no-result" class="hidden text-center py-20 text-gray-500">일치하는 결과가 없습니다.</div>
  </main>

  <script>
    const RAW_DATA = {json_data};
    let reviewedSet = new Set(JSON.parse(localStorage.getItem("sellnance_reviewed_items") || "[]"));

    const container = document.getElementById("cards-container");
    const searchInput = document.getElementById("search-input");
    const keywordFilter = document.getElementById("keyword-filter");
    const extFilter = document.getElementById("ext-filter");
    const hideReviewedCheck = document.getElementById("hide-reviewed");
    const totalBadge = document.getElementById("total-count-badge");
    const reviewedBadge = document.getElementById("reviewed-count-badge");
    const noResult = document.getElementById("no-result");

    // 키워드 셀렉트 옵션 빌드
    const allKeywords = new Set();
    RAW_DATA.forEach(d => d.keywords.forEach(k => allKeywords.add(k)));
    Array.from(allKeywords).sort().forEach(k => {{
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      keywordFilter.appendChild(opt);
    }});

    function escapeHtml(str) {{
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }}

    function highlightKeywords(text, keywords) {{
      let escaped = escapeHtml(text);
      keywords.forEach(kw => {{
        const safeKw = kw.replace(/[.*+?^${{}}()|[\\]\\\\]/g, "\\\\$&");
        const re = new RegExp(`(${{safeKw}})`, "gi");
        escaped = escaped.replace(re, '<span class="highlight-word">$1</span>');
      }});
      return escaped;
    }}

    function toggleReview(id) {{
      if (reviewedSet.has(id)) {{
        reviewedSet.delete(id);
      }} else {{
        reviewedSet.add(id);
      }}
      localStorage.setItem("sellnance_reviewed_items", JSON.stringify(Array.from(reviewedSet)));
      render();
    }}

    function render() {{
      const q = searchInput.value.trim().toLowerCase();
      const kw = keywordFilter.value;
      const ext = extFilter.value;
      const hideRev = hideReviewedCheck.checked;

      const filtered = RAW_DATA.filter(item => {{
        if (hideRev && reviewedSet.has(item.id)) return false;
        if (kw && !item.keywords.includes(kw)) return false;
        if (ext && !item.file.endsWith(ext)) return false;
        if (q) {{
          const matchFile = item.file.toLowerCase().includes(q);
          const matchTarget = item.target_text.toLowerCase().includes(q);
          const matchKw = item.keywords.some(k => k.toLowerCase().includes(q));
          if (!matchFile && !matchTarget && !matchKw) return false;
        }}
        return true;
      }});

      totalBadge.textContent = `노출: ${{filtered.length}} / 전체 ${{RAW_DATA.length}}건`;
      reviewedBadge.textContent = `완료: ${{reviewedSet.size}}건`;

      if (filtered.length === 0) {{
        container.innerHTML = "";
        noResult.classList.remove("hidden");
        return;
      }}
      noResult.classList.add("hidden");

      let html = "";
      filtered.forEach(item => {{
        const isRev = reviewedSet.has(item.id);
        const revClass = isRev ? "reviewed" : "";
        const checkIcon = isRev ? "✅ 완료됨" : "⬜ 검토 체크";

        // 5줄 코드 스니펫 HTML 생성
        let snippetHtml = "";
        item.context.forEach(c => {{
          const lineCls = c.is_target ? "target-line py-0.5 text-white" : "dimmed-line py-0.5";
          const lineText = c.is_target 
            ? highlightKeywords(c.text, item.keywords) 
            : escapeHtml(c.text);

          snippetHtml += `
            <div class="flex items-start text-xs code-font ${{lineCls}}">
              <span class="w-12 text-right pr-3 select-none text-gray-600 font-mono flex-shrink-0">${{c.line_num}}</span>
              <pre class="flex-1 whitespace-pre-wrap break-all font-mono leading-relaxed">${{lineText}}</pre>
            </div>
          `;
        }});

        const kwBadges = item.keywords.map(k => `
          <span class="inline-block px-2 py-0.5 text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/80 rounded">
            ${{k}}
          </span>
        `).join(" ");

        html += `
          <div class="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow transition hover:border-[#58a6ff]/50 ${{revClass}}" id="card-${{item.id}}">
            <!-- 카드 헤더 -->
            <div class="bg-[#21262d] px-4 py-2.5 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-bold text-gray-400">#${{item.id}}</span>
                <a 
                  href="vscode://file/${{item.full_path}}:${{item.line_num}}" 
                  class="font-mono text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-medium"
                  title="VS Code에서 해당 줄 열기"
                >
                  📄 ${{item.file}} : <span class="text-amber-400 font-bold">${{item.line_num}}줄</span>
                </a>
                <div class="flex items-center gap-1 ml-2">
                  ${{kwBadges}}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button 
                  onclick="navigator.clipboard.writeText('${{item.file}}:${{item.line_num}}')" 
                  class="px-2.5 py-1 text-xs bg-[#30363d] hover:bg-[#3c444d] text-gray-200 rounded transition"
                  title="경로:줄번호 복사"
                >
                  📋 경로 복사
                </button>
                <button 
                  onclick="toggleReview(${{item.id}})" 
                  class="px-3 py-1 text-xs font-semibold rounded transition ${{isRev ? 'bg-emerald-800/80 text-emerald-200 hover:bg-emerald-700' : 'bg-[#30363d] text-gray-300 hover:bg-[#3c444d]'}}"
                >
                  ${{checkIcon}}
                </button>
              </div>
            </div>

            <!-- 문맥 5줄 뷰어 바디 -->
            <div class="p-3 bg-[#0d1117] overflow-x-auto">
              ${{snippetHtml}}
            </div>
          </div>
        `;
      }});

      container.innerHTML = html;
    }}

    searchInput.addEventListener("input", render);
    keywordFilter.addEventListener("change", render);
    extFilter.addEventListener("change", render);
    hideReviewedCheck.addEventListener("change", render);

    render();
  </script>
</body>
</html>
"""
    return html

def main():
    print("🔍 프로젝트 내 대상 단어 및 5줄 문맥 수집 중...")
    data = scan_files()
    print(f"✅ 총 {len(data)}건의 대상 위치 발견!")
    
    html_content = build_html(data)
    OUTPUT_HTML.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"🎉 룩업 뷰어 생성 완료: {OUTPUT_HTML}")

if __name__ == "__main__":
    main()
