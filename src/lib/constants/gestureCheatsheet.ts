// Definisi Glosarium dan Metadata Kartu Visual "Draw by holding" bergaya OpenMarket
// Digunakan oleh DrawByHoldingModal.svelte dan pengujian otomatis Tiket #107.

export interface GestureCheatsheetCard {
  id: string;
  title: string;
  subtitle: string;
  descId: string;
  badge?: string;
  category?: 'shape' | 'action';
}

export const DRAW_BY_HOLDING_CARDS: readonly GestureCheatsheetCard[] = [
  {
    id: 'trendline',
    title: 'Trend Line',
    subtitle: 'a straight stroke',
    descId: 'Garis lurus miring',
    category: 'shape'
  },
  {
    id: 'ray',
    title: 'Ray',
    subtitle: 'straight, into the price axis',
    descId: 'Lurus menembus sumbu harga',
    category: 'shape'
  },
  {
    id: 'horizontal',
    title: 'Horizontal Line',
    subtitle: 'a flat stroke, lands on the wick',
    descId: 'Garis datar menempel di ekor lilin',
    category: 'shape'
  },
  {
    id: 'vertical',
    title: 'Vertical Line',
    subtitle: 'an upright stroke',
    descId: 'Garis tegak lurus',
    category: 'shape'
  },
  {
    id: 'rectangle',
    title: 'Rectangle',
    subtitle: 'four sides that close',
    descId: 'Empat sisi tertutup',
    category: 'shape'
  },
  {
    id: 'ellipse',
    title: 'Ellipse',
    subtitle: 'a round loop',
    descId: 'Lingkaran/oval mulus',
    category: 'shape'
  },
  {
    id: 'fib',
    title: 'Fib Retracement',
    subtitle: 'three sides, swing to swing',
    descId: '3 ayunan puncak ke lembah',
    category: 'shape'
  },
  {
    id: 'path',
    title: 'Path',
    subtitle: 'sharp turns',
    descId: 'Garis bersudut tajam',
    category: 'shape'
  },
  {
    id: 'arrow',
    title: 'Arrow',
    subtitle: 'a shaft with a hook',
    descId: 'Garis berujung panah',
    category: 'shape'
  },
  {
    id: 'scribble',
    title: 'Scribble',
    subtitle: 'zig-zag over it: gone',
    descId: 'Coret zigzag untuk menghapus',
    category: 'action'
  },
  {
    id: 'tab',
    title: 'Tab',
    subtitle: 'the other reading',
    descId: 'Ganti kandidat bentuk',
    badge: 'Tab',
    category: 'action'
  },
  {
    id: 'quickdrag',
    title: 'Quick drag',
    subtitle: 'still pans',
    descId: 'Geser kanvas biasa',
    category: 'action'
  },
  {
    id: 'esc',
    title: 'Esc',
    subtitle: 'removes it',
    descId: 'Batalkan goresan',
    badge: 'Esc',
    category: 'action'
  }
] as const;
