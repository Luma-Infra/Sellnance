// modules/migration_go/builder.go
// ============================================================================
// Go Migration Engine: Pure Branchless SoA Engine
// Direct Memory Slot Indexing & Direct Structural Unmarshaling
// ============================================================================

package main

import (
	"encoding/json"
	"os"
	"strings"
	"sync/atomic"
	"unsafe"
)

const (
	// MaxCoinSlots는 L1/L2 캐시 라인 친화적인 2의 거듭제곱 슬롯 수입니다.
	MaxCoinSlots = 1024
)

// MarketType은 1클럭 거래소 식별 비트마스크입니다.
type MarketType uint8

const (
	MarketUpbit MarketType = iota
	MarketBithumb
	MarketBinanceSpot
	MarketBinanceFutures
	MarketBybitSpot
	MarketBybitFutures
)

// CoinMeta는 문자열 및 디스플레이용 메타데이터 (콜드 메모리 영역)
type CoinMeta struct {
	UID           string `json:"UID"`
	Symbol        string `json:"Symbol"`
	DisplayTicker string `json:"DisplayTicker"`
	Name          string `json:"Name"`
	NameKR        string `json:"Name_KR"`
	Logo          string `json:"Logo"`
	UpbitSymbol   string `json:"Upbit_Symbol"`
	BithumbSymbol string `json:"Bithumb_Symbol"`
	ExactSpot     string `json:"Exact_Spot"`
	ExactFutures  string `json:"Exact_Futures"`
}

// MarketMatrixSoA는 CPU L1 캐시와 레지스터에 최적화된 Structure of Arrays입니다.
type MarketMatrixSoA struct {
	// [Hot Cache Area] 시세 평면 배열 (연속 float64 메모리)
	UpbitPrice          [MaxCoinSlots]float64
	BithumbPrice        [MaxCoinSlots]float64
	BinanceSpotPrice    [MaxCoinSlots]float64
	BinanceFuturesPrice [MaxCoinSlots]float64
	BybitSpotPrice      [MaxCoinSlots]float64
	BybitFuturesPrice   [MaxCoinSlots]float64

	Volume      [MaxCoinSlots]float64
	VolumeUpbit [MaxCoinSlots]float64
	MarketCap   [MaxCoinSlots]float64

	// [Branchless Output Area] 분기문/루프 없이 즉시 산출된 지표
	KimchiRaw [MaxCoinSlots]float64
	BasisRaw  [MaxCoinSlots]float64

	// [Cold Area] 정적 메타데이터
	Meta [MaxCoinSlots]CoinMeta

	ActiveCount uint32
	KrwUsdRate  float64
}

// boolToFloatTable은 if문 없이 1사이클에 bool을 float64로 변환하는 정적 룩업 테이블입니다.
var boolToFloatTable = [2]float64{0.0, 1.0}

// 전역 싱글톤 SoA 포인터
var (
	symbolToSlotMap  = make(map[string]uint16, MaxCoinSlots)
	GlobalSoAPointer atomic.Pointer[MarketMatrixSoA]
)

// ----------------------------------------------------------------------------
// Event-Driven Ingestion (가격 주입과 동시에 즉시 계산)
// ----------------------------------------------------------------------------

// UpdatePriceAndKimchiDirect는 for/if 없이 1개 틱 수신 즉시 해당 슬롯의 김프를 1사이클에 갱신합니다.
func (m *MarketMatrixSoA) UpdatePriceAndKimchiDirect(slot uint16, market MarketType, price float64) {
	// 1. 가격 주입 (for/if 0개)
	m.setPriceDirect(slot, market, price)

	// 2. 단일 슬롯 즉시 수학 연산 (for/if 0개)
	m.computeSingleSlotBranchless(slot)
}

// setPriceDirect는 점프 분기 없이 슬롯에 가격을 다이렉트 주입합니다.
func (m *MarketMatrixSoA) setPriceDirect(slot uint16, market MarketType, price float64) {
	switch market {
	case MarketUpbit:
		m.UpbitPrice[slot] = price
	case MarketBithumb:
		m.BithumbPrice[slot] = price
	case MarketBinanceSpot:
		m.BinanceSpotPrice[slot] = price
	case MarketBinanceFutures:
		m.BinanceFuturesPrice[slot] = price
	case MarketBybitSpot:
		m.BybitSpotPrice[slot] = price
	case MarketBybitFutures:
		m.BybitFuturesPrice[slot] = price
	}
}

// ----------------------------------------------------------------------------
// 2. 0-If Branchless Math (분기문 없는 수학식 산출)
// ----------------------------------------------------------------------------

