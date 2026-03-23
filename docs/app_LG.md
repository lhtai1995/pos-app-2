# 📋 App LG — Logic Document
> DOL POS App 2.0 | Cập nhật: 2026-03-23

---

## 1. Kiến trúc tổng quan

```
src/
├── App.jsx          # Toàn bộ UI + Logic (SC chính)
├── firebase.js      # Config & khởi tạo Firebase DB
└── index.css        # Styling toàn app
docs/
└── app_LG.md        # File này — tài liệu Logic
```

### Stack
| Layer | Công nghệ |
|---|---|
| UI Framework | React 18 (Vite) |
| Realtime DB | Firebase Realtime Database (asia-southeast1) |
| Charts | Recharts (AreaChart, BarChart) |
| Icons | Lucide React |
| Deploy | Vercel |

---

## 2. Cấu trúc dữ liệu Firebase

### 2.1 `/menu/{itemId}`
```json
{
  "category": "Coffee",
  "name": "Cafe Sữa Gấu",
  "price": 35000,
  "applicableToppingGroups": ["-OoXxx..."]
}
```
> `applicableToppingGroups`: mảng ID của nhóm topping áp dụng cho món này. Nếu rỗng → hiện tất cả nhóm.

---

### 2.2 `/toppings/{toppingId}` ← Kho topping lẻ (tổng)
```json
{
  "name": "Trân Châu Trắng",
  "price": 5000
}
```
> Toàn bộ topping được định nghĩa tập trung tại đây. Sửa 1 lần → cập nhật toàn bộ nhóm dùng nó.

---

### 2.3 `/toppingGroups/{groupId}`
```json
{
  "name": "Topping",
  "items": {
    "-OoXxx1": true,
    "-OoXxx2": true
  }
}
```
> `items` chỉ lưu **ID reference** (value = `true`), KHÔNG lưu data topping thật. App tự resolve ID → object từ `/toppings`.

---

### 2.4 `/orders/{YYYY-MM-DD}/{orderId}`
```json
{
  "id": "-OoXxx...",
  "dateKey": "2026-03-23",
  "timestamp": "2026-03-23T04:30:00.000Z",
  "total": 40000,
  "items": [
    {
      "name": "Cafe Sữa Gấu",
      "price": 35000,
      "category": "Coffee",
      "toppings": [{ "id": "...", "name": "Trân Châu Trắng", "price": 5000 }],
      "totalPrice": 40000
    }
  ]
}
```
> Orders được **partition theo ngày** (dateKey = YYYY-MM-DD) để query report nhanh.

---

## 3. Cache Offline (localStorage)

| Key | Nội dung | Ghi chú |
|---|---|---|
| `dol_menu` | `MenuItem[]` | Sync mỗi khi Firebase push |
| `dol_groups` | `ToppingGroup[]` | Sync real-time |
| `dol_toppings` | `Topping[]` | Sync real-time |
| `dol_orders` | `Order[]` (hôm nay) | Sync real-time |
| `dol_report_cache` | `{ today, week, month }` | TTL: 5 phút |

### Chiến lược: Stale-While-Revalidate
1. App khởi động → load cache ngay (0ms wait) → UI hiện data cũ
2. Firebase listener kết nối → cập nhật đè lên cache → UI cập nhật
3. Report: hiện cache cũ NGAY → âm thầm fetch fresh data ở background

---

## 4. State Management

### 4.1 State chính
```
activeTab         'order' | 'report' | 'menu'
menuItems         MenuItem[]         — từ Firebase /menu
toppingGroups     ToppingGroup[]     — từ Firebase /toppingGroups
toppings          Topping[]          — từ Firebase /toppings (kho lẻ)
orders            Order[]            — đơn hôm nay (real-time)
isLoading         boolean
isOnline          boolean
```

### 4.2 State Order (Bán hàng)
```
currentOrder          CartItem[]    — giỏ hàng hiện tại (chưa log)
showToppingSheet      boolean       — hiện bottom sheet chọn topping
selectedItemToAdd     MenuItem      — món đang được chọn
selectedToppings      Topping[]     — topping đã tick trong sheet
searchQuery           string        — ô tìm kiếm
activeCategoryOrder   string        — pill danh mục đang active ('All' hoặc tên category)
```

