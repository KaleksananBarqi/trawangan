import { THEME_PRESETS, resolveEffectiveVolumeColors } from '../constants/themes';
import type { ThemePresetId } from '../types/market';

// Katalog Preset Indikator Pine Script v5 & v6 Resmi untuk Trawangan

export interface IndicatorPreset {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Signals' | 'Volume' | 'Profile';
  description: string;
  overlay: boolean;
  sourceCode: string;
}

/**
 * Memeriksa apakah judul indikator merepresentasikan indikator Volume resmi
 */
export function isVolumeIndicator(title?: string): boolean {
  if (!title) return false;
  const t = title.trim().toLowerCase();
  return t === 'volume' || t === 'volume (with 20 sma)' || t === 'vol';
}

/**
 * Menghasilkan kode Pine Script untuk indikator Volume yang diselaraskan
 * secara dinamis dengan warna lilin dan aksen brand dari tema aktif.
 */
export function buildVolumePresetSource(
  themePresetId: ThemePresetId = 'signature',
  customColors?: { bullColor?: string; bearColor?: string }
): string {
  const { upColor, downColor, maColor } = resolveEffectiveVolumeColors(themePresetId, customColors);

  return `//@version=5
indicator("Volume", shorttitle="Vol", overlay=false, format=format.volume)

showMA = input.bool(true, "Show Volume MA", group="Volume Moving Average")
maLength = input.int(20, "MA Length", minval=1, group="Volume Moving Average")
upColor = input.color(${upColor}, "Up Color", group="Color Settings")
downColor = input.color(${downColor}, "Down Color", group="Color Settings")
maColor = input.color(${maColor}, "MA Color", group="Volume Moving Average")

volMA = ta.sma(volume, maLength)

barColor = close >= open ? upColor : downColor
plot(volume, "Volume", style=plot.style_columns, color=barColor)
plot(showMA ? volMA : na, "Volume MA", color=maColor, linewidth=2)
`;
}

