let current=null,currentReminder=null,lastResultText="",stream=null,authMode="login",account=null,translatedText="";
let translationCache={};
let cachedVoices=[];

function loadSpeechVoices(){
  if(!("speechSynthesis" in window)) return;
  cachedVoices=speechSynthesis.getVoices();
}

loadSpeechVoices();
if("speechSynthesis" in window){
  speechSynthesis.onvoiceschanged=loadSpeechVoices;
}

async function prepareTranslation(){
  if(!current) return;

  const languageName=getSelectedLanguage();

  if(languageName==="English"){
    translatedText="";
    return;
  }

  const key=languageName+"|"+JSON.stringify(current);

  if(translationCache[key]){
    translatedText=translationCache[key];
    return;
  }

  try{
    const j=await post("/api/translate",{
      language:languageName,
      medication:current
    });

    if(j.explanation){
      translationCache[key]=j.explanation;
      translatedText=j.explanation;
    }
  }catch(e){
    console.log("Background translation unavailable:",e.message);
  }
}

const medGuideLanguages = [
["English","en"],["Nepali","ne"],["Hindi","hi"],["Spanish","es"],
["Chinese (Simplified)","zh-CN"],["Chinese (Traditional)","zh-TW"],
["Arabic","ar"],["Bengali","bn"],["Portuguese","pt"],["Russian","ru"],
["Japanese","ja"],["Korean","ko"],["French","fr"],["German","de"],
["Italian","it"],["Dutch","nl"],["Turkish","tr"],["Vietnamese","vi"],
["Thai","th"],["Indonesian","id"],["Malay","ms"],["Urdu","ur"],
["Punjabi","pa"],["Gujarati","gu"],["Marathi","mr"],["Tamil","ta"],
["Telugu","te"],["Kannada","kn"],["Malayalam","ml"],["Sinhala","si"],
["Persian","fa"],["Hebrew","he"],["Greek","el"],["Polish","pl"],
["Ukrainian","uk"],["Romanian","ro"],["Hungarian","hu"],["Czech","cs"],
["Slovak","sk"],["Bulgarian","bg"],["Serbian","sr"],["Croatian","hr"],
["Bosnian","bs"],["Slovenian","sl"],["Albanian","sq"],["Macedonian","mk"],
["Swedish","sv"],["Norwegian","no"],["Danish","da"],["Finnish","fi"],
["Icelandic","is"],["Estonian","et"],["Latvian","lv"],["Lithuanian","lt"],
["Irish","ga"],["Welsh","cy"],["Catalan","ca"],["Basque","eu"],
["Galician","gl"],["Afrikaans","af"],["Swahili","sw"],["Somali","so"],
["Amharic","am"],["Hausa","ha"],["Yoruba","yo"],["Igbo","ig"],
["Zulu","zu"],["Xhosa","xh"],["Filipino","fil"],["Burmese","my"],
["Khmer","km"],["Lao","lo"],["Mongolian","mn"],["Kazakh","kk"],
["Uzbek","uz"],["Azerbaijani","az"],["Armenian","hy"],["Georgian","ka"],
["Pashto","ps"],["Kurdish","ku"],["Tajik","tg"],["Kyrgyz","ky"],
["Maori","mi"],["Samoan","sm"],["Hawaiian","haw"],["Haitian Creole","ht"],
["Esperanto","eo"],["Latin","la"],["Luxembourgish","lb"],["Maltese","mt"],
["Belarusian","be"],["Moldovan / Romanian","ro-MD"],["Javanese","jv"],
["Sundanese","su"],["Cebuano","ceb"],["Malagasy","mg"],["Shona","sn"],
["Sesotho","st"],["Kinyarwanda","rw"],["Odia","or"],["Assamese","as"]
];

