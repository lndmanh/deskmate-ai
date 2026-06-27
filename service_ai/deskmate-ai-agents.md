# DeskMate AI — Coding Agent Pack

Tài liệu này mô tả bộ agent để team có thể chia việc và code MVP DeskMate AI nhanh, rõ boundary, không đi lệch khỏi hướng local-first/privacy-first, đồng thời tối ưu trực tiếp theo rubric chấm điểm hackathon.

## 0. Rubric hackathon cần tối ưu

Điểm số không chỉ đến từ feature. Agent phải tạo ra **bằng chứng demo được** cho từng tiêu chí.

### Rubric chung

| Câu hỏi | Trọng số | Mục tiêu điểm cao | DeskMate AI cần chứng minh |
|---|---:|---|---|
| Does it work? | x2 | Solid / Polished | App chạy thật hoặc demo mode chắc chắn; event flow nhìn thấy được; không chỉ slide |
| Track question | x3 | Track-specific 4–5 điểm | Chọn track rõ và build bằng chứng phù hợp |
| Vibe Check | x1 | Convinced / Exceptional | Pitch rõ, có cảm xúc, đáng tin, privacy-first, không creepy |

### Track có thể chọn

| Track | Câu hỏi chính | DeskMate AI nên tối ưu thế nào |
|---|---|---|
| Market Scale | Có thể thành business lớn không? | B2C/B2B2C cho dân văn phòng, remote workers, freelancers, công ty SME; wedge là local-first ergonomic assistant, không employer surveillance |
| Engineering Depth | Kỹ thuật có sâu không? | Local vision pipeline, event engine, baseline personalization, privacy guarantees, AI chỉ đọc event summary |
| Impact to Vietnam | Tác động thực sự cho Việt Nam không? | Dân văn phòng Việt Nam, outsourcing/software teams, làm việc dài giờ, văn hóa ngại nghỉ, chi phí sức khỏe/hiệu suất |
| Transform with Codex / OpenAI | Codex/OpenAI tạo chuyển biến gì? | Codex giúp team build nhanh multi-agent; OpenAI tạo report từ event log, không đọc ảnh; demo case study rõ |

### Khuyến nghị chọn track cho DeskMate AI

1. **Engineering Depth** nếu team build được local vision + event/risk engine chạy ổn.
2. **Impact to Vietnam** nếu muốn kể câu chuyện mạnh về dân văn phòng Việt Nam, outsourcing, làm việc quá giờ, privacy.
3. **Market Scale** nếu pitch business tốt: first customer rõ, wedge rõ, expansion path rõ.

Mặc định agent pack này tối ưu cho **Engineering Depth + Impact to Vietnam**, vì DeskMate AI có lợi thế kỹ thuật và câu chuyện Việt Nam tốt hơn một AI wrapper chung chung.

## 1. Nguyên tắc chung

- Webcam xử lý local.
- Không lưu raw webcam frames.
- Không gửi ảnh/video lên cloud trong MVP.
- AI chỉ nhận event log hoặc daily summary đã xử lý.
- Không chẩn đoán bệnh.
- Không phân tích cảm xúc sâu.
- Không employer dashboard.
- Demo phải có fallback bằng simulated event stream để tránh rủi ro webcam/live CV.
- Mỗi feature phải tạo được bằng chứng cho ít nhất một tiêu chí chấm điểm.
- Không build lan man: ưu tiên demo chạy được, engineering depth nhìn thấy được, câu chuyện Việt Nam rõ.

## 2. Agent overview

