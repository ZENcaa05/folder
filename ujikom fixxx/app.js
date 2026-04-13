// ==========================================
// DEKLARASI VARIABEL GLOBAL & STATE
// ==========================================
// Status LED 1, 2, 3 (true = ON, false = OFF)
const ledStates = { 1: false, 2: false, 3: false };

// Status perangkat lainnya
let lampState = false,           // Status Lampu Utama
    manualWaterState = false,    // Status Siram Manual
    autoWaterState = false;      // Status Siram Otomatis

// Statistik penyiraman
let totalWateringCount = 0,      // Total jumlah penyiraman
    lastWateringDuration = 0;    // Durasi penyiraman terakhir

// Posisi servo motors
let servoHPos = 0,               // Posisi servo horizontal (0-180°)
    servoVPos = 0;               // Posisi servo vertikal (0-180°)

// Timer untuk cooldown penyiraman manual
let wateringCooldown = 0;        // Sisa waktu cooldown (detik)
let cooldownInterval = null;     // Interval ID untuk cooldown timer

// ==========================================
// KONFIGURASI WARNA & GAYA LED
// ==========================================
const ledColors = {
    1: { on: 'bg-red-500', shadow: 'shadow-red-500/50', border: 'border-red-500' },
    2: { on: 'bg-green-500', shadow: 'shadow-green-500/50', border: 'border-green-500' },
    3: { on: 'bg-blue-500', shadow: 'shadow-blue-500/50', border: 'border-blue-500' }
};

// ==========================================
// KONFIGURASI DEFAULT DASHBOARD
// ==========================================
const defaultConfig = {
    dashboard_title: 'Smart Farm IoT',
    location_name: 'Greenhouse A',
    auto_water_threshold: '40',
    tank_shape: 'kubus',
    tank_length: 60,
    tank_width: 40,
    tank_height: 60,
    primary_color: '#10b981',
    secondary_color: '#1e293b',
    text_color: '#f1f5f9',
    accent_color: '#fbbf24',
    surface_color: '#334155'
};

// Konfigurasi tangki air yang dapat diubah
let tankConfig = { ...defaultConfig };

// ==========================================
// FUNGSI PERHITUNGAN KAPASITAS TANGKI
// ==========================================
// Menghitung kapasitas tangki berdasarkan bentuk (kubus atau tabung)
function calculateTankCapacity() {
    if (tankConfig.tank_shape === 'kubus') {
        // Volume kubus = panjang × lebar × tinggi (dibagi 1000 untuk konversi ke liter)
        return (tankConfig.tank_length * tankConfig.tank_width * tankConfig.tank_height) / 1000;
    } else {
        // Volume tabung = π × r² × tinggi (dibagi 1000 untuk konversi ke liter)
        return (Math.PI * Math.pow(tankConfig.tank_length, 2) * tankConfig.tank_height) / 1000;
    }
}

// Menghitung volume air pada ketinggian tertentu
function calculateWaterVolume(waterHeight) {
    if (tankConfig.tank_shape === 'kubus') {
        return (tankConfig.tank_length * tankConfig.tank_width * waterHeight) / 1000;
    } else {
        return (Math.PI * Math.pow(tankConfig.tank_length, 2) * waterHeight) / 1000;
    }
}

// ==========================================
// FUNGSI UPDATE TAMPILAN TANGKI AIR
// ==========================================
// Update visual tangki air: tinggi, volume, persentase, status
function updateWaterDisplay(waterHeight) {
    const maxHeight = tankConfig.tank_height;
    const actualHeight = Math.min(waterHeight, maxHeight);
    const waterVolume = calculateWaterVolume(actualHeight);
    const capacity = calculateTankCapacity();
    const waterPercent = Math.floor((waterVolume / capacity) * 100);

    // Update elemen DOM dengan nilai air terbaru
    $('#water-height').text(actualHeight.toFixed(1));
    $('#water-volume').text(waterVolume.toFixed(1));
    $('#water-volume-ml').text((waterVolume * 1000).toLocaleString('id-ID'));
    $('#water-fill').css('height', waterPercent + '%');
    $('#water-level-percent').text(waterPercent + '%');

    // Tentukan status air berdasarkan persentase
    const ws = waterPercent > 70 ? 'Penuh' : waterPercent > 30 ? 'Cukup' : 'Rendah';
    const wse = $('#water-status');
    wse.text(ws).attr('class', `text-lg font-bold ${waterPercent > 30 ? 'text-emerald-400' : 'text-red-400'}`);
}

