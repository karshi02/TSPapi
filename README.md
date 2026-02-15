ทำ redme.md ให้หน่อย
🗺️ TSP Route Optimizer for Smart Trash Management System
https://img.shields.io/badge/version-1.0.0-blue
https://img.shields.io/badge/python-3.8+-green
https://img.shields.io/badge/flask-2.3.3-red
https://img.shields.io/badge/license-MIT-yellow

ระบบคำนวณเส้นทางเก็บขยะที่เหมาะสมที่สุดด้วยอัลกอริทึม TSP (Travelling Salesman Problem) รองรับการทำงานร่วมกับ ESP32 และเซ็นเซอร์วัดระดับขยะ พร้อมหน้าเว็บแสดงผลแบบ Real-time

📸 ตัวอย่างหน้าจอ
https://via.placeholder.com/800x400?text=TSP+Route+Optimizer+Dashboard

✨ คุณสมบัติหลัก
🗺️ คำนวณเส้นทาง TSP - หาเส้นทางเก็บขยะที่สั้นที่สุดด้วย Google OR-Tools

📍 แสดงผลบนแผนที่ - แสดงตำแหน่งถังขยะและเส้นทางแบบ Interactive

📊 สถานะ Real-time - ระดับขยะ, สถานะการเชื่อมต่อ, เวลาอัพเดทล่าสุด

🎨 ระบบแจ้งเตือนด้วยสี - 🔴 แดง (80-100%), 🟡 เหลือง (50-79%), 🟢 เขียว (0-49%)

📱 รองรับทุกอุปกรณ์ - Responsive Design สำหรับมือถือ แท็บเล็ต และ desktop

🔌 API สำหรับ ESP32 - รับข้อมูลจาก ESP32 ผ่าน HTTP GET/POST

⚡ อัพเดทอัตโนมัติ - Refresh ข้อมูลทุก 10 วินาที

🧪 โหมดทดสอบ - จำลองข้อมูลสำหรับทดสอบระบบ

⌨️ คีย์บอร์ดชอร์ตคัท - Ctrl+R รีเฟรช, Ctrl+C คำนวณเส้นทาง, ESC ปิดแจ้งเตือน

🛠️ เทคโนโลยีที่ใช้
Backend
Python 3.8+ - ภาษาหลัก

Flask - Web Framework

Google OR-Tools - TSP Optimization

Flask-CORS - รองรับ Cross-Origin Requests

Geopy - คำนวณระยะทาง

Frontend
HTML5 / CSS3 - โครงสร้างและตกแต่ง

JavaScript (ES6+) - การทำงานฝั่ง client

Leaflet.js - แสดงแผนที่

Font Awesome 6 - ไอคอนสวยงาม

Google Fonts (Inter) - ฟอนต์ทันสมัย

📦 การติดตั้ง
1. Clone โปรเจค
bash
git clone https://github.com/yourusername/tsp-route-optimizer.git
cd tsp-route-optimizer
2. สร้าง Virtual Environment (แนะนำ)
bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
3. ติดตั้ง Dependencies
bash
pip install -r requirements.txt
4. รันเซิร์ฟเวอร์
bash
python app.py
5. เปิดเบราว์เซอร์
text
http://localhost:5000
📁 โครงสร้างโปรเจค
text
tsp-route-optimizer/
├── app.py                 # Flask application หลัก
├── tsp_solver.py          # TSP algorithm solver
├── requirements.txt       # Python dependencies
├── README.md             # เอกสารประกอบ
├── static/
│   ├── css/
│   │   └── style.css     # CSS styles
│   └── js/
│       └── script.js      # JavaScript functions
└── templates/
    └── index.html         # หน้าเว็บหลัก
🔌 API Endpoints
Method	Endpoint	คำอธิบาย
GET	/	หน้าเว็บหลัก
GET	/api/bins	ข้อมูลถังขยะทั้งหมด
GET	/api/full-bins	ข้อมูลถังที่เต็ม (≥80%)
GET	/api/route	เส้นทางที่เหมาะสมที่สุด
POST	/api/calculate-route	คำนวณเส้นทางแบบกำหนดเอง
GET	/api/esp32/update	รับข้อมูลจาก ESP32
POST	/api/update	อัพเดทข้อมูลถังขยะ
POST	/api/clear	ล้างข้อมูลทั้งหมด
📡 การเชื่อมต่อกับ ESP32
โค้ดตัวอย่างสำหรับ ESP32
cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YourWiFi";
const char* password = "YourPassword";
const char* serverIP = "192.168.1.100"; // IP ของเครื่องที่รัน Flask

