export const TABLET_BREAKPOINT = 600;
export const WIDE_BREAKPOINT = 900;
export const MAX_APP_WIDTH = 1280;
export const MAX_FORM_WIDTH = 600;
export const MAX_SHEET_WIDTH = 720;

export function getResponsiveLayout(width, height) {
  const contentWidth = Math.min(Math.max(0, width), MAX_APP_WIDTH);
  return {
    width: contentWidth,
    height,
    isTablet: contentWidth >= TABLET_BREAKPOINT,
    isWide: contentWidth >= WIDE_BREAKPOINT,
    isLandscape: width > height,
    gutter: contentWidth >= TABLET_BREAKPOINT ? 24 : 14,
    sheetWidth: Math.min(Math.max(0, width - 32), MAX_SHEET_WIDTH),
    formWidth: Math.min(Math.max(0, contentWidth - 32), MAX_FORM_WIDTH),
  };
}

export function getGridLayout(width, minItemWidth = 320, maxColumns = 3, gap = 16) {
  const available = Math.max(0, width);
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((available + gap) / (minItemWidth + gap))));
  return { columns, itemWidth: Math.max(0, (available - gap * (columns - 1)) / columns) };
}
