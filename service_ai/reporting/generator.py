"""Report orchestration.

``ReportGenerator.generate`` gathers deterministic statistics + RAG context,
then either asks the LLM for the analytical report (validated against the fixed
schema) or, when the LLM is unavailable or fails, builds an equally-structured
report from heuristics. Either way the caller gets the same response shape.
"""

import json

from ai_client import get_ai_client
from rag import HybridRagRetriever

from .aggregator import (
    compute_stats,
    filter_activity,
    filter_mood,
    filter_posture,
    resolve_period,
)
from .prompts import REPORT_SYSTEM_PROMPT, build_report_user_prompt
from .types import (
    AiReport,
    DataQuality,
    DimensionStatus,
    RagDocument,
    ReportDimension,
    ReportFinding,
    ReportMetric,
    ReportPeriod,
    ReportRequest,
    ReportResponse,
    ReportStats,
    ReportSuggestion,
)

PRIVACY_NOTE = (
    "This report uses only derived signals. DeskMate processes the webcam "
    "on-device, stores no raw images, and never infers emotion from your face — "
    "mood reflects only what you self-reported."
)
DISCLAIMER = (
    "This is an ergonomics and work-rhythm overview, not medical advice. For "
    "persistent pain or health concerns, please consult a qualified professional."
)

_SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2, "info": 3}
_RAG_QUERY = (
    "daily desk health report ergonomics posture breaks work session "
    "mood energy stress eye neck shoulder reset nudge healthy routine"
)


# --------------------------------------------------------------------------- #
# Small formatting / scoring helpers
# --------------------------------------------------------------------------- #
def _clamp(value: float) -> int:
    return max(0, min(100, int(round(value))))


def _grade(score: int) -> str:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def _status(score: int) -> DimensionStatus:
    if score >= 70:
        return "good"
    if score >= 40:
        return "warning"
    return "risk"


