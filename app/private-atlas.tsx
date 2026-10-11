'use client';
/* oxlint-disable next/no-img-element, jsx-a11y/prefer-tag-over-role -- Plain Vite React uses licensed remote thumbnails and accessible SVG silhouettes. */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  LockKeyhole,
  Globe2,
  Maximize,
  Plus,
  Minus,
  Moon,
  Sun,
  Search,
  MapPinned,
  ChevronRight,
  ShieldCheck,
  X,
  BookOpen,
  Download,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Map as GLMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Feature } from 'geojson';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
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
  sessionExpiresAt: number;
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
type DetailPage = FeatureCollection & { next: number | null; total: number };
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const title = 'United Subcontinent — Alternative Political Geography';
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
      'This private atlas requires the map server. Open the server-enabled app to continue.',
      503,
    );
  const data = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new AtlasError(
      data.error || 'The private map could not load.',
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

function AtlasMap({
  data,
  active,
  selected,
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
  precise,
  onDetailInspect,
}: {
  data: Overview;
  active: string;
  selected: string;
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
  precise: FeatureCollection;
  onDetailInspect: (feature: Feature) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ onSelect, onHover, onError, onDetailInspect, level });
  useEffect(() => {
    latest.current = { onSelect, onHover, onError, onDetailInspect, level };
  }, [onSelect, onHover, onError, onDetailInspect, level]);
  const [loaded, setLoaded] = useState(false);
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
    m.setFilter(
      'disputed-borders',
      context ? null : ['==', ['get', 'outside'], true],
    );
  }, [context, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    m.setFilter('place-dots', ['==', 'province', places ? selected : '']);
    m.setFilter('place-names', ['==', 'province', places ? selected : '']);
  }, [places, selected, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    void (m.getSource('details') as GeoJSONSource).setData(detail);
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
  }, [detail, level, labels, loaded, mapRef]);
  useEffect(() => {
    const m = mapRef.current;
    if (!loaded || !m) return;
    for (const layer of [
      'province-names',
      'capital-names',
      'place-names',
      'context-names',
    ])
      m.setLayoutProperty(layer, 'visibility', labels ? 'visible' : 'none');
    m.setPaintProperty(
      'background',
      'background-color',
      dark ? '#172b39' : '#eaf0f2',
    );
    m.setPaintProperty('province-fill', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'hover'], false],
      1,
      dark ? 0.76 : 0.84,
    ]);
    m.setPaintProperty(
      'province-borders',
      'line-color',
      dark ? '#bccbd6' : '#506375',
    );
  }, [dark, labels, loaded, mapRef]);
  return (
    <div
      ref={host}
      className="ua-map"
      aria-label="Interactive hypothetical India–Pakistan province map"
      aria-busy={!loaded}
    />
  );
}

