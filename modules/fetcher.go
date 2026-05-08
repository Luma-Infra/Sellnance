package main

import (
	"encoding/json"
	"log"
	"os/exec"
	"strings"
)

// FetchAllMarketsParallel 파이썬의 API_MANAGER를 직접 호출하여
// 100% 완벽한 족보 및 포맷팅 데이터를 Go 메모리로 가져옵니다.
func FetchAllMarketsParallel() []map[string]interface{} {
	log.Println("⚡ Go Engine: 파이썬 코어 로직을 호출하여 데이터를 생성합니다...")

	// 1. 파이썬 스크립트 실행 (단발성 스크립트를 만들어 호출하거나, 기존 구조 활용)
	// 예: get_market.py 등에서 json.dumps()로 출력하게 한 후 그걸 받아옵니다.
	// 🚨 명령어는 서버 환경에 맞게 python 또는 python3로 수정하세요.
	pythonScript := `
import sys, os, json
# 기존 stdout 백업 및 쓰레기 로그 차단
old_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')

from modules import api_manager
data, _ = api_manager.get_cached_data(force_reload=True)

# stdout 복구 후 경계선과 함께 출력
sys.stdout = old_stdout
print("---JSON_START---")
print(json.dumps(data))
print("---JSON_END---")
`
	cmd := exec.Command("python", "-c", pythonScript)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("🚨 파이썬 데이터 엔진 호출 실패: %v\n출력: %s", err, string(output))
		return nil
	}

	outStr := string(output)
	startIdx := strings.Index(outStr, "---JSON_START---")
	endIdx := strings.Index(outStr, "---JSON_END---")

	if startIdx == -1 || endIdx == -1 {
		log.Printf("🚨 파이썬 출력에서 JSON 경계선을 찾을 수 없습니다.\n출력: %s", outStr)
		return nil
	}

	// 2. 안전하게 격리된 JSON 스트링만 파싱
	jsonStr := strings.TrimSpace(outStr[startIdx+len("---JSON_START---") : endIdx])

	var parsedData []map[string]interface{}
	err = json.Unmarshal([]byte(jsonStr), &parsedData)
	if err != nil {
		log.Printf("🚨 JSON 역직렬화 에러: %v\n", err)
		return nil
	}

	return parsedData
}