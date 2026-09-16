// Ported from MediconecktApp's src/doctor/components/icons/AppIcon.tsx.
import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export default function AppIcon({ name, size = 20, color = '#171B22', strokeWidth = 1.8 }) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      {name === 'menu' && (
        <>
          <Line x1="4" y1="6" x2="20" y2="6" {...common} />
          <Line x1="4" y1="12" x2="20" y2="12" {...common} />
          <Line x1="4" y1="18" x2="14" y2="18" {...common} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3" {...common} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10 3.08V3h4v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.92 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"
            {...common}
          />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" {...common} />
          <Path d="M10 21h4" {...common} />
        </>
      )}
      {name === 'home' && (
        <>
          <Path d="m3 11 9-8 9 8" {...common} />
          <Path d="M5 10v10h14V10M9 20v-6h6v6" {...common} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3" y="5" width="18" height="16" rx="2" {...common} />
          <Line x1="7" y1="3" x2="7" y2="7" {...common} />
          <Line x1="17" y1="3" x2="17" y2="7" {...common} />
          <Line x1="3" y1="10" x2="21" y2="10" {...common} />
        </>
      )}
      {name === 'user' && (
        <>
          <Circle cx="12" cy="8" r="4" {...common} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...common} />
        </>
      )}
      {name === 'message' && (
        <>
          <Path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" {...common} />
          <Line x1="8" y1="9" x2="16" y2="9" {...common} />
          <Line x1="8" y1="13" x2="14" y2="13" {...common} />
        </>
      )}
      {name === 'users' && (
        <>
          <Circle cx="9" cy="8" r="3" {...common} />
          <Path d="M3 20a6 6 0 0 1 12 0" {...common} />
          <Path d="M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" {...common} />
        </>
      )}
      {name === 'hourglass' && (
        <Path d="M6 3h12M6 21h12M7 3c0 5 5 5 5 9s-5 4-5 9M17 3c0 5-5 5-5 9s5 4 5 9" {...common} />
      )}
      {name === 'check' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Polyline points="8 12 11 15 16 9" {...common} />
        </>
      )}
      {name === 'timer' && (
        <>
          <Circle cx="12" cy="13" r="8" {...common} />
          <Line x1="12" y1="13" x2="12" y2="9" {...common} />
          <Line x1="9" y1="2" x2="15" y2="2" {...common} />
        </>
      )}
      {name === 'coffee' && (
        <>
          <Path d="M4 8h13v5a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6Z" {...common} />
          <Path d="M17 10h1a3 3 0 0 1 0 6h-2M7 3v2M11 3v2" {...common} />
        </>
      )}
      {name === 'video' && (
        <>
          <Rect x="3" y="6" width="13" height="12" rx="2" {...common} />
          <Path d="m16 10 5-3v10l-5-3Z" {...common} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Polyline points="12 7 12 12 16 14" {...common} />
        </>
      )}
      {name === 'x' && (
        <>
          <Line x1="6" y1="6" x2="18" y2="18" {...common} />
          <Line x1="18" y1="6" x2="6" y2="18" {...common} />
        </>
      )}
      {name === 'qr' && (
        <>
          <Rect x="3" y="3" width="7" height="7" {...common} />
          <Rect x="14" y="3" width="7" height="7" {...common} />
          <Rect x="3" y="14" width="7" height="7" {...common} />
          <Path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 21h2" {...common} />
        </>
      )}
      {name === 'walk' && (
        <>
          <Circle cx="13" cy="4" r="2" {...common} />
          <Path d="m10 9 3-2 3 3 3 1M12 8l-1 5-4 4M11 13l4 3 1 5M8 10l-2 4" {...common} />
        </>
      )}
      {name === 'logout' && <Path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" {...common} />}
      {name === 'search' && (
        <>
          <Circle cx="11" cy="11" r="7" {...common} />
          <Line x1="16" y1="16" x2="21" y2="21" {...common} />
        </>
      )}
      {name === 'phone' && (
        <Path
          d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z"
          {...common}
        />
      )}
      {name === 'attachment' && (
        <Path
          d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"
          {...common}
        />
      )}
      {name === 'mic' && (
        <>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...common} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" {...common} />
        </>
      )}
      {name === 'send' && (
        <>
          <Path d="m22 2-7 20-4-9-9-4Z" {...common} />
          <Path d="M22 2 11 13" {...common} />
        </>
      )}
      {name === 'file' && (
        <>
          <Path d="M6 2h8l4 4v16H6Z" {...common} />
          <Path d="M14 2v5h5M9 13h6M9 17h6" {...common} />
        </>
      )}
    </Svg>
  );
}
