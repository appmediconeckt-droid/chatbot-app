// Keeps a consultant's own rating fresh while their screen is open. The server
// sends no live event when a user submits a rating, so the summary
// (GET /api/counselors/:id/rating) is re-read every 30 s and whenever the app
// comes back to the foreground; onChange gets { rating, totalRatings }.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getCounselorRating } from '../services/ratingService';

const POLL_MS = 30000;

export default function useLiveCounselorRating(counselorId, onChange) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!counselorId) return undefined;
    let active = true;
    const refresh = async () => {
      const info = await getCounselorRating(counselorId);
      if (!active || !info) return;
      onChangeRef.current?.({
        rating: Number(info.averageRating) || 0,
        totalRatings: Number(info.totalRatings) || 0,
      });
    };
    const timer = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [counselorId]);
}