| Agent | Mục tiêu | Output chính | Tiêu chí phục vụ | Ưu tiên |
|---|---|---|---|---|
| Product Architect Agent | Chốt kiến trúc, schema, module boundary | Architecture, event contract, implementation order | Engineering Depth | Rất cao |
| Functional Demo Agent | Đảm bảo app demo chạy chắc | Demo checklist, fallback mode, no-dead-screen flow | Does it work | Rất cao |
| Local Vision Agent | Webcam local, posture extraction | Posture events | Engineering Depth | Rất cao |
| Activity Tracker Agent | Active time, idle, session, break | Workday events | Does it work / Engineering Depth | Rất cao |
| Event Store Agent | Lưu local event log, delete data | Event repository, privacy counters | Engineering Depth / Privacy trust | Rất cao |
| Risk & Baseline Agent | Score, baseline 7 ngày, insight | Risk scores, baseline insights | Engineering Depth | Cao |
| AI Report Agent | Daily report từ structured summary | Markdown report | Vibe / Transform with OpenAI | Trung bình-cao |
| UI & Mascot Agent | Dashboard, mascot nudge, timeline | Demo UI | Does it work / Vibe | Rất cao |
| Privacy Dashboard Agent | Màn hình trust/privacy | Privacy status UI | Vibe / Impact Vietnam | Rất cao |
| Market Scale Agent | Business wedge, first customer, expansion | Pitch bullets, market story | Market Scale | Cao |
| Vietnam Impact Agent | Chứng minh fit Việt Nam | Vietnam-specific impact story | Impact to Vietnam | Cao |
| Engineering Depth Narrator Agent | Biến kỹ thuật thành câu chuyện chấm điểm | Technical proof points, architecture talk track | Engineering Depth | Cao |
| Codex Transformation Agent | Chứng minh dùng Codex/OpenAI có ý nghĩa | Codex case study, build log | Transform with Codex | Trung bình |
| Vibe & Pitch Agent | 5 phút pitch thắng cảm tình | Script, emotional arc, judge Q&A | Vibe Check | Cao |
| Demo Script Agent | Demo 5 phút + fallback data | Script, demo timeline | Does it work / Vibe | Cao |

## 3. Work graph khuyến nghị

```txt
Phase 1: Contract
  Product Architect Agent
    -> shared event schema
    -> module boundaries
    -> privacy constraints

  Functional Demo Agent
    -> demo success path
    -> fallback mode requirements
    -> rubric proof checklist

Phase 2: Parallel implementation
  Local Vision Agent       -> posture event producer
  Activity Tracker Agent   -> workday event producer
  Event Store Agent        -> local persistence
  UI & Mascot Agent        -> mock-data UI
  Risk & Baseline Agent    -> scoring logic from mock events

  Market Scale Agent       -> first customer + wedge + expansion
  Vietnam Impact Agent     -> Vietnam-specific story

Phase 3: Integration
  Vision + Activity -> Event Store -> Risk Engine -> UI
  Risk Engine -> Mascot Nudge
  Event Store -> Privacy Dashboard

  Engineering Depth Narrator Agent -> visible technical proof points

Phase 4: AI + Demo polish
  AI Report Agent -> daily report
  Demo Script Agent -> live demo and simulated fallback
  Vibe & Pitch Agent -> 5-minute story + judge Q&A
  Codex Transformation Agent -> Codex/OpenAI case study
```

## 3.1. Rubric proof checklist

Trước khi nộp, team phải có bằng chứng cụ thể cho từng dòng này.

### Does it work? x2

- [ ] Có app chạy được, không chỉ slide.
- [ ] Có Home dashboard với dữ liệu thay đổi theo event.
- [ ] Có ít nhất một flow end-to-end: event -> risk score -> nudge/report.
- [ ] Có demo mode chạy không cần webcam.
- [ ] Có privacy dashboard hiển thị raw frames stored = 0.
- [ ] Có nút/action rõ: snooze, mark done, delete data.

### Engineering Depth x3 nếu chọn track này

- [ ] Architecture local-first rõ: webcam frame không ra khỏi máy.
- [ ] Event-driven pipeline rõ: Vision/Activity -> Event Store -> Risk -> UI/AI.
- [ ] Risk scoring không chỉ prompt AI; có deterministic rules/baseline.
- [ ] AI chỉ nhận structured summary, không nhận ảnh.
- [ ] Có baseline/personalization hoặc demo seed cho 7 ngày.
- [ ] Có logs/events để giám khảo thấy hệ thống thật sự xử lý dữ liệu.

### Impact to Vietnam x3 nếu chọn track này

