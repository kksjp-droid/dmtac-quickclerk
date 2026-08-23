// DMTAC QuickClerk
// Local, offline documentation scaffold. No storage, no network calls, no analytics.

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Access gate (soft deterrent only - see HTML comment). Code is not a
  // secret since anyone can view page source; this just marks the tool as
  // KKSJ's work and discourages casual link-sharing. No patient data is
  // gated - the app doesn't store any. Unlock state is per-tab (sessionStorage).
  // ---------------------------------------------------------------------

  var ACCESS_CODE = "pkdspt";

  function initAccessGate() {
    var overlay = document.getElementById("lockOverlay");
    var input = document.getElementById("lockPassword");
    var btn = document.getElementById("lockUnlockBtn");
    var error = document.getElementById("lockError");

    function tryUnlock() {
      if (input.value.trim().toLowerCase() === ACCESS_CODE) {
        overlay.classList.add("unlocked");
        try { sessionStorage.setItem("dmtacUnlocked", "1"); } catch (e) { /* ignore if storage unavailable */ }
      } else {
        error.textContent = "Incorrect code. Please check with KK Seberang Jaya DMTAC team.";
      }
    }

    var alreadyUnlocked = false;
    try { alreadyUnlocked = sessionStorage.getItem("dmtacUnlocked") === "1"; } catch (e) { /* ignore */ }
    if (alreadyUnlocked) overlay.classList.add("unlocked");

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") tryUnlock();
    });
    input.focus();
  }

  // ---------------------------------------------------------------------
  // AI Smart Dictation (optional, opt-in). Default is a shared Gemini proxy
  // (access code only, no personal key needed for pharmacists); Anthropic/
  // OpenAI/own-key Gemini remain available for anyone who prefers their own
  // account. This is the ONLY feature in the app where data leaves the
  // device. Everything else in the app remains fully offline and unaffected.
  // ---------------------------------------------------------------------

  var AI_FIELD_EXCLUDE = [
    "aiApiKey", "aiModel", "aiDictationBox", "aiProvider", "aiOverwriteExisting",
    "lockPassword", "myMaatVoiceInput", "noteOutput", "choQtyInput"
  ];

  // URL of the PKD SPT Shared Gemini proxy (Cloudflare Worker). This holds
  // the DMTAC lead's real Gemini key server-side; the app and pharmacists
  // never see it - only the access code is entered in the browser. See the
  // "Setting Up the Shared AI Proxy" section in README.md.
  var PKDSPT_PROXY_URL = "https://dmtac-ai-proxy.kksjpkdspt.workers.dev";

  // ---------------------------------------------------------------------
  // BUILT-IN SHARED ACCESS CODE
  //
  // Put the Cloudflare Worker's AI_ACCESS_CODE here so pharmacists never
  // have to type it. When this is set, the access-code box is hidden and
  // filled automatically for the "PKD SPT Shared Gemini" provider.
  //
  // BE AWARE: this file is served publicly. Anyone who views the page
  // source can read this value and send requests that spend the DMTAC
  // lead's Gemini quota. Because of that, this code is a convenience
  // marker, NOT a security control. Protect the account instead:
  //   - set a hard spend cap on the Google Cloud billing account
  //   - keep RATE_LIMIT_PER_MIN low in the Worker
  //   - rotate this value (here + in Cloudflare) if usage looks odd
  //
  // Leave it as "" to go back to pharmacists typing the code themselves.
  // ---------------------------------------------------------------------
  var PKDSPT_BUILTIN_ACCESS_CODE = "dmtac2026";

  function collectAiFieldSchema() {
    var fields = document.querySelectorAll('main input[type="text"], main input[type="number"], main textarea');
    var schema = [];
    fields.forEach(function (el) {
      if (AI_FIELD_EXCLUDE.indexOf(el.id) !== -1 || !el.id) return;
      var label = "";
      var labelEl = el.closest("label");
      if (labelEl) {
        label = labelEl.textContent.replace(/\s+/g, " ").trim();
      } else {
        var subsection = el.closest(".subsection");
        var heading = subsection ? subsection.querySelector("h3") : null;
        label = heading ? heading.textContent.replace(/\s+/g, " ").trim() : el.id;
      }
      schema.push({ id: el.id, label: label });
    });
    return schema;
  }

  function buildAiExtractionPrompt(narrative, schema) {
    var fieldList = schema.map(function (f) { return "- \"" + f.id + "\": " + f.label; }).join("\n");
    return "You are extracting structured clinical documentation fields from a pharmacist's dictated notes for a DMTAC (Diabetes Medication Therapy Adherence Clinic) visit in Malaysia.\n\n" +
      "Given the dictation text below, extract a value for each field that is clearly mentioned or stated. Write each value as a concise clinical phrase (not a full restated sentence, not the field name itself). Do not invent or infer information that isn't stated. Omit any field that is not mentioned in the dictation - do not include it in the output at all.\n\n" +
      "Respond with ONLY a single valid JSON object (no markdown fences, no commentary) mapping field id to extracted value, using exactly these field ids:\n" +
      fieldList + "\n\n" +
      "Dictation text:\n\"\"\"\n" + narrative + "\n\"\"\"";
  }

  function extractJsonFromText(text) {
    var cleaned = text.trim();
    var fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    var firstBrace = cleaned.indexOf("{");
    var lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    return JSON.parse(cleaned);
  }

  function callAnthropicApi(apiKey, model, prompt) {
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("Anthropic API error (" + res.status + "): " + t.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error("Unexpected response shape from Anthropic API.");
      return extractJsonFromText(text);
    });
  }

  function callOpenAiApi(apiKey, model, prompt) {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("OpenAI API error (" + res.status + "): " + t.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!text) throw new Error("Unexpected response shape from OpenAI API.");
      return extractJsonFromText(text);
    });
  }

  function callGeminiApi(apiKey, model, prompt) {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("Gemini API error (" + res.status + "): " + t.slice(0, 300));
        });
      }
      return res.json();
    }).then(function (data) {
      var candidate = data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      var text = parts && parts[0] && parts[0].text;
      if (!text) throw new Error("Unexpected response shape from Gemini API.");
      return extractJsonFromText(text);
    });
  }

  // Google advises exponential backoff with jitter for 503 "model is
  // overloaded" - it is a capacity signal, not a quota or auth problem, and
  // usually clears on the next attempt. 429/500/502/504 get the same
  // treatment. 401/403 are NOT retried: those are our own gates and a retry
  // would never change the answer.
  var AI_RETRY_STATUSES = [429, 500, 502, 503, 504];
  var AI_RETRY_MAX = 3;

  // If the chosen model stays overloaded after its retries, drop to an
  // older, less contended one rather than failing the pharmacist outright.
  // Newest models see the most demand, so the fallback is deliberately a
  // previous generation.
  var AI_MODEL_FALLBACKS = {
    "gemini-3.7-flash": "gemini-3.6-flash",
    "gemini-3.6-flash": "gemini-2.5-flash"
  };

  function isRetryableAiError(err) {
    return !!(err && err.retryStatus && AI_RETRY_STATUSES.indexOf(err.retryStatus) !== -1);
  }

  function aiRetryDelayMs(attempt) {
    var base = 800 * Math.pow(2, attempt);        // 800, 1600, 3200
    return Math.round(base + Math.random() * 400); // + jitter
  }

  function withAiRetry(makeCall, onRetry) {
    function attemptOnce(attempt) {
      return makeCall().catch(function (err) {
        if (attempt >= AI_RETRY_MAX - 1 || !isRetryableAiError(err)) throw err;
        var wait = aiRetryDelayMs(attempt);
        if (onRetry) onRetry(attempt + 1, AI_RETRY_MAX, wait, err);
        return new Promise(function (resolve) { setTimeout(resolve, wait); })
          .then(function () { return attemptOnce(attempt + 1); });
      });
    }
    return attemptOnce(0);
  }

  function callPkdsptProxyApi(accessCode, model, prompt) {
    if (!PKDSPT_PROXY_URL || PKDSPT_PROXY_URL.indexOf("YOUR-SUBDOMAIN") !== -1) {
      return Promise.reject(new Error("Shared Gemini proxy hasn't been set up yet. Ask your DMTAC lead, or switch to a provider you have your own API key for."));
    }
    return fetch(PKDSPT_PROXY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessCode: accessCode, model: model, prompt: prompt })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          var msg = data && data.error ? data.error : "Proxy error";
          var e = new Error(msg + " (" + res.status + ")" + (res.status === 401 ? " - check the access code with your DMTAC lead." : ""));
          e.retryStatus = res.status;
          throw e;
        }
        return data;
      });
    }).then(function (data) {
      var candidate = data.candidates && data.candidates[0];
      var parts = candidate && candidate.content && candidate.content.parts;
      var text = parts && parts[0] && parts[0].text;
      if (!text) throw new Error("Unexpected response shape from AI proxy.");
      return extractJsonFromText(text);
    });
  }

  function fillFieldsFromAiResult(resultObj, overwrite) {
    var filled = 0;
    Object.keys(resultObj).forEach(function (key) {
      var el = document.getElementById(key);
      if (!el || AI_FIELD_EXCLUDE.indexOf(key) !== -1) return;
      var value = resultObj[key];
      if (value === null || value === undefined || String(value).trim() === "") return;
      if (!overwrite && el.value.trim() !== "") return;
      el.value = String(value).trim();
      filled++;
    });
    return filled;
  }

  function updateAiKeyLabelForProvider(provider) {
    var labelText = document.getElementById("aiApiKeyLabelText");
    var input = document.getElementById("aiApiKey");
    var hint = document.getElementById("aiApiKeyHint");
    var codeRow = input.closest(".field") || input.parentElement;
    if (provider === "pkdspt-shared" && PKDSPT_BUILTIN_ACCESS_CODE) {
      // Code is built into the app - pharmacists never type it.
      input.value = PKDSPT_BUILTIN_ACCESS_CODE;
      if (codeRow) codeRow.style.display = "none";
      hint.style.display = "";
      hint.innerHTML = "Ready to use — no access code needed. This uses a shared Gemini proxy set up by your DMTAC lead. Your dictation text is sent to the proxy, then to Google Gemini, using the lead's account.";
      return;
    }
    if (codeRow) codeRow.style.display = "";
    if (provider === "pkdspt-shared") {
      labelText.textContent = "Access code (ask your DMTAC lead for this — not a personal API key)";
      input.placeholder = "Enter the shared access code";
      input.setAttribute("autocomplete", "off");
      hint.innerHTML = "This option uses a shared Gemini proxy set up by your DMTAC lead, so you don't need your own API key — just ask them for the access code. Your dictation text is sent to the proxy, then to Google Gemini, using the lead's account.";
    } else {
      labelText.textContent = "Your own API key (kept only in this browser tab for this session — never saved to disk, never stored in this site's code)";
      input.placeholder = provider === "gemini" ? "Enter your Gemini API key" : "sk-... or your provider's API key";
      hint.innerHTML = 'Get a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> (Google Gemini — free tier available), <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a> (Anthropic), or <a href="https://platform.openai.com/" target="_blank" rel="noopener">platform.openai.com</a> (OpenAI). Direct browser calls work reliably for Anthropic and Gemini; OpenAI may block browser requests (CORS) depending on their current policy — if a call fails, that’s your browser/provider blocking it, not a bug here.';
    }
  }

  function initAiSmartDictation() {
    var btn = document.getElementById("aiParseBtn");
    var status = document.getElementById("aiStatus");

    btn.addEventListener("click", function () {
      var narrative = document.getElementById("aiDictationBox").value.trim();
      var provider = document.getElementById("aiProvider").value;
      var apiKey = document.getElementById("aiApiKey").value.trim();
      if (provider === "pkdspt-shared" && PKDSPT_BUILTIN_ACCESS_CODE) {
        apiKey = PKDSPT_BUILTIN_ACCESS_CODE;
      }
      var model = document.getElementById("aiModel").value.trim();
      var overwrite = document.getElementById("aiOverwriteExisting").checked;

      if (!narrative) {
        status.textContent = "Dictate or paste your notes into the box first.";
        return;
      }
      if (!apiKey) {
        status.textContent = provider === "pkdspt-shared" ? "Enter the shared access code first (ask your DMTAC lead)." : "Enter your own API key first (see link above).";
        return;
      }

      var schema = collectAiFieldSchema();
      var prompt = buildAiExtractionPrompt(narrative, schema);

      var providerNames = { anthropic: "Anthropic", openai: "OpenAI", gemini: "Google Gemini", "pkdspt-shared": "the PKD SPT Shared Gemini proxy" };
      btn.disabled = true;
      status.textContent = "Sending to " + (providerNames[provider] || provider) + "... this calls an external service.";

      var call;
      var usedFallbackModel = null;
      if (provider === "anthropic") call = callAnthropicApi(apiKey, model, prompt);
      else if (provider === "gemini") call = callGeminiApi(apiKey, model, prompt);
      else if (provider === "pkdspt-shared") {
        call = withAiRetry(function () {
          return callPkdsptProxyApi(apiKey, model, prompt);
        }, function (attempt, max, wait) {
          status.textContent = "Google's servers are busy (503). Retrying " +
            attempt + " of " + (max - 1) + " in " + Math.round(wait / 100) / 10 + "s...";
        }).catch(function (err) {
          var alt = AI_MODEL_FALLBACKS[model];
          if (!alt || !isRetryableAiError(err)) throw err;
          status.textContent = model + " is still overloaded — trying " + alt + " instead...";
          return withAiRetry(function () {
            return callPkdsptProxyApi(apiKey, alt, prompt);
          }).then(function (r) {
            usedFallbackModel = alt;
            return r;
          });
        });
      }
      else call = callOpenAiApi(apiKey, model, prompt);

      call.then(function (resultObj) {
        var filled = fillFieldsFromAiResult(resultObj, overwrite);
        status.textContent = "Done - filled " + filled + " field(s)." +
          (usedFallbackModel ? " (used " + usedFallbackModel + " — the newer model was overloaded)" : "") +
          " Review everything before generating the note.";
      }).catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        if (msg.indexOf("(503)") !== -1) {
          msg = "Google Gemini is overloaded right now (503) — tried " + AI_RETRY_MAX +
                " times. This is capacity on Google's side, not your access code or quota. " +
                "Wait a minute and try again, or fill the fields manually below.";
        } else if (msg.indexOf("Failed to fetch") !== -1 || msg.indexOf("NetworkError") !== -1) {
          msg += " (Likely blocked by the browser/provider - CORS restrictions apply, especially for OpenAI called directly from a browser.)";
        }
        status.textContent = "Error: " + msg;
      }).finally(function () {
        btn.disabled = false;
      });
    });
  }

  // ---------------------------------------------------------------------
  // MyMAAT setup
  // ---------------------------------------------------------------------

  var MYMAAT_LABELS = [
    "1. Failed to take as instructed",
    "2. Reduced medication when feeling well",
    "3. Took medication alternately",
    "4. Missed pharmacy refill appointment",
    "5. Excess medication at home",
    "6. Took only part of prescribed medication",
    "7. Forgot medication",
    "8. Reduced dose due to side-effect concern",
    "9. Needs reminder from others",
    "10. Uncertain about daily dose",
    "11. Unable to manage medication intake",
    "12. Lack of family/social support"
  ];

  // Full question text for reading aloud to the patient. English and Bahasa
  // Malaysia are the official wording from Borang MyMAAT 2020 (KKM & UKM).
  // Simplified Chinese is a faithful translation for the same purpose.
  var MYMAAT_QUESTIONS_FULL = [
    {
      en: "In the past one month, I frequently failed to take my medication in accordance with the doctor's instruction.",
      bm: "Dalam sebulan yang lepas, saya kerap tidak mengambil ubat seperti yang diarahkan oleh doktor.",
      zh: "在过去一个月里，我经常没有按照医生的指示服药。"
    },
    {
      en: "In the past one month, I reduced my medication intake when I felt better.",
      bm: "Dalam sebulan yang lepas, saya mengurangkan pengambilan ubat apabila berasa sihat.",
      zh: "在过去一个月里，感觉好一些时我会减少服药量。"
    },
    {
      en: "In the past one month, I took my medication alternately.",
      bm: "Dalam sebulan yang lepas, saya mengambil ubat secara berselang-seli.",
      zh: "在过去一个月里，我曾经断断续续（不定时）地服药。"
    },
    {
      en: "I was often late on / missed the appointment date to get the supplies of my follow-up medication at the pharmacy counter.",
      bm: "Saya sering terlewat/terlepas untuk temujanji pengambilan ubat susulan di kaunter farmasi.",
      zh: "我经常迟到或错过到药剂柜台领取续发药物的预约。"
    },
    {
      en: "I have excess supply of the prescribed medication at home.",
      bm: "Daripada bekalan ubat yang diterima, saya mempunyai banyak lebihan ubat di rumah.",
      zh: "从领取的药物中，我家里还剩下很多没吃完的药。"
    },
    {
      en: "I did not fully comply with the prescriptions because I felt it was unnecessary/insignificant.",
      bm: "Saya hanya mengambil sebahagian sahaja daripada ubat yang diberikan kerana merasakan ianya tidak perlu/tidak penting.",
      zh: "我只服用了部分药物，因为觉得没有必要/不重要。"
    },
    {
      en: "In the past one month, I frequently failed to remember to take my medication.",
      bm: "Dalam sebulan yang lepas, saya sering terlupa untuk mengambil ubat saya.",
      zh: "在过去一个月里，我经常忘记服药。"
    },
    {
      en: "I regularly take less medication than prescribed for fear of the side effects to my body.",
      bm: "Saya sering mengurangkan pengambilan ubat kerana bimbang akan kesan sampingnya terhadap badan.",
      zh: "我经常因为担心副作用而减少服药量。"
    },
    {
      en: "I will miss/not take my medication if no one reminds me to do so.",
      bm: "Saya tidak mengambil ubat apabila tiada sesiapa mengingatkan saya.",
      zh: "如果没有人提醒，我就不会服药。"
    },
    {
      en: "I am uncertain about my daily medication doses.",
      bm: "Saya tidak begitu pasti tentang dos ubat yang perlu diambil setiap hari.",
      zh: "我不太确定每天应该服用的药物剂量。"
    },
    {
      en: "I am unable to manage my medication intake properly.",
      bm: "Saya tidak boleh menguruskan pengambilan ubat saya dengan baik.",
      zh: "我无法妥善处理/管理自己的服药情况。"
    },
    {
      en: "Without support or help from the loved ones, I lack motivation to take my medication as prescribed by the doctor.",
      bm: "Ketiadaan sokongan atau pertolongan dari orang tersayang menyebabkan saya tidak bermotivasi untuk mengambil ubat yang diberikan oleh doktor.",
      zh: "由于缺乏亲人的支持或帮助，我没有动力按照医生的指示服药。"
    }
  ];

  var SCORE_OPTIONS = [
    { value: 5, label: "5 - Strongly Disagree" },
    { value: 4, label: "4 - Disagree" },
    { value: 3, label: "3 - Neutral" },
    { value: 2, label: "2 - Agree" },
    { value: 1, label: "1 - Strongly Agree" }
  ];

  var PHRASE_TO_SCORE = {
    "strongly disagree": 5,
    "disagree": 4,
    "neutral": 3,
    "strongly agree": 1,
    "agree": 2
  };

  var myMaatScores = new Array(12).fill(null);
  var myMaatSummaryAutoText = ""; // tracks last auto-generated text so we don't clobber manual edits

  // ---------------------------------------------------------------------
  // Flipchart auto-entry (PHIS note only, audit requirement)
  // Visit number 1-4 maps to the matching DMTAC flipchart module.
  // English titles translated from the official MOH DMTAC flipchart PDFs
  // (Program Perkhidmatan Farmasi, KKM - Modul Pembelajaran Pesakit, MTAC Diabetes).
  // ---------------------------------------------------------------------

  var FLIPCHART_TOPICS = [
    "Diabetes and Oral Medications",            // Sesi Pertama / Session 1
    "Insulin and Self-Monitoring of Blood Glucose (SMBG)", // Sesi Kedua / Session 2
    "Healthy Lifestyle",                        // Sesi Ketiga / Session 3
    "Diabetes and Complications"                // Sesi Keempat / Session 4
  ];

  // ---------------------------------------------------------------------
  // Newly started SGLT2i / GLP-1 RA this visit
  // CCMS (short note): MOA/administration/side-effect counselling wording in Plan.
  // PHIS (full note): flipchart-used note in DMTAC Patient Education.
  // ---------------------------------------------------------------------

  function getNewTherapyPlanLine() {
    var parts = [];
    if (document.getElementById("newSglt2").checked) {
      parts.push("Counsel patient on mechanism of action, administration method, and side effect management of SGLT2 inhibitor (newly started).");
    }
    if (document.getElementById("newGlp1").checked) {
      parts.push("Counsel patient on mechanism of action, administration method, and side effect management of GLP-1 receptor agonist (newly started).");
    }
    return parts.join(" ");
  }

  function getNewTherapyFlipchartLine() {
    var parts = [];
    if (document.getElementById("newSglt2").checked) {
      parts.push("Flipchart (SGLT2 inhibitor) used for patient counselling on newly started therapy.");
    }
    if (document.getElementById("newGlp1").checked) {
      parts.push("Flipchart (GLP-1 RA) used for patient counselling on newly started therapy.");
    }
    return parts.join(" ");
  }

  // ---------------------------------------------------------------------
  // Counselled but not recruited into MTAC
  // ---------------------------------------------------------------------

  function initNotRecruited() {
    var cb = document.getElementById("notRecruited");
    var panel = document.getElementById("notRecruitedReasons");
    cb.addEventListener("change", function () {
      panel.style.display = cb.checked ? "block" : "none";
    });
  }

  function getNotRecruitedLine() {
    var cb = document.getElementById("notRecruited");
    if (!cb.checked) return "";
    var reasons = [];
    document.querySelectorAll(".notRecruitedReason:checked").forEach(function (r) {
      if (r.value === "__other__") {
        var other = document.getElementById("notRecruitedOtherText").value.trim();
        if (other) reasons.push(other);
      } else {
        reasons.push(r.value);
      }
    });
    var base = "Counselled but not recruited into MTAC.";
    if (reasons.length) base += " Reason(s): " + reasons.join("; ") + ".";
    return base;
  }

  function resetNotRecruited() {
    document.getElementById("notRecruited").checked = false;
    document.getElementById("notRecruitedReasons").style.display = "none";
    document.querySelectorAll(".notRecruitedReason").forEach(function (r) { r.checked = false; });
    document.getElementById("notRecruitedOtherText").value = "";
  }

  function initDischarge() {
    var cb = document.getElementById("dischargedDmtac");
    var panel = document.getElementById("dischargeReasonPanel");
    cb.addEventListener("change", function () {
      panel.style.display = cb.checked ? "block" : "none";
    });
  }

  function getDischargeLine() {
    var cb = document.getElementById("dischargedDmtac");
    if (!cb.checked) return "";
    var reason = document.getElementById("dischargeReason").value.trim();
    var base = "Discharged from DMTAC.";
    if (reason) base += " Reason: " + reason + ".";
    return base;
  }

  function resetDischarge() {
    document.getElementById("dischargedDmtac").checked = false;
    document.getElementById("dischargeReasonPanel").style.display = "none";
    document.getElementById("dischargeReason").value = "";
  }

  // ---------------------------------------------------------------------
  // Pharmaceutical Care Issue (PHIS note only)
  // Type of Intervention -> Description option map, matching the live PHIS
  // "Pharmaceutical Care Issue" screen exactly (verified against the KKSJ
  // PHIS instance, MTAC Reporting module).
  // ---------------------------------------------------------------------

  var PCI_DESCRIPTION_MAP = {
    "Inappropriate Prescription": ["Contraindication", "Drug Interaction", "Incompatibility", "Polypharmacy"],
    "Incomplete Prescriptions": ["Dose", "Dr's Stamp And Sign", "Drug", "Duration", "Frequency", "Patient Data"],
    "Incorrect/Inappropriate/Inadequate Regimen": ["Dose", "Drug", "Duration", "Frequency"],
    "Miscellaneous": [
      "Authenticity of Prescription/Prescriber",
      "Drug Administration Error",
      "Drug Not In Formulary",
      "Others",
      "Suggest for Vital/Signs Monitoring/Laboratory Investigation",
      "TDM",
      "TPN",
      "Unclear Handwriting",
      "Wrong Patient"
    ]
  };

  // ---------------------------------------------------------------------
  // Repeatable Pharmaceutical Care Issues.
  //
  // PHIS records ONE Pharmaceutical Care Issue per entry, but a visit can
  // legitimately raise more than one. Rather than forcing the pharmacist to
  // pick a single issue, this renders a list of PCI cards with a "+" button;
  // each card is emitted as its own PHIS PCI block.
  //
  // The free-text boxes that used to duplicate the Assessment/Plan section
  // (issue detail, recommendation) are pre-filled from the Issue and Plan
  // fields, so the pharmacist writes once and edits only if the PCI needs
  // narrower wording than the CCMS issue list.
  // ---------------------------------------------------------------------

  var PCI_STATUS_OPTIONS = ["Accepted", "Not Accepted", "Not Available"];
  var pciCardSeq = 0;

  function pciBuildSelect(id, placeholder, options) {
    var sel = document.createElement("select");
    sel.id = id;
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder;
    sel.appendChild(ph);
    (options || []).forEach(function (o) {
      var op = document.createElement("option");
      op.value = o; op.textContent = o;
      sel.appendChild(op);
    });
    return sel;
  }

  function pciLabelled(text, node) {
    var lab = document.createElement("label");
    lab.appendChild(document.createTextNode(text));
    lab.appendChild(node);
    return lab;
  }

  function pciTextarea(id, rows) {
    var wrap = document.createElement("div");
    wrap.className = "field-with-dictate";
    var ta = document.createElement("textarea");
    ta.id = id; ta.rows = rows || 2;
    var mic = document.createElement("button");
    mic.type = "button"; mic.className = "mic-btn"; mic.dataset.target = id;
    mic.innerHTML = "&#127908;";
    wrap.appendChild(ta); wrap.appendChild(mic);
    return wrap;
  }

  function pciBank(target, phrases) {
    var bank = document.createElement("div");
    bank.className = "phrase-bank";
    bank.dataset.target = target;
    phrases.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "phrase-btn"; b.textContent = t;
      bank.appendChild(b);
    });
    return bank;
  }

  var PCI_RECOMMENDATION_PHRASES = [
    "Recommend insulin dose optimisation based on the patient's SMBG readings.",
    "Recommend intensifying therapy as glycaemic target not met.",
    "Recommend dose up-titration.",
    "Recommend dose reduction due to hypoglycaemia.",
    "Recommend renal dose adjustment.",
    "Recommend adding an SGLT2 inhibitor for kidney/CV protection.",
    "Recommend starting or intensifying statin therapy per CV risk category.",
    "Recommend stopping a duplicate/unnecessary agent.",
    "Recommend switching to a safer alternative.",
    "Recommend simplifying the regimen to support adherence.",
    "Recommend repeating/adding a monitoring investigation.",
    "Adherence counselling given; no medication change recommended."
  ];
  var PCI_OUTCOME_PHRASES = [
    "Recommendation accepted and implemented.",
    "Recommendation accepted, to be implemented at next clinic review.",
    "Recommendation not accepted; rationale documented by the prescriber.",
    "Pending prescriber review.",
    "Resolved by pharmacist counselling alone.",
    "Ongoing — to reassess next visit."
  ];
  var PCI_FOLLOWUP_PHRASES = [
    "Reassess at next DMTAC visit.",
    "Recheck relevant bloods before the next visit.",
    "Monitor SMBG and review the diary next visit.",
    "Monitor for the side effect discussed.",
    "Escalate to MO/FMS if unresolved.",
    "No further follow-up required for this issue."
  ];

  function rebuildPciDescOptions(descSel, type) {
    var options = PCI_DESCRIPTION_MAP[type];
    descSel.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = options ? "-- Select --" : "-- Select Type of Intervention first --";
    descSel.appendChild(ph);
    if (options) {
      options.forEach(function (o) {
        var op = document.createElement("option");
        op.value = o; op.textContent = o;
        descSel.appendChild(op);
      });
    }
  }

  function addPciCard(prefill) {
    var list = document.getElementById("pciList");
    if (!list) return null;
    pciCardSeq += 1;
    var n = pciCardSeq;

    var card = document.createElement("div");
    card.className = "pci-card";
    card.dataset.pciCard = String(n);

    var head = document.createElement("div");
    head.className = "pci-card-head";
    var title = document.createElement("strong");
    title.className = "pci-card-title";
    title.textContent = "Pharmaceutical Care Issue";
    var rm = document.createElement("button");
    rm.type = "button"; rm.className = "secondary-btn pci-remove";
    rm.textContent = "Remove";
    rm.addEventListener("click", function () {
      card.parentNode.removeChild(card);
      renumberPciCards();
    });
    head.appendChild(title); head.appendChild(rm);
    card.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "grid grid-2";
    var typeSel = pciBuildSelect("pciType-" + n, "-- Select --", Object.keys(PCI_DESCRIPTION_MAP));
    var descSel = pciBuildSelect("pciDescription-" + n, "-- Select Type of Intervention first --", null);
    typeSel.addEventListener("change", function () { rebuildPciDescOptions(descSel, typeSel.value); });
    grid.appendChild(pciLabelled("Type of Intervention", typeSel));
    grid.appendChild(pciLabelled("Description", descSel));
    card.appendChild(grid);

    card.appendChild(pciLabelled("PCI (issue as it should read in PHIS)", pciTextarea("pciDetails-" + n)));
    card.appendChild(pciBank("pciDetails-" + n, ["Insulin dose optimised/titrated based on the patient's SMBG readings."]));

    card.appendChild(pciLabelled("Pharmacist Recommendation", pciTextarea("pciRecommendation-" + n)));
    card.appendChild(pciBank("pciRecommendation-" + n, PCI_RECOMMENDATION_PHRASES));

    var grid2 = document.createElement("div");
    grid2.className = "grid grid-2";
    grid2.appendChild(pciLabelled("Status of Intervention", pciBuildSelect("pciStatus-" + n, "-- Select --", PCI_STATUS_OPTIONS)));
    card.appendChild(grid2);

    card.appendChild(pciLabelled("Outcome", pciTextarea("pciOutcome-" + n)));
    card.appendChild(pciBank("pciOutcome-" + n, PCI_OUTCOME_PHRASES));

    card.appendChild(pciLabelled("Follow-up", pciTextarea("pciFollowUp-" + n)));
    card.appendChild(pciBank("pciFollowUp-" + n, PCI_FOLLOWUP_PHRASES));

    list.appendChild(card);

    // Wire the newly created controls (scoped so existing ones are not re-bound).
    initPhraseBanksIn(card);
    initDictationIn(card);

    if (prefill) {
      if (prefill.type) {
        typeSel.value = prefill.type;
        rebuildPciDescOptions(descSel, prefill.type);
        if (prefill.desc) descSel.value = prefill.desc;
      }
      if (prefill.detail) document.getElementById("pciDetails-" + n).value = prefill.detail;
    }

    renumberPciCards();
    return card;
  }

  function renumberPciCards() {
    var cards = document.querySelectorAll("#pciList .pci-card");
    cards.forEach(function (c, i) {
      var t = c.querySelector(".pci-card-title");
      if (t) t.textContent = "Pharmaceutical Care Issue " + (i + 1);
    });
    var empty = document.getElementById("pciEmptyNote");
    if (empty) empty.style.display = cards.length ? "none" : "";
  }

  function initPci() {
    var addBtn = document.getElementById("pciAddBtn");
    if (addBtn) addBtn.addEventListener("click", function () { addPciCard(null); });
    renumberPciCards();
  }

  function resetPci() {
    var list = document.getElementById("pciList");
    if (list) list.innerHTML = "";
    pciCardSeq = 0;
    renumberPciCards();
  }

  // Returns an array of PCI blocks (each an array of [label, value] pairs),
  // one per card that has a Type of Intervention selected. Cards with no
  // Type are skipped, so an empty/abandoned card never reaches the note.
  function getPciBlocks() {
    var out = [];
    document.querySelectorAll("#pciList .pci-card").forEach(function (card) {
      var n = card.dataset.pciCard;
      function v(prefix) {
        var el = document.getElementById(prefix + "-" + n);
        return el ? el.value.trim() : "";
      }
      var type = v("pciType");
      if (!type) return;
      var lines = [];
      var typeDescLine = "Type of Intervention: " + type;
      if (v("pciDescription")) typeDescLine += " | Description: " + v("pciDescription");
      lines.push(["", typeDescLine]);
      if (v("pciDetails")) lines.push(["PCI:", v("pciDetails")]);
      if (v("pciRecommendation")) lines.push(["Pharmacist Recommendation:", v("pciRecommendation")]);
      if (v("pciStatus")) lines.push(["Status of Intervention:", v("pciStatus")]);
      if (v("pciOutcome")) lines.push(["Outcome:", v("pciOutcome")]);
      if (v("pciFollowUp")) lines.push(["PCI Follow-up:", v("pciFollowUp")]);
      out.push(lines);
    });
    return out;
  }

  // ---------------------------------------------------------------------
  // MTAC Status (PHIS Reporting block only) - derived, not manually entered.
  // Mirrors the PHIS MTAC Status dropdown (Discharged / Need Follow Up).
  // ---------------------------------------------------------------------

  function getMtacStatusValue() {
    if (document.getElementById("notRecruited").checked) return "";
    if (document.getElementById("dischargedDmtac").checked) return "Discharged";
    return "Need Follow Up";
  }

  function getFlipchartLabel(visitNumberStr) {
    var n = parseInt(visitNumberStr, 10);
    if (!n || n < 1 || n > FLIPCHART_TOPICS.length) return null;
    return "Flipchart " + n + ": " + FLIPCHART_TOPICS[n - 1];
  }

  function updateFlipchartIndicator() {
    var indicator = document.getElementById("flipchartIndicator");
    var visitVal = document.getElementById("visitNumber").value;
    var label = getFlipchartLabel(visitVal);
    if (!visitVal) {
      indicator.textContent = "Enter a visit number above.";
    } else if (label) {
      indicator.textContent = label + " will be added automatically to the PHIS note.";
    } else {
      indicator.textContent = "No flipchart required for visit " + visitVal + " (only visits 1–4 have a flipchart).";
    }
  }

  function buildMyMaatList() {
    var ol = document.getElementById("myMaatItems");
    ol.innerHTML = "";
    MYMAAT_LABELS.forEach(function (label, idx) {
      var li = document.createElement("li");
      li.className = "myMaat-li";

      var row = document.createElement("div");
      row.className = "myMaat-item";

      var span = document.createElement("span");
      span.className = "item-label";
      span.textContent = label;
      row.appendChild(span);

      SCORE_OPTIONS.forEach(function (opt) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "score-btn";
        btn.textContent = opt.label;
        btn.dataset.itemIndex = idx;
        btn.dataset.value = opt.value;
        btn.addEventListener("click", function () {
          setMyMaatScore(idx, opt.value);
        });
        row.appendChild(btn);
      });

      li.appendChild(row);

      var q = MYMAAT_QUESTIONS_FULL[idx];
      if (q) {
        var qDiv = document.createElement("div");
        qDiv.className = "myMaat-question-langs";
        qDiv.innerHTML =
          "<span class=\"lang-tag\">EN</span> " + q.en + "<br>" +
          "<span class=\"lang-tag\">BM</span> " + q.bm + "<br>" +
          "<span class=\"lang-tag\">ZH</span> " + q.zh;
        li.appendChild(qDiv);
      }

      ol.appendChild(li);
    });
  }

  function setMyMaatScore(itemIndex, value) {
    myMaatScores[itemIndex] = value;
    refreshMyMaatButtons();
    updateMyMaatTotals();
  }

  function refreshMyMaatButtons() {
    var buttons = document.querySelectorAll("#myMaatItems .score-btn");
    buttons.forEach(function (btn) {
      var idx = Number(btn.dataset.itemIndex);
      var val = Number(btn.dataset.value);
      btn.classList.toggle("selected", myMaatScores[idx] === val);
    });
  }

  function updateMyMaatTotals() {
    var answered = myMaatScores.filter(function (v) { return v !== null; });
    var total = answered.reduce(function (a, b) { return a + b; }, 0);
    var totalEl = document.getElementById("myMaatTotal");
    var catEl = document.getElementById("myMaatCategory");
    var probEl = document.getElementById("myMaatProblemItems");

    if (answered.length === 0) {
      totalEl.textContent = "-- / 60";
      catEl.textContent = "--";
      probEl.textContent = "--";
      return;
    }

    totalEl.textContent = total + " / 60" + (answered.length < 12 ? " (" + answered.length + "/12 answered)" : "");

    var category = "--";
    if (answered.length === 12) {
      category = total >= 50 ? "Good adherence" : "Moderate-poor adherence";
    } else {
      category = "Incomplete (" + answered.length + "/12 answered)";
    }
    catEl.textContent = category;

    var problemItems = [];
    myMaatScores.forEach(function (v, idx) {
      if (v !== null && v <= 3) problemItems.push("Q" + (idx + 1));
    });
    probEl.textContent = problemItems.length ? problemItems.join(", ") : "None";

    autoFillMyMaatSummary(total, category, problemItems, answered.length === 12);
  }

  function autoFillMyMaatSummary(total, category, problemItems, complete) {
    var summaryBox = document.getElementById("myMaatSummary");
    if (!complete) return;

    var catShort = category === "Good adherence" ? "good adherence" : "moderate-poor adherence";
    var text;
    if (problemItems.length === 0) {
      text = "MyMAAT score " + total + "/60, " + catShort + ". No problem items identified.";
    } else {
      text = "MyMAAT score " + total + "/60, " + catShort + ". Problem items: " + problemItems.join(", ") + ".";
    }

    // Only overwrite if the field is empty or still holds our previous auto-text
    if (summaryBox.value === "" || summaryBox.value === myMaatSummaryAutoText) {
      summaryBox.value = text;
      myMaatSummaryAutoText = text;
    }
  }

  function parseMyMaatVoiceInput() {
    var input = document.getElementById("myMaatVoiceInput").value.trim();
    var warningEl = document.getElementById("myMaatVoiceWarning");
    warningEl.textContent = "";

    if (!input) {
      warningEl.textContent = "Enter or dictate MyMAAT scores first.";
      return;
    }

    var lower = input.toLowerCase();

    // Phrase-based pattern: "question 1 strongly disagree, question 2 disagree ..."
    var phraseRegex = /question\s*(\d{1,2})[^a-z0-9]{0,12}(strongly disagree|strongly agree|disagree|agree|neutral)/gi;
    var phraseMatches = [];
    var m;
    while ((m = phraseRegex.exec(lower)) !== null) {
      phraseMatches.push(m);
    }

    if (phraseMatches.length > 0) {
      var updated = 0;
      phraseMatches.forEach(function (match) {
        var qnum = parseInt(match[1], 10);
        var phrase = match[2];
        if (qnum >= 1 && qnum <= 12 && PHRASE_TO_SCORE.hasOwnProperty(phrase)) {
          myMaatScores[qnum - 1] = PHRASE_TO_SCORE[phrase];
          updated++;
        }
      });
      refreshMyMaatButtons();
      updateMyMaatTotals();
      warningEl.style.color = "";
      warningEl.textContent = "Updated " + updated + " of 12 items from voice input.";
      return;
    }

    // Numeric list pattern: standalone digits 1-5
    var numberMatches = input.match(/\b[1-5]\b/g) || [];

    if (numberMatches.length === 12) {
      numberMatches.forEach(function (n, idx) {
        myMaatScores[idx] = Number(n);
      });
      refreshMyMaatButtons();
      updateMyMaatTotals();
      warningEl.textContent = "";
    } else if (numberMatches.length < 12) {
      numberMatches.forEach(function (n, idx) {
        myMaatScores[idx] = Number(n);
      });
      refreshMyMaatButtons();
      updateMyMaatTotals();
      warningEl.textContent = "Only " + numberMatches.length + "/12 MyMAAT responses detected. Please complete missing items.";
    } else {
      warningEl.textContent = "More than 12 values detected. Please check the input.";
    }
  }

  // ---------------------------------------------------------------------
  // PHIS Audit-Required Checklist
  // Sourced from MOH "Senarai Semak Pemantauan Kualiti Perkhidmatan MTAC
  // Diabetes Mellitus (DMTAC)" (Kemaskini Mei 2025) and ADAF (Audit
  // Dokumentasi & Amalan Farmasi) MTAC-Diabetes indicators (Section F & H).
  // Facility/operational items (staffing, protocols, statistics, records)
  // are out of scope for a per-visit note and are not included here -
  // only per-encounter documentation/counselling items are listed.
  // PHIS note only - never added to the short CCMS note.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // PHIS audit-required checklist.
  //
  // Sources: MOH "Senarai Semak Pemantauan Kualiti Perkhidmatan MTAC
  // Diabetes Mellitus (DMTAC)" (Kemaskini Mei 2025), Sections 7 (Umum),
  // 8 (Penggunaan Insulin) and 9 (Kaunseling ubat OGLD); and the ADAF
  // (Audit Dokumentasi & Amalan Farmasi) MTAC instrument, Sections E
  // (Proses Pelaksanaan) and F (Dokumentasi).
  //
  // These used to live in one collapsed block at the end of the
  // Pharmacotherapy Review, which meant a pharmacist had to remember to
  // open it - easy to miss. Each group now carries an `anchor` naming a
  // container that sits INLINE, always visible, directly under the
  // clinical section it belongs to, so the items are met naturally in the
  // course of clerking. Ticked items still go to the PHIS note ONLY.
  // ---------------------------------------------------------------------
  var AUDIT_CHECKLIST = [
    {
      group: "Audit: CPG parameter review",
      anchor: "auditAnchorCpg",
      note: "SENARAI SEMAK 7.1-7.4; ADAF F2.6",
      items: [
        { id: "target", label: "Therapeutic target reviewed", phrase: "Therapeutic target reviewed." },
        { id: "statin", label: "Statin use assessed (age >40)", phrase: "Statin use assessed (age >40)." },
        { id: "acei", label: "ACEI/ARB first-line antihypertensive assessed", phrase: "ACEI/ARB first-line antihypertensive assessed." },
        { id: "antiplatelet", label: "Antiplatelet for secondary CVD prevention assessed", phrase: "Antiplatelet for secondary CVD prevention assessed." },
        { id: "renal", label: "Renal function reviewed, dose adjusted if needed", phrase: "Renal function reviewed, dose adjusted if needed." },
        { id: "proteinuria", label: "Proteinuria / urine microalbumin monitored", phrase: "Proteinuria/urine microalbumin monitored." },
        { id: "safetylabs", label: "Lipid profile / LFT reviewed (medication safety)", phrase: "Lipid profile/LFT reviewed for medication safety monitoring." }
      ]
    },
    {
      group: "Audit: medication list",
      anchor: "auditAnchorMeds",
      note: "SENARAI SEMAK 7.2.1; ADAF F2.2-F2.3",
      items: [
        { id: "interaction", label: "Drug interaction checked", phrase: "Drug interaction checked." },
        { id: "storageadvice", label: "Medication storage & disposal advice given at supply", phrase: "Medication storage and disposal advice given at supply." }
      ]
    },
    {
      group: "Audit: OGLD / other agent counselling",
      anchor: "auditAnchorOgld",
      note: "SENARAI SEMAK 9.1-9.2",
      items: [
        { id: "sglt2", label: "SGLT2 inhibitor counselling given", phrase: "SGLT2 inhibitor counselling given (indication/dose/MOA, urinary frequency, BP & glucose-lowering effect, UTI/genital infection risk, sick day rules, hydration, euglycaemic DKA risk)." },
        { id: "glp1", label: "GLP-1 RA counselling given", phrase: "GLP-1 RA counselling given (indication/dose/timing/MOA, oral vs injection technique, GI side effects and management)." }
      ]
    },
    {
      group: "Audit: SMBG",
      anchor: "auditAnchorSmbg",
      note: "SENARAI SEMAK 7.5, 8.5",
      items: [
        { id: "smbgcounsel", label: "SMBG counselling given, diary/record provided", phrase: "SMBG counselling given, diary/record provided." },
        { id: "smbginsulin", label: "SMBG monitoring advised per insulin regimen", phrase: "SMBG monitoring advised per insulin regimen." }
      ]
    },
    {
      group: "Audit: insulin dose",
      anchor: "auditAnchorInsulinDose",
      note: "SENARAI SEMAK 8.6, 8.7, 8.10",
      items: [
        { id: "regimenappropriate", label: "Insulin regimen appropriateness assessed", phrase: "Insulin regimen appropriateness assessed." },
        { id: "insulindoseaudit", label: "Insulin dose adjusted based on SMBG/HbA1c/renal profile", phrase: "Insulin dose adjusted based on SMBG/HbA1c/renal profile." },
        { id: "fastingdose", label: "Insulin dose adjusted for fasting (e.g. Ramadan)", phrase: "Insulin dose adjusted for fasting (e.g. Ramadan)." }
      ]
    },
    {
      group: "Audit: hypoglycaemia",
      anchor: "auditAnchorHypo",
      note: "SENARAI SEMAK 7.10, 8.8",
      items: [
        { id: "hypocounsel", label: "Hypoglycaemia and its management counselled", phrase: "Hypoglycaemia and its management counselled." },
        { id: "hyperhypo", label: "Hyper/hypoglycaemia symptoms & management counselled", phrase: "Hyper/hypoglycaemia symptoms and management counselled." }
      ]
    },
    {
      group: "Audit: injection technique",
      anchor: "auditAnchorInsulin",
      note: "SENARAI SEMAK 8.1-8.4, 8.11",
      items: [
        { id: "insulintech2", label: "Insulin injection technique counselled", phrase: "Insulin injection technique counselled." },
        { id: "rotation", label: "Needle/site rotation counselled (lipohypertrophy prevention)", phrase: "Needle and site rotation counselled to prevent lipohypertrophy." },
        { id: "injtiming", label: "Insulin injection timing counselled", phrase: "Insulin injection timing counselled." },
        { id: "insulinstorage", label: "Insulin storage counselled", phrase: "Insulin storage counselled." },
        { id: "sharpsdisposal", label: "Sharps, test strip & alcohol swab disposal counselled", phrase: "Sharps, test strip and alcohol swab disposal counselled." }
      ]
    },
    {
      group: "Audit: weight & lifestyle",
      anchor: "auditAnchorLifestyle",
      note: "SENARAI SEMAK 7.6, 7.7, 8.9",
      items: [
        { id: "bmi", label: "BMI assessed, lifestyle modification counselled", phrase: "BMI assessed, lifestyle modification counselled." },
        { id: "weightloss", label: "Weight loss counselling (target 10% in 6 months)", phrase: "Weight loss counselling (target 10% in 6 months) given." },
        { id: "weightinsulin", label: "Weight control counselled (insulin therapy)", phrase: "Weight control counselled (insulin therapy)." }
      ]
    },
    {
      group: "Audit: education topics",
      anchor: "auditAnchorEducation",
      note: "SENARAI SEMAK 7.8, 7.9, 7.11-7.16",
      items: [
        { id: "smoking", label: "Smoking cessation counselling given", phrase: "Smoking cessation counselling given." },
        { id: "sickday", label: "Sick day management counselled", phrase: "Sick day management counselled." },
        { id: "complications", label: "Micro/macrovascular complications counselled", phrase: "Micro/macrovascular complications counselled." },
        { id: "footcare", label: "Foot care education given", phrase: "Foot care education given." },
        { id: "specialpop", label: "Special population issue addressed (elderly / Ramadan)", phrase: "Special population issue addressed (elderly/Ramadan medication adjustment)." },
        { id: "tradmed", label: "Safe use of traditional medicine counselled", phrase: "Safe use of traditional medicine counselled." }
      ]
    }
  ];

  // Every audit checkbox carries .audit-cb so the note builder and the
  // reset/counter helpers can find them wherever they now live on the page.
  function buildAuditChecklist() {
    AUDIT_CHECKLIST.forEach(function (group) {
      var container = document.getElementById(group.anchor);
      if (!container) return;
      container.innerHTML = "";
      // Add rather than overwrite - some anchors already carry a layout
      // class (e.g. "full") from the grid they sit in.
      container.classList.add("audit-group", "audit-inline");

      var h4 = document.createElement("h4");
      h4.textContent = group.group;
      var countSpan = document.createElement("span");
      countSpan.className = "audit-count";
      countSpan.dataset.for = group.anchor;
      h4.appendChild(countSpan);
      container.appendChild(h4);

      if (group.note) {
        var noteP = document.createElement("p");
        noteP.className = "hint";
        noteP.style.margin = "0 0 4px 0";
        noteP.textContent = group.note + " — ticked items go to the PHIS note only.";
        container.appendChild(noteP);
      }

      group.items.forEach(function (item) {
        var label = document.createElement("label");
        label.className = "audit-item";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "audit-cb";
        cb.id = "audit-" + item.id;
        cb.dataset.phrase = item.phrase;
        cb.addEventListener("change", updateAuditCounts);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(item.label));
        container.appendChild(label);
      });
    });
    updateAuditCounts();
  }

  // Live "n of m ticked" badge on each inline group, so an untouched group
  // is visibly obvious rather than silently empty.
  function updateAuditCounts() {
    AUDIT_CHECKLIST.forEach(function (group) {
      var container = document.getElementById(group.anchor);
      if (!container) return;
      var boxes = container.querySelectorAll("input.audit-cb");
      var ticked = container.querySelectorAll("input.audit-cb:checked").length;
      var span = container.querySelector(".audit-count");
      if (!span) return;
      span.textContent = ticked + "/" + boxes.length;
      span.classList.toggle("audit-count-none", ticked === 0);
      span.classList.toggle("audit-count-done", ticked === boxes.length && boxes.length > 0);
    });
  }

  function getAuditChecklistLine() {
    var checked = document.querySelectorAll("input.audit-cb:checked");
    if (!checked.length) return "";
    var phrases = Array.prototype.map.call(checked, function (cb) { return cb.dataset.phrase; });
    return phrases.join(" ");
  }

  function resetAuditChecklist() {
    document.querySelectorAll("input.audit-cb").forEach(function (cb) {
      cb.checked = false;
    });
    updateAuditCounts();
  }

  // ---------------------------------------------------------------------
  // CKM (Cardiovascular-Kidney-Metabolic) syndrome staging.
  //
  // Source: 2026 AHA/ACC/ADA/ASN Guideline for the Prevention, Detection,
  // Evaluation, and Management of Cardiovascular-Kidney-Metabolic Syndrome
  // (Ndumele CE et al., Circulation 2026;154:e50-e158), CKM staging table.
  //
  //   Stage 0  No CKM risk factors
  //   Stage 1  Excess/dysfunctional adiposity alone - BMI >=23 (Asian
  //            ancestry), WC >=80 cm women / >=90 cm men (Asian), or
  //            prediabetic glycaemia (HbA1c 5.7-6.4%)
  //   Stage 2  Metabolic risk factors and/or moderate-to-high-risk CKD -
  //            hypertension (SBP >=130 / DBP >=80 or on antihypertensive),
  //            hypertriglyceridaemia (>=1.7 mmol/L), metabolic syndrome,
  //            T2D (HbA1c >=6.5%), and/or KDIGO moderate-high-risk CKD
  //   Stage 3  Subclinical CVD, or a risk equivalent - very-high-risk CKD
  //            (G4-G5 or KDIGO very high risk), or predicted 10-y CVD
  //            risk >=20%
  //   Stage 4  Clinical CVD (CHD, HF, stroke, PAD, AF)
  //            4a no kidney failure / 4b kidney failure (eGFR <15 or KRT)
  //
  // EVERY DMTAC patient has T2D, so all are at least stage 2 by definition -
  // the tool's value is in detecting the jump to 3 or 4, and in setting the
  // right monitoring interval.
  //
  // Unit note: the guideline is in mg/dL. Converted here to the mmol/L the
  // template already uses - triglycerides >=150 mg/dL = >=1.7 mmol/L,
  // fasting glucose 100-125 mg/dL = 5.6-6.9 mmol/L, >=126 mg/dL = >=7.0.
  // ---------------------------------------------------------------------

  function ckmGetCvdFlags() {
    var text = (val("comorbidities") + " " + val("assessment")).toLowerCase();
    var hits = [];
    if (/\bihd\b|coronary|angina|myocardial|\bmi\b|\bcad\b/.test(text)) hits.push("coronary heart disease");
    if (/heart failure|\bhf\b|cardiomyopath/.test(text)) hits.push("heart failure");
    if (/stroke|\bcva\b/.test(text)) hits.push("stroke");
    if (/\bpad\b|peripheral arterial|peripheral vascular/.test(text)) hits.push("PAD");
    if (/atrial fibrillation|\bafib\b|\baf\b/.test(text)) hits.push("atrial fibrillation");
    return hits;
  }

  function ckmKdigoRisk() {
    var egfr = parseFirstNumber(val("egfr"));
    var uacrRaw = val("uacr");
    var uacr = parseFirstNumber(uacrRaw);
    if (egfr === null && uacr === null) return null;
    var g = egfr !== null ? getGfrCategory(egfr) : null;
    var a = uacr !== null ? getAlbuminuriaCategory(uacr, /mmol/i.test(uacrRaw)) : null;
    if (!g || !a) return { partial: true, g: g, a: a };
    var risk = CKD_RISK_GRID[g.code] ? CKD_RISK_GRID[g.code][a.code] : null;
    return { g: g, a: a, risk: risk, egfr: egfr };
  }

  function computeCkmStage() {
    var reasons = { s1: [], s2: [], s3: [], s4: [] };

    // --- Stage 1: excess/dysfunctional adiposity ---
    var bmi = extractBmiFromText(val("weightBmi"));
    if (bmi !== null && bmi >= 23) reasons.s1.push("BMI " + bmi + " (≥ 23, Asian-ancestry cut-off)");
    var wc = parseFirstNumber(val("waistCircumference"));
    var sex = (document.getElementById("egfrCalcSex") || {}).value || (document.getElementById("lipidSex") || {}).value || "";
    if (wc !== null) {
      if (sex === "female" && wc >= 80) reasons.s1.push("waist " + wc + " cm (≥ 80 cm, Asian-ancestry cut-off for women)");
      else if (sex === "male" && wc >= 90) reasons.s1.push("waist " + wc + " cm (≥ 90 cm, Asian-ancestry cut-off for men)");
      else if (!sex && wc >= 80) reasons.s1.push("waist " + wc + " cm (at/above the Asian-ancestry cut-off — set sex for the exact threshold)");
    }
    var a1c = parseFirstNumber(val("hba1c"));
    if (a1c !== null && a1c >= 5.7 && a1c < 6.5) reasons.s1.push("HbA1c " + a1c + "% (prediabetic range 5.7–6.4%)");

    // --- Stage 2: metabolic risk factors / moderate-high-risk CKD ---
    if (a1c !== null && a1c >= 6.5) reasons.s2.push("HbA1c " + a1c + "% (≥ 6.5%, type 2 diabetes)");
    var bpTxt = val("bp");
    var bpNums = bpTxt ? bpTxt.match(/(\d{2,3})\s*\/\s*(\d{2,3})/) : null;
    if (bpNums) {
      var sbp = Number(bpNums[1]), dbp = Number(bpNums[2]);
      if (sbp >= 130 || dbp >= 80) reasons.s2.push("BP " + sbp + "/" + dbp + " (≥ 130 systolic or ≥ 80 diastolic)");
    }
    var tg = parseFirstNumber(val("tg"));
    if (tg !== null && tg >= 1.7) reasons.s2.push("triglycerides " + tg + " mmol/L (≥ 1.7 mmol/L = 150 mg/dL)");
    var kd = ckmKdigoRisk();
    if (kd && kd.risk) {
      if (kd.risk === "Moderately increased risk" || kd.risk === "High risk") {
        reasons.s2.push("KDIGO " + kd.g.code + kd.a.code + " — " + kd.risk.toLowerCase() + " CKD");
      }
    }

    // --- Stage 3: subclinical CVD or a risk equivalent ---
    if (kd && kd.risk === "Very high risk") {
      reasons.s3.push("KDIGO " + kd.g.code + kd.a.code + " — very-high-risk CKD (risk equivalent of subclinical CVD)");
    }
    var frs = (typeof lastLipidAssessment !== "undefined" && lastLipidAssessment) ? lastLipidAssessment : null;
    var lipidRisk = null;
    try { lipidRisk = computeFraminghamRisk(); } catch (e) { lipidRisk = null; }
    if (lipidRisk && !lipidRisk.error && lipidRisk.risk >= 20) {
      reasons.s3.push("estimated 10-year CVD risk " + lipidRisk.risk + "% (≥ 20%)");
    }

    // --- Stage 4: clinical CVD ---
    var cvd = ckmGetCvdFlags();
    if (cvd.length) reasons.s4.push("clinical CVD recorded: " + cvd.join(", "));

    var stage = null, label = "", why = [];
    if (reasons.s4.length) {
      var egfrNum = kd && kd.egfr !== undefined ? kd.egfr : parseFirstNumber(val("egfr"));
      var kidneyFailure = egfrNum !== null && egfrNum < 15;
      stage = kidneyFailure ? "4b" : "4a";
      label = "Stage " + stage + " — clinical CVD in CKM" + (kidneyFailure ? ", with kidney failure" : ", no kidney failure");
      why = reasons.s4.concat(kidneyFailure ? ["eGFR " + egfrNum + " (<15) — kidney failure"] : []);
    } else if (reasons.s3.length) {
      stage = "3"; label = "Stage 3 — subclinical CVD in CKM (or risk equivalent)"; why = reasons.s3;
    } else if (reasons.s2.length) {
      stage = "2"; label = "Stage 2 — metabolic risk factors and/or moderate-to-high-risk CKD"; why = reasons.s2;
    } else if (reasons.s1.length) {
      stage = "1"; label = "Stage 1 — excess or dysfunctional adiposity"; why = reasons.s1;
    } else {
      return null;
    }
    return { stage: stage, label: label, why: why, all: reasons };
  }

  var CKM_STAGE_ACTIONS = {
    "1": "Assess lipids, glycaemia and eGFR at least every 2–3 years; anthropometrics and BP annually. Focus on weight management and lifestyle to prevent progression.",
    "2": "Assess lipids, glycaemia, eGFR AND UACR yearly; anthropometrics and BP annually. Treat each metabolic risk factor to target, and use guideline-directed kidney/CV protective therapy (SGLT2i, RAASi) where indicated.",
    "3": "Highest-intensity risk-factor control — the management principles of stage 2 carry over, but absolute risk is substantially higher. Intensify lipid lowering and consider earlier combination therapy; ensure SGLT2i/GLP-1 RA are used where indicated.",
    "4a": "Established clinical CVD — secondary prevention targets apply (see the Lipid-Lowering Therapy Advisor: Very High risk, LDL-C ≤ 1.4 mmol/L). Ensure guideline-directed therapy for the specific cardiovascular condition alongside kidney protection.",
    "4b": "Clinical CVD with kidney failure (eGFR <15 or on kidney replacement therapy) — co-manage with nephrology; review every medication for renal dose adjustment and for agents to avoid."
  };

  function updateCkmStage() {
    var el = document.getElementById("ckmStageHint");
    if (!el) return;
    var res = computeCkmStage();
    if (!res) {
      el.style.display = "none";
      el.innerHTML = "";
      return;
    }
    el.style.display = "";
    var action = CKM_STAGE_ACTIONS[res.stage] || "";
    el.innerHTML = "<strong>CKM " + res.label + "</strong><br>Basis: " + res.why.join("; ") + ".<br>" + action;
  }

  function getCkmNoteText() {
    var res = computeCkmStage();
    if (!res) return "";
    return "CKM syndrome " + res.label + " (2026 AHA/ACC/ADA/ASN CKM Guideline). Basis: " + res.why.join("; ") + ".";
  }

  function initCkmStage() {
    ["weightBmi", "waistCircumference", "hba1c", "bp", "tg", "egfr", "uacr", "comorbidities", "assessment"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("input", updateCkmStage);
    });
    ["egfrCalcSex", "lipidSex"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("change", updateCkmStage);
    });
    updateCkmStage();
  }

  // ---------------------------------------------------------------------
  // Insulin Total Daily Dose (TDD) in IU/kg/day.
  //
  // Sources: Practical Guide to Insulin Therapy in Type 2 Diabetes Mellitus,
  // 2nd Ed. 2024 (Sections 5-6) and the DMTAC Pocket Guide to Insulin
  // Optimisation, 1st Ed. 2023 (note 3):
  //   - TDD for most patients          0.5-1.0 IU/kg/day
  //   - Obese / insulin-resistant      may exceed 1.0 IU/kg/day
  //   - TDD >1.5-2.0 IU/kg/day         look for an underlying cause
  //                                    (non-adherence, incorrect dose/timing,
  //                                    injection technique, occult infection)
  //   - Bolus insulin should not be >50% of TDD
  //   - Optimal BASAL dose: lean 0.2-0.3, most 0.4-0.5, obese up to 0.7 IU/kg
  //     (a basal component above ~0.5 IU/kg with HbA1c still off target is the
  //     classic over-basalisation picture the Assessment phrase bank names)
  //
  // Weight falls back to the Weight/BMI field in Objective so the pharmacist
  // does not have to type it twice.
  // ---------------------------------------------------------------------

  function tddNum(id) {
    var el = document.getElementById(id);
    if (!el || el.value === "") return null;
    var v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  }

  function getTddWeight() {
    var own = tddNum("tddWeight");
    if (own !== null && own > 0) return own;
    var field = document.getElementById("weightBmi");
    var w = field ? extractWeightFromText(field.value) : null;
    return (w !== null && w > 0) ? w : null;
  }

  function computeTdd() {
    var basal = tddNum("tddBasal") || 0;
    var bolus = tddNum("tddBolus") || 0;
    var premix = tddNum("tddPremix") || 0;
    var total = basal + bolus + premix;
    if (total <= 0) return null;
    return { total: total, basal: basal, bolus: bolus, premix: premix };
  }

  function updateTdd() {
    var resEl = document.getElementById("tddResultHint");
    var perKgEl = document.getElementById("tddPerKgHint");
    var flagEl = document.getElementById("tddFlagHint");
    if (!resEl) return;

    var compElClear = document.getElementById("tddComponentHint");
    var d = computeTdd();
    if (!d) {
      resEl.textContent = "";
      perKgEl.textContent = "";
      flagEl.textContent = "";
      if (compElClear) compElClear.innerHTML = "";
      return;
    }

    var parts = [];
    if (d.basal) parts.push("basal " + d.basal);
    if (d.bolus) parts.push("bolus " + d.bolus);
    if (d.premix) parts.push("premixed " + d.premix);
    resEl.textContent = "TDD = " + parts.join(" + ") + " = " + round1(d.total) + " IU/day.";

    var weight = getTddWeight();
    if (weight === null) {
      perKgEl.textContent = "Enter the body weight (or a weight in the Weight/BMI field in Objective) to get IU/kg/day.";
      flagEl.textContent = "";
      if (compElClear) compElClear.innerHTML = "";
      return;
    }

    var perKg = d.total / weight;
    var perKgR = Math.round(perKg * 100) / 100;
    var band;
    if (perKg < 0.5) band = "below the usual 0.5–1.0 IU/kg/day range — appropriate early in titration, otherwise there may be room to up-titrate if glycaemic targets are not met";
    else if (perKg <= 1.0) band = "within the usual 0.5–1.0 IU/kg/day range for most patients";
    else if (perKg <= 1.5) band = "above 1.0 IU/kg/day — acceptable in obese/insulin-resistant patients, but review whether it is justified";
    else band = "above 1.5 IU/kg/day";

    perKgEl.innerHTML = "TDD <strong>" + perKgR + " IU/kg/day</strong> (" + round1(d.total) + " IU ÷ " + weight + " kg) — " + band + ".";

    // ---------------------------------------------------------------
    // Per-component evaluation against the DMTAC teaching slide's
    // "Is there ideal doses for insulin treatment?" figures:
    //
    //                 Initiation          Optimal
    //   Basal         0.2 u/kg/day        0.5-0.7 u/kg/day
    //   Prandial      0.1 u/kg/dose       0.2-0.3 u/kg/dose
    //                                     (ideally not >0.5 u/kg/dose)
    //   Premixed      0.2 u/kg/dose       0.5 u/kg/dose
    //                                     0.5-1 u/kg/day most patients
    //                                     (>1 u/kg/day obese / insulin resistant)
    //
    // Each component gets its own line so the pharmacist can see at a
    // glance which part of the regimen is out of range, rather than
    // having to infer it from the total.
    // ---------------------------------------------------------------
    var comps = [];
    var flags = [];

    function comp(label, text, level) {
      comps.push({ label: label, text: text, level: level });
      if (level === "high") flags.push(text);
    }

    // --- Basal: optimal 0.5-0.7 IU/kg/day ---
    if (d.basal > 0) {
      var basalPerKg = Math.round((d.basal / weight) * 100) / 100;
      if (basalPerKg > 0.7) {
        comp("Basal", "Basal " + d.basal + " IU/day = " + basalPerKg + " IU/kg/day — EXCEEDS the optimal basal dose (0.5–0.7 IU/kg/day). If HbA1c remains off target with acceptable fasting readings this is over-basalisation; address post-prandial excursions rather than escalating basal further.", "high");
      } else if (basalPerKg >= 0.5) {
        comp("Basal", "Basal " + d.basal + " IU/day = " + basalPerKg + " IU/kg/day — at the top of the optimal range (0.5–0.7). If HbA1c is still off target despite fasting readings at goal, consider over-basalisation before increasing basal again.", "watch");
      } else if (basalPerKg < 0.2) {
        comp("Basal", "Basal " + d.basal + " IU/day = " + basalPerKg + " IU/kg/day — below the usual initiation dose (0.2 IU/kg/day); likely room to up-titrate if fasting readings are above target.", "low");
      } else {
        comp("Basal", "Basal " + d.basal + " IU/day = " + basalPerKg + " IU/kg/day — between initiation (0.2) and optimal (0.5–0.7).", "ok");
      }
    }

    // --- Prandial/bolus: optimal 0.2-0.3 IU/kg/dose, ceiling 0.5 ---
    if (d.bolus > 0) {
      var bolusDoses = tddNum("tddBolusDoses");
      var bolusPerKgDay = Math.round((d.bolus / weight) * 100) / 100;
      if (bolusDoses !== null && bolusDoses > 0) {
        var perDose = Math.round((d.bolus / bolusDoses / weight) * 100) / 100;
        var perDoseIU = Math.round((d.bolus / bolusDoses) * 10) / 10;
        var stem = "Prandial " + d.bolus + " IU/day over " + bolusDoses + " doses = " + perDoseIU + " IU/dose = " + perDose + " IU/kg/dose";
        if (perDose > 0.5) {
          comp("Prandial", stem + " — EXCEEDS the 0.5 IU/kg/dose ceiling (optimal 0.2–0.3 IU/kg/dose). Reassess adherence, technique, carbohydrate intake and insulin resistance before escalating further.", "high");
        } else if (perDose > 0.3) {
          comp("Prandial", stem + " — ABOVE the optimal 0.2–0.3 IU/kg/dose, still under the 0.5 ceiling.", "watch");
        } else if (perDose < 0.1) {
          comp("Prandial", stem + " — below the usual initiation dose (0.1 IU/kg/dose).", "low");
        } else {
          comp("Prandial", stem + " — within the optimal 0.2–0.3 IU/kg/dose range.", "ok");
        }
      } else {
        comp("Prandial", "Prandial " + d.bolus + " IU/day = " + bolusPerKgDay + " IU/kg/day total. Enter the number of bolus doses/day to check the per-dose figure against the optimal 0.2–0.3 IU/kg/dose (ceiling 0.5).", "info");
      }
    }

    // --- Premixed: 0.5 IU/kg/dose, 0.5-1 IU/kg/day in most patients ---
    if (d.premix > 0) {
      var premixDoses = tddNum("tddPremixDoses");
      var premixPerKgDay = Math.round((d.premix / weight) * 100) / 100;
      if (premixDoses !== null && premixDoses > 0) {
        var premixPerDose = Math.round((d.premix / premixDoses / weight) * 100) / 100;
        var premixPerDoseIU = Math.round((d.premix / premixDoses) * 10) / 10;
        var pstem = "Premixed " + d.premix + " IU/day over " + premixDoses + " doses = " + premixPerDoseIU + " IU/dose = " + premixPerDose + " IU/kg/dose";
        if (premixPerDose > 0.5) {
          comp("Premixed", pstem + " — EXCEEDS the 0.5 IU/kg/dose reference. Watch for between-meal hypoglycaemia; if hypoglycaemia limits optimisation, consider switching human premixed to a premixed analogue.", "high");
        } else if (premixPerDose < 0.2) {
          comp("Premixed", pstem + " — below the usual initiation dose (0.2 IU/kg/dose).", "low");
        } else {
          comp("Premixed", pstem + " — at or below the 0.5 IU/kg/dose reference.", "ok");
        }
      } else {
        comp("Premixed", "Premixed " + d.premix + " IU/day = " + premixPerKgDay + " IU/kg/day total. Enter the number of premixed doses/day to check the per-dose figure against the 0.5 IU/kg/dose reference.", "info");
      }
      if (premixPerKgDay > 1.0) {
        comp("Premixed (daily)", "Premixed total " + premixPerKgDay + " IU/kg/day — above the 0.5–1 IU/kg/day expected in most patients; >1 IU/kg/day is usually only appropriate in obese or insulin-resistant patients.", "high");
      }
    }

    // --- Whole-regimen checks ---
    if (d.bolus > 0 && d.bolus > d.total * 0.5) {
      flags.push("Bolus insulin is " + Math.round((d.bolus / d.total) * 100) + "% of TDD — in general bolus should not exceed 50% of the TDD; review the basal:bolus split. This is also a DMTAC recruitment criterion if the patient is not already enrolled.");
    }
    if (perKg >= 1.5) {
      flags.unshift("INVESTIGATE: insulin requirement ≥1.5 IU/kg/day — search for an underlying cause (non-adherence, incorrect dosing, incorrect timing, incorrect injection technique, occult infection). Note there is no absolute maximum insulin dose. This is also a DMTAC recruitment criterion if the patient is not already enrolled.");
    }

    var compEl = document.getElementById("tddComponentHint");
    if (compEl) {
      compEl.innerHTML = comps.map(function (c) {
        var mark = c.level === "high" ? "&#9888; " : (c.level === "watch" ? "&#9679; " : "");
        var cls = c.level === "high" ? "tdd-high" : (c.level === "watch" ? "tdd-watch" : "tdd-ok");
        return '<span class="' + cls + '">' + mark + c.text + "</span>";
      }).join("<br>");
    }
    flagEl.textContent = flags.join(" ");
  }

  function getTddNoteText() {
    var d = computeTdd();
    if (!d) return "";
    var weight = getTddWeight();
    var text = "Insulin TDD " + round1(d.total) + " IU/day";
    if (weight !== null) {
      text += " (" + (Math.round((d.total / weight) * 100) / 100) + " IU/kg/day at " + weight + " kg)";
    }
    var split = [];
    if (d.basal) split.push("basal " + d.basal + " IU");
    if (d.bolus) split.push("bolus " + d.bolus + " IU");
    if (d.premix) split.push("premixed " + d.premix + " IU");
    if (split.length > 1) text += " — " + split.join(", ");
    return text + ".";
  }

  function initTdd() {
    ["tddBasal", "tddBolus", "tddPremix", "tddWeight", "tddBolusDoses", "tddPremixDoses"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", updateTdd);
    });
    var wb = document.getElementById("weightBmi");
    if (wb) wb.addEventListener("input", updateTdd);
    var btn = document.getElementById("tddResetBtn");
    if (btn) btn.addEventListener("click", resetTdd);
  }

  function resetTdd() {
    ["tddBasal", "tddBolus", "tddPremix", "tddWeight", "tddBolusDoses", "tddPremixDoses"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    updateTdd();
  }

  // ---------------------------------------------------------------------
  // Smoking status -> Quit Smoking Clinic referral.
  //
  // The referral block stays hidden until the Social History field says the
  // patient is a current smoker, so it does not clutter the form for the
  // majority who are not. Detection deliberately looks for "current smoker"
  // (the phrase chip) or a bare "smoker"/"merokok", while excluding
  // "non-smoker" / "ex-smoker" / "bukan perokok" so the negative chips do
  // not trigger it.
  //
  // Smoking cessation counselling is SENARAI SEMAK 7.8; referral to a Klinik
  // Berhenti Merokok is the local pathway for acting on it. Recording an
  // offered-but-declined referral matters for the same reason as the POM
  // "none" option - a blank is ambiguous between "not offered" and "refused".
  // ---------------------------------------------------------------------

  function isCurrentSmoker() {
    var el = document.getElementById("socialHistory");
    if (!el) return false;
    var t = (el.value || "").toLowerCase();
    if (!t) return false;
    // Strip the negatives first so they cannot match the positive test.
    var stripped = t
      .replace(/non[-\s]?smoker/g, "")
      .replace(/ex[-\s]?smoker/g, "")
      .replace(/never\s+smoked/g, "")
      .replace(/bukan\s+perokok/g, "")
      .replace(/tidak\s+merokok/g, "");
    return /current\s+smoker|\bsmoker\b|\bsmoking\b|\bmerokok\b|\bperokok\b/.test(stripped);
  }

  function updateSmokerBox() {
    var box = document.getElementById("smokerBox");
    if (!box) return;
    var smoker = isCurrentSmoker();
    box.style.display = smoker ? "" : "none";
    if (!smoker) {
      ["refQuitSmoking", "quitSmokingDeclined", "quitSmokingAlready"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.checked = false;
      });
    }
  }

  function getQuitSmokingNoteText() {
    if (!isCurrentSmoker()) return "";
    var referred = document.getElementById("refQuitSmoking");
    var declined = document.getElementById("quitSmokingDeclined");
    var already = document.getElementById("quitSmokingAlready");
    if (referred && referred.checked) return "Referred to Quit Smoking Clinic (Klinik Berhenti Merokok).";
    if (already && already.checked) return "Already under Quit Smoking Clinic follow-up.";
    if (declined && declined.checked) return "Quit Smoking Clinic referral offered but declined by patient.";
    return "";
  }

  function initSmokerBox() {
    var el = document.getElementById("socialHistory");
    if (el) el.addEventListener("input", updateSmokerBox);
    updateSmokerBox();
  }

  function resetSmokerBox() {
    ["refQuitSmoking", "quitSmokingDeclined", "quitSmokingAlready"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.checked = false;
    });
    updateSmokerBox();
  }

  // ---------------------------------------------------------------------
  // Patient Own Medicine (POM). Moved out of the audit tick-list and into
  // the medication section, because it is a medication-reconciliation fact
  // rather than a counselling action. Two mutually exclusive states:
  //   - "No POM"      -> documents the ABSENCE of outside-source
  //                      polypharmacy, which is otherwise invisible in a
  //                      note (a blank field could mean "none" or "never
  //                      asked" - this makes it unambiguous).
  //   - "POM reviewed" -> reveals a detail field + phrase bank for what was
  //                      found and what was done about it.
  // Appears in BOTH notes, since it is clinical medication history, not an
  // audit-only tick.
  // ---------------------------------------------------------------------
  function getPomStatus() {
    var none = document.getElementById("pomNone");
    var reviewed = document.getElementById("pomReviewed");
    if (none && none.checked) return "none";
    if (reviewed && reviewed.checked) return "reviewed";
    return "";
  }

  function updatePomVisibility() {
    var reviewed = getPomStatus() === "reviewed";
    var wrap = document.getElementById("pomDetailWrap");
    var bank = document.getElementById("pomPhraseBank");
    if (wrap) wrap.style.display = reviewed ? "" : "none";
    if (bank) bank.style.display = reviewed ? "" : "none";
  }

  function getPomNoteText() {
    var status = getPomStatus();
    if (!status) return "";
    if (status === "none") {
      return "Patient Own Medicine (POM): none — no polypharmacy from an outside source.";
    }
    var detail = document.getElementById("pomDetail").value.trim();
    var text = "Patient Own Medicine (POM) reviewed and reconciled.";
    if (detail) text += " " + detail + (/[.!?]$/.test(detail) ? "" : ".");
    return text;
  }

  function initPom() {
    ["pomNone", "pomReviewed"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", updatePomVisibility);
    });
    updatePomVisibility();
  }

  function resetPom() {
    ["pomNone", "pomReviewed"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.checked = false;
    });
    var d = document.getElementById("pomDetail");
    if (d) d.value = "";
    updatePomVisibility();
  }

  // ---------------------------------------------------------------------
  // Dietitian / physiotherapy referral (SENARAI SEMAK PEMANTAUAN KUALITI
  // DMTAC, Section 7.6: "Penilaian BMI dan modifikasi gaya hidup (termasuk
  // rujukan kepada pakar dietetik dan fisioterapi jika perlu)"). Recording
  // an explicit "assessed, not indicated" is deliberately offered too, so
  // the auditable decision is documented rather than left blank.
  // ---------------------------------------------------------------------
  function getDieteticReferralText() {
    var parts = [];
    if (document.getElementById("refDietitian").checked) parts.push("dietitian");
    if (document.getElementById("refPhysio").checked) parts.push("physiotherapy");
    var notIndicated = document.getElementById("refNotIndicated").checked;
    var detail = document.getElementById("dieteticReferralDetail").value.trim();

    var text = "";
    if (parts.length) {
      text = "Referred to " + parts.join(" and ") + ".";
    } else if (notIndicated) {
      text = "Dietitian/physiotherapy referral assessed — not indicated this visit.";
    }
    if (!text) return "";
    if (detail) text += " " + detail + (/[.!?]$/.test(detail) ? "" : ".");
    return text;
  }

  function resetDieteticReferral() {
    ["refDietitian", "refPhysio", "refNotIndicated"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.checked = false;
    });
    var d = document.getElementById("dieteticReferralDetail");
    if (d) d.value = "";
  }

  // ---------------------------------------------------------------------
  // CHO Exchange Calculator (item 9, Carbohydrate Counting)
  // Portion-per-exchange values (1 exchange ~= 15g carbohydrate) are sourced
  // from, in order of preference where sources disagree:
  //   1. "MDA MNT 2nd Ed." - Medical Nutrition Therapy Guidelines for Type 2
  //      Diabetes, 2nd Edition (Malaysian Dietitians' Association) - read
  //      directly from the primary guideline PDF (Appendix 3 "CHO Exchange
  //      for Sugars and Local Kuih", Appendix 4 "Carbohydrate Content of
  //      Common Malaysian Foods" and Appendix 5 "Food Groups and Exchange
  //      Lists"). This is the most authoritative Malaysia-specific source
  //      available here, and is used both for household-measure exchanges
  //      and for the gram-based "gramCho" figures (see below) that power
  //      the optional weight-in-grams entry mode. Earlier in this project
  //      this guideline was only available indirectly via a workshop deck
  //      summarising it ("Bengkel CPG Mx Zon Selatan Kedah", Hospital Kulim
  //      dietetics, 2023) - the primary PDF has since superseded that as
  //      the reference wherever the two differ.
  //   2. "Novo Nordisk educator deck" - "Jangan Berhenti Makan!" CHO
  //      counting & insulin dose (ICR/ISF) patient/educator slides (Novo
  //      Nordisk Pharma (M) Sdn Bhd, diabetes educator Heng Ooi Bee Lee) -
  //      used mainly for the fruit exchange list, which the other sources
  //      here don't cover.
  //   3. "HTAR exchange list" - Hospital Tengku Ampuan Rahimah dietetics
  //      "Pertukaran Karbohidrat" patient exchange list.
  //   4. "MOH MyHEALTH" - the MOH MyHEALTH patient education portal.
  //   5. "standard exchange"/"estimate" - general 15g exchange system
  //      convention, not independently verified against a specific
  //      Malaysian table.
  // Where sources disagree (bihun, jagung, pisang), the higher-preference
  // figure is used as primary, with the alternative(s) noted in the
  // portion text. This whole calculator is a clerking convenience, not a
  // dietitian-verified calculation - cross-check with your facility's own
  // Senarai Pertukaran Makanan / refer to a dietitian for formal MNT.
  //
  // gramCho: optional { servingG, choG } pulled from MDA MNT 2nd Ed.
  // Appendix 4, which gives an exact serving weight in grams and its
  // measured CHO content in grams for that food (from Tee ES, Mohd Ismail
  // N, Mohd Nasir A, et al. Nutrient Composition of Malaysian Foods, IMR,
  // 1997). Where present, this lets the calculator convert a gram weight
  // the pharmacist enters directly into a CHO exchange count
  // (grams entered / servingG * choG / 15), which is more precise than a
  // household-measure exchange for foods weighed or estimated in grams.
  // Note: Appendix 4's "Fried noodles (mee/mee hoon)" row states a serving
  // of "1 plate (30g)" alongside 281 kcal / 41g CHO - these calorie/CHO
  // figures are clearly for a full plate, not 30g, so this row is treated
  // as an apparent typographical error in the source document and is
  // deliberately NOT used for gramCho (the household-measure "mee"/"bihun"
  // entries from Appendix 5 are used instead, which are internally
  // consistent).
  // ---------------------------------------------------------------------

  var CHO_EXCHANGE_FOODS = [
    // --- Cereals, grain products & starchy vegetables (Appendix 5; each = 15g CHO) ---
    { id: "nasi", label: "Nasi / Cooked rice", shortLabel: "Nasi", portion: "1/2 cup or 1/3 Chinese rice bowl", source: "MDA MNT 2nd Ed. (Appendix 5) / HTAR", gramCho: { servingG: 159, choG: 48 }, keywords: ["nasi putih", "nasi"] },
    { id: "buburNasi", label: "Bubur nasi / Rice porridge", shortLabel: "Bubur nasi", portion: "1 cup", source: "MDA MNT 2nd Ed. (Appendix 5) / HTAR", keywords: ["bubur nasi", "bubur", "porridge", "congee"] },
    { id: "kueyTeow", label: "Kuey teow (cooked)", shortLabel: "Kuey teow", portion: "1/2 cup or 1/3 Chinese rice bowl", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["kuey teow", "kuih teow", "wet noodle"] },
    { id: "bihun", label: "Bihun / Mihun / Rice vermicelli (cooked)", shortLabel: "Bihun/mihun", portion: "1/2 cup or 1/3 Chinese rice bowl (grouped with mee hoon/tang hoon/nasi/kuey teow/pasta in MDA MNT 2nd Ed.; HTAR list states 3/4 cup)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["bihun", "mihun", "vermicelli", "rice noodle"] },
    { id: "mee", label: "Mee (yellow noodles, wet, cooked)", shortLabel: "Mee", portion: "1/3 cup (a Novo Nordisk educator deck lists generic \"noodle\" at 1/2 cup — MDA MNT 2nd Ed.'s more specific figure for wet mee is used here)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["mee goreng", "mee basah", "mee"] },
    { id: "curryMee", label: "Mee kari / Curry mee (with soup)", shortLabel: "Curry mee", portion: "1 bowl", source: "MDA MNT 2nd Ed. (Appendix 4)", gramCho: { servingG: 450, choG: 55 }, keywords: ["curry mee", "mee kari", "laksa"] },
    { id: "idli", label: "Idli", shortLabel: "Idli", portion: "1 piece (60g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["idli"] },
    { id: "putuMayam", label: "Putu mayam / String hoppers", shortLabel: "Putu mayam", portion: "1 piece (40g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["putu mayam", "string hopper"] },
    { id: "rotiPutih", label: "Roti putih / White or wholemeal bread", shortLabel: "Roti putih", portion: "1 slice (30g)", source: "MDA MNT 2nd Ed. (Appendix 5) / HTAR", gramCho: { servingG: 30, choG: 15 }, keywords: ["roti putih", "white bread", "toast"] },
    { id: "rotiBijirin", label: "Roti bijirin penuh / Wholegrain, high-fibre bread", shortLabel: "Roti bijirin penuh", portion: "1 slice (30g) — MDA MNT 2nd Ed. groups wholemeal/high-fibre/white/brown bread as a single 1-slice (30g) exchange, same as roti putih above", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 30, choG: 15 }, keywords: ["roti bijirin", "wholegrain bread", "whole wheat bread", "whole meal bread"] },
    { id: "bun", label: "Bun / Plain roll", shortLabel: "Bun", portion: "1 small (30g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["bun"] },
    { id: "burgerBun", label: "Burger bun", shortLabel: "Burger bun", portion: "1/2 piece", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["burger bun"] },
    { id: "pitaBread", label: "Pita bread (6\" diameter)", shortLabel: "Pita bread", portion: "1/2 piece", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["pita bread", "pita"] },
    { id: "rotiCanai", label: "Roti canai", shortLabel: "Roti canai", portion: "1 piece", source: "MDA MNT 2nd Ed. (Appendix 4)", exchangePerUnit: 3, gramCho: { servingG: 95, choG: 46 }, keywords: ["roti canai"] },
    { id: "chapati", label: "Chapati (20cm diameter)", shortLabel: "Chapati", portion: "1/3 piece (a whole 20cm chapati ≈ 3 exchanges)", source: "MDA MNT 2nd Ed. (Appendix 4 & 5)", gramCho: { servingG: 100, choG: 47 }, keywords: ["chapati", "capati"] },
    { id: "thosai", label: "Thosai (20cm diameter)", shortLabel: "Thosai", portion: "1/2 piece", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["thosai", "tosai", "dosa"] },
    { id: "pasta", label: "Pasta / Spaghetti / Macaroni (plain, cooked)", shortLabel: "Pasta", portion: "1/2 cup or 1/3 Chinese rice bowl", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["pasta", "spaghetti", "macaroni"] },
    { id: "oats", label: "Oats (uncooked) / Oatmeal (cooked)", shortLabel: "Oat", portion: "3 rounded tbsp uncooked, or 1/4 cup cooked oatmeal", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["oat", "oats", "oatmeal", "tepung gandum"] },
    { id: "muesli", label: "Muesli", shortLabel: "Muesli", portion: "1/4 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["muesli"] },
    { id: "cornflakes", label: "Cornflakes", shortLabel: "Cornflakes", portion: "1/2 cup", source: "Novo Nordisk educator deck", keywords: ["cornflakes", "corn flakes"] },
    { id: "biskutPlain", label: "Biskut plain (e.g. cream cracker, Ryvita)", shortLabel: "Biskut plain", portion: "3 pieces (a Novo Nordisk-adjacent gram source lists 2 unspecified \"unsweetened biscuit\" pieces at 18g/14g CHO — MDA MNT 2nd Ed. Appendix 5's cream cracker/Ryvita figure of 3 pieces is used here; small thin salted biscuits, 4.5×4.5cm, are 6 pieces per exchange)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["biskut", "cracker", "biscuit"] },
    { id: "curryPuff", label: "Karipap / Curry puff", shortLabel: "Curry puff", portion: "1 piece (40g)", source: "MDA MNT 2nd Ed. (Appendix 4)", gramCho: { servingG: 40, choG: 17 }, keywords: ["curry puff", "karipap"] },
    { id: "jagung", label: "Jagung / Corn on the cob", shortLabel: "Jagung", portion: "1 small (6\" length)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["jagung rebus", "corn on the cob", "jagung", "corn"] },
    { id: "jagungButir", label: "Jagung butir / Corn kernel (fresh/canned)", shortLabel: "Jagung butir", portion: "1/2 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["jagung butir", "corn kernel", "canned corn"] },
    { id: "keledek", label: "Ubi keledek / Sweet potato", shortLabel: "Keledek", portion: "1/2 cup (45g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["ubi keledek", "keledek", "sweet potato"] },
    { id: "ubiKayu", label: "Ubi kayu / Tapioca", shortLabel: "Ubi kayu", portion: "1/2 cup (45g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["ubi kayu", "tapioca", "cassava"] },
    { id: "ubiKeladi", label: "Ubi keladi / Yam / Taro", shortLabel: "Ubi keladi", portion: "1/2 cup (45g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["ubi keladi", "keladi", "taro"] },
    { id: "kentang", label: "Ubi kentang / Potato", shortLabel: "Kentang", portion: "1 small (75g); Appendix 4 separately lists 1 medium (90g) as 16g CHO — treated here as an approximately equivalent exchange", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 90, choG: 16 }, keywords: ["kentang", "potato"] },
    { id: "sukun", label: "Sukun / Breadfruit", shortLabel: "Sukun", portion: "1 slice (75g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["sukun", "breadfruit"] },
    { id: "labuMerah", label: "Labu merah / Pumpkin", shortLabel: "Labu merah", portion: "1 cup (100g)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["labu merah", "labu", "pumpkin"] },
    { id: "lobakMerah", label: "Lobak merah / Carrot", shortLabel: "Lobak merah", portion: "1 medium", source: "MDA MNT 2nd Ed.", keywords: ["lobak merah", "lobak", "carrot"] },
    { id: "bakedBeans", label: "Bake bean (tinned baked beans)", shortLabel: "Baked beans", portion: "1/3 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["baked bean", "bake bean", "kacang panggang"] },
    { id: "kekacang", label: "Kekacang / Legumes (cooked)", shortLabel: "Kekacang", portion: "1/3 cup (contains ~5g protein/serve, more than other starches in this list)", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["kekacang", "legume"] },
    { id: "peas", label: "Kacang pea (fresh/canned)", shortLabel: "Kacang pea", portion: "1/2 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["kacang pea", "green peas", "peas"] },
    { id: "sengkuang", label: "Sengkuang / Jicama", shortLabel: "Sengkuang", portion: "1/5 of a whole, with skin (40g)", source: "MDA MNT 2nd Ed.", keywords: ["sengkuang", "jicama"] },
    { id: "waterchestnut", label: "Waterchestnut (Mai-tai)", shortLabel: "Waterchestnut", portion: "4 pieces", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["waterchestnut", "water chestnut", "mai-tai", "mai tai"] },
    // --- Sugars & sweets (Appendix 3; each = 15g CHO, 1 exchange) ---
    { id: "honey", label: "Madu / Honey", shortLabel: "Honey", portion: "1 level tbsp (21g)", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["madu", "honey"] },
    { id: "kaya", label: "Kaya", shortLabel: "Kaya", portion: "3 level tbsp (30g)", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["kaya"] },
    { id: "jam", label: "Jem / Jam", shortLabel: "Jam", portion: "1 level tbsp (21g)", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["jem", "jam"] },
    { id: "sweets", label: "Gula-gula / Sweets, candy", shortLabel: "Sweets", portion: "1–2 pieces", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["gula-gula", "sweets", "candy"] },
    { id: "sugarBrown", label: "Gula perang / Brown sugar", shortLabel: "Brown sugar", portion: "3½ level tsp (18g)", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["gula perang", "brown sugar"] },
    { id: "sugarWhite", label: "Gula pasir / White sugar", shortLabel: "White sugar", portion: "3 level tsp (15g)", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["gula pasir", "gula putih", "white sugar", "sugar"] },
    { id: "roseSyrup", label: "Sirap ros / Rose syrup", shortLabel: "Rose syrup", portion: "3½ level tsp (18g)", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["sirap ros", "rose syrup"] },
    { id: "condensedMilk", label: "Susu pekat manis / Condensed milk (sweetened)", shortLabel: "Condensed milk", portion: "2 level tbsp (30g)", source: "MDA MNT 2nd Ed. (Appendix 3)", gramCho: { servingG: 40, choG: 21 }, keywords: ["susu pekat", "condensed milk"] },
    { id: "cocoaMalt", label: "Serbuk koko/malt (e.g. Milo, Horlicks)", shortLabel: "Cocoa/malt drink", portion: "1½ level tbsp (18g) powder", source: "MDA MNT 2nd Ed. (Appendix 3)", keywords: ["milo", "horlicks", "koko", "cocoa", "malt"] },
    // --- Fruits (Appendix 5; each = 15g CHO, unless gramCho notes otherwise) ---
    { id: "pisang", label: "Pisang / Banana", shortLabel: "Pisang", portion: "1 small (a smaller \"pisang mas\" variety, per Appendix 4, is only ≈9g CHO/<1 exchange at 50g — use the gram-entry mode for a specific weighed banana; a larger Cavendish-type banana approaches the fuller 1-exchange figure used as the default here)", source: "MDA MNT 2nd Ed. (Appendix 5) / Novo Nordisk educator deck", gramCho: { servingG: 50, choG: 9 }, keywords: ["pisang", "banana"] },
    { id: "epal", label: "Epal / Apple", shortLabel: "Epal", portion: "1 medium (Appendix 4's IMR-measured local apple/orange figure is lower, ≈9g CHO/<1 exchange at 114g — the fuller 1-exchange figure from Appendix 5's standard fruit exchange list is used as the default here; use gram-entry mode for a specific weighed fruit)", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 114, choG: 9 }, keywords: ["epal", "apple"] },
    { id: "oren", label: "Oren / Orange", shortLabel: "Oren", portion: "1 medium (see apple note above re: Appendix 4 vs Appendix 5 discrepancy)", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 114, choG: 9 }, keywords: ["oren", "orange"] },
    { id: "anggur", label: "Anggur / Grapes", shortLabel: "Anggur", portion: "8 pieces", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 233, choG: 12 }, keywords: ["anggur", "grapes", "grape"] },
    { id: "nanas", label: "Nanas / Pineapple", shortLabel: "Nanas", portion: "1 slice", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 160, choG: 11 }, keywords: ["nanas", "pineapple"] },
    { id: "honeydew", label: "Honeydew", shortLabel: "Honeydew", portion: "1 slice", source: "Novo Nordisk educator deck", keywords: ["honeydew"] },
    { id: "tembikai", label: "Tembikai / Watermelon", shortLabel: "Tembikai", portion: "1 slice", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 160, choG: 11 }, keywords: ["tembikai", "watermelon"] },
    { id: "pear", label: "Pear", shortLabel: "Pear", portion: "1 medium", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["pear"] },
    { id: "kiwi", label: "Kiwi", shortLabel: "Kiwi", portion: "1 whole", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["kiwi"] },
    { id: "betik", label: "Betik / Papaya", shortLabel: "Betik", portion: "1 slice", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 160, choG: 11 }, keywords: ["betik", "papaya"] },
    { id: "belimbing", label: "Belimbing / Star fruit", shortLabel: "Belimbing", portion: "1 medium", source: "MDA MNT 2nd Ed. (Appendix 4 & 5)", gramCho: { servingG: 260, choG: 11 }, keywords: ["belimbing", "star fruit", "starfruit"] },
    { id: "mangga", label: "Mangga / Mango", shortLabel: "Mangga", portion: "1/2 small", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 100, choG: 11 }, keywords: ["mangga", "mango"] },
    { id: "jambuBatu", label: "Jambu batu / Guava", shortLabel: "Jambu batu", portion: "1/2 fruit", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 100, choG: 11 }, keywords: ["jambu batu", "guava", "jambu"] },
    { id: "rambutan", label: "Rambutan", shortLabel: "Rambutan", portion: "5 whole", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["rambutan"] },
    { id: "lychee", label: "Lychee / Leci", shortLabel: "Lychee", portion: "5 whole", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["lychee", "leci"] },
    { id: "langsat", label: "Langsat / Duku langsat", shortLabel: "Langsat", portion: "8 pieces", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 233, choG: 12 }, keywords: ["langsat", "duku langsat", "duku"] },
    { id: "cempedak", label: "Cempedak", shortLabel: "Cempedak", portion: "4 pieces", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["cempedak"] },
    { id: "manggis", label: "Manggis / Mangosteen", shortLabel: "Manggis", portion: "2 small", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["manggis", "mangosteen"] },
    { id: "longan", label: "Longan / Mata kucing", shortLabel: "Longan", portion: "8 pieces", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 233, choG: 12 }, keywords: ["longan", "mata kucing"] },
    { id: "durian", label: "Durian", shortLabel: "Durian", portion: "2 medium seeds (Appendix 4 separately measured 5 small seeds at 189g ≈ 12g CHO/1 exchange — seed size clearly differs; use gram-entry mode if weighed)", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 189, choG: 12 }, keywords: ["durian"] },
    { id: "nangka", label: "Nangka / Jackfruit", shortLabel: "Nangka", portion: "4 pieces", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["nangka", "jackfruit"] },
    // --- Milk (Appendix 5) ---
    { id: "susu", label: "Susu segar / UHT (fresh/UHT milk)", shortLabel: "Susu", portion: "1 cup (240ml) — CHO content varies by fat type: Appendix 5 gives skimmed ≈15g, low-fat ≈12g, full cream ≈10g per cup; Appendix 4 separately measured full-cream at 18g and low-fat at 12g CHO per 250ml cup. These two tables disagree on full-cream milk specifically — 1 cup is kept as the default portion regardless of fat type, but cross-check if precision matters", source: "MDA MNT 2nd Ed. (Appendix 4 & 5)", keywords: ["susu segar", "susu uht", "susu", "milk"] },
    { id: "susuTepung", label: "Susu tepung / Milk powder", shortLabel: "Susu tepung", portion: "4 rounded tbsp or 1/3 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", gramCho: { servingG: 28, choG: 16 }, keywords: ["susu tepung", "milk powder"] },
    { id: "susuSejat", label: "Susu sejat / Evaporated milk (unsweetened)", shortLabel: "Susu sejat", portion: "1/2 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["susu sejat", "evaporated milk"] },
    { id: "yogurt", label: "Yogurt (plain/low fat)", shortLabel: "Yogurt", portion: "3/4 cup", source: "MDA MNT 2nd Ed. (Appendix 5)", keywords: ["yogurt", "yoghurt"] }
    // Note: cheese ("keju") was removed from this calculator. MDA MNT 2nd Ed.
    // Appendix 5 lists cheese under the Lean Meat & Meat Substitute group
    // (0g CHO, 7g protein, 4g fat per exchange) — it is a protein/fat
    // exchange, not a carbohydrate exchange, so counting it here would
    // wrongly inflate a patient's CHO total.
  ];

  var choEntries = [];

  function getChoFoodById(id) {
    for (var i = 0; i < CHO_EXCHANGE_FOODS.length; i++) {
      if (CHO_EXCHANGE_FOODS[i].id === id) return CHO_EXCHANGE_FOODS[i];
    }
    return null;
  }

  function roundExch(n) {
    return Math.round(n * 100) / 100;
  }

  // entry.unit === "g" means entry.qty is a weight in grams, converted via
  // the food's gramCho data (MDA MNT 2nd Ed. Appendix 4). Otherwise
  // entry.qty is a portion-multiplier, as before.
  function computeEntryExchange(entry, food) {
    if (entry.unit === "g" && food.gramCho && food.gramCho.servingG) {
      return (entry.qty / food.gramCho.servingG) * food.gramCho.choG / 15;
    }
    return entry.qty * (food.exchangePerUnit || 1);
  }

  function formatEntryQty(entry) {
    return entry.unit === "g" ? entry.qty + "g" : "×" + entry.qty;
  }

  function buildChoFoodOptions() {
    var select = document.getElementById("choFoodSelect");
    select.innerHTML = "";
    CHO_EXCHANGE_FOODS.forEach(function (food) {
      var opt = document.createElement("option");
      opt.value = food.id;
      opt.textContent = food.label;
      select.appendChild(opt);
    });
  }

  function updateChoPortionHint() {
    var food = getChoFoodById(document.getElementById("choFoodSelect").value);
    var hintEl = document.getElementById("choFoodPortionHint");
    if (!food) { hintEl.textContent = ""; return; }
    var text = "1 exchange = " + food.portion + " (source: " + food.source + ")";
    if (food.gramCho) {
      text += ". Gram entry available: " + food.gramCho.servingG + "g ≈ " + food.gramCho.choG + "g CHO (MDA MNT 2nd Ed., Appendix 4).";
    } else {
      text += ". Gram entry is not available for this food (no gram-based CHO source) — use the portion unit instead.";
    }
    hintEl.textContent = text;
  }

  function renderChoEntries() {
    var listEl = document.getElementById("choEntryList");
    listEl.innerHTML = "";
    var totalExchange = 0;

    var perMeal = {};
    choEntries.forEach(function (entry, idx) {
      var exch, labelText;
      if (entry.custom) {
        exch = entry.custom.exch;
        labelText = entry.meal + ": " + entry.custom.label + " (" + roundExch(exch) + " exch" +
          (entry.custom.note ? ", " + entry.custom.note : "") + ")";
      } else {
        var food = getChoFoodById(entry.foodId);
        if (!food) return;
        exch = computeEntryExchange(entry, food);
        labelText = entry.meal + ": " + food.shortLabel + " " + formatEntryQty(entry) + " (" + roundExch(exch) + " exch)";
      }
      totalExchange += exch;
      perMeal[entry.meal] = (perMeal[entry.meal] || 0) + exch;

      var li = document.createElement("li");
      li.className = "myMaat-li";
      var row = document.createElement("div");
      row.className = "myMaat-item";
      var span = document.createElement("span");
      span.className = "item-label";
      span.textContent = labelText;
      if (entry.custom && entry.custom.estimated) span.className += " tdd-watch";
      row.appendChild(span);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "score-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", function () {
        choEntries.splice(idx, 1);
        renderChoEntries();
      });
      row.appendChild(removeBtn);

      li.appendChild(row);
      listEl.appendChild(li);
    });

    document.getElementById("choGrandTotal").textContent = roundExch(totalExchange) + " exchange(s)";
    document.getElementById("choGrandTotalGrams").textContent = totalExchange > 0 ? "(≈ " + Math.round(totalExchange * 15) + "g carbohydrate)" : "";
    updateChoTargetCheck(perMeal, totalExchange);
  }

  // ---------------------------------------------------------------------
  // CHO exchange targets by patient group.
  //
  // Source: MDA "Medical Nutrition Therapy Guidelines for Type 2 Diabetes,
  // 2nd Edition", table "CHO exchanges: adult male & female" (adapted from
  // the American Dietetic Association Guide to Diabetes MNT and Education):
  //
  //   Inactive women                    2-4 exchanges per meal
  //   Active women or inactive men      3-5 exchanges per meal
  //   Active men                        4-6 exchanges per meal
  //   Between-meal snacks               1-2 exchanges
  //
  // Daily ranges below are the per-meal range x3 main meals, plus 1-2 for
  // snacks - i.e. derived from the same table rather than separately
  // sourced, which is stated in the on-screen hint.
  // ---------------------------------------------------------------------
  var CHO_TARGETS = {
    inactiveWoman:            { label: "Inactive woman", min: 2, max: 4 },
    activeWomanOrInactiveMan: { label: "Active woman / inactive man", min: 3, max: 5 },
    activeMan:                { label: "Active man", min: 4, max: 6 }
  };
  var CHO_SNACK_MIN = 1, CHO_SNACK_MAX = 2;

  function updateChoTargetHint() {
    var el = document.getElementById("choTargetHint");
    if (!el) return;
    var key = (document.getElementById("choPatientGroup") || {}).value;
    var t = CHO_TARGETS[key];
    if (!t) {
      el.textContent = "Select a patient group to check meals against the recommended CHO exchange range (MDA MNT 2nd Ed.).";
      return;
    }
    var dayMin = t.min * 3 + CHO_SNACK_MIN, dayMax = t.max * 3 + CHO_SNACK_MAX;
    el.textContent = t.label + ": " + t.min + "–" + t.max + " exchanges per main meal (" +
      (t.min * 15) + "–" + (t.max * 15) + " g CHO), " + CHO_SNACK_MIN + "–" + CHO_SNACK_MAX +
      " per between-meal snack. Across 3 main meals plus snacks that is roughly " + dayMin + "–" + dayMax +
      " exchanges (" + (dayMin * 15) + "–" + (dayMax * 15) + " g CHO) a day. Source: MDA MNT for T2D, 2nd Ed., \"CHO exchanges: adult male & female\".";
  }

  function updateChoTargetCheck(perMeal, total) {
    var el = document.getElementById("choPerMealCheck");
    if (!el) return;
    var key = (document.getElementById("choPatientGroup") || {}).value;
    var t = CHO_TARGETS[key];
    if (!t || !total) { el.textContent = ""; el.className = "hint"; return; }

    var over = [], under = [];
    Object.keys(perMeal).forEach(function (meal) {
      var v = roundExch(perMeal[meal]);
      var isSnack = /snack/i.test(meal);
      var lo = isSnack ? CHO_SNACK_MIN : t.min;
      var hi = isSnack ? CHO_SNACK_MAX : t.max;
      if (v > hi) over.push(meal + " " + v + " (above " + lo + "–" + hi + ")");
      else if (v < lo) under.push(meal + " " + v + " (below " + lo + "–" + hi + ")");
    });

    var dayMax = t.max * 3 + CHO_SNACK_MAX;
    var parts = [];
    if (over.length) parts.push("OVER the recommended range — " + over.join("; ") + ".");
    if (roundExch(total) > dayMax) parts.push("Daily total " + roundExch(total) + " exchanges is above the ~" + dayMax + " expected for a " + t.label.toLowerCase() + ".");
    if (under.length) parts.push("Below range — " + under.join("; ") + ".");
    if (!parts.length) parts.push("All recorded meals are within the " + t.min + "–" + t.max + " exchange range for a " + t.label.toLowerCase() + ".");
    el.textContent = parts.join(" ");
    el.className = (over.length || roundExch(total) > dayMax) ? "ckd-flag-box" : "hint tdd-ok";
  }

  // ---------------------------------------------------------------------
  // Adding foods that are not in the built-in table.
  //
  // A. From a nutrition label or MyFCD (myfcd.moh.gov.my), which publish
  //    carbohydrate in g per 100 g - exact, no assumption needed.
  // B. From energy only. Calories CANNOT determine carbohydrate content, so
  //    this applies a typical carbohydrate share of energy by food type and
  //    is always labelled an estimate. Shares below are conventional
  //    approximations for counselling, not analysed values.
  // ---------------------------------------------------------------------
  var CHO_KCAL_SHARES = {
    rice:    { label: "Rice/noodle/starchy dish", share: 0.75 },
    bread:   { label: "Bread/biscuit/cereal/kuih", share: 0.65 },
    mixed:   { label: "Mixed meal", share: 0.50 },
    fried:   { label: "Fried/high-fat dish", share: 0.35 },
    drink:   { label: "Sweetened drink/dessert", share: 0.85 },
    protein: { label: "Mainly protein", share: 0.10 },
    fruit:   { label: "Fruit", share: 0.90 }
  };

  function updateChoLabelHint() {
    var el = document.getElementById("choLabelHint");
    if (!el) return;
    var per100 = parseFloat(document.getElementById("choLabelPer100").value);
    var grams = parseFloat(document.getElementById("choLabelGrams").value);
    if (isNaN(per100) || isNaN(grams) || per100 < 0 || grams <= 0) { el.textContent = ""; return; }
    var choG = (per100 / 100) * grams;
    el.textContent = grams + " g at " + per100 + " g CHO/100 g = " + (Math.round(choG * 10) / 10) +
      " g carbohydrate = " + roundExch(choG / 15) + " exchange(s).";
  }

  function updateChoKcalHint() {
    var el = document.getElementById("choKcalHint");
    if (!el) return;
    var kcal = parseFloat(document.getElementById("choKcalValue").value);
    var cat = document.getElementById("choKcalCategory").value;
    var c = CHO_KCAL_SHARES[cat];
    if (isNaN(kcal) || kcal <= 0 || !c) { el.textContent = ""; return; }
    var choG = (kcal * c.share) / 4;   // 4 kcal per g of carbohydrate
    var lo = choG * 0.8, hi = choG * 1.2;
    el.textContent = "ESTIMATE: " + kcal + " kcal as " + c.label.toLowerCase() + " (~" +
      Math.round(c.share * 100) + "% of energy from carbohydrate) ≈ " + Math.round(choG) +
      " g CHO ≈ " + roundExch(choG / 15) + " exchange(s). Plausible range " + roundExch(lo / 15) +
      "–" + roundExch(hi / 15) + " exchanges. Use the label or MyFCD figure instead whenever you have it.";
  }

  function initChoExtraEntry() {
    ["choLabelPer100", "choLabelGrams"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("input", updateChoLabelHint);
    });
    ["choKcalValue"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) e.addEventListener("input", updateChoKcalHint);
    });
    var cat = document.getElementById("choKcalCategory");
    if (cat) cat.addEventListener("change", updateChoKcalHint);

    var labelBtn = document.getElementById("choLabelAddBtn");
    if (labelBtn) labelBtn.addEventListener("click", function () {
      var name = document.getElementById("choLabelName").value.trim() || "Food (from label)";
      var per100 = parseFloat(document.getElementById("choLabelPer100").value);
      var grams = parseFloat(document.getElementById("choLabelGrams").value);
      if (isNaN(per100) || isNaN(grams) || grams <= 0) return;
      var choG = (per100 / 100) * grams;
      choEntries.push({
        meal: document.getElementById("choMealSelect").value,
        custom: { label: name + " " + grams + "g", exch: choG / 15, note: Math.round(choG) + "g CHO from label", estimated: false }
      });
      ["choLabelName", "choLabelPer100", "choLabelGrams"].forEach(function (id) { document.getElementById(id).value = ""; });
      updateChoLabelHint();
      renderChoEntries();
    });

    var kcalBtn = document.getElementById("choKcalAddBtn");
    if (kcalBtn) kcalBtn.addEventListener("click", function () {
      var name = document.getElementById("choKcalName").value.trim() || "Food (from kcal)";
      var kcal = parseFloat(document.getElementById("choKcalValue").value);
      var cat2 = document.getElementById("choKcalCategory").value;
      var c = CHO_KCAL_SHARES[cat2];
      if (isNaN(kcal) || kcal <= 0 || !c) return;
      var choG = (kcal * c.share) / 4;
      choEntries.push({
        meal: document.getElementById("choMealSelect").value,
        custom: { label: name + " " + kcal + " kcal", exch: choG / 15, note: "~" + Math.round(choG) + "g CHO, ESTIMATED from kcal", estimated: true }
      });
      ["choKcalName", "choKcalValue"].forEach(function (id) { document.getElementById(id).value = ""; });
      document.getElementById("choKcalCategory").value = "";
      updateChoKcalHint();
      renderChoEntries();
    });

    var grp = document.getElementById("choPatientGroup");
    if (grp) grp.addEventListener("change", function () { updateChoTargetHint(); renderChoEntries(); });
    updateChoTargetHint();
  }

  function getChoInsertText() {
    if (!choEntries.length) return "";
    var mealOrder = [];
    var mealMap = {};
    choEntries.forEach(function (entry) {
      if (entry.custom) {
        if (!mealMap[entry.meal]) { mealMap[entry.meal] = []; mealOrder.push(entry.meal); }
        mealMap[entry.meal].push({
          text: entry.custom.label + (entry.custom.estimated ? " (est.)" : ""),
          exch: entry.custom.exch
        });
        return;
      }
      var food = getChoFoodById(entry.foodId);
      if (!food) return;
      var exch = computeEntryExchange(entry, food);
      if (!mealMap[entry.meal]) { mealMap[entry.meal] = []; mealOrder.push(entry.meal); }
      mealMap[entry.meal].push({ text: food.shortLabel + " " + formatEntryQty(entry), exch: exch });
    });

    var totalExch = 0;
    var parts = mealOrder.map(function (meal) {
      var items = mealMap[meal];
      var mealTotal = items.reduce(function (a, b) { return a + b.exch; }, 0);
      totalExch += mealTotal;
      var itemsText = items.map(function (i) { return i.text; }).join(", ");
      return meal + " ~" + roundExch(mealTotal) + " exchange(s) (" + itemsText + ")";
    });

    return parts.join("; ") + ". Total ≈ " + roundExch(totalExch) + " exchange(s) (≈" + Math.round(totalExch * 15) + "g carbohydrate).";
  }

  function parseQuantityToken(token) {
    token = token.replace(/\s+/g, "");
    if (token.indexOf("/") !== -1) {
      var parts = token.split("/");
      var num = parseFloat(parts[0]);
      var den = parseFloat(parts[1]);
      return den ? num / den : 1;
    }
    var val = parseFloat(token);
    return (!val || val <= 0) ? 1 : val;
  }

  // Looks for a quantity near a matched food keyword, within the same
  // clause only (the caller passes clause-scoped text, split on commas/
  // periods/etc, so this never sees a neighbouring food's own quantity).
  // Malay/English dietary phrasing usually states the quantity AFTER the
  // food name (e.g. "nasi 1 mangkuk", "roti canai 2 keping"), so the text
  // after the keyword is checked first; the text before is a fallback
  // (e.g. "2 keping roti canai").
  // A number followed by a gram unit (e.g. "150g", "150 gram") is detected
  // separately from a plain portion count (e.g. "1 mangkuk", "2 keping"),
  // and returned with unit "g" so the caller can convert it via a food's
  // gramCho data instead of treating it as a portion multiplier.
  var GRAM_UNIT_RE = /(\d+\s*\/\s*\d+|\d+(\.\d+)?)\s*(g|gram|grams|gm)\b/i;
  var PLAIN_NUM_RE = /(\d+\s*\/\s*\d+|\d+(\.\d+)?)/;

  function extractQuantityNearKeyword(text, idx, kwLen) {
    var afterText = text.slice(idx + kwLen);
    var afterGram = afterText.match(GRAM_UNIT_RE);
    if (afterGram) return { value: parseQuantityToken(afterGram[1]), unit: "g" };
    var afterMatch = afterText.match(PLAIN_NUM_RE);
    if (afterMatch) return { value: parseQuantityToken(afterMatch[0]), unit: "portion" };

    var beforeText = text.slice(0, idx);
    var beforeGramMatches = beforeText.match(new RegExp(GRAM_UNIT_RE.source, "gi"));
    if (beforeGramMatches && beforeGramMatches.length) {
      var lastGram = beforeGramMatches[beforeGramMatches.length - 1];
      var numPart = lastGram.match(PLAIN_NUM_RE)[0];
      return { value: parseQuantityToken(numPart), unit: "g" };
    }
    var beforeMatches = beforeText.match(new RegExp(PLAIN_NUM_RE.source, "g"));
    if (beforeMatches && beforeMatches.length) return { value: parseQuantityToken(beforeMatches[beforeMatches.length - 1]), unit: "portion" };
    return { value: 1, unit: "portion" };
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Word-boundary matching (not plain substring search) is required here -
  // e.g. the keyword "oren" (orange) would otherwise falsely match inside
  // the very common Malay word "goreng" (fried).
  // Scans clause-by-clause (splitting on commas/periods/semicolons/colons)
  // rather than across the whole text at once. This keeps quantity
  // detection scoped to the same food mention - e.g. in "5 rambutan, 8
  // longan", the quantity search for "rambutan" never sees the "8" that
  // belongs to the next clause.
  function scanTextForFoods(text) {
    var lower = text.toLowerCase();
    var segments = lower.split(/[,.;:]+/);
    var pairs = [];
    CHO_EXCHANGE_FOODS.forEach(function (food) {
      food.keywords.forEach(function (kw) {
        pairs.push({ kw: kw.toLowerCase(), food: food });
      });
    });
    pairs.sort(function (a, b) { return b.kw.length - a.kw.length; });

    var matches = [];
    segments.forEach(function (segment) {
      var working = segment;
      pairs.forEach(function (pair) {
        var re = new RegExp("\\b" + escapeRegExp(pair.kw) + "\\b", "i");
        var m = re.exec(working);
        while (m) {
          var idx = m.index;
          var result = extractQuantityNearKeyword(working, idx, pair.kw.length);
          var unit = result.unit;
          var qty = result.value;
          var gramUnsupported = false;
          if (unit === "g" && !pair.food.gramCho) {
            // A gram weight was mentioned but this food has no gramCho
            // conversion data - fall back to a safe default of 1 portion
            // rather than misusing the gram number as a portion count.
            unit = "portion";
            qty = 1;
            gramUnsupported = true;
          }
          matches.push({ food: pair.food, qty: qty, unit: unit, gramUnsupported: gramUnsupported });
          var blank = new Array(pair.kw.length + 1).join(" ");
          working = working.slice(0, idx) + blank + working.slice(idx + pair.kw.length);
          m = re.exec(working);
        }
      });
    });
    return matches;
  }

  function initChoCalculator() {
    buildChoFoodOptions();
    updateChoPortionHint();
    document.getElementById("choFoodSelect").addEventListener("change", updateChoPortionHint);

    document.getElementById("choAddBtn").addEventListener("click", function () {
      var meal = document.getElementById("choMealSelect").value;
      var foodId = document.getElementById("choFoodSelect").value;
      var unit = document.getElementById("choUnitSelect").value;
      var food = getChoFoodById(foodId);
      var qty = parseFloat(document.getElementById("choQtyInput").value);
      if (!qty || qty <= 0) qty = 1;
      var hintEl = document.getElementById("choFoodPortionHint");
      if (unit === "g" && (!food || !food.gramCho)) {
        hintEl.textContent = "Gram entry isn't available for this food (no gram-based CHO source in MDA MNT 2nd Ed. Appendix 4) — choose \"× the listed portion\" instead.";
        return;
      }
      choEntries.push({ meal: meal, foodId: foodId, qty: qty, unit: unit });
      renderChoEntries();
    });

    document.getElementById("choInsertBtn").addEventListener("click", function () {
      var text = getChoInsertText();
      if (!text) return;
      appendToField("choCounting", text, " ");
    });

    document.getElementById("choClearBtn").addEventListener("click", function () {
      choEntries = [];
      renderChoEntries();
    });

    document.getElementById("choScanBtn").addEventListener("click", function () {
      var text = document.getElementById("choCounting").value;
      var resultEl = document.getElementById("choScanResult");
      if (!text.trim()) {
        resultEl.textContent = "Type your dietary review into the CHO Counting box above first.";
        return;
      }
      var matches = scanTextForFoods(text);
      if (!matches.length) {
        resultEl.textContent = "No recognised food keywords found. Try the calculator above instead, or add more items to the food list.";
        return;
      }
      var gramUnsupportedCount = 0;
      matches.forEach(function (m) {
        choEntries.push({ meal: "From text", foodId: m.food.id, qty: roundExch(m.qty), unit: m.unit });
        if (m.gramUnsupported) gramUnsupportedCount++;
      });
      renderChoEntries();
      var msg = "Found " + matches.length + " food mention(s) and added them to the list below as \"From text\" — review, adjust quantities or remove any misreads, then click \"Insert breakdown into CHO Counting field\".";
      if (gramUnsupportedCount > 0) {
        msg += " Note: " + gramUnsupportedCount + " mention(s) gave a weight in grams for a food with no gram-based CHO source, so those were defaulted to ×1 portion — please correct the quantity manually.";
      }
      resultEl.textContent = msg;
    });
  }

  function resetChoCalculator() {
    choEntries = [];
    renderChoEntries();
    var resultEl = document.getElementById("choScanResult");
    if (resultEl) resultEl.textContent = "";
    var qtyEl = document.getElementById("choQtyInput");
    if (qtyEl) qtyEl.value = "1";
    var unitEl = document.getElementById("choUnitSelect");
    if (unitEl) unitEl.selectedIndex = 0;
    var mealEl = document.getElementById("choMealSelect");
    if (mealEl) mealEl.selectedIndex = 0;
    buildChoFoodOptions();
    updateChoPortionHint();
  }

  // ---------------------------------------------------------------------
  // CKD staging (KDIGO 2026 Diabetes & CKD Guideline Update, Public Review
  // Draft March 2026) - derives a G(1-5)/A(1-3) stage and CV-kidney risk
  // category from the free-text eGFR and UACR fields above, using the
  // standard KDIGO GFR/albuminuria category grid (Figure 1 "heatmap" of
  // that guideline). This is a best-effort text parse (first number found
  // in each field), not a validated calculator - always confirm the actual
  // lab values before acting on it.
  //
  // GFR categories (ml/min/1.73m2): G1 >=90, G2 60-89, G3a 45-59,
  // G3b 30-44, G4 15-29, G5 <15.
  // Albuminuria categories (UACR): A1 <30 mg/g [<3 mg/mmol], A2 30-300 mg/g
  // [3-30 mg/mmol], A3 >300 mg/g [>30 mg/mmol] - unit is read from the UACR
  // field text (defaults to mg/g if no unit is stated, since that's what
  // the field's placeholder uses).
  // ---------------------------------------------------------------------

  function parseFirstNumber(str) {
    if (!str) return null;
    var m = str.match(/(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  }

  function getGfrCategory(egfr) {
    if (egfr >= 90) return { code: "G1", desc: "normal or high" };
    if (egfr >= 60) return { code: "G2", desc: "mildly decreased" };
    if (egfr >= 45) return { code: "G3a", desc: "mildly-moderately decreased" };
    if (egfr >= 30) return { code: "G3b", desc: "moderately-severely decreased" };
    if (egfr >= 15) return { code: "G4", desc: "severely decreased" };
    return { code: "G5", desc: "kidney failure" };
  }

  function getAlbuminuriaCategory(uacrValue, isMmol) {
    // Normalise to mg/g-equivalent thresholds if the field was in mmol/mol-style mg/mmol units.
    var v = isMmol ? uacrValue * 8.84 : uacrValue;
    if (v < 30) return { code: "A1", desc: "normal-mildly increased" };
    if (v <= 300) return { code: "A2", desc: "moderately increased" };
    return { code: "A3", desc: "severely increased" };
  }

  // Standard KDIGO GFR x albuminuria risk grid (as referenced in the KDIGO
  // 2026 update's Figure 1 heatmap) - combines G and A category into an
  // overall CV/kidney-progression/mortality risk tier.
  var CKD_RISK_GRID = {
    G1: { A1: "Low risk", A2: "Moderately increased risk", A3: "High risk" },
    G2: { A1: "Low risk", A2: "Moderately increased risk", A3: "High risk" },
    G3a: { A1: "Moderately increased risk", A2: "High risk", A3: "Very high risk" },
    G3b: { A1: "High risk", A2: "Very high risk", A3: "Very high risk" },
    G4: { A1: "Very high risk", A2: "Very high risk", A3: "Very high risk" },
    G5: { A1: "Very high risk", A2: "Very high risk", A3: "Very high risk" }
  };

  function updateCkdStageHint() {
    var hintEl = document.getElementById("ckdStageHint");
    if (!hintEl) return;
    var egfrRaw = val("egfr");
    var uacrRaw = val("uacr");
    var egfr = parseFirstNumber(egfrRaw);
    var uacr = parseFirstNumber(uacrRaw);

    if (egfr === null && uacr === null) {
      hintEl.textContent = "";
      updateCkdHeatMapVisual(null, null);
      updateCkdColorFlag(null);
      return;
    }

    var parts = [];
    var gCat = null, aCat = null;
    if (egfr !== null) {
      gCat = getGfrCategory(egfr);
      parts.push(gCat.code + " (" + gCat.desc + ")");
    }
    if (uacr !== null) {
      var isMmol = /mmol/i.test(uacrRaw);
      aCat = getAlbuminuriaCategory(uacr, isMmol);
      parts.push(aCat.code + " (" + aCat.desc + ")");
    }

    var text = "KDIGO CKD stage (from text entered above): " + parts.join(", ") + ".";

    var risk = null;
    if (gCat && aCat && CKD_RISK_GRID[gCat.code]) {
      risk = CKD_RISK_GRID[gCat.code][aCat.code];
      if (risk) text += " Risk category: " + risk + " (KDIGO heatmap).";
    }
    updateCkdHeatMapVisual(gCat, aCat);
    updateCkdColorFlag(risk);

    var flags = [];
    if (egfr !== null && egfr < 45) {
      flags.push("adjust metformin dose (KDIGO 2026 Practice Point 4.6.3)");
    }
    if (egfr !== null && egfr < 30) {
      flags.push("metformin initiation generally not recommended below eGFR 30 (KDIGO 2026 Rec 4.6.1) - continuation in an existing tolerant patient is an individualised decision");
    }
    if (egfr !== null && egfr < 60) {
      flags.push("increase frequency of eGFR monitoring (KDIGO 2026 Practice Point 4.6.2)");
    }
    if (gCat && (gCat.code === "G3b" || gCat.code === "G4" || gCat.code === "G5")) {
      flags.push("at least \"high\" CV risk for LDL-C target purposes - see the LDL-C target hint below (CPG Dyslipidaemia 6th Ed. Table 4)");
    }
    if (flags.length) {
      text += " Consider: " + flags.join("; ") + ".";
    }

    hintEl.textContent = text;
  }

  // ---------------------------------------------------------------------
  // BMI classification (CPG Management of Obesity, 2nd Ed. 2023, Table 2-1,
  // Asian cut-offs). Best-effort text parse - looks for "BMI" followed by a
  // number in the free-text Weight/BMI field, not a validated calculator.
  // Note: CPG T2DM 6th Ed. 2020's own BMI table (Table 3-32) instead cites
  // the older 2004 Malaysian Obesity CPG's wider bands - see the hint text
  // in index.html for that flagged inconsistency.
  // ---------------------------------------------------------------------

  function extractBmiFromText(str) {
    if (!str) return null;
    var m = str.match(/BMI[^0-9]{0,5}(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : null;
  }

  function getBmiCategory(bmi) {
    if (bmi < 18.5) return { label: "Underweight", risk: "low, but increased risk of other clinical problems" };
    if (bmi <= 22.9) return { label: "Normal", risk: "optimal" };
    if (bmi <= 27.4) return { label: "Pre-obese (Overweight)", risk: "increased" };
    if (bmi <= 32.4) return { label: "Obese I", risk: "high" };
    if (bmi <= 37.4) return { label: "Obese II", risk: "very high" };
    return { label: "Obese III", risk: "extremely high" };
  }

  function updateBmiCategoryHint() {
    var hintEl = document.getElementById("bmiCategoryHint");
    if (!hintEl) return;
    var field = document.getElementById("weightBmi");
    var bmi = field ? extractBmiFromText(field.value) : null;

    if (bmi === null) {
      hintEl.textContent = "";
      updateWeightLossTarget();
      return;
    }

    var cat = getBmiCategory(bmi);
    hintEl.textContent = "BMI " + bmi + " → " + cat.label + " (" + cat.risk + " risk of comorbidities) – CPG Management of Obesity, 2nd Ed. 2023, Table 2-1.";
    updateWeightLossTarget();
  }

  // ---------------------------------------------------------------------
  // Weight-loss target calculator.
  //
  // Triggered at BMI >= 27.5 (Obese I on the Asian cut-offs already used
  // above), so the pharmacist can tell the patient a concrete number of kg
  // rather than an abstract percentage.
  //
  // Goals are the CPG Management of Obesity, 2nd Ed. 2023 "Weight loss
  // goals" (Section 4, Medical Nutrition Therapy):
  //   - up to 1 kg per week
  //   - up to 10% of baseline body weight
  //   - a total of 3-5% of baseline body weight where CV risk factors are
  //     present (hypertension, hyperlipidaemia, hyperglycaemia) - which
  //     applies to essentially every DMTAC patient, so the 3-5% figure is
  //     surfaced as the minimum clinically meaningful milestone alongside
  //     the 10% target the audit checklist asks about.
  // A modest 5-10% loss already improves BP, glycaemia and LDL-C; 10-15%
  // is needed for greater benefit (CPG, Section 2).
  //
  // Weight is parsed from the same free-text Weight/BMI field, accepting
  // "72kg", "72 kg", "BW 72", or a bare leading number.
  // ---------------------------------------------------------------------

  var WEIGHT_LOSS_BMI_TRIGGER = 27.5;

  function extractWeightFromText(str) {
    if (!str) return null;
    // Prefer an explicit kg value, e.g. "72kg" / "72.5 kg" / "BW 72 kg".
    var m = str.match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (m) return parseFloat(m[1]);
    // Then an explicitly labelled body weight, e.g. "BW 72" / "weight 72".
    m = str.match(/(?:BW|body\s*weight|weight|berat)[^0-9]{0,5}(\d+(?:\.\d+)?)/i);
    if (m) return parseFloat(m[1]);
    // Finally a bare leading number, but only if it is not the BMI itself.
    m = str.match(/^\s*(\d+(?:\.\d+)?)/);
    if (m) {
      var v = parseFloat(m[1]);
      var bmi = extractBmiFromText(str);
      if (bmi !== null && Math.abs(v - bmi) < 0.001) return null;
      return v;
    }
    return null;
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  function updateWeightLossTarget() {
    var el = document.getElementById("weightLossTargetHint");
    if (!el) return;
    var field = document.getElementById("weightBmi");
    var raw = field ? field.value : "";
    var bmi = extractBmiFromText(raw);

    if (bmi === null || bmi < WEIGHT_LOSS_BMI_TRIGGER) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }

    var weight = extractWeightFromText(raw);
    if (weight === null || weight <= 0) {
      el.style.display = "";
      el.textContent = "BMI " + bmi + " is in the obese range — weight-loss counselling is indicated (audit item). Add the patient's weight in kg to this field (e.g. \"78kg, BMI " + bmi + "\") and the exact kg to lose will be calculated here.";
      return;
    }

    var tenPct = round1(weight * 0.10);
    var targetW = round1(weight - tenPct);
    var minPct = round1(weight * 0.03);
    var maxPct = round1(weight * 0.05);
    var minTargetW = round1(weight - maxPct);
    var perWeek = round1(tenPct / 26); // 6 months ~ 26 weeks
    var perMonth = round1(tenPct / 6);

    el.style.display = "";
    el.textContent =
      "Weight-loss target from " + weight + " kg: lose " + tenPct + " kg over 6 months (10% of baseline) → target weight " +
      targetW + " kg. That is about " + perMonth + " kg per month, or " + perWeek + " kg per week " +
      "(CPG Obesity 2nd Ed. 2023 caps a realistic rate at 1 kg/week). " +
      "Minimum clinically meaningful milestone in a patient with CV risk factors (which includes diabetes): " +
      minPct + "–" + maxPct + " kg (3–5% of baseline) → " + minTargetW + " kg or below. " +
      "A 5–10% loss already improves blood pressure, glycaemia and LDL-C.";
  }

  function getWeightLossNoteText() {
    var el = document.getElementById("weightLossTargetHint");
    if (!el || el.style.display === "none") return "";
    var cb = document.getElementById("weightLossCounselled");
    if (!cb || !cb.checked) return "";
    var field = document.getElementById("weightBmi");
    var raw = field ? field.value : "";
    var weight = extractWeightFromText(raw);
    if (weight === null || weight <= 0) return "Weight-loss counselling given (target 10% of body weight over 6 months).";
    var tenPct = round1(weight * 0.10);
    var targetW = round1(weight - tenPct);
    return "Weight-loss counselling given: target to lose " + tenPct + " kg over 6 months (10% of " + weight + " kg) to a target weight of " + targetW + " kg, at about " + round1(tenPct / 6) + " kg/month.";
  }

  function resetWeightLossTarget() {
    var cb = document.getElementById("weightLossCounselled");
    if (cb) cb.checked = false;
    updateWeightLossTarget();
  }

  // ---------------------------------------------------------------------
  // FIB-4 (Fibrosis-4) index - MASLD/advanced-fibrosis triage.
  //
  // Source: CPG Management of Type 2 Diabetes Mellitus, 6th Ed. 2020,
  // Appendix 9 ("Fibrosis 4 Index") and Tables 3-37 / 3-38.
  //
  //   FIB-4 = [age (years) x AST (U/L)] / [platelets (x10^9/L) x sqrt(ALT)]
  //
  //   <1.3  = low risk for advanced fibrosis   -> repeat FIB-4 every 2-3 years
  //   >=1.3 = intermediate-to-high risk        -> refer for liver stiffness
  //           measurement (transient elastography), consider Gastro/Hepatology
  //
  // The CPG's Recommendation 1 (Grade A) is that ALL T2DM patients should
  // have platelet count, ALT and AST performed to assess for NASH and
  // advanced fibrosis, repeated ANNUALLY or more frequently as indicated -
  // which is why a ">12 months / not done" checkbox drives an explicit
  // "order these labs" flag rather than just leaving the score blank.
  //
  // The BMI trigger: obesity is the key metabolic driver of MASLD, so when
  // the Weight/BMI field contains a BMI in the Obese I band or above
  // (>=27.5 by the Asian cut-offs in CPG Management of Obesity 2nd Ed. 2023,
  // Table 2-1, which this app already uses for BMI labelling), we surface a
  // prominent flag next to the LFT field prompting FIB-4 calculation.
  // ---------------------------------------------------------------------

  var FIB4_BMI_TRIGGER = 27.5;
  var fib4SummaryAutoText = "";

  function calculateFib4(age, ast, platelets, alt) {
    if (!age || !ast || !platelets || !alt) return null;
    if (age <= 0 || ast <= 0 || platelets <= 0 || alt <= 0) return null;
    return (age * ast) / (platelets * Math.sqrt(alt));
  }

  function updateFib4() {
    var scoreEl = document.getElementById("fib4ScoreHint");
    var riskEl = document.getElementById("fib4RiskHint");
    var actionEl = document.getElementById("fib4ActionHint");
    if (!scoreEl) return;

    function num(id) {
      var v = document.getElementById(id).value;
      return v === "" ? null : parseFloat(v);
    }
    var age = num("fib4Age");
    var platelets = num("fib4Platelets");
    var ast = num("fib4Ast");
    var alt = num("fib4Alt");
    var stale = document.getElementById("fib4LabsStale").checked;

    var parts = [];

    if (stale) {
      actionEl.textContent = "ALT/AST/platelets are not current. CPG T2DM 6th Ed. 2020 Recommendation 1 (Grade A): every T2DM patient should have platelet count, ALT and AST done, repeated at least annually — request FBC + LFT (ALT/AST) for this patient, then return here to calculate FIB-4.";
    } else {
      actionEl.textContent = "";
    }

    var fib4 = calculateFib4(age, ast, platelets, alt);
    if (fib4 === null) {
      scoreEl.textContent = stale ? "" : "Enter age, platelet count, AST and ALT to calculate FIB-4.";
      riskEl.textContent = "";
      autoFillFib4Summary(stale ? "MASLD screening: ALT/AST/platelets not done within the past 12 months — FBC and LFT requested so FIB-4 can be calculated (CPG T2DM 6th Ed. 2020, Rec. 1, Grade A)." : "");
      return;
    }

    var rounded = Math.round(fib4 * 100) / 100;
    scoreEl.textContent = "FIB-4 = (" + age + " × " + ast + ") ÷ (" + platelets + " × √" + alt + ") = " + rounded + ".";

    var riskLabel, action;
    if (fib4 < 1.3) {
      riskLabel = "Low risk for advanced fibrosis";
      action = "Repeat FIB-4 every 2–3 years (CPG T2DM Table 3-37). Continue weight management and metabolic risk-factor control as the mainstay of MASLD treatment.";
    } else {
      riskLabel = "Intermediate-to-high risk for advanced fibrosis";
      action = "Refer for liver stiffness measurement (transient elastography/FibroScan) — CPG T2DM Recommendation 4 (Grade A).";
    }
    riskEl.innerHTML = "FIB-4 " + rounded + " → <strong>" + riskLabel + "</strong> (threshold 1.3).";

    var referrals = buildFib4Referrals(fib4, alt, ast);
    var extras = [action];
    if (referrals.length) extras.push("Referral/action: " + referrals.join(" "));
    extras.push("Note: a normal ALT/AST does not exclude NASH or advanced fibrosis.");
    if (stale) extras.unshift("(Labs flagged as not current — confirm these values are from a recent sample.)");
    actionEl.textContent = extras.join(" ");

    var summary = "MASLD screening (CPG T2DM 6th Ed. 2020, Appendix 9): FIB-4 " + rounded + " — " + riskLabel + ". " + action;
    if (referrals.length) summary += " " + referrals.join(" ");
    autoFillFib4Summary(summary);
  }

  // ---------------------------------------------------------------------
  // FIB-4 referral logic, mapped to the four Grade A recommendations in
  // CPG Management of T2DM 6th Ed. 2020, "Recommendations: Assessment of
  // NAFLD" (Section 3.9.4), and Table 3-37 / Appendix 9:
  //
  //   Rec 2  US of the liver          <- ELEVATED ALT and/or AST
  //                                      (to diagnose fatty liver and
  //                                       exclude a focal liver lesion)
  //   Rec 3  Exclude other causes of  <- PERSISTENTLY elevated ALT/AST
  //          chronic liver disease
  //   Rec 4  Liver stiffness          <- indeterminate/high fibrosis
  //          measurement                 biomarker, i.e. FIB-4 >=1.3
  //   Rec 5  Gastro/Hepatology        <- persistently elevated ALT/AST
  //                                      OR elevated liver stiffness
  //
  // IMPORTANT: the CPG ties the ULTRASOUND to raised transaminases, NOT to
  // a high FIB-4. A high FIB-4 on its own points to liver stiffness
  // measurement. The two triggers are therefore kept separate here rather
  // than firing an ultrasound off the FIB-4 score.
  //
  // "Elevated" is taken from the explicit checkbox where the pharmacist has
  // compared against their own lab's reference range; the >40 U/L numeric
  // fallback is only a hint, since reference ranges differ between labs.
  // ---------------------------------------------------------------------
  function buildFib4Referrals(fib4, alt, ast) {
    var elevatedBox = document.getElementById("fib4LftElevated");
    var persistentBox = document.getElementById("fib4LftPersistent");
    var elevatedTicked = elevatedBox && elevatedBox.checked;
    var persistent = persistentBox && persistentBox.checked;
    var numericHigh = (alt !== null && alt > 40) || (ast !== null && ast > 40);
    var elevated = elevatedTicked || persistent || numericHigh;

    var out = [];

    if (fib4 !== null && fib4 >= 1.3) {
      out.push("Refer for liver stiffness measurement (transient elastography/FibroScan) — CPG Rec. 4 (Grade A).");
    }

    if (elevated) {
      out.push("Request ultrasound of the liver (hepatobiliary/abdominal US) to diagnose fatty liver and exclude a focal liver lesion — CPG Rec. 2 (Grade A).");
      out.push("Repeat ALT/AST in 3–6 months.");
      if (!elevatedTicked && !persistent && numericHigh) {
        out.push("(ALT/AST flagged from the entered values against a generic 40 U/L cut-off — confirm against your own lab's reference range.)");
      }
    }

    if (persistent) {
      out.push("Investigate to exclude other causes of chronic liver disease — alcohol, hepatitis B/C, and drug-induced liver injury from prescribed, OTC or traditional products — CPG Rec. 3 (Grade A).");
      out.push("Consider referral to Gastroenterologist/Hepatologist — CPG Rec. 5 (Grade A).");
    } else if (fib4 !== null && fib4 >= 1.3) {
      out.push("Consider Gastroenterology/Hepatology referral if the liver stiffness measurement is elevated — CPG Rec. 5 (Grade A).");
    }

    return out;
  }

  function autoFillFib4Summary(text) {
    var box = document.getElementById("fib4Summary");
    if (!box) return;
    if (box.value === "" || box.value === fib4SummaryAutoText) {
      box.value = text;
      fib4SummaryAutoText = text;
    }
  }

  // BMI-driven prompt shown next to the LFT field: if the pharmacist has
  // typed a BMI at or above the Obese I cut-off, flag that this patient
  // should have FIB-4 calculated for MASLD.
  function updateFib4BmiFlag() {
    var box = document.getElementById("fib4FlagBox");
    if (!box) return;
    var field = document.getElementById("weightBmi");
    var bmi = field ? extractBmiFromText(field.value) : null;

    if (bmi === null || bmi < FIB4_BMI_TRIGGER) {
      box.style.display = "none";
      box.textContent = "";
      return;
    }

    var cat = getBmiCategory(bmi);
    var msg = "BMI " + bmi + " (" + cat.label + ") — calculate FIB-4 to screen for MASLD (metabolic dysfunction-associated steatotic liver disease) in this patient. Open the FIB-4 calculator below.";

    var altVal = document.getElementById("fib4Alt").value;
    var astVal = document.getElementById("fib4Ast").value;
    var pltVal = document.getElementById("fib4Platelets").value;
    var stale = document.getElementById("fib4LabsStale").checked;
    if (stale || altVal === "" || astVal === "" || pltVal === "") {
      msg += " ALT, AST and platelet count are needed — if these have not been done in the past 12 months, request FBC + LFT for this patient (CPG T2DM 6th Ed. 2020, Recommendation 1, Grade A: annual platelet count, ALT and AST for all T2DM patients).";
    }
    box.style.display = "";
    box.textContent = msg;
  }

  function initFib4() {
    ["fib4Age", "fib4Platelets", "fib4Ast", "fib4Alt"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        updateFib4();
        updateFib4BmiFlag();
      });
    });
    ["fib4LabsStale", "fib4LftElevated", "fib4LftPersistent"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", function () {
        updateFib4();
        updateFib4BmiFlag();
      });
    });
    document.getElementById("weightBmi").addEventListener("input", updateFib4BmiFlag);
    document.getElementById("fib4UseAgeBtn").addEventListener("click", function () {
      var age = document.getElementById("egfrCalcAge").value;
      if (age !== "") {
        document.getElementById("fib4Age").value = age;
        updateFib4();
        updateFib4BmiFlag();
      }
    });
    document.getElementById("fib4ResetBtn").addEventListener("click", resetFib4);
  }

  function resetFib4() {
    ["fib4Age", "fib4Platelets", "fib4Ast", "fib4Alt"].forEach(function (id) {
      document.getElementById(id).value = "";
    });
    ["fib4LabsStale", "fib4LftElevated", "fib4LftPersistent"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.checked = false;
    });
    document.getElementById("fib4Summary").value = "";
    fib4SummaryAutoText = "";
    ["fib4ScoreHint", "fib4RiskHint", "fib4ActionHint"].forEach(function (id) {
      document.getElementById(id).textContent = "";
    });
    updateFib4BmiFlag();
  }

  function getFib4NoteText() {
    var box = document.getElementById("fib4Summary");
    return box ? box.value.trim() : "";
  }

  // ---------------------------------------------------------------------
  // eGFR calculator (CKD-EPI 2021, race-free) - our lab no longer reports
  // eGFR directly, so this derives it from Serum Creatinine + Age + Sex.
  // Source: Inker LA et al. "New Creatinine- and Cystatin C-Based Equations
  // to Estimate GFR without Race." NEJM 2021 - the equation KDIGO endorses
  // and NKF/ASN currently recommend for GFR reporting. A calculation aid
  // only, never overwrites the eGFR field unless you click the Insert
  // button, and a lab-reported eGFR should always be preferred when available.
  // ---------------------------------------------------------------------

  var lastCalculatedEgfr = null;

  function convertScrToMgDl(value, unit) {
    if (value === null) return null;
    return unit === "umol" ? value / 88.4 : value;
  }

  function calculateEgfrCkdEpi2021(scrMgDl, age, sex) {
    if (scrMgDl === null || scrMgDl <= 0 || !age || age <= 0 || (sex !== "male" && sex !== "female")) return null;
    var kappa = sex === "female" ? 0.7 : 0.9;
    var alpha = sex === "female" ? -0.241 : -0.302;
    var ratio = scrMgDl / kappa;
    var minRatio = Math.min(ratio, 1);
    var maxRatio = Math.max(ratio, 1);
    var egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.2) * Math.pow(0.9938, age);
    if (sex === "female") egfr *= 1.012;
    return egfr;
  }

  function updateEgfrCalcHint() {
    var hintEl = document.getElementById("egfrCalcHint");
    var btn = document.getElementById("egfrCalcInsertBtn");
    if (!hintEl || !btn) return;

    var scrValue = parseFirstNumber(document.getElementById("srCreat").value);
    var unit = document.getElementById("srCreatUnit").value;
    var ageInput = document.getElementById("egfrCalcAge").value;
    var age = ageInput === "" ? null : parseFloat(ageInput);
    var sex = document.getElementById("egfrCalcSex").value;

    if (scrValue === null || !age || !sex) {
      hintEl.textContent = "";
      btn.style.display = "none";
      lastCalculatedEgfr = null;
      return;
    }

    var scrMgDl = convertScrToMgDl(scrValue, unit);
    var egfr = calculateEgfrCkdEpi2021(scrMgDl, age, sex);
    if (egfr === null) {
      hintEl.textContent = "";
      btn.style.display = "none";
      lastCalculatedEgfr = null;
      return;
    }

    var rounded = Math.round(egfr);
    lastCalculatedEgfr = rounded;
    var unitLabel = unit === "umol" ? "µmol/L" : "mg/dL";
    hintEl.textContent = "Calculated eGFR (CKD-EPI 2021): " + rounded + " mL/min/1.73m² (from SrCreat " + scrValue + " " + unitLabel + ", age " + age + ", " + sex + ").";
    btn.style.display = "";
  }

  function initEgfrCalculator() {
    ["srCreat", "egfrCalcAge"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updateEgfrCalcHint);
    });
    ["srCreatUnit", "egfrCalcSex"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", updateEgfrCalcHint);
    });
    document.getElementById("egfrCalcInsertBtn").addEventListener("click", function () {
      if (lastCalculatedEgfr === null) return;
      setFieldValue(document.getElementById("egfr"), lastCalculatedEgfr + " mL/min/1.73m² (calculated, CKD-EPI 2021)");
      updateCkdStageHint();
    });
  }

  function resetEgfrCalculator() {
    document.getElementById("srCreat").value = "";
    document.getElementById("srCreatUnit").selectedIndex = 0;
    document.getElementById("egfrCalcAge").value = "";
    document.getElementById("egfrCalcSex").selectedIndex = 0;
    lastCalculatedEgfr = null;
    updateEgfrCalcHint();
  }

  function getSrCreatNoteText() {
    var raw = document.getElementById("srCreat").value.trim();
    if (!raw) return "";
    var unit = document.getElementById("srCreatUnit").value;
    var unitLabel = unit === "umol" ? "µmol/L" : "mg/dL";
    // Avoid a duplicated unit if the pharmacist already typed one (e.g. "88 umol/L").
    return "SrCreat " + raw + (/[a-zA-Z]/.test(raw) ? "" : " " + unitLabel);
  }

  // ---------------------------------------------------------------------
  // Albuminuria (ACR/AER) calculator - converts whichever measurement type
  // the lab reports into the mg/g-equivalent used by getAlbuminuriaCategory()
  // above and by the KDIGO heat map, then offers to insert it into the
  // free-text UACR field (same non-destructive "Insert" pattern as the
  // SrCreat -> eGFR calculator). ACR mg/mmol -> mg/g uses the standard
  // x8.84 conversion factor (creatinine molar mass); AER mg/24h is treated
  // as numerically equivalent to ACR mg/g, per KDIGO's own convention that
  // the same A1/A2/A3 cut-offs (<30 / 30-300 / >300) apply to both.
  // ---------------------------------------------------------------------

  var lastCalculatedAcrMgG = null;

  function convertAcrToMgG(value, type) {
    if (value === null || isNaN(value)) return null;
    if (type === "acr_mgmmol") return value * 8.84;
    return value; // acr_mgg or aer_mg24h - already mg/g-equivalent
  }

  function updateAcrCalcHint() {
    var hintEl = document.getElementById("acrCalcHint");
    var btn = document.getElementById("acrCalcInsertBtn");
    if (!hintEl || !btn) return;

    var raw = document.getElementById("acrValue").value;
    var type = document.getElementById("acrType").value;
    if (raw === "") {
      hintEl.textContent = "";
      btn.style.display = "none";
      lastCalculatedAcrMgG = null;
      return;
    }
    var value = parseFloat(raw);
    var mgG = convertAcrToMgG(value, type);
    if (mgG === null) {
      hintEl.textContent = "";
      btn.style.display = "none";
      lastCalculatedAcrMgG = null;
      return;
    }
    var rounded = Math.round(mgG * 10) / 10;
    lastCalculatedAcrMgG = rounded;
    var cat = getAlbuminuriaCategory(rounded, false);
    var typeLabel = type === "acr_mgmmol" ? "ACR " + value + " mg/mmol" : (type === "aer_mg24h" ? "AER " + value + " mg/24h" : "ACR " + value + " mg/g");
    hintEl.textContent = typeLabel + " → " + rounded + " mg/g-equivalent → " + cat.code + " (" + cat.desc + ").";
    btn.style.display = "";
  }

  function initAcrCalculator() {
    document.getElementById("acrValue").addEventListener("input", updateAcrCalcHint);
    document.getElementById("acrType").addEventListener("change", updateAcrCalcHint);
    document.getElementById("acrCalcInsertBtn").addEventListener("click", function () {
      if (lastCalculatedAcrMgG === null) return;
      setFieldValue(document.getElementById("uacr"), lastCalculatedAcrMgG + " mg/g (calculated)");
      updateCkdStageHint();
    });
  }

  function resetAcrCalculator() {
    document.getElementById("acrValue").value = "";
    document.getElementById("acrType").selectedIndex = 0;
    lastCalculatedAcrMgG = null;
    updateAcrCalcHint();
  }

  // ---------------------------------------------------------------------
  // Urine PCI (uPCR) / 24-hour urine protein (PER) -> KDIGO A-stage.
  //
  // Our lab reports Urine PCI; UACR is outsourced, so pharmacists often
  // only have a protein-based result. KDIGO publishes an APPROXIMATE
  // equivalence between proteinuria and albuminuria categories ("Relationship
  // among categories of albuminuria and proteinuria", KDIGO CKD Guideline;
  // reproduced as Table 22.1 in Diabetes in America 3rd Ed., NIDDK 2018):
  //
  //   A1: ACR <30 mg/g   | PCR <150 mg/g (<15 mg/mmol)   | PER <150 mg/24h
  //   A2: ACR 30-300     | PCR 150-500 (15-50 mg/mmol)   | PER 150-500
  //   A3: ACR >300       | PCR >500 (>50 mg/mmol)        | PER >500
  //
  // Note KDIGO gives spot PCR (mg/g) and 24-hour PER (mg/24h) the SAME
  // numeric cut-points, which is why both feed this one function.
  //
  // We deliberately return the CATEGORY, not a fabricated single ACR number.
  // Published numeric PCR->ACR equations do exist (Sumida K, Nadkarni GN,
  // Grams ME, et al. "Conversion of Urine Protein-Creatinine Ratio or Urine
  // Dipstick Protein to Urine Albumin-Creatinine Ratio for Use in CKD
  // Screening and Prognosis." Ann Intern Med 2020;173(6):426-435), but they
  // are spline-based with sex/diabetes/hypertension terms and the authors
  // note the PCR-ACR association is inconsistent below PCR 50 mg/g - so
  // inventing a precise ACR here would be false precision. Both KDIGO and
  // CPG T2DM 6th Ed. 2020 state ACR is the preferred measure; CPG T2DM does
  // accept uPCR for monitoring treatment response in established proteinuria
  // on cost-effectiveness grounds (Section 5, Level III).
  //
  // mg/mmol -> mg/g uses the standard x8.84 creatinine conversion (KDIGO's
  // own rounded table gives 15 mg/mmol ~ 150 mg/g and 50 ~ 500, consistent
  // with this). g/mol is numerically identical to mg/mmol. g/24h -> mg/24h
  // is x1000.
  // ---------------------------------------------------------------------

  var lastPciBand = null;

  function convertPciToMgGEquivalent(value, unit) {
    if (value === null || isNaN(value)) return null;
    if (unit === "mgmmol" || unit === "gmol") return value * 8.84;
    if (unit === "per_g24h") return value * 1000;
    return value; // mgg or per_mg24h - already in the mg/g-equivalent scale
  }

  function getProteinuriaBand(mgGEquivalent) {
    if (mgGEquivalent < 150) return { code: "A1", desc: "normal-mildly increased" };
    if (mgGEquivalent <= 500) return { code: "A2", desc: "moderately increased (microalbuminuria range)" };
    return { code: "A3", desc: "severely increased (macroalbuminuria/overt proteinuria range)" };
  }

  var PCI_UNIT_LABEL = {
    mgg: "Urine PCI/uPCR",
    mgmmol: "Urine PCI/uPCR",
    gmol: "Urine PCI/uPCR",
    per_mg24h: "24-hour urine protein (PER)",
    per_g24h: "24-hour urine protein (PER)"
  };

  function updatePciConverter() {
    var resultEl = document.getElementById("pciResultHint");
    var bandEl = document.getElementById("pciBandHint");
    var estEl = document.getElementById("pciEstimateHint");
    var btn = document.getElementById("pciInsertBtn");
    if (!resultEl) return;

    var raw = document.getElementById("pciValue").value;
    var unit = document.getElementById("pciUnit").value;

    if (raw === "") {
      resultEl.textContent = "";
      bandEl.textContent = "";
      estEl.textContent = "";
      btn.style.display = "none";
      lastPciBand = null;
      return;
    }

    var value = parseFloat(raw);
    var mgG = convertPciToMgGEquivalent(value, unit);
    if (mgG === null) {
      resultEl.textContent = "";
      bandEl.textContent = "";
      estEl.textContent = "";
      btn.style.display = "none";
      lastPciBand = null;
      return;
    }

    var rounded = Math.round(mgG * 10) / 10;
    var band = getProteinuriaBand(rounded);
    lastPciBand = { code: band.code, desc: band.desc, value: value, unit: unit, mgG: rounded };

    var isTwentyFourHour = unit === "per_mg24h" || unit === "per_g24h";
    var scaleLabel = isTwentyFourHour ? "mg/24h" : "mg/g";
    var srcLabel = PCI_UNIT_LABEL[unit];

    if (unit === "mgg" || unit === "per_mg24h") {
      resultEl.textContent = srcLabel + " " + value + " " + scaleLabel + ".";
    } else {
      resultEl.textContent = srcLabel + " " + value + " " + (unit === "per_g24h" ? "g/24h" : (unit === "gmol" ? "g/mol" : "mg/mmol")) + " → " + rounded + " " + scaleLabel + ".";
    }

    bandEl.innerHTML = "Albuminuria category: <strong>" + band.code + "</strong> (" + band.desc + ").";

    var estParts = [];
    estParts.push("This is the KDIGO approximate proteinuria→albuminuria category equivalence (PCR/PER <150 = A1, 150–500 = A2, >500 = A3), not a numeric UACR — the equivalent UACR band is " +
      (band.code === "A1" ? "<30 mg/g" : (band.code === "A2" ? "30–300 mg/g" : ">300 mg/g")) + ".");
    if (rounded < 50) {
      estParts.push("Caution: below PCR ~50 mg/g the protein–albumin relationship is inconsistent (Sumida 2020), so treat a low PCI as suggestive rather than confirmatory of A1.");
    }
    if (band.code !== "A1") {
      estParts.push("A confirmed UACR from Hospital Seberang Jaya is still preferred before acting on any ACR-specific threshold (e.g. SGLT2i initiation at ACR ≥200, or the ≥300 macroalbuminuria cut-off).");
    }
    estEl.textContent = estParts.join(" ");

    btn.style.display = "";
  }

  function initPciConverter() {
    document.getElementById("pciValue").addEventListener("input", updatePciConverter);
    document.getElementById("pciUnit").addEventListener("change", updatePciConverter);
    document.getElementById("pciInsertBtn").addEventListener("click", function () {
      if (!lastPciBand) return;
      var u = lastPciBand.unit;
      var unitText = u === "mgg" ? "mg/g" : (u === "mgmmol" ? "mg/mmol" : (u === "gmol" ? "g/mol" : (u === "per_mg24h" ? "mg/24h" : "g/24h")));
      var srcText = PCI_UNIT_LABEL[u] + " " + lastPciBand.value + " " + unitText;
      setFieldValue(document.getElementById("uacr"), srcText + " → " + lastPciBand.code + " (KDIGO approximate proteinuria equivalence; UACR not directly measured)");
      updateCkdStageHint();
      computeCkdPillars();
    });
    document.getElementById("pciResetBtn").addEventListener("click", resetPciConverter);
  }

  function resetPciConverter() {
    document.getElementById("pciValue").value = "";
    document.getElementById("pciUnit").selectedIndex = 0;
    lastPciBand = null;
    updatePciConverter();
  }

  // ---------------------------------------------------------------------
  // KDIGO CKD heat map (visual grid) + colour-zone flag. Colours and grid
  // reproduced from the "CKD Heat Map" reference (KDIGO-style G x A grid,
  // 2026 update sources) - green/yellow/orange/red = Low/Moderately
  // increased/High/Very high risk, matching the text categories already
  // computed by CKD_RISK_GRID above. Per the "What To Do in Yellow or
  // Orange" guidance from the same source: Yellow or Orange zones should
  // prompt BP <130/80 mmHg, an SGLT2 inhibitor (kidney-protective, with or
  // without diabetes), glycaemic control, and eGFR+UACR screening 1-2x/year.
  // ---------------------------------------------------------------------

  var CKD_RISK_COLOR_CLASS = {
    "Low risk": "risk-low",
    "Moderately increased risk": "risk-mod",
    "High risk": "risk-high",
    "Very high risk": "risk-veryhigh"
  };

  function updateCkdHeatMapVisual(gCat, aCat) {
    var table = document.getElementById("ckdHeatMap");
    if (!table) return;
    table.querySelectorAll("td.active-cell").forEach(function (td) { td.classList.remove("active-cell"); });
    if (gCat && aCat) {
      var cell = table.querySelector('[data-cell="' + gCat.code + "-" + aCat.code + '"]');
      if (cell) cell.classList.add("active-cell");
    }
  }

  function updateCkdColorFlag(risk) {
    var box = document.getElementById("ckdColorFlagBox");
    if (!box) return;
    if (risk === "Moderately increased risk" || risk === "High risk") {
      box.style.display = "";
      box.textContent = "KDIGO heat map: " + (risk === "High risk" ? "Orange" : "Yellow") + " zone — recommend: blood pressure target <130/80 mmHg; blood sugar control (HbA1c) at target; kidney-protective medicine (start/continue an SGLT2 inhibitor, eGFR permitting); screen eGFR + UACR 1–2×/year.";
    } else if (risk === "Very high risk") {
      box.style.display = "";
      box.textContent = "KDIGO heat map: Red (Very high risk) zone — the same measures apply (BP <130/80 mmHg, HbA1c at target, SGLT2 inhibitor if eGFR permits, eGFR+UACR screening) with added urgency; consider discussing further workup/nephrology input with the treating doctor.";
    } else {
      box.style.display = "none";
      box.textContent = "";
    }
  }

  // ---------------------------------------------------------------------
  // CKD 4 Pillars of Protection - sequencing/eligibility checker for the
  // four kidney/CV-protective drug classes, in the order they're typically
  // layered on. Source: "The 4 Pillars of CKD Protection" (Dr Nixon Goyal,
  // CKD 2024-26 Update Series), cross-checked against KDIGO 2024 CKD
  // Guideline (Kidney Int. 2024;105[4S]), KDIGO 2022 Diabetes in CKD
  // Guideline (102[5S]), and the KDIGO 2026 Diabetes & CKD Guideline Update
  // (Public Review Draft, March 2026) already used above. Reuses the
  // eGFR/UACR already entered above rather than asking again.
  // ---------------------------------------------------------------------

  function uacrToMgGForPillars() {
    var uacrRaw = val("uacr");
    var uacr = parseFirstNumber(uacrRaw);
    if (uacr === null) return null;
    var isMmol = /mmol/i.test(uacrRaw);
    return isMmol ? uacr * 8.84 : uacr;
  }

  function computeCkdPillars() {
    var egfr = parseFirstNumber(val("egfr"));
    var acrMgG = uacrToMgGForPillars();
    var kRaw = document.getElementById("ckdPotassium").value;
    var k = kRaw === "" ? null : parseFloat(kRaw);
    var hf = document.getElementById("ckdHeartFailure").checked;
    var onRaasi = document.getElementById("ckdOnRaasi").checked;
    var onSglt2i = document.getElementById("ckdOnSglt2i").checked;
    var onFinerenone = document.getElementById("ckdOnFinerenone").checked;
    var onGlp1 = document.getElementById("ckdOnGlp1").checked;

    var p1El = document.getElementById("ckdPillar1Hint");
    var p2El = document.getElementById("ckdPillar2Hint");
    var p3El = document.getElementById("ckdPillar3Hint");
    var p4El = document.getElementById("ckdPillar4Hint");
    if (!p1El) return;

    var lines = [];

    // Pillar 1 - RAASi
    var p1;
    if (onRaasi) {
      p1 = "Pillar 1 (RAASi): already on — titrate to max tolerated dose; a creatinine rise up to 30% is acceptable, don't stop; continue even if eGFR <30; recheck K⁺/creatinine 2–4 weeks after each titration.";
    } else if (acrMgG !== null && acrMgG >= 30) {
      p1 = "Pillar 1 (RAASi): not yet on — indicated (albuminuria present). Start an ACEi or ARB and titrate to max tolerated dose; never combine ACEi+ARB+direct renin inhibitor.";
    } else {
      p1 = "Pillar 1 (RAASi): not yet on — indicated for albuminuria or hypertension (foundation of essentially every CKD regimen); consider even without confirmed albuminuria if hypertensive.";
    }
    p1El.textContent = p1; lines.push(p1);

    // Pillar 2 - SGLT2i
    var p2;
    if (onSglt2i) {
      if (egfr !== null && egfr < 20) {
        p2 = "Pillar 2 (SGLT2i): already on — continue below eGFR 20 until dialysis (do not stop for eGFR decline alone); hold on sick days/surgery/fasting with poor oral intake.";
      } else {
        p2 = "Pillar 2 (SGLT2i): already on — continue; expect an early, reversible eGFR dip of up to 30%; hold on sick days/surgery/fasting with poor oral intake.";
      }
    } else if (egfr !== null && egfr < 20) {
      p2 = "Pillar 2 (SGLT2i): not started — eGFR <20 is below the usual initiation threshold (eGFR ≥20); if already established on it, continuation until dialysis is still appropriate, but new initiation at this eGFR needs specialist input.";
    } else if ((egfr === null || egfr >= 20) && ((acrMgG !== null && acrMgG >= 200) || hf)) {
      p2 = "Pillar 2 (SGLT2i): not yet on — indicated (eGFR ≥20 and " + (hf ? "heart failure" : "ACR ≥200") + ") — add early, with or without diabetes.";
    } else {
      p2 = "Pillar 2 (SGLT2i): not yet on — criteria for early add-on (eGFR ≥20 + ACR ≥200, or heart failure) not clearly met from the values entered; reassess once eGFR/ACR/HF status is confirmed.";
    }
    p2El.textContent = p2; lines.push(p2);

    // Pillar 3 - Finerenone
    var p3;
    if (onFinerenone) {
      if (k !== null && k > 5.5) {
        p3 = "Pillar 3 (Finerenone): currently on, but K⁺ " + k + " mmol/L is >5.5 — HOLD per guardrail; restart once K⁺ ≤5.0.";
      } else {
        p3 = "Pillar 3 (Finerenone): already on — continue if K⁺ ≤5.5 (current: " + (k !== null ? k + " mmol/L" : "not entered") + "); recheck K⁺ ~4 weeks after starting/restarting (hyperkalaemia risk ~14% vs 6.9% placebo, FIDELIO/FIGARO).";
      }
    } else if (egfr !== null && egfr < 25) {
      p3 = "Pillar 3 (Finerenone): not indicated — eGFR " + egfr + " is below the eGFR ≥25 threshold for starting.";
    } else if (k !== null && k > 5.0) {
      p3 = "Pillar 3 (Finerenone): not started — K⁺ " + k + " mmol/L is above the ≤5.0 threshold to start; recheck potassium before initiating.";
    } else if (onRaasi && onSglt2i && acrMgG !== null && acrMgG >= 30) {
      p3 = "Pillar 3 (Finerenone): not yet on — indicated (T2D + CKD + persistent albuminuria despite RAASi + SGLT2i), eGFR/K⁺ permitting from the values entered.";
    } else {
      p3 = "Pillar 3 (Finerenone): reserved for T2D + CKD + albuminuria persisting despite RAASi + SGLT2i (add on top of pillars 1 & 2, not before).";
    }
    p3El.textContent = p3; lines.push(p3);

    // Pillar 4 - GLP-1 RA
    var p4;
    if (onGlp1) {
      p4 = "Pillar 4 (GLP-1 RA): already on — kidney + CV benefit shown regardless of baseline SGLT2i use (FLOW trial, semaglutide 1mg weekly); continue, monitor GI tolerance.";
    } else if (acrMgG !== null && acrMgG >= 30) {
      p4 = "Pillar 4 (GLP-1 RA): not yet on — indicated (T2D + albuminuria); FLOW trial showed kidney + CV benefit with or without baseline SGLT2i, plus weight/glycaemic benefit.";
    } else {
      p4 = "Pillar 4 (GLP-1 RA): consider once albuminuria is confirmed (T2D + albuminuria); kidney + CV benefit shown with or without baseline SGLT2i (FLOW trial).";
    }
    p4El.textContent = p4; lines.push(p4);

    autoFillCkdPillarsSummary(lines.join(" "));
  }

  var ckdPillarsSummaryAutoText = "";

  function autoFillCkdPillarsSummary(text) {
    var box = document.getElementById("ckdPillarsSummary");
    if (!box) return;
    if (box.value === "" || box.value === ckdPillarsSummaryAutoText) {
      box.value = text;
      ckdPillarsSummaryAutoText = text;
    }
  }

  function initCkdPillarsTool() {
    ["ckdPotassium"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", computeCkdPillars);
    });
    ["ckdHeartFailure", "ckdOnRaasi", "ckdOnSglt2i", "ckdOnFinerenone", "ckdOnGlp1"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", computeCkdPillars);
    });
    ["egfr", "uacr"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", computeCkdPillars);
    });
    document.getElementById("ckdPillarsResetBtn").addEventListener("click", resetCkdPillarsTool);
  }

  function resetCkdPillarsTool() {
    document.getElementById("ckdPotassium").value = "";
    ["ckdHeartFailure", "ckdOnRaasi", "ckdOnSglt2i", "ckdOnFinerenone", "ckdOnGlp1"].forEach(function (id) {
      document.getElementById(id).checked = false;
    });
    ["ckdPillar1Hint", "ckdPillar2Hint", "ckdPillar3Hint", "ckdPillar4Hint"].forEach(function (id) {
      document.getElementById(id).textContent = "";
    });
    document.getElementById("ckdPillarsSummary").value = "";
    ckdPillarsSummaryAutoText = "";
  }

  function getCkdPillarsNoteText() {
    var box = document.getElementById("ckdPillarsSummary");
    return box ? box.value.trim() : "";
  }

  // ---------------------------------------------------------------------
  // Lipid-Lowering Therapy Advisor
  // Framingham General CVD point tables reproduced from CPG Management of
  // Dyslipidaemia 6th Ed. 2023, Tables 1A/1B (men) & 2A/2B (women) - these
  // are the CPG's own mmol/L-native re-expression of D'Agostino RB Sr et
  // al., "General Cardiovascular Risk Profile for Use in Primary Care,"
  // Circulation 2008;117:743-753 (verified against the original paper's
  // Tables 5-8). Risk category overrides and LDL-C/non-HDL-C targets from
  // CPG Table 4 & Section 5.2.3. Statin intensity table from CPG Table 12,
  // cross-checked against the 2026 ACC/AHA/... Guideline on the Management
  // of Dyslipidemia Table 6 (identical for the statins in this facility's
  // formulary). This is a calculation and formulary-matching aid only -
  // always apply clinical judgement and confirm against the source tables.
  // ---------------------------------------------------------------------

  var FRS_MEN = {
    age: [[30, 35, 0], [35, 40, 2], [40, 45, 5], [45, 50, 6], [50, 55, 8], [55, 60, 10], [60, 65, 11], [65, 70, 12], [70, 75, 14], [75, 200, 15]],
    hdl: [[1.6, 99, -2], [1.3, 1.6, -1], [1.2, 1.3, 0], [0.9, 1.2, 1], [-99, 0.9, 2]],
    tc: [[-99, 4.2, 0], [4.2, 5.2, 1], [5.2, 6.3, 2], [6.3, 7.4, 3], [7.4, 999, 4]],
    sbpNotTreated: [[-99, 130, 0], [130, 140, 1], [140, 160, 2], [160, 999, 3]],
    sbpTreated: [[-99, 120, 0], [120, 130, 2], [130, 140, 3], [140, 160, 4], [160, 999, 5]],
    smoker: 4,
    diabetic: 3,
    riskTable: [[-99, -2, 0.9], [-2, -1, 1.1], [-1, 0, 1.4], [0, 1, 1.6], [1, 2, 1.9], [2, 3, 2.3], [3, 4, 2.8], [4, 5, 3.3], [5, 6, 3.9], [6, 7, 4.7], [7, 8, 5.6], [8, 9, 6.7], [9, 10, 7.9], [10, 11, 9.4], [11, 12, 11.2], [12, 13, 13.2], [13, 14, 15.6], [14, 15, 18.4], [15, 16, 21.6], [16, 17, 25.3], [17, 18, 29.4], [18, 99, 30]]
  };

  var FRS_WOMEN = {
    age: [[30, 35, 0], [35, 40, 2], [40, 45, 4], [45, 50, 5], [50, 55, 7], [55, 60, 8], [60, 65, 9], [65, 70, 10], [70, 75, 11], [75, 200, 12]],
    hdl: [[1.6, 99, -2], [1.3, 1.6, -1], [1.2, 1.3, 0], [0.9, 1.2, 1], [-99, 0.9, 2]],
    tc: [[-99, 4.2, 0], [4.2, 5.2, 1], [5.2, 6.3, 3], [6.3, 7.4, 4], [7.4, 999, 5]],
    sbpNotTreated: [[-99, 130, 0], [130, 140, 1], [140, 150, 2], [150, 160, 4], [160, 999, 5]],
    sbpTreated: [[-99, 120, -1], [120, 130, 2], [130, 140, 3], [140, 150, 5], [150, 160, 6], [160, 999, 7]],
    smoker: 3,
    diabetic: 4,
    riskTable: [[-99, -1, 0.9], [-1, 0, 1.0], [0, 1, 1.2], [1, 2, 1.5], [2, 3, 1.7], [3, 4, 2.0], [4, 5, 2.4], [5, 6, 2.8], [6, 7, 3.3], [7, 8, 3.9], [8, 9, 4.5], [9, 10, 5.3], [10, 11, 6.3], [11, 12, 7.3], [12, 13, 8.6], [13, 14, 10.0], [14, 15, 11.7], [15, 16, 13.7], [16, 17, 15.9], [17, 18, 18.5], [18, 19, 21.5], [19, 20, 24.8], [20, 21, 28.5], [21, 99, 30]]
  };

  function lookupBand(bands, value) {
    for (var i = 0; i < bands.length; i++) {
      if (value >= bands[i][0] && value < bands[i][1]) return bands[i][2];
    }
    return bands[bands.length - 1][2];
  }

  var LIPID_AGENT_MAP = {
    none: { intensity: null, label: "not on any lipid-lowering agent" },
    simva10: { intensity: "low", label: "T. Simvastatin 10mg" },
    simva20: { intensity: "moderate", label: "T. Simvastatin 20mg" },
    simva40: { intensity: "moderate", label: "T. Simvastatin 40mg" },
    atorva20: { intensity: "moderate", label: "T. Atorvastatin 20mg" },
    atorva40: { intensity: "high", label: "T. Atorvastatin 40mg" },
    atorva60: { intensity: "high", label: "T. Atorvastatin 60mg" },
    atorva80: { intensity: "high", label: "T. Atorvastatin 80mg" },
    prava20: { intensity: "low", label: "T. Pravastatin 20mg" },
    rosuva20: { intensity: "high", label: "T. Rosuvastatin 20mg" },
    ezetimibe10: { intensity: null, isNonStatin: true, label: "T. Ezetimibe 10mg" },
    gemfibrozil300: { intensity: null, isFibrate: true, label: "T. Gemfibrozil 300mg" },
    fenofibrate145: { intensity: null, isFibrate: true, label: "T. Fenofibrate 145mg" }
  };

  var LIPID_INTENSITY_RANK = { low: 1, moderate: 2, high: 3 };
  var LIPID_INTENSITY_DRUGS = {
    high: ["T. Atorvastatin 40-80mg OD", "T. Rosuvastatin 20mg OD"],
    moderate: ["T. Atorvastatin 20mg OD", "T. Simvastatin 20-40mg ON"],
    low: ["T. Simvastatin 10mg ON", "T. Pravastatin 20mg OD"]
  };
  var LIPID_INTENSITY_LABEL = { high: "High-intensity", moderate: "Moderate-intensity", low: "Low-intensity" };

  var LIPID_TIER_INFO = {
    extreme: { label: "Very High (Extreme/recurrent-event)", ldl: 1.0, ldlText: "<1.0 mmol/L", nonHdlText: "use Very High non-HDL-C target ≤2.2 mmol/L as reference", apoB: 0.65, apoBText: "<0.65 g/L (<65 mg/dL) — same as Very High tier; the 2026 guideline does not define a separate extreme/recurrent-event ApoB goal", intensity: "high" },
    veryhigh: { label: "Very High", ldl: 1.4, ldlText: "≤1.4 mmol/L (≥50% reduction from baseline)", nonHdlText: "≤2.2 mmol/L", apoB: 0.65, apoBText: "<0.65 g/L (<65 mg/dL)", intensity: "high" },
    high: { label: "High", ldl: 1.8, ldlText: "≤1.8 mmol/L (≥50% reduction from baseline)", nonHdlText: "≤2.6 mmol/L", apoB: 0.80, apoBText: "<0.80 g/L (<80 mg/dL)", intensity: "high" },
    intermediate: { label: "Intermediate (Moderate)", ldl: 2.6, ldlText: "<2.6 mmol/L (initiate drug therapy if LDL-C >2.6 after an 8-12 week TLC trial)", nonHdlText: "<3.4 mmol/L", apoB: null, apoBText: "not separately defined at this risk tier — use the LDL-C/non-HDL-C targets", intensity: "moderate" },
    low: { label: "Low", ldl: 3.0, ldlText: "<3.0 mmol/L (drug therapy per clinical judgement after an 8-12 week TLC trial)", nonHdlText: "<3.8 mmol/L", apoB: null, apoBText: "not defined at this risk tier", intensity: "low" }
  };

  // ---------------------------------------------------------------------
  // 2026 ACC/AHA/AACVPR/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the
  // Management of Dyslipidemia (Blumenthal JA et al., 2026) — targets above
  // (LDL-C, non-HDL-C) were cross-checked against this 2026 update and are
  // numerically identical to CPG Dyslipidaemia 2023 once converted to
  // mmol/L (<55/<70/<100 mg/dL = <1.4/<1.8/<2.6 mmol/L LDL-C; <85/<100/<130
  // mg/dL = <2.2/<2.6/<3.4 mmol/L non-HDL-C for Very High/High/Intermediate
  // risk respectively). What the 2026 update adds on top of CPG Malaysia:
  // explicit ApoB targets (<65 mg/dL Very High, <80 mg/dL High), guidance on
  // when ApoB is reasonable to check, and universal one-off Lp(a) screening
  // (see the Lp(a) checkbox/hint above). Newer non-statin agents named in
  // the 2026 update (PCSK9 inhibitors, inclisiran, bempedoic acid) are not
  // in this facility's formulary and are therefore not offered as
  // suggestions here — flagged for reference only.
  // ---------------------------------------------------------------------
  function updateApoBHint(tier, diabetic, tgVal, currentLdl) {
    var hintEl = document.getElementById("lipidApoBHint");
    if (!hintEl) return;
    var info = tier ? LIPID_TIER_INFO[tier] : null;

    var apoBRaw = document.getElementById("lipidApoB").value;
    var apoBUnit = document.getElementById("lipidApoBUnit").value;
    var apoBGl = null;
    if (apoBRaw !== "") {
      var apoBNum = parseFloat(apoBRaw);
      if (!isNaN(apoBNum)) apoBGl = apoBUnit === "mgdl" ? Math.round((apoBNum / 100) * 100) / 100 : apoBNum;
    }

    var reasons = [];
    if (tgVal !== null && tgVal >= 2.3) reasons.push("triglycerides ≥2.3 mmol/L (Friedewald-calculated LDL-C becomes unreliable)");
    if (diabetic) reasons.push("diabetes mellitus (applies to all DMTAC patients)");
    if (currentLdl !== null && currentLdl < 1.8 && info && (tier === "high" || tier === "veryhigh" || tier === "extreme")) {
      reasons.push("LDL-C already <1.8 mmol/L on treatment at a High/Very High risk tier, where residual ASCVD risk may persist");
    }

    var parts = [];
    if (reasons.length) {
      parts.push("Consider requesting Apo-B (2026 ACC/AHA Dyslipidemia Guideline) — reasonable here because: " + reasons.join("; ") + ".");
    } else {
      parts.push("Apo-B is not specifically flagged here (indications: TG ≥2.3 mmol/L, diabetes, or LDL-C already at goal with possible residual risk) — CPG Malaysia does not require it routinely, but it may still be checked at clinician discretion.");
    }
    if (info) parts.push("Apo-B target for " + info.label + " risk: " + info.apoBText + ".");
    if (apoBGl !== null) {
      parts.push("Entered Apo-B " + apoBGl.toFixed(2) + " g/L (" + Math.round(apoBGl * 100) + " mg/dL).");
      if (info && info.apoB !== null) {
        parts.push(apoBGl < info.apoB ? "At/below target." : "Above the " + info.apoBText.split(" ")[0] + " target for this risk tier — supports intensifying therapy even if LDL-C looks acceptable.");
      }
    }
    hintEl.textContent = parts.join(" ");
  }

  function computeFraminghamRisk() {
    var sex = document.getElementById("lipidSex").value;
    var age = parseFloat(document.getElementById("lipidAge").value);
    var tc = parseFloat(document.getElementById("lipidTC").value);
    var hdl = parseFloat(document.getElementById("lipidHDL").value);
    var sbp = parseFloat(document.getElementById("lipidSBP").value);
    var treated = document.getElementById("lipidBpTreated").checked;
    var smoker = document.getElementById("lipidSmoker").checked;
    var diabetic = document.getElementById("lipidDiabetes").checked;

    if (!sex || !age || !tc || !hdl || !sbp) return null;
    if (hdl >= tc) return { error: "HDL-C must be lower than Total Cholesterol - please check your entries." };

    var table = sex === "female" ? FRS_WOMEN : FRS_MEN;
    var points = lookupBand(table.age, age) + lookupBand(table.hdl, hdl) + lookupBand(table.tc, tc) +
      lookupBand(treated ? table.sbpTreated : table.sbpNotTreated, sbp) +
      (smoker ? table.smoker : 0) + (diabetic ? table.diabetic : 0);
    var risk = lookupBand(table.riskTable, points);

    return { points: points, risk: risk, sex: sex };
  }

  function collectLipidOverrides() {
    var groups = { veryhigh: [], high: [], intermediate: [], extreme: [] };
    document.querySelectorAll("#lipidOverrideGroup input[type=checkbox]:checked").forEach(function (cb) {
      var tier = cb.dataset.tier;
      if (groups[tier]) groups[tier].push(cb.value);
    });
    return groups;
  }

  function capitalizeWord(w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }

  function updateLipidAdvisor() {
    var pointsHintEl = document.getElementById("lipidPointsHint");
    var categoryEl = document.getElementById("lipidCategoryHint");
    var targetEl = document.getElementById("lipidTargetHint");
    var statinEl = document.getElementById("lipidStatinHint");
    var suitabilityEl = document.getElementById("lipidSuitabilityHint");
    if (!categoryEl) return;

    var apoBEl = document.getElementById("lipidApoBHint");

    var frs = computeFraminghamRisk();
    if (frs && frs.error) {
      pointsHintEl.textContent = frs.error;
      categoryEl.textContent = "--";
      targetEl.textContent = "";
      statinEl.textContent = "";
      suitabilityEl.textContent = "";
      if (apoBEl) apoBEl.textContent = "";
      return;
    }

    if (frs) {
      pointsHintEl.textContent = "Framingham points: " + frs.points + " → estimated 10-year CVD risk " + (frs.points >= (frs.sex === "female" ? 21 : 18) ? ">30" : frs.risk) + "%.";
    } else {
      pointsHintEl.textContent = "";
    }

    var overrides = collectLipidOverrides();
    var riskPercent = frs ? frs.risk : null;

    var tier = null;
    var reason = "";
    if (overrides.extreme.length) { tier = "extreme"; reason = overrides.extreme[0]; }
    else if (overrides.veryhigh.length) { tier = "veryhigh"; reason = overrides.veryhigh[0]; }
    else if (overrides.high.length || (riskPercent !== null && riskPercent > 20)) {
      tier = "high"; reason = overrides.high.length ? overrides.high[0] : "Framingham 10-year risk " + riskPercent + "% (>20%)";
    } else if (overrides.intermediate.length || (riskPercent !== null && riskPercent >= 10)) {
      tier = "intermediate"; reason = overrides.intermediate.length ? overrides.intermediate[0] : "Framingham 10-year risk " + riskPercent + "% (10-20%)";
    } else if (riskPercent !== null) {
      tier = "low"; reason = "Framingham 10-year risk " + riskPercent + "% (<10%)";
    }

    if (!tier) {
      categoryEl.textContent = "--";
      targetEl.textContent = "Enter the Framingham inputs above, or tick a clinical override, to compute the risk category.";
      statinEl.textContent = "";
      suitabilityEl.textContent = "";
      if (apoBEl) apoBEl.textContent = "";
      lastLipidAssessment = null;
      return;
    }

    var info = LIPID_TIER_INFO[tier];
    categoryEl.textContent = info.label + " risk (" + reason + ")";
    targetEl.textContent = "LDL-C target: " + info.ldlText + " · Non-HDL-C target: " + info.nonHdlText + " · Apo-B target: " + info.apoBText;

    var requiredIntensity = info.intensity;
    var requiredLabel = LIPID_INTENSITY_LABEL[requiredIntensity];
    var requiredDrugs = LIPID_INTENSITY_DRUGS[requiredIntensity];
    statinEl.textContent = "Required statin intensity: " + requiredLabel + " — " + requiredDrugs.join(" or ") + ".";

    var currentAgentKey = document.getElementById("lipidCurrentAgent").value;
    var currentLdlRaw = document.getElementById("lipidCurrentLdl").value;
    var currentLdl = currentLdlRaw === "" ? null : parseFloat(currentLdlRaw);
    var agent = LIPID_AGENT_MAP[currentAgentKey];

    var msgParts = [];
    if (currentAgentKey === "none") {
      msgParts.push("Not currently on any lipid-lowering agent. " + info.label + " risk requires " + requiredLabel + " statin therapy — consider starting " + requiredDrugs.join(" or ") + ".");
    } else if (agent.isNonStatin) {
      msgParts.push("Currently on " + agent.label + " only (non-statin). " + info.label + " risk requires " + requiredLabel + " statin therapy as the backbone — consider adding/initiating " + requiredDrugs.join(" or ") + ". Ezetimibe is appropriate as an add-on once already on a maximally tolerated statin with LDL-C still above target, not as a substitute for statin therapy.");
    } else if (agent.isFibrate) {
      msgParts.push("Currently on " + agent.label + " only (fibrate). Fibrates are for severe hypertriglyceridaemia, not primary LDL-lowering — " + info.label + " risk still requires " + requiredLabel + " statin therapy for ASCVD risk reduction — consider adding/initiating " + requiredDrugs.join(" or ") + ".");
    } else {
      var currentRank = LIPID_INTENSITY_RANK[agent.intensity];
      var requiredRank = LIPID_INTENSITY_RANK[requiredIntensity];
      if (currentRank >= requiredRank) {
        msgParts.push("Current therapy (" + agent.label + ", " + capitalizeWord(agent.intensity) + "-intensity) already meets the " + requiredLabel + " requirement for " + info.label + " risk. Continue and monitor LDL-C toward target.");
        if (currentLdl !== null && currentLdl > info.ldl) {
          msgParts.push("However, current LDL-C " + currentLdl + " mmol/L is still above target despite " + agent.intensity + "-intensity therapy — consider up-titrating dose within formulary limits or adding Ezetimibe 10mg.");
        }
      } else {
        msgParts.push("Current therapy (" + agent.label + ", " + capitalizeWord(agent.intensity) + "-intensity) is insufficient for " + info.label + " risk, which requires " + requiredLabel + " statin therapy — consider switching/up-titrating to " + requiredDrugs.join(" or ") + ".");
      }
    }
    if (currentAgentKey === "gemfibrozil300") {
      msgParts.push("Caution: Gemfibrozil + statin combination substantially increases myopathy/rhabdomyolysis risk (inhibited statin glucuronidation) — Fenofibrate is the safer fibrate to combine with a statin if fibrate therapy is needed.");
    }
    suitabilityEl.textContent = msgParts.join(" ");

    var diabeticChecked = document.getElementById("lipidDiabetes").checked;
    var tgValForApoB = parseFirstNumber(document.getElementById("tg") ? document.getElementById("tg").value : "");
    updateApoBHint(tier, diabeticChecked, tgValForApoB, currentLdl);

    lastLipidAssessment = {
      tier: tier,
      tierLabel: info.label,
      reason: reason,
      ldlText: info.ldlText,
      nonHdlText: info.nonHdlText,
      apoBText: info.apoBText,
      requiredLabel: requiredLabel,
      suitabilityMsg: msgParts.join(" "),
      apoBMsg: apoBEl ? apoBEl.textContent : ""
    };
    autoFillLipidSummary();
  }

  var lastLipidAssessment = null;
  var lipidSummaryAutoText = "";

  function autoFillLipidSummary() {
    var summaryBox = document.getElementById("lipidSummary");
    if (!summaryBox || !lastLipidAssessment) return;
    var text = "Framingham/CPG Dyslipidaemia risk: " + lastLipidAssessment.tierLabel + " (" + lastLipidAssessment.reason + "). LDL-C target " + lastLipidAssessment.ldlText + ", Non-HDL-C target " + lastLipidAssessment.nonHdlText + ", Apo-B target " + lastLipidAssessment.apoBText + ". " + lastLipidAssessment.suitabilityMsg + " " + lastLipidAssessment.apoBMsg;

    // Only overwrite if the field is empty or still holds our previous auto-text,
    // same convention as the MyMAAT / Fasting Assessment summary fields.
    if (summaryBox.value === "" || summaryBox.value === lipidSummaryAutoText) {
      summaryBox.value = text;
      lipidSummaryAutoText = text;
    }
  }

  function initLipidAdvisor() {
    ["lipidAge", "lipidTC", "lipidHDL", "lipidSBP", "lipidCurrentLdl", "lipidApoB"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updateLipidAdvisor);
    });
    ["lipidTC", "lipidHDL"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updateTgHint);
    });
    ["lipidSex", "lipidBpTreated", "lipidSmoker", "lipidDiabetes", "lipidCurrentAgent", "lipidApoBUnit"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", updateLipidAdvisor);
    });
    document.querySelectorAll("#lipidOverrideGroup input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", updateLipidAdvisor);
    });
    document.getElementById("tg").addEventListener("input", updateLipidAdvisor);
    document.getElementById("lipidResetBtn").addEventListener("click", resetLipidAdvisor);
  }

  function resetLipidAdvisor() {
    ["lipidSex", "lipidCurrentAgent", "lipidApoBUnit"].forEach(function (id) { document.getElementById(id).selectedIndex = 0; });
    ["lipidAge", "lipidTC", "lipidHDL", "lipidSBP", "lipidCurrentLdl", "lipidApoB"].forEach(function (id) { document.getElementById(id).value = ""; });
    ["lipidBpTreated", "lipidSmoker", "lipidDiabetes"].forEach(function (id) { document.getElementById(id).checked = false; });
    document.querySelectorAll("#lipidOverrideGroup input[type=checkbox]").forEach(function (cb) { cb.checked = false; });
    document.getElementById("lipidSummary").value = "";
    lastLipidAssessment = null;
    lipidSummaryAutoText = "";
    updateLipidAdvisor();
  }

  function getLipidNoteText() {
    return document.getElementById("lipidSummary").value.trim();
  }

  // ---------------------------------------------------------------------
  // Triglycerides (TG) target/classification hint. Thresholds and guidance
  // from CPG Management of Dyslipidaemia 6th Ed. 2023, Section 11.1 &
  // 11.1.1 (target <1.7 mmol/L; non-HDL-C becomes the secondary target at
  // TG >2.3 and the PRIMARY target at TG >4.5, since Friedewald-calculated
  // LDL-C is unreliable above that; severe hypertriglyceridaemia >10, with
  // combination therapy considered from >5.6 and fibrate/nicotinic acid for
  // pancreatitis prevention emphasised >11.3), cross-checked against the
  // 2026 ACC/AHA/.../PCNA Guideline on the Management of Dyslipidemia
  // (which uses materially the same 1.7/5.7/11.3 mmol/L breakpoints).
  // When flagged, non-HDL-C is calculated from the Total Cholesterol / HDL-C
  // fields already collected in the Lipid-Lowering Therapy Advisor above
  // (Non-HDL-C = TC - HDL-C) if both have been entered there.
  // ---------------------------------------------------------------------

  function updateTgHint() {
    var hintEl = document.getElementById("tgHint");
    if (!hintEl) return;
    var tgField = document.getElementById("tg");
    var tg = parseFirstNumber(tgField.value);

    if (tg === null) {
      hintEl.textContent = "";
      return;
    }

    var parts = [];
    if (tg < 1.7) {
      parts.push("At target (<1.7 mmol/L).");
    } else if (tg < 10) {
      parts.push("Above target — mild-to-moderate hypertriglyceridaemia (CPG Dyslipidaemia 2023, Section 11.1A). LDL-C remains the primary target; start with 4-12 weeks of lifestyle measures (weight loss, low-glycaemic/low-fructose diet, exercise, reduced alcohol, smoking cessation), then consider statin intensification if LDL-C is not at goal, adding a fibrate only if TG remains high despite optimal statin therapy.");
    } else {
      parts.push("Severe hypertriglyceridaemia (CPG Dyslipidaemia 2023, Section 11.1B) — pancreatitis risk. Statins remain the drug of choice; consider combination therapy (fibrate ± high-dose omega-3) especially once TG >5.6 mmol/L. Repeat a fasting TG after 5 days (within 2 weeks); seek specialist advice if it remains >10 mmol/L. Advise a very-low-fat/very-low-carbohydrate diet and alcohol avoidance.");
    }

    if (tg >= 11.3) {
      parts.push("Markedly elevated (≥11.3 mmol/L) — a fibrate or nicotinic acid is specifically indicated for pancreatitis prevention at this level.");
    }

    if (tg >= 4.5) {
      parts.push("Non-HDL-C becomes the PRIMARY target of therapy at this TG level (the Friedewald equation used to calculate LDL-C is unreliable above 4.5 mmol/L) — repeat a fasting lipid panel and exclude secondary causes (e.g. alcohol, poorly controlled diabetes, hypothyroidism).");
    } else if (tg >= 2.3) {
      parts.push("Non-HDL-C becomes the SECONDARY target of therapy at this TG level (more representative of atherogenic lipoproteins than LDL-C here). If LDL-C is already at goal but TG remains >2.3 mmol/L with a low HDL-C, a fibrate may be considered as add-on therapy.");
    }

    if (tg >= 2.3) {
      var tcVal = parseFloat(document.getElementById("lipidTC").value);
      var hdlVal = parseFloat(document.getElementById("lipidHDL").value);
      if (!isNaN(tcVal) && !isNaN(hdlVal)) {
        var nonHdl = Math.round((tcVal - hdlVal) * 100) / 100;
        parts.push("Calculated Non-HDL-C = " + tcVal + " − " + hdlVal + " = " + nonHdl + " mmol/L (from the Total Cholesterol/HDL-C entered in the Lipid-Lowering Therapy Advisor below).");
      } else {
        parts.push("Enter Total Cholesterol and HDL-C in the Lipid-Lowering Therapy Advisor below to calculate Non-HDL-C (= TC − HDL-C).");
      }
    }

    hintEl.textContent = parts.join(" ");
  }

  // ---------------------------------------------------------------------
  // Fasting Eligibility Assessment (IDF-DAR Risk Calculator, 2026 Update)
  // Source: Afandi B, Suliman M, Shaikh S, Beshyah SA, Hasannien M. "The
  // 2026 Update of the IDF-DAR Risk Calculator for Fasting in People with
  // Diabetes." J Diabetes Endocrine Practice 2025 (IDF-DAR). Fig. 1 (item
  // scoring) and Fig. 2 (risk-band cutoffs) are reproduced as the select
  // options / checkboxes / risk bands below.
  // ---------------------------------------------------------------------

  var FASTING_SELECT_IDS = [
    "fastingPregnancy", "fastingDmType", "fastingDuration", "fastingHypoglycemia",
    "fastingA1c", "fastingGlucoseMonitoring", "fastingHyperglycemicEmergency",
    "fastingMacrovascular", "fastingNephropathy", "fastingMicrovascular",
    "fastingFrailty", "fastingLabor", "fastingEducation", "fastingHours"
  ];

  var fastingSummaryAutoText = "";

  function computeFastingScore() {
    var total = 0;
    FASTING_SELECT_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      total += parseFloat(el.value) || 0;
    });
    var checkedBoxes = document.querySelectorAll("#fastingTreatmentGroup input[type=checkbox]:checked");
    Array.prototype.forEach.call(checkedBoxes, function (cb) {
      total += parseFloat(cb.dataset.score) || 0;
    });
    // Round to avoid floating-point artefacts (e.g. 3.1500000000000004)
    total = Math.round(total * 100) / 100;

    var category, recommendation;
    if (total <= 3) {
      category = "Low risk";
      recommendation = "Fasting is generally safe with medical evaluation, possible medication adjustment, and close self-monitoring.";
    } else if (total <= 6) {
      category = "Moderate risk";
      recommendation = "Safety of fasting is uncertain - strict glucose monitoring and careful medication adjustment are required if the patient proceeds to fast.";
    } else {
      category = "High risk";
      recommendation = "Fasting is considered unsafe at this score - advise against fasting due to risk of serious complications; discuss further with the patient and, where relevant, religious guidance.";
    }

    var totalEl = document.getElementById("fastingTotalScore");
    var catEl = document.getElementById("fastingRiskCategory");
    var recEl = document.getElementById("fastingRecommendation");
    if (totalEl) totalEl.textContent = total;
    if (catEl) catEl.textContent = category;
    if (recEl) recEl.textContent = recommendation;

    autoFillFastingSummary(total, category);
  }

  function autoFillFastingSummary(total, category) {
    var summaryBox = document.getElementById("fastingAssessmentSummary");
    if (!summaryBox) return;
    var text = "IDF-DAR fasting risk score " + total + " (" + category + ").";

    // Only overwrite if the field is empty or still holds our previous auto-text,
    // same convention as the MyMAAT summary field (never clobber manual edits).
    if (summaryBox.value === "" || summaryBox.value === fastingSummaryAutoText) {
      summaryBox.value = text;
      fastingSummaryAutoText = text;
    }
  }

  function initFastingAssessment() {
    FASTING_SELECT_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", computeFastingScore);
    });
    document.querySelectorAll("#fastingTreatmentGroup input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", computeFastingScore);
    });
    var resetBtn = document.getElementById("fastingResetBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetFastingAssessment);
  }

  function resetFastingAssessment() {
    FASTING_SELECT_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.selectedIndex = 0;
    });
    document.querySelectorAll("#fastingTreatmentGroup input[type=checkbox]").forEach(function (cb) {
      cb.checked = false;
    });
    document.getElementById("fastingTotalScore").textContent = "--";
    document.getElementById("fastingRiskCategory").textContent = "--";
    document.getElementById("fastingRecommendation").textContent = "";
    document.getElementById("fastingAssessmentSummary").value = "";
    fastingSummaryAutoText = "";
  }

  // ---------------------------------------------------------------------
  // Phrase bank buttons (append, never overwrite)
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // Split free text into discrete numbered items for the CCMS note.
  //
  // Pharmacists build these fields by tapping phrase chips, so the text
  // arrives as a run of sentences. We split on explicit line breaks first
  // (an intentional separation), then on sentence boundaries. The
  // sentence split requires the next character to be an uppercase letter
  // or a digit-with-following-letter, so decimals ("LDL-C 1.8 mmol/L"),
  // "e.g." and unit abbreviations are not treated as item boundaries.
  // A single item is emitted unnumbered - "1." on its own reads oddly.
  // ---------------------------------------------------------------------
  function splitIntoItems(text) {
    if (!text) return [];
    var raw = String(text).trim();
    if (!raw) return [];
    var chunks = raw.split(/\r?\n+/);
    var out = [];
    chunks.forEach(function (chunk) {
      chunk = chunk.trim();
      if (!chunk) return;
      // Strip any numbering the pharmacist typed themselves.
      chunk = chunk.replace(/^\s*\d+[.)]\s*/, "");
      var parts = chunk.split(/(?<=[.!?])\s+(?=[A-Z])/);
      parts.forEach(function (p) {
        p = p.trim().replace(/^\s*\d+[.)]\s*/, "");
        if (p) out.push(p);
      });
    });
    return out;
  }

  function pushNumberedBlock(lines, heading, text) {
    var items = splitIntoItems(text);
    if (!items.length) return;
    lines.push(heading);
    if (items.length === 1) {
      lines.push(items[0]);
    } else {
      items.forEach(function (item, i) {
        lines.push((i + 1) + ". " + item);
      });
    }
    lines.push("");
  }

  // Setting .value from script does NOT fire an input event, so any field
  // with dependent logic (BMI -> obesity class/FIB-4/weight-loss target,
  // Social History -> smoker referral, SrCreat -> eGFR, TG -> non-HDL...)
  // would go stale when filled by a phrase chip rather than by typing.
  // Every programmatic write goes through here so listeners always run.
  function setFieldValue(field, value) {
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function appendToField(fieldId, phrase, sep) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    var current = field.value.trim();
    var separator = sep || " ";
    setFieldValue(field, current ? current + separator + phrase : phrase);
  }

  // Dose-picker groups (e.g. "T. Metformin" + a strength/frequency <select> +
  // an Add button) - composes "<prefix> <selected dose/frequency>" and
  // appends it to the group's target field, same append-never-overwrite
  // behaviour as the plain phrase banks. A button with a fixed-text dataset
  // (no accompanying select, e.g. a single-strength formulary item) appends
  // that fixed text directly instead.
  function initDosePickers() {
    document.querySelectorAll(".dose-picker-group").forEach(function (group) {
      var targetId = group.dataset.target;
      var sep = group.dataset.sep || " ";
      group.querySelectorAll(".dose-add-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var text;
          if (btn.dataset.fixedText) {
            text = btn.dataset.fixedText;
          } else {
            var row = btn.closest(".dose-picker-row");
            var select = row ? row.querySelector(".dose-select") : null;
            if (!select) return;
            text = (btn.dataset.prefix + " " + select.value).trim();
          }
          appendToField(targetId, text, sep);
        });
      });
    });
  }

  // A phrase bank normally APPENDS (so you can build up a sentence from
  // several taps). Banks marked data-mode="replace" instead overwrite the
  // field - used for single-valued fields where appending makes no sense
  // (e.g. "T2DM duration", "Follow-up in", where you pick exactly one).
  function initPhraseBanks() {
    initPhraseBanksIn(document);
  }

  // Scoped variant so dynamically added cards can be wired without
  // re-binding (and thus double-firing) the banks already on the page.
  function initPhraseBanksIn(root) {
    root.querySelectorAll(".phrase-bank").forEach(function (bank) {
      if (bank.dataset.bound === "1") return;
      bank.dataset.bound = "1";
      var targetId = bank.dataset.target;
      var sep = bank.dataset.sep || " ";
      var replaceMode = bank.dataset.mode === "replace";
      bank.querySelectorAll(".phrase-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          // A chip carrying a PHIS classification (the ⚖ Issues chips) also
          // spawns a pre-filled Pharmaceutical Care Issue card, so the
          // pharmacist never types the same issue twice.
          var pciType = btn.dataset.pciType;
          var plain = btn.textContent.replace(/^\s*⚖\s*/, "").trim();
          if (replaceMode) {
            setFieldValue(document.getElementById(targetId), plain);
          } else {
            appendToField(targetId, plain, sep);
          }
          if (pciType && typeof addPciCard === "function") {
            addPciCard({ type: pciType, desc: btn.dataset.pciDesc, detail: plain });
          }
        });
      });
    });
  }

  // ---------------------------------------------------------------------
  // Dictation (Web Speech API), section-by-section, no continuous recording
  // ---------------------------------------------------------------------

  var SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
  var activeRecognition = null;
  var activeButton = null;

  function dictationSupported() {
    return !!SpeechRecognitionImpl;
  }

  // Wire mic buttons inside a dynamically added container.
  function initDictationIn(root) {
    if (!dictationSupported()) {
      root.querySelectorAll(".mic-btn").forEach(function (btn) {
        btn.disabled = true;
        btn.title = "Voice dictation not supported in this browser";
      });
      return;
    }
    root.querySelectorAll(".mic-btn").forEach(function (btn) {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", function () {
        toggleDictation(btn, btn.dataset.target);
      });
    });
  }

  function initDictation() {
    var note = document.getElementById("dictationSupportNote");
    if (!dictationSupported()) {
      note.textContent = "Voice dictation is not supported in this browser. Please use typing or built-in keyboard dictation.";
      document.querySelectorAll(".mic-btn").forEach(function (btn) {
        btn.disabled = true;
        btn.title = "Voice dictation not supported in this browser";
      });
      return;
    }
    note.textContent = "Click the microphone next to a field, dictate your summary, then click again to stop.";

    document.querySelectorAll(".mic-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.dataset.target;
        toggleDictation(btn, targetId);
      });
    });
  }

  function toggleDictation(btn, targetId) {
    if (activeRecognition && activeButton === btn) {
      activeRecognition.stop();
      return;
    }
    if (activeRecognition) {
      activeRecognition.stop();
    }

    var field = document.getElementById(targetId);
    var lang = document.getElementById("dictationLang").value;
    var recognition = new SpeechRecognitionImpl();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;

    var baseText = field.value;
    var appendedText = "";

    recognition.onresult = function (event) {
      var transcript = "";
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) {
        appendedText = (appendedText ? appendedText + " " : "") + transcript.trim();
        var joiner = baseText.trim() ? " " : "";
        field.value = baseText.trim() + joiner + appendedText;
      }
    };

    recognition.onerror = function () {
      stopDictationUI(btn);
    };

    recognition.onend = function () {
      stopDictationUI(btn);
    };

    activeRecognition = recognition;
    activeButton = btn;
    btn.classList.add("recording");
    btn.textContent = "⏹"; // stop symbol
    recognition.start();
  }

  function stopDictationUI(btn) {
    btn.classList.remove("recording");
    btn.textContent = "🎤"; // microphone symbol
    if (activeButton === btn) {
      activeRecognition = null;
      activeButton = null;
    }
  }

  // ---------------------------------------------------------------------
  // Field helpers
  // ---------------------------------------------------------------------

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function joinNonEmpty(parts, sep) {
    var kept = parts.filter(function (p) { return p && p.trim(); });
    // When the separator already supplies the full stop (". "), strip a
    // trailing one from each part so phrase-bank sentences that end in "."
    // do not produce ".." in the generated note, then close the joined
    // sentence with a single full stop.
    if (sep && sep.indexOf(".") === 0) {
      kept = kept.map(function (p) { return String(p).trim().replace(/\.+$/, ""); });
      var joined = kept.join(sep);
      return joined ? joined + "." : "";
    }
    return kept.join(sep);
  }

  // ---------------------------------------------------------------------
  // Full DMTAC note (PHIS)
  // Structured to follow the live PHIS MTAC Reporting screen: ASSESSMENT,
  // SPECIFIC DETAILS (Assessment Form For Diabetes Mellitus), REPORTING,
  // then PHARMACEUTICAL CARE ISSUE - each section only appears if it has
  // content. Flipchart entry, the Audit-Required Checklist, and the PCI
  // block are PHIS-only and never appear in the CCMS note.
  // ---------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // PHIS "Pharmacist Notes" / "Pharmacist Plan" formatting.
  //
  // Notes: each pharmacist assessment item is numbered, with the matching
  // intervention/counselling item indented beneath it as a "-" bullet:
  //
  //   1. Glycaemic control above individualised target.
  //      - Reinforced medication adherence.
  //   2. Adherence is the main barrier to control.
  //      - Provided written medication schedule.
  //
  // Assessment and intervention are separate free-text fields, so they are
  // paired BY POSITION: the 1st intervention sits under the 1st assessment,
  // and so on. Any interventions beyond the number of assessments are added
  // as further bullets under the last one, so nothing is ever dropped.
  // Tap the chips in matching order and the pairing comes out right.
  //
  // Plan: care plan items are numbered, with referral/dietetic/quit-smoking
  // lines folded in, then the follow-up interval and review items appended
  // as "-" bullets (which is why the PHIS note no longer carries a separate
  // trailing "Follow-up:" block - it lives inside Pharmacist Plan).
  // ---------------------------------------------------------------------

  function buildPharmacistNotesBlock() {
    var issues = splitIntoItems(val("assessment"));
    var actions = splitIntoItems(val("interventionCounselling"));
    if (!issues.length && !actions.length) return "";

    // No assessment recorded - emit the interventions as plain bullets.
    if (!issues.length) {
      return actions.map(function (a) { return "- " + a; }).join("\n");
    }

    var out = [];
    issues.forEach(function (issue, i) {
      out.push((i + 1) + ". " + issue);
      var mine = [];
      if (i < issues.length - 1) {
        if (actions[i]) mine.push(actions[i]);
      } else {
        // last issue soaks up any remaining interventions
        for (var k = i; k < actions.length; k++) mine.push(actions[k]);
      }
      mine.forEach(function (a) { out.push("   - " + a); });
    });
    return out.join("\n");
  }

  function buildPharmacistPlanBlock() {
    var planText = joinNonEmpty([
      val("carePlan"),
      val("referralDiscussion"),
      getDieteticReferralText(),
      getQuitSmokingNoteText()
    ], " ");
    var planItems = splitIntoItems(planText);
    var out = [];
    planItems.forEach(function (p, i) { out.push((i + 1) + ". " + p); });
    if (val("followUpDate")) out.push("   - Next review: " + val("followUpDate"));
    if (getTcaNoteText()) out.push("   - " + getTcaNoteText());
    if (val("followUpItems")) out.push("   - To review: " + val("followUpItems"));
    return out.join("\n");
  }

  // ---------------------------------------------------------------------
  // Next DMTAC visit (TCA) date + Penang public-holiday check.
  //
  // The app is offline-first, so the holiday table is baked in rather than
  // fetched. Dates are the Penang state list (national holidays observed in
  // Penang, plus the two Penang-only ones: George Town World Heritage City
  // Day on 7 July and the Penang Governor's Birthday on the 2nd Saturday of
  // July).
  //
  // Source: publicholidays.com.my/penang (2026 list carries the
  // penang.gov.my gazette release; 2027 and 2028 are that site's ESTIMATES,
  // pending the official announcement).
  //
  // IMPORTANT: Islamic-calendar holidays (Hari Raya Aidilfitri, Hari Raya
  // Haji, Awal Muharram, Maulidur Rasul, Nuzul Al-Quran) and the lunar ones
  // (Chinese New Year, Wesak, Deepavali, Thaipusam) are subject to official
  // gazette and, for some, moon sighting. Anything from 2027 onward is
  // therefore flagged in the UI as not yet gazetted, so a TCA is never
  // booked against an unconfirmed date without the pharmacist knowing.
  // ---------------------------------------------------------------------

  var PENANG_HOLIDAYS = {
    // 2026 - gazetted (penang.gov.my)
    "2026-01-01": "New Year's Day",
    "2026-02-01": "Thaipusam",
    "2026-02-02": "Thaipusam Holiday",
    "2026-02-17": "Chinese New Year",
    "2026-02-18": "Chinese New Year Holiday",
    "2026-03-07": "Nuzul Al-Quran",
    "2026-03-20": "Hari Raya Aidilfitri Holiday",
    "2026-03-21": "Hari Raya Aidilfitri",
    "2026-03-22": "Hari Raya Aidilfitri Holiday",
    "2026-03-23": "Hari Raya Aidilfitri Holiday",
    "2026-05-01": "Labour Day",
    "2026-05-27": "Hari Raya Haji",
    "2026-05-31": "Wesak Day",
    "2026-06-01": "Agong's Birthday",
    "2026-06-02": "Wesak Day Holiday",
    "2026-06-17": "Awal Muharram",
    "2026-07-07": "George Town World Heritage City Day (Penang)",
    "2026-07-11": "Penang Governor's Birthday (Penang)",
    "2026-08-25": "Prophet Muhammad's Birthday",
    "2026-08-31": "Merdeka Day",
    "2026-09-16": "Malaysia Day",
    "2026-11-08": "Deepavali",
    "2026-11-09": "Deepavali Holiday",
    "2026-12-25": "Christmas Day",

    // 2027 - ESTIMATED, not yet gazetted
    "2027-01-01": "New Year's Day",
    "2027-01-22": "Thaipusam",
    "2027-02-06": "Chinese New Year",
    "2027-02-07": "Chinese New Year Holiday",
    "2027-02-08": "Chinese New Year Holiday",
    "2027-02-24": "Nuzul Al-Quran",
    "2027-03-10": "Hari Raya Aidilfitri",
    "2027-03-11": "Hari Raya Aidilfitri Holiday",
    "2027-05-01": "Labour Day",
    "2027-05-17": "Hari Raya Haji",
    "2027-05-20": "Wesak Day",
    "2027-06-06": "Awal Muharram",
    "2027-06-07": "Agong's Birthday / Awal Muharram Holiday",
    "2027-07-07": "George Town World Heritage City Day (Penang)",
    "2027-07-10": "Penang Governor's Birthday (Penang)",
    "2027-08-15": "Prophet Muhammad's Birthday",
    "2027-08-16": "Prophet Muhammad's Birthday Holiday",
    "2027-08-31": "Merdeka Day",
    "2027-09-16": "Malaysia Day",
    "2027-10-28": "Deepavali",
    "2027-12-25": "Christmas Day",

    // 2028 - ESTIMATED, not yet gazetted
    "2028-01-01": "New Year's Day",
    "2028-01-26": "Chinese New Year",
    "2028-01-27": "Chinese New Year Holiday",
    "2028-02-13": "Thaipusam / Nuzul Al-Quran",
    "2028-02-14": "Thaipusam / Nuzul Al-Quran Holiday",
    "2028-02-27": "Hari Raya Aidilfitri",
    "2028-02-28": "Hari Raya Aidilfitri Holiday",
    "2028-02-29": "Hari Raya Aidilfitri Holiday",
    "2028-05-01": "Labour Day",
    "2028-05-05": "Hari Raya Haji",
    "2028-05-09": "Wesak Day",
    "2028-05-25": "Awal Muharram",
    "2028-06-05": "Agong's Birthday",
    "2028-07-07": "George Town World Heritage City Day (Penang)",
    "2028-07-08": "Penang Governor's Birthday (Penang)",
    "2028-08-03": "Prophet Muhammad's Birthday",
    "2028-08-31": "Merdeka Day",
    "2028-09-16": "Malaysia Day",
    "2028-10-17": "Deepavali",
    "2028-12-25": "Christmas Day",

    // 2029 - ESTIMATED, not yet gazetted (calendarmalaysia.com; Islamic
    // dates explicitly tentative pending JAKIM announcement)
    "2029-01-01": "New Year's Day",
    "2029-01-30": "Thaipusam",
    "2029-02-01": "Nuzul Al-Quran",
    "2029-02-13": "Chinese New Year",
    "2029-02-14": "Chinese New Year Holiday",
    "2029-02-15": "Hari Raya Aidilfitri",
    "2029-02-16": "Hari Raya Aidilfitri Day 2",
    "2029-04-24": "Hari Raya Haji",
    "2029-05-01": "Labour Day",
    "2029-05-15": "Awal Muharram",
    "2029-05-28": "Wesak Day",
    "2029-06-04": "Agong's Birthday",
    "2029-07-07": "George Town World Heritage City Day (Penang)",
    "2029-07-14": "Penang Governor's Birthday (Penang)",
    "2029-07-24": "Prophet Muhammad's Birthday",
    "2029-08-31": "Merdeka Day",
    "2029-09-16": "Malaysia Day",
    "2029-11-05": "Deepavali",
    "2029-12-25": "Christmas Day"
  };

  // Holidays that fall on the same calendar date every year. These are
  // certain for ANY year, so they are computed rather than tabulated - it
  // means a TCA booked past the end of the variable-holiday table still
  // gets caught if it lands on, say, Merdeka Day or Christmas.
  var FIXED_DATE_HOLIDAYS = {
    "01-01": "New Year's Day",
    "05-01": "Labour Day",
    "07-07": "George Town World Heritage City Day (Penang)",
    "08-31": "Merdeka Day",
    "09-16": "Malaysia Day",
    "12-25": "Christmas Day"
  };

  // Penang Governor's Birthday is the 2nd Saturday of July - also rule-based.
  function penangGovernorBirthday(year) {
    var d = new Date(year, 6, 1);
    var firstSat = 1 + ((6 - d.getDay()) + 7) % 7;
    return firstSat + 7;
  }

  function lookupHoliday(iso) {
    if (PENANG_HOLIDAYS[iso]) return { name: PENANG_HOLIDAYS[iso], fixed: false };
    var parts = iso.split("-");
    var md = parts[1] + "-" + parts[2];
    if (FIXED_DATE_HOLIDAYS[md]) return { name: FIXED_DATE_HOLIDAYS[md], fixed: true };
    if (parts[1] === "07" && Number(parts[2]) === penangGovernorBirthday(Number(parts[0]))) {
      return { name: "Penang Governor's Birthday (Penang)", fixed: true };
    }
    return null;
  }

  var HOLIDAY_GAZETTED_YEARS = ["2026"];
  var HOLIDAY_DATA_LAST_YEAR = 2029;
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function formatTcaDate(iso) {
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return p[2] + " " + months[d.getMonth()] + " " + p[0] + " (" + DAY_NAMES[d.getDay()] + ")";
  }

  function updateTcaHint() {
    var el = document.getElementById("nextTcaHint");
    var input = document.getElementById("nextTcaDate");
    if (!el || !input) return;
    var iso = input.value;
    if (!iso) {
      el.style.display = "none";
      el.textContent = "";
      el.className = "hint";
      return;
    }

    var parts = iso.split("-");
    var year = parts[0];
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var dow = d.getDay();
    var msgs = [];
    var level = "ok";

    var hit = lookupHoliday(iso);
    if (hit) {
      msgs.push("PUBLIC HOLIDAY in Penang — " + hit.name + ". Clinic will be closed; choose another date.");
      level = "high";
    }
    if (dow === 0) {
      msgs.push("This is a Sunday.");
      if (level !== "high") level = "high";
    } else if (dow === 6) {
      msgs.push("This is a Saturday — check whether your DMTAC session runs that day.");
      if (level !== "high") level = "watch";
    }

    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) {
      msgs.push("This date is in the past.");
      level = "high";
    }

    if (Number(year) > HOLIDAY_DATA_LAST_YEAR) {
      msgs.push("Beyond " + HOLIDAY_DATA_LAST_YEAR + " only the fixed-date holidays (New Year, Labour Day, 7 July, Merdeka, Malaysia Day, Christmas, Governor's Birthday) are checked — the moving Islamic/lunar holidays are NOT, so verify against the gazetted calendar.");
      if (level === "ok") level = "watch";
    } else if (HOLIDAY_GAZETTED_YEARS.indexOf(year) === -1) {
      msgs.push("Note: " + year + " holiday dates are estimates pending official gazette — Islamic and lunar holidays in particular may shift. Confirm against the gazetted calendar before committing the appointment.");
      if (level === "ok") level = "watch";
    }

    if (!msgs.length) msgs.push("No Penang public holiday on this date, and it is a weekday.");

    el.style.display = "";
    el.textContent = formatTcaDate(iso) + " — " + msgs.join(" ");
    el.className = level === "high" ? "ckd-flag-box" : (level === "watch" ? "hint tdd-watch" : "hint tdd-ok");
  }

  function getTcaNoteText() {
    var input = document.getElementById("nextTcaDate");
    if (!input || !input.value) return "";
    var hit = lookupHoliday(input.value);
    return "Next DMTAC visit (TCA): " + formatTcaDate(input.value) +
      (hit ? " [WARNING: public holiday — " + hit.name + "]" : "");
  }

  function initTca() {
    var input = document.getElementById("nextTcaDate");
    if (input) input.addEventListener("change", updateTcaHint);
    updateTcaHint();
  }

  function resetTca() {
    var input = document.getElementById("nextTcaDate");
    if (input) input.value = "";
    updateTcaHint();
  }

  // ---------------------------------------------------------------------
  // Pharmacotherapy Review items 1-10.
  //
  // The ten headings are ALWAYS emitted, in order, in both notes - an item
  // left blank shows "-" rather than being dropped. Previously an unfilled
  // item was omitted entirely, which produced gaps (1, 3, 4, 7...) and made
  // the note look as though a step had been forgotten rather than simply
  // not applying to this patient. "-" is used rather than "Nil", because
  // "Nil" would assert a negative finding that was never actually assessed.
  // ---------------------------------------------------------------------
  var PHARMACOTHERAPY_ITEM_LABELS = [
    "1. Medication adherence:",
    "2. Medication understanding:",
    "3. SMBG review:",
    "4. Insulin dose adjustment:",
    "5. Hypoglycaemia assessment:",
    "6. Insulin injection technique:",
    "7. Lipohypertrophy assessment:",
    "8. Lifestyle / diet:",
    "9. Carbohydrate counting:",
    "10. DMTAC patient education:"
  ];
  var PHARMACOTHERAPY_BLANK = "-";

  function pushPharmacotherapyItems(target, values) {
    // If nothing at all was reviewed (e.g. a counselled-but-not-recruited
    // visit), emit nothing rather than ten empty dashes.
    var anyFilled = values.some(function (v) { return v && String(v).trim(); });
    if (!anyFilled) return;
    PHARMACOTHERAPY_ITEM_LABELS.forEach(function (label, i) {
      var v = (values[i] || "").trim();
      target.push([label, v || PHARMACOTHERAPY_BLANK]);
    });
  }

  function pushBlock(lines, heading, blocks) {
    if (!blocks.length) return;
    lines.push(heading);
    blocks.forEach(function (block) {
      if (block[0]) lines.push(block[0]);
      lines.push(block[1]);
      lines.push("");
    });
  }

  function buildFullNote() {
    var lines = [];

    lines.push("DMTAC VISIT " + (val("visitNumber") || "__"));
    lines.push("");

    if (val("reasonForRecruitment")) {
      lines.push("Reason for recruitment into DMTAC:");
      lines.push(val("reasonForRecruitment"));
      lines.push("");
    }

    // ---------------- ASSESSMENT ----------------
    var assessmentBlocks = [];
    var demogLine = joinNonEmpty([val("ageSex"), val("t2dmDuration") ? "T2DM x " + val("t2dmDuration") : ""], ", ");
    if (demogLine) assessmentBlocks.push(["Demographic:", demogLine]);
    if (val("socialHistory")) assessmentBlocks.push(["Social History:", val("socialHistory")]);
    if (val("familyHistory")) assessmentBlocks.push(["Family History:", val("familyHistory")]);
    if (val("allergy")) assessmentBlocks.push(["Drug Allergy:", val("allergy")]);
    if (val("comorbidities")) assessmentBlocks.push(["Comorbidity / PMH:", val("comorbidities")]);
    // Presenting concerns were previously CCMS-only, which left the PHIS
    // note without the patient's own reported issues - ADAF F2.1 expects
    // patient information to be complete, so they belong in both.
    var phisConcerns = joinNonEmpty([
      val("mainIssue"),
      val("patientConcern"),
      val("adherenceSummary"),
      val("hypoSymptoms"),
      val("lifestyleIssue"),
      val("exerciseActivity")
    ], ". ");
    if (phisConcerns) assessmentBlocks.push(["Presenting Concerns:", phisConcerns]);
    var pastOtherMed = joinNonEmpty([
      val("currentDMMeds"),
      val("otherMeds"),
      getPomNoteText(),
      val("medChanges") ? "Changes: " + val("medChanges") : "",
      val("sideEffects") ? "Side effects: " + val("sideEffects") : ""
    ], ". ");
    if (pastOtherMed) assessmentBlocks.push(["Past / Other Medication:", pastOtherMed]);
    pushBlock(lines, "ASSESSMENT", assessmentBlocks);

    // ---------------- SPECIFIC DETAILS: Assessment Form For Diabetes Mellitus ----------------
    var specificBlocks = [];

    var objParts = [];
    if (val("hba1c")) objParts.push("HbA1c " + val("hba1c"));
    if (val("smbgPattern")) objParts.push("SMBG/FBS/RBS " + val("smbgPattern"));
    if (val("bp")) objParts.push("BP " + val("bp"));
    if (val("ldl")) objParts.push("LDL-C " + val("ldl"));
    if (val("tg")) objParts.push("TG " + val("tg"));
    if (getSrCreatNoteText()) objParts.push(getSrCreatNoteText());
    if (val("egfr")) objParts.push("eGFR " + val("egfr"));
    if (val("uacr")) objParts.push("UACR " + val("uacr"));
    if (val("weightBmi")) objParts.push("Wt/BMI " + val("weightBmi"));
    if (val("waistCircumference")) objParts.push("WC " + val("waistCircumference"));
    if (getWeightLossNoteText()) objParts.push(getWeightLossNoteText());
    if (val("lft")) objParts.push("LFT " + val("lft"));
    if (val("ufeme")) objParts.push("UFEME " + val("ufeme"));
    if (objParts.length) specificBlocks.push(["Clinical parameters:", objParts.join(", ")]);

    if (val("therapeuticTargets")) specificBlocks.push(["Therapeutic targets:", val("therapeuticTargets")]);
    if (getLipidNoteText()) specificBlocks.push(["Lipid-lowering therapy assessment (Framingham + CPG Dyslipidaemia 2023):", getLipidNoteText()]);
    if (getCkmNoteText()) specificBlocks.push(["CKM syndrome stage:", getCkmNoteText()]);
    if (getCkdPillarsNoteText()) specificBlocks.push(["CKD 4 Pillars of Protection assessment (KDIGO):", getCkdPillarsNoteText()]);
    if (getFib4NoteText()) specificBlocks.push(["MASLD screening (FIB-4, CPG T2DM 6th Ed. 2020):", getFib4NoteText()]);
    if (val("prevInterventionOutcome")) specificBlocks.push(["Outcome of previous DMTAC intervention:", val("prevInterventionOutcome")]);

    var adherenceText = joinNonEmpty([
      document.getElementById("quickAdherenceScreen").value,
      val("adherenceBehaviour"),
      val("myMaatSummary")
    ], " ");
    var insulinAdj4 = joinNonEmpty([getTddNoteText(), val("insulinDoseAdjustment")], " ");
    var hypoText = joinNonEmpty([document.getElementById("hypoSeverity").value, val("hypoAssessment")], " ");

    // Item 10: DMTAC patient education. Flipchart entry (visits 1-4) is a PHIS
    // audit requirement and is added here only - never in the short CCMS note.
    var flipchartLabel = getFlipchartLabel(val("visitNumber"));
    var newTherapyFlipchart = getNewTherapyFlipchartLine();
    var educationText = joinNonEmpty([flipchartLabel, val("dmtacEducation"), newTherapyFlipchart], " ");

    pushPharmacotherapyItems(specificBlocks, [
      adherenceText,
      val("medUnderstanding"),
      val("smbgReview"),
      insulinAdj4,
      hypoText,
      val("insulinTechnique"),
      val("lipohypertrophyAssessment"),
      val("lifestyleDiet"),
      val("choCounting"),
      educationText
    ]);

    if (val("fastingAssessmentSummary")) specificBlocks.push(["Fasting eligibility assessment (IDF-DAR 2026):", val("fastingAssessmentSummary")]);

    // Audit-required checklist (SENARAI SEMAK & ADAF) - PHIS note only, never in short CCMS note.
    var auditLine = getAuditChecklistLine();
    if (auditLine) specificBlocks.push(["Audit-required assessment/counselling checklist (SENARAI SEMAK & ADAF):", auditLine]);

    pushBlock(lines, "SPECIFIC DETAILS – Assessment Form For Diabetes Mellitus", specificBlocks);

    // ---------------- REPORTING ----------------
    var reportingBlocks = [];
    var pharmacistNotes = buildPharmacistNotesBlock();
    var pharmacistPlan = buildPharmacistPlanBlock();
    if (pharmacistNotes) reportingBlocks.push(["Pharmacist Notes:", pharmacistNotes]);
    if (pharmacistPlan) reportingBlocks.push(["Pharmacist Plan:", pharmacistPlan]);
    if (val("reportingUnderstanding")) reportingBlocks.push(["Understanding:", val("reportingUnderstanding") + "%"]);
    if (val("reportingAdherenceScore")) reportingBlocks.push(["Adherence score:", val("reportingAdherenceScore")]);
    var mtacStatus = getMtacStatusValue();
    if (mtacStatus) reportingBlocks.push(["MTAC Status:", mtacStatus]);
    var notRecruitedLine = getNotRecruitedLine();
    if (notRecruitedLine) reportingBlocks.push(["Recruitment status:", notRecruitedLine]);
    var dischargeLine = getDischargeLine();
    if (dischargeLine) reportingBlocks.push(["Discharge status:", dischargeLine]);
    pushBlock(lines, "REPORTING", reportingBlocks);

    // ---------------- PHARMACEUTICAL CARE ISSUE ----------------
    var allPciBlocks = getPciBlocks();
    allPciBlocks.forEach(function (blk, i) {
      var heading = allPciBlocks.length > 1
        ? "PHARMACEUTICAL CARE ISSUE " + (i + 1)
        : "PHARMACEUTICAL CARE ISSUE";
      pushBlock(lines, heading, blk);
    });

    // Follow-up interval/items are NOT emitted as a separate block here -
    // they are appended as bullets inside "Pharmacist Plan" above, which is
    // where PHIS expects the plan and its review timeframe to sit together.

    // trim trailing blank lines
    while (lines.length && lines[lines.length - 1] === "") lines.pop();

    return lines.join("\n");
  }

  // ---------------------------------------------------------------------
  // Short CCMS note
  // Reuses the original Dr Navin-slide-based long-form clinical narrative
  // structure, for MO/FMS communication. Excludes everything PHIS-only
  // (flipchart entry, Audit-Required Checklist, Pharmaceutical Care Issue),
  // and uses plain clinical headers instead of SOAP-style labels.
  // ---------------------------------------------------------------------

  function buildShortNote() {
    var lines = [];

    lines.push("DMTAC VISIT " + (val("visitNumber") || "__"));
    lines.push("");

    if (val("ageSex")) {
      lines.push("Brief demography:");
      lines.push(val("ageSex"));
      lines.push("");
    }

    if (val("reasonForRecruitment")) {
      lines.push("Reason for recruitment into DMTAC:");
      lines.push(val("reasonForRecruitment"));
      lines.push("");
    }

    var medHistParts = joinNonEmpty([
      val("t2dmDuration") ? "T2DM x " + val("t2dmDuration") : "",
      val("comorbidities"),
      val("allergy") ? "Allergy: " + val("allergy") : "",
      val("familyHistory") ? "Family history: " + val("familyHistory") : "",
      val("socialHistory") ? "Social history: " + val("socialHistory") : ""
    ], ". ");
    if (medHistParts) {
      lines.push("Medical history:");
      lines.push(medHistParts);
      lines.push("");
    }

    var medHxParts = joinNonEmpty([
      val("currentDMMeds"),
      val("otherMeds"),
      getPomNoteText(),
      val("medChanges") ? "Changes: " + val("medChanges") : "",
      val("sideEffects") ? "Side effects: " + val("sideEffects") : ""
    ], ". ");
    if (medHxParts) {
      lines.push("Medication history:");
      lines.push(medHxParts);
      lines.push("");
    }

    var concernParts = joinNonEmpty([
      val("mainIssue"),
      val("patientConcern"),
      val("adherenceSummary"),
      val("hypoSymptoms"),
      val("lifestyleIssue"),
      val("exerciseActivity")
    ], ". ");
    if (concernParts) {
      lines.push("Presenting concerns:");
      lines.push(concernParts);
      lines.push("");
    }

    var paramParts = [];
    if (val("hba1c")) paramParts.push("HbA1c " + val("hba1c"));
    if (val("smbgPattern")) paramParts.push("SMBG/FBS/RBS " + val("smbgPattern"));
    if (val("bp")) paramParts.push("BP " + val("bp"));
    if (val("ldl")) paramParts.push("LDL-C " + val("ldl"));
    if (val("tg")) paramParts.push("TG " + val("tg"));
    if (getSrCreatNoteText()) paramParts.push(getSrCreatNoteText());
    if (val("egfr")) paramParts.push("eGFR " + val("egfr"));
    if (val("uacr")) paramParts.push("UACR " + val("uacr"));
    if (val("weightBmi")) paramParts.push("Wt/BMI " + val("weightBmi"));
    if (val("waistCircumference")) paramParts.push("WC " + val("waistCircumference"));
    if (getWeightLossNoteText()) paramParts.push(getWeightLossNoteText());
    if (val("lft")) paramParts.push("LFT " + val("lft"));
    if (val("ufeme")) paramParts.push("UFEME " + val("ufeme"));
    if (paramParts.length) {
      lines.push("Clinical parameters:");
      lines.push(paramParts.join(", "));
      lines.push("");
    }

    if (val("therapeuticTargets")) {
      lines.push("Therapeutic targets:");
      lines.push(val("therapeuticTargets"));
      lines.push("");
    }

    if (getLipidNoteText()) {
      lines.push("Lipid-lowering therapy assessment (Framingham + CPG Dyslipidaemia 2023):");
      lines.push(getLipidNoteText());
      lines.push("");
    }

    if (getCkmNoteText()) {
      lines.push("CKM syndrome stage:");
      lines.push(getCkmNoteText());
      lines.push("");
    }

    if (getCkdPillarsNoteText()) {
      lines.push("CKD 4 Pillars of Protection assessment (KDIGO):");
      lines.push(getCkdPillarsNoteText());
      lines.push("");
    }

    if (getFib4NoteText()) {
      lines.push("MASLD screening (FIB-4, CPG T2DM 6th Ed. 2020):");
      lines.push(getFib4NoteText());
      lines.push("");
    }

    if (val("prevInterventionOutcome")) {
      lines.push("Outcome of previous DMTAC intervention:");
      lines.push(val("prevInterventionOutcome"));
      lines.push("");
    }

    var reviewBlocks = [];
    var adherenceText = joinNonEmpty([
      document.getElementById("quickAdherenceScreen").value,
      val("adherenceBehaviour"),
      val("myMaatSummary")
    ], " ");
    var insulinAdj4s = joinNonEmpty([getTddNoteText(), val("insulinDoseAdjustment")], " ");
    var hypoTextShort = joinNonEmpty([document.getElementById("hypoSeverity").value, val("hypoAssessment")], " ");
    // No flipchart entry and no audit checklist line here - both PHIS-only.
    pushPharmacotherapyItems(reviewBlocks, [
      adherenceText,
      val("medUnderstanding"),
      val("smbgReview"),
      insulinAdj4s,
      hypoTextShort,
      val("insulinTechnique"),
      val("lipohypertrophyAssessment"),
      val("lifestyleDiet"),
      val("choCounting"),
      val("dmtacEducation")
    ]);

    if (val("fastingAssessmentSummary")) reviewBlocks.push(["Fasting eligibility assessment (IDF-DAR 2026):", val("fastingAssessmentSummary")]);

    if (reviewBlocks.length) {
      lines.push("Pharmacotherapy review:");
      reviewBlocks.forEach(function (block) {
        lines.push(block[0]);
        lines.push(block[1]);
        lines.push("");
      });
    }

    // CCMS wants the pharmacist's assessment and plan as numbered lists
    // ("Issues" / "Plans"), one line per discrete item, rather than one
    // run-on paragraph - easier to read in CCMS and to match a plan to the
    // issue it answers.
    pushNumberedBlock(lines, "Issues:", val("assessment"));

    if (val("interventionCounselling")) {
      lines.push("Intervention / counselling:");
      lines.push(val("interventionCounselling"));
      lines.push("");
    }

    var newTherapyPlan = getNewTherapyPlanLine();
    var planParts = joinNonEmpty([val("carePlan"), newTherapyPlan, val("referralDiscussion"), getDieteticReferralText(), getQuitSmokingNoteText()], " ");
    pushNumberedBlock(lines, "Plans:", planParts);

    var notRecruitedLine = getNotRecruitedLine();
    if (notRecruitedLine) {
      lines.push("Recruitment status:");
      lines.push(notRecruitedLine);
      lines.push("");
    }

    var dischargeLine = getDischargeLine();
    if (dischargeLine) {
      lines.push("Discharge status:");
      lines.push(dischargeLine);
      lines.push("");
    }

    var followUpParts = joinNonEmpty([
      val("followUpDate") ? "Next review: " + val("followUpDate") : "",
      getTcaNoteText(),
      val("followUpItems") ? "To review: " + val("followUpItems") : ""
    ], ". ");
    if (followUpParts) {
      lines.push("Follow-up:");
      lines.push(followUpParts);
      lines.push("");
    }

    // trim trailing blank lines
    while (lines.length && lines[lines.length - 1] === "") lines.pop();

    return lines.join("\n");
  }

  // ---------------------------------------------------------------------
  // Copy / Clear
  // ---------------------------------------------------------------------

  function copyNote() {
    var output = document.getElementById("noteOutput");
    var status = document.getElementById("copyStatus");
    if (!output.value.trim()) {
      status.textContent = "Generate a note first.";
      return;
    }
    var doFallback = function () {
      output.removeAttribute("readonly");
      output.select();
      try { document.execCommand("copy"); status.textContent = "Copied to clipboard."; }
      catch (e) { status.textContent = "Copy failed. Please copy manually."; }
      output.setAttribute("readonly", "true");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output.value).then(function () {
        status.textContent = "Copied to clipboard.";
      }, doFallback);
    } else {
      doFallback();
    }
  }

  function clearAll() {
    if (!window.confirm("Clear all entered data, scores, and generated notes? This cannot be undone.")) return;

    document.querySelectorAll('main input[type="text"]:not(#aiModel), main input[type="number"], main textarea').forEach(function (el) {
      el.value = "";
    });
    document.getElementById("aiStatus").textContent = "";
    document.querySelectorAll("main select").forEach(function (el) {
      el.selectedIndex = 0;
    });
    document.getElementById("noteOutput").value = "";
    document.getElementById("copyStatus").textContent = "";

    myMaatScores = new Array(12).fill(null);
    myMaatSummaryAutoText = "";
    refreshMyMaatButtons();
    updateMyMaatTotals();
    document.getElementById("myMaatVoiceWarning").textContent = "";
    updateFlipchartIndicator();
    resetAuditChecklist();
    document.getElementById("newSglt2").checked = false;
    document.getElementById("newGlp1").checked = false;
    resetNotRecruited();
    resetDischarge();
    resetPci();
    resetChoCalculator();
    updateCkdStageHint();
    updateBmiCategoryHint();
    resetEgfrCalculator();
    resetAcrCalculator();
    resetPciConverter();
    resetCkdPillarsTool();
    resetFib4();
    resetDieteticReferral();
    resetPom();
    resetSmokerBox();
    resetTca();
    updateCkmStage();
    resetWeightLossTarget();
    resetTdd();
    resetLipidAdvisor();
    updateTgHint();
    resetFastingAssessment();

    if (activeRecognition) {
      activeRecognition.stop();
    }
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    initAccessGate();
    initNotRecruited();
    initDischarge();
    initPci();
    initAiSmartDictation();
    updateAiKeyLabelForProvider(document.getElementById("aiProvider").value);
    document.getElementById("aiProvider").addEventListener("change", function () {
      var modelField = document.getElementById("aiModel");
      var defaults = {
        anthropic: "claude-3-5-sonnet-20241022",
        openai: "gpt-4o-mini",
        gemini: "gemini-3.7-flash",
        "pkdspt-shared": "gemini-3.7-flash"
      };
      modelField.value = defaults[this.value] || "";
      updateAiKeyLabelForProvider(this.value);
    });
    buildMyMaatList();
    updateMyMaatTotals();
    buildAuditChecklist();
    initChoCalculator();
    initChoExtraEntry();
    updateCkdStageHint();
    document.getElementById("egfr").addEventListener("input", updateCkdStageHint);
    document.getElementById("uacr").addEventListener("input", updateCkdStageHint);
    updateBmiCategoryHint();
    document.getElementById("weightBmi").addEventListener("input", updateBmiCategoryHint);
    initEgfrCalculator();
    initAcrCalculator();
    initPciConverter();
    initCkdPillarsTool();
    initFib4();
    updateFib4BmiFlag();
    initPom();
    initTdd();
    initSmokerBox();
    initTca();
    initCkmStage();
    initLipidAdvisor();
    document.getElementById("tg").addEventListener("input", updateTgHint);
    initFastingAssessment();
    initDosePickers();
    initPhraseBanks();
    initDictation();
    updateFlipchartIndicator();
    document.getElementById("visitNumber").addEventListener("input", updateFlipchartIndicator);

    document.getElementById("parseMyMaatVoice").addEventListener("click", parseMyMaatVoiceInput);
    document.getElementById("generateFullNote").addEventListener("click", function () {
      document.getElementById("noteOutput").value = buildFullNote();
      document.getElementById("copyStatus").textContent = "";
    });
    document.getElementById("generateShortNote").addEventListener("click", function () {
      document.getElementById("noteOutput").value = buildShortNote();
      document.getElementById("copyStatus").textContent = "";
    });
    document.getElementById("copyNoteBtn").addEventListener("click", copyNote);
    document.getElementById("clearAllBtn").addEventListener("click", clearAll);
  });
})();
