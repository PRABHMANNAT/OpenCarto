import polygonClipping from 'polygon-clipping';
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
};

export const districtEditsStorageKey = 'private-atlas-punjab-districts-v1';

export function defaultDistrictEdits(): DistrictEdits {
  return {
    groups: [
      {
        id: 'punjab-d-katas-raj-salt-range',
        members: ['punjab-d-katas-raj-salt-range', 'punjab-d-chakwal'],
        name: 'Katas',
      },
      {
        id: 'punjab-d-kartarpur-ravi',
        members: ['punjab-d-kartarpur-ravi', 'punjab-d-narowal'],
        name: 'Kartarpur Sahib',
      },
    ],
    names: { 'punjab-d-kasur-bulleh-shah': 'Bulleh Shah' },
    colors: {},
  };
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
    return { groups, names, colors };
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
        mergedFrom: names,
        reason: `Merged ${names.join(' and ')} for this editable proposal; original source boundaries are retained in the atlas dataset.`,
      },
    });
    group.members.slice(1).forEach((id) => hidden.add(id));
  }
  return {
    type: 'FeatureCollection',
    features: source.features.flatMap((feature) => {
      const id = districtId(feature);
      return hidden.has(id) ? [] : [replaced.get(id) || feature];
    }),
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

export function paletteColor(index: number): string {
  return punjabPalette[index % punjabPalette.length].color;
}

export function styleDistrictFeatures(
  merged: FeatureCollection,
  source: FeatureCollection,
  edits: DistrictEdits,
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
          color: edits.colors[id] || paletteColor(ids.indexOf(id)),
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
): FeatureCollection {
  const styledDistricts = styleDistrictFeatures(
    mergeDistrictFeatures(districts, edits.groups),
    districts,
    edits,
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
              : paletteColor(tehsilOrder.get(districtId(feature)) || 0),
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
