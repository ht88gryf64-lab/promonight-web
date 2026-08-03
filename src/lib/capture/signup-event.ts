import type { CapturePromptContext, NewsletterSignupProperties } from '@/lib/analytics';

// The sheet's `newsletter_signup` payload, built where a test can reach it.
//
// WHY THIS IS NOT INLINE IN CaptureCard. `page_type` on this event is what
// separates the team-page sheet from the aggregator sheet, and both write
// surface='web_engagement_capture', so it is the only thing that tells the two
// placements apart in the read. It is also OPTIONAL on the event type, because
// the /follow form legitimately has no page type to report.
//
// Optional plus inline means deleting it type-checks clean and leaves the suite
// green, and the result is not an error but one believable pooled number. Same
// failure shape as the sheet emitting only capture_prompt_submitted would have
// been: a plausible answer to a question nobody asked. Pulling the payload into
// a pure function is what lets a test assert the field is there, in the same
// spirit as trigger-engine.ts holding the decision the component used to make.
export function sheetSignupProperties(
  context: CapturePromptContext,
  teamCount: number,
): NewsletterSignupProperties {
  return {
    surface: context.surface,
    team_count: teamCount,
    // Inert since the A/B was dropped, retained so the next experiment has a
    // labelled numerator from day one. See lib/capture/variant.ts.
    variant: context.variant,
    page_type: context.page_type,
  };
}
