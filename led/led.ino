#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

const char* ssid = "Jemuran";       // Ganti dengan WiFi kamu
const char* password = "rahasia1234";

ESP8266WebServer server(80);

const int relayPins[2] = {D1, D2};
bool relayStates[2] = {false, false};

// === HTML + JavaScript dari Visual Code dimasukkan di sini ===
const char webpage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Relay Controller</title>
  <style>
    body { font-family: Arial; text-align: center; margin-top: 50px; }
    button { padding: 10px 20px; margin: 10px; }
    button.on { background: green; color: white; }
  </style>
</head>
<body>
  <h1>Kendali Relay ESP8266</h1>
  <button id="r1" onclick="toggle(1)">OFF</button>
  <button id="r2" onclick="toggle(2)">OFF</button>

  <script>
    function toggle(ch) {
      fetch(`/relay?ch=${ch}`)
        .then(r => r.text())
        .then(res => {
          const btn = document.getElementById('r' + ch);
          if (res.includes("ON")) {
            btn.textContent = "ON";
            btn.classList.add("on");
          } else {
            btn.textContent = "OFF";
            btn.classList.remove("on");
          }
        });
    }
  </script>
</body>
</html>
)rawliteral";

// === SETUP ===
void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  Serial.println();
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  for (int i = 0; i < 2; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH); // relay mati
  }

  // Rute utama (halaman web)
  server.on("/", []() {
    server.send_P(200, "text/html", webpage);
  });

  // Endpoint untuk toggle relay
  server.on("/relay", []() {
    int ch = server.arg("ch").toInt();
    if (ch >= 1 && ch <= 2) {
      relayStates[ch - 1] = !relayStates[ch - 1];
      digitalWrite(relayPins[ch - 1], relayStates[ch - 1] ? LOW : HIGH);
      server.send(200, "text/plain", relayStates[ch - 1] ? "ON" : "OFF");
    } else {
      server.send(400, "text/plain", "Invalid channel");
    }
  });

  server.begin();
  Serial.println("Server started");
}

void loop() {
  server.handleClient();
}
