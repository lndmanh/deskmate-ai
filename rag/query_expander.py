SYNONYM_GROUPS = {
    "webcam": ["camera", "cam", "ảnh", "hình", "video", "raw frame", "raw frames"],
    "xem": ["nhìn", "soi", "theo dõi", "nhận ảnh", "lưu ảnh", "ghi hình"],
    "privacy": ["riêng tư", "bảo mật", "dữ liệu", "lưu", "xóa", "employer", "sếp", "giám sát"],
    "calibration": ["hiệu chuẩn", "đo sai", "sai", "camera lệch", "confidence", "không chính xác"],
    "posture": ["tư thế", "cổ", "vai", "cúi đầu", "nghiêng đầu", "forward head", "head tilt"],
    "break": ["nghỉ", "reset", "mỏi", "căng", "break debt", "session", "phiên dài"],
}


def expand_query(query: str) -> str:
    lower_query = query.lower()
    extra_terms: list[str] = []

    for anchor, synonyms in SYNONYM_GROUPS.items():
        terms = [anchor, *synonyms]

        if any(term in lower_query for term in terms):
            extra_terms.extend(terms)

    if not extra_terms:
        return query

    unique_extra_terms = list(dict.fromkeys(extra_terms))
    return f"{query} {' '.join(unique_extra_terms)}"


def infer_topic(query: str) -> str:
    lower_query = query.lower()

    topic_keywords = {
        "privacy": ["webcam", "camera", "cam", "ảnh", "hình", "video", "soi", "nhìn", "lưu", "sếp", "employer", "riêng tư", "bảo mật"],
        "calibration": ["calibration", "hiệu chuẩn", "đo sai", "sai", "confidence", "không chính xác", "camera lệch"],
        "posture": ["tư thế", "posture", "cổ", "vai", "cúi đầu", "nghiêng đầu", "forward head", "head tilt"],
        "break": ["nghỉ", "reset", "mỏi", "căng", "break", "session", "phiên"],
        "api": ["api", "endpoint", "calibrate", "analyze", "fastapi"],
        "business": ["business", "market", "giá", "pricing", "khách hàng", "mô hình"],
        "demo": ["demo", "pitch", "giám khảo", "scripted", "hackathon"],
    }

    for topic, keywords in topic_keywords.items():
        if any(keyword in lower_query for keyword in keywords):
            return topic

    return "general"


def source_topic_bonus(topic: str, source: str) -> float:
    source_name = source.split("#", 1)[0]
    preferred_sources = {
        "privacy": {
            "privacy_policy.md": 5.0,
            "data_retention_policy.md": 4.0,
            "chatbot_guardrails.md": 3.0,
            "product_faq.md": 2.0,
        },
        "calibration": {
            "camera_and_calibration.md": 5.0,
            "troubleshooting.md": 2.0,
            "posture_basics.md": 1.0,
        },
        "posture": {
            "posture_basics.md": 4.0,
            "ergonomic_setup.md": 2.0,
            "nudge_routines.md": 1.0,
        },
        "break": {
            "nudge_routines.md": 4.0,
            "workday_timeline.md": 2.0,
            "daily_report_guidelines.md": 1.0,
        },
        "api": {
            "api_reference.md": 5.0,
            "troubleshooting.md": 2.0,
        },
        "business": {
            "business_model.md": 5.0,
            "competitor_analysis.md": 3.0,
            "vietnam_context.md": 1.0,
        },
        "demo": {
            "demo_script.md": 4.0,
            "judge_qna.md": 4.0,
            "vietnam_context.md": 1.0,
        },
    }

    return preferred_sources.get(topic, {}).get(source_name, 0.0)
