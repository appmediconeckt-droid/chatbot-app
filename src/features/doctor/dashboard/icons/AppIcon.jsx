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
      {name === 'chevron-left' && <Polyline points="15 5 8 12 15 19" {...common} />}
      {name === 'chevron-right' && <Polyline points="9 5 16 12 9 19" {...common} />}
      {name === 'check-mark' && <Polyline points="4 13 9 18 20 6" {...common} />}
      {name === 'chevron-down' && <Polyline points="6 9 12 16 18 9" {...common} />}
      {name === 'pulse' && <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" {...common} />}
      {name === 'pin' && (
        <>
          <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" {...common} />
          <Circle cx="12" cy="10" r="3" {...common} />
        </>
      )}
      {name === 'warning' && (
        <>
          <Path d="M12 3 2 20h20L12 3Z" {...common} />
          <Line x1="12" y1="9.5" x2="12" y2="13.5" {...common} />
          <Circle cx="12" cy="16.5" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {name === 'pill' && (
        <>
          <Rect x="4.5" y="4.5" width="15" height="15" rx="7.5" transform="rotate(45 12 12)" {...common} />
          <Line x1="8.3" y1="8.3" x2="15.7" y2="15.7" {...common} />
        </>
      )}
      {name === 'bed' && (
        <>
          <Path d="M3 18v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...common} />
          <Path d="M13 14h6a2 2 0 0 1 2 2v2" {...common} />
          <Line x1="3" y1="14" x2="21" y2="14" {...common} />
          <Line x1="3" y1="18" x2="3" y2="20" {...common} />
          <Line x1="21" y1="18" x2="21" y2="20" {...common} />
          <Circle cx="7" cy="10" r="1.4" {...common} />
        </>
      )}
      {name === 'folder' && <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" {...common} />}
      {name === 'download' && (
        <>
          <Path d="M12 3v12" {...common} />
          <Polyline points="7 10 12 15 17 10" {...common} />
          <Path d="M5 19h14" {...common} />
        </>
      )}
      {name === 'eye' && (
        <>
          <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" {...common} />
          <Circle cx="12" cy="12" r="3" {...common} />
        </>
      )}
      {name === 'eye-off' && (
        <>
          <Path d="M3 3l18 18" {...common} />
          <Path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.5 4.4M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.7-.8" {...common} />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...common} />
        </>
      )}
      {name === 'moon' && (
        <Path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z" {...common} />
      )}
      {name === 'mail' && (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2" {...common} />
          <Path d="m4 7 8 6 8-6" {...common} />
        </>
      )}
      {name === 'info' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Line x1="12" y1="11" x2="12" y2="16" {...common} />
          <Circle cx="12" cy="8" r="0.9" fill={color} stroke="none" />
        </>
      )}
      {name === 'globe' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M3 12h18M12 3c2.5 2.5 3.5 5.8 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.8-3.5-9s1-6.5 3.5-9Z" {...common} />
        </>
      )}
      {name === 'refresh' && (
        <>
          <Path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" {...common} />
          <Polyline points="21 3 21 8 16 8" {...common} />
          <Path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" {...common} />
          <Polyline points="3 21 3 16 8 16" {...common} />
        </>
      )}
      {name === 'briefcase' && (
        <>
          <Rect x="3" y="7" width="18" height="13" rx="2" {...common} />
          <Path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...common} />
          <Line x1="3" y1="12" x2="21" y2="12" {...common} />
        </>
      )}
      {name === 'more' && (
        <>
          <Circle cx="12" cy="5" r="1.8" fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="1.8" fill={color} stroke="none" />
          <Circle cx="12" cy="19" r="1.8" fill={color} stroke="none" />
        </>
      )}
      {name === 'scale' && (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="3" {...common} />
          <Circle cx="12" cy="13" r="3.2" {...common} />
          <Line x1="12" y1="7" x2="12" y2="9.5" {...common} />
        </>
      )}
      {name === 'ruler' && (
        <>
          <Line x1="12" y1="3" x2="12" y2="21" {...common} />
          <Line x1="8.5" y1="3" x2="15.5" y2="3" {...common} />
          <Line x1="8.5" y1="21" x2="15.5" y2="21" {...common} />
          <Line x1="9" y1="8" x2="12" y2="8" {...common} />
          <Line x1="9" y1="13" x2="12" y2="13" {...common} />
          <Line x1="9" y1="18" x2="12" y2="18" {...common} />
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
      {name === 'shield' && (
        <>
          <Path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6Z" {...common} />
          <Polyline points="9 12 11 14 15 10" {...common} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x="5" y="11" width="14" height="10" rx="2" {...common} />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...common} />
        </>
      )}
      {name === 'fingerprint' && (
        <>
          <Path d="M12 3a7 7 0 0 0-7 7c0 3 0 5-1 8" {...common} />
          <Path d="M12 3a7 7 0 0 1 7 7c0 2 0 3.5-.3 5" {...common} />
          <Path d="M8 21a13 13 0 0 0 1.5-6c0-1.5 1-2.5 2.5-2.5s2.5 1 2.5 2.5" {...common} />
          <Path d="M12 21c1.2-1.8 2-3.6 2-6a2 2 0 0 0-4 0" {...common} />
        </>
      )}
      {name === 'smartphone' && (
        <>
          <Rect x="7" y="2" width="10" height="20" rx="2" {...common} />
          <Line x1="11" y1="18" x2="13" y2="18" {...common} />
        </>
      )}
      {name === 'laptop' && (
        <>
          <Rect x="4" y="4" width="16" height="11" rx="1.5" {...common} />
          <Path d="M2 19h20l-2-4H4Z" {...common} />
        </>
      )}
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
      {name === 'edit' && (
        <Path
          d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
          {...common}
        />
      )}
      {name === 'flask' && (
        <>
          <Path d="M9 2h6M10 2v6l-5.2 9.1A2 2 0 0 0 6.5 20h11a2 2 0 0 0 1.7-2.9L14 8V2" {...common} />
          <Line x1="7.5" y1="14" x2="16.5" y2="14" {...common} />
        </>
      )}
      {name === 'upload' && (
        <>
          <Path d="M12 15V3" {...common} />
          <Polyline points="7 8 12 3 17 8" {...common} />
          <Path d="M5 19h14" {...common} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Polyline points="4 7 20 7" {...common} />
          <Path d="M9 7V4h6v3M6 7l1 13h10l1-13" {...common} />
          <Line x1="10" y1="11" x2="10" y2="17" {...common} />
          <Line x1="14" y1="11" x2="14" y2="17" {...common} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" {...common} />
          <Circle cx="12" cy="13.5" r="3.4" {...common} />
        </>
      )}
      {name === 'reply' && (
        <>
          <Polyline points="9 10 4 15 9 20" {...common} />
          <Path d="M4 15h10a6 6 0 0 0 6-6v-1" {...common} />
        </>
      )}
      {name === 'plus' && (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...common} />
          <Line x1="5" y1="12" x2="19" y2="12" {...common} />
        </>
      )}
      {name === 'note' && (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="2" {...common} />
          <Line x1="8" y1="8" x2="16" y2="8" {...common} />
          <Line x1="8" y1="12" x2="16" y2="12" {...common} />
          <Line x1="8" y1="16" x2="12" y2="16" {...common} />
        </>
      )}
    </Svg>
  );
}