// ==========================================
// FUNGSI MODAL KONFIRMASI KUSTOM
// ==========================================
// Tampilkan modal konfirmasi tanpa menggunakan alert() (yang tidak bekerja di iframe)
function showConfirmationModal(title, message, onConfirm) {
    const modal = $(`
        <div class="confirmation-modal-overlay fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-700/50 shadow-2xl">
            <div class="flex items-start gap-4 mb-4">
              <div class="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <i data-lucide="alert-circle" class="w-6 h-6 text-orange-400"></i>
              </div>
              <div>
                <h3 class="text-xl font-bold text-white">${title}</h3>
                <p class="text-slate-400 mt-2">${message}</p>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button class="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-2 rounded-lg transition-all confirm-btn">
                Ya, Matikan
              </button>
              <button class="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-bold py-2 rounded-lg transition-colors cancel-btn">
                Batal
              </button>
            </div>
          </div>
        </div>
      `);

    $('body').append(modal);
    lucide.createIcons();

    modal.find('.confirm-btn').on('click', () => {
        modal.remove();
        onConfirm();
    });

    modal.find('.cancel-btn').on('click', () => {
        modal.remove();
    });

    // Tutup modal jika diklik di luar area modal
    modal.on('click', (e) => {
        if (e.target === modal[0]) {
            modal.remove();
        }
    });
}

// ==========================================
// FUNGSI KONTROL LED
// ==========================================
// Toggle LED dengan nomor tertentu (1=Merah, 2=Hijau, 3=Biru)
function toggleLED(n) {
    // Ubah state LED
    ledStates[n] = !ledStates[n];

    // Dapatkan konfigurasi warna untuk LED ini
    const c = ledColors[n];
    const btn = $(`#led${n}-btn`);
    const ind = $(`#led${n}-indicator`);
    const st = $(`#led${n}-status`);

    if (ledStates[n]) {
        // LED ON: ubah warna indikator menjadi warna LED
        ind.attr('class', `w-4 h-4 rounded-full ${c.on} shadow-lg ${c.shadow} transition-colors`);
        st.text('ON').attr('class', 'text-sm text-emerald-400 font-medium');
        btn.addClass('active').addClass(c.border);
    } else {
        // LED OFF: kembalikan ke warna abu-abu
        ind.attr('class', 'w-4 h-4 rounded-full bg-slate-600 transition-colors');
        st.text('OFF').attr('class', 'text-sm text-slate-500');
        btn.removeClass('active').removeClass(c.border);
    }

    // Kirim status LED ke Firebase
    const deviceMap = { 1: 'ledred', 2: 'ledgreen', 3: 'ledblue' };
    sendFirebaseControl(deviceMap[n], ledStates[n]);

    // Update counter aktuator aktif
    updateActiveActuators();
}

// ==========================================
// FUNGSI KONTROL LAMPU
// ==========================================
// Toggle Lampu Utama ON/OFF
function toggleLamp() {
    lampState = !lampState;
    const btn = $('#lamp-btn');
    const ind = $('#lamp-indicator');
    const st = $('#lamp-status');
    const ic = $('#lamp-icon');

    if (lampState) {
        // Lampu ON
        ind.attr('class', 'w-6 h-6 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50 transition-colors flex items-center justify-center');
        ic.attr('class', 'w-4 h-4 text-yellow-900');
        st.text('ON').attr('class', 'text-sm text-yellow-400 font-medium');
        btn.addClass('active').addClass('border-yellow-400');
    } else {
        // Lampu OFF
        ind.attr('class', 'w-6 h-6 rounded-full bg-slate-600 transition-colors flex items-center justify-center');
        ic.attr('class', 'w-4 h-4 text-slate-400');
        st.text('OFF').attr('class', 'text-sm text-slate-500');
        btn.removeClass('active').removeClass('border-yellow-400');
    }

    // Kirim status lampu ke Firebase
    sendFirebaseControl('relay', lampState);
    updateActiveActuators();
}

