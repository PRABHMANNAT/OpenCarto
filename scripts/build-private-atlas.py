"""Rebuild the atlas using private editorial inputs, which are deliberately untracked."""
import runpy
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'private/united-atlas/build.py'
if not path.exists():
    raise SystemExit('Private editorial inputs are unavailable. Restore the private atlas backup.')
(path.parent/'topology.json').unlink(missing_ok=True)
runpy.run_path(str(path),run_name='__main__')
