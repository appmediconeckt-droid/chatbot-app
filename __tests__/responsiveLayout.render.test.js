import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { ResponsiveAppFrame, ResponsiveContent, ResponsiveGrid, useContentDimensions } from '../src/components/common/ResponsiveLayout';

let mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: value => value },
  useWindowDimensions: () => mockDimensions,
}));

let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

function Draft() {
  const dimensions = useContentDimensions();
  const [value, setValue] = useState('');
  return <DraftInput {...dimensions} value={value} onChange={setValue} />;
}
const DraftInput = props => <input {...props} />;

test('rotation and resizing keep the form mounted with its draft', async () => {
  mockDimensions = { width: 768, height: 1024, scale: 1, fontScale: 1 };
  await act(async () => { root = create(<ResponsiveAppFrame><Draft /></ResponsiveAppFrame>); });
  await act(async () => root.root.findByType(DraftInput).props.onChange('Unsaved reading'));
  for (const [width, height] of [[1024, 768], [1600, 1000], [480, 1024]]) {
    mockDimensions = { ...mockDimensions, width, height };
    await act(async () => root.update(<ResponsiveAppFrame><Draft /></ResponsiveAppFrame>));
    expect(root.root.findByType(DraftInput).props.width).toBe(Math.min(width, 1280));
    expect(root.root.findByType(DraftInput).props.value).toBe('Unsaved reading');
  }
});

test('nested content gives children the measured width after a sidebar', async () => {
  mockDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };
  await act(async () => { root = create(<ResponsiveAppFrame><ResponsiveContent><Draft /></ResponsiveContent></ResponsiveAppFrame>); });
  const content = root.root.findAllByType('View').find(node => node.props.onLayout);
  await act(async () => content.props.onLayout({ nativeEvent: { layout: { width: 680 } } }));
  expect(root.root.findByType(DraftInput).props.width).toBe(680);
});

test('grid reflows measured columns without remounting its form', async () => {
  await act(async () => { root = create(<ResponsiveGrid minItemWidth={320} maxColumns={2}><Draft key="patient" /><Draft key="doctor" /></ResponsiveGrid>); });
  await act(async () => root.root.findAllByType(DraftInput)[0].props.onChange('Draft'));
  const grid = () => root.root.findAllByType('View').find(node => node.props.onLayout);
  for (const width of [390, 768, 1024, 480]) {
    await act(async () => grid().props.onLayout({ nativeEvent: { layout: { width } } }));
    const itemWidth = grid().findAllByType('View')[1].props.style.width;
    expect(itemWidth).toBeLessThanOrEqual(width);
    expect(root.root.findAllByType(DraftInput)[0].props.value).toBe('Draft');
  }
});
