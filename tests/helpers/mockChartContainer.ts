/**
 * Helper container DOM tiruan bersama untuk unit & integration test controller chart.
 */
export function createMockChartContainer(width = 1000, height = 600): any {
  return {
    nodeType: 1,
    tagName: 'DIV',
    clientWidth: width,
    clientHeight: height,
    style: { setProperty: () => {}, removeProperty: () => {} },
    children: [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  } as any;
}
