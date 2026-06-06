import React, { createContext, useContext, useState, useCallback } from 'react';

const CallContext = createContext({
  isCallOpen: false,
  activeMode: null,
  callData: null,
  startCall: () => {},
  endCall: () => {},
  showIncomingCall: () => {},
});

export const CallProvider = ({ children }) => {
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [callData, setCallData] = useState(null);

  const startCall = useCallback((data, mode) => {
    setCallData(data);
    setActiveMode(mode || 'video');
    setIsCallOpen(true);
  }, []);

  const endCall = useCallback(() => {
    setIsCallOpen(false);
    setActiveMode(null);
    setCallData(null);
  }, []);

  const showIncomingCall = useCallback((data) => {
    setCallData(data);
  }, []);

  return (
    <CallContext.Provider value={{ isCallOpen, activeMode, callData, startCall, endCall, showIncomingCall }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
