#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>
#include <time.h>
#include <ESP32Servo.h>

// ================= WIFI =================
#define WIFI_SSID "Imie"
#define WIFI_PASSWORD "xxzencaa"

// ================= FIREBASE =================
#define API_KEY "AIzaSyBYUCGcfOUUCLxU_nOn54fiPReZDXgn-0E"
#define DATABASE_URL "https://ujikom-3250b-default-rtdb.asia-southeast1.firebasedatabase.app/"

// ================= PIN =================
#define power 23
#define wifiLed 22
#define connect 21
#define ledred 19
#define ledgreen 18
#define ledblue 27

#define relay 17
#define pompa 16

#define TRIG 4
#define ECHO 13
#define soil 39   

#define DHTPIN 5
#define DHTTYPE DHT22

// ===== 4 LDR =====
#define LDR1 34
#define LDR2 35
#define LDR3 32
#define LDR4 33

// ===== SERVO =====
#define SERVO_H 25
#define SERVO_V 26

// ================= OBJECT =================
FirebaseData fbdo;         // kirim data
FirebaseData fbdoControl;  // ambil kontrol

FirebaseAuth auth;
FirebaseConfig config;

DHT dht(DHTPIN, DHTTYPE);
Servo servoH;
Servo servoV;

// ================= VAR =================
int batasKering = 2000;
unsigned long lastSend = 0;

int posH = 90;
int posV = 90;
int threshold = 80;

// ================= ULTRASONIC =================
long bacaUltrasonik() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long durasi = pulseIn(ECHO, HIGH, 20000);
  if (durasi == 0) return 0;

  return durasi * 0.034 / 2;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

  pinMode(power, OUTPUT);
  pinMode(ledred, OUTPUT);
  pinMode(ledgreen, OUTPUT);
  pinMode(ledblue, OUTPUT);

  pinMode(relay, OUTPUT);
  pinMode(pompa, OUTPUT);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);

  pinMode(wifiLed, OUTPUT);
  pinMode(connect, OUTPUT);

  dht.begin();

  // ===== SERVO =====
  servoH.attach(SERVO_H);
  servoV.attach(SERVO_V);
  servoH.write(posH);
  servoV.write(posV);

  digitalWrite(power, HIGH);
  // ===== WIFI =====
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    digitalWrite(wifiLed, !digitalRead(wifiLed));
    delay(300);
  }

  Serial.println("\nWiFi Connected");
  digitalWrite(wifiLed, LOW);
  

  // ===== NTP =====
  configTime(0, 0, "pool.ntp.org");
  while (time(nullptr) < 100000) {
    Serial.print(".");
    digitalWrite(connect, !digitalRead(connect));
    delay(500);
  }
  Serial.println("\nTime OK");
  digitalWrite(connect, HIGH);

  // ===== FIREBASE =====
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = "test";

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // SSL FIX
  fbdo.setBSSLBufferSize(8192, 2048);
}

// ================= LOOP =================
void loop() {

  // ===== STATUS LED =====
  digitalWrite(connect, WiFi.status() == WL_CONNECTED ? HIGH : LOW);

  // ===== BACA LDR =====
  int ldr1 = analogRead(LDR1);
  int ldr2 = analogRead(LDR2);
  int ldr3 = analogRead(LDR3);
  int ldr4 = analogRead(LDR4);

  int atas  = (ldr1 + ldr2) / 2;
  int bawah = (ldr3 + ldr4) / 2;
  int kiri  = (ldr1 + ldr3) / 2;
  int kanan = (ldr2 + ldr4) / 2;

  // ===== GERAK SERVO =====
  if (abs(atas - bawah) > threshold) {
    posV += (atas > bawah) ? -1 : 1;
    posV = constrain(posV, 10, 170);
    servoV.write(posV);
  }

  if (abs(kiri - kanan) > threshold) {
    posH += (kiri > kanan) ? 1 : -1;
    posH = constrain(posH, 10, 170);
    servoH.write(posH);
  }

  // ===== KONTROL RELAY dan LED =====
  if (Firebase.ready()) {
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/relay")) {
      bool relayState = fbdoControl.boolData();
      digitalWrite(relay, relayState ? LOW : HIGH);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/pompa")) {
      bool relayState = fbdoControl.boolData();
      digitalWrite(pompa, relayState ? LOW : HIGH);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/ledred")) {
      bool ledState = fbdoControl.boolData();
      digitalWrite(ledred, ledState ? HIGH : LOW);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/ledblue")) {
      bool ledState = fbdoControl.boolData();
      digitalWrite(ledblue, ledState ? HIGH : LOW);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/ledgreen")) {
      bool ledState = fbdoControl.boolData();
      digitalWrite(ledgreen, ledState ? HIGH : LOW);
    }
  }


  // ===== KIRIM DATA =====
  if (Firebase.ready() && millis() - lastSend > 5000) {
    lastSend = millis();

    float suhu = dht.readTemperature();
    float lembab = dht.readHumidity();
    int nilaiSoil = analogRead(soil);
    long jarak = bacaUltrasonik();

    if (isnan(suhu) || isnan(lembab)) {
      Serial.println("❌ DHT ERROR");
      return;
    }

    String statusTanah = (nilaiSoil > batasKering) ? "Kering" : "Basah";

    FirebaseJson json;
    json.set("suhu", suhu);
    json.set("lembab", lembab);
    json.set("soil", nilaiSoil);
    json.set("statusTanah", statusTanah);
    json.set("jarak", jarak);

    json.set("ldr1", ldr1);
    json.set("ldr2", ldr2);
    json.set("ldr3", ldr3);
    json.set("ldr4", ldr4);

    json.set("servoH", posH);
    json.set("servoV", posV);

    if (Firebase.RTDB.setJSON(&fbdo, "/sensor", &json)) {
      Serial.println("✅ Data terkirim");
    } else {
      Serial.println("❌ ERROR: " + fbdo.errorReason());
    }
  }

  delay(20);
}