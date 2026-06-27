# Judge Q&A cho demo DeskMate AI

## Cái này có hoạt động thật không hay chỉ scripted?

Keyword liên quan: scripted demo, hard-code, fake demo, chỉ là kịch bản, có chạy thật không, có hoạt động thật không, demo giả, not real.

Demo mode dùng cùng event pipeline với real mode. Event được ghi vào store, risk engine tính lại score, UI và nudge phản ứng theo state. Nếu webcam ổn, local vision tạo event thật; nếu camera lỗi, simulated stream vẫn chứng minh pipeline.

## Khác gì app nhắc nghỉ thông thường?

App nhắc nghỉ thường chỉ đếm giờ. DeskMate kết hợp work session, break debt, posture event và baseline cá nhân để nhắc đúng ngữ cảnh. AI report giải thích từ event log thật, không nói chung chung.

## Có creepy hoặc surveillance không?

Không. Webcam xử lý local, raw frames stored = 0, AI không nhận ảnh, không có employer dashboard. DeskMate được thiết kế cho cá nhân tự chăm sóc, không phải để sếp giám sát.

## AI/Codex đóng vai trò thật ở đâu?

Codex giúp team build nhiều module song song trong thời gian ngắn. Trong sản phẩm, OpenAI chỉ đọc structured summary để tạo daily report và chatbot. Phần nhạy cảm nhất là ảnh webcam không bao giờ được gửi cho AI.

## Tác động cho Việt Nam là gì?

Người làm văn phòng, dev outsourcing, support và freelancer ở Việt Nam thường làm laptop nhiều giờ, không gian làm việc không luôn ergonomic, và nhiều người ngại nghỉ vì sợ bị đánh giá. DeskMate dùng tiếng Việt, nhắc nhẹ, riêng tư, giúp hình thành thói quen nghỉ và chỉnh tư thế.

## Nếu người dùng đau thật thì sao?

DeskMate không chẩn đoán bệnh. Nếu người dùng đau kéo dài hoặc có triệu chứng nghiêm trọng, chatbot nên khuyên hỏi chuyên gia y tế. DeskMate chỉ hỗ trợ nhận biết tín hiệu ergonomic và thói quen nghỉ.