export const INDICATOR_PRESETS: IndicatorPreset[] = [
  {
    id: 'rsi',
    name: 'Relative Strength Index (RSI)',
    category: 'Momentum',
    description: 'Mengukur kecepatan dan perubahan pergerakan harga dengan ambang overbought (70) dan oversold (30).',
    overlay: false,
    sourceCode: `//@version=5
indicator("Relative Strength Index", shorttitle="RSI", overlay=false)

len = input.int(14, minval=1, title="Length")
src = input.source(close, "Source")
up = ta.rma(math.max(ta.change(src), 0), len)
down = ta.rma(-math.min(ta.change(src), 0), len)
rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))

plot(rsi, "RSI", color=color.rgb(139, 92, 246), linewidth=2)
band1 = hline(70, "Overbought", color=color.gray, linestyle=hline.style_dashed)
band0 = hline(30, "Oversold", color=color.gray, linestyle=hline.style_dashed)
fill(band1, band0, color=color.rgb(139, 92, 246, 92), title="RSI Background")
`,
  },
  {
    id: 'macd',
    name: 'MACD (Moving Average Convergence Divergence)',
    category: 'Momentum',
    description: 'Indikator momentum pengikut tren yang menunjukkan hubungan antara dua rata-rata bergerak dari harga sekuritas.',
    overlay: false,
    sourceCode: `//@version=5
indicator("Moving Average Convergence Divergence", shorttitle="MACD", overlay=false)

fast_length = input.int(12, "Fast Length")
slow_length = input.int(26, "Slow Length")
signal_length = input.int(9, "Signal Smoothing")

fast_ma = ta.ema(close, fast_length)
slow_ma = ta.ema(close, slow_length)
macd = fast_ma - slow_ma
signal = ta.ema(macd, signal_length)
hist = macd - signal

plot(hist, title="Histogram", style=plot.style_columns, color=(hist >= 0 ? (hist[1] < hist ? #0ecb81 : #26a69a) : (hist[1] < hist ? #ef5350 : #f6465d)))
plot(macd, title="MACD", color=#00f2fe, linewidth=2)
plot(signal, title="Signal", color=#ff9800, linewidth=2)
hline(0, "Zero Line", color=color.gray, linestyle=hline.style_dotted)
`,
  },
  {
    id: 'bb',
    name: 'Bollinger Bands (BB)',
    category: 'Volatility',
    description: 'Pita volatilitas yang ditempatkan di atas dan di bawah moving average untuk mengidentifikasi kondisi ekspansi & kontraksi pasar.',
    overlay: true,
    sourceCode: `//@version=5
indicator("Bollinger Bands", shorttitle="BB", overlay=true)

length = input.int(20, minval=1, title="Length")
mult = input.float(2.0, minval=0.001, maxval=50, title="StdDev Multiplier")
src = input.source(close, title="Source")

basis = ta.sma(src, length)
dev = mult * ta.stdev(src, length)
upper = basis + dev
lower = basis - dev

p_basis = plot(basis, "Basis", color=#ff9800, linewidth=1)
p_upper = plot(upper, "Upper", color=#00f2fe, linewidth=1)
p_lower = plot(lower, "Lower", color=#00f2fe, linewidth=1)
fill(p_upper, p_lower, title="Background", color=color.rgb(0, 242, 254, 90))
`,
  },
  {
    id: 'ema-ribbon',
    name: 'Triple EMA Ribbon (20, 50, 200)',
    category: 'Trend',
    description: 'Tiga garis Exponential Moving Average untuk membaca arah tren jangka pendek, menengah, dan panjang sekaligus.',
    overlay: true,
    sourceCode: `//@version=5
indicator("Triple EMA Ribbon", shorttitle="EMA Ribbon", overlay=true)

len1 = input.int(20, "Fast EMA")
len2 = input.int(50, "Medium EMA")
len3 = input.int(200, "Slow EMA")

ema1 = ta.ema(close, len1)
ema2 = ta.ema(close, len2)
ema3 = ta.ema(close, len3)

plot(ema1, "EMA 20 (Fast)", color=#00f2fe, linewidth=2)
plot(ema2, "EMA 50 (Med)", color=#ffeb3b, linewidth=2)
plot(ema3, "EMA 200 (Slow)", color=#f6465d, linewidth=2)
`,
  },
  {
    id: 'supertrend',
    name: 'SuperTrend Signals',
    category: 'Signals',
    description: 'Detektor sinyal tren berbasis Average True Range (ATR) untuk mendeteksi perubahan arah breakout harga secara presisi.',
    overlay: true,
    sourceCode: `//@version=5
indicator("Supertrend Signals", shorttitle="Supertrend", overlay=true)

atrPeriod = input.int(10, "ATR Length")
factor = input.float(3.0, "Factor")

[supertrend, direction] = ta.supertrend(factor, atrPeriod)

bodyMiddle = plot((open + close) / 2, display=display.none)
upTrend = plot(direction < 0 ? supertrend : na, "Up Trend", color=#0ecb81, style=plot.style_linebr, linewidth=2)
downTrend = plot(direction > 0 ? supertrend : na, "Down Trend", color=#f6465d, style=plot.style_linebr, linewidth=2)

fill(bodyMiddle, upTrend, color.rgb(14, 203, 129, 90), fillgaps=false)
fill(bodyMiddle, downTrend, color.rgb(246, 70, 93, 90), fillgaps=false)
`,
  },
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price (VWAP)',
    category: 'Volume',
    description: 'Volume-weighted average price resmi TradingView v6 dengan multi-anchor (Session, Week, Month, Year), 3 set pita deviasi standar (+1σ, +2σ, +3σ), serta mode Standard Deviation dan Percentage.',
    overlay: true,
    sourceCode: `//@version=6
indicator(title="Volume-weighted average price", shorttitle="VWAP", overlay=true)

hideonDWM = input(false, title="Hide VWAP on 1D or Above", group="VWAP Settings", display=display.none)
anchor = input.string(defval="Session", title="Anchor Period", options=["Session", "Week", "Month", "Quarter", "Year", "Decade", "Century", "Earnings", "Dividends", "Splits"], group="VWAP Settings")
src = hlc3
offset = input.int(0, title="Offset", group="VWAP Settings", display=display.none)

BANDS_GROUP = "Bands Settings"
CALC_MODE_TOOLTIP = "Determines the units used to calculate the distance of the bands. When 'Percentage' is selected, a multiplier of 1 means 1%."
calcModeInput = input.string("Standard Deviation", "Bands Calculation Mode", options=["Standard Deviation", "Percentage"], group=BANDS_GROUP, tooltip=CALC_MODE_TOOLTIP, display=display.none)

showBand_1 = input(true, title="", group=BANDS_GROUP, inline="band_1", display=display.none)
bandMult_1 = input.float(1.0, title="Bands Multiplier #1", group=BANDS_GROUP, inline="band_1", step=0.5, minval=0, display=display.none)

showBand_2 = input(false, title="", group=BANDS_GROUP, inline="band_2", display=display.none)
bandMult_2 = input.float(2.0, title="Bands Multiplier #2", group=BANDS_GROUP, inline="band_2", step=0.5, minval=0, display=display.none)

showBand_3 = input(false, title="", group=BANDS_GROUP, inline="band_3", display=display.none)
bandMult_3 = input.float(3.0, title="Bands Multiplier #3", group=BANDS_GROUP, inline="band_3", step=0.5, minval=0, display=display.none)

cumVolume = ta.cum(volume)
if barstate.islast and cumVolume == 0
    runtime.error("No volume is provided by the data vendor.")

isNewPeriod = switch anchor
    "Earnings"  => 
        new_earnings_actual = request.earnings(syminfo.tickerid, earnings.actual, barmerge.gaps_on, barmerge.lookahead_on, ignore_invalid_symbol=true)
        new_earnings_standardized = request.earnings(syminfo.tickerid, earnings.standardized, barmerge.gaps_on, barmerge.lookahead_on, ignore_invalid_symbol=true)
        not na(new_earnings_actual) or not na(new_earnings_standardized)
    "Dividends" => 
        new_dividends = request.dividends(syminfo.tickerid, dividends.gross, barmerge.gaps_on, barmerge.lookahead_on, ignore_invalid_symbol=true)
        not na(new_dividends)
    "Splits"    => 
        new_split = request.splits(syminfo.tickerid, splits.denominator, barmerge.gaps_on, barmerge.lookahead_on, ignore_invalid_symbol=true)
        not na(new_split)
    "Session"   => timeframe.change("D")
    "Week"      => timeframe.change("W")
    "Month"     => timeframe.change("M")
    "Quarter"   => timeframe.change("3M")
    "Year"      => timeframe.change("12M")
    "Decade"    => timeframe.change("12M") and year % 10 == 0
    "Century"   => timeframe.change("12M") and year % 100 == 0
    => false

isEsdAnchor = anchor == "Earnings" or anchor == "Dividends" or anchor == "Splits"
if na(src[1]) and not isEsdAnchor
    isNewPeriod := true

float vwapValue = na
float upperBandValue1 = na
float lowerBandValue1 = na
float upperBandValue2 = na
float lowerBandValue2 = na
float upperBandValue3 = na
float lowerBandValue3 = na

if not (hideonDWM and timeframe.isdwm)
    [_vwap, _stdevUpper, _] = ta.vwap(src, isNewPeriod, 1)
    vwapValue := _vwap
    stdevAbs = _stdevUpper - _vwap
    bandBasis = calcModeInput == "Standard Deviation" ? stdevAbs : _vwap * 0.01
    upperBandValue1 := _vwap + bandBasis * bandMult_1
    lowerBandValue1 := _vwap - bandBasis * bandMult_1
    upperBandValue2 := _vwap + bandBasis * bandMult_2
    lowerBandValue2 := _vwap - bandBasis * bandMult_2
    upperBandValue3 := _vwap + bandBasis * bandMult_3
    lowerBandValue3 := _vwap - bandBasis * bandMult_3

plot(vwapValue, title="VWAP", color=#2962FF, offset=offset)

displayBand1 = showBand_1 ? display.all : display.none
upperBand_1 = plot(upperBandValue1, title="Upper Band #1", color=color.green, offset=offset, display=displayBand1, editable=showBand_1)
lowerBand_1 = plot(lowerBandValue1, title="Lower Band #1", color=color.green, offset=offset, display=displayBand1, editable=showBand_1)
fill(upperBand_1, lowerBand_1,       title="Bands Fill #1", color=color.new(color.green, 95),   display=displayBand1, editable=showBand_1)

displayBand2 = showBand_2 ? display.all : display.none
upperBand_2 = plot(upperBandValue2, title="Upper Band #2", color=color.olive, offset=offset, display=displayBand2, editable=showBand_2)
lowerBand_2 = plot(lowerBandValue2, title="Lower Band #2", color=color.olive, offset=offset, display=displayBand2, editable=showBand_2)
fill(upperBand_2, lowerBand_2,       title="Bands Fill #2", color=color.new(color.olive, 95),   display=displayBand2, editable=showBand_2)

displayBand3 = showBand_3 ? display.all : display.none
upperBand_3 = plot(upperBandValue3, title="Upper Band #3", color=color.teal, offset=offset, display=displayBand3, editable=showBand_3)
lowerBand_3 = plot(lowerBandValue3, title="Lower Band #3", color=color.teal, offset=offset, display=displayBand3, editable=showBand_3)
fill(upperBand_3, lowerBand_3,       title="Bands Fill #3", color=color.new(color.teal, 95),    display=displayBand3, editable=showBand_3)
`,
  },
  {
    id: 'volume',
    name: 'Volume (with 20 SMA)',
    category: 'Volume',
    description: 'Indikator volume perdagangan dengan pewarnaan kondisi lilin (bullish/bearish) dan garis penghalus rata-rata bergerak 20-periode.',
    overlay: false,
    sourceCode: `//@version=5
indicator("Volume", shorttitle="Vol", overlay=false, format=format.volume)

showMA = input.bool(true, "Show Volume MA", group="Volume Moving Average")
maLength = input.int(20, "MA Length", minval=1, group="Volume Moving Average")
upColor = input.color(#F7F7F7, "Up Color", group="Color Settings")
downColor = input.color(#FF69B4, "Down Color", group="Color Settings")
maColor = input.color(#FF69B4, "MA Color", group="Volume Moving Average")

volMA = ta.sma(volume, maLength)

barColor = close >= open ? upColor : downColor
plot(volume, "Volume", style=plot.style_columns, color=barColor)
plot(showMA ? volMA : na, "Volume MA", color=maColor, linewidth=2)
`,
  },
  {
    id: 'double-ema',
    name: 'Double EMA (13/21)',
    category: 'Trend',
    description: 'Dua Exponential Moving Average (EMA 13 & EMA 21) dengan pewarnaan area cloud dinamis untuk membaca arah tren jangka pendek.',
    overlay: true,
    sourceCode: `//@version=6
indicator(title="Double EMA", shorttitle="EMA 13/21", overlay=true)

// --- Input EMA 13 ---
grp1 = "EMA 13"
len1 = input.int(13, minval=1, title="Length", group=grp1)
src1 = input.source(close, title="Source", group=grp1)
col1 = input.color(color.blue, title="Color", group=grp1)

// --- Input EMA 21 ---
grp2 = "EMA 21"
len2 = input.int(21, minval=1, title="Length", group=grp2)
src2 = input.source(close, title="Source", group=grp2)
col2 = input.color(color.orange, title="Color", group=grp2)

// --- Pengaturan Visual Tambahan ---
grpVisual  = "Visual Tambahan"
showFill   = input.bool(true, title="Warnai Area Antara EMA (Cloud)", group=grpVisual)
opacityVal = input.int(45, title="Opasitas Fill (%)", minval=0, maxval=100, step=5, group=grpVisual)

// --- Kalkulasi EMA ---
ema13 = ta.ema(src1, len1)
ema21 = ta.ema(src2, len2)

// --- Plot Garis ---
p1 = plot(ema13, title="EMA 13", color=col1, linewidth=2)
p2 = plot(ema21, title="EMA 21", color=col2, linewidth=2)

// --- Fill Area ---
// Opasitas 45% diubah menjadi nilai transparansi Pine Script (100 - 45 = 55)
transpVal = 100 - opacityVal
fillColor = ema13 >= ema21 ? color.new(color.green, transpVal) : color.new(color.red, transpVal)
fill(p1, p2, color=showFill ? fillColor : na, title="EMA Trend Cloud")
`,
  },
  {
    id: 'key-levels',
    name: 'Key Levels (PDH/PDL, PWH/PWL, PMH/PML, Opens)',
    category: 'Profile',
    description: 'Menampilkan level harga kunci multi-timeframe (Previous Day/Week/Month High & Low serta Daily/Weekly/Monthly Open) lengkap dengan label di sisi kanan.',
    overlay: true,
    sourceCode: `//@version=6
indicator("Key Levels (PDH/PDL, PWH/PWL, PMH/PML, Opens)", overlay=true)

// ==========================================
// INPUTS - KEY LEVELS
// ==========================================
grp_kl = "KEY LEVELS"

showAll     = input.bool(true, "Tampilkan Semua Key Levels", group=grp_kl)
onlyToday   = input.bool(false, "Hanya Tampilkan di Hari Berjalan", tooltip="Jika mati, garis tampil di seluruh histori saat chart digeser.", group=grp_kl)
showLabels  = input.bool(true, "Tampilkan Label Teks", group=grp_kl)
labelOffset = input.int(6, "Jarak Label dari Ujung Kanan (Bar)", minval=1, maxval=50, tooltip="Menempatkan 1 label tepat di dekat candle terakhir agar tidak terpotong skala harga.", group=grp_kl)
lineWidth   = input.int(1, "Ketebalan Garis", minval=1, maxval=4, group=grp_kl)

// Warna Default: Abu-abu Semi-Transparan
defaultGray = color.new(#9598A1, 45)

// Checkbox & Warna
showPDH   = input.bool(true, "PDH (dashed)", inline="pdh", group=grp_kl)
colPDH    = input.color(defaultGray, "", inline="pdh", group=grp_kl)

showPDL   = input.bool(true, "PDL (dashed)", inline="pdl", group=grp_kl)
colPDL    = input.color(defaultGray, "", inline="pdl", group=grp_kl)

showPWH   = input.bool(true, "PWH (dashed)", inline="pwh", group=grp_kl)
colPWH    = input.color(defaultGray, "", inline="pwh", group=grp_kl)

showPWL   = input.bool(true, "PWL (dashed)", inline="pwl", group=grp_kl)
colPWL    = input.color(defaultGray, "", inline="pwl", group=grp_kl)

showPMH   = input.bool(true, "PMH (dashed)", inline="pmh", group=grp_kl)
colPMH    = input.color(defaultGray, "", inline="pmh", group=grp_kl)

showPML   = input.bool(true, "PML (dashed)", inline="pml", group=grp_kl)
colPML    = input.color(defaultGray, "", inline="pml", group=grp_kl)

showDOpen = input.bool(true, "Daily open (dotted)", inline="dopen", group=grp_kl)
colDOpen  = input.color(defaultGray, "", inline="dopen", group=grp_kl)

showWOpen = input.bool(true, "Weekly open (dotted)", inline="wopen", group=grp_kl)
colWOpen  = input.color(defaultGray, "", inline="wopen", group=grp_kl)

showMOpen = input.bool(true, "Monthly open (dotted)", inline="mopen", group=grp_kl)
colMOpen  = input.color(defaultGray, "", inline="mopen", group=grp_kl)

// ==========================================
// AMBIL DATA MULTI-TIMEFRAME (NON-REPAINT)
// ==========================================
[pdh, pdl] = request.security(syminfo.tickerid, "D", [high[1], low[1]], lookahead=barmerge.lookahead_on)
dOpen      = request.security(syminfo.tickerid, "D", open, lookahead=barmerge.lookahead_on)

[pwh, pwl] = request.security(syminfo.tickerid, "W", [high[1], low[1]], lookahead=barmerge.lookahead_on)
wOpen      = request.security(syminfo.tickerid, "W", open, lookahead=barmerge.lookahead_on)

[pmh, pml] = request.security(syminfo.tickerid, "M", [high[1], low[1]], lookahead=barmerge.lookahead_on)
mOpen      = request.security(syminfo.tickerid, "M", open, lookahead=barmerge.lookahead_on)

// ==========================================
// LOGIKA 1 LABEL DI SISI KANAN (TANPA last_bar_index)
// ==========================================
barMs       = (time - time[1]) > 0 ? (time - time[1]) : 60000
targetTime  = timenow - (labelOffset * barMs)
isRightText = bar_index > 0 and time >= targetTime and time[1] < targetTime

isToday = time("D") == timenow - (timenow % 86400000)
canPlot(bool cond) => showAll and cond and (not onlyToday or isToday)
lblCond(bool cond) => canPlot(cond) and showLabels and isRightText

// ==========================================
// PLOT GARIS NATIVE
// ==========================================
plot(canPlot(showPDH)   ? pdh   : na, "PDH",          color=colPDH,   linewidth=lineWidth, linestyle=plot.linestyle_dashed)
plot(canPlot(showPDL)   ? pdl   : na, "PDL",          color=colPDL,   linewidth=lineWidth, linestyle=plot.linestyle_dashed)
plot(canPlot(showPWH)   ? pwh   : na, "PWH",          color=colPWH,   linewidth=lineWidth, linestyle=plot.linestyle_dashed)
plot(canPlot(showPWL)   ? pwl   : na, "PWL",          color=colPWL,   linewidth=lineWidth, linestyle=plot.linestyle_dashed)
plot(canPlot(showPMH)   ? pmh   : na, "PMH",          color=colPMH,   linewidth=lineWidth, linestyle=plot.linestyle_dashed)
plot(canPlot(showPML)   ? pml   : na, "PML",          color=colPML,   linewidth=lineWidth, linestyle=plot.linestyle_dashed)
plot(canPlot(showDOpen) ? dOpen : na, "Daily Open",   color=colDOpen, linewidth=lineWidth, linestyle=plot.linestyle_dotted)
plot(canPlot(showWOpen) ? wOpen : na, "Weekly Open",  color=colWOpen, linewidth=lineWidth, linestyle=plot.linestyle_dotted)
plot(canPlot(showMOpen) ? mOpen : na, "Monthly Open", color=colMOpen, linewidth=lineWidth, linestyle=plot.linestyle_dotted)

// ==========================================
// 1 LABEL TEKS PER GARIS DI UJUNG KANAN
// ==========================================
plotchar(lblCond(showPDH)   ? pdh   : na, "Txt PDH",          char="·", location=location.absolute, color=colPDH,   text="PDH",          textcolor=colPDH,   size=size.tiny)
plotchar(lblCond(showPDL)   ? pdl   : na, "Txt PDL",          char="·", location=location.absolute, color=colPDL,   text="PDL",          textcolor=colPDL,   size=size.tiny)
plotchar(lblCond(showDOpen) ? dOpen : na, "Txt Daily Open",   char="·", location=location.absolute, color=colDOpen, text="Daily Open",   textcolor=colDOpen, size=size.tiny)

plotchar(lblCond(showPWH)   ? pwh   : na, "Txt PWH",          char="·", location=location.absolute, color=colPWH,   text="PWH",          textcolor=colPWH,   size=size.tiny)
plotchar(lblCond(showPWL)   ? pwl   : na, "Txt PWL",          char="·", location=location.absolute, color=colPWL,   text="PWL",          textcolor=colPWL,   size=size.tiny)
plotchar(lblCond(showWOpen) ? wOpen : na, "Txt Weekly Open",  char="·", location=location.absolute, color=colWOpen, text="Weekly Open",  textcolor=colWOpen, size=size.tiny)

plotchar(lblCond(showPMH)   ? pmh   : na, "Txt PMH",          char="·", location=location.absolute, color=colPMH,   text="PMH",          textcolor=colPMH,   size=size.tiny)
plotchar(lblCond(showPML)   ? pml   : na, "Txt PML",          char="·", location=location.absolute, color=colPML,   text="PML",          textcolor=colPML,   size=size.tiny)
plotchar(lblCond(showMOpen) ? mOpen : na, "Txt Monthly Open", char="·", location=location.absolute, color=colMOpen, text="Monthly Open", textcolor=colMOpen, size=size.tiny)
`,
  },
  {
    id: 'smc-luxalgo',
    name: 'Smart Money Concepts [LuxAlgo]',
    category: 'Signals',
    description: 'Struktur pasar Smart Money Concepts (BOS/CHoCH internal & swing), Order Blocks, Fair Value Gaps (FVG), Equal Highs/Lows, serta zona Premium/Discount.',
    overlay: true,
    sourceCode: `// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('Smart Money Concepts [LuxAlgo]', 'LuxAlgo - Smart Money Concepts', overlay = true, max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//CONSTANTS & STRINGS & INPUTS
//---------------------------------------------------------------------------------------------------------------------{
BULLISH_LEG                     = 1
BEARISH_LEG                     = 0

BULLISH                         = +1
BEARISH                         = -1

GREEN                           = #089981
RED                             = #F23645
BLUE                            = #2157f3
GRAY                            = #878b94
MONO_BULLISH                    = #b2b5be
MONO_BEARISH                    = #5d606b

HISTORICAL                      = 'Historical'
PRESENT                         = 'Present'

COLORED                         = 'Colored'
MONOCHROME                      = 'Monochrome'

ALL                             = 'All'
BOS                             = 'BOS'
CHOCH                           = 'CHoCH'

TINY                            = size.tiny
SMALL                           = size.small
NORMAL                          = size.normal

ATR                             = 'Atr'
RANGE                           = 'Cumulative Mean Range'

CLOSE                           = 'Close'
HIGHLOW                         = 'High/Low'

SOLID                           = '⎯⎯⎯'
DASHED                          = '----'
DOTTED                          = '····'

SMART_GROUP                     = 'Smart Money Concepts'
INTERNAL_GROUP                  = 'Real Time Internal Structure'
SWING_GROUP                     = 'Real Time Swing Structure'
BLOCKS_GROUP                    = 'Order Blocks'
EQUAL_GROUP                     = 'EQH/EQL'
GAPS_GROUP                      = 'Fair Value Gaps'
LEVELS_GROUP                    = 'Highs & Lows MTF'
ZONES_GROUP                     = 'Premium & Discount Zones'

modeTooltip                     = 'Allows to display historical Structure or only the recent ones'
styleTooltip                    = 'Indicator color theme'
showTrendTooltip                = 'Display additional candles with a color reflecting the current trend detected by structure'
showInternalsTooltip            = 'Display internal market structure'
internalFilterConfluenceTooltip = 'Filter non significant internal structure breakouts'
showStructureTooltip            = 'Display swing market Structure'
showSwingsTooltip               = 'Display swing point as labels on the chart'
showHighLowSwingsTooltip        = 'Highlight most recent strong and weak high/low points on the chart'
showInternalOrderBlocksTooltip  = 'Display internal order blocks on the chart\\n\\nNumber of internal order blocks to display on the chart'
showSwingOrderBlocksTooltip     = 'Display swing order blocks on the chart\\n\\nNumber of internal swing blocks to display on the chart'
orderBlockFilterTooltip         = 'Method used to filter out volatile order blocks \\n\\nIt is recommended to use the cumulative mean range method when a low amount of data is available'
orderBlockMitigationTooltip     = 'Select what values to use for order block mitigation'
showEqualHighsLowsTooltip       = 'Display equal highs and equal lows on the chart'
equalHighsLowsLengthTooltip     = 'Number of bars used to confirm equal highs and equal lows'
equalHighsLowsThresholdTooltip  = 'Sensitivity threshold in a range (0, 1) used for the detection of equal highs & lows\\n\\nLower values will return fewer but more pertinent results'
showFairValueGapsTooltip        = 'Display fair values gaps on the chart'
fairValueGapsThresholdTooltip   = 'Filter out non significant fair value gaps'
fairValueGapsTimeframeTooltip   = 'Fair value gaps timeframe'
fairValueGapsExtendTooltip      = 'Determine how many bars to extend the Fair Value Gap boxes on chart'
showPremiumDiscountZonesTooltip = 'Display premium, discount, and equilibrium zones on chart'

modeInput                       = input.string( HISTORICAL, 'Mode',                     group = SMART_GROUP,    tooltip = modeTooltip, options = [HISTORICAL, PRESENT])
styleInput                      = input.string( COLORED,    'Style',                    group = SMART_GROUP,    tooltip = styleTooltip,options = [COLORED, MONOCHROME])
showTrendInput                  = input(        false,      'Color Candles',            group = SMART_GROUP,    tooltip = showTrendTooltip)

showInternalsInput              = input(        true,       'Show Internal Structure',  group = INTERNAL_GROUP, tooltip = showInternalsTooltip)
showInternalBullInput           = input.string( ALL,        'Bullish Structure',        group = INTERNAL_GROUP, inline = 'ibull', options = [ALL,BOS,CHOCH])
internalBullColorInput          = input(        GREEN,      '',                         group = INTERNAL_GROUP, inline = 'ibull')
showInternalBearInput           = input.string( ALL,        'Bearish Structure' ,       group = INTERNAL_GROUP, inline = 'ibear', options = [ALL,BOS,CHOCH])
internalBearColorInput          = input(        RED,        '',                         group = INTERNAL_GROUP, inline = 'ibear')
internalFilterConfluenceInput   = input(        false,      'Confluence Filter',        group = INTERNAL_GROUP, tooltip = internalFilterConfluenceTooltip)
internalStructureSize           = input.string( TINY,       'Internal Label Size',      group = INTERNAL_GROUP, options = [TINY,SMALL,NORMAL])

showStructureInput              = input(        true,       'Show Swing Structure',     group = SWING_GROUP,    tooltip = showStructureTooltip)
showSwingBullInput              = input.string( ALL,        'Bullish Structure',        group = SWING_GROUP,    inline = 'bull',    options = [ALL,BOS,CHOCH])
swingBullColorInput             = input(        GREEN,      '',                         group = SWING_GROUP,    inline = 'bull')
showSwingBearInput              = input.string( ALL,        'Bearish Structure',        group = SWING_GROUP,    inline = 'bear',    options = [ALL,BOS,CHOCH])
swingBearColorInput             = input(        RED,        '',                         group = SWING_GROUP,    inline = 'bear')
swingStructureSize              = input.string( SMALL,      'Swing Label Size',         group = SWING_GROUP,    options = [TINY,SMALL,NORMAL])
showSwingsInput                 = input(        false,      'Show Swings Points',       group = SWING_GROUP,    tooltip = showSwingsTooltip,inline = 'swings')
swingsLengthInput               = input.int(    50,         '',                         group = SWING_GROUP,    minval = 10,                inline = 'swings')
showHighLowSwingsInput          = input(        true,       'Show Strong/Weak High/Low',group = SWING_GROUP,    tooltip = showHighLowSwingsTooltip)

showInternalOrderBlocksInput    = input(        true,       'Internal Order Blocks' ,   group = BLOCKS_GROUP,   tooltip = showInternalOrderBlocksTooltip,   inline = 'iob')
internalOrderBlocksSizeInput    = input.int(    5,          '',                         group = BLOCKS_GROUP,   minval = 1, maxval = 20,                    inline = 'iob')
showSwingOrderBlocksInput       = input(        false,      'Swing Order Blocks',       group = BLOCKS_GROUP,   tooltip = showSwingOrderBlocksTooltip,      inline = 'ob')
swingOrderBlocksSizeInput       = input.int(    5,          '',                         group = BLOCKS_GROUP,   minval = 1, maxval = 20,                    inline = 'ob') 
orderBlockFilterInput           = input.string( 'Atr',      'Order Block Filter',       group = BLOCKS_GROUP,   tooltip = orderBlockFilterTooltip,          options = [ATR, RANGE])
orderBlockMitigationInput       = input.string( HIGHLOW,    'Order Block Mitigation',   group = BLOCKS_GROUP,   tooltip = orderBlockMitigationTooltip,      options = [CLOSE,HIGHLOW])
internalBullishOrderBlockColor  = input.color(color.new(#3179f5, 80), 'Internal Bullish OB',    group = BLOCKS_GROUP)
internalBearishOrderBlockColor  = input.color(color.new(#f77c80, 80), 'Internal Bearish OB',    group = BLOCKS_GROUP)
swingBullishOrderBlockColor     = input.color(color.new(#1848cc, 80), 'Bullish OB',             group = BLOCKS_GROUP)
swingBearishOrderBlockColor     = input.color(color.new(#b22833, 80), 'Bearish OB',             group = BLOCKS_GROUP)

showEqualHighsLowsInput         = input(        true,       'Equal High/Low',           group = EQUAL_GROUP,    tooltip = showEqualHighsLowsTooltip)
equalHighsLowsLengthInput       = input.int(    3,          'Bars Confirmation',        group = EQUAL_GROUP,    tooltip = equalHighsLowsLengthTooltip,      minval = 1)
equalHighsLowsThresholdInput    = input.float(  0.1,        'Threshold',                group = EQUAL_GROUP,    tooltip = equalHighsLowsThresholdTooltip,   minval = 0, maxval = 0.5, step = 0.1)
equalHighsLowsSizeInput         = input.string( TINY,       'Label Size',               group = EQUAL_GROUP,    options = [TINY,SMALL,NORMAL])

showFairValueGapsInput          = input(        false,      'Fair Value Gaps',          group = GAPS_GROUP,     tooltip = showFairValueGapsTooltip)
fairValueGapsThresholdInput     = input(        true,       'Auto Threshold',           group = GAPS_GROUP,     tooltip = fairValueGapsThresholdTooltip)
fairValueGapsTimeframeInput     = input.timeframe('',       'Timeframe',                group = GAPS_GROUP,     tooltip = fairValueGapsTimeframeTooltip)
fairValueGapsBullColorInput     = input.color(color.new(#00ff68, 70), 'Bullish FVG' , group = GAPS_GROUP)
fairValueGapsBearColorInput     = input.color(color.new(#ff0008, 70), 'Bearish FVG' , group = GAPS_GROUP)
fairValueGapsExtendInput        = input.int(    1,          'Extend FVG',               group = GAPS_GROUP,     tooltip = fairValueGapsExtendTooltip,       minval = 0)

showDailyLevelsInput            = input(        false,      'Daily',    group = LEVELS_GROUP,   inline = 'daily')
dailyLevelsStyleInput           = input.string( SOLID,      '',         group = LEVELS_GROUP,   inline = 'daily',   options = [SOLID,DASHED,DOTTED])
dailyLevelsColorInput           = input(        BLUE,       '',         group = LEVELS_GROUP,   inline = 'daily')
showWeeklyLevelsInput           = input(        false,      'Weekly',   group = LEVELS_GROUP,   inline = 'weekly')
weeklyLevelsStyleInput          = input.string( SOLID,      '',         group = LEVELS_GROUP,   inline = 'weekly',  options = [SOLID,DASHED,DOTTED])
weeklyLevelsColorInput          = input(        BLUE,       '',         group = LEVELS_GROUP,   inline = 'weekly')
showMonthlyLevelsInput          = input(        false,      'Monthly',   group = LEVELS_GROUP,   inline = 'monthly')
monthlyLevelsStyleInput         = input.string( SOLID,      '',         group = LEVELS_GROUP,   inline = 'monthly', options = [SOLID,DASHED,DOTTED])
monthlyLevelsColorInput         = input(        BLUE,       '',         group = LEVELS_GROUP,   inline = 'monthly')

showPremiumDiscountZonesInput   = input(        false,      'Premium/Discount Zones',   group = ZONES_GROUP , tooltip = showPremiumDiscountZonesTooltip)
premiumZoneColorInput           = input.color(  RED,        'Premium Zone',             group = ZONES_GROUP)
equilibriumZoneColorInput       = input.color(  GRAY,       'Equilibrium Zone',         group = ZONES_GROUP)
discountZoneColorInput          = input.color(  GREEN,      'Discount Zone',            group = ZONES_GROUP)

//---------------------------------------------------------------------------------------------------------------------}
//DATA STRUCTURES & VARIABLES
//---------------------------------------------------------------------------------------------------------------------{
// @type                            UDT representing alerts as bool fields
// @field internalBullishBOS        internal structure custom alert
// @field internalBearishBOS        internal structure custom alert
// @field internalBullishCHoCH      internal structure custom alert
// @field internalBearishCHoCH      internal structure custom alert
// @field swingBullishBOS           swing structure custom alert
// @field swingBearishBOS           swing structure custom alert
// @field swingBullishCHoCH         swing structure custom alert
// @field swingBearishCHoCH         swing structure custom alert
// @field internalBullishOrderBlock internal order block custom alert
// @field internalBearishOrderBlock internal order block custom alert
// @field swingBullishOrderBlock    swing order block custom alert
// @field swingBearishOrderBlock    swing order block custom alert
// @field equalHighs                equal high low custom alert
// @field equalLows                 equal high low custom alert
// @field bullishFairValueGap       fair value gap custom alert
// @field bearishFairValueGap       fair value gap custom alert
type alerts
    bool internalBullishBOS         = false
    bool internalBearishBOS         = false
    bool internalBullishCHoCH       = false
    bool internalBearishCHoCH       = false
    bool swingBullishBOS            = false
    bool swingBearishBOS            = false
    bool swingBullishCHoCH          = false
    bool swingBearishCHoCH          = false
    bool internalBullishOrderBlock  = false
    bool internalBearishOrderBlock  = false
    bool swingBullishOrderBlock     = false
    bool swingBearishOrderBlock     = false
    bool equalHighs                 = false
    bool equalLows                  = false
    bool bullishFairValueGap        = false
    bool bearishFairValueGap        = false

// @type                            UDT representing last swing extremes (top & bottom)
// @field top                       last top swing price
// @field bottom                    last bottom swing price
// @field barTime                   last swing bar time
// @field barIndex                  last swing bar index
// @field lastTopTime               last top swing time
// @field lastBottomTime            last bottom swing time
type trailingExtremes
    float top
    float bottom
    int barTime
    int barIndex
    int lastTopTime
    int lastBottomTime

// @type                            UDT representing Fair Value Gaps
// @field top                       top price
// @field bottom                    bottom price
// @field bias                      bias (BULLISH or BEARISH)
// @field topBox                    top box
// @field bottomBox                 bottom box
type fairValueGap
    float top
    float bottom
    int bias
    box topBox
    box bottomBox

// @type                            UDT representing trend bias
// @field bias                      BULLISH or BEARISH
type trend
    int bias    

// @type                            UDT representing Equal Highs Lows display
// @field l_ine                     displayed line
// @field l_abel                    displayed label
type equalDisplay
    line l_ine      = na
    label l_abel    = na

// @type                            UDT representing a pivot point (swing point) 
// @field currentLevel              current price level
// @field lastLevel                 last price level
// @field crossed                   true if price level is crossed
// @field barTime                   bar time
// @field barIndex                  bar index    
type pivot
    float currentLevel
    float lastLevel
    bool crossed
    int barTime     = time
    int barIndex    = bar_index

// @type                            UDT representing an order block
// @field barHigh                   bar high
// @field barLow                    bar low
// @field barTime                   bar time
// @field bias                      BULLISH or BEARISH
type orderBlock
    float barHigh
    float barLow
    int barTime    
    int bias

// @variable                        current swing pivot high    
var pivot swingHigh                 = pivot.new(na,na,false)
// @variable                        current swing pivot low
var pivot swingLow                  = pivot.new(na,na,false)
// @variable                        current internal pivot high
var pivot internalHigh              = pivot.new(na,na,false)
// @variable                        current internal pivot low
var pivot internalLow               = pivot.new(na,na,false)
// @variable                        current equal high pivot
var pivot equalHigh                 = pivot.new(na,na,false)
// @variable                        current equal low pivot
var pivot equalLow                  = pivot.new(na,na,false)
// @variable                        swing trend bias
var trend swingTrend                = trend.new(0)
// @variable                        internal trend bias
var trend internalTrend             = trend.new(0)
// @variable                        equal high display
var equalDisplay equalHighDisplay   = equalDisplay.new()
// @variable                        equal low display
var equalDisplay equalLowDisplay    = equalDisplay.new()
// @variable                        storage for fairValueGap UDTs
var array<fairValueGap> fairValueGaps = array.new<fairValueGap>()
// @variable                        storage for parsed highs
var array<float> parsedHighs        = array.new<float>()
// @variable                        storage for parsed lows
var array<float> parsedLows         = array.new<float>()
// @variable                        storage for raw highs
var array<float> highs              = array.new<float>()
// @variable                        storage for raw lows
var array<float> lows               = array.new<float>()
// @variable                        storage for bar time values
var array<int> times                = array.new<int>()
// @variable                        last trailing swing high and low
var trailingExtremes trailing       = trailingExtremes.new()
// @variable                                storage for orderBlock UDTs (swing order blocks)
var array<orderBlock> swingOrderBlocks      = array.new<orderBlock>()
// @variable                                storage for orderBlock UDTs (internal order blocks)
var array<orderBlock> internalOrderBlocks   = array.new<orderBlock>()
// @variable                                storage for swing order blocks boxes
var array<box> swingOrderBlocksBoxes        = array.new<box>()
// @variable                                storage for internal order blocks boxes
var array<box> internalOrderBlocksBoxes     = array.new<box>()
// @variable                        color for swing bullish structures
var swingBullishColor               = styleInput == MONOCHROME ? MONO_BULLISH : swingBullColorInput
// @variable                        color for swing bearish structures
var swingBearishColor               = styleInput == MONOCHROME ? MONO_BEARISH : swingBearColorInput
// @variable                        color for bullish fair value gaps
var fairValueGapBullishColor        = styleInput == MONOCHROME ? color.new(MONO_BULLISH,70) : fairValueGapsBullColorInput
// @variable                        color for bearish fair value gaps
var fairValueGapBearishColor        = styleInput == MONOCHROME ? color.new(MONO_BEARISH,70) : fairValueGapsBearColorInput
// @variable                        color for premium zone
var premiumZoneColor                = styleInput == MONOCHROME ? MONO_BEARISH : premiumZoneColorInput
// @variable                        color for discount zone
var discountZoneColor               = styleInput == MONOCHROME ? MONO_BULLISH : discountZoneColorInput 
// @variable                        bar index on current script iteration
varip int currentBarIndex           = bar_index
// @variable                        bar index on last script iteration
varip int lastBarIndex              = bar_index
// @variable                        alerts in current bar
alerts currentAlerts                = alerts.new()
// @variable                        time at start of chart
var initialTime                     = time

// we create the needed boxes for displaying order blocks at the first execution
if barstate.isfirst
    if showSwingOrderBlocksInput
        for index = 1 to swingOrderBlocksSizeInput
            swingOrderBlocksBoxes.push(box.new(na,na,na,na,xloc = xloc.bar_time,extend = extend.right))
    if showInternalOrderBlocksInput
        for index = 1 to internalOrderBlocksSizeInput
            internalOrderBlocksBoxes.push(box.new(na,na,na,na,xloc = xloc.bar_time,extend = extend.right))

// @variable                        source to use in bearish order blocks mitigation
bearishOrderBlockMitigationSource   = orderBlockMitigationInput == CLOSE ? close : high
// @variable                        source to use in bullish order blocks mitigation
bullishOrderBlockMitigationSource   = orderBlockMitigationInput == CLOSE ? close : low
// @variable                        default volatility measure
atrMeasure                          = ta.atr(200)
// @variable                        parsed volatility measure by user settings
volatilityMeasure                   = orderBlockFilterInput == ATR ? atrMeasure : ta.cum(ta.tr)/bar_index
// @variable                        true if current bar is a high volatility bar
highVolatilityBar                   = (high - low) >= (2 * volatilityMeasure)
// @variable                        parsed high
parsedHigh                          = highVolatilityBar ? low : high
// @variable                        parsed low
parsedLow                           = highVolatilityBar ? high : low

// we store current values into the arrays at each bar
parsedHighs.push(parsedHigh)
parsedLows.push(parsedLow)
highs.push(high)
lows.push(low)
times.push(time)

//---------------------------------------------------------------------------------------------------------------------}
//USER-DEFINED FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------{
// @function            Get the value of the current leg, it can be 0 (bearish) or 1 (bullish)
// @returns             int
leg(int size) =>
    var leg     = 0    
    newLegHigh  = high[size] > ta.highest( size)
    newLegLow   = low[size]  < ta.lowest(  size)
    
    if newLegHigh
        leg := BEARISH_LEG
    else if newLegLow
        leg := BULLISH_LEG
    leg

// @function            Identify whether the current value is the start of a new leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfNewLeg(int leg)      => ta.change(leg) != 0

// @function            Identify whether the current level is the start of a new bearish leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfBearishLeg(int leg)  => ta.change(leg) == -1

// @function            Identify whether the current level is the start of a new bullish leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfBullishLeg(int leg)  => ta.change(leg) == +1

// @function            create a new label
// @param labelTime     bar time coordinate
// @param labelPrice    price coordinate
// @param tag           text to display
// @param labelColor    text color
// @param labelStyle    label style
// @returns             label ID
drawLabel(int labelTime, float labelPrice, string tag, color labelColor, string labelStyle) =>    
    var label l_abel = na

    if modeInput == PRESENT
        l_abel.delete()

    l_abel := label.new(chart.point.new(labelTime,na,labelPrice),tag,xloc.bar_time,color=color(na),textcolor=labelColor,style = labelStyle,size = size.small)

// @function            create a new line and label representing an EQH or EQL
// @param p_ivot        starting pivot
// @param level         price level of current pivot
// @param size          how many bars ago was the current pivot detected
// @param equalHigh     true for EQH, false for EQL
// @returns             label ID
drawEqualHighLow(pivot p_ivot, float level, int size, bool equalHigh) =>
    equalDisplay e_qualDisplay = equalHigh ? equalHighDisplay : equalLowDisplay
    
    string tag          = 'EQL'
    color equalColor    = swingBullishColor
    string labelStyle   = label.style_label_up

    if equalHigh
        tag         := 'EQH'
        equalColor  := swingBearishColor
        labelStyle  := label.style_label_down

    if modeInput == PRESENT
        line.delete(    e_qualDisplay.l_ine)
        label.delete(   e_qualDisplay.l_abel)
        
    e_qualDisplay.l_ine     := line.new(chart.point.new(p_ivot.barTime,na,p_ivot.currentLevel), chart.point.new(time[size],na,level), xloc = xloc.bar_time, color = equalColor, style = line.style_dotted)
    labelPosition           = math.round(0.5*(p_ivot.barIndex + bar_index - size))
    e_qualDisplay.l_abel    := label.new(chart.point.new(na,labelPosition,level), tag, xloc.bar_index, color = color(na), textcolor = equalColor, style = labelStyle, size = equalHighsLowsSizeInput)

// @function            store current structure and trailing swing points, and also display swing points and equal highs/lows
// @param size          (int) structure size
// @param equalHighLow  (bool) true for displaying current highs/lows
// @param internal      (bool) true for getting internal structures
// @returns             label ID
getCurrentStructure(int size,bool equalHighLow = false, bool internal = false) =>        
    currentLeg              = leg(size)
    newPivot                = startOfNewLeg(currentLeg)
    pivotLow                = startOfBullishLeg(currentLeg)
    pivotHigh               = startOfBearishLeg(currentLeg)

    if newPivot
        if pivotLow
            pivot p_ivot    = equalHighLow ? equalLow : internal ? internalLow : swingLow    

            if equalHighLow and math.abs(p_ivot.currentLevel - low[size]) < equalHighsLowsThresholdInput * atrMeasure                
                drawEqualHighLow(p_ivot, low[size], size, false)
                currentAlerts.equalLows := true

            p_ivot.lastLevel    := p_ivot.currentLevel
            p_ivot.currentLevel := low[size]
            p_ivot.crossed      := false
            p_ivot.barTime      := time[size]
            p_ivot.barIndex     := bar_index[size]

            if not equalHighLow and not internal
                trailing.bottom         := p_ivot.currentLevel
                trailing.barTime        := p_ivot.barTime
                trailing.barIndex       := p_ivot.barIndex
                trailing.lastBottomTime := p_ivot.barTime

            if showSwingsInput and not internal and not equalHighLow
                drawLabel(time[size], p_ivot.currentLevel, p_ivot.currentLevel < p_ivot.lastLevel ? 'LL' : 'HL', swingBullishColor, label.style_label_up)            
        else
            pivot p_ivot = equalHighLow ? equalHigh : internal ? internalHigh : swingHigh

            if equalHighLow and math.abs(p_ivot.currentLevel - high[size]) < equalHighsLowsThresholdInput * atrMeasure
                drawEqualHighLow(p_ivot,high[size],size,true)
                currentAlerts.equalHighs := true               

            p_ivot.lastLevel    := p_ivot.currentLevel
            p_ivot.currentLevel := high[size]
            p_ivot.crossed      := false
            p_ivot.barTime      := time[size]
            p_ivot.barIndex     := bar_index[size]

            if not equalHighLow and not internal
                trailing.top            := p_ivot.currentLevel
                trailing.barTime        := p_ivot.barTime
                trailing.barIndex       := p_ivot.barIndex
                trailing.lastTopTime    := p_ivot.barTime

            if showSwingsInput and not internal and not equalHighLow
                drawLabel(time[size], p_ivot.currentLevel, p_ivot.currentLevel > p_ivot.lastLevel ? 'HH' : 'LH', swingBearishColor, label.style_label_down)
                
// @function                draw line and label representing a structure
// @param p_ivot            base pivot point
// @param tag               test to display
// @param structureColor    base color
// @param lineStyle         line style
// @param labelStyle        label style
// @param labelSize         text size
// @returns                 label ID
drawStructure(pivot p_ivot, string tag, color structureColor, string lineStyle, string labelStyle, string labelSize) =>    
    var line l_ine      = line.new(na,na,na,na,xloc = xloc.bar_time)
    var label l_abel    = label.new(na,na)

    if modeInput == PRESENT
        l_ine.delete()
        l_abel.delete()

    l_ine   := line.new(chart.point.new(p_ivot.barTime,na,p_ivot.currentLevel), chart.point.new(time,na,p_ivot.currentLevel), xloc.bar_time, color=structureColor, style=lineStyle)
    l_abel  := label.new(chart.point.new(na,math.round(0.5*(p_ivot.barIndex+bar_index)),p_ivot.currentLevel), tag, xloc.bar_index, color=color(na), textcolor=structureColor, style=labelStyle, size = labelSize)

// @function            delete order blocks
// @param internal      true for internal order blocks
// @returns             orderBlock ID
deleteOrderBlocks(bool internal = false) =>
    array<orderBlock> orderBlocks = internal ? internalOrderBlocks : swingOrderBlocks

    for [index,eachOrderBlock] in orderBlocks
        bool crossedOderBlock = false
        
        if bearishOrderBlockMitigationSource > eachOrderBlock.barHigh and eachOrderBlock.bias == BEARISH
            crossedOderBlock := true
            if internal
                currentAlerts.internalBearishOrderBlock := true
            else
                currentAlerts.swingBearishOrderBlock    := true
        else if bullishOrderBlockMitigationSource < eachOrderBlock.barLow and eachOrderBlock.bias == BULLISH
            crossedOderBlock := true
            if internal
                currentAlerts.internalBullishOrderBlock := true
            else
                currentAlerts.swingBullishOrderBlock    := true
        if crossedOderBlock                    
            orderBlocks.remove(index)            

// @function            fetch and store order blocks
// @param p_ivot        base pivot point
// @param internal      true for internal order blocks
// @param bias          BULLISH or BEARISH
// @returns             void
storeOrdeBlock(pivot p_ivot,bool internal = false,int bias) =>
    if (not internal and showSwingOrderBlocksInput) or (internal and showInternalOrderBlocksInput)

        array<float> a_rray = na
        int parsedIndex = na

        if bias == BEARISH
            a_rray      := parsedHighs.slice(p_ivot.barIndex,bar_index)
            parsedIndex := p_ivot.barIndex + a_rray.indexof(a_rray.max())  
        else
            a_rray      := parsedLows.slice(p_ivot.barIndex,bar_index)
            parsedIndex := p_ivot.barIndex + a_rray.indexof(a_rray.min())                        

        orderBlock o_rderBlock          = orderBlock.new(parsedHighs.get(parsedIndex), parsedLows.get(parsedIndex), times.get(parsedIndex),bias)
        array<orderBlock> orderBlocks   = internal ? internalOrderBlocks : swingOrderBlocks
        
        if orderBlocks.size() >= 100
            orderBlocks.pop()
        orderBlocks.unshift(o_rderBlock)

// @function            draw order blocks as boxes
// @param internal      true for internal order blocks
// @returns             void
drawOrderBlocks(bool internal = false) =>        
    array<orderBlock> orderBlocks = internal ? internalOrderBlocks : swingOrderBlocks
    orderBlocksSize = orderBlocks.size()

    if orderBlocksSize > 0        
        maxOrderBlocks                      = internal ? internalOrderBlocksSizeInput : swingOrderBlocksSizeInput
        array<orderBlock> parsedOrdeBlocks  = orderBlocks.slice(0, math.min(maxOrderBlocks,orderBlocksSize))
        array<box> b_oxes                   = internal ? internalOrderBlocksBoxes : swingOrderBlocksBoxes        

        for [index,eachOrderBlock] in parsedOrdeBlocks
            orderBlockColor = styleInput == MONOCHROME ? (eachOrderBlock.bias == BEARISH ? color.new(MONO_BEARISH,80) : color.new(MONO_BULLISH,80)) : internal ? (eachOrderBlock.bias == BEARISH ? internalBearishOrderBlockColor : internalBullishOrderBlockColor) : (eachOrderBlock.bias == BEARISH ? swingBearishOrderBlockColor : swingBullishOrderBlockColor)

            box b_ox        = b_oxes.get(index)
            b_ox.set_top_left_point(    chart.point.new(eachOrderBlock.barTime,na,eachOrderBlock.barHigh))
            b_ox.set_bottom_right_point(chart.point.new(last_bar_time,na,eachOrderBlock.barLow))        
            b_ox.set_border_color(      internal ? na : orderBlockColor)
            b_ox.set_bgcolor(           orderBlockColor)

// @function            detect and draw structures, also detect and store order blocks
// @param internal      true for internal structures or order blocks
// @returns             void
displayStructure(bool internal = false) =>
    var bullishBar = true
    var bearishBar = true

    if internalFilterConfluenceInput
        bullishBar := high - math.max(close, open) > math.min(close, open - low)
        bearishBar := high - math.max(close, open) < math.min(close, open - low)
    
    pivot p_ivot    = internal ? internalHigh : swingHigh
    trend t_rend    = internal ? internalTrend : swingTrend

    lineStyle       = internal ? line.style_dashed : line.style_solid
    labelSize       = internal ? internalStructureSize : swingStructureSize

    extraCondition  = internal ? internalHigh.currentLevel != swingHigh.currentLevel and bullishBar : true
    bullishColor    = styleInput == MONOCHROME ? MONO_BULLISH : internal ? internalBullColorInput : swingBullColorInput

    if ta.crossover(close,p_ivot.currentLevel) and not p_ivot.crossed and extraCondition
        string tag = t_rend.bias == BEARISH ? CHOCH : BOS

        if internal
            currentAlerts.internalBullishCHoCH  := tag == CHOCH
            currentAlerts.internalBullishBOS    := tag == BOS
        else
            currentAlerts.swingBullishCHoCH     := tag == CHOCH
            currentAlerts.swingBullishBOS       := tag == BOS

        p_ivot.crossed  := true
        t_rend.bias     := BULLISH

        displayCondition = internal ? showInternalsInput and (showInternalBullInput == ALL or (showInternalBullInput == BOS and tag != CHOCH) or (showInternalBullInput == CHOCH and tag == CHOCH)) : showStructureInput and (showSwingBullInput == ALL or (showSwingBullInput == BOS and tag != CHOCH) or (showSwingBullInput == CHOCH and tag == CHOCH))

        if displayCondition                        
            drawStructure(p_ivot,tag,bullishColor,lineStyle,label.style_label_down,labelSize)

        if (internal and showInternalOrderBlocksInput) or (not internal and showSwingOrderBlocksInput)
            storeOrdeBlock(p_ivot,internal,BULLISH)

    p_ivot          := internal ? internalLow : swingLow    
    extraCondition  := internal ? internalLow.currentLevel != swingLow.currentLevel and bearishBar : true
    bearishColor    = styleInput == MONOCHROME ? MONO_BEARISH : internal ? internalBearColorInput : swingBearColorInput

    if ta.crossunder(close,p_ivot.currentLevel) and not p_ivot.crossed and extraCondition
        string tag = t_rend.bias == BULLISH ? CHOCH : BOS

        if internal
            currentAlerts.internalBearishCHoCH  := tag == CHOCH
            currentAlerts.internalBearishBOS    := tag == BOS
        else
            currentAlerts.swingBearishCHoCH     := tag == CHOCH
            currentAlerts.swingBearishBOS       := tag == BOS

        p_ivot.crossed := true
        t_rend.bias := BEARISH

        displayCondition = internal ? showInternalsInput and (showInternalBearInput == ALL or (showInternalBearInput == BOS and tag != CHOCH) or (showInternalBearInput == CHOCH and tag == CHOCH)) : showStructureInput and (showSwingBearInput == ALL or (showSwingBearInput == BOS and tag != CHOCH) or (showSwingBearInput == CHOCH and tag == CHOCH))
        
        if displayCondition                        
            drawStructure(p_ivot,tag,bearishColor,lineStyle,label.style_label_up,labelSize)

        if (internal and showInternalOrderBlocksInput) or (not internal and showSwingOrderBlocksInput)
            storeOrdeBlock(p_ivot,internal,BEARISH)

// @function            draw one fair value gap box (each fair value gap has two boxes)
// @param leftTime      left time coordinate
// @param rightTime     right time coordinate
// @param topPrice      top price level
// @param bottomPrice   bottom price level
// @param boxColor      box color
// @returns             box ID
fairValueGapBox(leftTime,rightTime,topPrice,bottomPrice,boxColor) => box.new(chart.point.new(leftTime,na,topPrice),chart.point.new(rightTime + fairValueGapsExtendInput * (time-time[1]),na,bottomPrice), xloc=xloc.bar_time, border_color = boxColor, bgcolor = boxColor)

// @function            delete fair value gaps
// @returns             fairValueGap ID
deleteFairValueGaps() =>
    for [index,eachFairValueGap] in fairValueGaps
        if (low < eachFairValueGap.bottom and eachFairValueGap.bias == BULLISH) or (high > eachFairValueGap.top and eachFairValueGap.bias == BEARISH)
            eachFairValueGap.topBox.delete()
            eachFairValueGap.bottomBox.delete()
            fairValueGaps.remove(index)
    
// @function            draw fair value gaps
// @returns             fairValueGap ID
drawFairValueGaps() => 
    [lastClose, lastOpen, lastTime, currentHigh, currentLow, currentTime, last2High, last2Low] = request.security(syminfo.tickerid, fairValueGapsTimeframeInput, [close[1], open[1], time[1], high[0], low[0], time[0], high[2], low[2]],lookahead = barmerge.lookahead_on)

    barDeltaPercent     = (lastClose - lastOpen) / (lastOpen * 100)
    newTimeframe        = timeframe.change(fairValueGapsTimeframeInput)
    threshold           = fairValueGapsThresholdInput ? ta.cum(math.abs(newTimeframe ? barDeltaPercent : 0)) / bar_index * 2 : 0

    bullishFairValueGap = currentLow > last2High and lastClose > last2High and barDeltaPercent > threshold and newTimeframe
    bearishFairValueGap = currentHigh < last2Low and lastClose < last2Low and -barDeltaPercent > threshold and newTimeframe

    if bullishFairValueGap
        currentAlerts.bullishFairValueGap := true
        fairValueGaps.unshift(fairValueGap.new(currentLow,last2High,BULLISH,fairValueGapBox(lastTime,currentTime,currentLow,math.avg(currentLow,last2High),fairValueGapBullishColor),fairValueGapBox(lastTime,currentTime,math.avg(currentLow,last2High),last2High,fairValueGapBullishColor)))
    if bearishFairValueGap
        currentAlerts.bearishFairValueGap := true
        fairValueGaps.unshift(fairValueGap.new(currentHigh,last2Low,BEARISH,fairValueGapBox(lastTime,currentTime,currentHigh,math.avg(currentHigh,last2Low),fairValueGapBearishColor),fairValueGapBox(lastTime,currentTime,math.avg(currentHigh,last2Low),last2Low,fairValueGapBearishColor)))

// @function            get line style from string
// @param style         line style
// @returns             string
getStyle(string style) =>
    switch style
        SOLID => line.style_solid
        DASHED => line.style_dashed
        DOTTED => line.style_dotted

// @function            draw MultiTimeFrame levels
// @param timeframe     base timeframe
// @param sameTimeframe true if chart timeframe is same as base timeframe
// @param style         line style
// @param levelColor    line and text color
// @returns             void
drawLevels(string timeframe, bool sameTimeframe, string style, color levelColor) =>
    [topLevel, bottomLevel, leftTime, rightTime] = request.security(syminfo.tickerid, timeframe, [high[1], low[1], time[1], time],lookahead = barmerge.lookahead_on)

    float parsedTop         = sameTimeframe ? high : topLevel
    float parsedBottom      = sameTimeframe ? low : bottomLevel    

    int parsedLeftTime      = sameTimeframe ? time : leftTime
    int parsedRightTime     = sameTimeframe ? time : rightTime

    int parsedTopTime       = time
    int parsedBottomTime    = time

    if not sameTimeframe
        int leftIndex               = times.binary_search_rightmost(parsedLeftTime)
        int rightIndex              = times.binary_search_rightmost(parsedRightTime)

        array<int> timeArray        = times.slice(leftIndex,rightIndex)
        array<float> topArray       = highs.slice(leftIndex,rightIndex)
        array<float> bottomArray    = lows.slice(leftIndex,rightIndex)

        parsedTopTime               := timeArray.size() > 0 ? timeArray.get(topArray.indexof(topArray.max())) : initialTime
        parsedBottomTime            := timeArray.size() > 0 ? timeArray.get(bottomArray.indexof(bottomArray.min())) : initialTime

    var line topLine        = line.new(na, na, na, na, xloc = xloc.bar_time, color = levelColor, style = getStyle(style))
    var line bottomLine     = line.new(na, na, na, na, xloc = xloc.bar_time, color = levelColor, style = getStyle(style))
    var label topLabel      = label.new(na, na, xloc = xloc.bar_time, text = str.format('P{0}H',timeframe), color=color(na), textcolor = levelColor, size = size.small, style = label.style_label_left)
    var label bottomLabel   = label.new(na, na, xloc = xloc.bar_time, text = str.format('P{0}L',timeframe), color=color(na), textcolor = levelColor, size = size.small, style = label.style_label_left)

    topLine.set_first_point(    chart.point.new(parsedTopTime,na,parsedTop))
    topLine.set_second_point(   chart.point.new(last_bar_time + 20 * (time-time[1]),na,parsedTop))   
    topLabel.set_point(         chart.point.new(last_bar_time + 20 * (time-time[1]),na,parsedTop))

    bottomLine.set_first_point( chart.point.new(parsedBottomTime,na,parsedBottom))    
    bottomLine.set_second_point(chart.point.new(last_bar_time + 20 * (time-time[1]),na,parsedBottom))
    bottomLabel.set_point(      chart.point.new(last_bar_time + 20 * (time-time[1]),na,parsedBottom))

// @function            true if chart timeframe is higher than provided timeframe
// @param timeframe     timeframe to check
// @returns             bool
higherTimeframe(string timeframe) => timeframe.in_seconds() > timeframe.in_seconds(timeframe)

// @function            update trailing swing points
// @returns             int
updateTrailingExtremes() =>
    trailing.top            := math.max(high,trailing.top)
    trailing.lastTopTime    := trailing.top == high ? time : trailing.lastTopTime
    trailing.bottom         := math.min(low,trailing.bottom)
    trailing.lastBottomTime := trailing.bottom == low ? time : trailing.lastBottomTime

// @function            draw trailing swing points
// @returns             void
drawHighLowSwings() =>
    var line topLine        = line.new(na, na, na, na, color = swingBearishColor, xloc = xloc.bar_time)
    var line bottomLine     = line.new(na, na, na, na, color = swingBullishColor, xloc = xloc.bar_time)
    var label topLabel      = label.new(na, na, color=color(na), textcolor = swingBearishColor, xloc = xloc.bar_time, style = label.style_label_down, size = size.tiny)
    var label bottomLabel   = label.new(na, na, color=color(na), textcolor = swingBullishColor, xloc = xloc.bar_time, style = label.style_label_up, size = size.tiny)

    rightTimeBar            = last_bar_time + 20 * (time - time[1])

    topLine.set_first_point(    chart.point.new(trailing.lastTopTime, na, trailing.top))
    topLine.set_second_point(   chart.point.new(rightTimeBar, na, trailing.top))
    topLabel.set_point(         chart.point.new(rightTimeBar, na, trailing.top))
    topLabel.set_text(          swingTrend.bias == BEARISH ? 'Strong High' : 'Weak High')

    bottomLine.set_first_point( chart.point.new(trailing.lastBottomTime, na, trailing.bottom))
    bottomLine.set_second_point(chart.point.new(rightTimeBar, na, trailing.bottom))
    bottomLabel.set_point(      chart.point.new(rightTimeBar, na, trailing.bottom))
    bottomLabel.set_text(       swingTrend.bias == BULLISH ? 'Strong Low' : 'Weak Low')

// @function            draw a zone with a label and a box
// @param labelLevel    price level for label
// @param labelIndex    bar index for label
// @param top           top price level for box
// @param bottom        bottom price level for box
// @param tag           text to display
// @param zoneColor     base color
// @param style         label style
// @returns             void
drawZone(float labelLevel, int labelIndex, float top, float bottom, string tag, color zoneColor, string style) =>
    var label l_abel    = label.new(na,na,text = tag, color=color(na),textcolor = zoneColor, style = style, size = size.small)
    var box b_ox        = box.new(na,na,na,na,bgcolor = color.new(zoneColor,80),border_color = color(na), xloc = xloc.bar_time)

    b_ox.set_top_left_point(    chart.point.new(trailing.barTime,na,top))
    b_ox.set_bottom_right_point(chart.point.new(last_bar_time,na,bottom))

    l_abel.set_point(           chart.point.new(na,labelIndex,labelLevel))

// @function            draw premium/discount zones
// @returns             void
drawPremiumDiscountZones() =>
    drawZone(trailing.top, math.round(0.5*(trailing.barIndex + last_bar_index)), trailing.top, 0.95*trailing.top + 0.05*trailing.bottom, 'Premium', premiumZoneColor, label.style_label_down)

    equilibriumLevel = math.avg(trailing.top, trailing.bottom)
    drawZone(equilibriumLevel, last_bar_index, 0.525*trailing.top + 0.475*trailing.bottom, 0.525*trailing.bottom + 0.475*trailing.top, 'Equilibrium', equilibriumZoneColorInput, label.style_label_left)

    drawZone(trailing.bottom, math.round(0.5*(trailing.barIndex + last_bar_index)), 0.95*trailing.bottom + 0.05*trailing.top, trailing.bottom, 'Discount', discountZoneColor, label.style_label_up)

//---------------------------------------------------------------------------------------------------------------------}
//MUTABLE VARIABLES & EXECUTION
//---------------------------------------------------------------------------------------------------------------------{
parsedOpen  = showTrendInput ? open : na
candleColor = internalTrend.bias == BULLISH ? swingBullishColor : swingBearishColor
plotcandle(parsedOpen,high,low,close,color = candleColor, wickcolor = candleColor, bordercolor = candleColor)

if showHighLowSwingsInput or showPremiumDiscountZonesInput
    updateTrailingExtremes()

    if showHighLowSwingsInput
        drawHighLowSwings()

    if showPremiumDiscountZonesInput
        drawPremiumDiscountZones()

if showFairValueGapsInput
    deleteFairValueGaps()

getCurrentStructure(swingsLengthInput,false)
getCurrentStructure(5,false,true)

if showEqualHighsLowsInput
    getCurrentStructure(equalHighsLowsLengthInput,true)

if showInternalsInput or showInternalOrderBlocksInput or showTrendInput
    displayStructure(true)

if showStructureInput or showSwingOrderBlocksInput or showHighLowSwingsInput
    displayStructure()

if showInternalOrderBlocksInput
    deleteOrderBlocks(true)

if showSwingOrderBlocksInput
    deleteOrderBlocks()

if showFairValueGapsInput
    drawFairValueGaps()

if barstate.islastconfirmedhistory or barstate.islast
    if showInternalOrderBlocksInput        
        drawOrderBlocks(true)
        
    if showSwingOrderBlocksInput        
        drawOrderBlocks()

lastBarIndex    := currentBarIndex
currentBarIndex := bar_index
newBar          = currentBarIndex != lastBarIndex

if barstate.islastconfirmedhistory or (barstate.isrealtime and newBar)
    if showDailyLevelsInput and not higherTimeframe('D')
        drawLevels('D',timeframe.isdaily,dailyLevelsStyleInput,dailyLevelsColorInput)

    if showWeeklyLevelsInput and not higherTimeframe('W')
        drawLevels('W',timeframe.isweekly,weeklyLevelsStyleInput,weeklyLevelsColorInput)

    if showMonthlyLevelsInput and not higherTimeframe('M')
        drawLevels('M',timeframe.ismonthly,monthlyLevelsStyleInput,monthlyLevelsColorInput)

//---------------------------------------------------------------------------------------------------------------------}
//ALERTS
//---------------------------------------------------------------------------------------------------------------------{
alertcondition(currentAlerts.internalBullishBOS,        'Internal Bullish BOS',         'Internal Bullish BOS formed')
alertcondition(currentAlerts.internalBullishCHoCH,      'Internal Bullish CHoCH',       'Internal Bullish CHoCH formed')
alertcondition(currentAlerts.internalBearishBOS,        'Internal Bearish BOS',         'Internal Bearish BOS formed')
alertcondition(currentAlerts.internalBearishCHoCH,      'Internal Bearish CHoCH',       'Internal Bearish CHoCH formed')

alertcondition(currentAlerts.swingBullishBOS,           'Bullish BOS',                  'Internal Bullish BOS formed')
alertcondition(currentAlerts.swingBullishCHoCH,         'Bullish CHoCH',                'Internal Bullish CHoCH formed')
alertcondition(currentAlerts.swingBearishBOS,           'Bearish BOS',                  'Bearish BOS formed')
alertcondition(currentAlerts.swingBearishCHoCH,         'Bearish CHoCH',                'Bearish CHoCH formed')

alertcondition(currentAlerts.internalBullishOrderBlock, 'Bullish Internal OB Breakout', 'Price broke bullish internal OB')
alertcondition(currentAlerts.internalBearishOrderBlock, 'Bearish Internal OB Breakout', 'Price broke bearish internal OB')
alertcondition(currentAlerts.swingBullishOrderBlock,    'Bullish Swing OB Breakout',    'Price broke bullish swing OB')
alertcondition(currentAlerts.swingBearishOrderBlock,    'Bearish Swing OB Breakout',    'Price broke bearish swing OB')

alertcondition(currentAlerts.equalHighs,                'Equal Highs',                  'Equal highs detected')
alertcondition(currentAlerts.equalLows,                 'Equal Lows',                   'Equal lows detected')

alertcondition(currentAlerts.bullishFairValueGap,       'Bullish FVG',                  'Bullish FVG formed')
alertcondition(currentAlerts.bearishFairValueGap,       'Bearish FVG',                  'Bearish FVG formed')

//---------------------------------------------------------------------------------------------------------------------}
`,
  },
];
