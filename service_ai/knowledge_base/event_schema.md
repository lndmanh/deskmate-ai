# Event schema DeskMate

DeskMate dùng event log để tách dữ liệu nhạy cảm khỏi AI reasoning. Vision engine và activity tracker tạo event; AI chỉ đọc event hoặc summary.

## Base event

Mỗi event nên có:

- id
- timestamp
- type
- source
- confidence nếu có
- metadata nếu cần

## Posture events

Các posture event chính:

- posture.forward_head
- posture.head_tilt
- posture.shoulder_imbalance
- posture.face_distance
- posture.stillness
- posture.not_visible

## Fatigue events

DeskMate có thể phát hiện tín hiệu fatigue nhẹ, nhưng không được khẳng định người dùng đang ngủ hoặc chẩn đoán tình trạng y tế.

Các fatigue event:

- fatigue.low_movement
- fatigue.possible_drowsiness

`fatigue.low_movement` nghĩa là người dùng ít chuyển động trong một khoảng thời gian dài.

`fatigue.possible_drowsiness` nghĩa là có tín hiệu đầu/cổ và stillness gợi ý khả năng mệt hoặc buồn ngủ. Đây chỉ là tín hiệu rủi ro, không phải kết luận “ngủ gật”.

Cách nói đúng:

“Mình thấy bạn ít chuyển động khá lâu và đầu/cổ không ổn định. Nếu thấy mệt, nghỉ 2 phút nhé?”

Không nên nói:

“Bạn đang ngủ gật.”

Ví dụ:

```json
{
  "timestamp_ms": 1782478005000,
  "type": "posture.head_tilt",
  "severity": "medium",
  "confidence": 0.95,
  "score": 84,
  "held_ms": 5200
}
```

## Workday events

Workday events dùng để dựng timeline ngày làm việc:

- work_session.started
- work_session.ended
- work_session.continuous
- break.started
- break.ended
- idle.started
- idle.ended
- app_category.changed

Ví dụ:

```txt
09:30 work_session.started
10:45 work_session.continuous duration=75m
10:47 break.started
```

## Nudge events

Nudge events ghi lại lời nhắc và phản hồi:

- nudge.sent
- nudge.snoozed
- nudge.completed
- nudge.dismissed

Ví dụ:

```txt
14:38 nudge.sent type=neck_reset mode=focus_friendly
14:39 nudge.snoozed minutes=10
```

## Daily summary cho AI

AI report nên nhận daily summary dạng:

```json
{
  "active_time": "7h 12m",
  "longest_session": "96m",
  "breaks": 4,
  "posture_risk_events": 18,
  "high_risk_period": "14:10-15:35",
  "cloud_mode": false,
  "raw_images_stored": 0
}
```

Không đưa raw image hoặc video vào AI prompt.

## Severity

Severity có thể là:

- low
- medium
- high

Severity nên dựa trên cả độ lệch và thời gian duy trì, không chỉ một frame đơn lẻ.

## Confidence

Confidence nên dùng để tránh overclaim. Nếu confidence thấp, chatbot nên nói “kết quả có thể chưa chính xác vì camera chưa thấy rõ”.
