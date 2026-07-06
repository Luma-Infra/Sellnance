with open(r"c:\Users\78831\Sellnance\templates\index.html", "r", encoding="utf-8") as f:
    content = f.read()

start_str = "    <!-- 🚀 성능 디버그 도구 UI (우측 하단 플로팅 패널) -->"
start_idx = content.find(start_str)

if start_idx == -1:
    print("Start string not found!")
    exit(1)

# Let's search for the end of the perf-debug-panel div
# It should end with:
#           </div>
#         </div>
#       </div>
#     </div>
# And the next lines should be:
#   </div>
# </body>

# Let's find:
#           </div>
#         </div>
#       </div>
#     </div>
# after start_idx
offset = start_idx
while True:
    end_candidate = content.find("        </div>\n      </div>\n    </div>", offset)
    if end_candidate == -1:
        print("End pattern not found!")
        exit(1)
    
    # Check if the next non-whitespace characters contain "</body>" or "</html>" to ensure it's the correct closing tag of the panel
    sub = content[end_candidate:end_candidate+200]
    if "</body>" in sub:
        end_idx = end_candidate + len("        </div>\n      </div>\n    </div>")
        break
    else:
        offset = end_candidate + 1

# Extract the block to comment out
block = content[start_idx:end_idx]

# Clean up nested HTML comments in the block so we don't break HTML parsing
cleaned_block = block
comments_to_clean = [
    ("<!-- 🚀 성능 디버그 도구 UI (우측 하단 플로팅 패널) -->", "[🚀 성능 디버그 도구 UI (우측 하단 플로팅 패널)]"),
    ("<!-- 1. [부모] 우측 패널 DOM 차단 -->", "[1. [부모] 우측 패널 DOM 차단]"),
    ("<!-- [자식] 우측 종속 요소들 -->", "[자식 우측 종속 요소들]"),
    ("<!-- 2. [부모] 좌측 테이블 DOM 차단 -->", "[2. [부모] 좌측 테이블 DOM 차단]"),
    ("<!-- [자식] 좌측 종속 요소들 -->", "[자식 좌측 종속 요소들]"),
    ("<!-- 3. [부모] 실시간 김프 연산 차단 -->", "[3. [부모] 실시간 김프 연산 차단]"),
    ("<!-- [자식] 김프 종속 요소들 -->", "[자식 김프 종속 요소들]"),
    ("<!-- 4. aggTrade 실시간 주기 조절 -->", "[4. aggTrade 실시간 주기 조절]"),
]

for src, dest in comments_to_clean:
    cleaned_block = cleaned_block.replace(src, dest)

# Wrap the entire cleaned block in HTML comments
commented_block = "    <!-- [성능 디버그 도구 UI 전체 주석 처리]\n" + cleaned_block + "\n    -->"

# Replace the original block with the commented-out block
new_content = content[:start_idx] + commented_block + content[end_idx:]

with open(r"c:\Users\78831\Sellnance\templates\index.html", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Successfully commented out the performance debug panel!")