### 4.3 State Report
```
reportPeriod       'today' | 'week' | 'month'
periodOrders       Order[]          — orders của kỳ đang xem
cachedReport       ReportData       — { curr, prev } aggregated
isLoadingPeriod    boolean
```

### 4.4 State Menu Management
```
menuView      'list' | 'addItem' | 'editItem' | 'addGroup' | 'editGroup' | 'addTopping' | 'editTopping'
menuTab       'items' | 'toppings' | 'topping_items'
editingItem   MenuItem | ToppingGroup | Topping | null
expandedGroups  { [groupId]: boolean }
form          { category, name, price, applicableToppingGroups[] }
groupForm     { name }
toppingForm   { name, price }
```

---

## 5. Business Logic

### 5.1 Luồng Bán Hàng (Order Tab)

```
User bấm [+] trên MenuItem
  → handleAddItem(item)
      → setSelectedItemToAdd(item)
      → setSelectedToppings([])
      → setShowToppingSheet(true)

BottomSheet hiện ra:
  - Resolve group IDs → topping objects từ state `toppings`
  - User tick/bỏ tick topping → toggleTopping(t)

User bấm [Thêm vào đơn]:
  → confirmAddItem()
      → tính toppingTotal = sum(selectedToppings.price)
      → push CartItem vào currentOrder:
          { ...item, cartId: generateId(), toppings, totalPrice: price + toppingTotal }

User bấm [Log món]:
  → completeOrder()
      → push lên Firebase: orders/{today}/{newId}
      → clear currentOrder
      → invalidate report cache
```

#### CartItem vs OrderItem
| | CartItem | OrderItem (saved) |
|---|---|---|
| `cartId` | ✅ có (unique trong cart) | ❌ bị strip trước khi save |
| `toppings` | full object | full object (snapshot giá tại thời điểm đặt) |
| `totalPrice` | ✅ | ✅ |

---

### 5.2 Xóa Đơn Hàng (Optimistic + Undo)

```
deleteOrder(order)
  1. Xóa khỏi UI ngay lập tức (optimistic)
  2. Set timer 4 giây → thực sự xóa Firebase
  3. Hiện Toast "Đã xóa giao dịch" + nút [Hoàn tác]

Nếu user bấm [Hoàn tác]:
  → clearTimeout(timer)
  → restore order vào local state
  → Toast tắt

Sau 4 giây (nếu không undo):
  → remove(ref(db, `orders/${dk}/${order.id}`))
```

---

### 5.3 Menu Item CRUD

| Hành động | Firebase path | Ghi chú |
|---|---|---|
| Thêm mới | `push(ref(db, 'menu'))` | Firebase tự tạo key |
| Sửa | `update(ref(db, 'menu/{id}'))` | Partial update |
| Xóa | `remove(ref(db, 'menu/{id}'))` | Real-time listener tự cập nhật UI |

**Validation trước khi save:** `name`, `category`, `price` đều không được rỗng.

---

### 5.4 Topping & Nhóm Topping CRUD

#### Topping lẻ (kho tổng)
| Hành động | Firebase path |
|---|---|
| Thêm | `push(ref(db, 'toppings'))` → `{ name, price }` |
| Sửa | `update(ref(db, 'toppings/{id}'))` |
| Xóa | `remove(ref(db, 'toppings/{id}'))` (confirm trước) |

> Khi xóa topping lẻ, các group đang reference ID đó sẽ tự "trống" — không cascade delete. Cần xử lý thủ công nếu muốn strict.

#### Nhóm Topping
| Hành động | Firebase path |
|---|---|
| Thêm nhóm | `push(ref(db, 'toppingGroups'))` → `{ name, items: {} }` |
| Sửa tên nhóm | `update(ref(db, 'toppingGroups/{id}'))` → `{ name }` |
| Xóa nhóm | `remove(ref(db, 'toppingGroups/{id}'))` (confirm) |
| Thêm topping vào nhóm | `set(ref(db, 'toppingGroups/{gId}/items/{tId}'), true)` |
| Gỡ topping khỏi nhóm | `remove(ref(db, 'toppingGroups/{gId}/items/{tId}'))` |

