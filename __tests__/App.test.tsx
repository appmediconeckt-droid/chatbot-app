/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@stream-io/react-native-webrtc', () => ({
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn(),
  RTCIceCandidate: jest.fn(),
  mediaDevices: {
    getUserMedia: jest.fn(),
    enumerateDevices: jest.fn(),
  },
  MediaStream: jest.fn(),
  MediaStreamTrack: jest.fn(),
  RTCView: 'RTCView',
}));

jest.mock('react-native-incall-manager', () => ({
  start: jest.fn(),
  stop: jest.fn(),
  startRingtone: jest.fn(),
  stopRingtone: jest.fn(),
  startRingback: jest.fn(),
  stopRingback: jest.fn(),
  setForceSpeakerphoneOn: jest.fn(),
  setKeepScreenOn: jest.fn(),
}));

jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  types: {
    allFiles: '*/*',
    images: 'image/*',
    pdf: 'application/pdf',
  },
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  CachesDirectoryPath: '/tmp',
  DownloadDirectoryPath: '/tmp',
  exists: jest.fn(),
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('@react-native-voice/voice', () => ({
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn(() => Promise.resolve()),
  removeAllListeners: jest.fn(),
  isAvailable: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('@stream-io/video-react-native-sdk', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);

  return {
    StreamVideo: Passthrough,
    StreamCall: Passthrough,
    CallContent: Passthrough,
    StreamVideoClient: {
      getOrCreateInstance: jest.fn(() => ({
        call: jest.fn(() => ({
          join: jest.fn(),
          leave: jest.fn(),
          camera: { enable: jest.fn(), disable: jest.fn() },
          microphone: { enable: jest.fn(), disable: jest.fn() },
        })),
        disconnectUser: jest.fn(),
      })),
    },
    useCall: jest.fn(() => null),
    useCallStateHooks: jest.fn(() => ({
      useCallCallingState: jest.fn(),
      useParticipantCount: jest.fn(() => 0),
      useLocalParticipant: jest.fn(() => null),
      useRemoteParticipants: jest.fn(() => []),
    })),
    CallingState: {},
  };
});

import App from '../App';

test('renders correctly', async () => {
  jest.useFakeTimers();
  let renderer: ReactTestRenderer.ReactTestRenderer | null = null;

  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1500);
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    renderer?.unmount();
  });
  jest.useRealTimers();
});
