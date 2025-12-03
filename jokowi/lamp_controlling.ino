#include "secrets.h"
#include <Firebase.h>

#define led1 D2


Firebase fb(REFERENCE_URL);


void setup(){
  Serial.begin (115200);
  pinMode (led1, OUTPUT);
  WiFi.disconnect();
  delay (500);
  
  Serial.println();
  Serial.println("menghubungkan ke WiFi : ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID,WIFI_PASSWORD);

  while (WiFi.status() !=WL_CONNECTED){
    Serial.print("o");
    delay(500);
  }

  Serial.println("Wifi tersambung");
  Serial.println("firebase connect");

}

void loop(){
  bool ledValue = false;

  int status = fb.getBool("/led/led1", ledValue);

  if (status == 200){
    Serial.println("LED1 = ");
    Serial.println(ledValue);

    digitalWrite(led1, ledValue ? HIGH : LOW);
  } 
  else {
    Serial.println("firebase error");
  }

  delay(500);
}