- [ ] Nêu rõ first user ở Việt Nam: nhân viên văn phòng, dev outsourcing, freelancer, support/call center, sinh viên mới đi làm.
- [ ] Nêu pain Việt Nam-specific: làm quá giờ, văn hóa ngại nghỉ, không muốn bị sếp giám sát, nhà ở/bàn ghế không ergonomic.
- [ ] Không nói chung chung “có lợi cho mọi người nên có lợi cho Việt Nam”.
- [ ] Có Vietnamese UI/copy thân thiện.
- [ ] Privacy là điểm tin cậy cho người Việt: không lưu ảnh, không employer dashboard.

### Market Scale x3 nếu chọn track này

- [ ] First customer/use case rõ.
- [ ] Wedge rõ: local-first ergonomic AI assistant, không phải generic wellness app.
- [ ] Business path: freemium cá nhân -> team wellness opt-in -> partnerships với coworking/HR benefits, không employer surveillance.
- [ ] Tránh tarpit: không pitch như “AI healthcare app” chung chung.
- [ ] Có expansion path: eye health, routines, calendar-aware breaks, team anonymous aggregate nếu opt-in.

### Vibe Check x1

- [ ] Pitch mở đầu có vấn đề dễ đồng cảm.
- [ ] Product không creepy, không surveillance.
- [ ] Mascot/copy tạo cảm giác được chăm sóc, không bị phán xét.
- [ ] Có privacy proof trong demo.
- [ ] Có câu chuyện “AI giải thích từ event log thật, không đoán mò”.

### Transform with Codex/OpenAI nếu muốn tranh track 4 hoặc điểm phụ

- [ ] Chứng minh Codex giúp build nhiều module song song trong 5 giờ.
- [ ] Có build log hoặc agent pack cho thấy workflow nghiêm túc.
- [ ] OpenAI models tạo daily report từ structured summary, tạo UX không thể chỉ bằng rule cứng.
- [ ] Không name-drop: phải nói rõ AI nằm ở đâu và không nằm ở đâu.

## 4. Shared event contract MVP

```ts
export type Severity = "low" | "medium" | "high";

export type EventSource =
  | "local_vision"
  | "activity_tracker"
  | "risk_engine"
  | "nudge"
  | "ai_report"
  | "demo";

export type PostureEventType =
  | "posture.forward_head"
  | "posture.head_tilt"
  | "posture.face_distance"
  | "posture.shoulder_imbalance"
  | "posture.stillness";

export type WorkEventType =
  | "work_session.started"
  | "work_session.ended"
  | "work_session.continuous"
  | "break.started"
  | "break.ended"
  | "idle.started"
  | "idle.ended"
  | "app_category.changed";

export type NudgeEventType =
  | "nudge.sent"
  | "nudge.snoozed"
  | "nudge.completed"
  | "nudge.dismissed";

export interface BaseDeskMateEvent {
  id: string;
  timestamp: string;
  source: EventSource;
}

export interface PostureEvent extends BaseDeskMateEvent {
  type: PostureEventType;
  source: "local_vision" | "demo";
  severity: Severity;
  confidence: number;
  durationSeconds?: number;
  metadata?: {
    neckAngleDegrees?: number;
    headTiltDegrees?: number;
    faceDistanceEstimate?: "near" | "normal" | "far";
    shoulderDelta?: number;
    stillnessSeconds?: number;
  };
}

export interface WorkdayEvent extends BaseDeskMateEvent {
  type: WorkEventType;
  source: "activity_tracker" | "demo";
  durationSeconds?: number;
  metadata?: {
    appCategory?: "meeting" | "coding" | "writing" | "support" | "browser" | "unknown";
    idleReason?: "keyboard_mouse_inactive" | "screen_locked" | "manual_break";
  };
}

export interface NudgeEvent extends BaseDeskMateEvent {
  type: NudgeEventType;
  source: "nudge" | "demo";
  nudgeType: "neck_reset" | "eye_break" | "stand_up" | "shoulder_reset" | "long_session_break";
  mode: "gentle" | "focus_friendly" | "strict_self_care";
  message: string;
  snoozeMinutes?: number;
}

export type DeskMateEvent = PostureEvent | WorkdayEvent | NudgeEvent;
```

## 5. Daily summary contract cho AI