function populateLanguageSelectors(){
 const setup=document.getElementById("language");
 const dash=document.getElementById("dashboardLanguage");

 [setup,dash].forEach(select=>{
  if(!select)return;
  select.innerHTML="";
  medGuideLanguages.forEach(([name,code])=>{
   const option=document.createElement("option");
   option.value=name;
   option.textContent=name;
   option.dataset.lang=code;
   select.appendChild(option);
  });
 });

 if(setup)setup.value="English";
 if(dash)dash.value=setup?.value||"English";

 setup?.addEventListener("change",()=>{
  if(dash)dash.value=setup.value;
  translatedText="";
 });

 dash?.addEventListener("change",()=>{
  if(setup)setup.value=dash.value;
  translatedText="";
 });
}

function getSelectedLanguage(){
 const dash=document.getElementById("dashboardLanguage");
 const setup=document.getElementById("language");
 return dash?.value || setup?.value || "English";
}

function getLanguageCode(languageName){
 const found=medGuideLanguages.find(([name])=>name===languageName);
 return found ? found[1] : "en";
}

const demoPrescription={name:"Metformin",strength:"500 mg",quantity:"1 tablet",instructions:"Take 1 tablet at 8 AM and 1 tablet at 8 PM.",times:["08:00","20:00"],follow_up:"2026-10-20"};
function show(id){
 if(id!=="scanner" && typeof stopLiveScan==="function"){
   stopLiveScan(true);
 }

 document.querySelectorAll("main>section").forEach(
   x=>x.classList.add("hidden")
 );

 const target=document.getElementById(id);

 if(target){
   target.classList.remove("hidden");
 }

 window.scrollTo({
   top:0,
   behavior:"smooth"
 });
}
function openLogin(){
 if(account){show("dashboard");return;}
 authMode="login";authTitle.textContent="Welcome back";authSubmit.textContent="Sign in";authPassword.autocomplete="current-password";authModeToggle.textContent="New here? Create an account";authStatus.textContent="";show("auth");
}
let carouselIndex=0;
function goToSlide(index){
 const slides=Array.from(carouselTrack.children),dots=document.querySelectorAll(".carousel-dot");
 carouselIndex=(index+slides.length)%slides.length;
 carouselTrack.style.transform=`translateX(-${carouselIndex*100}%)`;
 slides.forEach((slide,i)=>{slide.setAttribute("aria-hidden",i===carouselIndex?"false":"true");});
 dots.forEach((dot,i)=>{if(i===carouselIndex){dot.classList.add("active");dot.setAttribute("aria-current","true");}else{dot.classList.remove("active");dot.removeAttribute("aria-current");}});
}
function moveCarousel(direction){goToSlide(carouselIndex+direction);}
function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
async function post(url,data){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Object.assign(new Error(j.error||"Request failed"),{status:r.status});return j;}
async function get(url){const r=await fetch(url);const j=await r.json();if(!r.ok)throw Object.assign(new Error(j.error||"Request failed"),{status:r.status});return j;}
function toggleAuthMode(){
 authMode=authMode==="login"?"register":"login";
 const registering=authMode==="register";
 authTitle.textContent=registering?"Create your account":"Welcome back";
 authSubmit.textContent=registering?"Create account":"Sign in";
 authPassword.autocomplete=registering?"new-password":"current-password";
 authModeToggle.textContent=registering?"Already have an account? Sign in":"New here? Create an account";
 authStatus.textContent="";
}
function setAccount(user){
 account=user;accountEmail.textContent=user.email;accountEmail.classList.remove("hidden");logoutButton.classList.remove("hidden");loginButton.classList.add("hidden");dashboardNav.classList.remove("hidden");
}
async function loadDashboard(){
 const user=await get("/api/auth/me");setAccount(user);
 const result=await get("/api/medications/current");current=result.medication;currentReminder=result.reminder;
 renderDashboard();show("dashboard");
}
authForm.addEventListener("submit",async event=>{
 event.preventDefault();authStatus.textContent="";authSubmit.disabled=true;
 try{
  const result=await post(authMode==="register"?"/api/auth/register":"/api/auth/login",{email:authEmail.value,password:authPassword.value});
  setAccount(result);const saved=await get("/api/medications/current");current=saved.medication;currentReminder=saved.reminder;renderDashboard();show("dashboard");authForm.reset();
 }catch(error){authStatus.textContent=error.message;}
 finally{authSubmit.disabled=false;}
});
async function logout(){
 try{await post("/api/auth/logout",{});}catch(error){authStatus.textContent=error.message;return;}
 current=null;currentReminder=null;account=null;accountEmail.classList.add("hidden");logoutButton.classList.add("hidden");loginButton.classList.remove("hidden");dashboardNav.classList.add("hidden");authForm.reset();show("home");
}
async function initializeApp(){
 goToSlide(0);
 try{await loadDashboard();}catch(error){show("home");if(error.status!==401)authStatus.textContent="Could not check your sign-in right now. Please try again.";}
}
function val(x){return x==null?"":x}
function dateInputValue(value){
 if(!value)return "";
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?"":`${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth()+1).padStart(2,"0")}-${String(parsed.getUTCDate()).padStart(2,"0")}`;
}
function fillReview(medication){
 rName.value=val(medication.name);rStrength.value=val(medication.strength);rQuantity.value=val(medication.quantity);
 rInstructions.value=val(medication.instructions);rTimes.value=(medication.times||[]).join(", ");rFollow.value=dateInputValue(medication.follow_up);
 reminderConsent.checked=false;reminderPhone.value="";reminderTime.value="";toggleReminderSettings();
}
function toggleReminderSettings(){
 const enabled=reminderConsent.checked;reminderSettings.classList.toggle("hidden",!enabled);
 reminderPhone.required=enabled;reminderTime.required=enabled;rFollow.required=enabled;
 reminderTimezone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
 reminderTimezoneLabel.textContent=`Detected timezone: ${reminderTimezone.value}`;
}
function continueWithDemoPrescription(){
 fillReview(demoPrescription);
 reviewTitle.textContent="Review demo details before saving";
 reviewDescription.textContent="These sample details are prefilled without Gemini analysis. Review and edit them before confirming.";
 show("review");
}
async function analyzeRx(){
 const s=document.getElementById("rxStatus");s.textContent="Gemini is reading the prescription…";
 try{let image=null,f=document.getElementById("rxFile").files[0];if(f)image=await fileData(f);
 const j=await post("/api/prescription/analyze",{text:document.getElementById("rxText").value,image});
 fillReview(j);
 reviewTitle.textContent="Review before saving";
 reviewDescription.textContent="Gemini analyzed your source. Review and edit the extracted details before confirming.";
 show("review");}
 catch(e){s.textContent="Error: "+e.message;}
}
async function confirmRx(){
 if(reminderConsent.checked&&(!rFollow.reportValidity()||!reminderPhone.reportValidity()||!reminderTime.reportValidity()))return;
 const obj={name:rName.value||null,strength:rStrength.value||null,quantity:rQuantity.value||null,instructions:rInstructions.value||null,times:rTimes.value.split(",").map(x=>x.trim()).filter(Boolean),follow_up:rFollow.value||null,language:getSelectedLanguage(),reminder_consent:reminderConsent.checked,phone_number:reminderPhone.value.trim(),reminder_time:reminderTime.value,timezone:reminderTimezone.value};
 confirmStatus.textContent="";
 try{const result=await post("/api/prescription/confirm",obj);current=result.medication;currentReminder=result.reminder;renderDashboard();show("dashboard");}catch(e){confirmStatus.textContent="Could not save the prescription: "+e.message;}
}
function renderDashboard(){
 translatedText="";
 const translationBox=document.getElementById("translation");
 if(translationBox)translationBox.textContent="";
 const hasMedication=Boolean(current);
 dashboardEmpty.classList.toggle("hidden",hasMedication);dashboardRecord.classList.toggle("hidden",!hasMedication);
 if(!hasMedication)return;
 dName.textContent=current.name||"Information missing";dStrength.textContent=current.strength||"Strength not verified";dInstructions.textContent=current.instructions||"Instructions not available";dTimes.textContent=(current.times||[]).join(", ")||"Not available";dFollow.textContent=current.follow_up?"Follow-up: "+current.follow_up:"";
 renderReminderStatus();
}
function renderReminderStatus(){
 const reminder=currentReminder||{status:"not_requested"},messages={scheduled:"SMS reminder scheduled one day before the follow-up. It includes the written prescription instructions.",sent:"Your follow-up SMS reminder was sent.",not_configured:"SMS reminder was not scheduled because Twilio is not configured.",not_requested:"No SMS reminder requested.",not_scheduled:reminder.message||"SMS reminder was not scheduled.",too_late:reminder.message||"The selected reminder time has passed; no SMS was scheduled.",failed:reminder.message||"The SMS reminder could not be scheduled.",missed:"The scheduled reminder time passed while the app was unavailable. No SMS was sent."};
 let text=messages[reminder.status]||"SMS reminder status unavailable.";
 if(reminder.status==="scheduled"&&reminder.scheduled_for){const when=new Date(reminder.scheduled_for);text+=` Scheduled for ${new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short",timeZone:reminder.timezone}).format(when)} (${reminder.timezone}).`;}
 dReminder.textContent=text;
}
function speak(text, languageName="English"){
 if(!("speechSynthesis" in window)){
   alert("Text-to-speech is unavailable in this browser.");
   return;
 }

 if(!text)return;

 speechSynthesis.cancel();

 const utterance=new SpeechSynthesisUtterance(text);
 const code=getLanguageCode(languageName);

 utterance.lang=code;
 utterance.rate=1.05;
 utterance.pitch=1;
 utterance.volume=1;

 const voices=
   cachedVoices.length
   ? cachedVoices
   : speechSynthesis.getVoices();

 const prefix=code.toLowerCase().split("-")[0];

 const voice=
   voices.find(v=>v.lang.toLowerCase()===code.toLowerCase()) ||
   voices.find(v=>v.lang.toLowerCase().startsWith(prefix));

 if(voice){
   utterance.voice=voice;
 }

 speechSynthesis.speak(utterance);
}

