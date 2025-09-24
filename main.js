// main.js - corrected full version

let history = [];
let lastSequence = [];
let numberWords = {};
let trainerRefPool = [];
let flashRefPool = [];
let flashingInterval = null;
let lastFlashRange = null;

// Load numbers.json and merge with any saved localStorage edits
async function loadNumberWords(){
  try{
    const resp = await fetch("numbers.json");
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    numberWords = data || {};
    const saved = localStorage.getItem("numberWords");
    if(saved){
      const savedObj = JSON.parse(saved);
      for(const k in savedObj) numberWords[k] = savedObj[k];
    }
    populateRangeSelectors();
    populateEditBlocks();
  } catch(err){
    console.error("Error loading numbers.json:", err);
    populateRangeSelectors();
    populateEditBlocks();
  }
}
loadNumberWords();

// ---------- Helpers ----------
function populateRangeSelectors(){
  const seqSel = document.getElementById("sequenceRangeSelect");
  const flashSel = document.getElementById("flashRangeSelect");
  if(!seqSel || !flashSel) return;

  const ranges = ["ALL", "0-9", "00-09"];
  for(let i=10;i<=90;i+=10) {
    ranges.push(`${i}-${i+9}`);
  }

  [seqSel, flashSel].forEach(sel=>{
    sel.innerHTML = "";
    ranges.forEach(r=>{
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      sel.appendChild(opt);
    });
    sel.value = "ALL"; // default to ALL
  });
}

function getSequencePool(selId){
  const sel = document.getElementById(selId);
  if(!sel) return [];
  const value = sel.value;
  if(value === "ALL"){
    const pool = [];
    for(let i=0;i<=99;i++) pool.push(String(i).padStart(2,"0"));
    return pool;
  }
  const [startRaw, endRaw] = value.split("-");
  const start = parseInt(startRaw,10);
  const end = parseInt(endRaw,10);
  const usePadTwo = (startRaw.length > 1);
  const pool = [];
  for(let i=start;i<=end;i++){
    pool.push(usePadTwo ? String(i).padStart(2,"0") : String(i));
  }
  return pool;
}

function getRandomFromPool(pool, mode, refPool){
  if(!Array.isArray(pool) || pool.length===0) return null;
  if(mode === "allowRepeats") {
    return pool[Math.floor(Math.random()*pool.length)];
  } else {
    if(refPool.length === 0) refPool.push(...pool);
    const idx = Math.floor(Math.random()*refPool.length);
    return refPool.splice(idx,1)[0];
  }
}

function normalizeInput(str){
  if(!str) return [];
  const digits = str.toString().replace(/\D/g,"").split("").map(d=>parseInt(d,10)).filter(n=>!Number.isNaN(n));
  return digits;
}

// Always show correct sequence, mark your answers
function highlightMistakes(inputArr, correctArr){
  let resultHTML = "";
  for(let i=0;i<correctArr.length;i++){
    const cor = correctArr[i];
    const inp = inputArr[i];
    if(String(inp) === String(cor)){
      resultHTML += `<span class="correct">${cor}</span>`;
    } else {
      resultHTML += `<span class="incorrect">${cor}</span>`;
    }
  }
  return resultHTML;
}

function speak(num){
  const voiceOn = document.getElementById("voiceCheck")?.checked;
  if(voiceOn && window.speechSynthesis){
    speechSynthesis.speak(new SpeechSynthesisUtterance("Next number"));
    speechSynthesis.speak(new SpeechSynthesisUtterance(String(num)));
  }
}

