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
        id: 'punjab-d-panja-sahib',
        members: ['punjab-d-panja-sahib', 'punjab-d-attock'],
        name: 'Panja Sahib',
      },
      {
        id: 'punjab-d-katas-raj-salt-range',
        members: ['punjab-d-katas-raj-salt-range', 'punjab-d-chakwal'],
        name: 'Katas Raj',
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
      group.members.forEach((id: string) => used.add(id));
      groups.push({ id: group.id, members: group.members, name: group.name });
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

function paletteColor(index: number) {
  const hue = (index * 137.508 + 198) % 360;
  const saturation = 0.55;
  const lightness = index % 3 === 0 ? 0.62 : index % 3 === 1 ? 0.69 : 0.57;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(
      255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
    )
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function styleDistrictFeatures(
  merged: FeatureCollection,
  source: FeatureCollection,
  edits: DistrictEdits,
): FeatureCollection {
  const ids = source.features.map(districtId).sort();
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

export function districtDisplayNames(
  source: FeatureCollection,
  edits: DistrictEdits,
): Record<string, string> {
  const originalNames: Record<string, string> = {
    'punjab-d-panja-sahib': 'Panja Sahib',
    'punjab-d-attock': 'Attock',
    'punjab-d-katas-raj-salt-range': 'Katas Raj–Salt Range',
    'punjab-d-chakwal': 'Chakwal',
    'punjab-d-kartarpur-ravi': 'Kartarpur–Ravi',
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
