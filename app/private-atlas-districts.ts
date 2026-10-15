import polygonClipping from 'polygon-clipping';
import reorganization from './united-punjab-reorganization.json';
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';

export type DistrictGroup = {
  id: string;
  members: string[];
  name: string;
};

export type DistrictEdits = {
  groups: DistrictGroup[];
  names: Record<string, string>;
  colors: Record<string, string>;
  revision?: string;
};

export type HypotheticalDemographics = {
  total: number;
  religions: { name: string; population: number; key?: string; percentage?: number; urbanPopulation?: number; ruralPopulation?: number; color?: string }[];
  note: string;
  version?: string;
  year?: number;
  urbanPopulation?: number;
  ruralPopulation?: number;
  urbanPercent?: number;
  density?: number | null;
  largestCommunity?: string;
};

export type HypotheticalPopulation = {total: number; note: string};
type ScenarioProperties = {
  hypotheticalPopulation?: HypotheticalPopulation;
  hypotheticalDemographics?: HypotheticalDemographics;
};
export function populationScenario(properties: ScenarioProperties | null | undefined): HypotheticalPopulation | undefined {
  return properties?.hypotheticalPopulation || properties?.hypotheticalDemographics;
}
export function sumDistrictPopulation(features: Feature[]): HypotheticalPopulation | undefined {
  const scenarios = features.map(feature => populationScenario(feature.properties));
  if (!scenarios.length || scenarios.some(scenario => !scenario)) return undefined;
  return {total: scenarios.reduce((sum, scenario) => sum + scenario!.total, 0), note: scenarios[0]!.note};
}

export function sumDistrictDemographics(
  features: Feature[],
): HypotheticalDemographics | undefined {
  const scenarios = features.map(
    (feature) =>
      feature.properties?.hypotheticalDemographics as
        | HypotheticalDemographics
        | undefined,
  );
  if (!scenarios.length || scenarios.some((scenario) => !scenario))
    return undefined;
  const religions = new Map<string, number>();
  let total = 0;
  for (const scenario of scenarios) {
    total += scenario!.total;
    for (const religion of scenario!.religions)
      religions.set(
        religion.name,
        (religions.get(religion.name) || 0) + religion.population,
      );
  }
  const first = scenarios[0]!;
  const urbanPopulation = scenarios.reduce((sum, scenario) => sum + (scenario!.urbanPopulation || 0), 0);
  const combinedArea = features.reduce((sum, feature) => sum + Number(feature.properties?.areaKm2 || 0), 0);
  const entries = [...religions].map(([name, population]) => {
    const original = first.religions.find(r => r.name === name)!;
    const urban = scenarios.reduce((sum, scenario) => sum + (scenario!.religions.find(r=>r.name===name)?.urbanPopulation || 0), 0);
    return {...original, name, population, ...(first.version ? {percentage: population / total * 100, urbanPopulation:urban,ruralPopulation:population-urban} : {})};
  });
  return {
    total,
    religions: entries,
    note: first.note,
    ...(first.version ? {version:first.version,year:first.year,urbanPopulation,ruralPopulation:total-urbanPopulation,
      urbanPercent:urbanPopulation/total*100,density:combinedArea>0?total/combinedArea:null,
      largestCommunity:[...entries].sort((a,b)=>b.population-a.population)[0]?.key} : {}),
  };
}

