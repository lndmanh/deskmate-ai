# Demo script 5 phút DeskMate AI

Tài liệu này giúp chuẩn bị demo hackathon.

## 0:00–0:45 Problem

Nói:

“Người làm việc với máy tính không bị tổn thương trong một khoảnh khắc. Vấn đề tích tụ chậm: ngồi lâu, cúi cổ, mỏi mắt, bỏ nghỉ. Các app hiện tại hoặc quá thụ động, hoặc tạo cảm giác bị giám sát.”

Show:

- Slide/problem hoặc app home.
- DeskMate mascot.

## 0:45–1:30 Product intro

Nói:

“DeskMate AI là trợ lý local-first giúp bạn bảo vệ sức khỏe trong ngày làm việc. Nó không giám sát bạn. Nó chỉ giúp bạn nhận ra khi cơ thể bắt đầu trả giá.”

Show:

- Home dashboard.
- Privacy mode local.
- Score/current session.

## 1:30–2:30 Live posture detection

Làm demo:

- Ngồi thẳng để calibration.
- Cúi/ngiêng đầu nhẹ.
- Show score/status thay đổi.

Nói:

“Webcam xử lý local. Hệ thống chỉ trích xuất landmarks và posture event, không lưu ảnh.”

## 2:30–3:15 Friendly nudge

Show nudge:

“Bạn đã tập trung 76 phút rồi. Cổ bạn đang hơi căng. Nghỉ 90 giây để reset nhé?”

Show:

- Start reset.
- Snooze.
- Done.

## 3:15–4:15 Daily report / Chatbot

Show chatbot hoặc report:

- Hỏi: “Hôm nay tư thế tôi thế nào?”
- Hỏi: “Bạn có lưu ảnh webcam không?”

Nói:

“Điểm quan trọng là AI không đoán mò từ ảnh. AI chỉ đọc event log đã xử lý.”

## 4:15–5:00 Privacy proof + technical depth

Show privacy dashboard/API docs:

```txt
Webcam processing: Local
Cloud processing: Off
Raw webcam frames stored: 0
AI sees event summary only
Data shared with employer: Never
```

Nói:

“DeskMate mặc định hữu ích mà không cần gửi dữ liệu nhạy cảm ra ngoài. Người dùng kiểm soát dữ liệu của họ.”

## Nếu webcam lỗi

Nói:

“Webcam live có thể phụ thuộc ánh sáng và permission, nên bọn em có demo mode. Demo mode không phải screenshot; nó phát event qua cùng pipeline để risk engine, nudge và report phản ứng như real mode.”

## Câu kết

“DeskMate không thay bác sĩ và không giám sát nhân viên. Nó là một người bạn nhỏ trên máy tính, nhắc bạn chăm cơ thể trước khi một ngày làm việc dài kịp tích tụ thành vấn đề.”
