"""Comprehensive desk-health report generation (stats + RAG + LLM/fallback)."""

from .generator import ReportGenerator
from .types import (
    AiReport,
    ReportPeriod,
    ReportRequest,
    ReportResponse,
    ReportStats,
)

__all__ = [
    "AiReport",
    "ReportGenerator",
    "ReportPeriod",
    "ReportRequest",
    "ReportResponse",
    "ReportStats",
]