export function summarizeDistrictDivisions(districts: Feature[]) {
  const members = new Map<string, Feature[]>();
  for (const district of districts) {
    const name = String(district.properties?.division || '');
    if (!members.has(name)) members.set(name, []);
    members.get(name)!.push(district);
  }
  return [...members].map(([name, features]) => ({
    name,
    capital: String(features[0].properties?.divisionCapital || ''),
    areaKm2: features.reduce(
      (total, feature) => total + Number(feature.properties?.areaKm2 || 0),
      0,
    ),
    districtCount: features.length,
    tehsilCount: features.reduce(
      (total, feature) => total + Number(feature.properties?.tehsilCount || 0),
      0,
    ),
    districtStats: features
      .map((feature) => ({
        name: String(feature.properties?.name),
        areaKm2: Number(feature.properties?.areaKm2 || 0),
        tehsilCount: Number(feature.properties?.tehsilCount || 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    hypotheticalDemographics: sumDistrictDemographics(features),
    hypotheticalPopulation: sumDistrictPopulation(features),
  }));
}

export const districtEditsStorageKey = 'private-atlas-punjab-districts-v1';

export function defaultDistrictEdits(): DistrictEdits {
  return {
    groups: [], // Approved merges now live in the canonical hierarchy.
    names: { 'punjab-d-kasur-bulleh-shah': 'Bulleh Shah' },
    colors: {},
    revision: reorganization.revision,
  };
}

export function canonicalDistrictId(id: string): string {
  return (reorganization.retiredDistrictIds as Record<string, string>)[id] || id;
}

export function migrateDistrictEdits(saved: DistrictEdits): DistrictEdits {
  const protectedIds = new Set(Object.values(reorganization.retiredDistrictIds));
  const groups = saved.groups.flatMap(group => {
    const members = [...new Set(group.members.map(canonicalDistrictId))];
    if (members.length < 2 || members.some(id => protectedIds.has(id))) return [];
    return [{...group, id: members[0], members}];
  });
  const names = Object.fromEntries(Object.entries(saved.names).filter(([id]) =>
    id === canonicalDistrictId(id) && !protectedIds.has(id)));
  // Apply the requested existing palette afresh once for the new hierarchy.
  const colors = saved.revision === reorganization.revision ? saved.colors : {};
  return {...saved, groups, names, colors, revision: reorganization.revision};
}

export function readDistrictEdits(): DistrictEdits {
  const fallback = defaultDistrictEdits();
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = JSON.parse(
      localStorage.getItem(districtEditsStorageKey) || 'null',
    );
    if (!saved || !Array.isArray(saved.groups) || !saved.names || !saved.colors)
      return fallback;
    const groups: DistrictGroup[] = [];
    const used = new Set<string>();
    for (const group of saved.groups) {
      if (
        typeof group?.id !== 'string' ||
        !Array.isArray(group.members) ||
        group.members.length < 2 ||
        typeof group.name !== 'string' ||
        group.name.length > 70 ||
        group.members[0] !== group.id ||
        group.members.some(
          (id: unknown) =>
            typeof id !== 'string' ||
            !id.startsWith('punjab-d-') ||
            used.has(id),
        )
      )
        return fallback;
      if (
        group.id === 'punjab-d-panja-sahib' &&
        group.members.length === 2 &&
        group.members[1] === 'punjab-d-attock'
      )
        continue; // Full Attock is now part of Panja Sahib in the atlas data.
      group.members.forEach((id: string) => used.add(id));
      groups.push({
        id: group.id,
        members: group.members,
        name:
          group.id === 'punjab-d-katas-raj-salt-range' &&
          group.name === 'Katas Raj'
            ? 'Katas'
            : group.name,
      });
    }
    const names = Object.fromEntries(
      Object.entries(saved.names).filter(
        ([id, name]) =>
          id.startsWith('punjab-d-') &&
          typeof name === 'string' &&
          name.length <= 70,
      ),
    ) as Record<string, string>;
    const colors = Object.fromEntries(
      Object.entries(saved.colors).filter(
        ([id, color]) =>
          id.startsWith('punjab-d-') &&
          typeof color === 'string' &&
          /^#[0-9a-f]{6}$/i.test(color),
      ),
    ) as Record<string, string>;
    return migrateDistrictEdits({ groups, names, colors, revision: saved.revision });
  } catch {
    return fallback;
  }
}

type DistrictFeature = Feature<Polygon | MultiPolygon>;
const districtId = (feature: Feature) => String(feature.properties?.id || '');
const asMulti = (feature: DistrictFeature) =>
  (feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates) as polygonClipping.MultiPolygon;

export function mergeDistrictFeatures(
  source: FeatureCollection,
  groups: DistrictGroup[],
): FeatureCollection {
  const byId = new Map(
    source.features.map((feature) => [districtId(feature), feature]),
  );
  const replaced = new Map<string, Feature>();
  const hidden = new Set<string>();
  for (const group of groups) {
    const members = group.members.map((id) => byId.get(id));
    if (members.some((feature) => !feature)) continue;
    const features = members as DistrictFeature[];
    if (
      features.some(
        (feature) =>
          !['Polygon', 'MultiPolygon'].includes(feature.geometry.type),
      )
    )
      continue;
    const geometry = polygonClipping.union(
      asMulti(features[0]),
      ...features.slice(1).map(asMulti),
    );
    const bounds = features.map(
      (feature) => feature.properties?.bbox as number[],
    );
    const bbox = [
      Math.min(...bounds.map((b) => b[0])),
      Math.min(...bounds.map((b) => b[1])),
      Math.max(...bounds.map((b) => b[2])),
      Math.max(...bounds.map((b) => b[3])),
    ];
    const names = features.map((feature) => String(feature.properties?.name));
    const sourceIds = [
      ...new Set(
        features.map((feature) => String(feature.properties?.sourceId)),
      ),
    ];
    replaced.set(group.id, {
      ...features[0],
      geometry: { type: 'MultiPolygon', coordinates: geometry },
      properties: {
        ...features[0].properties,
        id: group.id,
        name: group.name,
        bbox,
        sourceId: sourceIds.join(' + '),
        areaKm2: features.reduce(
          (total, feature) => total + Number(feature.properties?.areaKm2 || 0),
          0,
        ),
        tehsilCount: features.reduce(
          (total, feature) =>
            total + Number(feature.properties?.tehsilCount || 0),
          0,
        ),
        hypotheticalDemographics: sumDistrictDemographics(features),
        hypotheticalPopulation: sumDistrictPopulation(features),
        sourceName: [
          ...new Set(
            features
              .map((feature) => feature.properties?.sourceName)
              .filter(Boolean),
          ),
        ].join(' + '),
        keyCities: [
          ...new Set(
            features.flatMap((feature) => feature.properties?.keyCities || []),
          ),
        ],
        mergedFrom: names,
        reason: `Merged ${names.join(' and ')} for this editable proposal; original source boundaries are retained in the atlas dataset.`,
      },
    });
    group.members.slice(1).forEach((id) => hidden.add(id));
  }
  const features = source.features.flatMap((feature) => {
    const id = districtId(feature);
    return hidden.has(id) ? [] : [replaced.get(id) || feature];
  });
  const ranked = features.filter(feature => populationScenario(feature.properties)).sort(
    (a, b) =>
      Number(populationScenario(b.properties)?.total || 0) -
        Number(populationScenario(a.properties)?.total || 0) ||
      String(a.properties?.name).localeCompare(String(b.properties?.name)),
  );
  const populationRanks = new Map(
    ranked.map((feature, index) => [districtId(feature), index + 1]),
  );
  return {
    type: 'FeatureCollection',
    features: features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        populationRank: populationRanks.get(districtId(feature)),
        populationRankCount: populationRanks.has(districtId(feature)) ? ranked.length : undefined,
        density: populationScenario(feature.properties)
          ? Math.round(
              populationScenario(feature.properties)!.total /
                feature.properties?.areaKm2 * 10,
            ) / 10
          : undefined,
      },
    })),
  };
}

