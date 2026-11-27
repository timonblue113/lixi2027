# Lì Xì Dê Vàng (Tết Đinh Mùi 2027)
Next.js + Supabase + Gemini + SePay. `public/app.html` là giao diện thử (dữ liệu giả lập), chưa nối vào API.

## Chạy
1. Tạo project Supabase, chạy `supabase/schema.sql`, bật Google ở Authentication.
2. `cp .env.example .env.local` rồi điền khóa. `npm i && npm run dev`.
3. SePay: tạo webhook `https://<domain>/api/sepay/webhook`, xác thực API Key, đặt cùng giá trị với `SEPAY_API_KEY`.

## API (chủ phòng gửi `Authorization: Bearer <access_token Supabase>`)
- `GET /api/me`: trạng thái, lượt free còn lại, QR mua Pro (nội dung chuyển khoản `LX` + pay_code).
- `POST /api/rooms`: tạo phòng. Trả 402 kèm `qr` khi hết 3 lượt free hoặc cần Pro (AI chấm điểm, trên 10 bao).
- `POST /api/rooms/:code/open`: người nhận mở bao, không cần đăng nhập. Gemini lỗi thì dùng điểm mặc định.
- `POST /api/sepay/webhook`: bật Pro, chống trùng bằng `transaction_id`.

## Chống lách lượt free (không chặn IP)
Chạy `supabase/02_abuse.sql` sau `schema.sql`. Lượt free cấp khi tài khoản dưới 3 lượt và thiết bị dưới 3 phòng free/30 ngày.
Turnstile khi tạo phòng, giới hạn 20 lần tạo phòng/giờ và 40 lần mở bao/giờ theo mã thiết bị, thêm trần 2.000 lượt mở bao/giờ toàn hệ thống để không cháy quota Gemini.
Mã thiết bị do trình duyệt tự gửi nên người rành kỹ thuật có thể giả; lớp chắn chính là Google đăng nhập, Turnstile và trần toàn hệ thống.
`IP_SALT` chỉ là chuỗi bí mật dùng để hash mã thiết bị.

## Deploy
1. Đẩy lên GitHub. 2. Supabase: chạy 2 file SQL, bật Google. 3. Vercel: import repo và điền biến môi trường trong `.env.example`.
4. Khóa Gemini chỉ để ở biến môi trường `GEMINI_API_KEY` trên Vercel (server), không để trong code hay trình duyệt.
5. SePay: webhook `https://<domain>/api/sepay/webhook`, xác thực API Key trùng `SEPAY_API_KEY`.

Chạy thêm `supabase/03_bank.sql` để lưu tài khoản nhận lì xì của người chơi.

Chạy thêm `supabase/04_open.sql` (mở bao chỉ 1 lệnh DB). Nên đặt Vercel Function Region gần vùng của Supabase.

`04_open.sql` cũng thêm câu hỏi thưởng (rooms.quiz_q/quiz_a/bonus_pct, envelopes.bonus). Bao luôn chia ngẫu nhiên đều, câu trả lời chỉ để Gemini cà khịa.

Chạy thêm `supabase/05_fast_open.sql` (mở bao chỉ 1 lần gọi DB; câu cà khịa của Gemini tải sau khi đã hiện số tiền). `vercel.json` đặt vùng chạy sin1, đổi cho khớp vùng Supabase của bạn.
