from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - keeps the API usable before optional deps are installed
    load_dotenv = None


def load_environment() -> None:
    if load_dotenv is not None:
        service_dir = Path(__file__).resolve().parents[1]
        load_dotenv(service_dir / ".env")
