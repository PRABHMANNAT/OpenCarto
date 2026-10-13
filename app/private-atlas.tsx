'use client';
/* oxlint-disable next/no-img-element, jsx-a11y/prefer-tag-over-role -- Plain Vite React uses licensed remote thumbnails and accessible SVG silhouettes. */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Globe2,
  Maximize,
  Plus,
  Minus,
  Moon,
  Sun,
  Search,
  MapPinned,
  ChevronRight,
  X,
  BookOpen,
  Download,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type {
  Map as GLMap,
  GeoJSONSource,
  FilterSpecification,
} from 'maplibre-gl';
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection, Feature } from 'geojson';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import natureSources from './nature-sources.json';
import {
  defaultDistrictEdits,
  districtDisplayNames,
  districtEditsStorageKey,
  mergeDistrictFeatures,
  mergeEditedDistricts,
  punjabPalette,
  readDistrictEdits,
  styleDistrictFeatures,
  styleTehsilFeatures,
  sumDistrictDemographics,
  summarizeDistrictDivisions,
  type DistrictEdits,
  type HypotheticalDemographics,
  type TehsilColorMode,
} from './private-atlas-districts';
import 'maplibre-gl/dist/maplibre-gl.css';
import './private-atlas.css';

type Census = {
  year: number;
  population: number;
  languages: { name: string; share: number }[];
  religions: { name: string; share: number }[];
};
type Photo = {
  url: string;
  title: string;
  caption?: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  date?: string;
  retrieved?: string;
};
type Province = {
  id: string;
  name: string;
  aliases?: string[];
  classification: string;
  capital: string;
  largestCity: string;
  majorCities: string[];
  capitalCoordinates: number[];
  color: string;
  areaKm2: number;
  areaNote: string;
  population: number | null;
  density: number | null;
  forestArea: number | null;
  forestPercent: number | null;
  statisticsNote: string;
  census: Census | null;
  hypotheticalDemographics?: HypotheticalDemographics;
  etymology: string;
  emblem: string;
  silhouette: string;
  languages: string[];
  officialLanguages?: string[];
  communities: string[];
  rivers: string;
  landscape: string;
  heritage: string[];
  history: string;
  proposal: string;
  overview: string;
  festivals: string;
  arts: string;
  photos: Photo[];
  sources: { title: string; url: string; note: string }[];
  bbox: number[];
  center: number[];
  detailNote: string;
  detailCounts: Record<string, number>;
};
type Overview = {
  name: string;
  caption: string;
  provinces: Province[];
  geometry: FeatureCollection;
  capitals: FeatureCollection;
  context: FeatureCollection;
  contextLabels: FeatureCollection;
  places: FeatureCollection;
  bbox: number[];
  auditSummary: {
    provinceCount: number;
    exactOverlapKm2: number;
    unassignedSourceFootprintKm2: number;
  };
};
type Change = {
  sourceId: string;
  currentDistrict: string;
  currentTehsil: string;
  proposedDistrict: string;
  proposedTehsil?: string;
  proposedDivision: string;
  proposedProvince: string;
  provinceId: string;
  proposedCapital: string;
  divisionCapital: string;
  reason: string;
  method: string;
};
type Review = {
  sourceId: string;
  district: string;
  tehsil: string;
  proposedProvince: string;
  decision: string;
  reason: string;
  source: string;
  previouslySelected?: boolean;
};
type Analysis = {
  changes: Change[];
  kpReview: Review[];
  decisions: string[];
  audit: {
    areaMethod: string;
    renderingMethod: string;
    sourceAdjustments: {
      province: string;
      overlapRemovedKm2: number;
      reason: string;
    }[];
    detailCoverage: {
      province: string;
      districtCoverageGapKm2: number;
      note: string;
    }[];
    seamReconciliation?: {
      province: string;
      areaKm2: number;
      reason: string;
    }[];
  };
};
type Level = 'province' | 'division' | 'district' | 'tehsil';
type MapStyle = 'political' | 'physical' | 'satellite' | 'nature';
type AtlasColors = {
  border: string;
  borderWidth: number;
  fills: Record<string, string>;
};
type DetailPage = FeatureCollection & { next: number | null; total: number };
type DivisionInfo = {
  id: string;
  name: string;
  capital: string;
  areaKm2: number;
  provinceAreaShare: number;
  districtCount: number;
  tehsilCount: number;
  districtStats: { name: string; areaKm2: number; tehsilCount: number }[];
  headquartersCoordinates: number[];
  headquartersSourceName: string;
  headquartersSource: string;
  description: string;
  landmark: string;
  landmarkSource: string;
  wikiUrl: string;
  photo: Photo;
  areaNote: string;
  hypotheticalDemographics?: HypotheticalDemographics;
};
type DistrictInfo = {
  id: string;
  name: string;
  capital: string;
  division: string;
  areaKm2: number;
  tehsilCount: number;
  hypotheticalDemographics?: HypotheticalDemographics;
  populationRank?: number;
  scenarioZone?: string;
  keyCities?: string[];
  density?: number;
  photos?: Photo[];
  summary?: string;
  wikiUrl?: string;
  reason?: string;
  sourceName?: string;
};
function DistrictProfile({
  district,
  areaRank,
  districtCount,
  onBack,
  onEdit,
  onIsolate,
}: {
  district: DistrictInfo;
  areaRank: number;
  districtCount: number;
  onBack: () => void;
  onEdit: () => void;
  onIsolate?: () => void;
}) {
  const scenario = district.hypotheticalDemographics;
  return (
    <article
      className="ua-profile ua-single-district"
      aria-label={`${district.name} district profile`}
    >
      <div className="ua-breadcrumb">
        <button type="button" onClick={onBack}>
          Punjab districts
        </button>
        <ChevronRight size={13} />
        <span>{district.name}</span>
      </div>
      <div className="ua-profile-heading">
        <small>PROPOSED DISTRICT · ALTERNATIVE WORLD</small>
        <h2>{district.name}</h2>
        <p>
          {district.division} division · {district.scenarioZone}
        </p>
      </div>
      <div className="ua-division-content">
        <PhotoGallery
          key={district.id}
          photos={district.photos || []}
          subject="district"
        />
        <p className="ua-data-note">
          Real location photographs from current Wikimedia listings. Dates and
          credits are shown for each image; these are not images of the
          fictional world.
        </p>
        <dl className="ua-division-facts">
          <div>
            <dt>Headquarters</dt>
            <dd>{district.capital}</dd>
          </div>
          <div>
            <dt>Mapped area</dt>
            <dd>{format(district.areaKm2)} km²</dd>
          </div>
          <div>
            <dt>Area rank</dt>
            <dd>
              #{areaRank} of {districtCount}
            </dd>
          </div>
          <div>
            <dt>Mapped tehsils</dt>
            <dd>{district.tehsilCount}</dd>
          </div>
          {scenario && (
            <>
              <div>
                <dt>Estimated population · fictional</dt>
                <dd>
                  {formatPopulation(scenario.total)} (
                  {scenario.total.toLocaleString('en-IN')})
                </dd>
              </div>
              <div>
                <dt>Population rank · fictional</dt>
                <dd>
                  #{district.populationRank} of {districtCount}
                </dd>
              </div>
              <div>
                <dt>Density · fictional</dt>
                <dd>{format(district.density || 0)} people / km²</dd>
              </div>
            </>
          )}
        </dl>
        <h3>Overview and geography</h3>
        <p>
          {district.summary ||
            `${district.name} is a proposed district of Punjab, administered from ${district.capital}.`}
        </p>
        {district.wikiUrl && (
          <p className="ua-data-note">
            <a href={district.wikiUrl} target="_blank" rel="noreferrer">
              Read the real location on Wikipedia
            </a>{' '}
            · Summary adapted from Wikipedia, CC BY-SA 4.0. Historical source
            boundaries may differ from this proposed district.
          </p>
        )}
        <h3>Name and proposed boundaries</h3>
        <p>{district.reason}</p>
        <p>
          Source district: {district.sourceName}. Area and density use the
          proposed geometry.
        </p>
        <h3>Headquarters and local centres</h3>
        <p>{district.keyCities?.join(' · ')}</p>
        <p className="ua-data-note">
          Illustrative local centres, not a measured city population ranking.
        </p>
        {scenario && (
          <section className="ua-scenario-population">
            <h3>Religion and population · fictional scenario</h3>
            <p className="ua-data-note">{scenario.note}</p>
            {scenario.religions.map((r, i) => {
              const share = (r.population / scenario.total) * 100;
              return (
                <div className="ua-demographic" key={r.name}>
                  <strong>{r.name}</strong>
                  <span>
                    {formatPopulation(r.population)} · {share.toFixed(1)}%
                  </span>
                  <div
                    style={{
                      height: 6,
                      background: '#e9edee',
                      borderRadius: 4,
                      margin: '6px 0 14px',
                    }}
                  >
                    <div
                      style={{
                        width: `${share}%`,
                        height: '100%',
                        background: [
                          '#628BAC',
                          '#D8B387',
                          '#86B5AA',
                          '#C4AED2',
                          '#D8A6AD',
                          '#C2C58F',
                          '#93C2BE',
                        ][i],
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        )}
        <p className="ua-data-note">
          Development and economic rankings are not assigned: this scenario does
          not include a comparable development index.
        </p>
        <button type="button" onClick={onBack}>
          Show all Punjab districts
        </button>
        {onIsolate && (
          <button type="button" onClick={onIsolate}>
            Show only this district
          </button>
        )}
        <button type="button" onClick={onEdit}>
          Edit this district
        </button>
      </div>
    </article>
  );
}
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const title = 'United Subcontinent — Alternative Political Geography';
const atlasColorsStorageKey = 'private-atlas-map-colors-v1';
const defaultBorderColor = '#38536a';
const defaultBorderWidth = 1;
const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
function readAtlasColors(): AtlasColors {
  const fallback = {
    border: defaultBorderColor,
    borderWidth: defaultBorderWidth,
    fills: {},
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = JSON.parse(
      localStorage.getItem(atlasColorsStorageKey) || 'null',
    );
    if (
      !saved ||
      !isHexColor(saved.border) ||
      !saved.fills ||
      typeof saved.fills !== 'object' ||
      Array.isArray(saved.fills)
    )
      return fallback;
    return {
      border: saved.border,
      borderWidth:
        typeof saved.borderWidth === 'number' &&
        Number.isFinite(saved.borderWidth) &&
        saved.borderWidth >= 0.5 &&
        saved.borderWidth <= 4
          ? saved.borderWidth
          : defaultBorderWidth,
      fills: Object.fromEntries(
        Object.entries(saved.fills).filter(
          ([id, color]) => id.length <= 100 && isHexColor(color),
        ),
      ) as Record<string, string>,
    };
  } catch {
    return fallback;
  }
}
function atlasFillExpression(
  overrides: Record<string, string>,
  fallback: string | ExpressionSpecification,
): string | ExpressionSpecification {
  return Object.entries(overrides).reduceRight<
    string | ExpressionSpecification
  >(
    (otherwise, [id, color]) =>
      [
        'case',
        ['==', ['get', 'id'], id],
        color,
        otherwise,
      ] as ExpressionSpecification,
    fallback,
  );
}
class AtlasError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function request<T>(
  action: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch('/api/private-atlas?' + action, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new AtlasError(
      'This custom atlas requires the map server. Open the server-enabled app to continue.',
      503,
    );
  const data = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new AtlasError(
      data.error || 'The custom map could not load.',
      response.status,
    );
  return data as T;
}
function format(n: number | null, suffix = '') {
  return n === null
    ? 'Not available'
    : n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + suffix;
}
function formatPopulation(n: number) {
  const unit = n >= 10_000_000 ? 10_000_000 : n >= 100_000 ? 100_000 : 1;
  return (
    (n / unit).toLocaleString('en-IN', { maximumFractionDigits: 2 }) +
    (unit === 10_000_000 ? ' crore' : unit === 100_000 ? ' lakh' : '')
  );
}
function fit(map: GLMap, b: number[], mobile = false) {
  map.fitBounds(
    [
      [b[0], b[1]],
      [b[2], b[3]],
    ],
    {
      padding: mobile ? { top: 45, right: 30, bottom: 50, left: 30 } : 70,
      duration: 650,
      maxZoom: 12,
    },
  );
}
function featureBounds(feature: Feature | undefined): number[] | null {
  if (!feature) return null;
  const raw = feature.properties?.bbox;
  let bbox = raw;
  if (typeof raw === 'string') {
    try {
      bbox = JSON.parse(raw);
    } catch {
      bbox = null;
    }
  }
  if (
    Array.isArray(bbox) &&
    bbox.length === 4 &&
    bbox.every((value) => typeof value === 'number' && Number.isFinite(value))
  )
    return bbox;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  function collect(value: unknown) {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      bounds[0] = Math.min(bounds[0], value[0]);
      bounds[1] = Math.min(bounds[1], value[1]);
      bounds[2] = Math.max(bounds[2], value[0]);
      bounds[3] = Math.max(bounds[3], value[1]);
      return;
    }
    for (const part of value) collect(part);
  }
  const geometry = feature.geometry;
  if (geometry && 'coordinates' in geometry) collect(geometry.coordinates);
  else if (geometry?.type === 'GeometryCollection')
    for (const part of geometry.geometries)
      if ('coordinates' in part) collect(part.coordinates);
  return Number.isFinite(bounds[0]) ? bounds : null;
}
function PhotoGallery({
  photos,
  subject = 'province',
}: {
  photos: Photo[];
  subject?: string;
}) {
  const [index, setIndex] = useState(0),
    photo = photos[index];
  if (!photo) return null;
  return (
    <>
      <div className="ua-gallery">
        <figure>
          <img
            src={photo.url}
            alt={photo.caption || photo.title.replace(/\.(jpg|jpeg|png)$/i, '')}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <figcaption>
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
              {photo.caption || photo.title.replace(/\.(jpg|jpeg|png)$/i, '')}
            </a>
            <span>
              {photo.author} ·{' '}
              <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                {photo.license}
              </a>{' '}
              · cropped
            </span>
            {photo.retrieved && (
              <span>
                {photo.date
                  ? `Photo date: ${photo.date} · `
                  : 'Capture date not documented · '}
                Source checked {photo.retrieved}
              </span>
            )}
          </figcaption>
        </figure>
      </div>
      {photos.length > 1 && (
        <div className="ua-photo-controls">
          <button
            type="button"
            aria-label={`Previous ${subject} photograph`}
            onClick={() =>
              setIndex((i) => (i + photos.length - 1) % photos.length)
            }
          >
            <ArrowLeft size={13} />
          </button>
          <span>
            {index + 1} / {photos.length} photographs
          </span>
          <button
            type="button"
            aria-label={`Next ${subject} photograph`}
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </>
  );
}

function RankingList({
  entries,
  className = '',
  label,
  formatValue,
  onSelect,
}: {
  entries: { id: string; name: string; context: string; value: number }[];
  className?: string;
  label: string;
  formatValue: (value: number) => string;
  onSelect?: (id: string) => void;
}) {
  return (
    <ol className={`ua-area-ranking ${className}`} aria-label={label}>
      {entries.map((entry, index) => {
        const content = (
          <>
            <b>{index + 1}</b>
            <span>
              <strong>{entry.name}</strong>
              <small>{entry.context}</small>
            </span>
            <em title={entry.value.toLocaleString('en-IN')}>
              {formatValue(entry.value)}
            </em>
          </>
        );
        return (
          <li key={entry.id}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(entry.id)}>
                {content}
              </button>
            ) : (
              <div>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function DivisionPanel({
  divisions,
  active,
  loading,
  onPick,
  onBack,
  onHeadquarters,
}: {
  divisions: Feature[];
  active?: Feature;
  loading: boolean;
  onPick: (feature: Feature) => void;
  onBack: () => void;
  onHeadquarters: (coordinates: number[]) => void;
}) {
  const info = active?.properties as DivisionInfo | undefined;
  const ranked = [...divisions].sort(
    (a, b) =>
      Number(b.properties?.areaKm2 || 0) - Number(a.properties?.areaKm2 || 0),
  );
  const mostDistricts = [...divisions].sort(
    (a, b) =>
      Number(b.properties?.districtCount || 0) -
      Number(a.properties?.districtCount || 0),
  )[0];
  const mostTehsils = [...divisions].sort(
    (a, b) =>
      Number(b.properties?.tehsilCount || 0) -
      Number(a.properties?.tehsilCount || 0),
  )[0];
  const activeAreaRank = info
    ? ranked.findIndex((feature) => feature.properties?.id === info.id) + 1
    : 0;
  const populationRanked = [...divisions].sort(
    (a, b) =>
      Number(b.properties?.hypotheticalDemographics?.total || 0) -
        Number(a.properties?.hypotheticalDemographics?.total || 0) ||
      String(a.properties?.name).localeCompare(String(b.properties?.name)),
  );
  const activePopulationRank = info
    ? populationRanked.findIndex(
        (feature) => feature.properties?.id === info.id,
      ) + 1
    : 0;
  return (
    <article
      className="ua-profile ua-division-profile"
      aria-label="Punjab division information"
    >
      <div className="ua-profile-heading">
        <span className="ua-kicker">PUNJAB · PROPOSED DIVISIONS</span>
        <h2>{info ? `${info.name} Division` : 'Punjab divisions'}</h2>
        <label className="ua-division-picker">
          Choose division
          <select
            aria-label="Choose Punjab division"
            value={info?.id || ''}
            disabled={loading}
            onChange={(event) => {
              const feature = divisions.find(
                (item) => item.properties?.id === event.currentTarget.value,
              );
              if (feature) onPick(feature);
              else onBack();
            }}
          >
            <option value="">All divisions</option>
            {divisions.map((feature) => (
              <option
                key={String(feature.properties?.id)}
                value={String(feature.properties?.id)}
              >
                {String(feature.properties?.name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p className="ua-summary">Loading division profiles…</p>
      ) : info ? (
        <>
          <PhotoGallery key={info.id} photos={[info.photo]} />
          <div className="ua-division-content">
            <p>{info.description}</p>
            <dl className="ua-division-facts">
              <div>
                <dt>Headquarters</dt>
                <dd>{info.capital}</dd>
              </div>
              {info.headquartersSourceName !== info.capital && (
                <div>
                  <dt>Present-day city</dt>
                  <dd>{info.headquartersSourceName}</dd>
                </div>
              )}
              <div>
                <dt>Total area</dt>
                <dd>{format(info.areaKm2)} km²</dd>
              </div>
              <div>
                <dt>Area rank</dt>
                <dd>
                  #{activeAreaRank} of {divisions.length}
                </dd>
              </div>
              <div>
                <dt>Share of Punjab area</dt>
                <dd>{info.provinceAreaShare}%</dd>
              </div>
              <div>
                <dt>Districts</dt>
                <dd>{info.districtCount}</dd>
              </div>
              <div>
                <dt>Mapped tehsils / subdistricts</dt>
                <dd>{info.tehsilCount}</dd>
              </div>
              {info.hypotheticalDemographics && (
                <>
                  <div>
                    <dt>Estimated population · fictional</dt>
                    <dd>
                      {formatPopulation(info.hypotheticalDemographics.total)}
                    </dd>
                  </div>
                  <div>
                    <dt>Population rank · fictional</dt>
                    <dd>
                      #{activePopulationRank} of {divisions.length}
                    </dd>
                  </div>
                </>
              )}
            </dl>
            <button
              type="button"
              onClick={() => onHeadquarters(info.headquartersCoordinates)}
            >
              <MapPinned size={14} /> Locate headquarters
            </button>
            <h3>Districts in this division</h3>
            <table className="ua-division-districts">
              <thead>
                <tr>
                  <th>District</th>
                  <th>Tehsils</th>
                  <th>Area km²</th>
                </tr>
              </thead>
              <tbody>
                {info.districtStats.map((district) => (
                  <tr key={district.name}>
                    <td>{district.name}</td>
                    <td>{district.tehsilCount}</td>
                    <td>{format(district.areaKm2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="ua-data-note">
              {info.areaNote} Tehsil counts reflect the map’s retained source
              coverage. Population, when shown, sums the fictional district
              allocations.
            </p>
            <h3>Featured landmark</h3>
            <p>{info.landmark}</p>
            <div className="ua-division-links">
              <a href={info.wikiUrl} target="_blank" rel="noreferrer">
                Headquarters on Wikipedia
              </a>
              <a href={info.landmarkSource} target="_blank" rel="noreferrer">
                Landmark reference
              </a>
              <a
                href={info.headquartersSource}
                target="_blank"
                rel="noreferrer"
              >
                City point source
              </a>
            </div>
            <button type="button" onClick={onBack}>
              Show all Punjab divisions
            </button>
          </div>
        </>
      ) : (
        <div className="ua-division-content">
          <p>
            Select a division or its headquarters point to open its profile.
            Headquarters are marked with burgundy dots.
          </p>
          <div className="ua-ranking-highlights">
            <div>
              <small>Largest division</small>
              <strong>{String(ranked[0]?.properties?.name)}</strong>
              <span>{format(Number(ranked[0]?.properties?.areaKm2))} km²</span>
            </div>
            <div>
              <small>Smallest division</small>
              <strong>{String(ranked.at(-1)?.properties?.name)}</strong>
              <span>
                {format(Number(ranked.at(-1)?.properties?.areaKm2))} km²
              </span>
            </div>
            <div>
              <small>Most districts</small>
              <strong>{String(mostDistricts?.properties?.name)}</strong>
              <span>{Number(mostDistricts?.properties?.districtCount)}</span>
            </div>
            <div>
              <small>Most tehsils</small>
              <strong>{String(mostTehsils?.properties?.name)}</strong>
              <span>{Number(mostTehsils?.properties?.tehsilCount)}</span>
            </div>
          </div>
          <h3>Division area ranking</h3>
          <ol className="ua-area-ranking ua-division-area-ranking">
            {ranked.map((feature, index) => (
              <li key={String(feature.properties?.id)}>
                <button type="button" onClick={() => onPick(feature)}>
                  <b>{index + 1}</b>
                  <span>
                    <strong>{String(feature.properties?.name)}</strong>
                    <small>HQ: {String(feature.properties?.capital)}</small>
                  </span>
                  <em
                    title={Number(feature.properties?.areaKm2).toLocaleString(
                      'en-IN',
                    )}
                  >
                    {format(Number(feature.properties?.areaKm2))} km²
                  </em>
                </button>
              </li>
            ))}
          </ol>
          <h3>Division population ranking · fictional</h3>
          <RankingList
            className="ua-division-population-ranking"
            label="Divisions ranked by population"
            entries={populationRanked.map((feature) => ({
              id: String(feature.properties?.id),
              name: String(feature.properties?.name),
              context: `HQ: ${feature.properties?.capital}`,
              value: Number(
                feature.properties?.hypotheticalDemographics?.total || 0,
              ),
            }))}
            formatValue={formatPopulation}
            onSelect={(id) => {
              const feature = divisions.find(
                (division) => division.properties?.id === id,
              );
              if (feature) onPick(feature);
            }}
          />
          <p className="ua-data-note">
            Areas are measured from the proposed district unions. Population
            ranks sum the fictional allocations of the displayed districts.
          </p>
        </div>
      )}
    </article>
  );
}

const religionPopulationLabels: Record<string, string> = {
  Sikhism: 'Sikh',
  Hinduism: 'Hindu',
  Islam: 'Islam',
  Christianity: 'Christian',
  Jainism: 'Jain',
  Buddhism: 'Buddhist',
  Other: 'other communities',
};
const byRankingValue =
  <T extends { name: string }>(value: (record: T) => number) =>
  (a: T, b: T) =>
    value(b) - value(a) || a.name.localeCompare(b.name);
const formatArea = (value: number) => format(value) + ' km²';

function DistrictOverviewPanel({
  districts,
  loading,
  onSelect,
}: {
  districts: Feature[];
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const [religion, setReligion] = useState('Sikhism');
  const records = districts.map(
    (feature) => feature.properties as DistrictInfo,
  );
  const scenario = sumDistrictDemographics(districts);
  const religions = scenario?.religions.map((item) => item.name) || [];
  const selectedReligion = religions.includes(religion)
    ? religion
    : religions[0] || 'Sikhism';
  const areaRanked = [...records].sort(
    byRankingValue((record: DistrictInfo) => record.areaKm2),
  );
  const population = (record: DistrictInfo) =>
    record.hypotheticalDemographics?.total || 0;
  const populationRanked = [...records].sort(byRankingValue(population));
  const religionPopulation = (record: DistrictInfo) =>
    record.hypotheticalDemographics?.religions.find(
      (item) => item.name === selectedReligion,
    )?.population || 0;
  const religionRanked = [...records]
    .sort(byRankingValue(religionPopulation))
    .slice(0, 10);
  const divisions = summarizeDistrictDivisions(districts);
  const divisionAreaRanked = [...divisions].sort(
    byRankingValue((division: (typeof divisions)[number]) => division.areaKm2),
  );
  const divisionPopulationRanked = [...divisions].sort(
    byRankingValue(
      (division: (typeof divisions)[number]) =>
        division.hypotheticalDemographics?.total || 0,
    ),
  );
  const alphabetical = [...records].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const mostTehsils = [...records].sort(
    (a, b) => b.tehsilCount - a.tehsilCount,
  )[0];
  const districtEntries = (
    ranked: DistrictInfo[],
    value: (record: DistrictInfo) => number,
  ) =>
    ranked.map((record) => ({
      id: record.id,
      name: record.name,
      context: record.division + ' Division',
      value: value(record),
    }));
  const divisionEntries = (
    ranked: typeof divisions,
    value: (division: (typeof divisions)[number]) => number,
  ) =>
    ranked.map((division) => ({
      id: division.name,
      name: division.name,
      context: division.districtCount + ' districts · HQ: ' + division.capital,
      value: value(division),
    }));
  const religionHeading =
    'Top 10 districts by ' +
    (religionPopulationLabels[selectedReligion] || selectedReligion) +
    ' population';
  return (
    <article
      className="ua-profile ua-district-overview"
      aria-label="Punjab district rankings and directory"
    >
      <div className="ua-profile-heading">
        <span className="ua-kicker">PUNJAB · PROPOSED DISTRICTS</span>
        <h2>Punjab districts</h2>
        <p>
          {records.length} districts · {divisions.length} divisions · ranked
          largest first
        </p>
      </div>
      <div className="ua-division-content">
        {loading ? (
          <p>Loading district statistics…</p>
        ) : (
          <>
            <h3>Population · fictional scenario</h3>
            <p>
              Punjab: <strong>{formatPopulation(scenario?.total || 0)}</strong>{' '}
              ·{' '}
              {scenario?.religions
                .map(
                  (item) => item.name + ' ' + formatPopulation(item.population),
                )
                .join(' · ')}
              .
            </p>
            <p className="ua-data-note">
              Illustrative alternative-world estimates. Statistics use the same{' '}
              {records.length} districts shown on the map, including merged
              districts. Select a district to see its allocation and source
              profile.
            </p>
            <div className="ua-ranking-highlights">
              <div>
                <small>Largest district</small>
                <strong>{areaRanked[0]?.name}</strong>
                <span>{formatArea(areaRanked[0]?.areaKm2 || 0)}</span>
              </div>
              <div>
                <small>Smallest district</small>
                <strong>{areaRanked.at(-1)?.name}</strong>
                <span>{formatArea(areaRanked.at(-1)?.areaKm2 || 0)}</span>
              </div>
              <div>
                <small>Most tehsils</small>
                <strong>{mostTehsils?.name}</strong>
                <span>{mostTehsils?.tehsilCount} mapped</span>
              </div>
              <div>
                <small>Most populated district</small>
                <strong>{populationRanked[0]?.name}</strong>
                <span>
                  {formatPopulation(
                    populationRanked[0]?.hypotheticalDemographics?.total || 0,
                  )}
                </span>
              </div>
            </div>
            <section className="ua-ranking-section">
              <h3>District area ranking</h3>
              <p className="ua-data-note">
                All {records.length} districts · area in km²
              </p>
              <RankingList
                className="ua-district-area-ranking"
                label="Districts ranked by area"
                entries={districtEntries(
                  areaRanked,
                  (record) => record.areaKm2,
                )}
                formatValue={formatArea}
                onSelect={onSelect}
              />
            </section>
            <section className="ua-ranking-section">
              <h3>District population ranking · fictional</h3>
              <p className="ua-data-note">
                All {records.length} districts · total residents
              </p>
              <RankingList
                className="ua-district-population-ranking"
                label="Districts ranked by population"
                entries={districtEntries(populationRanked, population)}
                formatValue={formatPopulation}
                onSelect={onSelect}
              />
            </section>
            <section className="ua-ranking-section">
              <h3>Division area ranking</h3>
              <p className="ua-data-note">
                All {divisions.length} divisions · combined district area
              </p>
              <RankingList
                className="ua-division-area-ranking"
                label="Divisions ranked by area"
                entries={divisionEntries(
                  divisionAreaRanked,
                  (division) => division.areaKm2,
                )}
                formatValue={formatArea}
              />
            </section>
            <section className="ua-ranking-section">
              <h3>Division population ranking · fictional</h3>
              <p className="ua-data-note">
                All {divisions.length} divisions · combined district population
              </p>
              <RankingList
                className="ua-division-population-ranking"
                label="Divisions ranked by population"
                entries={divisionEntries(
                  divisionPopulationRanked,
                  (division) => division.hypotheticalDemographics?.total || 0,
                )}
                formatValue={formatPopulation}
              />
            </section>
            <section className="ua-ranking-section ua-religion-ranking">
              <h3>{religionHeading}</h3>
              <label className="ua-division-picker">
                Rank by religious population
                <select
                  aria-label="Top 10 districts by religion population"
                  value={selectedReligion}
                  onChange={(event) => setReligion(event.currentTarget.value)}
                >
                  {religions.map((name) => (
                    <option key={name} value={name}>
                      Top 10 districts by{' '}
                      {religionPopulationLabels[name] || name} population
                    </option>
                  ))}
                </select>
              </label>
              <p className="ua-data-note">
                Ranked by number of residents · fictional scenario
              </p>
              <RankingList
                className="ua-district-religion-ranking"
                label={religionHeading}
                entries={districtEntries(religionRanked, religionPopulation)}
                formatValue={formatPopulation}
                onSelect={onSelect}
              />
            </section>
            <details className="ua-district-directory-section">
              <summary>District directory · {records.length} districts</summary>
              <p className="ua-data-note">
                Districts listed alphabetically with their proposed
                headquarters.
              </p>
              <table className="ua-division-districts ua-district-directory">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Capital / HQ</th>
                  </tr>
                </thead>
                <tbody>
                  {alphabetical.map((district) => (
                    <tr key={district.id}>
                      <td>{district.name}</td>
                      <td>{district.capital}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <p className="ua-data-note">
              Area uses WGS84 ellipsoidal polygon measurement. Tehsil counts
              reflect retained map coverage.
            </p>
          </>
        )}
      </div>
    </article>
  );
}

function ProvincePanel({
  province,
  onFocus,
  onDetail,
}: {
  province: Province;
  onFocus: () => void;
  onDetail: (level: Level) => void;
}) {
  const p = province,
    scenario = p.hypotheticalDemographics;
  return (
    <article
      className="ua-profile"
      aria-label={p.name + ' province information'}
    >
      <div className="ua-profile-heading">
        <span className="ua-kicker">{p.classification} · proposed</span>
        <h2>{p.name}</h2>
        <span className="ua-accent" style={{ background: p.color }} />
      </div>
      <PhotoGallery key={p.id} photos={p.photos.slice(0, 5)} />
      <div className="ua-identity">
        <svg
          viewBox="0 0 160 100"
          role="img"
          aria-label={p.name + ' geographic silhouette'}
        >
          <path d={p.silhouette} fill={p.color} fillRule="evenodd" />
        </svg>
        <div>
          <small>PROPOSED CAPITAL</small>
          <strong>{p.capital}</strong>
          <button type="button" onClick={onFocus}>
            <MapPinned size={14} />
            Explore province
          </button>
        </div>
      </div>
      <div className="ua-summary">
        {p.overview.split('\n\n').map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      <dl className="ua-facts">
        <div>
          <dt>Polygon area</dt>
          <dd>
            {format(p.areaKm2, ' km²')}
            <small>Calculated proposal</small>
          </dd>
        </div>
        <div>
          <dt>{scenario ? 'Hypothetical population' : 'Population'}</dt>
          <dd>
            {scenario ? formatPopulation(scenario.total) : format(p.population)}
            <small>
              {scenario
                ? scenario.total.toLocaleString('en-IN') +
                  ' · user-provided scenario'
                : p.census
                  ? 'Real-world census ' + p.census.year
                  : 'No matched aggregate'}
            </small>
          </dd>
        </div>
        <div>
          <dt>Density</dt>
          <dd>
            {format(
              scenario
                ? Math.round((scenario.total / p.areaKm2) * 10) / 10
                : p.density,
              ' / km²',
            )}
            <small>
              {scenario
                ? 'Hypothetical total / atlas area'
                : p.density !== null
                  ? 'Census / atlas polygon area'
                  : 'No matched aggregate'}
            </small>
          </dd>
        </div>
        <div>
          <dt>Forest area / cover</dt>
          <dd>
            {format(p.forestArea)} / {format(p.forestPercent)}
            <small>No verified land-cover aggregation</small>
          </dd>
        </div>
      </dl>
      {!scenario && <p className="ua-data-note">{p.statisticsNote}</p>}
      {scenario && (
        <details open className="ua-scenario-population">
          <summary>Hypothetical population by religion</summary>
          <p className="ua-data-note">{scenario.note}</p>
          {scenario.religions.map((r, i) => {
            const share = (r.population / scenario.total) * 100,
              color = ['#628BAC', '#D8B387', '#86B5AA'][i % 3];
            return (
              <div className="ua-demographic" key={r.name}>
                <span>
                  <i style={{ background: color }} />
                  {r.name}
                </span>
                <strong>
                  {formatPopulation(r.population)} · {share.toFixed(2)}%
                </strong>
                <div>
                  <b style={{ width: share + '%', background: color }} />
                </div>
              </div>
            );
          })}
        </details>
      )}
      <details open>
        <summary>Identity & geography</summary>
        <dl className="ua-text-facts">
          <dt>Name & etymology</dt>
          <dd>{p.etymology}</dd>
          <dt>Largest city</dt>
          <dd>{p.largestCity}</dd>
          <dt>Selected cities</dt>
          <dd>
            {p.majorCities.join(', ') || 'Not available'}
            <small>
              Natural Earth city catalogue; illustrative, not a current
              population ranking.
            </small>
          </dd>
          <dt>Rivers</dt>
          <dd>{p.rivers}</dd>
          <dt>Landscapes</dt>
          <dd>{p.landscape}</dd>
        </dl>
      </details>
      <details open>
        <summary>Languages & communities</summary>
        {p.officialLanguages && (
          <small className="ua-kicker">Proposed official languages</small>
        )}
        <p>
          {(p.officialLanguages || p.languages).join(', ') ||
            'Not available — a matched language profile has not been verified.'}
        </p>
        <p>
          {p.communities.join(', ') ||
            'Not available — no matched community profile.'}
        </p>
        {p.census && (
          <>
            <small className="ua-kicker">
              CENSUS {p.census.year} · RETAINED REAL-WORLD UNIT
            </small>
            {p.census.religions.map((r, i) => (
              <div className="ua-demographic" key={r.name}>
                <span>
                  <i
                    style={{
                      background: [
                        '#628BAC',
                        '#A9B899',
                        '#B6A1C5',
                        '#D8B387',
                        '#D6A5AC',
                        '#86B5AA',
                      ][i % 6],
                    }}
                  />
                  {r.name}
                </span>
                <strong>{r.share}%</strong>
                <div>
                  <b
                    style={{
                      width: r.share + '%',
                      background: [
                        '#628BAC',
                        '#A9B899',
                        '#B6A1C5',
                        '#D8B387',
                        '#D6A5AC',
                        '#86B5AA',
                      ][i % 6],
                    }}
                  />
                </div>
              </div>
            ))}
            <details>
              <summary>Reported mother tongues</summary>
              {p.census.languages.map((r) => (
                <p key={r.name}>
                  {r.name} <strong>{r.share}%</strong>
                </p>
              ))}
            </details>
          </>
        )}
        <p>
          <strong>Festivals.</strong> {p.festivals}
        </p>
        <p>{p.arts}</p>
      </details>
      <details open>
        <summary>Sacred & cultural heritage</summary>
        <ul>
          {p.heritage.map((place) => (
            <li key={place}>{place}</li>
          ))}
        </ul>
        <p className="ua-data-note">
          Representative Hindu, Muslim, Sikh, Buddhist, Christian, Jain and
          other traditions where relevant. These sites are not demographic
          evidence.
        </p>
      </details>
      <details>
        <summary>History & proposed administration</summary>
        <p>{p.history}</p>
        <p>{p.proposal}</p>
        <p>{p.detailNote}</p>
        <div className="ua-detail-links">
          {(['division', 'district', 'tehsil'] as Level[]).map((level) => (
            <button
              type="button"
              key={level}
              disabled={!p.detailCounts[level]}
              onClick={() => onDetail(level)}
            >
              {level === 'division'
                ? 'Divisions'
                : level === 'district'
                  ? 'Districts'
                  : 'Tehsils / subdistricts'}{' '}
              <span>{p.detailCounts[level] || 0}</span>
            </button>
          ))}
        </div>
      </details>
      <details>
        <summary>References & provenance</summary>
        {p.sources.map((s, i) => (
          <p key={i}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>
            <small>{s.note}</small>
          </p>
        ))}
      </details>
    </article>
  );
}

function DistrictEditor({
  districts,
  edits,
  selectedId,
  mergeWith,
  onPick,
  onRename,
  onColor,
  onMergeWith,
  onMerge,
  onReset,
}: {
  districts: FeatureCollection;
  edits: DistrictEdits;
  selectedId: string;
  mergeWith: string;
  onPick: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onColor: (id: string, color: string) => void;
  onMergeWith: (id: string) => void;
  onMerge: (id: string, otherId: string) => void;
  onReset: () => void;
}) {
  const entries = districts.features
    .map((feature) => ({
      id: String(feature.properties?.id || ''),
      name: String(feature.properties?.name || ''),
      color: String(feature.properties?.color || '#6688aa'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const current = entries.find((entry) => entry.id === selectedId);
  return (
    <section className="ua-district-editor" aria-label="Edit Punjab districts">
      <span className="ua-kicker">PUNJAB DISTRICT MAP</span>
      <h2>Edit districts</h2>
      <p>
        {entries.length} colored districts. Select a district on the map or
        below to change its name and color, or merge it with another district.
        Your edits are saved on this device.
      </p>
      {!current ? (
        <p>Loading district boundaries…</p>
      ) : (
        <>
          <label htmlFor="ua-edit-district">District</label>
          <select
            id="ua-edit-district"
            value={current.id}
            onChange={(event) => onPick(event.target.value)}
          >
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <label htmlFor="ua-edit-name">District name</label>
          <input
            id="ua-edit-name"
            maxLength={70}
            value={edits.names[current.id] ?? current.name}
            onChange={(event) => onRename(current.id, event.target.value)}
          />
          <label htmlFor="ua-edit-color">District color</label>
          <div className="ua-district-color">
            <input
              id="ua-edit-color"
              type="color"
              value={edits.colors[current.id] || current.color}
              onChange={(event) => onColor(current.id, event.target.value)}
            />
            <span>{edits.colors[current.id] || current.color}</span>
          </div>
          <label htmlFor="ua-merge-district">Merge with</label>
          <select
            id="ua-merge-district"
            value={mergeWith}
            onChange={(event) => onMergeWith(event.target.value)}
          >
            <option value="">Choose another district</option>
            {entries
              .filter((entry) => entry.id !== current.id)
              .map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="ua-merge-action"
            disabled={!mergeWith || mergeWith === current.id}
            onClick={() => onMerge(current.id, mergeWith)}
          >
            Merge into {current.name}
          </button>
          <small>
            Merging combines both polygons. The selected district keeps its name
            and color; source boundaries remain available in the original atlas
            data.
          </small>
          <button
            type="button"
            className="ua-reset-districts"
            onClick={onReset}
          >
            <RotateCcw size={14} /> Restore requested layout
          </button>
        </>
      )}
    </section>
  );
}

function AtlasMap({
  data,
  active,
  selected,
  punjabOnly,
  focusedDistrictId,
  inspectedAreaId,
  mapStyle,
  colors,
  districtEditing,
  editingDistrictId,
  places,
  headquarters,
  level,
  dark,
  labels,
  context,
  onSelect,
  onHover,
  onError,
  mapRef,
  detail,
  districtOutlines,
  tehsilColorMode,
  precise,
  onDetailInspect,
}: {
  data: Overview;
  active: string;
  selected: string;
  punjabOnly: boolean;
  focusedDistrictId: string;
  inspectedAreaId: string;
  mapStyle: MapStyle;
  colors: AtlasColors;
  districtEditing: boolean;
  editingDistrictId: string;
  places: boolean;
  headquarters: boolean;
  level: Level;
  dark: boolean;
  labels: boolean;
  context: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string) => void;
  onError: (message: string) => void;
  mapRef: React.RefObject<GLMap | null>;
  detail: FeatureCollection;
  districtOutlines: FeatureCollection;
  tehsilColorMode: TehsilColorMode;
  precise: FeatureCollection;
  onDetailInspect: (feature: Feature) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ onSelect, onHover, onError, onDetailInspect, level });
  useEffect(() => {
    latest.current = { onSelect, onHover, onError, onDetailInspect, level };
  }, [onSelect, onHover, onError, onDetailInspect, level]);
  const [loaded, setLoaded] = useState(false);
  const previousFocusedDistrictId = useRef('');
  useEffect(() => {
    let cancelled = false;
    let map: GLMap | undefined;
    void import('maplibre-gl')
      .then((gl) => {
        if (cancelled || !host.current) return;
        gl.setWorkerUrl(mapWorkerUrl);
        gl.setWorkerCount(2);
        const instance = new gl.Map({
          container: host.current,
          style: {
            version: 8,
            glyphs: location.origin + '/fonts/{fontstack}/{range}.pbf',
            sources: {},
            layers: [
              {
                id: 'background',
                type: 'background',
                paint: { 'background-color': '#eaf0f2' },
              },
            ],
          },
          center: [79, 24],
          zoom: 3.2,
          minZoom: 2,
          maxZoom: 16,
          renderWorldCopies: false,
          dragRotate: false,
          pitchWithRotate: false,
          attributionControl: false,
        });
        map = instance;
        mapRef.current = instance;
        instance.touchZoomRotate.disableRotation();
        instance.on('dataloading', () =>
          host.current?.setAttribute('aria-busy', 'true'),
        );
        instance.on('movestart', () =>
          host.current?.setAttribute('aria-busy', 'true'),
        );
        instance.on('idle', () =>
          host.current?.setAttribute('aria-busy', 'false'),
        );
        instance.on('load', () => {
          if (!map) return;
          for (const [id, service] of [
            ['satellite', 'World_Imagery'],
            ['physical', 'World_Topo_Map'],
          ]) {
            map.addSource('base-' + id, {
              type: 'raster',
              tiles: [
                `https://services.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`,
              ],
              tileSize: 256,
              maxzoom: 19,
              attribution: 'Tiles © Esri and contributors',
            });
            map.addLayer({
              id: 'base-' + id,
              type: 'raster',
              source: 'base-' + id,
              layout: { visibility: 'none' },
            });
          }
          const [west, south, east, north] = natureSources.forest.bbox;
          map.addSource('tree-cover', {
            type: 'image',
            url: natureSources.forest.file,
            coordinates: [
              [west, north],
              [east, north],
              [east, south],
              [west, south],
            ],
          });
          map.addLayer({
            id: 'tree-cover',
            type: 'raster',
            source: 'tree-cover',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 0.78 },
          });
          map.addSource('provinces', {
            type: 'geojson',
            data: data.geometry,
            promoteId: 'id',
          });
          map.addSource('details', { type: 'geojson', data: empty });
          map.addSource('capitals', { type: 'geojson', data: data.capitals });
          map.addSource('province-labels', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: data.provinces.map((p) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: p.center },
                properties: {
                  id: p.id,
                  name: p.name,
                  small: p.classification === 'Union territory',
                },
              })),
            },
          });
          map.addSource('disputed', { type: 'geojson', data: data.context });
          map.addSource('context-labels', {
            type: 'geojson',
            data: data.contextLabels,
          });
          map.addSource('places', { type: 'geojson', data: data.places });
          map.addLayer({
            id: 'disputed-fill',
            type: 'fill',
            source: 'disputed',
            filter: ['==', ['get', 'outside'], true],
            paint: { 'fill-color': '#c4c9cc', 'fill-opacity': 0.35 },
          });
          map.addLayer({
            id: 'disputed-borders',
            type: 'line',
            source: 'disputed',
            filter: ['==', ['get', 'outside'], true],
            paint: {
              'line-color': '#687e91',
              'line-width': 1.2,
              'line-dasharray': [3, 3],
            },
          });
          map.addLayer({
            id: 'province-fill',
            type: 'fill',
            source: 'provinces',
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                1,
                0.84,
              ],
              'fill-opacity-transition': { duration: 180 },
            },
          });
          map.addLayer({
            id: 'province-borders',
            type: 'line',
            source: 'provinces',
            paint: {
              'line-color': '#506375',
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                3,
                0.65,
                8,
                1.25,
              ],
            },
          });
          map.addLayer({
            id: 'province-highlight',
            type: 'line',
            source: 'provinces',
            filter: ['==', 'id', ''],
            paint: { 'line-color': '#183956', 'line-width': 2.6 },
          });
          map.addLayer({
            id: 'detail-fill',
            type: 'fill',
            source: 'details',
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.08 },
          });
          map.addLayer({
            id: 'detail-borders',
            type: 'line',
            source: 'details',
            paint: { 'line-color': '#38536a', 'line-width': 1 },
          });
          map.addSource('punjab-district-outlines', {
            type: 'geojson',
            data: empty,
          });
          map.addLayer({
            id: 'punjab-district-outlines',
            type: 'line',
            source: 'punjab-district-outlines',
            paint: { 'line-color': '#38536a', 'line-width': 2.3 },
          });
          map.addLayer({
            id: 'detail-selected',
            type: 'line',
            source: 'details',
            filter: ['==', 'id', ''],
            paint: { 'line-color': '#12344d', 'line-width': 3 },
          });
          map.addLayer({
            id: 'detail-labels',
            type: 'symbol',
            source: 'details',
            minzoom: 5,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['literal', ['Noto Sans Regular']],
              'text-size': 11,
              'text-max-width': 9,
            },
            paint: {
              'text-color': '#28445b',
              'text-halo-color': '#f8fafb',
              'text-halo-width': 1.3,
            },
          });
          map.addLayer({
            id: 'province-names',
            type: 'symbol',
            source: 'province-labels',
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['literal', ['Noto Sans Regular']],
              'text-size': [
                'step',
                ['zoom'],
                ['case', ['get', 'small'], 8.5, 11],
                4,
                ['case', ['get', 'small'], 10, 13],
                6,
                ['case', ['get', 'small'], 11, 14],
              ],
              'text-max-width': 10,
              'text-allow-overlap': false,
              'text-variable-anchor': [
                'center',
                'top',
                'bottom',
                'left',
                'right',
              ],
              'text-radial-offset': 0.6,
            },
            paint: {
              'text-color': '#18364d',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            },
          });
          map.addLayer({
            id: 'capital-dots',
            type: 'circle',
            source: 'capitals',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                2,
                2,
                4,
                3.5,
                8,
                4,
              ],
              'circle-color': '#254257',
              'circle-stroke-width': 1.3,
              'circle-stroke-color': '#ffffff',
            },
          });
          map.addLayer({
            id: 'capital-names',
            type: 'symbol',
            source: 'capitals',
            layout: {
              'text-field': [
                'step',
                ['zoom'],
                [
                  'case',
                  [
                    'match',
                    ['get', 'province'],
                    [
                      'punjab',
                      'in-delhi',
                      'sindh',
                      'in-maharashtra',
                      'in-tamil-nadu',
                      'in-west-bengal',
                      'jammu-kashmir',
                    ],
                    true,
                    false,
                  ],
                  ['get', 'name'],
                  '',
                ],
                4.5,
                ['get', 'name'],
              ],
              'text-font': ['literal', ['Noto Sans Regular']],
              'text-size': 10,
              'text-offset': [0, 1],
              'text-anchor': 'top',
            },
            paint: {
              'text-color': '#28445b',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.4,
            },
          });
          map.addLayer({
            id: 'context-names',
            type: 'symbol',
            source: 'context-labels',
            filter: ['==', ['get', 'outside'], true],
            layout: {
              'text-field': [
                'concat',
                ['get', 'name'],
                '\nChina-administered · disputed',
              ],
              'text-font': ['literal', ['Noto Sans Regular']],
              'text-size': 9,
              'text-max-width': 14,
            },
            paint: {
              'text-color': '#627684',
              'text-halo-color': '#eef1f2',
              'text-halo-width': 1.3,
            },
          });
          map.addLayer({
            id: 'place-dots',
            type: 'circle',
            source: 'places',
            filter: ['==', 'province', ''],
            minzoom: 4.5,
            paint: {
              'circle-radius': [
                'case',
                ['==', ['get', 'kind'], 'heritage'],
                4,
                2.7,
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'kind'], 'heritage'],
                '#a67235',
                '#35536a',
              ],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 1.2,
            },
          });
          map.addLayer({
            id: 'place-names',
            type: 'symbol',
            source: 'places',
            filter: ['==', 'province', ''],
            minzoom: 5,
            layout: {
              'text-field': ['get', 'name'],
              'text-font': ['literal', ['Noto Sans Regular']],
              'text-size': 10,
              'text-offset': [0, 1.1],
              'text-anchor': 'top',
              'text-max-width': 12,
            },
            paint: {
              'text-color': '#35536a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            },
          });
          map.moveLayer('disputed-borders', 'province-names');
          map.moveLayer('province-names', 'place-names');
          map.addSource('division-headquarters', {
            type: 'geojson',
            data: empty,
          });
          map.addLayer({
            id: 'division-headquarters-dots',
            type: 'circle',
            source: 'division-headquarters',
            paint: {
              'circle-radius': 5,
              'circle-color': '#8a3d54',
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          });
          map.addLayer({
            id: 'division-headquarters-names',
            type: 'symbol',
            source: 'division-headquarters',
            layout: {
              'text-field': ['concat', ['get', 'name'], ' · HQ'],
              'text-font': ['literal', ['Noto Sans Regular']],
              'text-size': 11,
              'text-variable-anchor': ['top', 'bottom', 'right', 'left'],
              'text-radial-offset': 0.7,
              'text-max-width': 10,
            },
            paint: {
              'text-color': '#6b243b',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            },
          });
          map.on('click', 'division-headquarters-dots', (event) => {
            const feature = event.features?.[0];
            if (feature) latest.current.onDetailInspect(feature);
          });
          map.on('mouseenter', 'division-headquarters-dots', () => {
            if (map) map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', 'division-headquarters-dots', () => {
            if (map) map.getCanvas().style.cursor = '';
          });
          map.addControl(
            new gl.AttributionControl({
              customAttribution:
                'Hypothetical geography · LGD/Bharatlas · Esri India · WFP/OCHA CC BY-IGO · Natural Earth',
              compact: true,
            }),
          );
          let hovered = '';
          map.on('mousemove', 'province-fill', (event) => {
            if (!map) return;
            const id = String(event.features?.[0]?.properties?.id || '');
            if (hovered === id) return;
            if (hovered)
              map.setFeatureState(
                { source: 'provinces', id: hovered },
                { hover: false },
              );
            hovered = id;
            if (id)
              map.setFeatureState({ source: 'provinces', id }, { hover: true });
            map.getCanvas().style.cursor = 'pointer';
            if (window.matchMedia('(hover: hover)').matches)
              latest.current.onHover(id);
          });
          map.on('mouseleave', 'province-fill', () => {
            if (!map) return;
            if (hovered)
              map.setFeatureState(
                { source: 'provinces', id: hovered },
                { hover: false },
              );
            hovered = '';
            map.getCanvas().style.cursor = '';
          });
          map.on('click', 'province-fill', (event) => {
            if (
              latest.current.level !== 'province' ||
              map?.queryRenderedFeatures(event.point, {
                layers: ['place-dots'],
              }).length
            )
              return;
            const id = String(event.features?.[0]?.properties?.id || '');
            if (id) latest.current.onSelect(id);
          });
          map.on('click', 'detail-fill', (event) => {
            const f = event.features?.[0];
            if (f) latest.current.onDetailInspect(f);
          });
          map.on('click', 'place-dots', (event) => {
            if (
              map?.queryRenderedFeatures(event.point, {
                layers: ['division-headquarters-dots'],
              }).length
            )
              return;
            const f = event.features?.[0];
            if (f) latest.current.onDetailInspect(f);
          });
          fit(map, data.bbox, window.innerWidth < 760);
          setLoaded(true);
        });
        instance.on('error', (event) => {
          if (event.error?.message && !/glyph|font/i.test(event.error.message))
            latest.current.onError(
              'Map rendering problem: ' + event.error.message,
            );
        });
      })
      .catch(() =>
        latest.current.onError(
          'The map engine could not load. Please reopen this map.',
        ),
      );
    const observer = new ResizeObserver(() => map?.resize());
    if (host.current) observer.observe(host.current);
    return () => {
      cancelled = true;
      observer.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, [data, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m || !precise.features.length) return;
    void (m.getSource('provinces') as GeoJSONSource).setData(precise);
  }, [precise, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    m.setFilter('province-highlight', ['==', 'id', active]);
  }, [active, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    const provinceFilter: FilterSpecification | null = punjabOnly
      ? ['==', ['get', 'id'], 'punjab']
      : null;
    const capitalFilter: FilterSpecification | null = punjabOnly
      ? ['==', ['get', 'province'], 'punjab']
      : null;
    for (const layer of ['province-fill', 'province-borders', 'province-names'])
      m.setFilter(layer, provinceFilter);
    for (const layer of [
      'province-fill',
      'province-borders',
      'province-highlight',
    ])
      m.setLayoutProperty(
        layer,
        'visibility',
        focusedDistrictId ? 'none' : 'visible',
      );
    for (const layer of ['capital-dots', 'capital-names'])
      m.setFilter(layer, capitalFilter);
    m.setLayoutProperty(
      'capital-dots',
      'visibility',
      focusedDistrictId ? 'none' : 'visible',
    );
    m.setLayoutProperty(
      'disputed-fill',
      'visibility',
      punjabOnly || mapStyle === 'satellite' ? 'none' : 'visible',
    );
    m.setLayoutProperty(
      'disputed-borders',
      'visibility',
      punjabOnly ? 'none' : 'visible',
    );
    m.setLayoutProperty(
      'context-names',
      'visibility',
      punjabOnly ? 'none' : 'visible',
    );
  }, [punjabOnly, focusedDistrictId, mapStyle, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    const punjab = data.provinces.find((p) => p.id === 'punjab');
    if (loaded && punjabOnly && !focusedDistrictId && m && punjab)
      fit(m, punjab.bbox, window.innerWidth < 760);
  }, [data, punjabOnly, focusedDistrictId, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    m.setFilter(
      'disputed-borders',
      context ? null : ['==', ['get', 'outside'], true],
    );
  }, [context, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    m.setFilter('place-dots', [
      '==',
      'province',
      places && !focusedDistrictId ? selected : '',
    ]);
    m.setFilter('place-names', [
      '==',
      'province',
      places && !focusedDistrictId ? selected : '',
    ]);
  }, [places, selected, focusedDistrictId, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    void (m.getSource('punjab-district-outlines') as GeoJSONSource).setData(
      districtOutlines,
    );
    m.setLayoutProperty(
      'punjab-district-outlines',
      'visibility',
      selected === 'punjab' && level === 'tehsil' ? 'visible' : 'none',
    );
    m.setPaintProperty('punjab-district-outlines', 'line-color', colors.border);
    m.setPaintProperty(
      'punjab-district-outlines',
      'line-width',
      2.3 * colors.borderWidth,
    );
  }, [
    districtOutlines,
    selected,
    level,
    colors.border,
    colors.borderWidth,
    loaded,
    mapRef,
  ]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    const customDetailIds = detail.features
      .map((feature) => String(feature.properties?.id || ''))
      .filter((id) =>
        selected === 'punjab' &&
        level === 'tehsil' &&
        tehsilColorMode === 'district'
          ? false
          : colors.fills[id],
      );
    const customDetailColors = Object.fromEntries(
      customDetailIds.map((id) => [id, colors.fills[id]]),
    ) as Record<string, string>;
    void (m.getSource('details') as GeoJSONSource).setData(
      focusedDistrictId
        ? {
            type: 'FeatureCollection',
            features: detail.features.filter(
              (feature) => feature.properties?.id === focusedDistrictId,
            ),
          }
        : detail,
    );
    const colored =
      selected === 'punjab' &&
      (level === 'division' || level === 'district' || level === 'tehsil');
    m.setPaintProperty(
      'detail-fill',
      'fill-color',
      atlasFillExpression(
        customDetailColors,
        colored ? ['coalesce', ['get', 'color'], '#ffffff'] : '#ffffff',
      ),
    );
    m.setPaintProperty(
      'detail-fill',
      'fill-opacity',
      mapStyle === 'satellite'
        ? 0
        : colored
          ? mapStyle === 'political'
            ? 0.9
            : 0.28
          : customDetailIds.length
            ? [
                'case',
                ['in', ['get', 'id'], ['literal', customDetailIds]],
                mapStyle === 'political' ? 0.85 : 0.28,
                0.08,
              ]
            : 0.08,
    );
    m.setPaintProperty('detail-borders', 'line-color', colors.border);
    m.setPaintProperty('detail-borders', 'line-width', colors.borderWidth);
    m.setPaintProperty('detail-selected', 'line-color', colors.border);
    m.setPaintProperty('detail-selected', 'line-width', 3 * colors.borderWidth);
    m.setLayoutProperty(
      'detail-borders',
      'visibility',
      level === 'province' ? 'none' : 'visible',
    );
    m.setLayoutProperty(
      'detail-labels',
      'visibility',
      labels && level !== 'province' ? 'visible' : 'none',
    );
  }, [
    detail,
    level,
    labels,
    selected,
    focusedDistrictId,
    mapStyle,
    colors,
    tehsilColorMode,
    loaded,
    mapRef,
  ]);
  useEffect(() => {
    const m = mapRef.current;
    const previouslyFocused = previousFocusedDistrictId.current;
    previousFocusedDistrictId.current = focusedDistrictId;
    if (!loaded || !m) return;
    const district = detail.features.find(
      (feature) => feature.properties?.id === focusedDistrictId,
    );
    const bounds = district?.properties?.bbox as number[] | undefined;
    if (bounds) fit(m, bounds, window.innerWidth < 760);
    else if (previouslyFocused && !focusedDistrictId && selected === 'punjab') {
      const punjab = data.provinces.find(
        (province) => province.id === 'punjab',
      );
      if (punjab) fit(m, punjab.bbox, window.innerWidth < 760);
    }
  }, [data, detail, focusedDistrictId, selected, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    const headquartersFeatures: FeatureCollection = {
      type: 'FeatureCollection',
      features:
        level === 'division' && headquarters
          ? detail.features.flatMap((feature) => {
              const coordinates = feature.properties?.headquartersCoordinates;
              if (!Array.isArray(coordinates) || coordinates.length !== 2)
                return [];
              return [
                {
                  type: 'Feature' as const,
                  properties: {
                    id: feature.properties?.id,
                    name: feature.properties?.capital,
                  },
                  geometry: { type: 'Point' as const, coordinates },
                },
              ];
            })
          : [],
    };
    void (m.getSource('division-headquarters') as GeoJSONSource).setData(
      headquartersFeatures,
    );
    m.setPaintProperty('division-headquarters-dots', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], inspectedAreaId],
      7,
      5,
    ]);
    m.setLayoutProperty(
      'division-headquarters-dots',
      'visibility',
      headquarters ? 'visible' : 'none',
    );
    m.setLayoutProperty(
      'division-headquarters-names',
      'visibility',
      headquarters && labels ? 'visible' : 'none',
    );
  }, [detail, level, inspectedAreaId, headquarters, labels, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    m.setFilter('detail-selected', [
      '==',
      'id',
      level === 'division' ? inspectedAreaId : editingDistrictId,
    ]);
    m.setLayoutProperty(
      'detail-selected',
      'visibility',
      (districtEditing && level === 'district') ||
        (level === 'division' && inspectedAreaId)
        ? 'visible'
        : 'none',
    );
  }, [
    districtEditing,
    editingDistrictId,
    inspectedAreaId,
    level,
    loaded,
    mapRef,
  ]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    for (const layer of [
      'province-names',
      'capital-names',
      'place-names',
      'context-names',
    ])
      m.setLayoutProperty(
        layer,
        'visibility',
        labels &&
          !(punjabOnly && layer === 'context-names') &&
          !(
            focusedDistrictId &&
            (layer === 'province-names' || layer === 'capital-names')
          )
          ? 'visible'
          : 'none',
      );
    for (const layer of ['base-satellite', 'base-physical'])
      m.setLayoutProperty(
        layer,
        'visibility',
        (mapStyle === 'satellite' && layer === 'base-satellite') ||
          ((mapStyle === 'physical' || mapStyle === 'nature') &&
            layer === 'base-physical')
          ? 'visible'
          : 'none',
      );
    m.setLayoutProperty(
      'tree-cover',
      'visibility',
      mapStyle === 'nature' ? 'visible' : 'none',
    );
    m.setPaintProperty(
      'background',
      'background-color',
      dark ? '#172b39' : '#eaf0f2',
    );
    m.setPaintProperty(
      'province-fill',
      'fill-color',
      atlasFillExpression(colors.fills, ['get', 'color']),
    );
    m.setPaintProperty(
      'province-fill',
      'fill-opacity',
      mapStyle === 'satellite'
        ? 0
        : [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1,
            mapStyle === 'political' ? (dark ? 0.76 : 0.84) : 0.14,
          ],
    );
    m.setPaintProperty('province-borders', 'line-color', colors.border);
    m.setPaintProperty('province-borders', 'line-width', [
      'interpolate',
      ['linear'],
      ['zoom'],
      3,
      0.65 * colors.borderWidth,
      8,
      1.25 * colors.borderWidth,
    ]);
    m.setPaintProperty('province-highlight', 'line-color', colors.border);
    m.setPaintProperty(
      'province-highlight',
      'line-width',
      2.6 * colors.borderWidth,
    );
  }, [
    dark,
    labels,
    punjabOnly,
    focusedDistrictId,
    mapStyle,
    colors,
    loaded,
    mapRef,
  ]);
  return (
    <div
      ref={host}
      className="ua-map"
      aria-label={
        focusedDistrictId
          ? 'Interactive map of one proposed Punjab district'
          : 'Interactive hypothetical India–Pakistan province map'
      }
      data-map-style={mapStyle}
      data-district-id={focusedDistrictId}
      data-detail-count={
        focusedDistrictId
          ? detail.features.filter(
              (feature) => feature.properties?.id === focusedDistrictId,
            ).length
          : detail.features.length
      }
      data-headquarters-visible={headquarters}
      aria-busy={!loaded}
    />
  );
}

export default function PrivateAtlas({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Overview | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(''),
    [punjabOnly, setPunjabOnly] = useState(false),
    [focusedDistrictId, setFocusedDistrictId] = useState(''),
    [mapStyle, setMapStyle] = useState<MapStyle>('political'),
    [colors, setColors] = useState(readAtlasColors),
    [districtEditing, setDistrictEditing] = useState(false),
    [districtEdits, setDistrictEdits] = useState(readDistrictEdits),
    [tehsilColorMode, setTehsilColorMode] =
      useState<TehsilColorMode>('district'),
    [editingDistrictId, setEditingDistrictId] = useState(''),
    [mergeWith, setMergeWith] = useState(''),
    [hover, setHover] = useState(''),
    [query, setQuery] = useState(''),
    [level, setLevel] = useState<Level>('province'),
    [dark, setDark] = useState(false),
    [context, setContext] = useState(false),
    [labels, setLabels] = useState(true),
    [places, setPlaces] = useState(true),
    [headquarters, setHeadquarters] = useState(true),
    [detail, setDetail] = useState<FeatureCollection>(empty),
    [districtSource, setDistrictSource] = useState<FeatureCollection>(empty),
    [detailLoading, setDetailLoading] = useState(false),
    [precise, setPrecise] = useState<FeatureCollection>(empty),
    [precisionLoading, setPrecisionLoading] = useState(false),
    [inspected, setInspected] = useState<Feature | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [research, setResearch] = useState(false),
    [researchQuery, setResearchQuery] = useState(''),
    [downloadMenuOpen, setDownloadMenuOpen] = useState(false),
    [downloading, setDownloading] = useState(false);
  const map = useRef<GLMap | null>(null),
    sidebar = useRef<HTMLElement | null>(null),
    requestVersion = useRef(0);
  const province = data?.provinces.find((p) => p.id === (selected || hover)),
    active = selected || hover;
  const mergedDistricts = useMemo(
    () =>
      selected === 'punjab' && level === 'district'
        ? mergeDistrictFeatures(detail, districtEdits.groups)
        : detail,
    [detail, districtEdits.groups, level, selected],
  );
  const districtNames = useMemo(
    () => districtDisplayNames(districtSource, districtEdits),
    [districtSource, districtEdits],
  );
  const styledPunjabDistricts = useMemo(
    () =>
      styleDistrictFeatures(
        mergeDistrictFeatures(districtSource, districtEdits.groups),
        districtSource,
        districtEdits,
      ),
    [districtSource, districtEdits],
  );
  const displayChanges = useMemo(
    () =>
      analysis?.changes.map((row) =>
        row.provinceId === 'punjab'
          ? {
              ...row,
              proposedDistrict:
                districtNames[row.proposedDistrict] || row.proposedDistrict,
            }
          : row,
      ) || [],
    [analysis, districtNames],
  );
  const displayedDetail = useMemo<FeatureCollection>(() => {
    if (selected !== 'punjab') return mergedDistricts;
    if (level === 'district')
      return styleDistrictFeatures(mergedDistricts, detail, districtEdits);
    if (level === 'division') {
      const summaries = summarizeDistrictDivisions(
        styledPunjabDistricts.features,
      );
      return {
        ...mergedDistricts,
        features: mergedDistricts.features.map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            ...summaries.find(
              (summary) => summary.name === feature.properties?.name,
            ),
          },
        })),
      };
    }
    if (level === 'tehsil')
      return styleTehsilFeatures(
        detail,
        districtSource,
        districtEdits,
        tehsilColorMode,
      );
    return mergedDistricts;
  }, [
    mergedDistricts,
    detail,
    districtSource,
    districtEdits,
    styledPunjabDistricts,
    tehsilColorMode,
    level,
    selected,
  ]);
  const currentEditingDistrictId =
    editingDistrictId ||
    String(displayedDetail.features[0]?.properties?.id || '');
  const focusedDistrict = styledPunjabDistricts.features.find(
    (feature) => feature.properties?.id === focusedDistrictId,
  );
  const districtProfile =
    focusedDistrict ||
    (selected === 'punjab' && level === 'district'
      ? styledPunjabDistricts.features.find(
          (feature) => feature.properties?.id === inspected?.properties?.id,
        )
      : undefined);
  const rankedDistrictSource = useMemo(
    () =>
      [...styledPunjabDistricts.features].sort(
        (a, b) =>
          Number(b.properties?.areaKm2 || 0) -
          Number(a.properties?.areaKm2 || 0),
      ),
    [styledPunjabDistricts],
  );
  const focusedDistrictStats = districtProfile;
  const focusedDistrictAreaRank = focusedDistrictStats
    ? rankedDistrictSource.findIndex(
        (feature) =>
          feature.properties?.id === focusedDistrictStats.properties?.id,
      ) + 1
    : 0;
  const inspectedArea =
    level !== 'province' && !inspected?.properties?.kind
      ? displayedDetail.features.find(
          (feature) => feature.properties?.id === inspected?.properties?.id,
        )
      : undefined;
  const exportArea = focusedDistrict || inspectedArea;
  const exportProvince = data?.provinces.find((item) => item.id === selected);
  const exportAreaName = String(
    exportArea?.properties?.name ||
      exportProvince?.name ||
      data?.name ||
      'atlas',
  );
  const exportBounds =
    featureBounds(exportArea) || exportProvince?.bbox || data?.bbox || null;
  const selectedDetail = displayedDetail.features.find(
    (feature) =>
      feature.properties?.id ===
      (districtEditing ? editingDistrictId : inspected?.properties?.id),
  );
  const colorTarget = focusedDistrict || selectedDetail;
  const colorTargetId =
    level === 'province'
      ? selected
      : selected === 'punjab' &&
          level === 'tehsil' &&
          tehsilColorMode === 'district'
        ? String(colorTarget?.properties?.parentDistrictId || '')
        : String(colorTarget?.properties?.id || '');
  const colorTargetName =
    level === 'province'
      ? province?.name
      : selected === 'punjab' &&
          level === 'tehsil' &&
          tehsilColorMode === 'district'
        ? String(colorTarget?.properties?.district || '')
        : String(colorTarget?.properties?.name || '');
  const punjabDistrictColor =
    selected === 'punjab' &&
    (level === 'district' ||
      (level === 'tehsil' && tehsilColorMode === 'district')) &&
    !!colorTargetId;
  const currentFillColor = punjabDistrictColor
    ? districtEdits.colors[colorTargetId] ||
      String(colorTarget?.properties?.color || '#ffffff')
    : colors.fills[colorTargetId] ||
      (level === 'province'
        ? province?.color
        : String(colorTarget?.properties?.color || '#ffffff')) ||
      '#ffffff';
  const hasCustomFillColor = punjabDistrictColor
    ? !!districtEdits.colors[colorTargetId]
    : !!colors.fills[colorTargetId];
  const profileProvince =
    province?.id === 'punjab'
      ? {
          ...province,
          detailCounts: {
            ...province.detailCounts,
            district: districtSource.features.length
              ? styledPunjabDistricts.features.length
              : province.detailCounts.district -
                districtEdits.groups.reduce(
                  (removed, group) => removed + group.members.length - 1,
                  0,
                ),
          },
        }
      : province;
  useEffect(() => {
    try {
      localStorage.setItem(
        districtEditsStorageKey,
        JSON.stringify(districtEdits),
      );
    } catch {
      // Editing still works if browser storage is unavailable.
    }
  }, [districtEdits]);
  useEffect(() => {
    try {
      localStorage.setItem(atlasColorsStorageKey, JSON.stringify(colors));
    } catch {
      // Color controls still work if browser storage is unavailable.
    }
  }, [colors]);
  useEffect(() => {
    sidebar.current?.scrollTo({ top: 0 });
  }, [province?.id]);
  const visible = useMemo(
    () =>
      data?.provinces.filter((p) =>
        [p.name, p.capital, ...p.majorCities, ...(p.aliases || [])]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase()),
      ) || [],
    [data, query],
  );
  const fetchOverview = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const value = await request<Overview>('action=overview', { signal });
      setData(value);
      setError('');
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : 'The atlas could not load.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  // oxlint-disable-next-line react/react-compiler -- Synchronise map server state when this private view mounts.
  useEffect(() => {
    const controller = new AbortController();
    // oxlint-disable-next-line react/react-compiler -- Fetch and synchronise the map server session.
    void fetchOverview(controller.signal);
    return () => controller.abort();
  }, [fetchOverview]);
  // Province outlines arrive in small paged requests, then replace the
  // national coverage together so neighbouring borders share identical edges.
  // oxlint-disable-next-line react/react-compiler -- Synchronise full-resolution geometry from the map server.
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- This loading flag tracks an external geometry request.
    if (!data) return;
    const controller = new AbortController();
    // oxlint-disable-next-line react/react-compiler -- Publish loading state for the external geometry request.
    setPrecisionLoading(true);
    async function load() {
      const features: Feature[] = [];
      for (let i = 0; i < data!.provinces.length; i += 4) {
        const pages = await Promise.all(
          data!.provinces
            .slice(i, i + 4)
            .map((p) =>
              request<DetailPage>(
                'action=detail&province=' +
                  encodeURIComponent(p.id) +
                  '&level=province',
                { signal: controller.signal },
              ),
            ),
        );
        for (const page of pages) features.push(...page.features);
      }
      if (!controller.signal.aborted)
        setPrecise({ type: 'FeatureCollection', features });
    }
    void load()
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : 'Fine province geometry could not load.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrecisionLoading(false);
      });
    return () => controller.abort();
  }, [data]);
  function national() {
    setPunjabOnly(false);
    setFocusedDistrictId('');
    setDistrictEditing(false);
    setSelected('');
    setHover('');
    setQuery('');
    setLevel('province');
    setInspected(null);
    setDetail(empty);
    if (data && map.current)
      fit(map.current, data.bbox, window.innerWidth < 760);
  }
  function choose(id: string, focus = false) {
    setDistrictEditing(false);
    setFocusedDistrictId('');
    if (id !== 'punjab') {
      setPunjabOnly(false);
    }
    setSelected(id);
    setLevel('province');
    setDetail(empty);
    setDetailLoading(false);
    setInspected(null);
    if (focus) {
      const p = data?.provinces.find((p) => p.id === id);
      if (p && map.current) fit(map.current, p.bbox, window.innerWidth < 760);
    }
  }
  function showPunjabOnly() {
    choose('punjab');
    setPunjabOnly(true);
    setLevel('district');
    setPlaces(false);
    setQuery('');
  }
  function setAreaColor(color: string) {
    if (!colorTargetId || !isHexColor(color)) return;
    if (punjabDistrictColor)
      setDistrictEdits((current) => ({
        ...current,
        colors: { ...current.colors, [colorTargetId]: color },
      }));
    else
      setColors((current) => ({
        ...current,
        fills: { ...current.fills, [colorTargetId]: color },
      }));
  }
  function resetAreaColor() {
    if (!colorTargetId) return;
    if (punjabDistrictColor)
      setDistrictEdits((current) => {
        const nextColors = { ...current.colors };
        delete nextColors[colorTargetId];
        return { ...current, colors: nextColors };
      });
    else
      setColors((current) => {
        const fills = { ...current.fills };
        delete fills[colorTargetId];
        return { ...current, fills };
      });
  }
  function toggleDistrictEditor() {
    if (districtEditing) {
      setDistrictEditing(false);
      return;
    }
    choose('punjab', true);
    setPunjabOnly(true);
    setLevel('district');
    setDistrictEditing(true);
    setPlaces(false);
    setQuery('');
    setHover('');
  }
  async function downloadMap(scope: 'current' | 'full') {
    setDownloadMenuOpen(false);
    const current = map.current;
    if (!current) {
      setError('The map is still opening. Try again shortly.');
      return;
    }
    const originalCamera =
      scope === 'full'
        ? {
            center: current.getCenter(),
            zoom: current.getZoom(),
            bearing: current.getBearing(),
            pitch: current.getPitch(),
          }
        : null;
    try {
      setError('');
      setDownloading(true);
      if (scope === 'full') {
        if (!exportBounds)
          throw new Error('The selected area is not ready to export.');
        await new Promise<void>((resolve, reject) => {
          const onIdle = () => {
            window.clearTimeout(timeout);
            resolve();
          };
          const timeout = window.setTimeout(() => {
            current.off('idle', onIdle);
            reject(
              new Error('The full map is still loading. Try again shortly.'),
            );
          }, 20000);
          current.once('idle', onIdle);
          current.fitBounds(
            [
              [exportBounds[0], exportBounds[1]],
              [exportBounds[2], exportBounds[3]],
            ],
            { padding: 35, duration: 0, maxZoom: 12 },
          );
        });
      }
      const snapshot = await new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(
          () =>
            reject(new Error('The map is still rendering. Try again shortly.')),
          10000,
        );
        current.once('render', () => {
          clearTimeout(timeout);
          try {
            resolve(current.getCanvas().toDataURL('image/png'));
          } catch (error) {
            reject(error);
          }
        });
        current.triggerRepaint();
      });
      const image = new Image();
      image.src = snapshot;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context2d = canvas.getContext('2d');
      if (!context2d) throw new Error('The map image could not be prepared.');
      context2d.drawImage(image, 0, 0);
      context2d.fillStyle = '#ffffffeb';
      context2d.fillRect(0, canvas.height - 28, canvas.width, 28);
      context2d.fillStyle = '#344d5e';
      context2d.font = `${Math.max(8, Math.min(11, canvas.width / 90))}px Arial`;
      context2d.fillText(
        'Hypothetical geography · LGD/Bharatlas · Esri India · WFP/OCHA CC BY-IGO · Natural Earth' +
          (mapStyle !== 'political'
            ? ' · Basemap © Esri and contributors'
            : '') +
          (mapStyle === 'nature'
            ? ' · Tree cover © ESA WorldCover 2021 (CC BY 4.0)'
            : ''),
        10,
        canvas.height - 10,
        canvas.width - 20,
      );
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      const filenameArea = exportAreaName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      link.download = `${filenameArea}-${scope}-view-${mapStyle}.png`;
      link.click();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The map could not be downloaded.',
      );
    } finally {
      try {
        if (originalCamera && map.current === current)
          await new Promise<void>((resolve) => {
            const onIdle = () => {
              window.clearTimeout(timeout);
              resolve();
            };
            const timeout = window.setTimeout(() => {
              current.off('idle', onIdle);
              resolve();
            }, 10000);
            current.once('idle', onIdle);
            current.jumpTo(originalCamera);
          });
      } finally {
        setDownloading(false);
      }
    }
  }
  // oxlint-disable-next-line react/react-compiler -- Loading state reflects an external protected geometry request; abort stale requests on navigation.
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Clear old external geometry and publish the current request's loading state.
    if (!selected || level === 'province') return;
    const controller = new AbortController(),
      version = ++requestVersion.current;
    // oxlint-disable-next-line react/react-compiler -- Publish loading state for the external detail request.
    setDetailLoading(true);
    setError('');
    async function loadLevel(requestedLevel: Level) {
      const result: FeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };
      let offset: number | null = 0;
      do {
        const page: DetailPage = await request<DetailPage>(
          'action=detail&province=' +
            encodeURIComponent(selected) +
            '&level=' +
            requestedLevel +
            '&offset=' +
            offset,
          { signal: controller.signal },
        );
        result.features.push(...page.features);
        offset = page.next;
      } while (offset !== null);
      return result;
    }
    async function load() {
      const [result, districts] = await Promise.all([
        loadLevel(level),
        selected === 'punjab' && (level === 'tehsil' || level === 'division')
          ? loadLevel('district')
          : Promise.resolve(null),
      ]);
      if (version === requestVersion.current) {
        setDetail(result);
        if (selected === 'punjab' && level === 'district')
          setDistrictSource(result);
        if (districts) setDistrictSource(districts);
      }
    }
    void load()
      .catch((e) => {
        if (!controller.signal.aborted) {
          setDetail(empty);
          setError(e instanceof Error ? e.message : 'Detail unavailable.');
          if (e instanceof AtlasError && e.status === 401) setData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected, level, data]);
  async function openResearch() {
    setResearch(true);
    if (analysis && districtSource.features.length) return;
    setError('');
    try {
      if (!analysis) setAnalysis(await request<Analysis>('action=analysis'));
      if (!districtSource.features.length) {
        const features: Feature[] = [];
        let offset: number | null = 0;
        do {
          const page: DetailPage = await request<DetailPage>(
            'action=detail&province=punjab&level=district&offset=' + offset,
          );
          features.push(...page.features);
          offset = page.next;
        } while (offset !== null);
        setDistrictSource({ type: 'FeatureCollection', features });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Research could not load.');
    }
  }
  function csv() {
    if (!analysis) return;
    const columns = [
      'currentDistrict',
      'currentTehsil',
      'proposedDistrict',
      'proposedDivision',
      'proposedProvince',
      'proposedCapital',
      'divisionCapital',
      'reason',
      'sourceId',
    ] as (keyof Change)[];
    const value = [
      columns.join(','),
      ...displayChanges.map((row) =>
        columns
          .map((k) => '"' + String(row[k]).replace(/"/g, '""') + '"')
          .join(','),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + value], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'united-subcontinent-administrative-proposal.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const changes =
    displayChanges.filter((r) =>
      (
        r.currentDistrict +
        ' ' +
        r.currentTehsil +
        ' ' +
        r.proposedDistrict +
        ' ' +
        r.proposedProvince
      )
        .toLowerCase()
        .includes(researchQuery.toLowerCase()),
    ) || [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="ua-dialog translate-x-0 translate-y-0"
        showCloseButton={false}
      >
        <header className="ua-header">
          <button
            type="button"
            onClick={onClose}
            aria-label="Return to map editor"
          >
            <ArrowLeft size={19} />
            <span>My maps</span>
          </button>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Custom research atlas · hypothetical political geography
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close custom atlas"
          >
            <X size={19} />
          </button>
        </header>
        {!data ? (
          <div className="ua-locked">
            <span className="ua-kicker">CUSTOM ATLAS</span>
            <h2>
              {loading ? 'Opening your atlas…' : 'The atlas could not load'}
            </h2>
            {!loading && (
              <button type="button" onClick={() => void fetchOverview()}>
                Try again
              </button>
            )}
            {error && (
              <p role="alert" className="ua-error">
                {error}
              </p>
            )}
          </div>
        ) : (
          <>
            <nav className="ua-controls" aria-label="Custom atlas navigation">
              <button type="button" className="ua-national" onClick={national}>
                <Globe2 size={17} />
                National overview
              </button>
              <button
                type="button"
                className="ua-punjab-only"
                onClick={showPunjabOnly}
                aria-pressed={punjabOnly}
                title="Show only the proposed Punjab province"
              >
                <MapPinned size={16} />
                Punjab only
              </button>
              <button
                type="button"
                className="ua-edit-districts-button"
                onClick={toggleDistrictEditor}
                aria-pressed={districtEditing}
              >
                <Pencil size={15} />
                Edit districts
              </button>
              <div className="ua-search">
                <Search size={16} />
                <label className="sr-only" htmlFor="ua-province">
                  Find a province or capital
                </label>
                <input
                  id="ua-province"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a province or capital"
                />
                {query && (
                  <ul>
                    {visible.length ? (
                      visible.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              choose(p.id, true);
                              setQuery('');
                            }}
                          >
                            <i style={{ background: p.color }} />
                            {p.name}
                            <small>{p.capital}</small>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li>No matching provinces</li>
                    )}
                  </ul>
                )}
              </div>
              <label className="ua-level">
                View
                <select
                  aria-label="Administrative detail view"
                  value={level}
                  disabled={!selected}
                  onChange={(e) => {
                    const nextLevel = e.target.value as Level;
                    setLevel(nextLevel);
                    setFocusedDistrictId('');
                    if (nextLevel !== 'district') setDistrictEditing(false);
                    setInspected(null);
                  }}
                >
                  <option value="province">Provinces only</option>
                  {(['division', 'district', 'tehsil'] as Level[]).map((v) => (
                    <option
                      key={v}
                      value={v}
                      disabled={!province?.detailCounts[v]}
                    >
                      {v === 'division'
                        ? 'Divisions'
                        : v === 'district'
                          ? 'Districts'
                          : 'Tehsils / subdistricts'}
                    </option>
                  ))}
                </select>
              </label>
              {selected === 'punjab' && level === 'tehsil' && (
                <label className="ua-level ua-tehsil-color-mode">
                  Color by
                  <select
                    aria-label="Punjab tehsil color mode"
                    value={tehsilColorMode}
                    onChange={(event) =>
                      setTehsilColorMode(event.target.value as TehsilColorMode)
                    }
                  >
                    <option value="district">District</option>
                    <option value="tehsil">Tehsil</option>
                  </select>
                </label>
              )}
              {selected === 'punjab' &&
                level === 'district' &&
                !districtEditing && (
                  <label className="ua-level ua-district-picker">
                    District
                    <select
                      aria-label="Show separate Punjab district"
                      value={focusedDistrictId}
                      onChange={(event) => {
                        setFocusedDistrictId(event.target.value);
                        setInspected(null);
                      }}
                      disabled={
                        detailLoading || !displayedDetail.features.length
                      }
                    >
                      <option value="">All Punjab districts</option>
                      {[...styledPunjabDistricts.features]
                        .sort((a, b) =>
                          String(a.properties?.name).localeCompare(
                            String(b.properties?.name),
                          ),
                        )
                        .map((district) => (
                          <option
                            key={String(district.properties?.id)}
                            value={String(district.properties?.id)}
                          >
                            {String(district.properties?.name)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              <label className="ua-level ua-style-picker">
                Map style
                <select
                  aria-label="Map style"
                  value={mapStyle}
                  onChange={(event) =>
                    setMapStyle(event.target.value as MapStyle)
                  }
                >
                  <option value="political">Political</option>
                  <option value="physical">Physical / terrain</option>
                  <option value="satellite">Satellite imagery</option>
                  <option value="nature">Nature / tree cover</option>
                </select>
              </label>
              <label
                className="ua-color-control"
                title={
                  mapStyle === 'satellite'
                    ? 'Satellite mode keeps area fills transparent. Switch styles to edit fill colors.'
                    : colorTargetId
                      ? `Set the fill color for ${colorTargetName}`
                      : 'Select an area on the map to set its fill color.'
                }
              >
                {level === 'province'
                  ? 'Province fill'
                  : level === 'district'
                    ? 'District fill'
                    : level === 'division'
                      ? 'Division fill'
                      : selected === 'punjab' && tehsilColorMode === 'district'
                        ? 'District fill'
                        : 'Tehsil fill'}
                <input
                  type="color"
                  aria-label="Area fill color"
                  value={currentFillColor}
                  disabled={!colorTargetId || mapStyle === 'satellite'}
                  onInput={(event) => setAreaColor(event.currentTarget.value)}
                />
              </label>
              {selected === 'punjab' &&
                (level === 'district' || level === 'tehsil') && (
                  <label className="ua-level ua-palette-picker">
                    Palette
                    <select
                      aria-label="Punjab palette color"
                      defaultValue=""
                      disabled={!colorTargetId || mapStyle === 'satellite'}
                      onChange={(event) => {
                        setAreaColor(event.currentTarget.value);
                        event.currentTarget.value = '';
                      }}
                    >
                      <option value="">Choose color</option>
                      {punjabPalette.map(({ name, color }) => (
                        <option key={name} value={color}>
                          {name} · {color}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {hasCustomFillColor && mapStyle !== 'satellite' && (
                <button
                  type="button"
                  className="ua-color-reset"
                  aria-label="Reset area fill color"
                  title={`Restore the original color for ${colorTargetName}`}
                  onClick={resetAreaColor}
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <label className="ua-color-control">
                Borders
                <input
                  type="color"
                  aria-label="Border color"
                  value={colors.border}
                  onInput={(event) => {
                    const border = event.currentTarget.value;
                    setColors((current) => ({
                      ...current,
                      border,
                    }));
                  }}
                />
              </label>
              {colors.border !== defaultBorderColor && (
                <button
                  type="button"
                  className="ua-color-reset"
                  aria-label="Reset border color"
                  title="Restore the default border color"
                  onClick={() =>
                    setColors((current) => ({
                      ...current,
                      border: defaultBorderColor,
                    }))
                  }
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <label className="ua-border-width-control">
                Border thickness
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.25"
                  aria-label="Border thickness"
                  value={colors.borderWidth}
                  onChange={(event) => {
                    const borderWidth = Number(event.currentTarget.value);
                    setColors((current) => ({
                      ...current,
                      borderWidth,
                    }));
                  }}
                />
                <output>
                  {colors.borderWidth.toFixed(2).replace(/\.?0+$/, '')}×
                </output>
              </label>
              {colors.borderWidth !== defaultBorderWidth && (
                <button
                  type="button"
                  className="ua-color-reset"
                  aria-label="Reset border thickness"
                  title="Restore the default border thickness"
                  onClick={() =>
                    setColors((current) => ({
                      ...current,
                      borderWidth: defaultBorderWidth,
                    }))
                  }
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setLabels((v) => !v)}
                aria-pressed={labels}
              >
                Names {labels ? 'on' : 'off'}
              </button>
              <button
                type="button"
                disabled={!selected}
                aria-pressed={places && !!selected}
                title="Cities and curated heritage sites in the selected province"
                onClick={() => setPlaces((v) => !v)}
              >
                Places {places && selected ? 'on' : 'off'}
              </button>
              {selected === 'punjab' && level === 'division' && (
                <button
                  type="button"
                  aria-pressed={headquarters}
                  title="Division headquarters city points and labels"
                  onClick={() => setHeadquarters((visible) => !visible)}
                >
                  HQ cities {headquarters ? 'on' : 'off'}
                </button>
              )}
              <button
                type="button"
                aria-label={dark ? 'Use light map theme' : 'Use dark map theme'}
                onClick={() => setDark((v) => !v)}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                type="button"
                onClick={() => setContext((v) => !v)}
                aria-pressed={context}
                title="Generalised disputed/current-administration outlines in the Kashmir region"
              >
                Boundary context
              </button>
              <button type="button" onClick={() => void openResearch()}>
                <BookOpen size={16} />
                Research & changes
              </button>
              <div className="ua-download-menu">
                <button
                  type="button"
                  onClick={() => setDownloadMenuOpen((open) => !open)}
                  disabled={detailLoading || precisionLoading || downloading}
                  aria-expanded={downloadMenuOpen}
                  aria-controls="ua-download-options"
                >
                  <Download size={16} />
                  {downloading ? 'Preparing map…' : 'Download map'}
                </button>
                {downloadMenuOpen && (
                  <div
                    id="ua-download-options"
                    className="ua-download-options"
                    role="group"
                    aria-label="Map download options"
                  >
                    <button
                      type="button"
                      onClick={() => void downloadMap('current')}
                    >
                      <strong>Current view</strong>
                      <small>Exactly what is on screen</small>
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadMap('full')}
                    >
                      <strong>Full selected area</strong>
                      <small>Fit {exportAreaName} in the image</small>
                    </button>
                  </div>
                )}
              </div>
            </nav>
            <div className="ua-workspace" data-theme={dark ? 'dark' : 'light'}>
              <div className="ua-map-pane">
                <AtlasMap
                  data={data}
                  active={active}
                  selected={selected}
                  punjabOnly={punjabOnly}
                  focusedDistrictId={focusedDistrictId}
                  inspectedAreaId={String(inspectedArea?.properties?.id || '')}
                  mapStyle={mapStyle}
                  colors={colors}
                  districtEditing={districtEditing}
                  editingDistrictId={currentEditingDistrictId}
                  places={places}
                  headquarters={headquarters}
                  level={level}
                  dark={dark}
                  labels={labels}
                  context={context}
                  onSelect={(id) => choose(id)}
                  onHover={(id) => {
                    if (!selected) setHover(id);
                  }}
                  onError={setError}
                  mapRef={map}
                  detail={
                    focusedDistrict
                      ? {
                          type: 'FeatureCollection',
                          features: [
                            {
                              ...focusedDistrict,
                              properties: {
                                ...focusedDistrict.properties,
                                color:
                                  displayedDetail.features.find(
                                    (f) =>
                                      f.properties?.id === focusedDistrictId,
                                  )?.properties?.color || '#AFC7B1',
                              },
                            },
                          ],
                        }
                      : displayedDetail
                  }
                  districtOutlines={styledPunjabDistricts}
                  tehsilColorMode={tehsilColorMode}
                  precise={precise}
                  onDetailInspect={(feature) => {
                    const id = String(feature.properties?.id || '');
                    if (
                      level !== 'province' &&
                      !feature.properties?.kind &&
                      !displayedDetail.features.some(
                        (current) => current.properties?.id === id,
                      )
                    )
                      return;
                    if (
                      !districtEditing &&
                      selected === 'punjab' &&
                      level === 'district' &&
                      !focusedDistrictId &&
                      displayedDetail.features.some(
                        (district) => district.properties?.id === id,
                      )
                    ) {
                      setInspected(
                        styledPunjabDistricts.features.find(
                          (district) => district.properties?.id === id,
                        ) || feature,
                      );
                      sidebar.current?.scrollTo({ top: 0 });
                      return;
                    }
                    setInspected(
                      displayedDetail.features.find(
                        (item) => item.properties?.id === id,
                      ) || feature,
                    );
                    if (level === 'division')
                      sidebar.current?.scrollTo({ top: 0 });
                    if (
                      districtEditing &&
                      level === 'district' &&
                      displayedDetail.features.some(
                        (district) => district.properties?.id === id,
                      )
                    )
                      setEditingDistrictId(id);
                  }}
                />
                <div className="ua-map-badge">
                  <Globe2 size={12} />
                  <span>ALTERNATIVE HISTORY</span>
                </div>
                <div className="ua-zoom">
                  <button
                    type="button"
                    aria-label="Zoom in custom map"
                    onClick={() => map.current?.zoomIn()}
                  >
                    <Plus size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom out custom map"
                    onClick={() => map.current?.zoomOut()}
                  >
                    <Minus size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="Fit complete union"
                    onClick={national}
                  >
                    <Maximize size={17} />
                  </button>
                </div>
                <div className="ua-map-caption">
                  <strong>
                    {focusedDistrict
                      ? String(focusedDistrict.properties?.name) +
                        ' · separate district'
                      : level === 'province'
                        ? punjabOnly
                          ? 'Punjab · proposed province only'
                          : data.provinces.length +
                            ' states, provinces & union territories'
                        : selected === 'punjab' && level === 'district'
                          ? displayedDetail.features.length +
                            ' colored Punjab districts'
                          : selected === 'punjab' && level === 'tehsil'
                            ? displayedDetail.features.length +
                              ' Punjab tehsils · color by ' +
                              tehsilColorMode
                            : province?.name + ' · ' + level + ' detail'}
                  </strong>
                  <span>
                    {detailLoading || precisionLoading
                      ? 'Loading protected geometry…'
                      : focusedDistrict
                        ? 'Only this district is shown · choose All Punjab districts to return'
                        : 'Hover to preview · select to explore · drag or pinch to navigate'}
                  </span>
                </div>
                {error && (
                  <div role="alert" className="ua-map-error">
                    {error}
                    <button
                      type="button"
                      onClick={() => setError('')}
                      aria-label="Dismiss map message"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {inspected &&
                  !(
                    selected === 'punjab' &&
                    level === 'division' &&
                    inspectedArea
                  ) &&
                  (level !== 'province' || inspected.properties?.kind) &&
                  !(
                    selected === 'punjab' &&
                    level === 'tehsil' &&
                    !inspected.properties?.kind
                  ) && (
                    <div className="ua-detail-popup">
                      <button
                        type="button"
                        onClick={() => setInspected(null)}
                        aria-label="Close area detail"
                      >
                        <X size={16} />
                      </button>
                      <small>
                        {inspected.properties?.kind
                          ? String(inspected.properties.kind).toUpperCase() +
                            ' · REAL-WORLD LOCATION'
                          : level.toUpperCase() + ' · PROPOSED VIEW'}
                      </small>
                      <strong>
                        {String(inspected.properties?.name || 'Area')}
                      </strong>
                      <p>
                        {String(
                          inspected.properties?.district ||
                            inspected.properties?.division ||
                            '',
                        )}
                      </p>
                      <p>
                        {String(
                          inspected.properties?.description ||
                            inspected.properties?.reason ||
                            inspected.properties?.note ||
                            'Retained source geometry; see research for provenance.',
                        )}
                      </p>
                      {inspected.properties?.sourceUrl ? (
                        <>
                          <p>
                            {String(
                              inspected.properties.accuracy ||
                                'Approximate cartographic location.',
                            )}
                          </p>
                          <a
                            href={String(inspected.properties.sourceUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Location source
                          </a>
                        </>
                      ) : (
                        <small>
                          Source:{' '}
                          {String(
                            inspected.properties?.sourceId || 'division union',
                          )}
                        </small>
                      )}
                    </div>
                  )}
              </div>
              <aside ref={sidebar} className="ua-sidebar">
                {districtEditing ? (
                  <DistrictEditor
                    districts={displayedDetail}
                    edits={districtEdits}
                    selectedId={currentEditingDistrictId}
                    mergeWith={mergeWith}
                    onPick={(id) => {
                      setEditingDistrictId(id);
                      setMergeWith('');
                      const district = displayedDetail.features.find(
                        (feature) => feature.properties?.id === id,
                      );
                      const bounds = district?.properties?.bbox as
                        | number[]
                        | undefined;
                      if (bounds && map.current)
                        fit(map.current, bounds, window.innerWidth < 760);
                    }}
                    onRename={(id, name) =>
                      setDistrictEdits((current) => ({
                        ...current,
                        names: { ...current.names, [id]: name },
                      }))
                    }
                    onColor={(id, color) =>
                      setDistrictEdits((current) => ({
                        ...current,
                        colors: { ...current.colors, [id]: color },
                      }))
                    }
                    onMergeWith={setMergeWith}
                    onMerge={(id, otherId) => {
                      setDistrictEdits((current) =>
                        mergeEditedDistricts(
                          current,
                          id,
                          otherId,
                          displayedDetail,
                        ),
                      );
                      setMergeWith('');
                      setInspected(null);
                    }}
                    onReset={() => {
                      if (
                        !window.confirm(
                          'Restore the requested Punjab district layout and remove your local district edits?',
                        )
                      )
                        return;
                      setDistrictEdits(defaultDistrictEdits());
                      setEditingDistrictId('');
                      setMergeWith('');
                      setInspected(null);
                    }}
                  />
                ) : selected === 'punjab' && level === 'division' ? (
                  <DivisionPanel
                    divisions={displayedDetail.features}
                    active={inspectedArea}
                    loading={detailLoading}
                    onPick={(feature) => {
                      setInspected(feature);
                      const bounds = featureBounds(feature);
                      if (bounds && map.current)
                        fit(map.current, bounds, window.innerWidth < 760);
                      sidebar.current?.scrollTo({ top: 0 });
                    }}
                    onBack={() => {
                      setInspected(null);
                      const bounds = data.provinces.find(
                        (item) => item.id === 'punjab',
                      )?.bbox;
                      if (bounds && map.current)
                        fit(map.current, bounds, window.innerWidth < 760);
                    }}
                    onHeadquarters={(coordinates) =>
                      map.current?.flyTo({
                        center: [coordinates[0], coordinates[1]],
                        zoom: 9,
                      })
                    }
                  />
                ) : districtProfile ? (
                  <DistrictProfile
                    district={districtProfile.properties as DistrictInfo}
                    areaRank={focusedDistrictAreaRank}
                    districtCount={styledPunjabDistricts.features.length}
                    onBack={() => {
                      setFocusedDistrictId('');
                      setInspected(null);
                    }}
                    onIsolate={
                      !focusedDistrictId
                        ? () => {
                            setFocusedDistrictId(
                              String(districtProfile.properties?.id),
                            );
                            setInspected(null);
                          }
                        : undefined
                    }
                    onEdit={() => {
                      setEditingDistrictId(
                        String(districtProfile.properties?.id),
                      );
                      setFocusedDistrictId('');
                      setDistrictEditing(true);
                    }}
                  />
                ) : selected === 'punjab' && level === 'district' ? (
                  <DistrictOverviewPanel
                    districts={styledPunjabDistricts.features}
                    loading={detailLoading}
                    onSelect={(id) => {
                      setInspected(
                        styledPunjabDistricts.features.find(
                          (district) => district.properties?.id === id,
                        ) || null,
                      );
                      sidebar.current?.scrollTo({ top: 0 });
                    }}
                  />
                ) : selected === 'punjab' &&
                  level === 'tehsil' &&
                  inspected &&
                  !inspected.properties?.kind ? (
                  <section
                    className="ua-tehsil-profile"
                    aria-label="Punjab tehsil name history"
                  >
                    <div className="ua-breadcrumb">
                      <button type="button" onClick={national}>
                        United Subcontinent
                      </button>
                      <ChevronRight size={13} />
                      <button type="button" onClick={() => setInspected(null)}>
                        Punjab
                      </button>
                      <ChevronRight size={13} />
                      <span>
                        {String(inspected.properties?.name || 'Tehsil')}
                      </span>
                    </div>
                    <div className="ua-profile-heading">
                      <small>
                        {inspected.properties?.namingStatus === 'restored'
                          ? 'TEHSIL · RESTORED AREA'
                          : inspected.properties?.namingStatus === 'renamed'
                            ? 'TEHSIL · PROPOSED NAME'
                            : 'TEHSIL · ESTABLISHED PLACE NAME'}
                      </small>
                      <h2>{String(inspected.properties?.name || 'Tehsil')}</h2>
                    </div>
                    <div className="ua-tehsil-profile-content">
                      <p>
                        <strong>
                          {inspected.properties?.namingStatus === 'restored'
                            ? 'Official name:'
                            : 'Old name:'}
                        </strong>{' '}
                        {String(inspected.properties?.sourceName || '')}
                      </p>
                      <p>
                        <strong>Proposed district:</strong>{' '}
                        {String(inspected.properties?.district || '')}
                      </p>
                      <h3>Name and history</h3>
                      <p>
                        <strong>Meaning:</strong>{' '}
                        {String(inspected.properties?.nameMeaning || '')}
                      </p>
                      <p>
                        {String(
                          inspected.properties?.namingReason ||
                            inspected.properties?.reason ||
                            '',
                        )}
                      </p>
                      {inspected.properties?.geometryAdjustment && (
                        <p>{String(inspected.properties.geometryAdjustment)}</p>
                      )}
                      {inspected.properties?.namingSourceUrl && (
                        <a
                          href={String(inspected.properties.namingSourceUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Tehsil source ↗
                        </a>
                      )}
                      <small>
                        {String(
                          inspected.properties?.namingProvenance ||
                            'User-provided heritage review',
                        )}
                        .{' '}
                        {inspected.properties?.namingStatus === 'restored'
                          ? 'The source layer had no identifier for this tehsil.'
                          : 'Source identifier is retained for reference.'}
                      </small>
                      <button type="button" onClick={() => setInspected(null)}>
                        Back to Punjab tehsils
                      </button>
                    </div>
                  </section>
                ) : province ? (
                  <>
                    <div className="ua-breadcrumb">
                      <button type="button" onClick={national}>
                        United Subcontinent
                      </button>
                      <ChevronRight size={13} />
                      <span>{province.name}</span>
                      {selected && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelected('');
                            setLevel('province');
                            setPunjabOnly(false);
                          }}
                          aria-label="Resume hover previews"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <ProvincePanel
                      province={profileProvince!}
                      onFocus={() => choose(province.id, true)}
                      onDetail={(v) => {
                        choose(province.id, true);
                        setLevel(v);
                      }}
                    />
                  </>
                ) : (
                  <div className="ua-welcome">
                    <span className="ua-kicker">
                      AN INTERACTIVE ALTERNATIVE ATLAS
                    </span>
                    <h2>
                      One subcontinent.
                      <br />
                      Many histories.
                    </h2>
                    <p>
                      Explore a hypothetical union through its landscapes,
                      languages and shared heritage. Select a province to open
                      its atlas profile.
                    </p>
                    <div className="ua-welcome-stat">
                      <strong>{data.provinces.length}</strong>
                      <span>
                        States, provinces
                        <br />& union territories
                      </span>
                    </div>
                    <h3>Begin with the redesigned provinces</h3>
                    {data.provinces.slice(0, 10).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => choose(p.id, true)}
                      >
                        <i style={{ background: p.color }} />
                        <span>
                          {p.name}
                          <small>{p.capital}</small>
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                    <p className="ua-data-note">
                      This is an editorial political proposal, not a map of
                      present sovereignty. National geometry includes
                      source-edition and disputed-boundary notes. Statistics and
                      proposals are labelled separately.
                    </p>
                  </div>
                )}
              </aside>
            </div>
            <footer className="ua-footer">
              <span>{data.caption}</span>
              <span>Custom atlas · no password required</span>
            </footer>
          </>
        )}
        <Dialog open={research} onOpenChange={setResearch}>
          <DialogContent className="ua-research">
            <DialogTitle>
              Boundary decisions & administrative changes
            </DialogTitle>
            <DialogDescription>
              Editorial proposals with source identities. Historical facts do
              not confer territorial ownership.
            </DialogDescription>
            {error && (
              <p role="alert" className="ua-error">
                {error}
              </p>
            )}
            {!analysis ? (
              <p>Loading protected research…</p>
            ) : (
              <>
                <div className="ua-audit">
                  <strong>{data?.auditSummary.provinceCount} provinces</strong>
                  <span>
                    Exact overlaps: {data?.auditSummary.exactOverlapKm2} km²
                  </span>
                  <span>
                    Unassigned source footprint:{' '}
                    {data?.auditSummary.unassignedSourceFootprintKm2} km²
                  </span>
                </div>
                <details open>
                  <summary>Territorial reasoning</summary>
                  {analysis.decisions.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </details>
                <details>
                  <summary>All 72 selected KP source tehsils</summary>
                  <div className="ua-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Current district / tehsil</th>
                          <th>Decision</th>
                          <th>Evidence & reasoning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.kpReview.map((r) => (
                          <tr key={r.sourceId}>
                            <td>
                              {r.district}
                              <br />
                              <strong>{r.tehsil}</strong>
                              <small>
                                {r.sourceId}
                                {r.previouslySelected
                                  ? ' · Earlier heritage selection'
                                  : ''}
                              </small>
                            </td>
                            <td>
                              {r.proposedProvince}
                              <small>{r.decision}</small>
                            </td>
                            <td>
                              {r.reason}{' '}
                              <a
                                href={r.source}
                                target="_blank"
                                rel="noreferrer"
                              >
                                PBS source
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <details>
                  <summary>Geometry methods, disputed areas & coverage</summary>
                  <p>{analysis.audit.areaMethod}</p>
                  <p>{analysis.audit.renderingMethod}</p>
                  <p>
                    {analysis.audit.seamReconciliation?.length || 0} enclosed
                    source-edition seams were reconciled. These cartographic
                    alignments preserve the Indian source reference edge and do
                    not settle disputed frontiers.
                  </p>
                  <p>
                    Detail gaps below are source coverage limitations. The
                    province map covers the complete allocated source footprint;
                    no unnamed administrative district is fabricated.
                  </p>
                  {analysis.audit.detailCoverage
                    .filter((r) => r.districtCoverageGapKm2 > 0)
                    .map((r) => (
                      <p key={r.province}>
                        {r.province}: {r.districtCoverageGapKm2} km² without
                        matched district detail.
                      </p>
                    ))}
                  {analysis.audit.sourceAdjustments.map((r, i) => (
                    <p key={i}>
                      {r.province}: {r.overlapRemovedKm2} km² of competing
                      source geometry removed. {r.reason}
                    </p>
                  ))}
                </details>
                <h3>Administrative change table</h3>
                <p>
                  Punjab district names follow the current map edits. Source
                  reasoning still describes the original subdivision choices.
                </p>
                <div className="ua-research-tools">
                  <input
                    aria-label="Search administrative changes"
                    type="search"
                    value={researchQuery}
                    onChange={(e) => setResearchQuery(e.target.value)}
                    placeholder="Search current or proposed areas"
                  />
                  <button type="button" onClick={csv}>
                    <Download size={15} />
                    Download CSV
                  </button>
                </div>
                <div className="ua-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Current district / tehsil</th>
                        <th>Proposed district</th>
                        <th>Division</th>
                        <th>Province</th>
                        <th>Capital</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((r, i) => (
                        <tr key={r.sourceId + '-' + i}>
                          <td>
                            {r.currentDistrict}
                            <br />
                            {r.currentTehsil}
                            <small>{r.sourceId}</small>
                          </td>
                          <td>
                            {r.proposedDistrict}
                            {r.proposedTehsil && (
                              <small>Tehsil: {r.proposedTehsil}</small>
                            )}
                          </td>
                          <td>
                            {r.proposedDivision}
                            <small>Seat: {r.divisionCapital}</small>
                          </td>
                          <td>{r.proposedProvince}</td>
                          <td>{r.proposedCapital}</td>
                          <td>
                            {r.reason}
                            <small>{r.method}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
