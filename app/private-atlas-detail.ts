import type {FeatureCollection} from 'geojson';
import {paletteColor} from './private-atlas-districts';

export type AtlasDetailLevel = 'region' | 'division' | 'district' | 'tehsil';
export type ProvinceDetails = Record<string, AtlasDetailLevel>;
export const provinceDetailsStorageKey = 'private-atlas-province-details-v1';
export const nationalBorderColor = '#182d3b';
export const atlasDetailLabels = {
  region: 'Historical Regions',
  division: 'Divisions',
  district: 'Districts',
  tehsil: 'Tehsils / subdistricts',
};

export function readProvinceDetails(): ProvinceDetails {
  if (typeof window === 'undefined') return {};
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(provinceDetailsStorageKey) || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    return Object.fromEntries(Object.entries(saved).filter(([id, level]) =>
      /^[a-z][a-z0-9-]*$/.test(id) && ['region', 'division', 'district', 'tehsil'].includes(level) && (level !== 'region' || id === 'punjab'),
    ));
  } catch {
    return {};
  }
}

export function atlasDetailKey(province: string, level: AtlasDetailLevel) {
  return province + ':' + level;
}

export function tagAtlasDetail(collection: FeatureCollection, province: string, level: AtlasDetailLevel): FeatureCollection {
  return {
    ...collection,
    features: collection.features.map(feature => ({
      ...feature,
      properties: {...feature.properties, atlasProvince: province, atlasLevel: level},
    })),
  };
}

// KP uses one palette per district, shared by its linked source tehsils.
export function styleKpDetailFeatures(
  collection: FeatureCollection,
  districts: FeatureCollection,
  level: 'district' | 'tehsil',
  fills: Record<string, string>,
): FeatureCollection {
  const ordered = [...districts.features].sort((a, b) =>
    String(a.properties?.id).localeCompare(String(b.properties?.id)),
  );
  const byId = new Map(ordered.map(feature => [String(feature.properties?.id), feature]));
  const bySource = new Map(ordered.map(feature => [String(feature.properties?.sourceId), feature]));
  const byName = new Map(ordered.map(feature => [String(feature.properties?.name), feature]));
  const colors = new Map(ordered.map((feature, index) => {
    const id = String(feature.properties?.id);
    return [id, fills[id] || paletteColor(index)];
  }));
  return {
    ...collection,
    features: collection.features.map(feature => {
      const parent = level === 'district' ? feature :
        byId.get(String(feature.properties?.parentDistrictId || '')) ||
        bySource.get(String(feature.properties?.sourceParent || '')) ||
        byName.get(String(feature.properties?.district || ''));
      if (!parent) return feature;
      const id = String(parent.properties?.id);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          color: colors.get(id),
          ...(level === 'tehsil' ? {parentDistrictId: id} : {}),
        },
      };
    }),
  };
}
