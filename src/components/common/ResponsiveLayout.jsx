import React, { createContext, useContext, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { getGridLayout, getResponsiveLayout, MAX_APP_WIDTH } from '../../utils/responsiveLayout';

const ContentWidthContext = createContext(null);

// Navigation, headers and content share the same viewport on large tablets.
// Native Modals, camera previews and call windows still cover the full display.
export function ResponsiveAppFrame({ children }) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_APP_WIDTH);
  return (
    <View style={s.background}>
      <ContentWidthContext.Provider value={contentWidth}>
        <View style={[s.frame, { maxWidth: MAX_APP_WIDTH }]}>{children}</View>
      </ContentWidthContext.Provider>
    </View>
  );
}

export function useContentDimensions() {
  const dimensions = useWindowDimensions();
  const contentWidth = useContext(ContentWidthContext);
  return { ...dimensions, width: Math.min(dimensions.width, contentWidth ?? dimensions.width) };
}

export function useResponsiveLayout() {
  const { width, height } = useContentDimensions();
  return getResponsiveLayout(width, height);
}

export function ResponsiveContent({ children, style }) {
  const { width: parentWidth } = useContentDimensions();
  const [width, setWidth] = useState(parentWidth);
  return (
    <View style={[s.content, style]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ContentWidthContext.Provider value={Math.min(width, parentWidth)}>{children}</ContentWidthContext.Provider>
    </View>
  );
}

// Measure the actual parent instead of assuming the whole screen is available.
// This also works inside sidebars, sheets, split screen and padded cards.
export function ResponsiveGrid({ children, minItemWidth = 320, maxColumns = 3, gap = 16, style }) {
  const [width, setWidth] = useState(0);
  const { itemWidth } = getGridLayout(width, minItemWidth, maxColumns, gap);
  return (
    <View
      style={[s.grid, { gap }, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {React.Children.map(children, (child) => child == null ? null : (
        <View style={width ? { width: itemWidth, minWidth: 0 } : s.singleColumn}>
          {child}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#F8FAFC' },
  frame: { flex: 1, width: '100%', alignSelf: 'center' },
  content: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  singleColumn: { width: '100%', minWidth: 0 },
});
