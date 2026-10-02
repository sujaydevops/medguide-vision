let current=null,currentReminder=null,lastResultText="",stream=null,authMode="login",account=null;
const demoPrescription={name:"Metformin",strength:"500 mg",quantity:"1 tablet",instructions:"Take 1 tablet at 8 AM and 1 tablet at 8 PM.",times:["08:00","20:00"],follow_up:"2026-10-20"};
function show(id){document.querySelectorAll("main>section").forEach(x=>x.classList.add("hidden"));document.getElementById(id).classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});}
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
 const obj={name:rName.value||null,strength:rStrength.value||null,quantity:rQuantity.value||null,instructions:rInstructions.value||null,times:rTimes.value.split(",").map(x=>x.trim()).filter(Boolean),follow_up:rFollow.value||null,language:language.value,reminder_consent:reminderConsent.checked,phone_number:reminderPhone.value.trim(),reminder_time:reminderTime.value,timezone:reminderTimezone.value};
 confirmStatus.textContent="";
 try{const result=await post("/api/prescription/confirm",obj);current=result.medication;currentReminder=result.reminder;renderDashboard();show("dashboard");}catch(e){confirmStatus.textContent="Could not save the prescription: "+e.message;}
}
function renderDashboard(){
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
function speak(t){if(!("speechSynthesis" in window))return alert("Text-to-speech is unavailable in this browser.");speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t));}
function speakCurrent(){speak([current?.name,current?.strength,current?.instructions,(current?.times||[]).join(", ")].filter(Boolean).join(". "));}
async function translateCurrent(){try{let j=await post("/api/translate",{language:language.value,medication:current});translation.textContent=j.explanation||"";}catch(e){translation.textContent="Translation error: "+e.message;}}
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
 try{const d=await post("/api/label/analyze",{image});await verifyDetected(d);}
 catch(e){
  scanStatus.textContent=`Gemini label analysis failed: ${e.message}`;
  manualLabelReason.textContent="Gemini could not read this label. You can still enter the visible details yourself; this will be compared without AI and will not be presented as Gemini analysis.";
  showManualLabelEntry(image);
 }
}
async function verifyDetected(d){const v=await post("/api/verify",{expected:current,detected:d});const labels={MATCH:["✓ LABEL MATCH","Label matches stored prescription information.","match"],MEDICINE_MISMATCH:["⚠ MEDICATION MISMATCH","The detected medication name does not match the stored prescription.","error"],STRENGTH_MISMATCH:["⚠ STRENGTH MISMATCH","The detected strength does not match the stored prescription.","error"],REVIEW_REQUIRED:["⚠ REVIEW REQUIRED","The strength could not be verified. Check the prescription or pharmacy label.","warn"],UNREADABLE:["⚠ UNABLE TO READ LABEL","Medication information could not be reliably read. Try scanning again.","warn"]};const a=labels[v.status]||labels.UNREADABLE;lastResultText=`${a[0]}. ${a[1]} Expected ${current?.name||"unknown"} ${current?.strength||""}. Detected ${d.name||"unknown"} ${d.strength||"strength unavailable"}.`;resultBox.className="result "+a[2];resultBox.innerHTML=`<h2>${a[0]}</h2><p>${a[1]}</p><hr><p><strong>Expected</strong><br>${current?.name||"—"} · ${current?.strength||"—"}</p><p><strong>Detected</strong><br>${d.name||"—"} · ${d.strength||"—"}</p>`;show("result");}
function speakResult(){speak(lastResultText);}
initializeApp();
