const fs = require('fs');
const path = require('path');

/**
 * THAY THẾ SHEET_ID CỦA BẠN TẠI ĐÂY
 * Ví dụ: https://docs.google.com/spreadsheets/d/1abc123.../edit -> ID là '1abc123...'
 */
const SHEET_ID = '1x1v8rB71iHdGw0AD2-a6YCof0txNXA1DSzeCV-a0z9U'; 
const GID = '0'; // ID của tab trang tính, mặc định là 0
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

async function syncSheetsToLocal() {
  console.log('🔄 Đang bắt đầu tải dữ liệu từ Google Sheets...');

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`Không thể kết nối Google Sheets: ${response.statusText}`);

    const csvText = await response.text();

    // Hàm parse CSV chuyên nghiệp để xử lý dấu phẩy trong ngoặc kép và xuống dòng
    const parseCSV = (text) => {
      const result = [];
      let row = [];
      let field = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        if (inQuotes) {
          if (char === '"' && nextChar === '"') { field += '"'; i++; } // Xử lý dấu ngoặc kép kép
          else if (char === '"') inQuotes = false;
          else field += char;
        } else {
          if (char === '"') inQuotes = true;
          else if (char === ',') { row.push(field); field = ''; }
          else if (char === '\n' || char === '\r') {
            row.push(field);
            if (row.some(f => f.trim() !== '')) result.push(row);
            row = []; field = '';
            if (char === '\r' && nextChar === '\n') i++; // Xử lý \r\n
          } else field += char;
        }
      }
      if (field || row.length > 0) { row.push(field); result.push(row); }
      return result;
    };

    const rows = parseCSV(csvText);
    if (rows.length < 2) throw new Error('Dữ liệu Sheet trống hoặc không đúng định dạng');

    const headers = rows[0].map(h => h.trim());

    const jsonData = rows.slice(1).map((values) => {
      const obj = {};
      headers.forEach((header, i) => {
        let val = values[i] ? values[i].trim() : "";

        // Ép kiểu dữ liệu theo cấu trúc của products.json
        if (['id', 'oldPrice', 'newPrice', 'sold', 'stockPercent'].includes(header)) {
          obj[header] = Number(val) || 0;
        } else if (header === 'isHot') {
          obj[header] = val.toLowerCase() === 'true';
        } else {
          obj[header] = val;
        }
      });
      return obj;
    }).filter(item => item.id); // Loại bỏ dòng trống nếu không có ID

    // Ghi vào file products.json
    const outputPath = path.join(__dirname, 'products.json');
    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf8');

    console.log('✅ Cập nhật thành công!');
    console.log(`📍 File đã lưu: ${outputPath}`);
    console.log(`📦 Tổng cộng: ${jsonData.length} sản phẩm.`);

  } catch (error) {
    console.error('❌ Lỗi khi đồng bộ:');
    console.error(error.message);
  }
}

// Thực thi
syncSheetsToLocal();

// Để chạy file này, mở terminal tại thư mục này và gõ: node sync_sheets.js
