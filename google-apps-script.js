// ================================================
// TRẠM 81 - Google Apps Script API
// Deploy as Web App: Execute as Me, Anyone can access
// ================================================

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const action = e.parameter.action;

  try {
    let result;
    if (action === 'getMenu') result = getMenu();
    else if (action === 'getToppings') result = getToppings();
    else if (action === 'getOrders') result = getOrders();
    else if (action === 'getTodayOrders') result = getTodayOrders();
    else result = { error: 'Unknown action' };

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  try {
    let result;
    if (action === 'addOrder') result = addOrder(data.payload);
    else if (action === 'deleteOrder') result = deleteOrder(data.payload);
    else if (action === 'addMenuItem') result = addMenuItem(data.payload);
    else if (action === 'updateMenuItem') result = updateMenuItem(data.payload);
    else if (action === 'deleteMenuItem') result = deleteMenuItem(data.payload);
    else if (action === 'addTopping') result = addTopping(data.payload);
    else if (action === 'updateTopping') result = updateTopping(data.payload);
    else if (action === 'deleteTopping') result = deleteTopping(data.payload);
    else if (action === 'syncMenu') result = syncMenu(data.payload);
    else if (action === 'syncToppings') result = syncToppings(data.payload);
    else result = { error: 'Unknown action' };

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ── HELPERS ──────────────────────────────────────

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

// ── MENU ─────────────────────────────────────────

function getMenu() {
  const sheet = getSheet('Menu');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1)
    .filter(row => row[3] !== false && row[3] !== 'FALSE') // Active filter
    .map((row, idx) => ({
      rowIndex: idx + 2, // 1-indexed, skip header
      category: row[0],
      name: row[1],
      price: Number(row[2]),
    }))
    .filter(item => item.name);
}

function addMenuItem(payload) {
  const sheet = getSheet('Menu');
  sheet.appendRow([payload.category, payload.name, payload.price, true]);
  return { success: true };
}

function updateMenuItem(payload) {
  const sheet = getSheet('Menu');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Match by name + category (original values)
    if (data[i][1] === payload.originalName && data[i][0] === payload.originalCategory) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([
        [payload.category, payload.name, payload.price, true]
      ]);
      return { success: true };
    }
  }
  return { error: 'Item not found' };
}

function deleteMenuItem(payload) {
  const sheet = getSheet('Menu');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.name && data[i][0] === payload.category) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Item not found' };
}

// Sync toàn bộ menu từ app lên sheet (dùng lần đầu)
function syncMenu(items) {
  const sheet = getSheet('Menu');
  // Xoá hết data cũ (giữ header)
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  // Thêm header nếu chưa có
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Danh mục', 'Tên Món', 'Giá', 'Active']);
  }
  // Import items
  items.forEach(item => {
    sheet.appendRow([item.category, item.name, item.price, true]);
  });
  return { success: true, count: items.length };
}

// ── TOPPINGS ─────────────────────────────────────

function getToppings() {
  const sheet = getSheet('Toppings');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1)
    .filter(row => row[2] !== false && row[2] !== 'FALSE')
    .map((row, idx) => ({
      rowIndex: idx + 2,
      name: row[0],
      price: Number(row[1]),
    }))
    .filter(item => item.name);
}

function addTopping(payload) {
  const sheet = getSheet('Toppings');
  sheet.appendRow([payload.name, payload.price, true]);
  return { success: true };
}

function updateTopping(payload) {
  const sheet = getSheet('Toppings');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.originalName) {
      sheet.getRange(i + 1, 1, 1, 3).setValues([
        [payload.name, payload.price, true]
      ]);
      return { success: true };
    }
  }
  return { error: 'Topping not found' };
}

function deleteTopping(payload) {
  const sheet = getSheet('Toppings');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.name) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Topping not found' };
}

function syncToppings(items) {
  const sheet = getSheet('Toppings');
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Tên Topping', 'Giá', 'Active']);
  }
  items.forEach(item => {
    sheet.appendRow([item.name, item.price, true]);
  });
  return { success: true, count: items.length };
}

// ── ORDERS ───────────────────────────────────────

function getOrders() {
  const sheet = getSheet('Orders');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    timestamp: row[1],
    items: JSON.parse(row[2] || '[]'),
    total: Number(row[3]),
  }));
}

// Chỉ lấy orders hôm nay — tối ưu cho multi-device POS
function getTodayOrders() {
  const sheet = getSheet('Orders');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const today = new Date();
  const todayStr = today.toDateString();

  return data.slice(1)
    .filter(row => {
      if (!row[0]) return false;
      const orderDate = new Date(row[1]);
      return orderDate.toDateString() === todayStr;
    })
    .map(row => ({
      id: row[0],
      timestamp: row[1],
      items: JSON.parse(row[2] || '[]'),
      total: Number(row[3]),
    }));
}

function addOrder(payload) {
  const sheet = getSheet('Orders');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Order ID', 'Timestamp', 'Items (JSON)', 'Total', 'Note']);
  }
  sheet.appendRow([
    payload.id,
    payload.timestamp,
    JSON.stringify(payload.items),
    payload.total,
    payload.note || ''
  ]);
  return { success: true };
}

function deleteOrder(payload) {
  const sheet = getSheet('Orders');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Order not found' };
}
