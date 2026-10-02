let current = null;
let lastResultText = "";
let stream = null;
let translatedText = "";

function show(id) {
  document.querySelectorAll("main>section").forEach(x => x.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fileData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function post(url, data) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const j = await r.json();

  if (!r.ok) {
    throw new Error(j.error || "Request failed");
  }

  return j;
}

function val(x) {
  return x == null ? "" : x;
}

async function analyzeRx() {
  const s = document.getElementById("rxStatus");
  s.textContent = "Gemini is reading the prescription…";

  try {
    let image = null;
    const f = document.getElementById("rxFile").files[0];

    if (f) {
      image = await fileData(f);
    }

    const j = await post("/api/prescription/analyze", {
      text: document.getElementById("rxText").value,
      image
    });

    ["Name", "Strength", "Quantity", "Instructions", "Follow"].forEach(k => {
      document.getElementById("r" + k).value = val(
        j[
          {
            Name: "name",
            Strength: "strength",
            Quantity: "quantity",
            Instructions: "instructions",
            Follow: "follow_up"
          }[k]
        ]
      );
    });

    document.getElementById("rTimes").value = (j.times || []).join(", ");

    show("review");

  } catch (e) {
    s.textContent = "Error: " + e.message;
  }
}

async function confirmRx() {
  const obj = {
    name: rName.value || null,
    strength: rStrength.value || null,
    quantity: rQuantity.value || null,
    instructions: rInstructions.value || null,
    times: rTimes.value
      .split(",")
      .map(x => x.trim())
      .filter(Boolean),
    follow_up: rFollow.value || null,
    language: language.value
  };

  try {
    current = await post("/api/prescription/confirm", obj);

    translatedText = "";
    translation.textContent = "";

    renderDashboard();
    show("dashboard");

  } catch (e) {
    alert(e.message);
  }
}

function renderDashboard() {
  dName.textContent = current.name || "Information missing";
  dStrength.textContent = current.strength || "Strength not verified";
  dInstructions.textContent =
    current.instructions || "Instructions not available";

  dTimes.textContent =
    (current.times || []).join(", ") || "Not available";

  dFollow.textContent = current.follow_up
    ? "Follow-up: " + current.follow_up
    : "";

  const dashboardLanguage =
    document.getElementById("dashboardLanguage");

  if (dashboardLanguage && document.getElementById("language")) {
    dashboardLanguage.value =
      document.getElementById("language").value;
  }
}


/* =========================================
   TEXT TO SPEECH
========================================= */

const languageCodes = {
  "English": "en-US",
  "Nepali": "ne-NP",
  "Hindi": "hi-IN",
  "Spanish": "es-ES",
  "Chinese Simplified": "zh-CN",
  "Chinese Traditional": "zh-TW",
  "Arabic": "ar-SA",
  "Bengali": "bn-BD",
  "Portuguese": "pt-PT",
  "Russian": "ru-RU",
  "Japanese": "ja-JP",
  "Punjabi": "pa-IN",
  "German": "de-DE",
  "French": "fr-FR",
  "Urdu": "ur-PK",
  "Indonesian": "id-ID",
  "Italian": "it-IT",
  "Marathi": "mr-IN",
  "Telugu": "te-IN",
  "Turkish": "tr-TR",
  "Tamil": "ta-IN",
  "Vietnamese": "vi-VN",
  "Korean": "ko-KR",
  "Persian": "fa-IR",
  "Gujarati": "gu-IN",
  "Polish": "pl-PL",
  "Ukrainian": "uk-UA",
  "Malayalam": "ml-IN",
  "Kannada": "kn-IN",
  "Odia": "or-IN",
  "Burmese": "my-MM",
  "Thai": "th-TH",
  "Dutch": "nl-NL",
  "Greek": "el-GR",
  "Romanian": "ro-RO",
  "Czech": "cs-CZ",
  "Hungarian": "hu-HU",
  "Swedish": "sv-SE",
  "Danish": "da-DK",
  "Finnish": "fi-FI",
  "Norwegian": "nb-NO",
  "Hebrew": "he-IL",
  "Malay": "ms-MY",
  "Filipino": "fil-PH",
  "Swahili": "sw-KE",
  "Afrikaans": "af-ZA",
  "Amharic": "am-ET",
  "Albanian": "sq-AL",
  "Armenian": "hy-AM",
  "Azerbaijani": "az-AZ",
  "Basque": "eu-ES",
  "Belarusian": "be-BY",
  "Bosnian": "bs-BA",
  "Bulgarian": "bg-BG",
  "Catalan": "ca-ES",
  "Croatian": "hr-HR",
  "Estonian": "et-EE",
  "Georgian": "ka-GE",
  "Haitian Creole": "ht-HT",
  "Hausa": "ha-NG",
  "Icelandic": "is-IS",
  "Irish": "ga-IE",
  "Javanese": "jv-ID",
  "Kazakh": "kk-KZ",
  "Khmer": "km-KH",
  "Kyrgyz": "ky-KG",
  "Lao": "lo-LA",
  "Latvian": "lv-LV",
  "Lithuanian": "lt-LT",
  "Macedonian": "mk-MK",
  "Malagasy": "mg-MG",
  "Maltese": "mt-MT",
  "Mongolian": "mn-MN",
  "Pashto": "ps-AF",
  "Serbian": "sr-RS",
  "Sinhala": "si-LK",
  "Slovak": "sk-SK",
  "Slovenian": "sl-SI",
  "Somali": "so-SO",
  "Sundanese": "su-ID",
  "Tajik": "tg-TJ",
  "Uzbek": "uz-UZ",
  "Welsh": "cy-GB",
  "Yoruba": "yo-NG",
  "Zulu": "zu-ZA",
  "Igbo": "ig-NG",
  "Galician": "gl-ES",
  "Esperanto": "eo",
  "Latin": "la",
  "Luxembourgish": "lb-LU",
  "Maori": "mi-NZ",
  "Samoan": "sm-WS",
  "Scots Gaelic": "gd-GB",
  "Shona": "sn-ZW",
  "Sindhi": "sd-PK",
  "Sesotho": "st-ZA",
  "Turkmen": "tk-TM",
  "Uyghur": "ug-CN",
  "Xhosa": "xh-ZA",
  "Kurdish": "ku"
};

function getSelectedLanguage() {
  const dashboard =
    document.getElementById("dashboardLanguage");

  if (dashboard && !dashboard.closest(".hidden")) {
    return dashboard.value;
  }

  const setup = document.getElementById("language");

  return setup ? setup.value : "English";
}

function speak(text, selectedLanguage = "English") {

  if (!("speechSynthesis" in window)) {
    alert("Text-to-speech is unavailable in this browser.");
    return;
  }

  if (!text || !text.trim()) {
    alert("There is no text to read aloud.");
    return;
  }

  speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang =
    languageCodes[selectedLanguage] || "en-US";

  utterance.rate = 0.9;
  utterance.pitch = 1;

  /*
    Try to find an installed browser/ChromeOS voice
    matching the selected language.
  */
  const voices = speechSynthesis.getVoices();

  const languagePrefix =
    utterance.lang.toLowerCase().split("-")[0];

  const matchingVoice = voices.find(v =>
    v.lang &&
    v.lang.toLowerCase().startsWith(languagePrefix)
  );

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  speechSynthesis.speak(utterance);
}

function speakCurrent() {

  const selectedLanguage =
    getSelectedLanguage();

  /*
    If Gemini has translated the explanation,
    read the translated explanation.

    Otherwise read the confirmed prescription.
  */
  const text =
    translatedText ||
    [
      current?.name,
      current?.strength,
      current?.instructions,
      (current?.times || []).join(", ")
    ]
      .filter(Boolean)
      .join(". ");

  speak(text, selectedLanguage);
}


/* =========================================
   GEMINI TRANSLATION
========================================= */

async function translateCurrent() {

  const selectedLanguage =
    getSelectedLanguage();

  /*
    Keep both language dropdowns synchronized.
  */
  const setupLanguage =
    document.getElementById("language");

  const dashboardLanguage =
    document.getElementById("dashboardLanguage");

  if (setupLanguage) {
    setupLanguage.value = selectedLanguage;
  }

  if (dashboardLanguage) {
    dashboardLanguage.value = selectedLanguage;
  }

  translation.textContent =
    "Gemini is translating…";

  try {

    const j = await post(
      "/api/translate",
      {
        language: selectedLanguage,
        medication: current
      }
    );

    translatedText =
      j.explanation || "";

    translation.textContent =
      translatedText;

  } catch (e) {

    translatedText = "";

    translation.textContent =
      "Translation error: " + e.message;
  }
}


/* =========================================
   CAMERA / MEDICATION LABEL
========================================= */

async function startCamera() {

  try {

    stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment"
          }
        },
        audio: false
      });

    video.srcObject = stream;

  } catch (e) {

    scanStatus.textContent =
      "Camera error: " + e.message;
  }
}