```ts
export interface DailyDeskSummary {
  date: string;
  activeTimeMinutes: number;
  longestSessionMinutes: number;
  breakCount: number;
  idleTimeMinutes: number;
  postureRiskEvents: number;
  highRiskPeriod?: {
    start: string;
    end: string;
  };
  postureStrain: Severity;
  breakDebt: Severity;
  fatigueRisk: Severity;
  score: number;
  baseline?: {
    averageBreaksPerDay: number;
    averageActiveTimeMinutes: number;
    usualFatigueWindow?: string;
    postureRiskUsuallyAfterMinutes?: number;
  };
  privacy: {
    webcamProcessing: "local";
    cloudProcessing: boolean;
    rawFramesStored: 0;
    dataSharedWithEmployer: false;
  };
}
```

## 6. Prompt: Product Architect Agent

```txt
You are the Product Architect Agent for DeskMate AI, a local-first desktop health assistant.

Goal:
Define the MVP architecture, contracts, and implementation order.

Product constraints:
- Webcam processing must run locally.
- Raw webcam frames must never be stored.
- AI must not receive raw images or video.
- AI only receives structured event summaries.
- Do not build disease diagnosis, medical stress diagnosis, deep emotion analysis, employer dashboard, emergency contact, mobile app, or wearable integration in MVP.

Tasks:
1. Define module boundaries for Local Vision, Activity Tracker, Event Store, Risk Engine, Baseline Engine, AI Report, Mascot Nudge, Privacy Dashboard, and Demo Mode.
2. Define TypeScript event schemas.
3. Define privacy invariants.
4. Define integration flow.
5. Define build order for a hackathon MVP.

Return:
- Architecture summary.
- Event schema.
- Module responsibilities.
- Integration order.
- Risks and fallback plan.
```

## 7. Prompt: Local Vision Agent

```txt
You are the Local Vision Agent for DeskMate AI.

Goal:
Build a local webcam posture extraction module that emits structured posture events.

Requirements:
- Process webcam locally.
- Do not store raw frames.
- Do not send frames to cloud.
- Emit posture events only.
- Detect or estimate:
  - head tilt
  - forward neck posture
  - face distance from screen
  - shoulder imbalance
  - stillness duration
  - confidence score
- Include demo mode with simulated posture events.

Output event examples:
14:12 posture.forward_head severity=high confidence=0.87
14:20 posture.stillness severity=medium duration=42m confidence=0.81

Implementation guidance:
- Prefer MediaPipe / TensorFlow.js / OpenCV depending on stack.
- Use cautious ergonomic labels, not medical claims.
- Keep all frame data in memory only and discard immediately after extracting landmarks/features.

Return:
- Files changed.
- Public API/hook/service names.
- How events are emitted.
- Any fallback/demo controls.
```

## 8. Prompt: Activity Tracker Agent

```txt
You are the Activity Tracker Agent for DeskMate AI.

Goal:
Track computer workday patterns and emit workday events.

Requirements:
- Track active computer time.
- Track idle time.
- Track continuous work sessions.
- Track breaks.
- Track longest uninterrupted session.
- Detect late-night work if feasible.
- App category usage is optional for MVP.

Events:
- work_session.started
- work_session.ended
- work_session.continuous
- break.started
- break.ended
- idle.started
- idle.ended

Rules:
- Keep logic local.
- Do not build employer monitoring.
- Do not over-collect unnecessary data.

Return:
- Files changed.
- Tracker API.
- Event examples.
- Edge cases handled.
```

## 9. Prompt: Event Store Agent

```txt
You are the Event Store Agent for DeskMate AI.

Goal:
Build local persistence for DeskMate events and privacy counters.

Requirements:
- Store posture events.
- Store workday events.
- Store nudge events.
- Store daily summaries if available.
- Support querying by date/range/type.
- Support delete all data.
- Support privacy dashboard counters.
- Raw webcam frames stored must always be 0.

Storage:
- Prefer SQLite for desktop app.
- For very fast hackathon prototype, local JSON or IndexedDB is acceptable.

Return:
- Storage schema.
- Repository/service API.
- Delete-all-data behavior.
- Privacy counters API.
```

## 10. Prompt: Risk & Baseline Agent