#### Resolve Topping cho Bottom Sheet
```js
resolvedItems = group.items
  .map(toppingId => toppings.find(t => t.id === toppingId))
  .filter(Boolean)
```

---

### 5.5 Report Logic

#### getPeriodRange(period)
| Period | start | end | prevStart | prevEnd |
|---|---|---|---|---|
| `today` | 00:00 hôm nay | 23:59 hôm nay | 00:00 hôm qua | 23:59 hôm qua |
| `week` | Thứ 2 tuần này | 23:59 hôm nay | Thứ 2 tuần trước | CN tuần trước |
| `month` | Ngày 1 tháng này | 23:59 hôm nay | Ngày 1 tháng trước | Cuối tháng trước |

#### fetchPeriodData(period, forceRefresh)
```
1. Kiểm tra cache (TTL 5 phút)
   → Có & không forceRefresh: hiện cache ngay + revalidate background → return
2. Firebase query curr + prev song song (Promise.all)
3. aggregate(orders) → { revenue, count, orders, byDay, rawOrders }
4. saveReportCache + setState
```

#### Top Items (render-time, không async)
```js
periodOrders → gom count + revenue theo item.name → sort desc → slice(0, 10)
```

---

## 6. Real-time Listeners

Tất cả đăng ký trong `useEffect([], [])`:

| Listener | Path | Cleanup |
|---|---|---|
| `unsubMenu` | `/menu` | ✅ |
| `unsubGroups` | `/toppingGroups` | ✅ |
| `unsubToppings` | `/toppings` | ✅ |
| `unsubOrders` | `/orders/{today}` | ✅ |

---

## 7. UI Navigation Flow

```
Bottom Nav
├── [Bán hàng]  → activeTab = 'order'
├── [Báo cáo]   → activeTab = 'report'
└── [Menu]      → activeTab = 'menu'
                       │
                  menuView state
                       │
      ┌────────────────┴──────────────────┐
   'list'                        'addItem' | 'editItem'
  (3 sub-tabs)                   'addGroup' | 'editGroup'
                                 'addTopping' | 'editTopping'
                                 (Full-screen form)
```

### menuView Transitions
| Từ | Sang | Trigger |
|---|---|---|
| `list` | `addItem` | Bấm "Thêm món mới" |
| `list` | `editItem` | Bấm edit trên item |
| `list` | `addGroup` | Bấm "Thêm nhóm topping" |
| `list` | `editGroup` | Bấm edit trên group |
| `list` | `addTopping` | Bấm "Thêm topping lẻ mới" |
| `list` | `editTopping` | Bấm edit trên topping lẻ |
| `any` | `list` | Bấm X (back) |

---

## 8. Quy ước đặt tên

| Loại | Convention | Ví dụ |
|---|---|---|
| Firebase path | camelCase | `toppingGroups`, `menu` |
| State setter | `set` + PascalCase | `setMenuItems` |
| Handler | `handle` + Verb | `handleAddItem` |
| Form submit | `save` + Noun | `saveMenuItem`, `saveGroup` |
| Delete | `delete` + Noun | `deleteOrder`, `deleteTopping` |
| Toggle | `toggle` + Noun | `toggleTopping` |
| CSS class | kebab-case | `top-item-rank`, `chart-card` |

---

## 9. Lưu ý khi mở rộng

> [!WARNING]
> Xóa Topping lẻ chưa có cascade delete → các group đang reference ID đó sẽ trơ. Cần xử lý nếu muốn strict.

> [!NOTE]
> Report cache TTL = 5 phút. Giảm `REPORT_TTL` nếu cần real-time hơn. Hiện dùng stale-while-revalidate nên UX vẫn nhanh.

> [!TIP]
> Thêm tab mới: thêm vào `activeTab` + bottom nav button + `{activeTab === 'newtab' && renderNewTab()}`.

> [!IMPORTANT]
> Orders partition theo ngày. Chỉ listener real-time cho ngày hôm nay. Report dùng `get()` query multi-day. Không mix hai cơ chế này.
