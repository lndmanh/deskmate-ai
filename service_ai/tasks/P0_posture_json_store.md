# Task P0 — Lưu dữ liệu posture tracking ra JSON

**Priority:** NGAY BÂY GIỜ — làm trước A3  
**Model:** Sonnet | **Effort:** think  
**Blocked by:** Không — độc lập hoàn toàn  
**Thư mục:** service_ai/

## Goal

Mỗi lần chạy main.py, tạo 1 file JSON session lưu toàn bộ posture events và snapshots định kỳ.
Không lưu raw frame/ảnh — chỉ lưu kết quả phân tích đã extract.

## Output

```
data/posture_sessions/session_YYYYMMDD_HHMMSS.json
```

```json
{
  "session_id": "session_20260627_090000",
  "started_at": "2026-06-27T09:00:00+07:00",
  "ended_at": "2026-06-27T09:30:00+07:00",
  "events": [
    {
      "timestamp_ms": 1751000000000,
      "timestamp_iso": "2026-06-27T09:05:00+07:00",
      "type": "posture.forward_head",
      "severity": "high",
      "confidence": 0.87,
      "score": 65,
      "held_ms": 5000
    }
  ],
  "snapshots": [
    {
      "timestamp_ms": 1751000000000,
      "timestamp_iso": "2026-06-27T09:00:30+07:00",
      "status": "good",
      "score": 100,
      "confidence": 0.91,
      "stillness_ms": 0,
      "bad_posture_streak_ms": 0,
      "features": {
        "head_forward_ratio": 0.42,
        "head_tilt_degrees": 2.1,
        "shoulder_delta_y": 0.01,
        "face_size": 0.17,
        "visibility_confidence": 0.91
      }
    }
  ],
  "summary": {
    "total_snapshots": 60,
    "average_score": 78,
    "time_good_pct": 72.3,
    "event_counts": {
      "posture.forward_head": 3,
      "posture.head_tilt": 1
    }
  }
}
```

## Files to Create

posture_tracking/session_recorder.py

## Files to Modify

main.py

## Definition of Done

- [ ] Chạy python main.py, thoát bằng q -> file JSON xuất hiện trong data/posture_sessions/
- [ ] File chứa events array (có ít nhất 1 entry nếu ngồi lệch)
- [ ] File chứa snapshots array với interval 30s
- [ ] summary.average_score là số thực, không phải 0
- [ ] Không có raw image data trong file (chỉ số)
- [ ] Không crash nếu session kết thúc mà chưa có frame nào (snapshots = [])
- [ ] data/posture_sessions/ tự tạo nếu chưa có
