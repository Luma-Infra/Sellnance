# Codebase Lines & Function Metrics

> VS Code Color Guide: File (+ Green), Function (! Cyan/Blue)

```diff
+ config.py                                            [   47 lines |    1125 chars]
!   ├── get_cmc_api_key()                              [   17 lines |     466 chars]
!   └── set_cmc_api_key()                              [   22 lines |     450 chars]
+ listing.json                                         [ 4418 lines |   64064 chars]
+ mapping.json                                         [ 6583 lines |   50415 chars]
+ package-lock.json                                    [ 2046 lines |   52164 chars]
+ package.json                                         [   33 lines |     710 chars]
+ postcss.config.js                                    [    6 lines |      71 chars]
+ railpack.json                                        [    3 lines |      21 chars]
+ requirements.txt                                     [    9 lines |     128 chars]
+ run.py                                               [   46 lines |     811 chars]
!   ├── clear_port()                                   [   14 lines |     293 chars]
!   └── start_engine()                                 [   26 lines |     438 chars]
+ tailwind.config.js                                   [   19 lines |     253 chars]
+ usdkrw_cache.json                                    [    1 lines |  143075 chars]
+ vite.config.js                                       [   25 lines |     512 chars]
+ modules\adapter.py                                   [  101 lines |    2467 chars]
!   ├── normalize_interval()                           [   46 lines |     835 chars]
!   ├── normalize_symbol()                             [   14 lines |     333 chars]
!   └── get_candle_url()                               [   37 lines |    1239 chars]
+ modules\api_manager.py                               [  429 lines |   10766 chars]
!   ├── _load_market_data_cache_from_file()            [   22 lines |     589 chars]
!   ├── _save_market_data_cache_to_file()              [   19 lines |     418 chars]
!   ├── _load_owner_cache_from_file()                  [   16 lines |     475 chars]
!   ├── _save_owner_cache_to_file()                    [   19 lines |     362 chars]
!   ├── start_kst_9am_scheduler()                      [   25 lines |     577 chars]
!   ├── run_scheduler()                                [   22 lines |     477 chars]
!   ├── start_silent_background_scheduler()            [   12 lines |     352 chars]
!   ├── run()                                          [    9 lines |     252 chars]
!   ├── _fetch_and_process_data_and_cache()            [   20 lines |     441 chars]
!   ├── _ensure_initialized()                          [    9 lines |     156 chars]
!   ├── suppress_output()                              [   11 lines |     212 chars]
!   ├── _fetch_and_process_data()                      [  152 lines |    3975 chars]
!   └── get_cached_data()                              [   85 lines |    2222 chars]
+ modules\app.py                                       [  485 lines |   12458 chars]
!   ├── safe_print()                                   [    6 lines |     168 chars]
!   ├── lifespan()                                     [   10 lines |     390 chars]
!   ├── _load_listing_file()                           [    8 lines |     191 chars]
!   ├── _save_listing_file()                           [   10 lines |     189 chars]
!   ├── _init_listing_dates()                          [    6 lines |     174 chars]
!   ├── get_listing_dates()                            [    3 lines |      72 chars]
!   ├── update_listing_date()                          [   27 lines |     812 chars]
!   ├── chrome_devtools_dummy()                        [    2 lines |      35 chars]
!   ├── home()                                         [    2 lines |      97 chars]
!   ├── get_env_cmc_key()                              [    3 lines |      89 chars]
!   ├── track_user_session()                           [   13 lines |     376 chars]
!   ├── get_market_data()                              [   25 lines |     767 chars]
!   ├── get_market_data_silent()                       [   30 lines |     967 chars]
!   ├── get_market_map()                               [   52 lines |    1065 chars]
!   ├── get_coin_info()                                [   43 lines |     984 chars]
!   ├── get_proxy_candles()                            [    9 lines |     175 chars]
!   ├── get_usdkrw_history()                           [   92 lines |    1949 chars]
!   ├── get_settings()                                 [    2 lines |      80 chars]
!   ├── update_settings()                              [    4 lines |     131 chars]
!   ├── open_browser()                                 [    2 lines |      58 chars]
!   ├── auto_reset_scheduler()                         [    9 lines |     276 chars]
!   ├── progress_stream()                              [   18 lines |     387 chars]
!   ├── event_generator()                              [   16 lines |     288 chars]
!   └── dynamic_symbol_route()                         [   16 lines |     303 chars]
+ modules\builder.py                                   [  255 lines |    6229 chars]
!   ├── clean_stale_tickers()                          [   30 lines |     624 chars]
!   └── assemble_final_dashboard()                     [  218 lines |    5364 chars]
+ modules\builder_binance.py                           [  572 lines |   15481 chars]
!   └── build_binance_row()                            [  570 lines |   15436 chars]
+ modules\builder_upbit.py                             [  355 lines |    9691 chars]
!   └── build_upbit_row()                              [  353 lines |    9646 chars]
+ modules\cache.go                                     [   71 lines |    1685 chars]
!   ├── GetCachedData()                                [    5 lines |     174 chars]
!   ├── GetProgressData()                              [    9 lines |     227 chars]
!   ├── updateProgress()                               [    8 lines |     181 chars]
!   ├── ForceUpdateCache()                             [   19 lines |     619 chars]
!   └── UpdateCacheScheduler()                         [    7 lines |     127 chars]
+ modules\candle_proxy.py                              [  403 lines |    7733 chars]
!   ├── _construct_tv_msg()                            [    3 lines |     109 chars]
!   ├── get_tv_candles_aiohttp()                       [   80 lines |    1517 chars]
!   ├── _raw_fetch_candles()                           [  259 lines |    4641 chars]
!   ├── fetch_candles_guarded()                        [   46 lines |    1192 chars]
!   └── _guarded_worker()                              [   12 lines |     348 chars]
+ modules\cmc_api.py                                   [  186 lines |    4954 chars]
!   ├── _fetch_cmc_api_chunk()                         [   13 lines |     336 chars]
!   ├── build_cmc_lookup_lists()                       [  100 lines |    2563 chars]
!   ├── process_asset()                                [   68 lines |    1754 chars]
!   ├── fetch_cmc_market_data()                        [    6 lines |     298 chars]
!   └── execute_cmc_requests()                         [   60 lines |    1566 chars]
+ modules\config_manager.py                            [   71 lines |    2094 chars]
!   ├── load_mapping_data()                            [   27 lines |     672 chars]
!   ├── save_mapping_data()                            [   27 lines |     931 chars]
!   └── get_mapping_parts()                            [   12 lines |     397 chars]
+ modules\exchange_api.py                              [  731 lines |   17900 chars]
!   ├── load_utc0_cache()                              [    8 lines |     166 chars]
!   ├── save_utc0_cache()                              [    5 lines |      91 chars]
!   ├── get_korean_exchange_markets()                  [   38 lines |    1005 chars]
!   ├── fetch_global_listings()                        [  162 lines |    2139 chars]
!   ├── add_tags()                                     [    6 lines |     112 chars]
!   ├── get_okx()                                      [   16 lines |     178 chars]
!   ├── get_okx_futures()                              [   16 lines |     189 chars]
!   ├── get_bybit()                                    [   17 lines |     203 chars]
!   ├── get_bybit_futures()                            [   17 lines |     216 chars]
!   ├── get_bitget()                                   [   15 lines |     174 chars]
!   ├── get_bitget_futures()                           [   16 lines |     212 chars]
!   ├── get_gateio()                                   [   13 lines |     154 chars]
!   ├── get_gateio_futures()                           [   13 lines |     182 chars]
!   ├── get_coinbase()                                 [   13 lines |     161 chars]
!   ├── fetch_exchange_market_data()                   [   45 lines |    1186 chars]
!   ├── capture_utc0_prices_bulk()                     [   15 lines |     445 chars]
!   ├── fetch_missing_utc0_opens_parallel()            [   74 lines |    2143 chars]
!   ├── _fetch()                                       [   23 lines |     653 chars]
!   ├── get_utc0_open_price()                          [    7 lines |     274 chars]
!   ├── fetch_binance_open()                           [   13 lines |     448 chars]
!   ├── fetch_binance_futures_spot()                   [  248 lines |    6794 chars]
!   ├── fetch_url_safe()                               [   22 lines |     496 chars]
!   ├── fetch_upbit_prices()                           [   33 lines |     780 chars]
!   ├── fetch_bybit_prices()                           [   45 lines |    1457 chars]
!   └── fetch_bithumb_prices()                         [   21 lines |     438 chars]
+ modules\fetcher.go                                   [   42 lines |    1013 chars]
!   └── FetchAllMarketsParallel()                      [   35 lines |     956 chars]
+ modules\logger.py                                    [   18 lines |     548 chars]
!   ├── formatTime()                                   [    3 lines |     155 chars]
!   └── setup_logger()                                 [    9 lines |     277 chars]
+ modules\main.go                                      [  167 lines |    4073 chars]
!   ├── main()                                         [  144 lines |    3683 chars]
!   └── DailyResetScheduler()                          [   12 lines |     255 chars]
+ modules\trace_hooking.py                             [   62 lines |    2009 chars]
!   ├── draw_dashboard()                               [   22 lines |     653 chars]
!   ├── phase_trace()                                  [   12 lines |     253 chars]
!   ├── decorator()                                    [   10 lines |     212 chars]
!   ├── wrapper()                                      [    7 lines |     158 chars]
!   └── apply_traces()                                 [   12 lines |     865 chars]
+ modules\utils.py                                     [  152 lines |    4036 chars]
!   ├── get_file_lock()                                [    6 lines |     194 chars]
!   ├── atomic_save_json()                             [   28 lines |     733 chars]
!   ├── format_market_cap_string()                     [   10 lines |     236 chars]
!   ├── format_volume_string()                         [    8 lines |     179 chars]
!   ├── format_volume_krw_string()                     [   10 lines |     283 chars]
!   ├── js_round()                                     [    4 lines |     174 chars]
!   ├── get_precision()                                [    4 lines |     142 chars]
!   ├── format_dynamic_price()                         [    4 lines |     102 chars]
!   ├── format_change()                                [   10 lines |     372 chars]
!   ├── create_image_tag()                             [    4 lines |     152 chars]
!   ├── get_pure_base_asset()                          [   14 lines |     356 chars]
!   ├── is_scaled_symbol()                             [    2 lines |      75 chars]
!   ├── get_multiplier()                               [   20 lines |     362 chars]
!   └── is_valid_ticker()                              [   18 lines |     474 chars]
+ static\alpine.min.js                                 [    3 lines |   43734 chars]
+ static\api.js                                        [    0 lines |       0 chars]
+ static\app_loader.js                                 [   69 lines |    2346 chars]
+ static\chart.js                                      [  975 lines |   26367 chars]
!   ├── renderFn()                                     [   19 lines |     428 chars]
!   ├── initChart()                                    [  734 lines |   20099 chars]
!   ├── onUserInteract()                               [    8 lines |     245 chars]
!   ├── syncTimeScales()                               [   19 lines |     389 chars]
!   ├── syncCrosshair()                                [  235 lines |    6039 chars]
!   ├── renderTargetCharts()                           [   58 lines |    1447 chars]
!   ├── updateChartTheme()                             [   78 lines |    2196 chars]
!   ├── mapTime()                                      [   18 lines |     488 chars]
!   └── setupScaleModeButtons()                        [   53 lines |    1887 chars]
+ static\chart_api.js                                  [   16 lines |     377 chars]
!   └── loadSymbols()                                  [   15 lines |     346 chars]
+ static\chart_bithumb_sync.js                         [  114 lines |    2605 chars]
!   ├── getBithumbGroupTime()                          [   34 lines |     801 chars]
!   └── fetchBithumbUnifiedCandles()                   [   79 lines |    1773 chars]
+ static\chart_data.js                                 [  591 lines |   14684 chars]
!   ├── fetchCandlesSmart()                            [  149 lines |    3560 chars]
!   ├── fetchPaginated()                               [   30 lines |     510 chars]
!   ├── mapTime()                                      [   25 lines |     684 chars]
!   ├── clearChartData()                               [   27 lines |     615 chars]
!   ├── switchKimchiSub()                              [   28 lines |     873 chars]
!   ├── loadMoreHistory()                              [  310 lines |    7800 chars]
!   ├── getGroupTime()                                 [   16 lines |     555 chars]
!   └── getSubKey()                                    [    3 lines |      86 chars]
+ static\chart_data_kimchi.js                          [  144 lines |    4882 chars]
!   ├── resampleSubCandles()                           [   45 lines |    1899 chars]
!   ├── getTs()                                        [    7 lines |     321 chars]
!   ├── getO()                                         [   33 lines |    1331 chars]
!   ├── getH()                                         [   32 lines |    1207 chars]
!   ├── getL()                                         [   31 lines |    1058 chars]
!   ├── getC()                                         [   30 lines |     913 chars]
!   ├── getV()                                         [   29 lines |     760 chars]
!   ├── calculateKimchiData()                          [   97 lines |    2894 chars]
!   ├── getSubTime()                                   [   14 lines |     459 chars]
!   └── getSubClose()                                  [   11 lines |     352 chars]
+ static\chart_debug_monitor.js                        [  440 lines |   11357 chars]
!   ├── logDiagnostic()                                [   16 lines |     332 chars]
!   ├── updateUI()                                     [  113 lines |    4224 chars]
!   ├── wrapSeriesInstance()                           [  144 lines |    2632 chars]
!   └── initializeHook()                               [   62 lines |    1765 chars]
+ static\chart_draw.js                                 [  827 lines |   19460 chars]
!   ├── renderFn()                                     [  150 lines |    3325 chars]
!   ├── deleteDrawing()                                [   32 lines |     759 chars]
!   ├── updateFloatingDeleteButton()                   [   92 lines |    2533 chars]
!   ├── getDistanceToSegment()                         [    9 lines |     250 chars]
!   ├── findHitDrawing()                               [  104 lines |    2047 chars]
!   ├── initDrawingEvents()                            [  234 lines |    5772 chars]
!   ├── endDrag()                                      [   28 lines |     399 chars]
!   ├── selectDrawingTool()                            [   52 lines |    1107 chars]
!   └── initDrawingToolbar()                           [    5 lines |     106 chars]
+ static\chart_fetch.js                                [  630 lines |   17050 chars]
!   ├── fetchHistory()                                 [  617 lines |   16618 chars]
!   └── doFit()                                        [    8 lines |     411 chars]
+ static\chart_history_helper.js                       [  137 lines |    4558 chars]
!   ├── findRowInfo()                                  [   64 lines |    2517 chars]
!   └── determineListingDate()                         [   70 lines |    1907 chars]
+ static\chart_history_kimchi.js                       [  600 lines |   16178 chars]
!   ├── getExchangeLoadingTheme()                      [   31 lines |     790 chars]
!   ├── showKimchiLoading()                            [   16 lines |     707 chars]
!   ├── hideKimchiLoading()                            [   14 lines |     378 chars]
!   ├── updateKimchiComparisonUI()                     [   70 lines |    1300 chars]
!   ├── toggleKimchiComparison()                       [   41 lines |     986 chars]
!   └── lazyRenderKimchiData()                         [  412 lines |   11339 chars]
+ static\chart_layout.js                               [  163 lines |    4140 chars]
!   ├── togglePane()                                   [    4 lines |     110 chars]
!   ├── toggleVolFallback()                            [   10 lines |     205 chars]
!   ├── applyChartLayout()                             [  106 lines |    2585 chars]
!   ├── initResizers()                                 [   27 lines |     780 chars]
!   └── startDrag()                                    [    4 lines |      86 chars]
+ static\chart_measure.js                              [  360 lines |    9163 chars]
!   ├── renderFn()                                     [   83 lines |    2554 chars]
!   ├── stopMeasuring()                                [   27 lines |     582 chars]
!   ├── setupMeasureTool()                             [   14 lines |     577 chars]
!   ├── toggleMeasureTool()                            [   34 lines |     588 chars]
!   └── initMeasureEvents()                            [  151 lines |    3767 chars]
+ static\chart_utils.js                                [  986 lines |   25749 chars]
!   ├── getUnixSeconds()                               [   12 lines |     268 chars]
!   ├── getNextBarTime()                               [   30 lines |     655 chars]
!   ├── ensureSafeUnixSeconds()                        [   11 lines |     243 chars]
!   ├── resetChartScale()                              [   54 lines |    1265 chars]
!   ├── formatSmartPrice()                             [   94 lines |    2455 chars]
!   ├── formatCrosshairPrice()                         [    6 lines |     146 chars]
!   ├── formatVolumeDollar()                           [    7 lines |     255 chars]
!   ├── formatVolumeKRW()                              [    7 lines |     249 chars]
!   ├── updateLegend()                                 [  200 lines |    5626 chars]
!   ├── safeFormat()                                   [    4 lines |     130 chars]
!   ├── updateStatus()                                 [   58 lines |    1620 chars]
!   ├── autoFit()                                      [   63 lines |    1686 chars]
!   ├── calculateTimeRemaining()                       [   48 lines |    1109 chars]
!   ├── getMultiplier()                                [    9 lines |     221 chars]
!   ├── getPureBase()                                  [    4 lines |     110 chars]
!   ├── getKimchiColor()                               [   10 lines |     276 chars]
!   ├── toggleCountdown()                              [   29 lines |     644 chars]
!   ├── toggleOhlc()                                   [   37 lines |     771 chars]
!   ├── updateRealtimeCountdown()                      [   62 lines |    1991 chars]
!   ├── toggleCrosshairPct()                           [   34 lines |     725 chars]
!   ├── updateTabTitleManager()                        [   51 lines |    1513 chars]
!   ├── getLocalKrwPrecision()                         [    8 lines |     148 chars]
!   ├── sanitizeChartData()                            [   94 lines |    1884 chars]
!   ├── getTimeVal()                                   [    7 lines |     141 chars]
!   ├── rebuildMainDataMap()                           [    9 lines |     175 chars]
!   ├── rebuildVolumeDataMap()                         [    9 lines |     185 chars]
!   └── rebuildKimchiDataMap()                         [    9 lines |     185 chars]
+ static\feed_binance_futures.js                       [  111 lines |    3425 chars]
!   ├── startBinanceFuturesFeed()                      [   56 lines |    1637 chars]
!   └── initBinanceFuturesSniperSocket()               [   51 lines |    1602 chars]
+ static\feed_binance_spot.js                          [  103 lines |    2849 chars]
!   ├── startBinanceSpotFeed()                         [   48 lines |    1263 chars]
!   └── initBinanceSniperSocket()                      [   51 lines |    1429 chars]
+ static\feed_bithumb.js                               [   61 lines |    1781 chars]
!   └── startBithumbFeed()                             [   59 lines |    1727 chars]
+ static\feed_bybit_futures.js                         [   57 lines |    1802 chars]
!   └── startBybitFuturesFeed()                        [   54 lines |    1682 chars]
+ static\feed_bybit_spot.js                            [   56 lines |    1643 chars]
!   └── startBybitSpotFeed()                           [   53 lines |    1529 chars]
+ static\feed_upbit.js                                 [  112 lines |    3426 chars]
!   ├── startUpbitFeed()                               [   58 lines |    1733 chars]
!   └── initUpbitSniperSocket()                        [   50 lines |    1561 chars]
+ static\lightweight-charts.standalone.production.js   [    1 lines |  192340 chars]
+ static\lwc_error_tracker.js                          [  209 lines |    4157 chars]
!   ├── initTracker()                                  [  180 lines |    3686 chars]
!   ├── requestAnimationFrame()                        [   20 lines |     331 chars]
!   └── wrapSeries()                                   [   74 lines |    1159 chars]
+ static\orderbook.js                                  [  376 lines |   10629 chars]
!   ├── initOrderbookDOM()                             [   35 lines |    1930 chars]
!   ├── toggleOrderbook()                              [   20 lines |     578 chars]
!   ├── changeOrderbookPrecision()                     [   12 lines |     293 chars]
!   ├── resetOrderbookPrecision()                      [    4 lines |      87 chars]
!   ├── stopOrderbookStream()                          [   11 lines |     185 chars]
!   ├── startOrderbookStream()                         [  165 lines |    3979 chars]
!   ├── scheduleRender()                               [   15 lines |     313 chars]
!   ├── renderOrderbook()                              [   93 lines |    2681 chars]
!   ├── groupData()                                    [   23 lines |     526 chars]
!   └── formatVol()                                    [    6 lines |     158 chars]
+ static\pixi.min.js                                   [  911 lines |  416351 chars]
+ static\pretendard.css                                [    7 lines |     162 chars]
+ static\quickview.js                                  [ 1053 lines |   29626 chars]
!   ├── initQuickView()                                [   41 lines |    1400 chars]
!   ├── destroyQuickView()                             [   34 lines |     772 chars]
!   ├── resolveTopAssets()                             [   31 lines |     973 chars]
!   ├── resolveAssetExchange()                         [   25 lines |     849 chars]
!   ├── rebuildQuickViewCharts()                       [   86 lines |    2703 chars]
!   ├── initSingleQuickViewChart()                     [  155 lines |    3909 chars]
!   ├── updateChartsAxisVisibility()                   [   31 lines |     706 chars]
!   ├── setQuickViewFocus()                            [   15 lines |     385 chars]
!   ├── renderOverlapLegend()                          [   62 lines |    1819 chars]
!   ├── connectQuickViewSockets()                      [  146 lines |    3762 chars]
!   ├── handleBinanceWsMessage()                       [   54 lines |    1317 chars]
!   ├── disconnectQuickViewSockets()                   [   29 lines |     674 chars]
!   ├── updateLiveHeaderPrice()                        [   38 lines |    1373 chars]
!   ├── setQuickViewLayout()                           [   92 lines |    2579 chars]
!   ├── changeQuickViewSort()                          [   17 lines |     484 chars]
!   ├── changeQuickViewTF()                            [   16 lines |     457 chars]
!   ├── changeQuickViewPage()                          [    9 lines |     314 chars]
!   ├── selectQuickViewInitSort()                      [    8 lines |     224 chars]
!   ├── triggerResizeQuickView()                       [   23 lines |     508 chars]
!   ├── resetQuickView()                               [   16 lines |     423 chars]
!   ├── closeQuickViewModal()                          [    8 lines |     183 chars]
!   ├── toggleQuickViewCandleColor()                   [   15 lines |     624 chars]
!   ├── setQuickViewBase()                             [   21 lines |     634 chars]
!   ├── resetQuickViewChartsScale()                    [    9 lines |     136 chars]
!   ├── updateLayoutToggleUI()                         [   21 lines |     923 chars]
!   └── updateQuickViewTheme()                         [   48 lines |    1049 chars]
+ static\sim_engine.js                                 [   95 lines |    3058 chars]
!   ├── changeDir()                                    [   34 lines |    1157 chars]
!   ├── addCandle()                                    [    9 lines |     307 chars]
!   ├── undoLast()                                     [   10 lines |     362 chars]
!   ├── getNext()                                      [   27 lines |     867 chars]
!   └── updatePreview()                                [    8 lines |     154 chars]
+ static\start.js                                      [ 1278 lines |   36820 chars]
!   ├── get3DTransform()                               [   14 lines |     595 chars]
!   ├── getShadowTransform()                           [    3 lines |      80 chars]
!   ├── getStartScreenHTML()                           [  334 lines |   10356 chars]
!   ├── maskApiKey()                                   [    9 lines |     189 chars]
!   ├── initPixiBackground()                           [   51 lines |    1191 chars]
!   ├── initStartQuickViewPreview()                    [  182 lines |    6172 chars]
!   ├── setStartOverlapFocus()                         [   28 lines |     635 chars]
!   ├── loadStartPreviewKlines()                       [   45 lines |    1195 chars]
!   ├── startStartPreviewWebSocket()                   [   62 lines |    1401 chars]
!   ├── applyStartCandleTheme()                        [   30 lines |     636 chars]
!   ├── switchStartPreviewTF()                         [   10 lines |     340 chars]
!   ├── resetAndStartProgressBar()                     [   13 lines |     357 chars]
!   ├── toggleStartQuickViewLayout()                   [   54 lines |    2088 chars]
!   ├── resizeStartQuickViewCharts()                   [   20 lines |     680 chars]
!   ├── destroyStartQuickViewPreview()                 [   31 lines |     466 chars]
!   ├── initStartScreen()                              [  130 lines |    3402 chars]
!   ├── updateClearBtnVisibility()                     [   23 lines |     432 chars]
!   ├── saveAndStart()                                 [   54 lines |    1107 chars]
!   ├── skipAndStart()                                 [   18 lines |     449 chars]
!   ├── hideStartScreen()                              [   29 lines |     650 chars]
!   └── showStartScreen()                              [   74 lines |    2270 chars]
+ static\stream.js                                     [  467 lines |   13551 chars]
!   ├── syncRowPrioritizedMetrics()                    [  189 lines |    5116 chars]
!   ├── calcKimchi()                                   [   61 lines |    2124 chars]
!   └── initAllExchangeFeeds()                         [    4 lines |      74 chars]
+ static\stream_global.js                              [  388 lines |   15901 chars]
!   ├── startRealtimeCandle()                          [  377 lines |   15448 chars]
!   ├── getWsId()                                      [   67 lines |    2214 chars]
!   ├── broadcastCandleUpdate()                        [   57 lines |    1920 chars]
!   ├── handleBinanceMessage()                         [   95 lines |    3999 chars]
!   └── handleBybitMessage()                           [   60 lines |    2397 chars]
+ static\stream_korea.js                               [  420 lines |   14867 chars]
!   ├── getPriceForExchange()                          [   35 lines |    1458 chars]
!   ├── updateRealtimeKimchi()                         [  206 lines |    6877 chars]
!   ├── isTimeValid()                                  [   16 lines |     411 chars]
!   ├── updateRealtimeKimchiThrottled()                [   27 lines |     826 chars]
!   ├── getUpbitMessageHandler()                       [   77 lines |    2936 chars]
!   └── getBithumbMessageHandler()                     [   64 lines |    2327 chars]
+ static\stream_render.js                              [  112 lines |    3137 chars]
!   ├── renderRealtimeUpdate()                         [   84 lines |    2408 chars]
!   └── restoreVolumeDataSterilized()                  [   26 lines |     632 chars]
+ static\stream_table.js                               [  584 lines |   18194 chars]
!   ├── initSniperSocket()                             [   11 lines |     308 chars]
!   ├── syncSniperSubscriptions()                      [  100 lines |    3036 chars]
!   ├── getNextId()                                    [   36 lines |    1441 chars]
!   ├── refreshSniperTarget()                          [    4 lines |     175 chars]
!   ├── calculateRowKimchi()                           [   75 lines |    2139 chars]
!   └── renderRealtimeRow()                            [  378 lines |   11999 chars]
+ static\stream_utils.js                               [   34 lines |    1005 chars]
!   ├── getNormalizedTime()                            [   19 lines |     650 chars]
!   └── isTimeValid()                                  [   14 lines |     324 chars]
+ static\sw.js                                         [   24 lines |     494 chars]
+ static\sweetalert2@11.js                             [    2 lines |   77345 chars]
+ static\table.js                                      [  145 lines |    3875 chars]
+ static\table_api.js                                  [  387 lines |   10186 chars]
!   ├── processTableData()                             [  136 lines |    3363 chars]
!   ├── loadTableData()                                [   90 lines |    2220 chars]
!   └── loadTableDataSilent()                          [  158 lines |    4490 chars]
+ static\table_filter.js                               [ 1119 lines |   35608 chars]
!   ├── isStockCoin()                                  [    7 lines |     249 chars]
!   ├── getFilteredData()                              [  220 lines |    7400 chars]
!   ├── getScore()                                     [   12 lines |     457 chars]
!   ├── checkMatch()                                   [   14 lines |     923 chars]
!   ├── switchTab()                                    [   27 lines |     707 chars]
!   ├── switchFilter()                                 [   55 lines |    1529 chars]
!   ├── updateUI()                                     [   13 lines |     350 chars]
!   ├── switchView()                                   [   33 lines |    1206 chars]
!   ├── toggleCurrency()                               [   22 lines |     650 chars]
!   ├── toggleSmallCap()                               [   35 lines |     686 chars]
!   ├── maskApiKey()                                   [    9 lines |     195 chars]
!   ├── openSettingsModal()                            [   22 lines |     608 chars]
!   ├── closeSettingsModal()                           [    6 lines |     127 chars]
!   ├── saveSettings()                                 [   22 lines |     575 chars]
!   ├── togglePasswordVisibility()                     [   15 lines |     414 chars]
!   ├── clearCmcKey()                                  [    8 lines |     152 chars]
!   ├── toggleExchFilter()                             [   10 lines |     328 chars]
!   ├── updateExchFilterUI()                           [  154 lines |    6387 chars]
!   ├── switchExchFilterMode()                         [    9 lines |     270 chars]
!   ├── toggleExchExclude()                            [   11 lines |     264 chars]
!   ├── resetExchFilters()                             [   10 lines |     267 chars]
!   ├── selectExchPreset()                             [   34 lines |     761 chars]
!   ├── saveCurrentPreset()                            [   28 lines |     598 chars]
!   ├── deleteCurrentPreset()                          [   32 lines |     681 chars]
!   ├── updateFavoritesCount()                         [    8 lines |     499 chars]
!   ├── sliderToMcap()                                 [    5 lines |      94 chars]
!   ├── mcapToSlider()                                 [    5 lines |      99 chars]
!   ├── sliderToVol()                                  [    5 lines |      92 chars]
!   ├── volToSlider()                                  [    5 lines |     106 chars]
!   ├── formatFilterValue()                            [   14 lines |     391 chars]
!   ├── formatKoreanMoney()                            [   18 lines |     379 chars]
!   ├── updateCustomFilterUI()                         [   58 lines |    2268 chars]
!   ├── toggleCustomFilter()                           [   67 lines |    2474 chars]
!   ├── setVolSource()                                 [   21 lines |     714 chars]
!   ├── applyCustomFilter()                            [   10 lines |     290 chars]
!   ├── resetCustomFilter()                            [   31 lines |    1055 chars]
!   └── setupTrackClick()                              [   24 lines |     809 chars]
+ static\table_render.js                               [ 1592 lines |   49984 chars]
!   ├── getOrCreateGlobalCautionTooltip()              [   10 lines |     541 chars]
!   ├── getWarningBadgeHtml()                          [   15 lines |     665 chars]
!   ├── getListingDate()                               [   27 lines |     667 chars]
!   ├── formatListingDateWithExchange()                [   31 lines |     955 chars]
!   ├── createRowElement()                             [   13 lines |     428 chars]
!   ├── updateRowStaticHTML()                          [  226 lines |    9051 chars]
!   ├── updateRowDynamicHTML()                         [    7 lines |     239 chars]
!   ├── updateRowInnerHTML()                           [    4 lines |     108 chars]
!   ├── updateBoundaryClass()                          [   22 lines |     561 chars]
!   ├── renderTable()                                  [  323 lines |    9176 chars]
!   ├── updateVisibleSymbols()                         [    2 lines |      38 chars]
!   ├── applySelectedHighlight()                       [   21 lines |     514 chars]
!   ├── initInfiniteScroll()                           [   25 lines |     519 chars]
!   ├── toggleFavorite()                               [   83 lines |    2293 chars]
!   ├── commitFavoriteChange()                         [   30 lines |    1056 chars]
!   ├── cancelFavoriteChange()                         [    9 lines |     297 chars]
!   ├── confirmFavoriteChange()                        [    4 lines |     110 chars]
!   ├── updateProgressBar()                            [   36 lines |     832 chars]
!   ├── clearAllPendingFavActions()                    [   12 lines |     321 chars]
!   └── applyPriceFlash()                              [   23 lines |     677 chars]
+ static\table_sort.js                                 [  196 lines |    4675 chars]
!   ├── sortTable()                                    [   41 lines |    1048 chars]
!   ├── simpleSortData()                               [  134 lines |    3102 chars]
!   └── applyRealtimeSort()                            [   12 lines |     294 chars]
+ static\ui_control.js                                 [ 1531 lines |   46087 chars]
!   ├── toggleTheme()                                  [   33 lines |    1102 chars]
!   ├── toggleSidebar()                                [   18 lines |     533 chars]
!   ├── switchViewMode()                               [   48 lines |    1387 chars]
!   ├── switchMobileView()                             [   47 lines |    1611 chars]
!   ├── showMobileChart()                              [   35 lines |    1249 chars]
!   ├── closeMobileChart()                             [   20 lines |     734 chars]
!   ├── switchMobileTab()                              [   42 lines |    1221 chars]
!   ├── switchChartTab()                               [   21 lines |     517 chars]
!   ├── executeTabSwitch()                             [   55 lines |    1779 chars]
!   ├── togglePanelSwap()                              [   47 lines |    1652 chars]
!   ├── showOnboardingModal()                          [   15 lines |     495 chars]
!   ├── closeOnboardingModal()                         [   17 lines |     571 chars]
!   ├── toggleRightDomBlock()                          [   85 lines |    2484 chars]
!   ├── toggleChartMouseEventBlock()                   [   11 lines |     334 chars]
!   ├── toggleLeftDomBlock()                           [   52 lines |    1485 chars]
!   ├── toggleTableUpdateBlock()                       [    3 lines |      78 chars]
!   ├── toggleChartDomBlock()                          [    3 lines |      66 chars]
!   ├── toggleOrderbookBlock()                         [    8 lines |     296 chars]
!   ├── toggleSortBlock()                              [    3 lines |      58 chars]
!   ├── toggleKimchiBlock()                            [   40 lines |    1074 chars]
!   ├── toggleLegendBlock()                            [    3 lines |      62 chars]
!   ├── toggleResizeBlock()                            [    3 lines |      67 chars]
!   ├── toggleTabScrollBlock()                         [    3 lines |      73 chars]
!   ├── toggleRadarBatchBlock()                        [    3 lines |      70 chars]
!   ├── toggleDynamicHtmlBlock()                       [    3 lines |      75 chars]
!   ├── setAggTradeInterval()                          [   18 lines |     499 chars]
!   ├── copyPerformanceStats()                         [   39 lines |    1258 chars]
!   ├── toggleTabSearch()                              [   41 lines |    1050 chars]
!   ├── clearSearch()                                  [   11 lines |     226 chars]
!   ├── searchSymbols()                                [   40 lines |     846 chars]
!   ├── runSearch()                                    [    7 lines |     125 chars]
!   ├── getOrCreateRecentSearchDropdown()              [   13 lines |     388 chars]
!   ├── getRecentSearches()                            [   10 lines |     193 chars]
!   ├── addRecentSearch()                              [   11 lines |     305 chars]
!   ├── removeRecentSearch()                           [   12 lines |     284 chars]
!   ├── clearAllRecentSearches()                       [   10 lines |     195 chars]
!   ├── getActiveSearchInput()                         [    9 lines |     264 chars]
!   ├── showRecentSearchChips()                        [   47 lines |    2010 chars]
!   ├── hideRecentSearchChips()                        [    7 lines |     168 chars]
!   ├── renderRecentSearchChips()                      [    6 lines |     184 chars]
!   ├── setTF()                                        [   23 lines |     548 chars]
!   ├── executeSetTF()                                 [   18 lines |     539 chars]
!   ├── toggleLogScale()                               [   62 lines |    1859 chars]
!   ├── moveTabSlider()                                [   22 lines |     750 chars]
!   ├── renderTimeframeButtons()                       [  123 lines |    3458 chars]
!   ├── checkLayoutOverlap()                           [   29 lines |     822 chars]
!   ├── adjustNoticeFontSizes()                        [   32 lines |     677 chars]
!   ├── getVisibleTfs()                                [   14 lines |     267 chars]
!   ├── saveVisibleTfs()                               [    4 lines |     139 chars]
!   ├── renderTimeframeButtons()                       [   25 lines |     787 chars]
!   ├── toggleTfSettings()                             [   21 lines |     672 chars]
!   ├── renderTfCheckboxList()                         [   36 lines |    1381 chars]
!   ├── applyTfSettings()                              [   13 lines |     349 chars]
!   ├── syncCheckboxesFromStore()                      [   22 lines |     934 chars]
!   └── check()                                        [    4 lines |      83 chars]
+ static\ui_selection.js                               [  462 lines |   13272 chars]
!   ├── selectSymbol()                                 [  360 lines |   10170 chars]
!   └── updateExchangeBadges()                         [   96 lines |    2825 chars]
+ static\z_style.css                                   [ 1080 lines |   21723 chars]
+ static\z_style.min.css                               [    1 lines |   99581 chars]
+ static\_main.js                                      [ 1003 lines |   26490 chars]
!   ├── getKrwPrecision()                              [    8 lines |     163 chars]
!   ├── restoreSavedUserSettings()                     [   56 lines |    1755 chars]
!   ├── initDashboardEngine()                          [   27 lines |     750 chars]
!   ├── handleHistoryNavigation()                      [    6 lines |     165 chars]
!   ├── setupSliderEvents()                            [   18 lines |     462 chars]
!   ├── setupButtonEvents()                            [   20 lines |     488 chars]
!   ├── setupSearchNavigation()                        [   56 lines |    1425 chars]
!   ├── resetActiveIndex()                             [    8 lines |     175 chars]
!   ├── updateHighlight()                              [   12 lines |     267 chars]
!   ├── toggleHeaderTop()                              [   43 lines |    1038 chars]
!   └── scheduleDailyReset()                           [   45 lines |    1283 chars]
+ static\_market_rules.js                              [  194 lines |    5498 chars]
!   ├── isFuturesCoin()                                [   10 lines |     234 chars]
!   ├── getRowExchangeMeta()                           [   39 lines |     901 chars]
!   ├── getRowKimchiGlobalPrice()                      [   28 lines |    1174 chars]
!   ├── getRowDisplayMetrics()                         [   90 lines |    2365 chars]
!   ├── getDisplayTickerHtml()                         [    6 lines |     235 chars]
!   └── getChartDefaultMarket()                        [   11 lines |     371 chars]
+ static\_store.js                                     [  325 lines |    8341 chars]
+ templates\index.html                                 [ 1920 lines |   88589 chars]
```