export default function PrivateAtlas({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<Overview | null>(null),
    [loading, setLoading] = useState(true),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(''),
    [hover, setHover] = useState(''),
    [query, setQuery] = useState(''),
    [level, setLevel] = useState<Level>('province'),
    [dark, setDark] = useState(false),
    [context, setContext] = useState(false),
    [labels, setLabels] = useState(true),
    [places, setPlaces] = useState(true),
    [detail, setDetail] = useState<FeatureCollection>(empty),
    [detailLoading, setDetailLoading] = useState(false),
    [precise, setPrecise] = useState<FeatureCollection>(empty),
    [precisionLoading, setPrecisionLoading] = useState(false),
    [inspected, setInspected] = useState<Feature | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [research, setResearch] = useState(false),
    [researchQuery, setResearchQuery] = useState('');
  const map = useRef<GLMap | null>(null),
    sidebar = useRef<HTMLElement | null>(null),
    requestVersion = useRef(0),
    passwordInput = useRef<HTMLInputElement>(null);
  const province = data?.provinces.find((p) => p.id === (selected || hover)),
    active = selected || hover;
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
      if (e instanceof AtlasError && e.status === 401) {
        setData(null);
        setError('');
      } else
        setError(
          e instanceof Error ? e.message : 'The private atlas could not load.',
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  // oxlint-disable-next-line react/react-compiler -- Synchronise authenticated server state when this private view mounts.
  useEffect(() => {
    const controller = new AbortController();
    // oxlint-disable-next-line react/react-compiler -- Fetch and synchronise the authenticated server session.
    void fetchOverview(controller.signal);
    return () => controller.abort();
  }, [fetchOverview]);
  useEffect(() => {
    if (!data) return;
    const timeout = setTimeout(
      () => {
        setData(null);
        setAnalysis(null);
        setDetail(empty);
        setPrecise(empty);
        setSelected('');
        setHover('');
        setLevel('province');
        setResearch(false);
        setError('Your private session expired. Unlock the map to continue.');
      },
      Math.max(0, data.sessionExpiresAt - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [data]);
  // Province outlines arrive in small protected requests, then replace the
  // national coverage together so neighbouring borders share identical edges.
  // oxlint-disable-next-line react/react-compiler -- Synchronise full-resolution geometry from the authenticated server.
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- This loading flag tracks an authenticated external geometry request.
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
  async function unlock(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await request('action=unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      setPassword('');
      await fetchOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The map could not unlock.');
      setPassword('');
      passwordInput.current?.focus();
    } finally {
      setLoading(false);
    }
  }
  async function lock() {
    try {
      await request('action=session', { method: 'DELETE' });
      setData(null);
      setAnalysis(null);
      setDetail(empty);
      setPrecise(empty);
      setInspected(null);
      setQuery('');
      setSelected('');
      setHover('');
      setLevel('province');
      setResearch(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock the map.');
    }
  }
  function national() {
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
  // oxlint-disable-next-line react/react-compiler -- Loading state reflects an external protected geometry request; abort stale requests on navigation.
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Clear old external geometry and publish the current request's loading state.
    if (!selected || level === 'province') return;
    const controller = new AbortController(),
      version = ++requestVersion.current;
    // oxlint-disable-next-line react/react-compiler -- Publish loading state for the external detail request.
    setDetailLoading(true);
    setError('');
    async function load() {
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
            level +
            '&offset=' +
            offset,
          { signal: controller.signal },
        );
        result.features.push(...page.features);
        offset = page.next;
      } while (offset !== null);
      if (version === requestVersion.current) setDetail(result);
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
    if (analysis) return;
    setError('');
    try {
      setAnalysis(await request<Analysis>('action=analysis'));
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
      ...analysis.changes.map((row) =>
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
    a.download = 'private-united-subcontinent-administrative-proposal.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const changes =
    analysis?.changes.filter((r) =>
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
              Private research atlas · hypothetical political geography
            </DialogDescription>
          </div>
          {data && (
            <button type="button" onClick={() => void lock()}>
              <LockKeyhole size={16} />
              <span>Lock map</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close private atlas"
          >
            <X size={19} />
          </button>
        </header>
        {!data ? (
          <div className="ua-locked">
            <div className="ua-lock-mark">
              <LockKeyhole size={35} />
            </div>
            <span className="ua-kicker">PRIVATE ATLAS</span>
            <h2>A different political geography</h2>
            <p>
              A fictional federal union spanning India and Pakistan, with a
              researched Punjab, Multan and Bahawalpur. Unlock to explore its
              provinces and cultural histories.
            </p>
            <form onSubmit={(event) => void unlock(event)}>
              <label htmlFor="ua-password">Access password</label>
              <input
                id="ua-password"
                ref={passwordInput}
                type="password"
                autoComplete="current-password"
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !password}>
                <ShieldCheck size={17} />
                {loading ? 'Opening private atlas…' : 'Unlock map'}
              </button>
            </form>
            {error && (
              <p role="alert" className="ua-error">
                {error}
              </p>
            )}
            <small>
              Verified on the server. Protected map data loads only after
              authentication.
            </small>
          </div>
        ) : (
          <>
            <nav className="ua-controls" aria-label="Private atlas navigation">
              <button type="button" className="ua-national" onClick={national}>
                <Globe2 size={17} />
                National overview
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
                    setLevel(e.target.value as Level);
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
            </nav>
            <div className="ua-workspace" data-theme={dark ? 'dark' : 'light'}>
              <div className="ua-map-pane">
                <AtlasMap
                  data={data}
                  active={active}
                  selected={selected}
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
                  detail={detail}
                  precise={precise}
                  onDetailInspect={setInspected}
                />
                <div className="ua-map-badge">
                  <LockKeyhole size={12} />
                  <span>PRIVATE · ALTERNATIVE HISTORY</span>
                </div>
                <div className="ua-zoom">
                  <button
                    type="button"
                    aria-label="Zoom in private map"
                    onClick={() => map.current?.zoomIn()}
                  >
                    <Plus size={19} />
                  </button>
                  <button
                    type="button"
                    aria-label="Zoom out private map"
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
                    {level === 'province'
                      ? data.provinces.length +
                        ' states, provinces & union territories'
                      : province?.name + ' · ' + level + ' detail'}
                  </strong>
                  <span>
                    {detailLoading || precisionLoading
                      ? 'Loading protected geometry…'
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
                  (level !== 'province' || inspected.properties?.kind) && (
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
                {province ? (
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
                          }}
                          aria-label="Resume hover previews"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <ProvincePanel
                      province={province}
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
              <span>
                <ShieldCheck size={13} />
                Authenticated session · 2 hours
              </span>
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
                    Download private CSV
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
                          <td>{r.proposedDistrict}</td>
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
