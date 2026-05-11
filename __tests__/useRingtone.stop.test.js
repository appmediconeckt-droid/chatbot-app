import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Vibration } from 'react-native';
import useRingtone from '../src/hooks/useRingtone';

jest.mock('react-native-incall-manager', () => ({
  startRingtone: jest.fn(),
  stopRingtone: jest.fn(),
  stopRingback: jest.fn(),
  setForceSpeakerphoneOn: jest.fn(),
  setKeepScreenOn: jest.fn(),
  stop: jest.fn(),
  start: jest.fn(),
}));

const InCallManager = require('react-native-incall-manager');

describe('useRingtone stop behavior', () => {
  let hookApi;

  const Harness = () => {
    hookApi = useRingtone();
    return null;
  };

  beforeEach(() => {
    hookApi = null;
    jest.clearAllMocks();
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    jest.spyOn(Vibration, 'cancel').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('stops ringtone when accept/reject ends the ring session', () => {
    let renderer;

    act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });

    act(() => {
      hookApi.startRinging(true);
    });

    expect(InCallManager.startRingtone).toHaveBeenCalled();

    act(() => {
      hookApi.stopRinging();
    });

    expect(InCallManager.stopRingtone).toHaveBeenCalled();
    expect(InCallManager.stopRingback).toHaveBeenCalled();
    expect(Vibration.cancel).toHaveBeenCalled();

    act(() => {
      renderer.unmount();
    });
  });
});