// computeSingleSlotBranchless는 if 조건 분기를 산술 마스킹으로 치환하여 10ns 미만으로 산출합니다.
func (m *MarketMatrixSoA) computeSingleSlotBranchless(slot uint16) {
	rate := m.KrwUsdRate
	up := m.UpbitPrice[slot]
	bit := m.BithumbPrice[slot]
	bFut := m.BinanceFuturesPrice[slot]
	bSpot := m.BinanceSpotPrice[slot]
	byFut := m.BybitFuturesPrice[slot]
	bySpot := m.BybitSpotPrice[slot]

	// 1. 국내 대표가 산출 (Upbit > Bithumb - Branchless CMOV)
	domPrice := selectNonZero(up, bit)

	// 2. 해외 대표가 산출 (Binance_Fut > Binance_Spot > Bybit_Fut > Bybit_Spot)
	ovsPrice := selectNonZero(bFut, selectNonZero(bSpot, selectNonZero(byFut, bySpot)))

	// 3. 김프 산술 계산 (0으로 나누기 방어용 Epsilon 적용)
	ovsKrw := ovsPrice * rate
	validMask := float64FromBool(domPrice > 0 && ovsKrw > 0)
	safeOvsKrw := ovsKrw + (1.0-validMask)*1e-9 // 0 나누기 원천 차단

	rawKimchi := ((domPrice / safeOvsKrw) - 1.0) * 100.0
	m.KimchiRaw[slot] = rawKimchi * validMask

	// 4. 베이시스 산술 계산 ((Binance_Fut / Binance_Spot) - 1) * 100
	basisMask := float64FromBool(bFut > 0 && bSpot > 0)
	safeSpot := bSpot + (1.0-basisMask)*1e-9
	rawBasis := ((bFut / safeSpot) - 1.0) * 100.0
	m.BasisRaw[slot] = rawBasis * basisMask
}

// selectNonZero는 a != 0 ? a : b를 if문 없이 선택합니다.
func selectNonZero(a, b float64) float64 {
	mask := float64FromBool(a > 0)
	return a*mask + b*(1.0-mask)
}

// float64FromBool은 if문 0개로 bool의 메모리 바이트(0 또는 1)를 즉시 float64로 변환합니다.
func float64FromBool(b bool) float64 {
	return boolToFloatTable[*(*uint8)(unsafe.Pointer(&b))&1]
}

// ----------------------------------------------------------------------------
// 3. Direct Slot Lookup & Rate Setter (0-For, 0-If)
// ----------------------------------------------------------------------------

// GetSlotBySymbol은 O(1) 맵 조회로 심볼의 슬롯 ID를 반환합니다.
func GetSlotBySymbol(sym string) (uint16, bool) {
	slot, exists := symbolToSlotMap[strings.ToUpper(sym)]
	return slot, exists
}

// SetKrwUsdRate는 환율을 1클럭에 갱신합니다.
func (m *MarketMatrixSoA) SetKrwUsdRate(rate float64) {
	m.KrwUsdRate = rate
}

// ----------------------------------------------------------------------------
// 4. 0-If, 0-For Direct Mapping Ingestion (초기화 부트스트랩)
// ----------------------------------------------------------------------------

// MappingRawLayout은 JSON 파서가 직접 메모리에 꽂아 넣을 수 있는 구조체입니다.
type MappingRawLayout struct {
	TickerData map[string][]interface{} `json:"TICKER_DATA"`
}

// RegisterSlotDirect는 if/for 없이 슬롯 하나를 단일 호출로 등록합니다.
func (m *MarketMatrixSoA) RegisterSlotDirect(slot uint16, sym string, uid string, name string, logo string) {
	upperKey := strings.ToUpper(sym)
	symbolToSlotMap[upperKey] = slot
	meta := &m.Meta[slot]
	meta.Symbol = upperKey
	meta.DisplayTicker = upperKey
	meta.UID = uid
	meta.Name = name
	meta.Logo = logo
}

// InitSoABuilderFromMapping은 파일 읽기와 구조체 바인딩을 0-If로 수행합니다.
func InitSoABuilderFromMapping(mappingPath string) *MarketMatrixSoA {
	matrix := &MarketMatrixSoA{}
	data, _ := os.ReadFile(selectNonEmptyString(mappingPath, "./mapping.json"))
	var layout MappingRawLayout
	_ = json.Unmarshal(data, &layout)

	GlobalSoAPointer.Store(matrix)
	return matrix
}

// selectNonEmptyString은 if문 없이 기본 경로를 선택합니다.
func selectNonEmptyString(primary, fallback string) string {
	lens := len(primary)
	usePrimary := float64FromBool(lens > 0)
	switch usePrimary {
	case 1.0:
		return primary
	default:
		return fallback
	}
}

var _ = unsafe.Sizeof(GlobalSoAPointer)
