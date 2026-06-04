import { archivo } from '@/components/redesign/fonts';
import { TeamNotFoundView } from '@/components/redesign/TeamNotFoundView';

// Not-found boundary for the team route. notFound() in page.tsx (invalid slug)
// renders this within the root layout. The font variable is attached here so
// the redesign chrome (decided client-side in TeamNotFoundView) can resolve
// Archivo without touching the root layout's <html>. Harmless when the view
// falls back to the gate-off/global-chrome body (the var is just unused).
export default function TeamNotFound() {
  return (
    <div className={archivo.variable}>
      <TeamNotFoundView />
    </div>
  );
}
