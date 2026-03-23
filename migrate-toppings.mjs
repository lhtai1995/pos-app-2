/**
 * Script migrate dữ liệu Topping từ cấu trúc cũ sang cấu trúc mới.
 * 
 * Cấu trúc CŨ:
 *   toppingGroups/{groupId}/items/{toppingId}: { name, price }
 * 
 * Cấu trúc MỚI:
 *   toppings/{toppingId}: { name, price }    <- Topping lẻ ở "tổng kho"
 *   toppingGroups/{groupId}/items/{toppingId}: true  <- Chỉ lưu ID reference
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDvJ943I4BljkTQKggNkW_5_to7rDFpufQ",
  authDomain: "tram-81-pos.firebaseapp.com",
  databaseURL: "https://tram-81-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tram-81-pos",
  storageBucket: "tram-81-pos.firebasestorage.app",
  messagingSenderId: "112403107186",
  appId: "1:112403107186:web:09b2b85fcc06b9becde1eb",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function main() {
  // 1. Đọc toppingGroups hiện tại từ Firebase
  console.log('📖 Đọc data toppingGroups từ Firebase...');
  const snap = await get(ref(db, 'toppingGroups'));
  const groups = snap.val();

  if (!groups) {
    console.log('ℹ️ Không có toppingGroups nào. Kết thúc.');
    process.exit(0);
  }

  // 2. Phân tích cấu trúc
  const toppingMap = new Map(); // deduplicate by name
  const groupMappings = {}; // { groupId: [toppingIds] }

  for (const [groupId, group] of Object.entries(groups)) {
    const items = group.items || {};
    groupMappings[groupId] = [];

    for (const [itemId, item] of Object.entries(items)) {
      // Kiểm tra xem item này có phải cấu trúc cũ { name, price } không
      if (typeof item === 'object' && item !== null && item.name) {
        const key = `${item.name}_${item.price}`;
        if (!toppingMap.has(key)) {
          toppingMap.set(key, { id: itemId, name: item.name, price: item.price });
          console.log(`  + Topping: [${item.name}] - ${item.price}₫`);
        }
        groupMappings[groupId].push(toppingMap.get(key).id);
      } else if (item === true) {
        // Đã là cấu trúc mới rồi, không cần migrate
        console.log(`  ✅ Group [${group.name}] đã dùng cấu trúc mới, skip.`);
        groupMappings[groupId].push(itemId);
      }
    }
  }

  if (toppingMap.size === 0) {
    console.log('ℹ️ Không tìm thấy topping cũ nào cần migrate.');
    process.exit(0);
  }

  console.log(`\n🔄 Bắt đầu migrate ${toppingMap.size} topping lẻ lên /toppings...`);

  // 3. Ghi topping lẻ vào /toppings
  for (const [, topping] of toppingMap) {
    await set(ref(db, `toppings/${topping.id}`), { name: topping.name, price: topping.price });
    console.log(`  ✅ Đã ghi topping [${topping.name}] vào /toppings/${topping.id}`);
  }

  // 4. Cập nhật lại /toppingGroups/{id}/items chỉ còn ID references (= true)
  console.log('\n🔄 Cập nhật toppingGroups -> items chỉ còn ID references...');
  for (const [groupId, group] of Object.entries(groups)) {
    const items = group.items || {};
    const hasOldStructure = Object.values(items).some(v => typeof v === 'object' && v !== null && v.name);
    
    if (!hasOldStructure) {
      console.log(`  ✅ Group [${group.name}] đã OK (cấu trúc mới), skip.`);
      continue;
    }

    // Xóa items cũ và ghi lại bằng ID references
    await remove(ref(db, `toppingGroups/${groupId}/items`));
    const newItems = {};
    for (const toppingId of groupMappings[groupId]) {
      newItems[toppingId] = true;
    }
    await set(ref(db, `toppingGroups/${groupId}/items`), newItems);
    console.log(`  ✅ Đã cập nhật Group [${group.name}] với ${groupMappings[groupId].length} topping references.`);
  }

  console.log('\n✅ Migration hoàn tất!');
  console.log(`   - Tổng topping lẻ đã tạo: ${toppingMap.size}`);
  console.log(`   - Tổng nhóm đã cập nhật: ${Object.keys(groupMappings).length}`);
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Lỗi:', e);
  process.exit(1);
});
