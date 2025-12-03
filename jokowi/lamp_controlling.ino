#include "secrets.h"
#include <Firebase.h>

#define buzzerPin D4   // buzzer positif ke D4, negatif ke GND

Firebase fb(REFERENCE_URL);

void setup(){
  Serial.begin(115200);
  pinMode(buzzerPin, OUTPUT);
  WiFi.disconnect();
  delay(500);
  
  Serial.println();
  Serial.println("Menghubungkan ke WiFi : ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED){
    Serial.print("o");
    delay(500);
  }

  Serial.println("\nWiFi tersambung!");
  Serial.println("Firebase connect");
}

void loop(){
  bool buzzerValue = true;

  // Path Firebase sesuai file kamu: dataBuzzer/keadaan
  int status = fb.getBool("/dataBuzzer/keadaan", buzzerValue);

  if (status == 200){
    Serial.print("Buzzer = ");
    Serial.println(buzzerValue);

    // HIGH = bunyi, LOW = mati
    digitalWrite(buzzerPin, buzzerValue ? HIGH : LOW);
  } 
  else {
    Serial.println("Firebase error");
  }

  delay(500);
}
