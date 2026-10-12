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
  type DistrictEdits,
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
type HypotheticalDemographics = {
  total: number;
  religions: { name: string; population: number }[];
  note: string;
};
type Photo = {
  url: string;
  title: string;
  caption?: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
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
type AtlasColors = { border: string; fills: Record<string, string> };
type DetailPage = FeatureCollection & { next: number | null; total: number };
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const title = 'United Subcontinent — Alternative Political Geography';
const atlasColorsStorageKey = 'private-atlas-map-colors-v1';
const defaultBorderColor = '#38536a';
const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
function readAtlasColors(): AtlasColors {
  const fallback = { border: defaultBorderColor, fills: {} };
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
function PhotoGallery({ photos }: { photos: Photo[] }) {
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
          </figcaption>
        </figure>
      </div>
      {photos.length > 1 && (
        <div className="ua-photo-controls">
          <button
            type="button"
            aria-label="Previous province photograph"
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
            aria-label="Next province photograph"
            onClick={() => setIndex((i) => (i + 1) % photos.length)}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </>
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
  mapStyle,
  colors,
  districtEditing,
  editingDistrictId,
  places,
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
  mapStyle: MapStyle;
  colors: AtlasColors;
  districtEditing: boolean;
  editingDistrictId: string;
  places: boolean;
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
  }, [districtOutlines, selected, level, colors.border, loaded, mapRef]);
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
      selected === 'punjab' && (level === 'district' || level === 'tehsil');
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
    m.setPaintProperty('detail-selected', 'line-color', colors.border);
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
    m.setFilter('detail-selected', ['==', 'id', editingDistrictId]);
    m.setLayoutProperty(
      'detail-selected',
      'visibility',
      districtEditing && level === 'district' ? 'visible' : 'none',
    );
  }, [districtEditing, editingDistrictId, level, loaded, mapRef]);
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
    m.setPaintProperty('province-highlight', 'line-color', colors.border);
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
    [detail, setDetail] = useState<FeatureCollection>(empty),
    [districtSource, setDistrictSource] = useState<FeatureCollection>(empty),
    [detailLoading, setDetailLoading] = useState(false),
    [precise, setPrecise] = useState<FeatureCollection>(empty),
    [precisionLoading, setPrecisionLoading] = useState(false),
    [inspected, setInspected] = useState<Feature | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [research, setResearch] = useState(false),
    [researchQuery, setResearchQuery] = useState('');
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
    tehsilColorMode,
    level,
    selected,
  ]);
  const currentEditingDistrictId =
    editingDistrictId ||
    String(displayedDetail.features[0]?.properties?.id || '');
  const focusedDistrict = displayedDetail.features.find(
    (feature) => feature.properties?.id === focusedDistrictId,
  );
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
            district:
              province.detailCounts.district -
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
  async function downloadMap() {
    const current = map.current;
    if (!current) {
      setError('The map is still opening. Try again shortly.');
      return;
    }
    try {
      setError('');
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
      link.download =
        selected === 'punjab' && level === 'district'
          ? (focusedDistrict
              ? String(focusedDistrict.properties?.name || 'punjab-district')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              : 'punjab-districts') +
            '-' +
            mapStyle +
            '.png'
          : 'custom-atlas-map.png';
      link.click();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The map could not be downloaded.',
      );
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
        selected === 'punjab' && level === 'tehsil'
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
                      {[...displayedDetail.features]
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
              <button
                type="button"
                onClick={() => void downloadMap()}
                disabled={detailLoading || precisionLoading}
                title="Download the current map view as a PNG image"
              >
                <Download size={16} />
                Download map
              </button>
            </nav>
            <div className="ua-workspace" data-theme={dark ? 'dark' : 'light'}>
              <div className="ua-map-pane">
                <AtlasMap
                  data={data}
                  active={active}
                  selected={selected}
                  punjabOnly={punjabOnly}
                  focusedDistrictId={focusedDistrictId}
                  mapStyle={mapStyle}
                  colors={colors}
                  districtEditing={districtEditing}
                  editingDistrictId={currentEditingDistrictId}
                  places={places}
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
                  detail={displayedDetail}
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
                      setFocusedDistrictId(id);
                      setInspected(null);
                      return;
                    }
                    setInspected(feature);
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
                ) : focusedDistrict ? (
                  <section className="ua-single-district">
                    <div className="ua-breadcrumb">
                      <button type="button" onClick={national}>
                        United Subcontinent
                      </button>
                      <ChevronRight size={13} />
                      <button
                        type="button"
                        onClick={() => setFocusedDistrictId('')}
                      >
                        Punjab
                      </button>
                      <ChevronRight size={13} />
                      <span>{String(focusedDistrict.properties?.name)}</span>
                    </div>
                    <div className="ua-profile-heading">
                      <small>DISTRICT · PROPOSED VIEW</small>
                      <h2>{String(focusedDistrict.properties?.name)}</h2>
                    </div>
                    <div className="ua-single-district-content">
                      <span
                        className="ua-district-swatch"
                        style={{
                          background: String(
                            focusedDistrict.properties?.color || '#8bb9c9',
                          ),
                        }}
                      />
                      <p>
                        {String(
                          focusedDistrict.properties?.division || 'Punjab',
                        )}{' '}
                        division
                      </p>
                      {Array.isArray(
                        focusedDistrict.properties?.mergedFrom,
                      ) && (
                        <p>
                          Merged from:{' '}
                          {focusedDistrict.properties.mergedFrom.join(', ')}
                        </p>
                      )}
                      <p>
                        {String(
                          focusedDistrict.properties?.reason ||
                            'District boundary shown from the atlas source geometry.',
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => setFocusedDistrictId('')}
                      >
                        Show all Punjab districts
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDistrictId(focusedDistrictId);
                          setFocusedDistrictId('');
                          setDistrictEditing(true);
                        }}
                      >
                        Edit this district
                      </button>
                    </div>
                  </section>
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
                        {inspected.properties?.namingStatus === 'renamed'
                          ? 'TEHSIL · PROPOSED NAME'
                          : 'TEHSIL · ESTABLISHED PLACE NAME'}
                      </small>
                      <h2>{String(inspected.properties?.name || 'Tehsil')}</h2>
                    </div>
                    <div className="ua-tehsil-profile-content">
                      <p>
                        <strong>Old name:</strong>{' '}
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
                      <small>
                        {String(inspected.properties?.namingProvenance || 'User-provided heritage review')}. Source boundary and identifier are retained.
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