// ---------- Edit Words ----------
function populateEditBlocks(){
  const container = document.getElementById("editWordsGroups");
  if(!container) return;
  container.innerHTML = "";

  const groups = [];
  groups.push({label:"Numbers 0-9", keys: Array.from({length:10},(_,i)=>String(i))});
  groups.push({label:"Numbers 00-09", keys: Array.from({length:10},(_,i)=>String(i).padStart(2,"0"))});
  for(let g=1; g<=9; g++){
    const start = g*10;
    const keys = [];
    for(let n=start; n<=start+9; n++) keys.push(String(n).padStart(2,"0"));
    groups.push({label:`Numbers ${start}-${start+9}`, keys});
  }

  groups.forEach(group=>{
    const det = document.createElement("details");
    det.open = false;
    const sum = document.createElement("summary");
    sum.textContent = group.label;
    det.appendChild(sum);

    const inner = document.createElement("div");
    group.keys.forEach(key=>{
      if(!numberWords[key]) numberWords[key] = { word: "", suggestions: [] };

      const label = document.createElement("label");
      label.textContent = `${key}: `;
      label.style.marginRight = "6px";

      const inputWord = document.createElement("input");
      inputWord.type = "text";
      inputWord.value = numberWords[key]?.word || "";
      inputWord.dataset.num = key;
      inputWord.style.marginRight = "8px";
      inputWord.addEventListener("input", ()=>{
        numberWords[key] = numberWords[key] || {word:"", suggestions:[]};
        numberWords[key].word = inputWord.value;
        localStorage.setItem("numberWords", JSON.stringify(numberWords));
      });

      const inputSugg = document.createElement("input");
      inputSugg.type = "text";
      inputSugg.value = (numberWords[key]?.suggestions || []).join(", ");
      inputSugg.dataset.num = key;
      inputSugg.style.width = "300px";
      inputSugg.addEventListener("input", ()=>{
        const arr = inputSugg.value.split(",").map(s=>s.trim()).filter(Boolean);
        numberWords[key] = numberWords[key] || {word:"", suggestions:[]};
        numberWords[key].suggestions = arr;
        localStorage.setItem("numberWords", JSON.stringify(numberWords));
      });

      inner.appendChild(label);
      inner.appendChild(inputWord);
      inner.appendChild(document.createTextNode(" Suggestions: "));
      inner.appendChild(inputSugg);
      inner.appendChild(document.createElement("br"));
    });

    det.appendChild(inner);
    container.appendChild(det);
  });
}