// ==========================================
// FUNGSI KONTROL PENYIRAMAN MANUAL
// ==========================================
// Aktivasi penyiraman manual (hanya bisa saat tanah kering dan tidak dalam cooldown)
function toggleManualWater() {
    // Cek apakah masih dalam periode cooldown
    if (wateringCooldown > 0) {
        return;
    }

    // Cek kondisi tanah - hanya bisa siram jika tanah KERING
    const soilCondition = $('#soil-condition').text();
    if (soilCondition !== 'Kering') {
        return;
    }

    // Aktifkan penyiraman manual dan matikan otomatis
    manualWaterState = true;
    autoWaterState = false;
    updateWaterButtonStates();

    // Update statistik penyiraman
    lastWateringDuration = 30;
    totalWateringCount++;
    $('#total-watering').text(totalWateringCount + ' Kali');
    $('#last-watering-duration').text(lastWateringDuration + ' detik');
    $('#watering-mode').text('Manual - Aktif');
    updateActiveActuators();

    // Nyalakan pompa di Firebase
    sendFirebaseControl('pompa', true);

    // Mulai timer cooldown (30 detik)
    wateringCooldown = 30;
    startCooldownTimer();
}

// ==========================================
// FUNGSI TIMER COOLDOWN PENYIRAMAN
// ==========================================
// Mulai countdown timer cooldown (mencegah penyiraman berulang cepat)
function startCooldownTimer() {
    // Jika sudah ada timer yang berjalan, hentikan dulu
    if (cooldownInterval) clearInterval(cooldownInterval);

    // Countdown setiap 1 detik
    cooldownInterval = setInterval(function () {
        wateringCooldown--;
        const btn = $('#manual-water-btn');
        const st = $('#manual-water-status');

        if (wateringCooldown > 0) {
            // Tampilkan status cooldown dan disable tombol
            btn.prop('disabled', true).css('opacity', '0.5').css('cursor', 'not-allowed');
            st.text('Cooldown: ' + wateringCooldown + 's').attr('class', 'text-sm text-orange-400 font-medium');
        } else {
            // Cooldown selesai - siapkan untuk penyiraman berikutnya
            wateringCooldown = 0;
            manualWaterState = false;

            // Matikan pompa saat cooldown selesai
            sendFirebaseControl('pompa', false);

            updateWaterButtonStates();
            btn.prop('disabled', false).css('opacity', '1').css('cursor', 'pointer');
            clearInterval(cooldownInterval);
            cooldownInterval = null;
        }
    }, 1000);
}

// ==========================================
// FUNGSI KONTROL PENYIRAMAN OTOMATIS
// ==========================================
// Toggle Siram Otomatis (sistem akan menjaga kadar air secara otomatis)
function toggleAutoWater() {
    if (autoWaterState) {
        // Jika sudah aktif, tampilkan modal konfirmasi sebelum matikan
        showConfirmationModal('Matikan Siram Otomatis?', 'Apakah Anda yakin ingin mematikan sistem penyiraman otomatis?', () => {
            autoWaterState = false;
            manualWaterState = false;
            updateWaterButtonStates();
            $('#watering-mode').text('Mode Manual');
            updateActiveActuators();
            sendFirebaseControl('pompa', false);
        });
    } else {
        // Aktifkan penyiraman otomatis
        autoWaterState = true;
        manualWaterState = false;
        updateWaterButtonStates();
        $('#watering-mode').text('Otomatis - Aktif');
        updateActiveActuators();

        // Kirim perintah pompa berdasarkan kondisi tanah SAAT INI
        const soilResistanceText = $('#soil-resistance').text();
        const soilValue = parseFloat(soilResistanceText);

        // Jika tanah kering (resistansi >= 2300), nyalakan pompa
        if (soilValue >= 2300) {
            sendFirebaseControl('pompa', true);
        } else {
            // Jika tanah cukup lembab, matikan pompa
            sendFirebaseControl('pompa', false);
        }
    }
}

