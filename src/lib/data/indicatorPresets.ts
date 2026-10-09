// Katalog Preset Indikator Pine Script v5 Resmi untuk Trawangan

export interface IndicatorPreset {
  id: string;
  name: string;
  category: 'Trend' | 'Momentum' | 'Volatility' | 'Signals';
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
];