def _fmt_dur(ms: float) -> str:
    total_min = int(ms // 60000)
    hours, minutes = divmod(total_min, 60)
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def _pretty_event(event: str) -> str:
    return event.split(".")[-1].replace("_", " ").strip().capitalize()


class ReportGenerator:
    def __init__(
        self,
        rag_store: HybridRagRetriever | None = None,
        llm=None,
    ) -> None:
        self.rag_store = rag_store or HybridRagRetriever()
        self.llm = llm or get_ai_client()

    # -- Public API ----------------------------------------------------------
    def generate(
        self,
        request: ReportRequest,
        mood_checkins: list[dict],
        posture_sessions: list[dict],
    ) -> ReportResponse:
        from_ms, to_ms, label = resolve_period(request)

        mood = filter_mood(mood_checkins, from_ms, to_ms)
        posture = filter_posture(posture_sessions, from_ms, to_ms)
        activity = filter_activity(request.activity_days, from_ms, to_ms)
        stats = compute_stats(mood, posture, activity)

        rag_docs = self._retrieve()
        period = ReportPeriod(scope=request.scope, from_ms=from_ms, to_ms=to_ms, label=label)
        generated_at_ms = to_ms

        if self.llm.is_available():
            try:
                report = self._generate_llm(stats, rag_docs, period)
                return ReportResponse(
                    used_llm=True,
                    mode="llm",
                    generated_at_ms=generated_at_ms,
                    period=period,
                    report=report,
                    stats=stats,
                    retrieved_documents=rag_docs,
                )
            except Exception as error:  # noqa: BLE001 — degrade gracefully, never 500
                return ReportResponse(
                    used_llm=False,
                    mode="fallback_error",
                    generated_at_ms=generated_at_ms,
                    period=period,
                    report=self._build_fallback(stats, period),
                    stats=stats,
                    retrieved_documents=rag_docs,
                    notice=f"AI analysis failed ({error}); showing a locally computed report.",
                )

        return ReportResponse(
            used_llm=False,
            mode="fallback_local",
            generated_at_ms=generated_at_ms,
            period=period,
            report=self._build_fallback(stats, period),
            stats=stats,
            retrieved_documents=rag_docs,
            notice=(
                "OPENAI_API_KEY is not set, so this report was computed locally. "
                "Set the key for a richer AI-written analysis."
            ),
        )

    # -- RAG -----------------------------------------------------------------
    def _retrieve(self) -> list[RagDocument]:
        try:
            documents = self.rag_store.search(_RAG_QUERY, limit=5)
        except Exception:  # noqa: BLE001 — retrieval is best-effort context
            return []
        return [
            RagDocument(
                source=document.source,
                title=document.title,
                content=document.content,
                score=document.score,
            )
            for document in documents
        ]

    # -- LLM path ------------------------------------------------------------
    def _generate_llm(
        self,
        stats: ReportStats,
        rag_docs: list[RagDocument],
        period: ReportPeriod,
    ) -> AiReport:
        stats_json = json.dumps(stats.model_dump(), ensure_ascii=False, indent=2)
        rag_block = self._format_rag(rag_docs)
        user_prompt = build_report_user_prompt(period.label, period.scope, stats_json, rag_block)

        raw = self.llm.complete(REPORT_SYSTEM_PROMPT, user_prompt, temperature=0.3)
        payload = self._extract_json(raw)
        report = AiReport.model_validate(payload)

        # Defensive post-fill so required guidance is never missing.
        if not report.privacy_note.strip():
            report.privacy_note = PRIVACY_NOTE
        if not report.disclaimer.strip():
            report.disclaimer = DISCLAIMER
        if not report.data_quality.sources_used:
            report.data_quality.sources_used = self._sources_used(stats)
        return report

    @staticmethod
    def _format_rag(rag_docs: list[RagDocument]) -> str:
        if not rag_docs:
            return "No relevant internal documents found."
        return "\n\n---\n\n".join(
            f"Source: {doc.source}\nTitle: {doc.title}\nContent:\n{doc.content}"
            for doc in rag_docs
        )

    @staticmethod
    def _extract_json(text: str) -> dict:
        cleaned = text.strip()
        if "```" in cleaned:
            # Pull the content out of the first fenced block.
            fence = cleaned.split("```", 2)
            if len(fence) >= 2:
                cleaned = fence[1]
                if cleaned.lstrip().lower().startswith("json"):
                    cleaned = cleaned.lstrip()[4:]
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("LLM response did not contain a JSON object")
        return json.loads(cleaned[start : end + 1])

    # -- Deterministic fallback ---------------------------------------------
    @staticmethod
    def _sources_used(stats: ReportStats) -> list[str]:
        sources = []
        if stats.posture.total_sessions > 0:
            sources.append("posture")
        if stats.activity.days_count > 0:
            sources.append("activity")
        if stats.mood.total_checkins > 0:
            sources.append("mood")
        return sources

    def _build_fallback(self, stats: ReportStats, period: ReportPeriod) -> AiReport:
        dimensions: list[ReportDimension] = []
        findings: list[ReportFinding] = []
        suggestions: list[ReportSuggestion] = []
        positives: list[str] = []
        watch_outs: list[str] = []
        correlations: list[str] = []

        long_minutes = stats.activity.longest_session_ms / 60000
        breaks_per_day = (
            stats.activity.total_break_count / stats.activity.days_count
            if stats.activity.days_count
            else 0.0
        )
        late_minutes = stats.activity.total_late_night_ms / 60000

        # --- Posture dimension ---
        if stats.posture.total_sessions > 0 and stats.posture.average_score is not None:
            p_score = _clamp(stats.posture.average_score)
            top_event = (
                max(stats.posture.event_counts.items(), key=lambda kv: kv[1])
                if stats.posture.event_counts
                else None
            )
            metrics = [
                ReportMetric(label="Average score", value=f"{stats.posture.average_score:.0f}/100"),
                ReportMetric(label="Sessions", value=str(stats.posture.total_sessions)),
                ReportMetric(label="Snapshots", value=str(stats.posture.total_snapshots)),
            ]
            if stats.posture.time_good_pct is not None:
                metrics.append(
                    ReportMetric(label="Good posture", value=f"{stats.posture.time_good_pct:.0f}%")
                )
            if top_event:
                metrics.append(
                    ReportMetric(
                        label="Most common event",
                        value=f"{_pretty_event(top_event[0])} (×{top_event[1]})",
                    )
                )
            dimensions.append(
                ReportDimension(
                    key="posture",
                    label="Posture",
                    score=p_score,
                    grade=_grade(p_score),
                    status=_status(p_score),
                    summary=(
                        f"Average posture was {stats.posture.average_score:.0f}/100 across "
                        f"{stats.posture.total_sessions} session(s)."
                        + (f" Most frequent event: {_pretty_event(top_event[0])}." if top_event else "")
                    ),
                    metrics=metrics,
                )
            )
            if p_score < 55:
                findings.append(
                    ReportFinding(
                        title="Posture needs attention",
                        detail="Posture scores were low for this window — small adjustments will help.",
                        severity="high",
                        category="posture",
                        evidence=[f"Average posture {stats.posture.average_score:.0f}/100"]
                        + ([f"{_pretty_event(top_event[0])} ×{top_event[1]}"] if top_event else []),
                    )
                )
            elif p_score < 70:
                findings.append(
                    ReportFinding(
                        title="Posture has room to improve",
                        detail="Posture was moderate; watch the most frequent event below.",
                        severity="medium",
                        category="posture",
                        evidence=[f"Average posture {stats.posture.average_score:.0f}/100"],
                    )
                )
            if p_score < 70:
                detail = "Drop both shoulders, tuck the chin slightly, and look 20 ft away for 20 seconds."
                if top_event:
                    detail = f"Counter '{_pretty_event(top_event[0])}': " + detail
                suggestions.append(
                    ReportSuggestion(
                        title="Reset your neck and shoulders",
                        detail=detail,
                        priority="high" if p_score < 55 else "medium",
                        category="posture",
                        timeframe="today",
                        effort="quick",
                    )
                )
            if p_score >= 75:
                positives.append(f"Posture held up well (avg {stats.posture.average_score:.0f}/100).")
            elif p_score < 55:
                watch_outs.append("Low posture scores — recheck chair, screen height and distance.")

        # --- Activity dimension ---
        if stats.activity.days_count > 0:
            a_score = 100.0
            if long_minutes > 90:
                a_score -= 28
            elif long_minutes > 60:
                a_score -= 15
            elif long_minutes > 45:
                a_score -= 6
            if breaks_per_day < 1:
                a_score -= 22
            elif breaks_per_day < 3:
                a_score -= 10
            if late_minutes > 60:
                a_score -= 18
            elif late_minutes > 0:
                a_score -= 8
            active_hours = stats.activity.total_active_ms / 3_600_000
            if active_hours > 0:
                cs_rate = stats.activity.total_context_switches / active_hours
                if cs_rate > 60:
                    a_score -= 12
                elif cs_rate > 30:
                    a_score -= 6
            a_score = _clamp(a_score)
            top_category = stats.activity.by_category[0].name if stats.activity.by_category else None
            metrics = [
                ReportMetric(label="Active / day", value=_fmt_dur(stats.activity.avg_active_ms_per_day)),
                ReportMetric(label="Longest session", value=_fmt_dur(stats.activity.longest_session_ms)),
                ReportMetric(label="Breaks", value=f"{stats.activity.total_break_count} ({breaks_per_day:.1f}/day)"),
                ReportMetric(label="Late-night", value=_fmt_dur(stats.activity.total_late_night_ms)),
                ReportMetric(label="Context switches", value=str(stats.activity.total_context_switches)),
            ]
            if top_category:
                metrics.append(ReportMetric(label="Top category", value=top_category))
            dimensions.append(
                ReportDimension(
                    key="activity",
                    label="Work rhythm",
                    score=a_score,
                    grade=_grade(a_score),
                    status=_status(a_score),
                    summary=(
                        f"{_fmt_dur(stats.activity.total_active_ms)} active over "
                        f"{stats.activity.days_count} day(s); longest unbroken session "
                        f"{_fmt_dur(stats.activity.longest_session_ms)}, {breaks_per_day:.1f} breaks/day."
                    ),
                    metrics=metrics,
                )
            )
            if long_minutes > 90:
                findings.append(
                    ReportFinding(
                        title="Very long unbroken sessions",
                        detail="Sessions ran well past an hour, which strains eyes, neck and focus.",
                        severity="high",
                        category="activity",
                        evidence=[f"Longest session {_fmt_dur(stats.activity.longest_session_ms)}"],
                    )
                )
            elif long_minutes > 60:
                findings.append(
                    ReportFinding(
                        title="Long unbroken sessions",
                        detail="Some sessions exceeded an hour without a real break.",
                        severity="medium",
                        category="activity",
                        evidence=[f"Longest session {_fmt_dur(stats.activity.longest_session_ms)}"],
                    )
                )
            if long_minutes > 60:
                suggestions.append(
                    ReportSuggestion(
                        title="Break before the 60-minute mark",
                        detail="Stand up, look far away for 20s, and roll your shoulders before each hour is up.",
                        priority="high",
                        category="activity",
                        timeframe="today",
                        effort="quick",
                    )
                )
            if breaks_per_day < 3:
                findings.append(
                    ReportFinding(
                        title="Few breaks taken",
                        detail="Regular short breaks protect focus and reduce strain.",
                        severity="medium" if breaks_per_day < 1 else "low",
                        category="activity",
                        evidence=[f"{breaks_per_day:.1f} breaks/day"],
                    )
                )
                suggestions.append(
                    ReportSuggestion(
                        title="Schedule short, regular breaks",
                        detail="Aim for a 5-minute break roughly every 50 minutes (a simple 50/10 rhythm).",
                        priority="medium",
                        category="activity",
                        timeframe="this week",
                        effort="routine",
                    )
                )
            if late_minutes > 30:
                findings.append(
                    ReportFinding(
                        title="Late-night work detected",
                        detail="Working late can erode recovery and next-day energy.",
                        severity="medium",
                        category="activity",
                        evidence=[f"{_fmt_dur(stats.activity.total_late_night_ms)} late-night"],
                    )
                )
                suggestions.append(
                    ReportSuggestion(
                        title="Set a wind-down cutoff",
                        detail="Pick a stop time and dim screens 30 minutes before it.",
                        priority="medium",
                        category="activity",
                        timeframe="this week",
                        effort="routine",
                    )
                )
            if breaks_per_day >= 4:
                positives.append(f"You took regular breaks ({breaks_per_day:.1f}/day).")
            if late_minutes == 0:
                positives.append("No late-night work in this window.")
            if long_minutes > 90:
                watch_outs.append("Marathon sessions — protect against eye and neck fatigue.")

        # --- Mood dimension ---
        if stats.mood.total_checkins > 0:
            energy = stats.mood.average_energy if stats.mood.average_energy is not None else 3.0
            stress = stats.mood.average_stress if stats.mood.average_stress is not None else 3.0
            energy_score = energy / 5 * 100
            stress_score = (5 - stress) / 4 * 100
            m_score = _clamp(0.5 * energy_score + 0.5 * stress_score)
            dominant = (
                max(stats.mood.mood_counts.items(), key=lambda kv: kv[1])[0]
                if stats.mood.mood_counts
                else None
            )
            metrics = [
                ReportMetric(label="Average energy", value=f"{energy:.1f}/5"),
                ReportMetric(label="Average stress", value=f"{stress:.1f}/5"),
                ReportMetric(label="Check-ins", value=str(stats.mood.total_checkins)),
            ]
            if stats.mood.latest_mood:
                metrics.append(ReportMetric(label="Latest mood", value=stats.mood.latest_mood))
            if dominant:
                metrics.append(ReportMetric(label="Most logged", value=dominant))
            dimensions.append(
                ReportDimension(
                    key="mood",
                    label="Mood & energy",
                    score=m_score,
                    grade=_grade(m_score),
                    status=_status(m_score),
                    summary=(
                        f"From {stats.mood.total_checkins} self-reported check-in(s): "
                        f"energy {energy:.1f}/5, stress {stress:.1f}/5."
                    ),
                    metrics=metrics,
                )
            )
            if stress >= 4:
                findings.append(
                    ReportFinding(
                        title="Elevated self-reported stress",
                        detail="You logged high stress for this window.",
                        severity="medium",
                        category="mood",
                        evidence=[f"Average stress {stress:.1f}/5"],
                    )
                )
                suggestions.append(
                    ReportSuggestion(
                        title="Try a 90-second downshift",
                        detail="Slow your breathing (4s in, 6s out) and unclench your jaw and shoulders.",
                        priority="medium",
                        category="mood",
                        timeframe="today",
                        effort="quick",
                    )
                )
            if energy <= 2:
                findings.append(
                    ReportFinding(
                        title="Low self-reported energy",
                        detail="Energy ran low — short movement and light breaks can help.",
                        severity="medium",
                        category="mood",
                        evidence=[f"Average energy {energy:.1f}/5"],
                    )
                )
            if energy >= 4:
                positives.append(f"Energy stayed high (avg {energy:.1f}/5).")
            if stress <= 2:
                positives.append(f"Stress stayed low (avg {stress:.1f}/5).")

        # --- Correlations (only when both signals exist) ---
        posture_weak = stats.posture.average_score is not None and stats.posture.average_score < 70
        if posture_weak and long_minutes > 60:
            correlations.append(
                f"Posture strain lines up with long sessions (longest "
                f"{_fmt_dur(stats.activity.longest_session_ms)}, avg posture "
                f"{stats.posture.average_score:.0f}/100) — fatigue tends to worsen posture."
            )
        if stats.mood.total_checkins > 0 and long_minutes > 60:
            energy = stats.mood.average_energy or 3.0
            stress = stats.mood.average_stress or 3.0
            if energy <= 2 or stress >= 4:
                correlations.append(
                    "Long sessions coincide with lower self-reported energy / higher stress."
                )

        # --- Overall ---
        scores = [dimension.score for dimension in dimensions]
        overall = _clamp(sum(scores) / len(scores)) if scores else 0
        overall_status: DimensionStatus = _status(overall) if scores else "unknown"
        overall_grade = _grade(overall) if scores else "N/A"

        # --- Data quality ---
        sources = self._sources_used(stats)
        volume = (
            stats.mood.total_checkins
            + stats.posture.total_sessions
            + stats.activity.days_count
        )
        if not sources:
            level = "sparse"
        elif len(sources) >= 2 and volume >= 6:
            level = "rich"
        elif volume <= 2:
            level = "sparse"
        else:
            level = "limited"
        quality_note = (
            f"Based on {', '.join(sources)} data" if sources else "No tracked data yet for this window"
        )
        if level == "sparse":
            quality_note += " — treat these results as indicative only."

        # --- Suggestions floor + caps ---
        if not suggestions:
            suggestions.append(
                ReportSuggestion(
                    title="Keep a simple 50/10 rhythm",
                    detail="Work ~50 minutes, then take ~10 to stand, stretch and rest your eyes.",
                    priority="medium",
                    category="general",
                    timeframe="this week",
                    effort="routine",
                )
            )
        suggestions = suggestions[:6]
        findings.sort(key=lambda f: _SEVERITY_RANK.get(f.severity, 9))
        findings = findings[:6]
        if not positives:
            positives.append("You're tracking your desk health — that's the first win.")
        watch_outs = watch_outs[:3]

        # --- Headline / summary ---
        if scores:
            headline = f"Overall desk-health {overall}/100 — grade {overall_grade}."
            parts = [f"Across {len(sources)} tracked area(s), your overall desk-health is {overall}/100 ({overall_grade})."]
            parts.extend(dimension.summary for dimension in dimensions[:3])
            summary = " ".join(parts)
        else:
            headline = "Not enough data yet for a full report."
            summary = (
                "There isn't enough tracked data in this window to score your desk health. "
                "Run the activity tracker, complete a posture session, or log a mood check-in, "
                "then generate the report again."
            )

        return AiReport(
            overall_score=overall,
            overall_grade=overall_grade,
            overall_status=overall_status,
            headline=headline,
            summary=summary,
            dimensions=dimensions,
            key_findings=findings,
            correlations=correlations,
            suggestions=suggestions,
            positives=positives[:5],
            watch_outs=watch_outs,
            data_quality=DataQuality(level=level, note=quality_note, sources_used=sources),
            privacy_note=PRIVACY_NOTE,
            disclaimer=DISCLAIMER,
        )