// ==========================================
// FUNGSI UPDATE STATUS TOMBOL PENYIRAMAN
// ==========================================
// Update visual tombol penyiraman manual dan otomatis
function updateWaterButtonStates() {
    const manualBtn = $('#manual-water-btn');
    const manualInd = $('#water-manual-indicator');
    const manualSt = $('#manual-water-status');

    const autoBtn = $('#auto-water-btn');
    const autoInd = $('#water-auto-indicator');
    const autoSt = $('#auto-water-status');
    const autoIcon = $('#auto-water-icon');

    // Update visual tombol SIRAM MANUAL
    if (manualWaterState) {
        manualInd.attr('class', 'w-4 h-4 rounded-full bg-teal-500 shadow-lg shadow-teal-500/50 transition-colors');
        manualSt.text('ON').attr('class', 'text-sm text-emerald-400 font-medium');
        manualBtn.addClass('active').addClass('border-teal-400').addClass('bg-gradient-to-r').addClass('from-teal-600/20').addClass('to-emerald-600/20');
    } else {
        manualInd.attr('class', 'w-4 h-4 rounded-full bg-slate-600 transition-colors');
        manualSt.text('OFF').attr('class', 'text-sm text-slate-500');
        manualBtn.removeClass('active').removeClass('border-teal-400').removeClass('bg-gradient-to-r').removeClass('from-teal-600/20').removeClass('to-emerald-600/20');
    }

    // Update visual tombol SIRAM OTOMATIS
    if (autoWaterState) {
        autoInd.attr('class', 'w-5 h-5 rounded-full bg-teal-400 shadow-lg shadow-teal-400/50 transition-colors flex items-center justify-center');
        autoIcon.attr('class', 'w-3 h-3 text-teal-900');
        autoSt.text('ON').attr('class', 'text-sm text-teal-400 font-medium');
        autoBtn.addClass('active').addClass('border-teal-400').addClass('bg-gradient-to-r').addClass('from-teal-600/20').addClass('to-emerald-600/20');
    } else {
        autoInd.attr('class', 'w-5 h-5 rounded-full bg-slate-600 transition-colors flex items-center justify-center');
        autoIcon.attr('class', 'w-3 h-3 text-slate-400');
        autoSt.text('OFF').attr('class', 'text-sm text-slate-500');
        autoBtn.removeClass('active').removeClass('border-teal-400').removeClass('bg-gradient-to-r').removeClass('from-teal-600/20').removeClass('to-emerald-600/20');
    }

    // Jika kedua mode OFF, tampilkan "Mode Manual"
    if (!manualWaterState && !autoWaterState) {
        $('#watering-mode').text('Mode Manual');
    }
}

// ==========================================
// FUNGSI UPDATE COUNTER AKTUATOR AKTIF
// ==========================================
// Hitung dan update jumlah aktuator yang sedang aktif
function updateActiveActuators() {
    const c = Object.values(ledStates).filter(v => v).length +
        (lampState ? 1 : 0) +
        (manualWaterState ? 1 : 0) +
        (autoWaterState ? 1 : 0);
    $('#active-actuators').text(c);
}

// ==========================================
// FUNGSI KIRIM KONTROL KE FIREBASE
// ==========================================
// Kirim perintah kontrol ke Firebase Database
// device: nama perangkat (ledred, ledgreen, ledblue, relay, pompa)
// state: true (ON/1) atau false (OFF/0)
function sendFirebaseControl(device, state) {
    if (window.firebaseDB) {
        const { ref, set, database } = window.firebaseDB;
        const value = state ? 1 : 0;
        set(ref(database, `kontrol/${device}`), value).catch(e => console.error(`Error sending ${device}:`, e));
    }
}

// ==========================================
// FUNGSI UPDATE WAKTU TERAKHIR UPDATE
// ==========================================
// Update waktu terakhir sistem update (ditampilkan di header)
function updateLastUpdate() {
    const n = new Date();
    $('#last-update').text(n.toLocaleTimeString('id-ID'));
}