## Table View (Markdown Preview)

| File Path / Function | Line Count | Char Count |
| :--- | ---: | ---: |
| **`config.py`** | **47** | **1,125** |
| &nbsp;&nbsp;├── `get_cmc_api_key()` | 17 | 466 |
| &nbsp;&nbsp;└── `set_cmc_api_key()` | 22 | 450 |
| **`listing.json`** | **4418** | **64,064** |
| **`mapping.json`** | **6583** | **50,415** |
| **`package-lock.json`** | **2046** | **52,164** |
| **`package.json`** | **33** | **710** |
| **`postcss.config.js`** | **6** | **71** |
| **`railpack.json`** | **3** | **21** |
| **`requirements.txt`** | **9** | **128** |
| **`run.py`** | **46** | **811** |
| &nbsp;&nbsp;├── `clear_port()` | 14 | 293 |
| &nbsp;&nbsp;└── `start_engine()` | 26 | 438 |
| **`tailwind.config.js`** | **19** | **253** |
| **`usdkrw_cache.json`** | **1** | **143,075** |
| **`vite.config.js`** | **25** | **512** |
| **`modules\adapter.py`** | **101** | **2,467** |
| &nbsp;&nbsp;├── `normalize_interval()` | 46 | 835 |
| &nbsp;&nbsp;├── `normalize_symbol()` | 14 | 333 |
| &nbsp;&nbsp;└── `get_candle_url()` | 37 | 1,239 |
| **`modules\api_manager.py`** | **429** | **10,766** |
| &nbsp;&nbsp;├── `_load_market_data_cache_from_file()` | 22 | 589 |
| &nbsp;&nbsp;├── `_save_market_data_cache_to_file()` | 19 | 418 |
| &nbsp;&nbsp;├── `_load_owner_cache_from_file()` | 16 | 475 |
| &nbsp;&nbsp;├── `_save_owner_cache_to_file()` | 19 | 362 |
| &nbsp;&nbsp;├── `start_kst_9am_scheduler()` | 25 | 577 |
| &nbsp;&nbsp;├── `run_scheduler()` | 22 | 477 |
| &nbsp;&nbsp;├── `start_silent_background_scheduler()` | 12 | 352 |
| &nbsp;&nbsp;├── `run()` | 9 | 252 |
| &nbsp;&nbsp;├── `_fetch_and_process_data_and_cache()` | 20 | 441 |
| &nbsp;&nbsp;├── `_ensure_initialized()` | 9 | 156 |
| &nbsp;&nbsp;├── `suppress_output()` | 11 | 212 |
| &nbsp;&nbsp;├── `_fetch_and_process_data()` | 152 | 3,975 |
| &nbsp;&nbsp;└── `get_cached_data()` | 85 | 2,222 |
| **`modules\app.py`** | **485** | **12,458** |
| &nbsp;&nbsp;├── `safe_print()` | 6 | 168 |
| &nbsp;&nbsp;├── `lifespan()` | 10 | 390 |
| &nbsp;&nbsp;├── `_load_listing_file()` | 8 | 191 |
| &nbsp;&nbsp;├── `_save_listing_file()` | 10 | 189 |
| &nbsp;&nbsp;├── `_init_listing_dates()` | 6 | 174 |
| &nbsp;&nbsp;├── `get_listing_dates()` | 3 | 72 |
| &nbsp;&nbsp;├── `update_listing_date()` | 27 | 812 |
| &nbsp;&nbsp;├── `chrome_devtools_dummy()` | 2 | 35 |
| &nbsp;&nbsp;├── `home()` | 2 | 97 |
| &nbsp;&nbsp;├── `get_env_cmc_key()` | 3 | 89 |
| &nbsp;&nbsp;├── `track_user_session()` | 13 | 376 |
| &nbsp;&nbsp;├── `get_market_data()` | 25 | 767 |
| &nbsp;&nbsp;├── `get_market_data_silent()` | 30 | 967 |
| &nbsp;&nbsp;├── `get_market_map()` | 52 | 1,065 |
| &nbsp;&nbsp;├── `get_coin_info()` | 43 | 984 |
| &nbsp;&nbsp;├── `get_proxy_candles()` | 9 | 175 |
| &nbsp;&nbsp;├── `get_usdkrw_history()` | 92 | 1,949 |
| &nbsp;&nbsp;├── `get_settings()` | 2 | 80 |
| &nbsp;&nbsp;├── `update_settings()` | 4 | 131 |
| &nbsp;&nbsp;├── `open_browser()` | 2 | 58 |
| &nbsp;&nbsp;├── `auto_reset_scheduler()` | 9 | 276 |
| &nbsp;&nbsp;├── `progress_stream()` | 18 | 387 |
| &nbsp;&nbsp;├── `event_generator()` | 16 | 288 |
| &nbsp;&nbsp;└── `dynamic_symbol_route()` | 16 | 303 |
| **`modules\builder.py`** | **255** | **6,229** |
| &nbsp;&nbsp;├── `clean_stale_tickers()` | 30 | 624 |
| &nbsp;&nbsp;└── `assemble_final_dashboard()` | 218 | 5,364 |
| **`modules\builder_binance.py`** | **572** | **15,481** |
| &nbsp;&nbsp;└── `build_binance_row()` | 570 | 15,436 |
| **`modules\builder_upbit.py`** | **355** | **9,691** |
| &nbsp;&nbsp;└── `build_upbit_row()` | 353 | 9,646 |
| **`modules\cache.go`** | **71** | **1,685** |
| &nbsp;&nbsp;├── `GetCachedData()` | 5 | 174 |
| &nbsp;&nbsp;├── `GetProgressData()` | 9 | 227 |
| &nbsp;&nbsp;├── `updateProgress()` | 8 | 181 |
| &nbsp;&nbsp;├── `ForceUpdateCache()` | 19 | 619 |
| &nbsp;&nbsp;└── `UpdateCacheScheduler()` | 7 | 127 |
| **`modules\candle_proxy.py`** | **403** | **7,733** |
| &nbsp;&nbsp;├── `_construct_tv_msg()` | 3 | 109 |
| &nbsp;&nbsp;├── `get_tv_candles_aiohttp()` | 80 | 1,517 |
| &nbsp;&nbsp;├── `_raw_fetch_candles()` | 259 | 4,641 |
| &nbsp;&nbsp;├── `fetch_candles_guarded()` | 46 | 1,192 |
| &nbsp;&nbsp;└── `_guarded_worker()` | 12 | 348 |
| **`modules\cmc_api.py`** | **186** | **4,954** |
| &nbsp;&nbsp;├── `_fetch_cmc_api_chunk()` | 13 | 336 |
| &nbsp;&nbsp;├── `build_cmc_lookup_lists()` | 100 | 2,563 |
| &nbsp;&nbsp;├── `process_asset()` | 68 | 1,754 |
| &nbsp;&nbsp;├── `fetch_cmc_market_data()` | 6 | 298 |
| &nbsp;&nbsp;└── `execute_cmc_requests()` | 60 | 1,566 |
| **`modules\config_manager.py`** | **71** | **2,094** |
| &nbsp;&nbsp;├── `load_mapping_data()` | 27 | 672 |
| &nbsp;&nbsp;├── `save_mapping_data()` | 27 | 931 |
| &nbsp;&nbsp;└── `get_mapping_parts()` | 12 | 397 |
| **`modules\exchange_api.py`** | **731** | **17,900** |
| &nbsp;&nbsp;├── `load_utc0_cache()` | 8 | 166 |
| &nbsp;&nbsp;├── `save_utc0_cache()` | 5 | 91 |
| &nbsp;&nbsp;├── `get_korean_exchange_markets()` | 38 | 1,005 |
| &nbsp;&nbsp;├── `fetch_global_listings()` | 162 | 2,139 |
| &nbsp;&nbsp;├── `add_tags()` | 6 | 112 |
| &nbsp;&nbsp;├── `get_okx()` | 16 | 178 |
| &nbsp;&nbsp;├── `get_okx_futures()` | 16 | 189 |
| &nbsp;&nbsp;├── `get_bybit()` | 17 | 203 |
| &nbsp;&nbsp;├── `get_bybit_futures()` | 17 | 216 |
| &nbsp;&nbsp;├── `get_bitget()` | 15 | 174 |
| &nbsp;&nbsp;├── `get_bitget_futures()` | 16 | 212 |
| &nbsp;&nbsp;├── `get_gateio()` | 13 | 154 |
| &nbsp;&nbsp;├── `get_gateio_futures()` | 13 | 182 |
| &nbsp;&nbsp;├── `get_coinbase()` | 13 | 161 |
| &nbsp;&nbsp;├── `fetch_exchange_market_data()` | 45 | 1,186 |
| &nbsp;&nbsp;├── `capture_utc0_prices_bulk()` | 15 | 445 |
| &nbsp;&nbsp;├── `fetch_missing_utc0_opens_parallel()` | 74 | 2,143 |
| &nbsp;&nbsp;├── `_fetch()` | 23 | 653 |
| &nbsp;&nbsp;├── `get_utc0_open_price()` | 7 | 274 |
| &nbsp;&nbsp;├── `fetch_binance_open()` | 13 | 448 |
| &nbsp;&nbsp;├── `fetch_binance_futures_spot()` | 248 | 6,794 |
| &nbsp;&nbsp;├── `fetch_url_safe()` | 22 | 496 |
| &nbsp;&nbsp;├── `fetch_upbit_prices()` | 33 | 780 |
| &nbsp;&nbsp;├── `fetch_bybit_prices()` | 45 | 1,457 |
| &nbsp;&nbsp;└── `fetch_bithumb_prices()` | 21 | 438 |
| **`modules\fetcher.go`** | **42** | **1,013** |
| &nbsp;&nbsp;└── `FetchAllMarketsParallel()` | 35 | 956 |
| **`modules\logger.py`** | **18** | **548** |
| &nbsp;&nbsp;├── `formatTime()` | 3 | 155 |
| &nbsp;&nbsp;└── `setup_logger()` | 9 | 277 |
| **`modules\main.go`** | **167** | **4,073** |
| &nbsp;&nbsp;├── `main()` | 144 | 3,683 |
| &nbsp;&nbsp;└── `DailyResetScheduler()` | 12 | 255 |
| **`modules\trace_hooking.py`** | **62** | **2,009** |
| &nbsp;&nbsp;├── `draw_dashboard()` | 22 | 653 |
| &nbsp;&nbsp;├── `phase_trace()` | 12 | 253 |
| &nbsp;&nbsp;├── `decorator()` | 10 | 212 |
| &nbsp;&nbsp;├── `wrapper()` | 7 | 158 |
| &nbsp;&nbsp;└── `apply_traces()` | 12 | 865 |
| **`modules\utils.py`** | **152** | **4,036** |
| &nbsp;&nbsp;├── `get_file_lock()` | 6 | 194 |
| &nbsp;&nbsp;├── `atomic_save_json()` | 28 | 733 |
| &nbsp;&nbsp;├── `format_market_cap_string()` | 10 | 236 |
| &nbsp;&nbsp;├── `format_volume_string()` | 8 | 179 |
| &nbsp;&nbsp;├── `format_volume_krw_string()` | 10 | 283 |
| &nbsp;&nbsp;├── `js_round()` | 4 | 174 |
| &nbsp;&nbsp;├── `get_precision()` | 4 | 142 |
| &nbsp;&nbsp;├── `format_dynamic_price()` | 4 | 102 |
| &nbsp;&nbsp;├── `format_change()` | 10 | 372 |
| &nbsp;&nbsp;├── `create_image_tag()` | 4 | 152 |
| &nbsp;&nbsp;├── `get_pure_base_asset()` | 14 | 356 |
| &nbsp;&nbsp;├── `is_scaled_symbol()` | 2 | 75 |
| &nbsp;&nbsp;├── `get_multiplier()` | 20 | 362 |
| &nbsp;&nbsp;└── `is_valid_ticker()` | 18 | 474 |
| **`static\alpine.min.js`** | **3** | **43,734** |
| **`static\api.js`** | **0** | **0** |
| **`static\app_loader.js`** | **69** | **2,346** |
| **`static\chart.js`** | **975** | **26,367** |
| &nbsp;&nbsp;├── `renderFn()` | 19 | 428 |
| &nbsp;&nbsp;├── `initChart()` | 734 | 20,099 |
| &nbsp;&nbsp;├── `onUserInteract()` | 8 | 245 |
| &nbsp;&nbsp;├── `syncTimeScales()` | 19 | 389 |
| &nbsp;&nbsp;├── `syncCrosshair()` | 235 | 6,039 |
| &nbsp;&nbsp;├── `renderTargetCharts()` | 58 | 1,447 |
| &nbsp;&nbsp;├── `updateChartTheme()` | 78 | 2,196 |
| &nbsp;&nbsp;├── `mapTime()` | 18 | 488 |
| &nbsp;&nbsp;└── `setupScaleModeButtons()` | 53 | 1,887 |
| **`static\chart_api.js`** | **16** | **377** |
| &nbsp;&nbsp;└── `loadSymbols()` | 15 | 346 |
| **`static\chart_bithumb_sync.js`** | **114** | **2,605** |
| &nbsp;&nbsp;├── `getBithumbGroupTime()` | 34 | 801 |
| &nbsp;&nbsp;└── `fetchBithumbUnifiedCandles()` | 79 | 1,773 |
| **`static\chart_data.js`** | **591** | **14,684** |
| &nbsp;&nbsp;├── `fetchCandlesSmart()` | 149 | 3,560 |
| &nbsp;&nbsp;├── `fetchPaginated()` | 30 | 510 |
| &nbsp;&nbsp;├── `mapTime()` | 25 | 684 |
| &nbsp;&nbsp;├── `clearChartData()` | 27 | 615 |
| &nbsp;&nbsp;├── `switchKimchiSub()` | 28 | 873 |
| &nbsp;&nbsp;├── `loadMoreHistory()` | 310 | 7,800 |
| &nbsp;&nbsp;├── `getGroupTime()` | 16 | 555 |
| &nbsp;&nbsp;└── `getSubKey()` | 3 | 86 |
| **`static\chart_data_kimchi.js`** | **144** | **4,882** |
| &nbsp;&nbsp;├── `resampleSubCandles()` | 45 | 1,899 |
| &nbsp;&nbsp;├── `getTs()` | 7 | 321 |
| &nbsp;&nbsp;├── `getO()` | 33 | 1,331 |
| &nbsp;&nbsp;├── `getH()` | 32 | 1,207 |
| &nbsp;&nbsp;├── `getL()` | 31 | 1,058 |
| &nbsp;&nbsp;├── `getC()` | 30 | 913 |
| &nbsp;&nbsp;├── `getV()` | 29 | 760 |
| &nbsp;&nbsp;├── `calculateKimchiData()` | 97 | 2,894 |
| &nbsp;&nbsp;├── `getSubTime()` | 14 | 459 |
| &nbsp;&nbsp;└── `getSubClose()` | 11 | 352 |
| **`static\chart_debug_monitor.js`** | **440** | **11,357** |
| &nbsp;&nbsp;├── `logDiagnostic()` | 16 | 332 |
| &nbsp;&nbsp;├── `updateUI()` | 113 | 4,224 |
| &nbsp;&nbsp;├── `wrapSeriesInstance()` | 144 | 2,632 |
| &nbsp;&nbsp;└── `initializeHook()` | 62 | 1,765 |
| **`static\chart_draw.js`** | **827** | **19,460** |
| &nbsp;&nbsp;├── `renderFn()` | 150 | 3,325 |
| &nbsp;&nbsp;├── `deleteDrawing()` | 32 | 759 |
| &nbsp;&nbsp;├── `updateFloatingDeleteButton()` | 92 | 2,533 |
| &nbsp;&nbsp;├── `getDistanceToSegment()` | 9 | 250 |
| &nbsp;&nbsp;├── `findHitDrawing()` | 104 | 2,047 |
| &nbsp;&nbsp;├── `initDrawingEvents()` | 234 | 5,772 |
| &nbsp;&nbsp;├── `endDrag()` | 28 | 399 |
| &nbsp;&nbsp;├── `selectDrawingTool()` | 52 | 1,107 |
| &nbsp;&nbsp;└── `initDrawingToolbar()` | 5 | 106 |
| **`static\chart_fetch.js`** | **630** | **17,050** |
| &nbsp;&nbsp;├── `fetchHistory()` | 617 | 16,618 |
| &nbsp;&nbsp;└── `doFit()` | 8 | 411 |
| **`static\chart_history_helper.js`** | **137** | **4,558** |
| &nbsp;&nbsp;├── `findRowInfo()` | 64 | 2,517 |
| &nbsp;&nbsp;└── `determineListingDate()` | 70 | 1,907 |
| **`static\chart_history_kimchi.js`** | **600** | **16,178** |
| &nbsp;&nbsp;├── `getExchangeLoadingTheme()` | 31 | 790 |
| &nbsp;&nbsp;├── `showKimchiLoading()` | 16 | 707 |
| &nbsp;&nbsp;├── `hideKimchiLoading()` | 14 | 378 |
| &nbsp;&nbsp;├── `updateKimchiComparisonUI()` | 70 | 1,300 |
| &nbsp;&nbsp;├── `toggleKimchiComparison()` | 41 | 986 |
| &nbsp;&nbsp;└── `lazyRenderKimchiData()` | 412 | 11,339 |
| **`static\chart_layout.js`** | **163** | **4,140** |
| &nbsp;&nbsp;├── `togglePane()` | 4 | 110 |
| &nbsp;&nbsp;├── `toggleVolFallback()` | 10 | 205 |
| &nbsp;&nbsp;├── `applyChartLayout()` | 106 | 2,585 |
| &nbsp;&nbsp;├── `initResizers()` | 27 | 780 |
| &nbsp;&nbsp;└── `startDrag()` | 4 | 86 |
| **`static\chart_measure.js`** | **360** | **9,163** |
| &nbsp;&nbsp;├── `renderFn()` | 83 | 2,554 |
| &nbsp;&nbsp;├── `stopMeasuring()` | 27 | 582 |
| &nbsp;&nbsp;├── `setupMeasureTool()` | 14 | 577 |
| &nbsp;&nbsp;├── `toggleMeasureTool()` | 34 | 588 |
| &nbsp;&nbsp;└── `initMeasureEvents()` | 151 | 3,767 |
| **`static\chart_utils.js`** | **986** | **25,749** |
| &nbsp;&nbsp;├── `getUnixSeconds()` | 12 | 268 |
| &nbsp;&nbsp;├── `getNextBarTime()` | 30 | 655 |
| &nbsp;&nbsp;├── `ensureSafeUnixSeconds()` | 11 | 243 |
| &nbsp;&nbsp;├── `resetChartScale()` | 54 | 1,265 |
| &nbsp;&nbsp;├── `formatSmartPrice()` | 94 | 2,455 |
| &nbsp;&nbsp;├── `formatCrosshairPrice()` | 6 | 146 |
| &nbsp;&nbsp;├── `formatVolumeDollar()` | 7 | 255 |
| &nbsp;&nbsp;├── `formatVolumeKRW()` | 7 | 249 |
| &nbsp;&nbsp;├── `updateLegend()` | 200 | 5,626 |
| &nbsp;&nbsp;├── `safeFormat()` | 4 | 130 |
| &nbsp;&nbsp;├── `updateStatus()` | 58 | 1,620 |
| &nbsp;&nbsp;├── `autoFit()` | 63 | 1,686 |
| &nbsp;&nbsp;├── `calculateTimeRemaining()` | 48 | 1,109 |
| &nbsp;&nbsp;├── `getMultiplier()` | 9 | 221 |
| &nbsp;&nbsp;├── `getPureBase()` | 4 | 110 |
| &nbsp;&nbsp;├── `getKimchiColor()` | 10 | 276 |
| &nbsp;&nbsp;├── `toggleCountdown()` | 29 | 644 |
| &nbsp;&nbsp;├── `toggleOhlc()` | 37 | 771 |
| &nbsp;&nbsp;├── `updateRealtimeCountdown()` | 62 | 1,991 |
| &nbsp;&nbsp;├── `toggleCrosshairPct()` | 34 | 725 |
| &nbsp;&nbsp;├── `updateTabTitleManager()` | 51 | 1,513 |
| &nbsp;&nbsp;├── `getLocalKrwPrecision()` | 8 | 148 |
| &nbsp;&nbsp;├── `sanitizeChartData()` | 94 | 1,884 |
| &nbsp;&nbsp;├── `getTimeVal()` | 7 | 141 |
| &nbsp;&nbsp;├── `rebuildMainDataMap()` | 9 | 175 |
| &nbsp;&nbsp;├── `rebuildVolumeDataMap()` | 9 | 185 |
| &nbsp;&nbsp;└── `rebuildKimchiDataMap()` | 9 | 185 |
| **`static\feed_binance_futures.js`** | **111** | **3,425** |
| &nbsp;&nbsp;├── `startBinanceFuturesFeed()` | 56 | 1,637 |
| &nbsp;&nbsp;└── `initBinanceFuturesSniperSocket()` | 51 | 1,602 |
| **`static\feed_binance_spot.js`** | **103** | **2,849** |
| &nbsp;&nbsp;├── `startBinanceSpotFeed()` | 48 | 1,263 |
| &nbsp;&nbsp;└── `initBinanceSniperSocket()` | 51 | 1,429 |
| **`static\feed_bithumb.js`** | **61** | **1,781** |
| &nbsp;&nbsp;└── `startBithumbFeed()` | 59 | 1,727 |
| **`static\feed_bybit_futures.js`** | **57** | **1,802** |
| &nbsp;&nbsp;└── `startBybitFuturesFeed()` | 54 | 1,682 |
| **`static\feed_bybit_spot.js`** | **56** | **1,643** |
| &nbsp;&nbsp;└── `startBybitSpotFeed()` | 53 | 1,529 |
| **`static\feed_upbit.js`** | **112** | **3,426** |
| &nbsp;&nbsp;├── `startUpbitFeed()` | 58 | 1,733 |
| &nbsp;&nbsp;└── `initUpbitSniperSocket()` | 50 | 1,561 |
| **`static\lightweight-charts.standalone.production.js`** | **1** | **192,340** |
| **`static\lwc_error_tracker.js`** | **209** | **4,157** |
| &nbsp;&nbsp;├── `initTracker()` | 180 | 3,686 |
| &nbsp;&nbsp;├── `requestAnimationFrame()` | 20 | 331 |
| &nbsp;&nbsp;└── `wrapSeries()` | 74 | 1,159 |
| **`static\orderbook.js`** | **376** | **10,629** |
| &nbsp;&nbsp;├── `initOrderbookDOM()` | 35 | 1,930 |
| &nbsp;&nbsp;├── `toggleOrderbook()` | 20 | 578 |
| &nbsp;&nbsp;├── `changeOrderbookPrecision()` | 12 | 293 |
| &nbsp;&nbsp;├── `resetOrderbookPrecision()` | 4 | 87 |
| &nbsp;&nbsp;├── `stopOrderbookStream()` | 11 | 185 |
| &nbsp;&nbsp;├── `startOrderbookStream()` | 165 | 3,979 |
| &nbsp;&nbsp;├── `scheduleRender()` | 15 | 313 |
| &nbsp;&nbsp;├── `renderOrderbook()` | 93 | 2,681 |
| &nbsp;&nbsp;├── `groupData()` | 23 | 526 |
| &nbsp;&nbsp;└── `formatVol()` | 6 | 158 |
| **`static\pixi.min.js`** | **911** | **416,351** |
| **`static\pretendard.css`** | **7** | **162** |
| **`static\quickview.js`** | **1053** | **29,626** |
| &nbsp;&nbsp;├── `initQuickView()` | 41 | 1,400 |
| &nbsp;&nbsp;├── `destroyQuickView()` | 34 | 772 |
| &nbsp;&nbsp;├── `resolveTopAssets()` | 31 | 973 |
| &nbsp;&nbsp;├── `resolveAssetExchange()` | 25 | 849 |
| &nbsp;&nbsp;├── `rebuildQuickViewCharts()` | 86 | 2,703 |
| &nbsp;&nbsp;├── `initSingleQuickViewChart()` | 155 | 3,909 |
| &nbsp;&nbsp;├── `updateChartsAxisVisibility()` | 31 | 706 |
| &nbsp;&nbsp;├── `setQuickViewFocus()` | 15 | 385 |
| &nbsp;&nbsp;├── `renderOverlapLegend()` | 62 | 1,819 |
| &nbsp;&nbsp;├── `connectQuickViewSockets()` | 146 | 3,762 |
| &nbsp;&nbsp;├── `handleBinanceWsMessage()` | 54 | 1,317 |
| &nbsp;&nbsp;├── `disconnectQuickViewSockets()` | 29 | 674 |
| &nbsp;&nbsp;├── `updateLiveHeaderPrice()` | 38 | 1,373 |
| &nbsp;&nbsp;├── `setQuickViewLayout()` | 92 | 2,579 |
| &nbsp;&nbsp;├── `changeQuickViewSort()` | 17 | 484 |
| &nbsp;&nbsp;├── `changeQuickViewTF()` | 16 | 457 |
| &nbsp;&nbsp;├── `changeQuickViewPage()` | 9 | 314 |
| &nbsp;&nbsp;├── `selectQuickViewInitSort()` | 8 | 224 |
| &nbsp;&nbsp;├── `triggerResizeQuickView()` | 23 | 508 |
| &nbsp;&nbsp;├── `resetQuickView()` | 16 | 423 |
| &nbsp;&nbsp;├── `closeQuickViewModal()` | 8 | 183 |
| &nbsp;&nbsp;├── `toggleQuickViewCandleColor()` | 15 | 624 |
| &nbsp;&nbsp;├── `setQuickViewBase()` | 21 | 634 |
| &nbsp;&nbsp;├── `resetQuickViewChartsScale()` | 9 | 136 |
| &nbsp;&nbsp;├── `updateLayoutToggleUI()` | 21 | 923 |
| &nbsp;&nbsp;└── `updateQuickViewTheme()` | 48 | 1,049 |
| **`static\sim_engine.js`** | **95** | **3,058** |
| &nbsp;&nbsp;├── `changeDir()` | 34 | 1,157 |
| &nbsp;&nbsp;├── `addCandle()` | 9 | 307 |
| &nbsp;&nbsp;├── `undoLast()` | 10 | 362 |
| &nbsp;&nbsp;├── `getNext()` | 27 | 867 |
| &nbsp;&nbsp;└── `updatePreview()` | 8 | 154 |
| **`static\start.js`** | **1278** | **36,820** |
| &nbsp;&nbsp;├── `get3DTransform()` | 14 | 595 |
| &nbsp;&nbsp;├── `getShadowTransform()` | 3 | 80 |
| &nbsp;&nbsp;├── `getStartScreenHTML()` | 334 | 10,356 |
| &nbsp;&nbsp;├── `maskApiKey()` | 9 | 189 |
| &nbsp;&nbsp;├── `initPixiBackground()` | 51 | 1,191 |
| &nbsp;&nbsp;├── `initStartQuickViewPreview()` | 182 | 6,172 |
| &nbsp;&nbsp;├── `setStartOverlapFocus()` | 28 | 635 |
| &nbsp;&nbsp;├── `loadStartPreviewKlines()` | 45 | 1,195 |
| &nbsp;&nbsp;├── `startStartPreviewWebSocket()` | 62 | 1,401 |
| &nbsp;&nbsp;├── `applyStartCandleTheme()` | 30 | 636 |
| &nbsp;&nbsp;├── `switchStartPreviewTF()` | 10 | 340 |
| &nbsp;&nbsp;├── `resetAndStartProgressBar()` | 13 | 357 |
| &nbsp;&nbsp;├── `toggleStartQuickViewLayout()` | 54 | 2,088 |
| &nbsp;&nbsp;├── `resizeStartQuickViewCharts()` | 20 | 680 |
| &nbsp;&nbsp;├── `destroyStartQuickViewPreview()` | 31 | 466 |
| &nbsp;&nbsp;├── `initStartScreen()` | 130 | 3,402 |
| &nbsp;&nbsp;├── `updateClearBtnVisibility()` | 23 | 432 |
| &nbsp;&nbsp;├── `saveAndStart()` | 54 | 1,107 |
| &nbsp;&nbsp;├── `skipAndStart()` | 18 | 449 |
| &nbsp;&nbsp;├── `hideStartScreen()` | 29 | 650 |
| &nbsp;&nbsp;└── `showStartScreen()` | 74 | 2,270 |
| **`static\stream.js`** | **467** | **13,551** |
| &nbsp;&nbsp;├── `syncRowPrioritizedMetrics()` | 189 | 5,116 |
| &nbsp;&nbsp;├── `calcKimchi()` | 61 | 2,124 |
| &nbsp;&nbsp;└── `initAllExchangeFeeds()` | 4 | 74 |
| **`static\stream_global.js`** | **388** | **15,901** |
| &nbsp;&nbsp;├── `startRealtimeCandle()` | 377 | 15,448 |
| &nbsp;&nbsp;├── `getWsId()` | 67 | 2,214 |
| &nbsp;&nbsp;├── `broadcastCandleUpdate()` | 57 | 1,920 |
| &nbsp;&nbsp;├── `handleBinanceMessage()` | 95 | 3,999 |
| &nbsp;&nbsp;└── `handleBybitMessage()` | 60 | 2,397 |
| **`static\stream_korea.js`** | **420** | **14,867** |
| &nbsp;&nbsp;├── `getPriceForExchange()` | 35 | 1,458 |
| &nbsp;&nbsp;├── `updateRealtimeKimchi()` | 206 | 6,877 |
| &nbsp;&nbsp;├── `isTimeValid()` | 16 | 411 |
| &nbsp;&nbsp;├── `updateRealtimeKimchiThrottled()` | 27 | 826 |
| &nbsp;&nbsp;├── `getUpbitMessageHandler()` | 77 | 2,936 |
| &nbsp;&nbsp;└── `getBithumbMessageHandler()` | 64 | 2,327 |
| **`static\stream_render.js`** | **112** | **3,137** |
| &nbsp;&nbsp;├── `renderRealtimeUpdate()` | 84 | 2,408 |
| &nbsp;&nbsp;└── `restoreVolumeDataSterilized()` | 26 | 632 |
| **`static\stream_table.js`** | **584** | **18,194** |
| &nbsp;&nbsp;├── `initSniperSocket()` | 11 | 308 |
| &nbsp;&nbsp;├── `syncSniperSubscriptions()` | 100 | 3,036 |
| &nbsp;&nbsp;├── `getNextId()` | 36 | 1,441 |
| &nbsp;&nbsp;├── `refreshSniperTarget()` | 4 | 175 |
| &nbsp;&nbsp;├── `calculateRowKimchi()` | 75 | 2,139 |
| &nbsp;&nbsp;└── `renderRealtimeRow()` | 378 | 11,999 |
| **`static\stream_utils.js`** | **34** | **1,005** |
| &nbsp;&nbsp;├── `getNormalizedTime()` | 19 | 650 |
| &nbsp;&nbsp;└── `isTimeValid()` | 14 | 324 |
| **`static\sw.js`** | **24** | **494** |
| **`static\sweetalert2@11.js`** | **2** | **77,345** |
| **`static\table.js`** | **145** | **3,875** |
| **`static\table_api.js`** | **387** | **10,186** |
| &nbsp;&nbsp;├── `processTableData()` | 136 | 3,363 |
| &nbsp;&nbsp;├── `loadTableData()` | 90 | 2,220 |
| &nbsp;&nbsp;└── `loadTableDataSilent()` | 158 | 4,490 |
| **`static\table_filter.js`** | **1119** | **35,608** |
| &nbsp;&nbsp;├── `isStockCoin()` | 7 | 249 |
| &nbsp;&nbsp;├── `getFilteredData()` | 220 | 7,400 |
| &nbsp;&nbsp;├── `getScore()` | 12 | 457 |
| &nbsp;&nbsp;├── `checkMatch()` | 14 | 923 |
| &nbsp;&nbsp;├── `switchTab()` | 27 | 707 |
| &nbsp;&nbsp;├── `switchFilter()` | 55 | 1,529 |
| &nbsp;&nbsp;├── `updateUI()` | 13 | 350 |
| &nbsp;&nbsp;├── `switchView()` | 33 | 1,206 |
| &nbsp;&nbsp;├── `toggleCurrency()` | 22 | 650 |
| &nbsp;&nbsp;├── `toggleSmallCap()` | 35 | 686 |
| &nbsp;&nbsp;├── `maskApiKey()` | 9 | 195 |
| &nbsp;&nbsp;├── `openSettingsModal()` | 22 | 608 |
| &nbsp;&nbsp;├── `closeSettingsModal()` | 6 | 127 |
| &nbsp;&nbsp;├── `saveSettings()` | 22 | 575 |
| &nbsp;&nbsp;├── `togglePasswordVisibility()` | 15 | 414 |
| &nbsp;&nbsp;├── `clearCmcKey()` | 8 | 152 |
| &nbsp;&nbsp;├── `toggleExchFilter()` | 10 | 328 |
| &nbsp;&nbsp;├── `updateExchFilterUI()` | 154 | 6,387 |
| &nbsp;&nbsp;├── `switchExchFilterMode()` | 9 | 270 |
| &nbsp;&nbsp;├── `toggleExchExclude()` | 11 | 264 |
| &nbsp;&nbsp;├── `resetExchFilters()` | 10 | 267 |
| &nbsp;&nbsp;├── `selectExchPreset()` | 34 | 761 |
| &nbsp;&nbsp;├── `saveCurrentPreset()` | 28 | 598 |
| &nbsp;&nbsp;├── `deleteCurrentPreset()` | 32 | 681 |
| &nbsp;&nbsp;├── `updateFavoritesCount()` | 8 | 499 |
| &nbsp;&nbsp;├── `sliderToMcap()` | 5 | 94 |
| &nbsp;&nbsp;├── `mcapToSlider()` | 5 | 99 |
| &nbsp;&nbsp;├── `sliderToVol()` | 5 | 92 |
| &nbsp;&nbsp;├── `volToSlider()` | 5 | 106 |
| &nbsp;&nbsp;├── `formatFilterValue()` | 14 | 391 |
| &nbsp;&nbsp;├── `formatKoreanMoney()` | 18 | 379 |
| &nbsp;&nbsp;├── `updateCustomFilterUI()` | 58 | 2,268 |
| &nbsp;&nbsp;├── `toggleCustomFilter()` | 67 | 2,474 |
| &nbsp;&nbsp;├── `setVolSource()` | 21 | 714 |
| &nbsp;&nbsp;├── `applyCustomFilter()` | 10 | 290 |
| &nbsp;&nbsp;├── `resetCustomFilter()` | 31 | 1,055 |
| &nbsp;&nbsp;└── `setupTrackClick()` | 24 | 809 |
| **`static\table_render.js`** | **1592** | **49,984** |
| &nbsp;&nbsp;├── `getOrCreateGlobalCautionTooltip()` | 10 | 541 |
| &nbsp;&nbsp;├── `getWarningBadgeHtml()` | 15 | 665 |
| &nbsp;&nbsp;├── `getListingDate()` | 27 | 667 |
| &nbsp;&nbsp;├── `formatListingDateWithExchange()` | 31 | 955 |
| &nbsp;&nbsp;├── `createRowElement()` | 13 | 428 |
| &nbsp;&nbsp;├── `updateRowStaticHTML()` | 226 | 9,051 |
| &nbsp;&nbsp;├── `updateRowDynamicHTML()` | 7 | 239 |
| &nbsp;&nbsp;├── `updateRowInnerHTML()` | 4 | 108 |
| &nbsp;&nbsp;├── `updateBoundaryClass()` | 22 | 561 |
| &nbsp;&nbsp;├── `renderTable()` | 323 | 9,176 |
| &nbsp;&nbsp;├── `updateVisibleSymbols()` | 2 | 38 |
| &nbsp;&nbsp;├── `applySelectedHighlight()` | 21 | 514 |
| &nbsp;&nbsp;├── `initInfiniteScroll()` | 25 | 519 |
| &nbsp;&nbsp;├── `toggleFavorite()` | 83 | 2,293 |
| &nbsp;&nbsp;├── `commitFavoriteChange()` | 30 | 1,056 |
| &nbsp;&nbsp;├── `cancelFavoriteChange()` | 9 | 297 |
| &nbsp;&nbsp;├── `confirmFavoriteChange()` | 4 | 110 |
| &nbsp;&nbsp;├── `updateProgressBar()` | 36 | 832 |
| &nbsp;&nbsp;├── `clearAllPendingFavActions()` | 12 | 321 |
| &nbsp;&nbsp;└── `applyPriceFlash()` | 23 | 677 |
| **`static\table_sort.js`** | **196** | **4,675** |
| &nbsp;&nbsp;├── `sortTable()` | 41 | 1,048 |
| &nbsp;&nbsp;├── `simpleSortData()` | 134 | 3,102 |
| &nbsp;&nbsp;└── `applyRealtimeSort()` | 12 | 294 |
| **`static\ui_control.js`** | **1531** | **46,087** |
| &nbsp;&nbsp;├── `toggleTheme()` | 33 | 1,102 |
| &nbsp;&nbsp;├── `toggleSidebar()` | 18 | 533 |
| &nbsp;&nbsp;├── `switchViewMode()` | 48 | 1,387 |
| &nbsp;&nbsp;├── `switchMobileView()` | 47 | 1,611 |
| &nbsp;&nbsp;├── `showMobileChart()` | 35 | 1,249 |
| &nbsp;&nbsp;├── `closeMobileChart()` | 20 | 734 |
| &nbsp;&nbsp;├── `switchMobileTab()` | 42 | 1,221 |
| &nbsp;&nbsp;├── `switchChartTab()` | 21 | 517 |
| &nbsp;&nbsp;├── `executeTabSwitch()` | 55 | 1,779 |
| &nbsp;&nbsp;├── `togglePanelSwap()` | 47 | 1,652 |
| &nbsp;&nbsp;├── `showOnboardingModal()` | 15 | 495 |
| &nbsp;&nbsp;├── `closeOnboardingModal()` | 17 | 571 |
| &nbsp;&nbsp;├── `toggleRightDomBlock()` | 85 | 2,484 |
| &nbsp;&nbsp;├── `toggleChartMouseEventBlock()` | 11 | 334 |
| &nbsp;&nbsp;├── `toggleLeftDomBlock()` | 52 | 1,485 |
| &nbsp;&nbsp;├── `toggleTableUpdateBlock()` | 3 | 78 |
| &nbsp;&nbsp;├── `toggleChartDomBlock()` | 3 | 66 |
| &nbsp;&nbsp;├── `toggleOrderbookBlock()` | 8 | 296 |
| &nbsp;&nbsp;├── `toggleSortBlock()` | 3 | 58 |
| &nbsp;&nbsp;├── `toggleKimchiBlock()` | 40 | 1,074 |
| &nbsp;&nbsp;├── `toggleLegendBlock()` | 3 | 62 |
| &nbsp;&nbsp;├── `toggleResizeBlock()` | 3 | 67 |
| &nbsp;&nbsp;├── `toggleTabScrollBlock()` | 3 | 73 |
| &nbsp;&nbsp;├── `toggleRadarBatchBlock()` | 3 | 70 |
| &nbsp;&nbsp;├── `toggleDynamicHtmlBlock()` | 3 | 75 |
| &nbsp;&nbsp;├── `setAggTradeInterval()` | 18 | 499 |
| &nbsp;&nbsp;├── `copyPerformanceStats()` | 39 | 1,258 |
| &nbsp;&nbsp;├── `toggleTabSearch()` | 41 | 1,050 |
| &nbsp;&nbsp;├── `clearSearch()` | 11 | 226 |
| &nbsp;&nbsp;├── `searchSymbols()` | 40 | 846 |
| &nbsp;&nbsp;├── `runSearch()` | 7 | 125 |
| &nbsp;&nbsp;├── `getOrCreateRecentSearchDropdown()` | 13 | 388 |
| &nbsp;&nbsp;├── `getRecentSearches()` | 10 | 193 |
| &nbsp;&nbsp;├── `addRecentSearch()` | 11 | 305 |
| &nbsp;&nbsp;├── `removeRecentSearch()` | 12 | 284 |
| &nbsp;&nbsp;├── `clearAllRecentSearches()` | 10 | 195 |
| &nbsp;&nbsp;├── `getActiveSearchInput()` | 9 | 264 |
| &nbsp;&nbsp;├── `showRecentSearchChips()` | 47 | 2,010 |
| &nbsp;&nbsp;├── `hideRecentSearchChips()` | 7 | 168 |
| &nbsp;&nbsp;├── `renderRecentSearchChips()` | 6 | 184 |
| &nbsp;&nbsp;├── `setTF()` | 23 | 548 |
| &nbsp;&nbsp;├── `executeSetTF()` | 18 | 539 |
| &nbsp;&nbsp;├── `toggleLogScale()` | 62 | 1,859 |
| &nbsp;&nbsp;├── `moveTabSlider()` | 22 | 750 |
| &nbsp;&nbsp;├── `renderTimeframeButtons()` | 123 | 3,458 |
| &nbsp;&nbsp;├── `checkLayoutOverlap()` | 29 | 822 |
| &nbsp;&nbsp;├── `adjustNoticeFontSizes()` | 32 | 677 |
| &nbsp;&nbsp;├── `getVisibleTfs()` | 14 | 267 |
| &nbsp;&nbsp;├── `saveVisibleTfs()` | 4 | 139 |
| &nbsp;&nbsp;├── `renderTimeframeButtons()` | 25 | 787 |
| &nbsp;&nbsp;├── `toggleTfSettings()` | 21 | 672 |
| &nbsp;&nbsp;├── `renderTfCheckboxList()` | 36 | 1,381 |
| &nbsp;&nbsp;├── `applyTfSettings()` | 13 | 349 |
| &nbsp;&nbsp;├── `syncCheckboxesFromStore()` | 22 | 934 |
| &nbsp;&nbsp;└── `check()` | 4 | 83 |
| **`static\ui_selection.js`** | **462** | **13,272** |
| &nbsp;&nbsp;├── `selectSymbol()` | 360 | 10,170 |
| &nbsp;&nbsp;└── `updateExchangeBadges()` | 96 | 2,825 |
| **`static\z_style.css`** | **1080** | **21,723** |
| **`static\z_style.min.css`** | **1** | **99,581** |
| **`static\_main.js`** | **1003** | **26,490** |
| &nbsp;&nbsp;├── `getKrwPrecision()` | 8 | 163 |
| &nbsp;&nbsp;├── `restoreSavedUserSettings()` | 56 | 1,755 |
| &nbsp;&nbsp;├── `initDashboardEngine()` | 27 | 750 |
| &nbsp;&nbsp;├── `handleHistoryNavigation()` | 6 | 165 |
| &nbsp;&nbsp;├── `setupSliderEvents()` | 18 | 462 |
| &nbsp;&nbsp;├── `setupButtonEvents()` | 20 | 488 |
| &nbsp;&nbsp;├── `setupSearchNavigation()` | 56 | 1,425 |
| &nbsp;&nbsp;├── `resetActiveIndex()` | 8 | 175 |
| &nbsp;&nbsp;├── `updateHighlight()` | 12 | 267 |
| &nbsp;&nbsp;├── `toggleHeaderTop()` | 43 | 1,038 |
| &nbsp;&nbsp;└── `scheduleDailyReset()` | 45 | 1,283 |
| **`static\_market_rules.js`** | **194** | **5,498** |
| &nbsp;&nbsp;├── `isFuturesCoin()` | 10 | 234 |
| &nbsp;&nbsp;├── `getRowExchangeMeta()` | 39 | 901 |
| &nbsp;&nbsp;├── `getRowKimchiGlobalPrice()` | 28 | 1,174 |
| &nbsp;&nbsp;├── `getRowDisplayMetrics()` | 90 | 2,365 |
| &nbsp;&nbsp;├── `getDisplayTickerHtml()` | 6 | 235 |
| &nbsp;&nbsp;└── `getChartDefaultMarket()` | 11 | 371 |
| **`static\_store.js`** | **325** | **8,341** |
| **`templates\index.html`** | **1920** | **88,589** |
