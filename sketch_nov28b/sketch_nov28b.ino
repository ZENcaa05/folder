#include <ESP8266WiFi.h>
#include <FirebaseArduino.h>

// Konfigurasi WiFi
#define WIFI_SSID "biadab"
#define WIFI_PASSWORD "okedehbreq"

// Konfigurasi Firebase
#define FIREBASE_HOST "bebas-7b21c-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "drValvuI4jOaUkgk01AxE7T7T3IKCGguKNpfa1U1"

// Konfigurasi Sensor Ultrasonik
#define TRIG_PIN D7  // GPIO15
#define ECHO_PIN D8 // GPIO13

long duration = 0;
int distance = 0;

void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Setup pin sensor
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  Serial.println("\n\nMulai WiFi Connection");
  
  // Hubung ke WiFi
  WiFi.begin(WIFI_SS  ID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();
  Serial.print("WiFi Connected: ");
  Serial.println(WiFi.localIP());
  
  // Hubung Firebase
  Firebase.begin(FIREBASE_HOST, FIREBASE_AUTH);
  Serial.println("Firebase Connected");
}

// Fungsi untuk membaca jarak dari sensor ultrasonik
int getDistance() {
  // Reset trigger pin
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  
  // Kirim sinyal trigger
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Baca durasi echo
  duration = pulseIn(ECHO_PIN, HIGH);
  
  // Hitung jarak (kecepatan suara = 340 m/s)
  // Formula: jarak = (durasi × kecepatan suara) / 2
  distance = duration * 0.034 / 2;
  
  return distance;
}

void loop() {
  // Baca sensor ultrasonik
  int currentDistance = getDistance();
  
  // Tampilkan di Serial Monitor
  Serial.print("Jarak: ");
  Serial.print(currentDistance);
  Serial.println(" cm");
  
  // Kirim ke Firebase
  Firebase.setInt("/sensor/jarak", currentDistance);
  Firebase.setString("/sensor/timestamp", String(millis()));
  
  // Cek error
  if (Firebase.failed()) {
    Serial.print("Error Firebase: ");
    Serial.println(Firebase.error());
  } else {
    Serial.println("Data berhasil dikirim");
  }
  
  delay(1000); // Update setiap 1 detik
}