function exportWords(){
  const blob = new Blob([JSON.stringify(numberWords, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "numbers_export.json";
  a.click();
}
document.getElementById("exportBtn")?.addEventListener("click", exportWords);

// ---------- Section 1: Start Sequence ----------
function startSequence(){
  if(document.getElementById("manualStart")?.checked) alert("Press OK when ready to begin.");
  ["forwardInput","backwardInput","partialInputForward","partialInputBackward"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.value = "";
  });
  ["forwardResult","backwardResult","partialResultForward","partialResultBackward"].forEach(id=>{
    const el = document.getElementById(id); if(el) el.textContent = "";
  });
  document.getElementById("flashDisplay").textContent = "";

  const pool = getSequencePool("sequenceRangeSelect");
  if(!pool || pool.length===0){ alert("Select numbers!"); return; }
  const count = Math.max(1, parseInt(document.getElementById("numCount")?.value || "1",10));
  lastSequence = [];
  trainerRefPool = [];
  const mode = document.getElementById("noRepeats")?.checked ? "noRepeats" : "allowRepeats";
  for(let i=0;i<count;i++){
    const numKey = getRandomFromPool(pool, mode, trainerRefPool);
    if(numKey === null) break;
    lastSequence.push(numKey);
  }
  history.push([...lastSequence]);

  const pause = parseFloat(document.getElementById("pauseSlider")?.value || "3") * 1000;
  const flash = parseFloat(document.getElementById("flashSlider")?.value || "1") * 1000;

  lastSequence.forEach((numKey, idx) => {
    setTimeout(()=>{
      const disp = document.getElementById("flashDisplay");
      if(disp) disp.textContent = numKey;
      setTimeout(()=>{
        if(disp) disp.textContent = "";
        speak(numKey);
      }, flash);
    }, idx * pause);
  });
}

// ---------- Check functions ----------
function checkForward(){
  const inputArr = normalizeInput(document.getElementById("forwardInput")?.value || "");
  const correctArr = lastSequence.join('').split('').map(d=>parseInt(d,10));
  document.getElementById("forwardResult").innerHTML = 
    (inputArr.join('') === correctArr.join('')) ? "✅ Correct!" : highlightMistakes(inputArr,correctArr);
}
function checkBackward(){
  const inputArr = normalizeInput(document.getElementById("backwardInput")?.value || "");
  const correctArr = [...lastSequence.join('')].reverse().map(d=>parseInt(d,10));
  document.getElementById("backwardResult").innerHTML = 
    (inputArr.join('') === correctArr.join('')) ? "✅ Correct!" : highlightMistakes(inputArr,correctArr);
}
function checkPartialForward(){
  const count = Math.max(1, parseInt(document.getElementById("partialCount")?.value || "1",10));
  const flatNumbers = history.slice(-count).flat();
  const inputArr = normalizeInput(document.getElementById("partialInputForward")?.value || "");
  const correctArr = flatNumbers.join('').split('').map(d=>parseInt(d,10));
  document.getElementById("partialResultForward").innerHTML = 
    (inputArr.join('') === correctArr.join('')) ? "✅ Correct!" : highlightMistakes(inputArr,correctArr);
}
function checkPartialBackward(){
  const count = Math.max(1, parseInt(document.getElementById("partialCount")?.value || "1",10));
  const flatNumbers = history.slice(-count).flat();
  const correctArr = [...flatNumbers.join('')].reverse().map(d=>parseInt(d,10));
  const inputArr = normalizeInput(document.getElementById("partialInputBackward")?.value || "");
  document.getElementById("partialResultBackward").innerHTML = 
    (inputArr.join('') === correctArr.join('')) ? "✅ Correct!" : highlightMistakes(inputArr,correctArr);
}
function clearHistory(){
  history = [];
  document.getElementById("partialResultForward").innerText = "History cleared.";
  document.getElementById("partialResultBackward").innerText = "History cleared.";
}

// ---------- Flashing Practice ----------
function showFlashingNext(){
  const pool = getSequencePool("flashRangeSelect");
  const mode = document.getElementById("flashNoRepeats")?.checked ? "noRepeats" : "allowRepeats";
  const currentRange = document.getElementById("flashRangeSelect")?.value;
  if(currentRange !== lastFlashRange){
    flashRefPool = [];
    lastFlashRange = currentRange;
  }
  const numKey = getRandomFromPool(pool, mode, flashRefPool);
  document.getElementById("flashingPracticeDisplay").textContent = numKey;
  document.getElementById("flashingWords").textContent = (numberWords[numKey]?.word) || "";
  if(document.getElementById("voiceCheck")?.checked) speak(numKey);
}
function startFlashing(){
  const speed = parseInt(document.getElementById("flashingSpeed")?.value || "2000",10);
  if(flashingInterval) clearInterval(flashingInterval);
  showFlashingNext();
  flashingInterval = setInterval(showFlashingNext, speed);
}
document.getElementById("flashingToggle")?.addEventListener("change", function(){
  if(this.checked){
    showFlashingNext();
    startFlashing();
  } else {
    if(flashingInterval) clearInterval(flashingInterval);
    document.getElementById("flashingPracticeDisplay").textContent = "";
    document.getElementById("flashingWords").textContent = "";
  }
});
document.getElementById("flashingSpeed")?.addEventListener("input", function(){
  if(document.getElementById("flashingToggle")?.checked) startFlashing();
});

// ---------- Button bindings ----------
document.getElementById("startBtn")?.addEventListener("click", startSequence);
document.getElementById("checkForward")?.addEventListener("click", checkForward);
document.getElementById("checkBackward")?.addEventListener("click", checkBackward);
document.getElementById("checkPartialForward")?.addEventListener("click", checkPartialForward);
document.getElementById("checkPartialBackward")?.addEventListener("click", checkPartialBackward);
document.getElementById("clearHistory")?.addEventListener("click", clearHistory);

['forwardInput','backwardInput','partialInputForward','partialInputBackward'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  el.addEventListener("keydown", e=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      switch(id){
        case 'forwardInput': checkForward(); break;
        case 'backwardInput': checkBackward(); break;
        case 'partialInputForward': checkPartialForward(); break;
        case 'partialInputBackward': checkPartialBackward(); break;
      }
    }
  });
});
