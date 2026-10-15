"""Estimate tree cover and maximum mapped elevation from public numeric COGs.

No statistics are inferred from RGB map images. Estimates use only the current
unchanged Punjab polygon; Amb is excluded by that polygon. Cache is ignored.
"""
import hashlib
import json
import math
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ('work/geometry-runtime-win' if sys.platform == 'win32' else 'work/geometry-runtime')))
import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.transform import Affine
from rasterio.windows import from_bounds, Window
from shapely.geometry import shape, mapping, box

boundary_path = ROOT / 'work/punjab-stat-boundary.geojson'
boundary = json.loads(boundary_path.read_text(encoding='utf-8'))['geometry']
region = shape(boundary)
CACHE = ROOT / 'work/punjab-raster-cache'
CACHE.mkdir(parents=True, exist_ok=True)
GDAL = dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_TIMEOUT=60,
            GDAL_HTTP_MAX_RETRY=2, CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_CACHEMAX=128)

def cell_areas(transform, rows):
    # Exact ellipsoidal surface area bounded by meridians/parallels per row.
    a, e2 = 6378137.0, 0.0066943799901413165
    e = math.sqrt(e2)
    top = transform.f + np.arange(rows) * transform.e
    bottom = top + transform.e
    def integral(lat):
        u = np.sin(np.deg2rad(lat))
        return 0.5 * (u / (1 - e2 * u * u) + np.arctanh(e * u) / e)
    return np.abs(a*a*(1-e2)*math.radians(transform.a)*(integral(top)-integral(bottom))) / 1e6

def read_grid(url, key, resolution=None):
    cache = CACHE / (key + '.npz')
    if cache.exists():
        with np.load(cache) as saved:
            return saved['values'], Affine(*saved['transform']), float(saved['nodata'])
    with rasterio.Env(**GDAL):
        with rasterio.open(url) as dataset:
            intersection = region.intersection(box(*dataset.bounds))
            assert not intersection.is_empty
            window = from_bounds(*intersection.bounds, transform=dataset.transform)
            window = Window(math.floor(window.col_off), math.floor(window.row_off),
                math.ceil(window.col_off+window.width)-math.floor(window.col_off),
                math.ceil(window.row_off+window.height)-math.floor(window.row_off))
            window = window.intersection(Window(0, 0, dataset.width, dataset.height))
            if resolution:
                scale = resolution / abs(dataset.transform.e)
                rows, cols = max(1, math.ceil(window.height/scale)), max(1, math.ceil(window.width/scale))
                values = dataset.read(1, window=window, out_shape=(rows, cols), resampling=Resampling.nearest)
                transform = dataset.window_transform(window) * Affine.scale(window.width/cols, window.height/rows)
            else:
                values = dataset.read(1, window=window)
                transform = dataset.window_transform(window)
            nodata = float(dataset.nodata) if dataset.nodata is not None else -99999.0
    np.savez_compressed(cache, values=values, transform=np.array(tuple(transform)[:6]), nodata=nodata)
    return values, transform, nodata

def tiles(step):
    minx, miny, maxx, maxy = region.bounds
    return [(x, y) for y in range(math.floor(miny/step)*step, math.ceil(maxy/step)*step, step)
            for x in range(math.floor(minx/step)*step, math.ceil(maxx/step)*step, step)
            if region.intersection(box(x, y, x+step, y+step)).area > 1e-12]

def forest_tile(tile, resolution):
    x, y = tile
    tag = f'N{y:02}E{x:03}'
    url = f'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{tag}_Map.tif'
    values, transform, nodata = read_grid(url, f'worldcover-{tag}-{resolution}', resolution)
    inside = geometry_mask([boundary], values.shape, transform, invert=True)
    valid = inside & (values != nodata) & (values != 0)
    weights = cell_areas(transform, values.shape[0])
    total = float(np.sum(np.sum(inside, axis=1) * weights))
    covered = float(np.sum(np.sum(valid, axis=1) * weights))
    tree = float(np.sum(np.sum(valid & (values == 10), axis=1) * weights))
    return {'tile': tag, 'sourceUrl': url, 'treeAreaKm2': tree, 'coveredAreaKm2': covered, 'gridAreaKm2': total}