export const punjabPalette = [
  { name: 'Sage', color: '#AFC7B1' },
  { name: 'Sky', color: '#A9C7DD' },
  { name: 'Apricot', color: '#E5B48F' },
  { name: 'Lilac', color: '#C4AED2' },
  { name: 'Rose', color: '#D8A6AD' },
  { name: 'Olive', color: '#C2C58F' },
  { name: 'Teal', color: '#93C2BE' },
  { name: 'Sand', color: '#DCC89F' },
  { name: 'Periwinkle', color: '#ABB6D7' },
  { name: 'Moss', color: '#9EBA9A' },
  { name: 'Powder Blue', color: '#BDD5E3' },
  { name: 'Peach', color: '#E8C3AA' },
  { name: 'Lavender', color: '#D7C5E2' },
  { name: 'Blush', color: '#E3BDC3' },
  { name: 'Butter', color: '#E5D792' },
  { name: 'Seafoam', color: '#B7D8C5' },
  { name: 'Clay', color: '#CFA68C' },
  { name: 'Slate Blue', color: '#91AEC8' },
  { name: 'Pistachio', color: '#D1DAB2' },
  { name: 'Dusty Pink', color: '#CA97A5' },
  { name: 'Turquoise', color: '#A0D0D0' },
  { name: 'Honey', color: '#DCC078' },
  { name: 'Violet', color: '#B49FC4' },
  { name: 'Mint', color: '#A5D2B5' },
  { name: 'Terracotta', color: '#D69D88' },
  { name: 'Denim', color: '#9AAED0' },
  { name: 'Celadon', color: '#C3D5C5' },
  { name: 'Mauve', color: '#C8B0BB' },
  { name: 'Oat', color: '#E2D5B6' },
  { name: 'Dusk', color: '#B2B8C9' },
  { name: 'Fern', color: '#B3C392' },
  { name: 'Cornflower', color: '#AFBDDD' },
  { name: 'Salmon', color: '#E0AE9D' },
  { name: 'Orchid', color: '#CEB3D5' },
  { name: 'Warm Rose', color: '#DEBCC0' },
  { name: 'Lemon', color: '#D8DCA1' },
  { name: 'Lagoon', color: '#8FB9B3' },
  { name: 'Caramel', color: '#D4B18A' },
  { name: 'Heather', color: '#B7AFCB' },
  { name: 'Avocado', color: '#A8BAA0' },
  { name: 'Ice Blue', color: '#C5DBDC' },
  { name: 'Coral', color: '#D79DA0' },
  { name: 'Amber', color: '#E3C69A' },
  { name: 'Wisteria', color: '#C2B5D9' },
  { name: 'Aqua', color: '#AFCDD1' },
] as const;

