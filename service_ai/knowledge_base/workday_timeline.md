# Workday timeline và break debt

DeskMate không chỉ theo dõi tư thế. Hệ thống còn theo dõi pattern ngày làm việc để hiểu khi nào posture risk dễ tăng.

## Active computer time

Active computer time là thời gian người dùng thật sự tương tác với máy: bàn phím, chuột, app active hoặc phiên làm việc đang diễn ra.

Không nên hiểu active time là năng suất tuyệt đối. Nó chỉ là tín hiệu về thời lượng làm việc với máy.

## Continuous work session

Continuous work session là phiên làm việc liên tục không có break đủ dài. Ví dụ người dùng làm từ 13:10 đến 14:35 thì session dài 85 phút.

DeskMate nên chú ý khi session vượt 60–90 phút vì posture risk và mỏi mắt thường tăng sau các phiên dài.

## Break frequency

Break frequency là số lần nghỉ trong ngày. Nghỉ có thể là idle, đứng dậy, hoặc manual break.

Nếu hôm nay break ít hơn baseline 7 ngày, DeskMate có thể nói “hôm nay bạn nghỉ ít hơn bình thường”.

## Break debt

Break debt là tín hiệu cho thấy người dùng đã làm việc lâu hơn mức nên nghỉ hoặc bỏ qua nhiều nudge.

Ví dụ break debt cao khi:

- Phiên làm việc dài nhất trên 90 phút.
- Tổng số break thấp.
- Bỏ qua nhiều nudge.
- Posture risk tăng trong phiên dài.

## High-risk period

High-risk period là khoảng thời gian có nhiều event xấu hoặc score thấp. Ví dụ:

```txt
14:10-15:35: long session + posture risk high
```

AI report nên giải thích high-risk period bằng event cụ thể, không nói chung chung.

## Timeline example

```txt
09:30 - 10:45 Deep work block
10:45 - 10:47 Short break
13:10 - 14:35 Long session, high posture risk
15:20 - 16:00 Low movement, high fatigue risk
```

## Cách trả lời user

Nếu user hỏi “hôm nay tôi làm việc thế nào?”, chatbot nên nhắc:

- Tổng active time.
- Phiên dài nhất.
- Số break.
- Khung risk cao.
- Một gợi ý cụ thể cho ngày mai.

Không nên nói “bạn làm việc kém” hoặc đánh giá năng suất cá nhân.