function speakCurrent(){
 const original=[
  current?.name,
  current?.strength,
  current?.instructions,
  (current?.times||[]).join(", ")
 ].filter(Boolean).join(". ");

 const text=translatedText || original;
 const lang=translatedText ? getSelectedLanguage() : "English";

 speak(text,lang);
}

async function translateCurrent(){
 const languageName=getSelectedLanguage();
 translation.textContent="Creating explanation…";

 try{
  const j=await post("/api/translate",{
   language:languageName,
   medication:current
  });

  translatedText=j.explanation||"";
  if(translatedText){
    const key=languageName+"|"+JSON.stringify(current);
    translationCache[key]=translatedText;
  }
  translation.textContent=translatedText || "No explanation returned.";
 }catch(e){
  translatedText="";
  translation.textContent="Translation error: "+e.message;
 }
}
async function startCamera(){
 scanStatus.textContent="Requesting camera access…";
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access is unavailable. Upload a label photo instead.");
  if(stream)stream.getTracks().forEach(track=>track.stop());
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  video.srcObject=stream;await video.play();
  scanStatus.textContent="Camera ready. Center the label in view, then capture it.";
 }catch(e){scanStatus.textContent="Camera unavailable: "+e.message+" You can upload a photo or enter visible label details below.";showManualLabelEntry();}
}


