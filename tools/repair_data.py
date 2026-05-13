from __future__ import annotations

import runpy
from pathlib import Path


SCRIPT = Path(__file__).with_name("apply_primary_report_updates.py")


if __name__ == "__main__":
    runpy.run_path(str(SCRIPT), run_name="__main__")
