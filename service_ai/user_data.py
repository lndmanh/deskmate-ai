import os
import sys
from pathlib import Path


def user_data_root() -> Path:
    app_name = "DeskMate AI"

    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            return Path(local_app_data) / app_name / "data"
        return Path.home() / "AppData" / "Local" / app_name / "data"

    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / app_name / "data"

    xdg_data_home = os.environ.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home) / "deskmate-ai"

    return Path.home() / ".local" / "share" / "deskmate-ai"


def user_data_path(*parts: str) -> Path:
    return user_data_root().joinpath(*parts)