let liveScanActive = false;
let liveScanTimer = null;
let liveScanBusy = false;
let liveScanAttempts = 0;
let liveScanFinished = false;

/*
 * Fast live scanner
 *
 * Rules:
 * 1. Only ONE Gemini request can run at a time.
 * 2. Once Gemini returns a clear medication OR clear non-medication result,
 *    scanning stops immediately.
 * 3. The camera is stopped before showing the result.
 * 4. Gemini/API errors do NOT create an infinite request loop.
 * 5. Scan Again starts a completely fresh session.
 */

const LIVE_SCAN_INTERVAL = 1200;
const LIVE_MAX_ATTEMPTS = 8;

function clearLiveScanTimer(){
    if(liveScanTimer){
        clearTimeout(liveScanTimer);
        liveScanTimer = null;
    }
}

function setLiveStatus(message){
    const el = document.getElementById("liveScanStatusText");
    const normal = document.getElementById("scanStatus");

    if(el) el.textContent = message;
    if(normal) normal.textContent = message;
}

function setLiveButtons(running){
    const startButton = document.getElementById("startCameraButton");
    const stopButton = document.getElementById("stopLiveScanButton");

    if(startButton){
        startButton.classList.toggle("hidden", running);
    }

    if(stopButton){
        stopButton.classList.toggle("hidden", !running);
    }
}

