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
    description: 'Rata-rata harga terbobot volume kumulatif dengan reset harian sesi bursa, dilengkapi pita deviasi standar ganda (+1σ/-1σ dan +2σ/-2σ) untuk identifikasi area nilai wajar intraday.',
    overlay: true,
    sourceCode: `//@version=5
indicator("Volume Weighted Average Price", shorttitle="VWAP", overlay=true)

computeCustomBands = input.bool(true, "Show StdDev Bands", group="Bands Calculation")
mult1 = input.float(1.0, "Band Multiplier 1", step=0.5, group="Bands Calculation")
mult2 = input.float(2.0, "Band Multiplier 2", step=0.5, group="Bands Calculation")

// VWAP kalkulasi harian bursa
vwapValue = ta.vwap(hlc3)

// Deteksi batas sesi harian baru untuk deviasi kumulatif
newSession = ta.change(time("D")) != 0

// Deviasi standar kumulatif terbobot volume berbasis sesi (Volume-Weighted StdDev)
var float sumVol = 0.0
var float sumDevSqVol = 0.0

if newSession
    sumVol := volume
    sumDevSqVol := (hlc3 - vwapValue) * (hlc3 - vwapValue) * volume
else
    sumVol := sumVol + volume
    sumDevSqVol := sumDevSqVol + ((hlc3 - vwapValue) * (hlc3 - vwapValue) * volume)

dev = sumVol > 0 ? math.sqrt(sumDevSqVol / sumVol) : 0.0

band1Upper = computeCustomBands ? vwapValue + (dev * mult1) : na
band1Lower = computeCustomBands ? vwapValue - (dev * mult1) : na
band2Upper = computeCustomBands ? vwapValue + (dev * mult2) : na
band2Lower = computeCustomBands ? vwapValue - (dev * mult2) : na

p_vwap = plot(vwapValue, "VWAP", color=#00f2fe, linewidth=2)
p_b1_up = plot(band1Upper, "Upper Band 1", color=#ffeb3b, linewidth=1)
p_b1_low = plot(band1Lower, "Lower Band 1", color=#ffeb3b, linewidth=1)
p_b2_up = plot(band2Upper, "Upper Band 2", color=#ff9800, linewidth=1)
p_b2_low = plot(band2Lower, "Lower Band 2", color=#ff9800, linewidth=1)

fill(p_b1_up, p_b1_low, title="Inner Value Area", color=color.rgb(0, 242, 254, 90))
fill(p_b2_up, p_b2_low, title="Outer Value Area", color=color.rgb(255, 152, 0, 94))
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