```txt
You are the Risk & Baseline Agent for DeskMate AI.

Goal:
Convert event logs into ergonomic risk scores and personalized baseline insights.

Inputs:
- Posture events.
- Workday events.
- Nudge events.
- Daily aggregates from previous days.

Build:
- posture strain score
- break debt score
- fatigue risk score
- daily desk health score
- high-risk period detection
- baseline comparison over 7 days
- personalized insights

Rules:
- Do not diagnose disease.
- Do not infer medical stress.
- Use phrases like “posture risk”, “break debt”, “fatigue risk”, not disease language.
- If fewer than 7 days exist, return a partial baseline status.

Example insight:
“Tư thế xấu của bạn thường xuất hiện sau khoảng 60 phút làm việc liên tục, đặc biệt trong các phiên viết hoặc xử lý ticket.”

Return:
- Score formulas.
- Service API.
- Edge cases.
- Example output.
```

## 11. Prompt: AI Report Agent

```txt
You are the AI Report Agent for DeskMate AI.

Goal:
Generate a daily desk health report from structured event summaries only.

Strict rules:
- You never receive raw images.
- You never receive video.
- You do not diagnose disease.
- You do not analyze emotions.
- You do not make medical certainty claims.
- You must explain based on event log fields.
- Use Vietnamese by default.
- Be specific and actionable.

Input example:
{
  "active_time": "7h 12m",
  "longest_session": "96m",
  "breaks": 4,
  "posture_risk_events": 18,
  "high_risk_period": "14:10-15:35",
  "usual_fatigue_window": "14:00-16:00",
  "posture_risk_after": "60m",
  "cloud_mode": false,
  "raw_images_stored": 0
}

Output format:
# Daily Desk Health Report

## Score: {score}/100

Short summary.

## Điểm nổi bật
- ...

## Nguyên nhân chính
- ...

## Gợi ý cho ngày mai
- ...
```

## 12. Prompt: UI & Mascot Agent

```txt
You are the UI & Mascot Agent for DeskMate AI.

Goal:
Build the hackathon demo UI.

Screens:
1. Home dashboard
2. Live posture panel
3. Workday timeline
4. Mascot nudge popup
5. Daily report
6. Privacy dashboard

Design principles:
- Calm, friendly, non-surveillance feeling.
- Local-first and privacy-first language.
- Clear enough for a 5-minute demo.
- Avoid medical claims.
- Make status cards readable from a distance.

Mascot nudge modes:
- Gentle
- Focus-friendly
- Strict self-care

Example copy:
“Bạn đã tập trung 76 phút rồi. Cổ bạn đang hơi căng. Nghỉ 90 giây để reset nhé?”

Avoid:
“Cảnh báo nguy hiểm. Bạn có vấn đề sức khỏe.”

Return:
- Files changed.
- Screen list.
- Components created.
- Demo data path.
```

## 13. Prompt: Privacy Dashboard Agent

```txt
You are the Privacy Dashboard Agent for DeskMate AI.

Goal:
Build the privacy trust screen for the hackathon demo.

Must display:
- Webcam processing: Local
- Cloud processing: Off by default
- Raw webcam frames stored: 0
- Posture events saved: {count}
- Data shared with employer: Never
- Delete all data: Available

Requirements:
- The UI must clearly explain that frames are processed locally and discarded immediately.
- The dashboard must not imply hidden monitoring.
- Include a delete-all-data action.
- Include “AI only receives event summaries” if AI report is enabled.

Return:
- Files changed.
- Privacy counters used.
- Delete behavior.
```

## 14. Prompt: Demo Script Agent

```txt
You are the Demo Script Agent for DeskMate AI.

Goal:
Prepare a 5-minute hackathon demo flow and fallback data.

Demo flow:
0:00-0:45 Problem
0:45-1:30 Product intro
1:30-2:30 Live posture detection or simulated posture detection
2:30-3:15 Friendly nudge
3:15-4:15 Daily report
4:15-5:00 Privacy proof + technical depth

Requirements:
- Include exact Vietnamese speaking script.
- Include fallback if webcam fails.
- Include simulated event stream.
- Include what to show on screen at each minute.

Return:
- Demo script.
- Event timeline.
- Fallback plan.
```

## 14.1. Prompt: Functional Demo Agent

