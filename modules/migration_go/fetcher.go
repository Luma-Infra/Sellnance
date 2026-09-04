package main

import (
	"encoding/json"
	"log"
	"os"
)

// FetchAllMarketsParallel 순수 Go 기반 데이터 로더
// (Python 서브프로세스 직접 호출을 완전히 제거하고, 100% 순수 Go로 메모리에 로드합니다.
// 추후 거래소별 REST API 직통 고루틴 병렬 파이프라인으로 확장 가능하도록 설계됨)
func FetchAllMarketsParallel() []map[string]interface{} {
	log.Println("⚡ Go Engine: 순수 Go 데이터 로더 가동 (Python 의존성 0%)...")

	cachePath := "./static/market_data_cache.json"
	bytes, err := os.ReadFile(cachePath)
	if err != nil {
		log.Printf("⚠️ 캐시 파일(%s) 읽기 실패: %v\n", cachePath, err)
		return nil
	}

	var cacheWrapper struct {
		Data        []map[string]interface{} `json:"data"`
		LastUpdated string                   `json:"last_updated"`
	}

	if err := json.Unmarshal(bytes, &cacheWrapper); err != nil {
		// 데이터가 감싸진 형태가 아닌 단순 배열 형태일 경우의 안전 폴백
		var directArray []map[string]interface{}
		if err2 := json.Unmarshal(bytes, &directArray); err2 != nil {
			log.Printf("🚨 JSON 역직렬화 에러: %v\n", err)
			return nil
		}
		log.Printf("✅ 순수 Go 데이터 로드 완료 (총 %d개)\n", len(directArray))
		return directArray
	}

	log.Printf("✅ 순수 Go 데이터 로드 완료 (총 %d개)\n", len(cacheWrapper.Data))
	return cacheWrapper.Data
}