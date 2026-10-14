import type {FeatureCollection} from 'geojson';

export type AtlasDetailLevel = 'division' | 'district' | 'tehsil';
export type ProvinceDetails = Record<string, AtlasDetailLevel>;
export const provinceDetailsStorageKey = 'private-atlas-province-details-v1';
export const atlasDetailLabels = {
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
      /^[a-z][a-z0-9-]*$/.test(id) && ['division', 'district', 'tehsil'].includes(level),
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