function scheduleLiveScan(delay = LIVE_SCAN_INTERVAL){
    clearLiveScanTimer();

    if(!liveScanActive || liveScanFinished){
        return;
    }

    liveScanTimer = setTimeout(runLiveScanFrame, delay);
}

async function startLiveScan(){
    if(liveScanActive) return;

    liveScanActive = true;
    liveScanBusy = false;
    liveScanFinished = false;
    liveScanAttempts = 0;

    const overlay = document.getElementById("liveScanOverlay");
    const liveStatus = document.getElementById("liveScanStatus");
    const startButton = document.getElementById("startCameraButton");
    const stopButton = document.getElementById("stopLiveScanButton");

    if(overlay) overlay.classList.remove("hidden");
    if(liveStatus) liveStatus.classList.remove("hidden");

    setLiveButtons(true);

    try{
        if(!stream){
            if(!navigator.mediaDevices?.getUserMedia){
                throw new Error("Camera access is unavailable in this browser.");
            }

            stream = await navigator.mediaDevices.getUserMedia({
                video:{
                    facingMode:{ideal:"environment"},
                    width:{ideal:1280},
                    height:{ideal:720}
                },
                audio:false
            });

            video.srcObject = stream;
        }

        await video.play();

        setLiveStatus("Camera ready — hold the medication label inside the frame.");
        scheduleLiveScan(300);

    }catch(e){
        stopLiveScan(true);
        setLiveStatus("Camera unavailable: " + e.message);
        showManualLabelEntry();
    }
}

