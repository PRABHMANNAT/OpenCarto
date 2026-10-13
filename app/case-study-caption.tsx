import type { MapDoc } from './map-model';

// Retain the caption when opening a previously saved case-study map.
export function CaseStudyCaption({ doc }: { doc: MapDoc }) {
  return doc.caseStudyId === 'sikh-heritage-core' ? (
    <div className="case-study-map-caption" aria-label="History case study caption">
      <strong>Sikh military &amp; heritage case study</strong>
      <span>Hypothetical / alternate history · editable modern units</span>
    </div>
  ) : null;
}
