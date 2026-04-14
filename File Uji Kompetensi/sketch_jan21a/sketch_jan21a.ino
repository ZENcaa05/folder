#include <ESP8266WiFi.h>
#include <FirebaseESP8266.h>
#include <DHT.h>
#include <Servo.h>

// ================= WIFI =================
#define WIFI_SSID "1121"
#define WIFI_PASS "12345678"

// ================= FIREBASE ================= 
#define FIREBASE_HOST "https://uji-kompetensi-11709-default-rtdb.asia-southeast1.firebasedatabase.app/"
#define FIREBASE_AUTH "qvMmJo9GhbX5MdTiTFdaWlGgygsQNV5LmAQ33Vpt"

// ================= FIREBASE OBJECT =================
FirebaseData fb;
FirebaseAuth auth;
FirebaseConfig config;

// ================= PIN =================
// LED
#define LED_MERAH D1
#define LED_BIRU D3
#define LED_HIJAU D2

// SERVO
#define SERVO_PIN D4  

// DHT
#define DHTPIN D7 
#define DHTTYPE DHT11 

DHT dht(DHTPIN, DHTTYPE);
Servo servo;

// posisi servo (bisa kamu sesuaikan)
#define POSISI_KUNCI 0
#define POSISI_BUKA  180

void setup() {
  Serial.begin(9600);

  pinMode(LED_MERAH, OUTPUT);
  pinMode(LED_BIRU, OUTPUT);
  pinMode(LED_HIJAU, OUTPUT);

  servo.attach(SERVO_PIN);
  servo.write(POSISI_KUNCI); // default pintu terkunci

  dht.begin();

  // ================= WIFI =================
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  // ================= FIREBASE =================
  config.database_url = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("IOT SIAP");
}

void loop() {
  // ================= SENSOR DHT =================
  float suhu = dht.readTemperature();
  float hum = dht.readHumidity();

  if (!isnan(suhu) && !isnan(hum)) {
    Firebase.setFloat(fb, "/sensor/suhu", suhu);
    Firebase.setFloat(fb, "/sensor/kelembaban", hum);
  }

  // ================= LED =================
  if (Firebase.getBool(fb, "/led/merah")) {
    digitalWrite(LED_MERAH, fb.boolData());
    
  }

  if (Firebase.getBool(fb, "/led/biru")) {
    digitalWrite(LED_BIRU, fb.boolData());
  }

  if (Firebase.getBool(fb, "/led/hijau")) {
    digitalWrite(LED_HIJAU, fb.boolData());
    Serial.println(fb.boolData());
  }

  // ================= SERVO (LOCK / UNLOCK) =================
  if (Firebase.getBool(fb, "/servo/lock")) {
    bool statusKunci = fb.boolData();

    if (statusKunci) {
      servo.write(POSISI_KUNCI);
      Serial.println("Pintu DIKUNCI");
    } else {
      servo.write(POSISI_BUKA);
      Serial.println("Pintu DIBUKA");
    }
  }

  delay(1000);
}