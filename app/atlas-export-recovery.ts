import type {PunjabPdfScope} from './private-atlas-pdf';

export type AtlasExportView = {
  selected: string;
  punjabOnly: boolean;
  focusedDistrictId: string;
  labels: boolean;
  places: boolean;
  headquarters: boolean;
  dark: boolean;
  context: boolean;
  sidebarCollapsed: boolean;
};
type Recovery = {attemptedAt: number; pending: boolean; scope: PunjabPdfScope; view: AtlasExportView};
const key = 'united-atlas-pdf-recovery-v1';
const lifetime = 5 * 60 * 1000;

export function readAtlasExportRecovery(): Recovery | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || 'null') as Recovery | null;
    if (!value || !Number.isFinite(value.attemptedAt) || Date.now() - value.attemptedAt > lifetime || value.attemptedAt > Date.now()) return null;
    if (!['all', 'district', 'division', 'tehsil'].includes(value.scope) || typeof value.pending !== 'boolean') return null;
    const view = value.view;
    if (!view || typeof view.selected !== 'string' || typeof view.focusedDistrictId !== 'string') return null;
    for (const field of ['punjabOnly', 'labels', 'places', 'headquarters', 'dark', 'context', 'sidebarCollapsed'] as const)
      if (typeof view[field] !== 'boolean') return null;
    return value;
  } catch { return null; }
}

export function isModuleLoadError(cause: unknown): boolean {
  return cause instanceof Error && /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css|loading chunk .* failed/i.test(cause.message);
}

// Persist before navigation. Retain the attempt time after resuming so a genuinely
// blocked module never sends the user into a refresh loop, even on repeated clicks.
export function recoverAtlasExport(scope: PunjabPdfScope, view: AtlasExportView): boolean {
  if (!navigator.onLine || readAtlasExportRecovery()) return false;
  try {
    sessionStorage.setItem(key, JSON.stringify({attemptedAt: Date.now(), pending: true, scope, view}));
    window.location.reload();
    return true;
  } catch { return false; }
}

export function consumeAtlasExportRecovery(): void {
  const recovery = readAtlasExportRecovery();
  if (recovery) try { sessionStorage.setItem(key, JSON.stringify({...recovery, pending: false})); } catch { /* Storage may be disabled after navigation. */ }
}