// ==========================================
// FUNGSI DENGARKAN DATA FIREBASE REAL-TIME
// ==========================================
// Setup listener untuk semua sensor dan kontrol di Firebase
function listenToFirebaseData() {
    if (window.firebaseDB) {
        const { ref, onValue, database } = window.firebaseDB;

        // ========== SENSOR SUHU ==========
        onValue(ref(database, 'sensor/suhu'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) {
                $('#temp-value').text(value);
                const ts = value > 30 ? 'Panas' : value < 20 ? 'Dingin' : 'Normal';
                $('#temp-status').text(ts);
            }
        });

        // ========== SENSOR KELEMBAPAN UDARA ==========
        onValue(ref(database, 'sensor/lembab'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) {
                $('#humidity-value').text(value);
                const hs = value > 80 ? 'Tinggi' : value < 60 ? 'Rendah' : 'Baik';
                $('#humidity-status').text(hs);
            }
        });

        // ========== SENSOR KELEMBAPAN TANAH ==========
        onValue(ref(database, 'sensor/soil'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) {
                $('#soil-resistance').text(value + ' Ω');
                const sc = value > 2300 ? 'Kering' : 'Basah';
                $('#soil-condition').text(sc);

                // Hitung persentase resistansi untuk progress bar
                let rp = Math.floor((value / 2800) * 100);
                rp = Math.max(0, Math.min(100, rp));
                $('#soil-resistance-bar').css('width', rp + '%');

                // Kontrol siram otomatis: jika mode otomatis aktif, cek kondisi tanah
                if (autoWaterState) {
                    if (value < 2300) {
                        // Tanah sudah cukup lembab, matikan pompa
                        sendFirebaseControl('pompa', false);
                    } else if (value >= 2300) {
                        // Tanah kering, nyalakan pompa
                        sendFirebaseControl('pompa', true);
                    }
                }
            }
        });

        // ========== SENSOR CAHAYA (LDR 1-4) ==========
        onValue(ref(database, 'sensor/ldr1'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) $('#ldr-1').text(value);
        });

        onValue(ref(database, 'sensor/ldr2'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) $('#ldr-2').text(value);
        });

        onValue(ref(database, 'sensor/ldr3'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) $('#ldr-3').text(value);
        });

        onValue(ref(database, 'sensor/ldr4'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) $('#ldr-4').text(value);
        });

        // ========== SENSOR SERVO HORIZONTAL ==========
        onValue(ref(database, 'sensor/servoH'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) {
                servoHPos = value;
                $('#servo-h-arm').css('transform', `rotateZ(${servoHPos}deg)`);
                $('#servo-h-pos').text(servoHPos);
            }
        });

        // ========== SENSOR SERVO VERTIKAL ==========
        onValue(ref(database, 'sensor/servoV'), (snapshot) => {
            const value = snapshot.val();
            if (value !== null) {
                servoVPos = value;
                $('#servo-v-arm').css('transform', `rotateZ(${servoVPos}deg)`);
                $('#servo-v-pos').text(servoVPos);
            }
        });

        // ========== SENSOR JARAK (KETINGGIAN AIR) ==========
        // Konversi jarak sensor ke tinggi air
        // Rumus: tinggiAir = maxHeight - nilaiJarak
        onValue(ref(database, 'sensor/jarak'), (snapshot) => {
            const sensorDistance = snapshot.val();
            if (sensorDistance !== null) {
                // Konversi: jika sensor di atas tangki setinggi maxHeight
                // Jarak sensor ke air = maxHeight - tinggi air
                // Maka: tinggi air = maxHeight - jarak
                const maxHeight = tankConfig.tank_height;
                const waterHeight = Math.max(0, maxHeight - sensorDistance);
                updateWaterDisplay(Math.min(waterHeight, maxHeight));
            }
        });

        // ========== FEEDBACK KONTROL LED MERAH ==========
        onValue(ref(database, 'kontrol/ledred'), (snapshot) => {
            const value = snapshot.val();
            if (value === 1 && !ledStates[1]) toggleLED(1);
            else if (value === 0 && ledStates[1]) toggleLED(1);
        });

        // ========== FEEDBACK KONTROL LED HIJAU ==========
        onValue(ref(database, 'kontrol/ledgreen'), (snapshot) => {
            const value = snapshot.val();
            if (value === 1 && !ledStates[2]) toggleLED(2);
            else if (value === 0 && ledStates[2]) toggleLED(2);
        });

        // ========== FEEDBACK KONTROL LED BIRU ==========
        onValue(ref(database, 'kontrol/ledblue'), (snapshot) => {
            const value = snapshot.val();
            if (value === 1 && !ledStates[3]) toggleLED(3);
            else if (value === 0 && ledStates[3]) toggleLED(3);
        });

        // ========== FEEDBACK KONTROL LAMPU UTAMA ==========
        onValue(ref(database, 'kontrol/relay'), (snapshot) => {
            const value = snapshot.val();
            if (value === 1 && !lampState) toggleLamp();
            else if (value === 0 && lampState) toggleLamp();
        });
    }
}