```txt
You are the Functional Demo Agent for DeskMate AI.

Goal:
Maximize the “Does it work?” score. The app must look and behave like a working product, not a slide deck.

Hackathon rubric:
- Does it work? has x2 weight.
- Scrappy but functional is acceptable.
- Disqualifying/low score risks: only slides, virtually no code, fragile demo, no visible product behavior.

Your tasks:
1. Define the minimum end-to-end demo path:
   event -> event store -> risk score -> nudge/report/privacy dashboard.
2. Define a demo mode that works even when webcam permission, lighting, or CV model fails.
3. Define visible debug/proof panels that show real events flowing through the system.
4. Define “no dead screen” fallback states for every screen.
5. Define a pre-demo checklist.

Required demo proof:
- Home dashboard changes when simulated events play.
- Workday timeline renders event blocks.
- Mascot nudge appears from risk state, not as static image.
- Daily report is generated from structured summary.
- Privacy dashboard shows raw frames stored = 0 and cloud off.
- Delete all data action is present.

Return:
- Demo success path.
- Fallback mode behavior.
- Pre-demo checklist.
- Top 5 fragility risks and mitigation.
```

## 14.2. Prompt: Market Scale Agent

```txt
You are the Market Scale Agent for DeskMate AI.

Goal:
Prepare the business case for the Market Scale rubric.

Rubric:
How large can this become as a real business?
Reward:
- Large reachable market.
- Clear first customer/use case.
- Credible path to adoption and expansion.
Avoid:
- Tarpit ideas.
- Generic AI wrappers with no edge.
- Naive “replace humans by AI” stories in low-trust markets.

DeskMate AI positioning:
- Local-first ergonomic AI assistant for computer workers.
- Not medical diagnosis.
- Not employer surveillance.
- Wedge: private, event-based, posture/workday assistant that users actually trust.

Your tasks:
1. Define first customer and first use case.
2. Define why this is not a generic wellness/AI wrapper app.
3. Define market expansion path.
4. Define business model options.
5. Prepare judge-ready 60-second market pitch.

Suggested first customers:
- Vietnamese software engineers and outsourcing teams.
- Remote workers/freelancers.
- Support/call-center workers.
- Young office workers who work long laptop hours.

Expansion path examples:
- Individual freemium.
- Paid pro for personal insights.
- Opt-in team wellness without employer-level individual surveillance.
- Partnerships with coworking spaces, HR benefits, ergonomic hardware, insurers later.

Return:
- Market thesis.
- First customer/use case.
- Differentiation.
- Expansion path.
- 60-second pitch.
- Hard judge questions and answers.
```

## 14.3. Prompt: Vietnam Impact Agent

```txt
You are the Vietnam Impact Agent for DeskMate AI.

Goal:
Maximize the “Impact to Vietnam” rubric by making the Vietnam fit specific, credible, and non-generic.

Rubric:
- How may this create positive impact to Vietnam as a country and to Vietnamese way of life?
- Show deep understanding of Vietnamese market and culture.
- Do not say “this benefits the world, so it benefits Vietnam too.”

Vietnam-specific context to use carefully:
- Vietnam has many young office workers, software outsourcing teams, support teams, and remote/freelance workers.
- Long laptop hours are common.
- People may ignore breaks because they do not want to look lazy.
- Many home/office setups are not ergonomic.
- Employees may distrust wellness tools if they feel like employer monitoring.
- Vietnamese UI and gentle copy matter for adoption.

Your tasks:
1. Define the Vietnam-specific pain.
2. Define who benefits first in Vietnam.
3. Explain why local-first privacy matters culturally and practically.
4. Explain how this can improve daily work habits without medical claims.
5. Prepare a 45-second Vietnam impact pitch.

Return:
- Vietnam-specific problem statement.
- Target users in Vietnam.
- Impact claims with cautious wording.
- UI/copy recommendations in Vietnamese.
- 45-second pitch.
- Judge Q&A.
```

## 14.4. Prompt: Engineering Depth Narrator Agent

