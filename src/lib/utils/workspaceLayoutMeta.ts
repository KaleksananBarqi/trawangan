/**
 * Sumber kebenaran tunggal (single source of truth) untuk metadata opsi tata letak multi-chart Vela.
 *
 * Pemetaan orientasi internal `@luxalgo/vela`:
 * - `'2v'` -> 2 panel bertumpuk atas & bawah (`rows: [1, 1]`), ditampilkan sebagai "2 Horisontal"
 * - `'2h'` -> 2 panel berdampingan kiri & kanan (`cols: [1, 1]`), ditampilkan sebagai "2 Vertikal"
 */

/**
 * Kunci ikon untuk merepresentasikan bentuk tata letak di antarmuka menu workspace
 */
export type WorkspaceLayoutIconKey = 'single' | 'rows' | 'cols' | 'grid';

/**
 * Struktur opsi tata letak multi-chart pada menu Workspace & Layout
 */
export interface WorkspaceLayoutOption {
  readonly id: string;
  readonly label: string;
  readonly desc: string;
  readonly iconKey: WorkspaceLayoutIconKey;
}

/**
 * Daftar opsi tata letak multi-chart beserta pemetaan ke ID layout internal Vela
 */
export const MULTI_CHART_LAYOUT_OPTIONS = [
  { id: '1', label: '1 Chart', desc: 'Single viewport', iconKey: 'single' },
  { id: '2v', label: '2 Horisontal', desc: 'Atas & Bawah', iconKey: 'rows' },
  { id: '2h', label: '2 Vertikal', desc: 'Kiri & Kanan', iconKey: 'cols' },
  { id: '4', label: '4 Grid', desc: 'Quad viewport', iconKey: 'grid' },
] as const satisfies readonly WorkspaceLayoutOption[];

/**
 * Memformat ID layout multi-chart Vela menjadi label badge pada Branded Snapshot Frame
 */
export function formatMultiChartLayoutLabel(layout: string): string {
  switch (layout) {
    case '2v':
      return '2-SPLIT HORIZONTAL';
    case '2h':
      return '2-SPLIT VERTICAL';
    case '4':
      return '4-GRID';
    default:
      return `LAYOUT ${layout.toUpperCase()}`;
  }
}
