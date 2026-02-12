const fs = require('fs');
const path = require('path');

const filePath = 'd:\\works\\code\\nestjs\\google-maps-resolver\\html\\67_50____Nguy_n_V_n_C___T__7__Long_Bi_n__H__N_i__V_2026-02-12T03-24-34-533Z.html';
const content = fs.readFileSync(filePath, 'utf8');

console.log('--- Trích xuất tọa độ từ Google Maps HTML ---\n');

// 1. Tìm theo pattern Protobuf (!3d...!4d...) hoặc (%213d...%214d...)
const latLngRegex = /(?:!|%21)(?:3d|2d)(-?[0-9.]+)(?:!|%21)(?:4d|1d)(-?[0-9.]+)/g;
let match;
const foundRaw = [];

const isValidCoord = (lat, lng) => {
    lat = parseFloat(lat);
    lng = parseFloat(lng);
    // Kiểm tra tính hợp lệ toán học
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    // Lọc riêng cho Việt Nam để tránh các con số rác (Zoom, Scale...)
    // Latitude: 8-24, Longitude: 102-110
    return lat > 8 && lat < 24 && lng > 102 && lng < 110;
};

while ((match = latLngRegex.exec(content)) !== null) {
    if (isValidCoord(match[1], match[2])) {
        foundRaw.push({ lat: match[1], lng: match[2], source: 'Protobuf (Lat/Lng)' });
    }
}

// 2. Tìm theo pattern ngược (!1d...!2d...)
const lngLatRegex = /(?:!|%21)1d(-?[0-9.]+)(?:!|%21)2i?d(-?[0-9.]+)/g;
while ((match = lngLatRegex.exec(content)) !== null) {
    if (isValidCoord(match[2], match[1])) {
        foundRaw.push({ lat: match[2], lng: match[1], source: 'Protobuf (Lng/Lat inverse)' });
    }
}

// 3. Tìm trong static map và meta tags
const staticMapRegex = /center=(-?[0-9.]+)%2C(-?[0-9.]+)/g;
while ((match = staticMapRegex.exec(content)) !== null) {
    if (isValidCoord(match[1], match[2])) {
        foundRaw.push({ lat: match[1], lng: match[2], source: 'Static Map/Meta' });
    }
}

// 4. Tìm trong các mảng JS (deep scan mảng lồng nhau)
// Cấu trúc thường gặp: [..., [105.771827, 21.004077], ...]
const arrayRegex = /\[\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\]/g;
while ((match = arrayRegex.exec(content)) !== null) {
    const v1 = match[1];
    const v2 = match[2];
    
    if (isValidCoord(v1, v2)) {
        foundRaw.push({ lat: v1, lng: v2, source: 'Array [lat, lng]' });
    } else if (isValidCoord(v2, v1)) {
        foundRaw.push({ lat: v2, lng: v1, source: 'Array [lng, lat]' });
    }
}


// Hiển thị kết quả duy nhất
const uniqueResults = [];
const seen = new Set();

foundRaw.forEach(res => {
    const lat = parseFloat(res.lat).toFixed(6);
    const lng = parseFloat(res.lng).toFixed(6);
    const key = `${lat},${lng}`;
    if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push({ lat, lng, source: res.source });
    }
});

if (uniqueResults.length === 0) {
    console.log('Không tìm thấy tọa độ nào phù hợp.');
} else {
    console.log(`Tìm thấy ${uniqueResults.length} tọa độ hợp lệ:\n`);
    uniqueResults.forEach((res, i) => {
        console.log(`${i + 1}. [${res.lat}, ${res.lng}]`);
        console.log(`   Nguồn: ${res.source}\n`);
    });
}