// ==========================================
// FUNGSI UPDATE SENSOR UI (ALTERNATIF)
// ==========================================
// Fungsi backup untuk update UI sensor (tidak digunakan jika Firebase aktif)
function updateSensorUI(d) {
    const sc = d.soilResistance > 600 ? 'Kering' : d.soilResistance > 400 ? 'Lembab' : 'Sangat Lembab';
    $('#soil-condition').text(sc);
    $('#soil-resistance').text(d.soilResistance + ' Ω');
    const rp = Math.floor((d.soilResistance / 900) * 100);
    $('#soil-resistance-bar').css('width', rp + '%');

    $('#ldr-1').text(d.ldr1);
    $('#ldr-2').text(d.ldr2);
    $('#ldr-3').text(d.ldr3);
    $('#ldr-4').text(d.ldr4);

    const ts = d.temperature > 30 ? 'Panas' : d.temperature < 20 ? 'Dingin' : 'Normal';
    $('#temp-value').text(d.temperature);
    $('#temp-status').text(ts);

    const hs = d.humidity > 80 ? 'Tinggi' : d.humidity < 60 ? 'Rendah' : 'Baik';
    $('#humidity-value').text(d.humidity);
    $('#humidity-status').text(hs);

    servoHPos = d.servoHorizontal;
    $('#servo-h-arm').css('transform', `rotateZ(${servoHPos}deg)`);
    $('#servo-h-pos').text(servoHPos);

    servoVPos = d.servoVertical;
    $('#servo-v-arm').css('transform', `rotateZ(${servoVPos}deg)`);
    $('#servo-v-pos').text(servoVPos);

    const capacity = calculateTankCapacity();
    const wp = Math.floor((d.waterVolume / capacity) * 100);
    $('#water-height').text(d.waterHeight);
    $('#water-volume').text(d.waterVolume);
    $('#water-volume-ml').text((d.waterVolume * 1000).toLocaleString('id-ID'));
    $('#water-fill').css('height', wp + '%');
    $('#water-level-percent').text(wp + '%');

    const ws = wp > 70 ? 'Penuh' : wp > 30 ? 'Cukup' : 'Rendah';
    const wse = $('#water-status');
    wse.text(ws).attr('class', `text-lg font-bold ${wp > 30 ? 'text-emerald-400' : 'text-red-400'}`);

    // Kontrol penyiraman otomatis berdasarkan threshold
    if (autoWaterState && wp <= parseInt(window.elementSdk?.config?.auto_water_threshold || defaultConfig.auto_water_threshold)) {
        if (!manualWaterState) {
            lastWateringDuration = 20;
            totalWateringCount++;
            $('#total-watering').text(totalWateringCount + ' Kali');
            $('#last-watering-duration').text(lastWateringDuration + ' detik');
        }
    }

    updateLastUpdate();
}

// ==========================================
// FUNGSI REFRESH DATA
// ==========================================
// Refresh data secara manual (update timestamp terakhir)
function refreshData() {
    updateLastUpdate();
}

// ==========================================
// FUNGSI MODAL KONFIGURASI TANGKI
// ==========================================
// Buka modal untuk konfigurasi tangki air
function openTankModal() {
    $('#tank-modal').removeClass('hidden');
    lucide.createIcons();
}

// Tutup modal konfigurasi tangki
function closeTankModal() {
    $('#tank-modal').addClass('hidden');
}

// Update display kapasitas tangki saat user mengubah dimensi
function updateCapacityDisplay() {
    const shape = $('#tank-shape-select').val();
    let capacity = 0;

    if (shape === 'kubus') {
        const length = parseFloat($('#tank-length').val()) || 0;
        const width = parseFloat($('#tank-width').val()) || 0;
        const height = parseFloat($('#tank-height').val()) || 0;
        capacity = (length * width * height) / 1000;
    } else {
        const radius = parseFloat($('#tank-radius').val()) || 0;
        const height = parseFloat($('#tank-height').val()) || 0;
        capacity = (Math.PI * Math.pow(radius, 2) * height) / 1000;
    }
    $('#capacity-display').text(capacity.toFixed(1) + ' L');
}

// Toggle tampilan field input berdasarkan bentuk tangki dipilih
function toggleTankShapeFields() {
    const shape = $('#tank-shape-select').val();
    $('#kubus-fields').toggleClass('hidden', shape !== 'kubus');
    $('#tabung-fields').toggleClass('hidden', shape !== 'tabung');
    updateCapacityDisplay();
}

