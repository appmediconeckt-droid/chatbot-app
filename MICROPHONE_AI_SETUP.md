# AI Assistant Microphone (Speech-to-Text) Setup Guide

## Overview
The Humaelio AI Assistant now includes a built-in microphone feature that allows users to speak their questions and have the text automatically appear in the message input field.

## Implementation Details

### Files Created/Modified

#### 1. **useSpeechToText Hook** (`src/hooks/useSpeechToText.js`)
- Manages voice recognition lifecycle
- Handles microphone permissions
- Provides partial and final speech results
- Platform-specific initialization (iOS & Android)

**Key Functions:**
- `startListening()` - Begins voice capture
- `stopListening()` - Stops voice capture
- `toggleListening()` - Toggle listening state
- `clearTranscript()` - Clear recognized text

**Returns:**
```javascript
{
  isListening,      // Boolean: currently listening?
  transcript,       // String: recognized text
  error,           // String: error message if any
  isAvailable,     // Boolean: device supports speech recognition
  startListening,
  stopListening,
  toggleListening,
  clearTranscript,
}
```

#### 2. **AiMicButton Component** (`src/components/AiMicButton.jsx`)
- Visual microphone button for AI chat input area
- Shows different states (listening, idle, disabled)
- Red color when actively listening
- Green color when idle

#### 3. **UserDashboard.jsx Integration** (`src/screens/user/Component/UserDashboard/Dashboard/UserDashboard.jsx`)
- Added `useSpeechToText` hook to ChatPopup component
- Implemented `handleMicPress` to toggle listening
- Added useEffect to append transcript to message input
- Integrated `AiMicButton` in the input area (between input pill and send button)

### How It Works

1. **User Presses Microphone Button**
   - Button changes color to red (listening mode)
   - Device microphone activates
   - Live partial results appear in real-time

2. **User Speaks**
   - Voice is captured and converted to text
   - Partial results shown immediately
   - Final result ready when user stops speaking

3. **Text is Appended**
   - Recognized text automatically appends to the message input
   - If there's existing text, a space is added between old and new text
   - User can edit before sending

4. **User Sends Message**
   - User taps the send button
   - Message with spoken content is sent to AI

## Permissions Required

### Android
- **Runtime Permission**: `RECORD_AUDIO` (android.permission.RECORD_AUDIO)
- Requested automatically when user presses microphone button
- Permission dialog shows: "This app needs access to your microphone for speech recognition"

### iOS
- **Info.plist Addition**:
  ```xml
  <key>NSMicrophoneUsageDescription</key>
  <string>This app needs access to your microphone for voice chat with our AI assistant.</string>
  <key>NSSpeechRecognitionUsageDescription</key>
  <string>This app needs speech recognition to convert your voice to text in the AI assistant.</string>
  ```
- If iOS build fails, add these keys to `ios/chatbots/Info.plist`

## Package Dependencies
- `@react-native-voice/voice` - Speech recognition library
  - Already installed in package.json
  - Handles platform-specific voice APIs

## Usage Example

```javascript
import { useSpeechToText } from '../hooks/useSpeechToText';

export function MyChatComponent() {
  const [message, setMessage] = useState('');
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
  } = useSpeechToText();

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Append transcript to message when done listening
  useEffect(() => {
    if (transcript && !isListening) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
    }
  }, [transcript, isListening]);

  return (
    <View>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Type or speak your question..."
      />
      <AiMicButton
        isListening={isListening}
        onPress={handleMicPress}
      />
    </View>
  );
}
```

## UI Integration

The microphone button appears in the AI Assistant chat input area:
- Located between the message input pill and the send button
- **Idle State**: Light green background (#f0fdf4) with green mic icon (#006B2C)
- **Listening State**: Light red background (#fecaca) with red mic icon (#ef4444)
- **Disabled State**: 50% opacity (while loading or sending)

## Testing the Feature

### On Android Device
1. Open the app and go to AI Assistant chat
2. Tap the microphone button
3. Grant microphone permission when prompted
4. Speak your question
5. Text should appear in the input field
6. Edit if needed and tap Send

### On iOS Device
1. Ensure Info.plist has required keys
2. Build and run on device
3. Open AI Assistant chat
4. Tap microphone button
5. Speak your question
6. Text should appear in the input field

## Troubleshooting

### Microphone Button Not Responding
- Check if `@react-native-voice/voice` is installed: `npm list @react-native-voice/voice`
- Verify import statements in files are correct
- Rebuild app: `npm run android` or `npm run ios`

### No Text Appearing After Speaking
- Check device's speech recognition language setting
- Ensure microphone permission is granted
- Check browser/app console for errors
- Language might not be supported (currently configured for en-US)

### Permission Denied Error
- On Android: Grant permission in app settings > Permissions > Microphone
- On iOS: Check Settings > Privacy > Speech Recognition
- Clear app cache and reinstall if necessary

### Speech Recognition Not Available
- Device may not support speech recognition
- Check console for `isAvailable` value
- Some devices require additional voice input installation

## Future Enhancements

- [ ] Support multiple languages (detect from app language setting)
- [ ] Add noise filtering
- [ ] Implement continuous listening mode
- [ ] Add voice activity detection
- [ ] Support for voice commands
- [ ] Gesture-based microphone control (long press)

## Performance Notes

- Voice recognition runs on device (no cloud API calls for basic recognition)
- Minimal battery impact when not actively listening
- Memory footprint: ~5-10MB for the voice library
- No additional network requests required for speech-to-text

## Support

For issues or questions about the microphone feature:
1. Check the troubleshooting section above
2. Review console logs for error messages
3. Verify all files were created correctly
4. Check Android/iOS platform-specific requirements
