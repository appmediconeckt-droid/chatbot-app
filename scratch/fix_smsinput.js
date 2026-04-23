const fs = require('fs');
const file = 'src/screens/user/Component/counselor-dashboard/Tab/SMSInput/SMSInput.jsx';
let content = fs.readFileSync(file, 'utf-8');

// replace localstorage imports and usages
content = content.replace("import React, { useState, useRef, useEffect } from 'react';", "import React, { useState, useRef, useEffect } from 'react';\nimport AsyncStorage from '@react-native-async-storage/async-storage';");

// find the function getChatIdForAPI and replace with async version?
// Actually simpler is to just do search and replace for all localStorage.getItem and localStorage.setItem to AsyncStorage equivalents, and add awaits where needed. But some are sync.

// Let's replace the top level sync fetches with state
const toReplaceSync = `  const getCurrentCounselor = () => {
    let counselorData = null;
    const storedCounselor = localStorage.getItem("counselor");
    if (storedCounselor) {
      try {
        counselorData = JSON.parse(storedCounselor);
      } catch (e) {
        console.error("Error parsing counselor:", e);
      }
    }
    return counselorData;
  };

  const getCounselorId = () => {
    if (currentCounselor) {
      if (currentCounselor._id) return currentCounselor._id;
      if (currentCounselor.id) return currentCounselor.id;
    }
    const storedId = localStorage.getItem("counselorId");
    if (storedId) return storedId;
    return null;
  };

  const currentCounselor = getCurrentCounselor();
  const COUNSELOR_ID = getCounselorId();
  const COUNSELOR_NAME = currentCounselor?.name || "Counselor";`;

const newSync = `  const [currentCounselor, setCurrentCounselor] = useState(null);
  const [COUNSELOR_ID, setCOUNSELOR_ID] = useState(null);
  const [COUNSELOR_NAME, setCOUNSELOR_NAME] = useState("Counselor");

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedCounselor = await AsyncStorage.getItem("counselor");
        let counselorData = null;
        if (storedCounselor) {
          counselorData = JSON.parse(storedCounselor);
          setCurrentCounselor(counselorData);
          setCOUNSELOR_NAME(counselorData.name || "Counselor");
        }
        
        let cId = null;
        if (counselorData) {
          cId = counselorData._id || counselorData.id;
        }
        if (!cId) {
          cId = await AsyncStorage.getItem("counselorId");
        }
        setCOUNSELOR_ID(cId);
      } catch (e) {
        console.error("Error loading counselor data:", e);
      }
    };
    loadData();
  }, []);`;

content = content.replace(toReplaceSync, newSync);

// Now handle async usages
content = content.replace(/localStorage\.getItem/g, 'await AsyncStorage.getItem');
content = content.replace(/localStorage\.setItem/g, 'await AsyncStorage.setItem');

// The saveMessagesToLocalStorage needs to be async
content = content.replace('const saveMessagesToLocalStorage = (messagesToSave) => {', 'const saveMessagesToLocalStorage = async (messagesToSave) => {');
content = content.replace('const loadMessagesFromLocalStorage = () => {', 'const loadMessagesFromLocalStorage = async () => {');

// fetchMessagesFromAPI calls saveMessagesToLocalStorage(transformedMessages) -> we can just await it or not, it works fine
// loadMessagesFromLocalStorage is called inside catch without await, it's fine since it updates state.

fs.writeFileSync(file, content);
console.log('Finished refactoring SMSInput.jsx');
