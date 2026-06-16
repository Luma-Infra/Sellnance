import json
import os
import re

log_path = r"C:\Users\kmj\.gemini\antigravity-ide\brain\424cfff8-f436-46e8-86a7-e404cfa546ee\.system_generated\logs\transcript.jsonl"
target_file = r"c:\Users\kmj\Sellnance\static\table_render.js"

print("Log path exists:", os.path.exists(log_path))

# Read the log lines
lines = []
with open(log_path, "r", encoding="utf-8") as f:
    for line in f:
        lines.append(json.loads(line))

print("Total log entries:", len(lines))

# We need to find the tool output for step 41 (which read table_render.js)
# Let's search for "table_render.js" in the tool outputs
extracted_content = None
for entry in lines:
    # Look for the step containing the large view_file output
    content = entry.get("content", "")
    if "File Path: `file:///c:/Users/kmj/Sellnance/static/table_render.js`" in content and "Showing lines 426 to 1225" in content:
        print("Found the tool output log entry!")
        extracted_content = content
        break

if not extracted_content:
    print("Could not find the target log entry. Let's list some candidates.")
    # Search in all entries for table_render.js
    for i, entry in enumerate(lines):
        content = entry.get("content", "")
        if "table_render.js" in content:
            print(f"Index {i}: type={entry.get('type')}, status={entry.get('status')}, length={len(content)}")
    sys.exit(1)

# Now, we need to extract the lines showing 426 to 1225.
# The format in content is: "<line_number>: <original_line>"
# Let's parse them!
lines_dict = {}
pattern = re.compile(r"^(\d+):\s?(.*)$")

for line in extracted_content.splitlines():
    m = pattern.match(line)
    if m:
        line_num = int(m.group(1))
        line_content = m.group(2)
        lines_dict[line_num] = line_content

print("Parsed lines count:", len(lines_dict))
print("Min line parsed:", min(lines_dict.keys()))
print("Max line parsed:", max(lines_dict.keys()))

# Let's read the current table_render.js (which was reverted to committed HEAD state)
with open(target_file, "r", encoding="utf-8") as f:
    current_lines = f.read().splitlines()

print("Current table_render.js lines:", len(current_lines))

# Construct the recovered file.
# Since lines 1-425 and 1226-1231 were not modified, they should match the uncommitted version.
# Let's double check if we can reconstruct:
new_lines = []
# 1-indexed lines:
# Lines 1 to 425 from current file:
for idx in range(1, 426):
    new_lines.append(current_lines[idx - 1])

# Lines 426 to 1225 from log (lines_dict):
for idx in range(426, 1226):
    new_lines.append(lines_dict[idx])

# Lines 1226 to the end from current file (or from lines_dict if present, wait, in step 41 it went up to 1225)
# Let's see how many lines current_lines has. If it has fewer or more, we should be careful.
# Actually, the original file had 1231 lines. Let's write the remaining lines from current_lines:
for idx in range(1226, len(current_lines) + 1):
    new_lines.append(current_lines[idx - 1])

recovered_code = "\n".join(new_lines) + "\n"

# Write it to a temporary recovery file first so we can check it
recovery_temp = r"c:\Users\kmj\Sellnance\static\table_render_recovered.js"
with open(recovery_temp, "w", encoding="utf-8") as f:
    f.write(recovered_code)

print("Recovered file written to:", recovery_temp)