// Simpan konfigurasi tangki dan update dashboard
function saveTankConfig() {
    const shape = $('#tank-shape-select').val();
    tankConfig.tank_shape = shape;
    tankConfig.tank_height = parseFloat($('#tank-height').val());

    if (shape === 'kubus') {
        tankConfig.tank_length = parseFloat($('#tank-length').val());
        tankConfig.tank_width = parseFloat($('#tank-width').val());
    } else {
        tankConfig.tank_length = parseFloat($('#tank-radius').val());
    }

    const capacity = calculateTankCapacity();
    $('#tank-capacity').text(capacity.toFixed(1));
    closeTankModal();

    // Update config di Element SDK jika tersedia
    if (window.elementSdk) {
        window.elementSdk.setConfig({
            tank_shape: shape,
            tank_length: tankConfig.tank_length,
            tank_width: tankConfig.tank_width,
            tank_height: tankConfig.tank_height
        });
    }

    // Update tampilan tangki dengan ketinggian air saat ini
    const currentHeight = parseFloat($('#water-height').text()) || 0;
    updateWaterDisplay(currentHeight);
}

// ==========================================
// FUNGSI INISIALISASI APLIKASI
// ==========================================
// Inisialisasi Element SDK (untuk edit panel di Canva)
async function initApp() {
    if (window.elementSdk) {
        await window.elementSdk.init({
            defaultConfig,
            onConfigChange: async (cfg) => {
                // Update judul dashboard
                $('#dashboard-title').text(cfg.dashboard_title || defaultConfig.dashboard_title);

                // Update nama lokasi
                $('#location-name').text(cfg.location_name || defaultConfig.location_name);

                // Update konfigurasi tangki jika ada perubahan
                if (cfg.tank_shape) {
                    tankConfig.tank_shape = cfg.tank_shape;
                    tankConfig.tank_length = cfg.tank_length || defaultConfig.tank_length;
                    tankConfig.tank_width = cfg.tank_width || defaultConfig.tank_width;
                    tankConfig.tank_height = cfg.tank_height || defaultConfig.tank_height;
                    const capacity = calculateTankCapacity();
                    $('#tank-capacity').text(capacity.toFixed(1));
                }
            },
            mapToCapabilities: (cfg) => ({
                recolorables: [
                    { get: () => cfg.primary_color || defaultConfig.primary_color, set: (v) => window.elementSdk.setConfig({ primary_color: v }) },
                    { get: () => cfg.secondary_color || defaultConfig.secondary_color, set: (v) => window.elementSdk.setConfig({ secondary_color: v }) },
                    { get: () => cfg.text_color || defaultConfig.text_color, set: (v) => window.elementSdk.setConfig({ text_color: v }) },
                    { get: () => cfg.accent_color || defaultConfig.accent_color, set: (v) => window.elementSdk.setConfig({ accent_color: v }) },
                    { get: () => cfg.surface_color || defaultConfig.surface_color, set: (v) => window.elementSdk.setConfig({ surface_color: v }) }
                ],
                borderables: [],
                fontEditable: undefined,
                fontSizeable: undefined
            }),
            mapToEditPanelValues: (cfg) => new Map([
                ['dashboard_title', cfg.dashboard_title || defaultConfig.dashboard_title],
                ['location_name', cfg.location_name || defaultConfig.location_name],
                ['auto_water_threshold', cfg.auto_water_threshold || defaultConfig.auto_water_threshold],
                ['tank_shape', cfg.tank_shape || defaultConfig.tank_shape],
                ['tank_length', cfg.tank_length || defaultConfig.tank_length],
                ['tank_width', cfg.tank_width || defaultConfig.tank_width],
                ['tank_height', cfg.tank_height || defaultConfig.tank_height]
            ])
        });
    }
}

// ==========================================
// SETUP AWAL - DOCUMENT READY
// ==========================================
$(document).ready(function () {
    // Initialize Lucide icons
    lucide.createIcons();

    // Mulai mendengarkan data real-time dari Firebase
    listenToFirebaseData();

    // Inisialisasi aplikasi dan Element SDK
    initApp();

    // Update waktu setiap 1 detik
    setInterval(updateLastUpdate, 1000);
});