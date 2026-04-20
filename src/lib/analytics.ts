import { flattenUTMsForEvent, getStoredUTMs } from './utm-capture';

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';

export const isAnalyticsEnabled = () => {
  return typeof window !== 'undefined' && !!GA_MEASUREMENT_ID;
};

export const pageview = (url: string) => {
  if (!isAnalyticsEnabled()) return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

export const event = (action: string, params?: Record<string, string | number | boolean>) => {
  if (!isAnalyticsEnabled()) return;
  window.gtag('event', action, params);
};

export type InstallClickPayload = {
  platform: 'ios' | 'android';
  section: string;
  page: string;
};

// Fires both the legacy `app_store_click` and the new `app_install_click` with UTMs.
// Legacy event stays for ~30 days so existing dashboards don't break during migration.
export const trackInstallClick = (payload: InstallClickPayload) => {
  event('app_store_click', {
    platform: payload.platform,
    section: payload.section,
    page: payload.page,
  });
  const sourcePage =
    typeof window !== 'undefined' ? window.location.pathname : payload.page;
  event('app_install_click', {
    platform: payload.platform,
    source_page: sourcePage,
    ...flattenUTMsForEvent(getStoredUTMs()),
  });
};

export type AffiliatePartner = 'seatgeek' | 'stubhub' | 'fanatics';
export type AffiliateSurface =
  | 'home'
  | 'team_page'
  | 'promo_detail'
  | 'game_detail'
  | 'widget'
  | 'terms'
  | 'privacy'
  | string;

export type AffiliateClickPayload = {
  partner: AffiliatePartner;
  team_id: string;
  sport: string;
  promo_id: string | null;
  surface: AffiliateSurface;
  is_hot_promo: boolean;
};

export const trackAffiliateClick = (payload: AffiliateClickPayload) => {
  event('outbound_affiliate_click', {
    partner: payload.partner,
    team_id: payload.team_id,
    sport: payload.sport,
    promo_id: payload.promo_id ?? '',
    surface: payload.surface,
    is_hot_promo: payload.is_hot_promo,
  });
};
