import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import socketService from '../src/services/socketService';
import useLiveRefresh from '../src/hooks/useLiveRefresh';

jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn() }));
jest.mock('../src/services/socketService', () => ({
  __esModule: true, default: { connect: jest.fn() },
}));

function Screen({ refresh }) {
  useLiveRefresh(refresh, ['presence-update']);
  return null;
}

let root;
let stateHandler;
let socket;
let remove;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  useIsFocused.mockReturnValue(true);
  remove = jest.fn();
  AppState.addEventListener.mockImplementation((event, handler) => {
    stateHandler = handler;
    return { remove };
  });
  socket = { on: jest.fn(), off: jest.fn() };
  socketService.connect.mockResolvedValue(socket);
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  jest.useRealTimers();
});

test('refreshes without changing tabs, pauses in background and resumes immediately', async () => {
  const refresh = jest.fn().mockResolvedValue();
  await act(async () => { root = create(<Screen refresh={refresh} />); });
  await act(async () => { jest.advanceTimersByTime(15000); });
  const calls = refresh.mock.calls.length;
  expect(calls).toBeGreaterThan(1);
  await act(async () => { stateHandler('background'); jest.advanceTimersByTime(30000); });
  expect(refresh).toHaveBeenCalledTimes(calls);
  await act(async () => { stateHandler('active'); });
  expect(refresh).toHaveBeenCalledTimes(calls + 1);
});

test('refreshes on socket events and removes listeners on unmount', async () => {
  const refresh = jest.fn().mockResolvedValue();
  await act(async () => { root = create(<Screen refresh={refresh} />); });
  const handler = socket.on.mock.calls.find(([event]) => event === 'presence-update')[1];
  refresh.mockClear();
  await act(async () => { handler(); handler(); jest.advanceTimersByTime(250); });
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  root = null;
  expect(socket.off).toHaveBeenCalledWith('presence-update', handler);
  expect(remove).toHaveBeenCalled();
  refresh.mockClear();
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(refresh).not.toHaveBeenCalled();
});

test('does not fetch for an unfocused screen', async () => {
  useIsFocused.mockReturnValue(false);
  const refresh = jest.fn();
  await act(async () => { root = create(<Screen refresh={refresh} />); });
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(refresh).not.toHaveBeenCalled();
});