export function paletteColor(index: number, palette: readonly {color: string}[] = punjabPalette): string {
  const active = palette.length ? palette : punjabPalette;
  return active[index % active.length].color;
}

export function styleDistrictFeatures(
  merged: FeatureCollection,
  source: FeatureCollection,
  edits: DistrictEdits,
  palette: readonly {color: string}[] = punjabPalette,
): FeatureCollection {
  const ids = [...merged.features]
    .sort(
      (a, b) =>
        String(edits.names[districtId(a)] || a.properties?.name).localeCompare(
          String(edits.names[districtId(b)] || b.properties?.name),
        ) || districtId(a).localeCompare(districtId(b)),
    )
    .map(districtId);
  return {
    type: 'FeatureCollection',
    features: merged.features.map((feature) => {
      const id = districtId(feature);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          name: edits.names[id]?.trim() || feature.properties?.name,
          color: edits.colors[id] || paletteColor(ids.indexOf(id), palette),
        },
      };
    }),
  };
}

export type TehsilColorMode = 'district' | 'tehsil';

export function styleTehsilFeatures(
  tehsils: FeatureCollection,
  districts: FeatureCollection,
  edits: DistrictEdits,
  mode: TehsilColorMode,
  palette: readonly {color: string}[] = punjabPalette,
): FeatureCollection {
  const styledDistricts = styleDistrictFeatures(
    mergeDistrictFeatures(districts, edits.groups),
    districts,
    edits,
    palette,
  );
  const displayedNames = districtDisplayNames(districts, edits);
  const districtByName = new Map(
    styledDistricts.features.map((feature) => [
      String(feature.properties?.name),
      feature,
    ]),
  );
  const tehsilIds = [...tehsils.features]
    .sort(
      (a, b) =>
        String(a.properties?.name).localeCompare(String(b.properties?.name)) ||
        districtId(a).localeCompare(districtId(b)),
    )
    .map(districtId);
  const tehsilOrder = new Map(tehsilIds.map((id, index) => [id, index]));
  return {
    type: 'FeatureCollection',
    features: tehsils.features.map((feature) => {
      const districtName =
        displayedNames[String(feature.properties?.district || '')] ||
        String(feature.properties?.district || '');
      const parent = districtByName.get(districtName);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          district: districtName,
          parentDistrictId: String(parent?.properties?.id || ''),
          color:
            mode === 'district'
              ? String(parent?.properties?.color || '#ffffff')
              : paletteColor(tehsilOrder.get(districtId(feature)) || 0, palette),
        },
      };
    }),
  };
}

export function districtDisplayNames(
  source: FeatureCollection,
  edits: DistrictEdits,
): Record<string, string> {
  const originalNames: Record<string, string> = {
    'punjab-d-panja-sahib': 'Panja Sahib',
    'punjab-d-attock': 'Attock',
    'punjab-d-katas-raj-salt-range': 'Katas',
    'punjab-d-chakwal': 'Chakwal',
    'punjab-d-kartarpur-ravi': 'Kartarpur Sahib',
    'punjab-d-narowal': 'Narowal',
    'punjab-d-kasur-bulleh-shah': 'Kasur–Bulleh Shah',
  };
  for (const feature of source.features)
    originalNames[districtId(feature)] = String(feature.properties?.name || '');
  const result: Record<string, string> = {};
  for (const [id, originalName] of Object.entries(originalNames)) {
    const group = edits.groups.find((candidate) =>
      candidate.members.includes(id),
    );
    const displayedId = group?.id || id;
    result[originalName] =
      edits.names[displayedId]?.trim() || group?.name || originalName;
  }
  return result;
}

export function mergeEditedDistricts(
  edits: DistrictEdits,
  targetId: string,
  otherId: string,
  displayed: FeatureCollection,
): DistrictEdits {
  if (targetId === otherId) return edits;
  const target = displayed.features.find(
    (feature) => districtId(feature) === targetId,
  );
  const other = displayed.features.find(
    (feature) => districtId(feature) === otherId,
  );
  if (!target || !other) return edits;
  const members = (id: string) =>
    edits.groups.find((group) => group.id === id)?.members || [id];
  const group: DistrictGroup = {
    id: targetId,
    members: [...members(targetId), ...members(otherId)],
    name: String(target.properties?.name),
  };
  return {
    ...edits,
    groups: [
      ...edits.groups.filter(
        (existing) => existing.id !== targetId && existing.id !== otherId,
      ),
      group,
    ],
  };
}
