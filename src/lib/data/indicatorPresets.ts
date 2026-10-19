// Katalog Preset Indikator Pine Script v5 Resmi untuk Trawangan

export interface IndicatorPreset {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Signals' | 'Volume';
  description: string;
  overlay: boolean;
  sourceCode: string;
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
indicator(title="Volume-weighted average price", shorttitle="VWAP", overlay=true, timeframe="", timeframe_gaps=true)

hideonDWM = input(false, title="Hide VWAP on 1D or Above", group="VWAP Settings", display=display.none)
anchor = input.string(defval="Session", title="Anchor Period", options=["Session", "Week", "Month", "Quarter", "Year", "Decade", "Century", "Earnings", "Dividends", "Splits"], group="VWAP Settings")
src = input(title="Source", defval=hlc3, group="VWAP Settings", display=display.none)
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

volMA = ta.sma(volume, maLength)

barColor = close >= open ? #0ecb81 : #f6465d
plot(volume, "Volume", style=plot.style_columns, color=barColor)
plot(showMA ? volMA : na, "Volume MA", color=#ff9800, linewidth=2)
`,
  },
];