```txt
You are the Engineering Depth Narrator Agent for DeskMate AI.

Goal:
Make the engineering depth obvious to veteran engineer judges.

Rubric:
Engineering Depth score ranges from Boilerplate to Serious Engineering / Witchcraft.
Judges are veteran engineers and will challenge shallow AI wrappers.

Your job is not only to list architecture. You must identify what can be shown live as technical proof.

Technical depth to emphasize:
- Local webcam processing.
- Immediate frame discard.
- Landmark/feature extraction into posture events.
- Event-driven architecture.
- Deterministic risk scoring before AI.
- Personal baseline over 7 days.
- AI only sees structured summary.
- Privacy dashboard backed by event/store counters.
- Demo mode using the same event pipeline, not fake UI screenshots.

Your tasks:
1. Create a technical talk track for 60–90 seconds.
2. Define architecture diagram labels.
3. Define live proof points to show in the app.
4. Define likely engineer judge questions and concise answers.
5. Identify where the product would be considered shallow and how to avoid that.

Return:
- Technical proof points.
- Architecture talk track.
- Live demo proof checklist.
- Judge Q&A.
- “Avoid looking like a wrapper” recommendations.
```

## 14.5. Prompt: Codex Transformation Agent

```txt
You are the Codex Transformation Agent for DeskMate AI.

Goal:
Prepare a credible case that Codex/OpenAI is transformative to the business/product, not just name-dropping.

Rubric context:
- Judges want to see something truly transformative that Codex can help the business achieve.
- “Name Drop” is low score.
- Good Fit / Meaningful Impact / Transformative means Codex or OpenAI models play a vital role.

DeskMate AI angle:
- Codex helps a small team build multiple product surfaces in parallel during the hackathon: local vision, event engine, UI, risk scoring, report generation, pitch assets.
- OpenAI models power daily reports and personalized explanations from structured event logs.
- AI is deliberately constrained: it does not see webcam images, which creates trust and differentiates the product.

Your tasks:
1. Write a concise case study of how Codex accelerated the build.
2. Explain where OpenAI models sit in the product.
3. Explain why this improves user experience beyond static rules.
4. Explain why privacy constraints make the AI integration stronger, not weaker.
5. Prepare a 45-second optional track-4 pitch.

Return:
- Codex/OpenAI transformation story.
- Product AI boundaries.
- 45-second pitch.
- Judge Q&A.
```

## 14.6. Prompt: Vibe & Pitch Agent

```txt
You are the Vibe & Pitch Agent for DeskMate AI.

Goal:
Maximize Vibe Check by making judges believe in the product emotionally and practically.

Rubric:
How strongly do judges personally believe in this project?

Tone:
- Human.
- Calm.
- Not creepy.
- Not medical overclaiming.
- Vietnamese-first for local resonance.

Core message:
“DeskMate AI không giám sát bạn. Nó giúp bạn nhận ra khi cơ thể bắt đầu trả giá cho một ngày làm việc dài.”

Your tasks:
1. Rewrite the 5-minute demo script with stronger emotional arc.
2. Make the first 20 seconds memorable.
3. Add smooth transitions between problem, product, live demo, AI report, privacy proof, and business/impact.
4. Prepare answers to skeptical judge questions.
5. Ensure the pitch never sounds like medical diagnosis or employee surveillance.

Return:
- 5-minute script.
- 20-second opening.
- Closing sentence.
- Judge Q&A.
- Phrases to avoid.
```

## 15. Simulated demo event stream

```json
[
  {
    "id": "evt_demo_001",
    "timestamp": "2026-06-26T09:30:00.000Z",
    "source": "demo",
    "type": "work_session.started"
  },
  {
    "id": "evt_demo_002",
    "timestamp": "2026-06-26T10:45:00.000Z",
    "source": "demo",
    "type": "work_session.continuous",
    "durationSeconds": 4500
  },
  {
    "id": "evt_demo_003",
    "timestamp": "2026-06-26T14:12:00.000Z",
    "source": "demo",
    "type": "posture.forward_head",
    "severity": "high",
    "confidence": 0.87,
    "durationSeconds": 900,
    "metadata": {
      "neckAngleDegrees": 34,
      "stillnessSeconds": 2520
    }
  },
  {
    "id": "evt_demo_004",
    "timestamp": "2026-06-26T14:35:00.000Z",
    "source": "demo",
    "type": "work_session.continuous",
    "durationSeconds": 5760
  },
  {
    "id": "evt_demo_005",
    "timestamp": "2026-06-26T14:38:00.000Z",
    "source": "demo",
    "type": "nudge.sent",
    "nudgeType": "neck_reset",
    "mode": "focus_friendly",
    "message": "Bạn đã tập trung 76 phút rồi. Cổ bạn đang hơi căng. Nghỉ 90 giây để reset nhé?"
  }
]
```