def terrain_tile(tile, resolution):
    x, y = tile
    spacing = '10' if resolution == 30 else '30'
    tag = f'Copernicus_DSM_COG_{spacing}_N{y:02}_00_E{x:03}_00_DEM'
    url = f'https://copernicus-dem-{resolution}m.s3.amazonaws.com/{tag}/{tag}.tif'
    values, transform, nodata = read_grid(url, f'dem-{resolution}-{x}-{y}')
    inside = geometry_mask([boundary], values.shape, transform, invert=True)
    valid = inside & np.isfinite(values) & (values != nodata)
    assert np.any(valid), tag + ' no covered cells'
    heights = np.where(valid, values, -np.inf)
    row, col = np.unravel_index(np.argmax(heights), values.shape)
    lon, lat = transform * (float(col)+0.5, float(row)+0.5)
    assert region.covers(shape({'type': 'Point', 'coordinates': [lon, lat]}))
    weights = cell_areas(transform, values.shape[0])
    return {'tile': [x, y], 'sourceUrl': url, 'elevationMeters': float(heights[row, col]),
            'coordinates': [lon, lat], 'resolutionMeters': resolution,
            'gridAreaKm2': float(np.sum(np.sum(inside, axis=1)*weights)),
            'coveredAreaKm2': float(np.sum(np.sum(valid, axis=1)*weights))}

def batch(function, jobs, label):
    result = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(function, job): job for job in jobs}
        for future in as_completed(futures):
            value = future.result()
            result.append(value)
            print(json.dumps({'step': label, 'completed': len(result), 'total': len(jobs), 'tile': value['tile']}), flush=True)
    return result

forest = batch(lambda tile: forest_tile(tile, 0.001), tiles(3), 'WorldCover ~100m classified grid')
covered = sum(t['coveredAreaKm2'] for t in forest)
grid_area = sum(t['gridAreaKm2'] for t in forest)
assert covered / grid_area > 0.999, 'Incomplete classified raster coverage'
tree_share = sum(t['treeAreaKm2'] for t in forest) / covered
coarse = batch(lambda tile: terrain_tile(tile, 90), tiles(1), 'Copernicus GLO-90')
assert sum(t['coveredAreaKm2'] for t in coarse) / sum(t['gridAreaKm2'] for t in coarse) > 0.999
coarse_max = max(t['elevationMeters'] for t in coarse)
candidates = [tuple(t['tile']) for t in coarse if t['elevationMeters'] >= coarse_max-300]
fine = []
for tile in candidates:
    try:
        result = terrain_tile(tile, 30)
        fine.append(result)
        print(json.dumps({'step': 'Copernicus GLO-30 refinement', **result}), flush=True)
    except rasterio.errors.RasterioIOError as error:
        print('30m tile unavailable; retained the complete 90m baseline for this tile: ' + str(error), flush=True)
best = max(coarse + fine, key=lambda t: t['elevationMeters'])
result = {
    'revision': 'punjab-environment-estimates-2026-10-15', 'retrieved': '2026-10-15',
    'boundarySha256': hashlib.sha256(region.wkb).hexdigest(),
    'boundaryHashMethod': 'SHA-256 of WGS84 geometry WKB; independent of JSON integer/decimal formatting',
    'forest': {'treeCoverShare': tree_share, 'sourceUrl': 'https://esa-worldcover.org/en/data-access', 'year': 2021,
        'classCode': 10, 'gridSpacingDegrees': 0.001, 'coveragePercent': covered/grid_area*100,
        'method': 'Area-weighted count of class-10 cells from numeric ESA WorldCover 2021 v200 COGs resampled by nearest-neighbour to a 0.001-degree classified grid, using available categorical overviews. Boundary-cell centres must lie inside Punjab. Share is applied to the exact geodesic state area. This is a generalized tree-cover estimate, includes plantations, and is not official recorded forest area.',
        'tiles': forest, 'credit': '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium', 'license': 'CC BY 4.0'},
    'highestPoint': {**best, 'rawElevationMeters': best['elevationMeters'],
        'elevationMeters': round(best['elevationMeters']/10)*10,
        'sourceUrl': 'https://registry.opendata.aws/copernicus-dem/',
        'note': 'Highest mapped raster elevation estimate: complete 90m Copernicus surface-model coverage, with available 30m refinement of tiles within 300m of the coarse maximum. Rounded to 10m; not a surveyed summit height.',
        'coveragePercent': sum(t['coveredAreaKm2'] for t in coarse)/sum(t['gridAreaKm2'] for t in coarse)*100,
        'coarseTiles': coarse, 'refinedTiles': fine}
}
target = ROOT / 'app/united-punjab-environment.json'
target.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({'treeCoverPercent': tree_share*100, 'highestMappedPoint': best}), flush=True)
