'use client';
import { useEffect } from 'react';

// Remembers the last CFB team the user viewed (mockup pattern) so the /cfb hub
// and return visits can restore the team theme. localStorage only; no PII.
export function CfbThemePersist({ schoolId }: { schoolId: string }) {
  useEffect(() => {
    try { localStorage.setItem('cfb:lastTeam', schoolId); } catch { /* ignore */ }
  }, [schoolId]);
  return null;
}
