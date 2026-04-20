'use client';

import { useEffect } from 'react';
import { captureUTMs } from '@/lib/utm-capture';

export function UTMCaptureProvider() {
  useEffect(() => {
    captureUTMs();
  }, []);
  return null;
}