async function captureLabel() {

  if (!stream) {
    scanStatus.textContent =
      "Start the camera first.";
    return;
  }

  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;

  canvas
    .getContext("2d")
    .drawImage(video, 0, 0);

  await analyzeImage(
    canvas.toDataURL(
      "image/jpeg",
      0.88
    )
  );
}

async function analyzeUploadedLabel() {

  const f =
    labelFile.files[0];

  if (!f) return;

  await analyzeImage(
    await fileData(f)
  );
}

async function analyzeLabelText() {

  try {

    scanStatus.textContent =
      "Gemini is reading the demo label text…";

    const d =
      await post(
        "/api/label/analyze",
        {
          text: labelText.value
        }
      );

    await verifyDetected(d);

  } catch (e) {

    scanStatus.textContent =
      "Error: " + e.message;
  }
}

async function analyzeImage(image) {

  try {

    scanStatus.textContent =
      "Gemini is reading the label…";

    const d =
      await post(
        "/api/label/analyze",
        { image }
      );

    await verifyDetected(d);

  } catch (e) {

    scanStatus.textContent =
      "Error: " + e.message;
  }
}


/* =========================================
   DETERMINISTIC VERIFICATION
========================================= */

async function verifyDetected(d) {

  const v =
    await post(
      "/api/verify",
      {
        expected: current,
        detected: d
      }
    );

  const labels = {

    MATCH: [
      "✓ LABEL MATCH",
      "Label matches stored prescription information.",
      "match"
    ],

    MEDICINE_MISMATCH: [
      "⚠ MEDICATION MISMATCH",
      "The detected medication name does not match the stored prescription.",
      "error"
    ],

    STRENGTH_MISMATCH: [
      "⚠ STRENGTH MISMATCH",
      "The detected strength does not match the stored prescription.",
      "error"
    ],

    REVIEW_REQUIRED: [
      "⚠ REVIEW REQUIRED",
      "The strength could not be verified. Check the prescription or pharmacy label.",
      "warn"
    ],

    UNREADABLE: [
      "⚠ UNABLE TO READ LABEL",
      "Medication information could not be reliably read. Try scanning again.",
      "warn"
    ]
  };

  const a =
    labels[v.status] ||
    labels.UNREADABLE;

  lastResultText =
    `${a[0]}. ${a[1]} ` +
    `Expected ${current?.name || "unknown"} ` +
    `${current?.strength || ""}. ` +
    `Detected ${d.name || "unknown"} ` +
    `${d.strength || "strength unavailable"}.`;

  resultBox.className =
    "result " + a[2];

  resultBox.innerHTML =
    `<h2>${a[0]}</h2>` +
    `<p>${a[1]}</p>` +
    `<hr>` +
    `<p><strong>Expected</strong><br>` +
    `${current?.name || "—"} · ` +
    `${current?.strength || "—"}</p>` +
    `<p><strong>Detected</strong><br>` +
    `${d.name || "—"} · ` +
    `${d.strength || "—"}</p>`;

  show("result");
}

function speakResult() {
  speak(
    lastResultText,
    getSelectedLanguage()
  );
}