void sendToTSPAPI(int binId, int percent, float lat, float lng, String location) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    String url = "http://" + String(serverIP) + ":5000/api/esp32/update";
    url += "?id=" + String(binId);
    url += "&percent=" + String(percent);
    url += "&lat=" + String(lat, 6);
    url += "&lng=" + String(lng, 6);
    url += "&location=" + location;
    
    http.begin(url);
    int httpCode = http.GET();
    
    if (httpCode == 200) {
        Serial.println("✅ Data sent to TSP API");
    } else {
        Serial.print("❌ Failed: ");
        Serial.println(httpCode);
    }
    
    http.end();
}

void setup() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi Connected!");
}

void loop() {
    // อ่านค่าจากเซ็นเซอร์
    int percent = readUltrasonicSensor(); // ฟังก์ชันอ่านค่าเซ็นเซอร์ของคุณ
    
    // ส่งข้อมูลไป TSP API
    sendToTSPAPI(1, percent, 16.199183, 103.273303, "โรงยิม 1");
    
    delay(5000); // ส่งข้อมูลทุก 5 วินาที
}
🎯 การใช้งาน
การคำนวณเส้นทาง
รอให้ระบบรวบรวมข้อมูลจากถังขยะ

คลิกปุ่ม "คำนวณเส้นทาง"

ระบบจะแสดงเส้นทางที่สั้นที่สุดบนแผนที่

แสดงลำดับถังที่ต้องเก็บและระยะทาง

การทดสอบระบบ
คลิกปุ่ม "ทดสอบระบบ"

ระบบจะสร้างข้อมูลจำลอง 4 ถัง

ทดสอบคำนวณเส้นทางได้ทันที

คีย์บอร์ดชอร์ตคัท
Ctrl + R - รีเฟรชข้อมูล

Ctrl + C - คำนวณเส้นทาง

ESC - ปิดการแจ้งเตือน

🎨 ระดับการแจ้งเตือน
สี	ระดับ	ความหมาย
🔴 แดง	80-100%	เต็มแล้ว - ต้องรีบเก็บ
🟡 เหลือง	50-79%	เกือบเต็ม - เตรียมการเก็บ
🟢 เขียว	0-49%	ว่าง - ยังไม่ต้องเก็บ
⚙️ การปรับแต่ง
เปลี่ยนเกณฑ์การแจ้งเตือน
ในไฟล์ app.py ปรับค่าเปอร์เซ็นต์:

python
# เปลี่ยนจาก 80% เป็นค่าที่ต้องการ
full_bins = [bin_data for bin_data in latest_bin_data if bin_data.get('percent', 0) >= 80]
ปรับความเร็วในการอัพเดท
ในไฟล์ static/js/script.js:

javascript
// เปลี่ยนจาก 10000 (10 วินาที) เป็นค่าที่ต้องการ
setInterval(refreshData, 10000);
📊 ตัวอย่างข้อมูล JSON
ข้อมูลถังขยะ
json
{
    "status": "success",
    "bins": [
        {
            "id": 1,
            "percent": 85,
            "lat": 16.199183,
            "lng": 103.273303,
            "name": "โรงยิม 1",
            "location": "โรงยิม 1",
            "timestamp": "2024-01-15T10:30:00"
        }
    ],
    "count": 4,
    "last_update": "2024-01-15T10:30:00"
}
ผลการคำนวณเส้นทาง
json
{
    "status": "success",
    "full_bins_count": 3,
    "route": [0, 2, 1, 3, 0],
    "total_distance": 5.23,
    "estimated_time": 10.5,
    "waypoints": [...]
}
🐛 การแก้ไขปัญหาเบื้องต้น
1. ไม่สามารถเชื่อมต่อกับ Flask server
bash
# ตรวจสอบว่า Flask กำลังรันอยู่
ps aux | grep flask

# ตรวจสอบ firewall
sudo ufw status

# ทดสอบการเชื่อมต่อ
curl http://localhost:5000/api/bins
2. ESP32 ส่งข้อมูลไม่ได้
cpp
// เพิ่ม debug
Serial.println("Connecting to: " + url);
int httpCode = http.GET();
Serial.println("HTTP Code: " + String(httpCode));
3. แผนที่ไม่แสดง
javascript
// ตรวจสอบ console ใน browser
console.log('Map initialized:', map);
console.log('Markers:', markers);