## 16. MVP build order nếu team ít người

Thứ tự này tối ưu theo rubric: **Does it work x2** trước, sau đó **Engineering Depth/Impact x3**, cuối cùng là **Vibe x1**.

1. Functional demo shell: Home, Timeline, Nudge, Daily Report, Privacy Dashboard với mock data.
2. Shared event schema.
3. Demo event player dùng cùng pipeline như real mode.
4. Event store local + privacy counters + delete all data.
5. Risk scoring từ event log.
6. Mascot nudge phát sinh từ risk state, không hard-code popup.
7. Daily report bằng template trước, AI sau nếu còn thời gian.
8. Activity tracker đơn giản.
9. Baseline 7 ngày bằng seed/demo data.
10. Local vision real mode.
11. Engineering proof panel/log viewer.
12. Pitch polish: Vietnam impact, market wedge, privacy proof, judge Q&A.

## 17. Definition of done cho hackathon MVP

### Product demo

- Home dashboard hiển thị score, active time, current session, posture risk, break debt.
- Có event log thật hoặc simulated event log.
- Có mascot nudge với snooze/done.
- Có daily report cụ thể dựa trên summary.
- Có privacy dashboard nói rõ local processing, raw frames stored = 0, cloud off, delete data.
- Có demo mode để chạy chắc chắn trong 5 phút.
- Không có medical diagnosis hoặc emotion recognition claim.

### Rubric readiness

- Does it work: Có flow end-to-end chạy được trước mặt giám khảo.
- Engineering Depth: Có architecture/event pipeline/risk scoring/baseline/privacy proof để trình bày.
- Impact to Vietnam: Có ít nhất 3 insight cụ thể về người dùng Việt Nam, không nói chung chung.
- Market Scale: Có first customer, wedge, expansion path và business model ngắn gọn.
- Vibe Check: Pitch không creepy, không phán xét, có mascot/copy thân thiện, có privacy proof.
- Codex/OpenAI: Nói rõ AI nằm ở report/reasoning layer, không đọc ảnh; Codex giúp build multi-agent nhanh.

## 18. 5 câu trả lời ngắn cho giám khảo

### 1. “Cái này có hoạt động thật không hay chỉ là scripted?”

“Demo mode dùng cùng event pipeline với real mode: event được ghi vào store, risk engine tính lại score, UI và nudge phản ứng theo state. Nếu webcam ổn, local vision tạo event thật; nếu camera lỗi, simulated stream vẫn chứng minh pipeline.”

### 2. “Khác gì app nhắc nghỉ thông thường?”

“DeskMate không chỉ đếm giờ. Nó kết hợp work session, break debt, posture event và baseline cá nhân để nhắc đúng ngữ cảnh. AI report cũng giải thích từ event log thật, không nói chung chung.”

### 3. “Có creepy/surveillance không?”

“Không. Webcam xử lý local, raw frames stored = 0, AI không nhận ảnh, không có employer dashboard. Sản phẩm được thiết kế cho cá nhân tự chăm sóc, không phải để sếp giám sát.”

### 4. “Tác động riêng cho Việt Nam là gì?”

“Người làm văn phòng, dev outsourcing, support và freelancer ở Việt Nam thường làm laptop nhiều giờ, không gian làm việc không luôn ergonomic, và nhiều người ngại nghỉ vì sợ bị đánh giá. DeskMate dùng tiếng Việt, nhắc nhẹ, riêng tư, giúp hình thành thói quen nghỉ và chỉnh tư thế mà không tạo cảm giác bị theo dõi.”

### 5. “OpenAI/Codex đóng vai trò thật ở đâu?”

“Codex giúp team build song song nhiều module trong thời gian ngắn. Trong sản phẩm, OpenAI chỉ đọc structured summary để tạo daily report cá nhân hóa. Phần nhạy cảm nhất là ảnh webcam không bao giờ được gửi cho AI.”