async function runLiveScanFrame(){
    if(!liveScanActive || liveScanFinished) return;

    if(liveScanBusy){
        scheduleLiveScan(300);
        return;
    }

    if(!video.videoWidth || !video.videoHeight){
        scheduleLiveScan(500);
        return;
    }

    if(liveScanAttempts >= LIVE_MAX_ATTEMPTS){
        setLiveStatus("I couldn't read the label clearly. Move closer and try again.");
        stopLiveScan(false);
        return;
    }

    liveScanBusy = true;
    liveScanAttempts++;

    setLiveStatus(
        liveScanAttempts === 1
        ? "Reading the label…"
        : "Still reading the label…"
    );

    try{
        /*
         * Smaller image = faster upload and faster Gemini processing.
         */
        const maxWidth = 720;
        const scale = Math.min(
            1,
            maxWidth / video.videoWidth
        );

        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);

        const ctx = canvas.getContext("2d", {alpha:false});

        ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
        );

        const image = canvas.toDataURL("image/jpeg", .72);

        const detected = await post("/api/label/analyze", {image});

        /*
         * A clear name means we have enough information to stop.
         * A non-medication classification also stops.
         */
        const name = detected?.name
            ? String(detected.name).trim()
            : "";

        const strength = detected?.strength
            ? String(detected.strength).trim()
            : "";

        const confidence = detected?.confidence
            ? String(detected.confidence).toLowerCase()
            : "";

        const isMedication =
            detected?.is_medication !== false &&
            (
                name.length > 0 ||
                confidence.includes("high") ||
                confidence.includes("medium")
            );

        /*
         * IMPORTANT:
         * If Gemini has clearly identified something, STOP.
         *
         * This prevents:
         * "Metformin detected..."
         * then another scan
         * then another scan
         * then another scan.
         */
        if(name || detected?.is_medication === false){

            liveScanFinished = true;
            liveScanActive = false;
            clearLiveScanTimer();

            if(stream){
                stream.getTracks().forEach(track => track.stop());
                stream = null;
                video.srcObject = null;
            }

            setLiveButtons(false);

            /*
             * Non-medication result
             */
            if(detected?.is_medication === false){

                const resultBox = document.getElementById("resultBox");

                if(resultBox){
                    resultBox.className = "result error";

                    resultBox.innerHTML = `
                        <h2>⚠ NOT A MEDICATION LABEL</h2>
                        <p>
                            The camera detected text, but it does not appear
                            to be a medication label.
                        </p>
                        <hr>
                        <p>
                            <strong>Detected</strong><br>
                            ${name || "Non-medication text"}
                        </p>
                    `;
                }

                lastResultText =
                    "Not a medication label was detected. " +
                    "Please show a pharmacy or medication label.";

                show("result");
                return;
            }

            /*
             * Medication detected.
             * Send it through the existing deterministic comparison.
             */
            await verifyDetected({
                name:name || null,
                strength:strength || null,
                confidence:confidence || "detected"
            });

            return;
        }

        /*
         * No useful information yet.
         * Retry only while the scanner is active.
         */
        setLiveStatus("Hold the label steady inside the frame…");

    }catch(e){

        console.error("Live scan error:", e);

        /*
         * QUOTA / AUTH / SERVER errors should not hammer Gemini.
         */
        const message = String(e.message || "");

        if(
            message.includes("429") ||
            message.includes("RESOURCE_EXHAUSTED") ||
            message.includes("quota")
        ){
            setLiveStatus(
                "Gemini is temporarily out of quota. " +
                "You can upload the label instead."
            );

            stopLiveScan(false);
            return;
        }

        if(e.status === 401){
            setLiveStatus("Please sign in to continue.");
            stopLiveScan(false);
            return;
        }

        /*
         * Temporary error:
         * one controlled retry instead of an endless loop.
         */
        setLiveStatus("Couldn't read that frame. Trying once more…");

    }finally{
        liveScanBusy = false;

        if(
            liveScanActive &&
            !liveScanFinished &&
            liveScanAttempts < LIVE_MAX_ATTEMPTS
        ){
            scheduleLiveScan(LIVE_SCAN_INTERVAL);
        }
    }
}

function stopLiveScan(stopCamera = true){
    liveScanActive = false;
    liveScanBusy = false;
    liveScanFinished = true;

    clearLiveScanTimer();

    const overlay = document.getElementById("liveScanOverlay");
    const liveStatus = document.getElementById("liveScanStatus");
    const startButton = document.getElementById("startCameraButton");
    const stopButton = document.getElementById("stopLiveScanButton");

    if(overlay) overlay.classList.add("hidden");
    if(liveStatus) liveStatus.classList.add("hidden");

    setLiveButtons(false);

    if(stopCamera && stream){
        stream.getTracks().forEach(track => track.stop());
        stream = null;

        if(video){
            video.srcObject = null;
        }
    }
}

async function startCamera(){
    /*
     * Start normal camera preview.
     */
    stopLiveScan(true);

    scanStatus.textContent = "Requesting camera access…";

    try{
        if(!navigator.mediaDevices?.getUserMedia){
            throw new Error(
                "Camera access is unavailable. Upload a label photo instead."
            );
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video:{
                facingMode:{ideal:"environment"},
                width:{ideal:1280},
                height:{ideal:720}
            },
            audio:false
        });

        video.srcObject = stream;
        await video.play();

        scanStatus.textContent =
            "Camera ready. Hold the label steady and start live scan.";

    }catch(e){
        scanStatus.textContent =
            "Camera unavailable: " +
            e.message +
            " You can upload a label photo instead.";

        showManualLabelEntry();
    }
}

async function captureLabel(){
    if(!stream){
        return scanStatus.textContent =
            "Start the camera first, or upload a label photo.";
    }

    if(!video.videoWidth || !video.videoHeight){
        return scanStatus.textContent =
            "The camera is still starting. Wait for the preview.";
    }

    const scale = Math.min(
        1,
        960 / video.videoWidth
    );

    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    canvas.getContext("2d").drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    await analyzeImage(
        canvas.toDataURL("image/jpeg", .78)
    );
}

