# Camera, calibration và độ chính xác

DeskMate dùng webcam và BlazePose/MediaPipe landmarks để phân tích tư thế. Kết quả phụ thuộc vào góc camera, ánh sáng và quá trình calibration.

## Calibration là gì?

Calibration là bước người dùng ngồi đúng tư thế trong vài giây đầu để hệ thống lấy mốc tham chiếu cá nhân.

Trong calibration, DeskMate ghi nhận:

- Khoảng cách vai.
- Độ lệch vai ban đầu.
- Kích thước khuôn mặt.
- Khoảng cách hai mắt.
- Góc nghiêng đầu.
- Vị trí tương đối giữa đầu và vai.

Các frame sau đó được so sánh với mốc này.

## Khi nào cần calibration lại?

Nên calibration lại khi:

- Camera đổi vị trí.
- Người dùng đổi ghế hoặc đổi độ cao màn hình.
- Ánh sáng thay đổi mạnh.
- User chuyển từ laptop sang màn hình ngoài.
- App liên tục báo sai dù user ngồi thẳng.

## Vì sao app có thể báo sai?

Các nguyên nhân thường gặp:

- Camera đặt lệch.
- Chỉ thấy mặt nhưng không thấy vai.
- Kính phản sáng làm landmark mắt/tai nhiễu.
- Ánh sáng yếu hoặc ngược sáng.
- User calibration khi chưa ngồi thẳng.
- User xoay người hoặc với tay trong lúc frame được xử lý.

## Confidence thấp nghĩa là gì?

Confidence thấp nghĩa là hệ thống chưa thấy rõ landmark. Khi confidence thấp, chatbot nên nói:

“Camera chưa thấy rõ đầu và vai, nên kết quả có thể chưa chính xác. Bạn thử chỉnh ánh sáng hoặc ngồi vào giữa khung hình.”

## Face distance chỉ là tương đối

DeskMate không đo khoảng cách cm thật nếu chỉ dùng webcam thường. Face distance được tính theo tỉ lệ so với lúc calibration.

Ví dụ:

- 1.00x: gần bằng lúc calibration.
- 1.30x: có thể đang gần hơn 30%.
- 0.75x: có thể đang xa hơn lúc calibration.

Không nên nói “bạn cách màn hình 50cm” nếu không có depth sensor hoặc calibration vật chuẩn.

## Cách trả lời khi user nói “app đo sai”

Nên trả lời:

“Có thể calibration hoặc góc camera chưa ổn. Bạn thử ngồi thẳng, để cả đầu và vai trong khung hình, rồi calibration lại 5 giây. Nếu vẫn sai, mình sẽ giảm độ nhạy hoặc tăng ngưỡng cảnh báo.”
