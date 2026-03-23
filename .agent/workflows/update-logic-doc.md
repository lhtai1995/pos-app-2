---
description: Update app_LG.md whenever logic changes in POS App 2.0
---

# Quy tắc cập nhật app_LG.md

Mỗi khi có bất kỳ thay đổi nào liên quan đến **logic** trong dự án POS App 2.0, PHẢI cập nhật file:
- **Project**: `/Users/tailam/Desktop/DOL/Personal/App 2.0/docs/app_LG.md`
- **Artifact**: `/Users/tailam/.gemini/antigravity/brain/be5c2504-0d06-4cff-81e6-243f0e1f643e/app_LG.md`

---

## Các trường hợp phải update LG

1. **Thêm/sửa Firebase data structure** → Cập nhật Section 2
2. **Thêm localStorage key mới** → Cập nhật Section 3
3. **Thêm/sửa state** → Cập nhật Section 4
4. **Thêm/sửa business logic** (order, menu, topping, report...) → Cập nhật Section 5
5. **Thêm/sửa Firebase listener** → Cập nhật Section 6
6. **Thêm tab/view mới** → Cập nhật Section 7
7. **Thêm quy ước mới** → Cập nhật Section 8
8. **Phát hiện edge case hoặc lưu ý mới** → Cập nhật Section 9

---

## Cách update

1. Đọc section liên quan trong `app_LG.md`
2. Cập nhật nội dung tương ứng với thay đổi mới
3. Cập nhật dòng ngày ở đầu file: `> DOL POS App 2.0 | Cập nhật: YYYY-MM-DD`
4. Sync cả 2 file (project + artifact)

---

## Lưu ý

- KHÔNG cần update LG khi chỉ thay đổi CSS/UI thuần (không có logic thay đổi)
- CÓ update LG khi thay đổi cách tính toán, cách gọi Firebase, cách xử lý state
- Sau khi update LG, tiếp tục commit code bình thường