async function captureLabel(){
 if(!stream)return scanStatus.textContent="Start the camera first, or upload a label photo.";
 if(!video.videoWidth||!video.videoHeight)return scanStatus.textContent="The camera is still starting. Wait for the preview, then capture again.";
 canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext("2d").drawImage(video,0,0);
 await analyzeImage(canvas.toDataURL("image/jpeg",.88));
}
async function analyzeUploadedLabel(){
 const f=labelFile.files[0];if(!f)return scanStatus.textContent="Choose a label photo first.";
 const image=await fileData(f);showManualLabelEntry(image);await analyzeImage(image);
}
function showManualLabelEntry(image){
 manualLabelEntry.classList.remove("hidden");
 if(image){capturedLabelImage.src=image;manualImagePreview.classList.remove("hidden");}
}
async function verifyManualLabel(){
 const detected={name:manualLabelName.value.trim()||null,strength:manualLabelStrength.value.trim()||null,confidence:"user-entered"};
 scanStatus.textContent="Comparing the details you entered with your confirmed prescription…";
 try{await verifyDetected(detected);}catch(e){scanStatus.textContent="Comparison failed: "+e.message;}
}
async function analyzeImage(image){
 scanStatus.textContent="Gemini is reading the label…";

 try{
   const d=await post("/api/label/analyze",{image});

   /*
    * Manual/upload scans are one-shot.
    * Never automatically rescan.
    */
   await verifyDetected(d);

 }catch(e){

   const msg=String(e.message||"");

   if(
      msg.includes("429") ||
      msg.includes("RESOURCE_EXHAUSTED") ||
      msg.includes("quota")
   ){
      scanStatus.textContent=
        "Gemini is temporarily out of quota. Try again later or use manual entry.";
      return;
   }

   scanStatus.textContent=
      "Gemini could not read this label.";

   manualLabelReason.textContent=
      "The label could not be read reliably. " +
      "Enter only details that are clearly visible.";

   showManualLabelEntry(image);
 }
}
async function verifyDetected(d){
 /*
  * Any completed verification ends live scanning first.
  */
 if(typeof liveScanActive !== "undefined" && liveScanActive){
    liveScanFinished=true;
    liveScanActive=false;
    clearLiveScanTimer();

    if(stream){
       stream.getTracks().forEach(track=>track.stop());
       stream=null;
       if(video)video.srcObject=null;
    }

    setLiveButtons(false);
 }

 const v=await post("/api/verify",{expected:current,detected:d});const labels={MATCH:["✓ LABEL MATCH","Label matches stored prescription information.","match"],MEDICINE_MISMATCH:["⚠ MEDICATION MISMATCH","The detected medication name does not match the stored prescription.","error"],STRENGTH_MISMATCH:["⚠ STRENGTH MISMATCH","The detected strength does not match the stored prescription.","error"],REVIEW_REQUIRED:["⚠ REVIEW REQUIRED","The strength could not be verified. Check the prescription or pharmacy label.","warn"],UNREADABLE:["⚠ UNABLE TO READ LABEL","Medication information could not be reliably read. Try scanning again.","warn"]};const a=labels[v.status]||labels.UNREADABLE;lastResultText=`${a[0]}. ${a[1]} Expected ${current?.name||"unknown"} ${current?.strength||""}. Detected ${d.name||"unknown"} ${d.strength||"strength unavailable"}.`;resultBox.className="result "+a[2];resultBox.innerHTML=`<h2>${a[0]}</h2><p>${a[1]}</p><hr><p><strong>Expected</strong><br>${current?.name||"—"} · ${current?.strength||"—"}</p><p><strong>Detected</strong><br>${d.name||"—"} · ${d.strength||"—"}</p>`;show("result");}
function speakResult(){speak(lastResultText,"English");}
populateLanguageSelectors();
initializeApp();
