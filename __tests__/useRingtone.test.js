import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Vibration } from 'react-native';
import useRingtone from '../src/hooks/useRingtone';

jest.useFakeTimers();

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

describe('useRingtone', () => {
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
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.restoreAllMocks();
  });

  test('loops the incoming ringtone until stopRinging is called', () => {
    let renderer;

    act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });

    act(() => {
      hookApi.startRinging(true);
    });

    expect(InCallManager.startRingtone).toHaveBeenCalledTimes(1);
    expect(Vibration.vibrate).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(InCallManager.startRingtone).toHaveBeenCalledTimes(2);

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

  test('starts outgoing ringback without crashing', () => {
    act(() => {
      ReactTestRenderer.create(<Harness />);
    });

    act(() => {
      hookApi.startRinging(false);
    });

    expect(InCallManager.start).toHaveBeenCalledWith(
      expect.objectContaining({ media: 'audio', ringback: '_DTMF_' }),
    );
  });
});