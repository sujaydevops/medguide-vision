let current=null,lastResultText="",stream=null;
function show(id){document.querySelectorAll("main>section").forEach(x=>x.classList.add("hidden"));document.getElementById(id).classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"});}
function fileData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});}
async function post(url,data){const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error||"Request failed");return j;}
function val(x){return x==null?"":x}
async function analyzeRx(){
 const s=document.getElementById("rxStatus");s.textContent="Gemini is reading the prescription…";
 try{let image=null,f=document.getElementById("rxFile").files[0];if(f)image=await fileData(f);
 const j=await post("/api/prescription/analyze",{text:document.getElementById("rxText").value,image});
 ["Name","Strength","Quantity","Instructions","Follow"].forEach(k=>document.getElementById("r"+k).value=val(j[{Name:"name",Strength:"strength",Quantity:"quantity",Instructions:"instructions",Follow:"follow_up"}[k]]));
 document.getElementById("rTimes").value=(j.times||[]).join(", ");show("review");}
 catch(e){s.textContent="Error: "+e.message;}
}
async function confirmRx(){
 const obj={name:rName.value||null,strength:rStrength.value||null,quantity:rQuantity.value||null,instructions:rInstructions.value||null,times:rTimes.value.split(",").map(x=>x.trim()).filter(Boolean),follow_up:rFollow.value||null,language:language.value};
 try{current=await post("/api/prescription/confirm",obj);renderDashboard();show("dashboard");}catch(e){alert(e.message);}
}
function renderDashboard(){dName.textContent=current.name||"Information missing";dStrength.textContent=current.strength||"Strength not verified";dInstructions.textContent=current.instructions||"Instructions not available";dTimes.textContent=(current.times||[]).join(", ")||"Not available";dFollow.textContent=current.follow_up?"Follow-up: "+current.follow_up:"";}
function speak(t){if(!("speechSynthesis" in window))return alert("Text-to-speech is unavailable in this browser.");speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t));}
function speakCurrent(){speak([current?.name,current?.strength,current?.instructions,(current?.times||[]).join(", ")].filter(Boolean).join(". "));}
async function translateCurrent(){try{let j=await post("/api/translate",{language:language.value,medication:current});translation.textContent=j.explanation||"";}catch(e){translation.textContent="Translation error: "+e.message;}}
async function startCamera(){try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});video.srcObject=stream;}catch(e){scanStatus.textContent="Camera error: "+e.message;}}
async function captureLabel(){if(!stream)return scanStatus.textContent="Start the camera first.";canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext("2d").drawImage(video,0,0);await analyzeImage(canvas.toDataURL("image/jpeg",.88));}
async function analyzeUploadedLabel(){const f=labelFile.files[0];if(!f)return;await analyzeImage(await fileData(f));}
async function analyzeLabelText(){try{scanStatus.textContent="Gemini is reading the demo label text…";const d=await post("/api/label/analyze",{text:labelText.value});await verifyDetected(d);}catch(e){scanStatus.textContent="Error: "+e.message;}}
async function analyzeImage(image){try{scanStatus.textContent="Gemini is reading the label…";const d=await post("/api/label/analyze",{image});await verifyDetected(d);}catch(e){scanStatus.textContent="Error: "+e.message;}}
async function verifyDetected(d){const v=await post("/api/verify",{expected:current,detected:d});const labels={MATCH:["✓ LABEL MATCH","Label matches stored prescription information.","match"],MEDICINE_MISMATCH:["⚠ MEDICATION MISMATCH","The detected medication name does not match the stored prescription.","error"],STRENGTH_MISMATCH:["⚠ STRENGTH MISMATCH","The detected strength does not match the stored prescription.","error"],REVIEW_REQUIRED:["⚠ REVIEW REQUIRED","The strength could not be verified. Check the prescription or pharmacy label.","warn"],UNREADABLE:["⚠ UNABLE TO READ LABEL","Medication information could not be reliably read. Try scanning again.","warn"]};const a=labels[v.status]||labels.UNREADABLE;lastResultText=`${a[0]}. ${a[1]} Expected ${current?.name||"unknown"} ${current?.strength||""}. Detected ${d.name||"unknown"} ${d.strength||"strength unavailable"}.`;resultBox.className="result "+a[2];resultBox.innerHTML=`<h2>${a[0]}</h2><p>${a[1]}</p><hr><p><strong>Expected</strong><br>${current?.name||"—"} · ${current?.strength||"—"}</p><p><strong>Detected</strong><br>${d.name||"—"} · ${d.strength||"—"}</p>`;show("result");}
function speakResult(){speak(lastResultText);}
