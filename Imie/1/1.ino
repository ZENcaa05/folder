
// ============ LIBRARY ================

#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT11.h>

// ================= WIFI =================

const char* ssid = "Imie";
const char* password = "zencaaaaaa";

// ================= FIREBASE =================

#define API_KEY "AIzaSyD91996UDqysOxIyz99LhvGIPalZeKO0M4"
#define DATABASE_URL "ujikom-7bd71-default-rtdb.asia-southeast1.firebasedatabase.app"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ================= IC CHIF REGISTER ==================

const int dataPin  = D7;
const int latchPin = D6;
const int clockPin = D5;

// ================= PIN =================

#define soil A0
DHT11 dht11(D1);
#define TRIG_PIN D2
#define ECHO_PIN D3
 
// =========== ULTRA SONIC ============
long bacaUltrasonik() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long durasi = pulseIn(ECHO_PIN, HIGH, 20000); // 20 ms timeout
  if (durasi == 0) return -1;

  return durasi * 0.034 / 2;
}

// =========== SHIF REGISTER ========== 
byte power   = 1;      // 00000001
byte wifi    = 2;      // 00000010
byte connect = 4;      // 00000100
byte relay1  = 8;      // 00001000
byte relay2  = 16;     // 00010000
byte ledr    = 32;     // 00100000
byte ledg    = 64;     // 01000000
byte ledb    = 128;    // 10000000

byte kondisi = 0;

void kirimData(byte data) {
  digitalWrite(latchPin, LOW);
  shiftOut(dataPin, clockPin, MSBFIRST, data);
  digitalWrite(latchPin, HIGH);
}
// ============ SOIL ============

int batasKering = 500;

// ===== millis timer =====
unsigned long previousMillis = 0;
const long interval = 2000; // 2 detik



void setup() {
  Serial.begin(115200);
  pinMode(dataPin, OUTPUT);
  pinMode(latchPin, OUTPUT);
  pinMode(clockPin, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  kirimData(0);

  kondisi |= power;
  kirimData(kondisi);
  kondisi |= wifi;
  kirimData(kondisi);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("WiFi Connected");
  kondisi &= ~wifi;
  kirimData(kondisi);
  kondisi |= connect;
  kirimData(kondisi);
  

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  config.signer.test_mode = true;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.println("Firebase Connected");
}

void loop() {

  // ===== RELAY 1 =====
  if (Firebase.RTDB.getInt(&fbdo, "/aktuator/relay/lampu")) {
    int r1 = fbdo.intData();
    Serial.print("Relay1: ");
    Serial.println(r1);

    if (r1 == 1) kondisi |= relay1;
    else kondisi &= ~relay1;
  }

  // ===== RELAY 2 =====
  if (Firebase.RTDB.getInt(&fbdo, "/aktuator/relay/pompa")) {
    int r2 = fbdo.intData();
    Serial.print("Relay2: ");
    Serial.println(r2);

    if (r2 == 1) kondisi |= relay2;
    else kondisi &= ~relay2;
  }

  // ===== LED RED =====
  if (Firebase.RTDB.getInt(&fbdo, "/aktuator/led/red")) {
    int red = fbdo.intData();
    Serial.print("LED RED: ");
    Serial.println(red);

    if (red == 1) kondisi |= ledr;
    else kondisi &= ~ledr;
  }

  // ===== LED GREEN =====
  if (Firebase.RTDB.getInt(&fbdo, "/aktuator/led/green")) {
    int green = fbdo.intData();
    Serial.print("LED GREEN: ");
    Serial.println(green);

    if (green == 1) kondisi |= ledg;
    else kondisi &= ~ledg;
  }

  // ===== LED BLUE =====
  if (Firebase.RTDB.getInt(&fbdo, "/aktuator/led/blue")) {
    int blue = fbdo.intData();
    Serial.print("LED BLUE: ");
    Serial.println(blue);

    if (blue == 1) kondisi |= ledb;
    else kondisi &= ~ledb;
  }

  // ===== KIRIM KE SHIFT REGISTER =====
  kirimData(kondisi);
  // ================= TIMER SENSOR =================
unsigned long currentMillis = millis();

if (currentMillis - previousMillis >= interval) {
  previousMillis = currentMillis;

  // ===== DHT11 =====
  int suhu = 0;
  int lembab = 0;

  if (dht11.readTemperatureHumidity(suhu, lembab) == 0) {

    Firebase.RTDB.setInt(&fbdo, "/sensor/dht/suhu", suhu);
    Firebase.RTDB.setInt(&fbdo, "/sensor/dht/lembab", lembab);

    Serial.print("Suhu: ");
    Serial.println(suhu);

    Serial.print("Lembab: ");
    Serial.println(lembab);

  } else {
    Serial.println("DHT gagal membaca");
  }

  // ===== SOIL SENSOR =====
  int nilaiSoil = analogRead(soil);

  Firebase.RTDB.setInt(&fbdo, "/sensor/soil/nilai", nilaiSoil);

  Serial.print("Soil: ");
  Serial.println(nilaiSoil);

  // ===== STATUS TANAH =====
  if (nilaiSoil > batasKering) {

    Firebase.RTDB.setString(&fbdo, "/sensor/soil/statusTanah", "Kering");

  } else {

    Firebase.RTDB.setString(&fbdo, "/sensor/soil/statusTanah", "Basah");

  }

  // ============ ultra sonic ========
  long jarak = bacaUltrasonik();
  if (Firebase.RTDB.setInt(&fbdo, "/ultrasonic/jarak", jarak)) {
    Serial.println("DATA ULTRASONIC TERKIRIM");
  } else {
    Serial.print("GAGAL: ");
    Serial.println(fbdo.errorReason());
  }
}

  delay(200);
}

