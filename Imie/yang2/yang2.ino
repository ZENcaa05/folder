// ============ LIBRARY ================

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

#define wifiLed   2     
#define connect   4     

#define ledred    18
#define ledgreen  19
#define ledblue   27

#define relay     16
#define pompa     17

#define TRIG      5
#define ECHO      13

#define soil      34   
#define DHTPIN    23
#define DHTTYPE DHT22

#define SERVO     25

// ================= OBJECT =================
FirebaseData fbdo;
FirebaseData fbdoControl;

FirebaseAuth auth;
FirebaseConfig config;

DHT dht(DHTPIN, DHTTYPE);
Servo servoH;

// ================= VAR =================
int batasKering = 2500;
int batasLembab = 1500;

int lastPos = -1;
unsigned long lastSend = 0;

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

  digitalWrite(relay, HIGH);
  digitalWrite(pompa, HIGH);

  // ===== SERVO =====
  servoH.attach(SERVO);
  servoH.write(90);

  // ===== WIFI =====
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    digitalWrite(wifiLed, !digitalRead(wifiLed));
    delay(300);
  }

  Serial.println("\nWiFi Connected");
  digitalWrite(wifiLed, HIGH);

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

  fbdo.setBSSLBufferSize(8192, 2048);
}

// ================= LOOP =================
void loop() {

  digitalWrite(connect, WiFi.status() == WL_CONNECTED ? HIGH : LOW);

  // ===== KONTROL =====
  if (Firebase.ready()) {
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/relay")) {
      digitalWrite(relay, fbdoControl.boolData() ? LOW : HIGH);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/pompa")) {
      digitalWrite(pompa, fbdoControl.boolData() ? LOW : HIGH);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/ledred")) {
      digitalWrite(ledred, fbdoControl.boolData() ? HIGH : LOW);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/ledblue")) {
      digitalWrite(ledblue, fbdoControl.boolData() ? HIGH : LOW);
    }
    if (Firebase.RTDB.getBool(&fbdoControl, "/kontrol/ledgreen")) {
      digitalWrite(ledgreen, fbdoControl.boolData() ? HIGH : LOW);
    }
  }

  // ===== KIRIM DATA =====
  if (Firebase.ready() && millis() - lastSend > 5000) {
    lastSend = millis();

    // float suhu = dht.readTemperature();
    // float lembab = dht.readHumidity();

    int nilaiSoil = analogRead(soil);
    long jarak = bacaUltrasonik();

    // if (isnan(suhu) || isnan(lembab)) {
    //   Serial.println("❌ DHT ERROR");
    //   return;
    // }

    String statusTanah = "";
    int pos = 90;

    // ===== LOGIC TANAH =====
    if (nilaiSoil > batasKering) {
      statusTanah = "Kering";
      pos = 0;

    } else if (nilaiSoil > batasLembab) {
      statusTanah = "Lembab";
      pos = 90;

    } else {
      statusTanah = "Basah";
      pos = 180;
    }

    // ===== SERVO CONTROL =====
    bool pompaNyala = digitalRead(pompa) == LOW;

    if (pompaNyala && pos != lastPos) {
      servoH.write(pos);
      lastPos = pos;
    }

    // ===== FIREBASE JSON =====
    FirebaseJson json;
    // json.set("suhu", suhu);
    // json.set("lembab", lembab);
    json.set("soil", nilaiSoil);
    json.set("statusTanah", statusTanah);
    json.set("jarak", jarak);
    json.set("servo", pos);

    if (Firebase.RTDB.setJSON(&fbdo, "/sensor", &json)) {
      Serial.println("✅ Data terkirim");
    } else {
      Serial.println("❌ ERROR: " + fbdo.errorReason());
    }

    // Serial.print("Suhu: ");
    // Serial.print(suhu);
    // Serial.print(" | Lembab: ");
    // Serial.print(lembab);
    Serial.print(" | Soil: ");
    Serial.print(nilaiSoil);
    Serial.print(" | Status: ");
    Serial.print(statusTanah);
    Serial.print(" | Servo: ");
    Serial.println(pos);
  }

  delay(20);
}