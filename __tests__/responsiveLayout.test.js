import { getGridLayout, getResponsiveLayout, MAX_APP_WIDTH } from '../src/utils/responsiveLayout';

test.each([
  [320, 568, false],
  [390, 844, false],
  [599, 900, false],
  [600, 960, true],
  [768, 1024, true],
  [800, 1280, true],
  [1024, 768, true],
  [1280, 800, true],
  [1600, 1000, true],
])('fits the viewport at %i × %i', (width, height, isTablet) => {
  const layout = getResponsiveLayout(width, height);
  expect(layout.isTablet).toBe(isTablet);
  expect(layout.width).toBe(Math.min(width, MAX_APP_WIDTH));
  expect(layout.formWidth).toBeLessThanOrEqual(width - 32);
  expect(layout.sheetWidth).toBeLessThanOrEqual(width - 32);
  expect(layout.sheetWidth).toBeLessThanOrEqual(720);
});

test.each([0, 280, 320, 599, 600, 656, 768, 800, 900, 1024, 1280])('grid columns stay inside %i available pixels', width => {
  const { columns, itemWidth } = getGridLayout(width);
  expect(columns).toBeGreaterThanOrEqual(1);
  expect(columns).toBeLessThanOrEqual(3);
  expect(itemWidth * columns + 16 * (columns - 1)).toBeCloseTo(width, 4);
  if (columns > 1) expect(itemWidth).toBeGreaterThanOrEqual(320);
});

test('uses the parent width for cards inside a tablet sidebar', () => {
  expect(getGridLayout(1024 - 280 - 32).columns).toBe(2);
  expect(getGridLayout(800 - 280 - 32).columns).toBe(1);
});

test('reflows correctly when a tablet rotates or enters split screen', () => {
  expect(getGridLayout(768).columns).toBe(2);
  expect(getGridLayout(1024).columns).toBe(3);
  expect(getResponsiveLayout(480, 1024).isTablet).toBe(false);
  expect(getGridLayout(480).columns).toBe(1);
});
