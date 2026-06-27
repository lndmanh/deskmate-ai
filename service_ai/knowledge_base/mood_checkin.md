# Mood check-in self report

DeskMate có thể lưu cảm xúc/tâm trạng nếu và chỉ nếu người dùng tự chọn hoặc tự nhập. Không suy đoán cảm xúc từ webcam.

## Nguyên tắc

- Mood là self-reported data.
- Không dùng camera để detect vui, buồn, tức giận hoặc stress.
- Không phân tích cảm xúc từ khuôn mặt.
- Mood chỉ dùng để điều chỉnh cách trò chuyện và nudge cho phù hợp hơn.
- User có thể xóa mood history.

## Mood labels

Các mood label MVP:

- good: ổn/tốt
- tired: mệt
- stressed: căng thẳng
- focused: đang tập trung
- distracted: dễ xao nhãng
- calm: bình tĩnh
- overwhelmed: quá tải
- neutral: bình thường

## Energy và stress

Mood check-in có thể kèm:

- energy: 1–5
- stress: 1–5
- note: ghi chú tự nhập

Ví dụ:

```json
{
  "mood": "tired",
  "energy": 2,
  "stress": 4,
  "note": "ngủ ít, đang chạy deadline"
}
```

## Chatbot dùng mood thế nào?

Nếu user self-report là tired hoặc overwhelmed, chatbot nên nói nhẹ hơn, đề xuất nghỉ ngắn và giảm số lượng lời khuyên.

Nếu user self-report là focused, chatbot nên ưu tiên focus-friendly nudge và cho phép snooze.

Nếu user self-report là stressed, chatbot không được chẩn đoán stress y tế. Chỉ nói:

“Bạn đang tự báo là hơi căng. Mình sẽ nhắc nhẹ hơn và ưu tiên các bước reset ngắn.”

## Cách nói đúng

“Dựa trên mood bạn tự check-in là mệt, mình sẽ gợi ý một reset nhẹ 90 giây thay vì nhiều lời khuyên dài.”

## Cách nói sai

“Camera thấy bạn buồn.”

“Mình phát hiện bạn stress.”

“Bạn đang trầm cảm.”
