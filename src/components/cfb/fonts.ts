import { Instrument_Serif } from 'next/font/google';

// The CFB immersive display face (approved mockup). Instrument Serif — ITALIC —
// carries the editorial drama: the hero kicker, the oversized stat numbers, the
// signature-game title, and the section/rivalry/tradition titles. Weight 400 is
// the only cut the family ships; we load normal + italic. The CSS variable is
// attached to the CfbSchoolPage wrapper (not <html>), matching how Archivo scopes
// itself to the redesigned tree — so nothing else in the app preloads it.
export const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-cfb-serif',
  display: 'swap',
});
