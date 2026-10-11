"""Apply reviewed province regroupings from the private editorial backup."""
import runpy
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'private/united-atlas/regroup-north.py'
if not path.exists():
    raise SystemExit('Private editorial inputs are unavailable. Restore the private atlas backup.')
runpy.run_path(str(path), run_name='__main__')
