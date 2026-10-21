import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { KeyboardSafeArea, KeyboardSafeScroll } from '../src/components/common/KeyboardSafeForm';

let mockFrame = { y: 0, height: 800 };
let mockMetrics;
let mockListeners;
const mockScrollTo = jest.fn();

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
jest.mock('react-native', () => ({
  View: 'View', ScrollView: 'ScrollView',
  Platform: { OS: 'android' },
  StyleSheet: { create: styles => styles, flatten: styles => Array.isArray(styles) ? Object.assign({}, ...styles) : styles },
  Dimensions: { get: () => ({ height: 800 }) },
  TextInput: { State: { currentlyFocusedInput: () => 11 } },
  findNodeHandle: node => node,
  UIManager: { measureLayout: (_input, _scroll, _failure, success) => success(0, 420, 300, 56) },
  Keyboard: {
    metrics: () => mockMetrics,
    addListener: (name, callback) => {
      mockListeners[name] ||= new Set();
      mockListeners[name].add(callback);
      return { remove: () => mockListeners[name].delete(callback) };
    },
  },
}));

let root;
beforeEach(() => {
  jest.useFakeTimers();
  mockFrame = { y: 0, height: 800 };
  mockMetrics = undefined;
  mockListeners = {};
  mockScrollTo.mockClear();
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  jest.useRealTimers();
});
const render = async element => {
  await act(async () => {
    root = create(element, { createNodeMock: node => node.type === 'ScrollView'
      ? { scrollTo: mockScrollTo, getInnerViewNode: () => 2 }
      : { measure: callback => callback(0, 0, 390, mockFrame.height, 0, mockFrame.y) } });
  });
};
const emit = async (name, event) => {
  await act(async () => { mockListeners[name]?.forEach(callback => callback(event)); });
};
const areaStyle = () => Object.assign({}, ...root.root.findByType('View').props.style);

test.each([
  [0, 800, 300], // edge-to-edge modal covered by the keyboard
  [0, 500, 0], // Android already resized the app to the keyboard top
  [24, 776, 300], // frame starts below the status bar
  [0, 620, 120], // only part of the keyboard height still overlaps
])('reserves only actual keyboard overlap (frame y=%i, height=%i)', async (y, height, expected) => {
  mockFrame = { y, height };
  await render(<KeyboardSafeArea style={{ flex: 1, padding: 16 }}><button>Verify OTP</button></KeyboardSafeArea>);
  await emit('keyboardDidShow', { endCoordinates: { screenY: 500, height: 300 } });
  expect(areaStyle().paddingBottom).toBe(16 + expected);
  await emit('keyboardDidHide');
  expect(areaStyle().paddingBottom).toBe(16);
});

test('measures a keyboard already open when a modal mounts and rechecks on resize', async () => {
  mockMetrics = { screenY: 500, height: 300 };
  await render(<KeyboardSafeArea style={{ flex: 1 }} />);
  expect(areaStyle().paddingBottom).toBe(300);
  mockFrame.height = 500;
  await act(async () => root.root.findByType('View').props.onLayout({ nativeEvent: { layout: { height: 500 } } }));
  expect(areaStyle().paddingBottom).toBe(0);
});

test('keyboard changes preserve the OTP draft and release listeners on unmount', async () => {
  function Form() {
    const [otp, setOtp] = useState('');
    return <KeyboardSafeArea style={{ flex: 1 }}><input value={otp} onChange={setOtp} /><button>Verify</button></KeyboardSafeArea>;
  }
  await render(<Form />);
  await act(async () => root.root.findByType('input').props.onChange('123456'));
  await emit('keyboardDidShow', { endCoordinates: { screenY: 500, height: 300 } });
  await emit('keyboardDidHide');
  expect(root.root.findByType('input').props.value).toBe('123456');
  await act(async () => root.unmount());
  root = null;
  expect([...mockListeners.keyboardDidShow, ...mockListeners.keyboardDidHide]).toHaveLength(0);
});

test('focus leaves space for the Verify action and keeps its first tap available', async () => {
  await render(<KeyboardSafeScroll><input /><button>Verify</button></KeyboardSafeScroll>);
  const scroll = root.root.findByType('ScrollView');
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  await act(async () => {
    scroll.props.onLayout({ nativeEvent: { layout: { height: 400 } } });
    scroll.props.onFocusCapture({ target: 11 });
  });
  await act(async () => jest.advanceTimersByTime(200));
  expect(mockScrollTo).toHaveBeenCalledWith({ y: 216, animated: true });
});
