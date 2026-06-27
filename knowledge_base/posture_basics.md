# Kiến thức tư thế và cách DeskMate đánh giá

Tài liệu này dùng cho DeskMate Coach khi giải thích posture event. Đây là tài liệu ergonomic cơ bản, không phải tài liệu y khoa.

## Nguyên tắc trả lời về tư thế

- DeskMate không chẩn đoán bệnh.
- DeskMate không nói người dùng “bị bệnh cổ vai gáy”, “thoái hóa”, “stress nặng” hoặc kết luận y tế.
- DeskMate chỉ nói theo hướng: tín hiệu tư thế, rủi ro ergonomic, thói quen làm việc, gợi ý nghỉ ngắn.
- Nếu người dùng đau kéo dài, tê, chóng mặt, đau dữ dội hoặc khó chịu nghiêm trọng, nên khuyên hỏi chuyên gia y tế.

## Forward head / cúi đầu / cổ đưa trước

Forward head là trạng thái đầu hoặc cổ đưa ra trước so với vùng vai trong lúc ngồi làm việc. Trong DeskMate, đây là một posture risk event, không phải chẩn đoán bệnh.

Nguyên nhân thường gặp:

- Người dùng cúi sát màn hình.
- Laptop đặt thấp.
- Ghế hoặc bàn không phù hợp.
- Làm việc lâu mà không nghỉ.

Cách nói nên dùng:

“Mình thấy tín hiệu cổ đưa trước tăng so với lúc hiệu chuẩn. Bạn thử đưa cằm nhẹ về sau và thả lỏng vai 60–90 giây nhé.”

Không nên nói:

“Bạn bị bệnh cổ.”

## Head tilt / nghiêng đầu

Head tilt là khi đầu nghiêng sang trái/phải hoặc lệch nhiều so với tư thế hiệu chuẩn. Một vài chuyển động ngắn là bình thường. DeskMate chỉ nên nhắc khi trạng thái này kéo dài quá ngưỡng.

Nguyên nhân có thể là:

- Tựa tay một bên.
- Nghiêng người khi đọc/chăm chú.
- Camera đặt lệch.
- Người dùng đeo tai nghe hoặc kính làm landmark hơi nhiễu.

Cách nói nên dùng:

“Đầu đang nghiêng lâu hơn bình thường. Thử cân bằng lại cổ và vai, không cần gồng.”

## Shoulder imbalance / lệch vai

Shoulder imbalance là khi hai vai lệch nhau rõ rệt trên khung hình. Đây có thể là tín hiệu ngồi lệch, tựa một bên hoặc camera đặt chưa thẳng.

DeskMate nên kiểm tra confidence và thời gian duy trì trước khi cảnh báo, vì vai có thể lệch tạm thời khi người dùng với tay lấy đồ hoặc quay người.

Gợi ý nhẹ:

“Hai vai đang lệch một chút. Bạn thử ngồi lại giữa ghế, hạ vai xuống và thả lỏng 10 giây.”

## Face distance / khoảng cách tương đối tới màn hình

DeskMate hiện đo khoảng cách tương đối tới màn hình, không đo cm chính xác.

Công thức ý tưởng:

```txt
face_scale = current_face_size / calibrated_face_size
```

Ý nghĩa:

- Khoảng `1.00x`: gần với khoảng cách lúc hiệu chuẩn.
- Lớn hơn nhiều, ví dụ `1.25x`: mặt xuất hiện lớn hơn, có thể đang ngồi quá gần.
- Nhỏ hơn nhiều, ví dụ `0.78x`: mặt xuất hiện nhỏ hơn, có thể đang ngồi quá xa.

Không nên nói “bạn đang cách màn hình 50cm” nếu không có calibration theo cm hoặc depth sensor.

Cách nói đúng:

“Khoảng cách hiện tại đang gần hơn lúc hiệu chuẩn khoảng 25%. Đây là ước lượng tương đối từ kích thước khuôn mặt trên webcam.”

## Posture score 0-100

Posture score là điểm ergonomic tạm thời dựa trên posture features và thời gian duy trì issue.

Diễn giải gợi ý:

- 85–100: ổn, chưa cần nhắc mạnh.
- 70–84: có tín hiệu lệch nhẹ hoặc tạm thời.
- 50–69: nên reset ngắn nếu kéo dài.
- Dưới 50: nhiều issue hoặc issue kéo dài, nên nghỉ 60–90 giây.

Không nên biến score thành chẩn đoán sức khỏe.

## Confidence

Confidence phản ánh độ tin cậy của landmark/visibility và chất lượng quan sát. Confidence thấp có thể do thiếu sáng, mặt/vai ngoài khung hình, camera rung, kính phản sáng hoặc bị che khuất.

Khi confidence thấp, DeskMate nên nói:

“Camera chưa thấy rõ đầu và vai, nên kết quả có thể chưa chính xác.”

## Khi nào nên nudge

Nên nudge khi:

- Tư thế xấu kéo dài quá ngưỡng, ví dụ 5–10 giây.
- Work session dài hơn 60–90 phút.
- Stillness lâu, ví dụ 30–45 phút ít chuyển động.
- Break debt cao so với baseline.

Không nên nudge quá dày, vì người dùng sẽ tắt app.

## Stillness và possible drowsiness

DeskMate có thể theo dõi thời gian ít chuyển động dựa trên thay đổi của posture features qua các frame liên tiếp.

Nếu ít chuyển động kéo dài, event có thể là:

```txt
fatigue.low_movement
```

Nếu ít chuyển động kéo dài kèm tín hiệu đầu/cổ cúi hoặc nghiêng, event có thể là:

```txt
fatigue.possible_drowsiness
```

Không được nói chắc “người dùng đang ngủ gật”. Cách nói an toàn:

“Mình thấy tín hiệu ít chuyển động và đầu/cổ không ổn định. Nếu bạn thấy mệt, nghỉ 2 phút nhé?”
