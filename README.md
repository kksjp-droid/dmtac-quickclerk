# DMTAC QuickClerk

### A Closed-Loop Digital Clinical Workflow for Pharmacist-Led Chronic Disease Care

> **One clinical encounter, one structured dataset, multiple outputs — without repeated documentation.**

> **Before you publish or share this:** the unlock code is `pkdspt` and it is **plainly visible in the page source** — it is a courtesy marker, not access control. The app stores no patient data (nothing in localStorage or a database; only a per-tab "unlocked" flag), and nothing leaves the device unless a pharmacist opts into AI Smart Dictation. Do not enter patient identifiers.

A local, offline tool for DMTAC (Diabetes Medication Therapy Adherence Clinic) pharmacist visits. You clerk once during the consultation, and that single structured dataset generates every output the visit requires — the PHIS MTAC Reporting note, the CCMS clinical note, the audit trail, and a printable paper record — without re-typing the same content into each. It does not connect to CCMS/PHIS, does not store patient data, and does not make clinical decisions.

*(Formerly "DMTAC Clerking Assistant" — renamed to DMTAC QuickClerk, with its own logo, same tool.)*

## How to open

Double-click `index.html`. It opens in your default browser and runs entirely offline — no server, no login, no internet connection required (dictation uses your browser's built-in speech recognition, which may need an internet connection depending on the browser, but no clinical data is sent anywhere by this app).

## Workflow

1. Fill in visit/background, medication history, subjective, and objective fields.
2. Work through the Pharmacotherapy Review sections. Use phrase buttons for common findings (they append to the field, they won't overwrite what you've typed) or click the 🎤 icon to dictate a section, then verify the text.
3. For adherence: use the **quick adherence screen** dropdown for routine follow-ups, or open the **MyMAAT** module for new patients, annual reviews, suspected non-adherence, or complex uncontrolled cases. Score each item, or type/dictate scores (e.g. "5 5 4 5 5 5 3 5 5 4 5 5") into the voice entry box and click Parse.
4. Complete Assessment, Intervention, Plan, and Follow-up. For the PHIS note, also fill **PHIS Reporting** (Understanding %, Adherence score — MTAC Status is derived automatically) and, if there's a documented issue, the **Pharmaceutical Care Issue** section (Type of Intervention, Description, PCI, Pharmacist Recommendation, Status of Intervention, Outcome, Follow-up).
5. Click **Generate Full DMTAC Note** or **Generate Short CCMS Note**. Empty sections are omitted automatically.
6. Read the generated note and correct anything needed — it is a draft. Verification happens as part of clerking each section; there's no separate checklist step.
7. Click **Copy Note**, then paste manually into CCMS / PHIS.
9. Click **Clear All** before the next patient. This wipes every field, MyMAAT score, the generated note, and the checklist.

## Privacy and safety

- Do not enter patient name, IC number, MRN, phone number, address, exact appointment details, or identifiable clinical stories.
- The app does not record consultations, auto-diagnose, recommend medication changes, connect to CCMS/PHIS, store data between sessions, or send anything to an external server.
- Everything lives in memory in your browser tab. Closing the tab or clicking Clear All erases it completely — nothing is saved to disk.

## Content sourced from the DMTAC teaching guide

The Pharmacotherapy Review was expanded and reordered against Dr. Navin Kumar Loganadan's "Clear & Concise: The Ultimate Guide to DMTAC Notes" (Institut Endokrin, Hospital Putrajaya). It now runs: outcome of previous intervention, then 1) medication adherence, 2) medication understanding, 3) SMBG review, 4) insulin dose adjustment, 5) hypoglycaemia assessment, 6) insulin injection technique, 7) lipohypertrophy assessment, 8) lifestyle/diet, 9) carbohydrate counting, 10) DMTAC patient education. Hints and phrase-bank additions reflect the slide's guidance, including the Rule of 15 for hypoglycaemia, the ≥10 second wait before withdrawing the needle, the lipohypertrophy pinch test, CHO exchange counting (1 exchange ≈ 15g carbohydrate), and teaching one education topic per visit.

## Fasting Eligibility Assessment (IDF-DAR Risk Calculator, 2026 Update)

An optional, collapsible tool sits after the CHO Exchange Calculator (not part of the numbered 1–10 Pharmacotherapy Review sequence, since it's only used when a patient plans to fast — e.g. Ramadan or another voluntary/religious fast). It reproduces the **2026 Update of the IDF-DAR Risk Calculator** (Afandi B, Suliman M, Shaikh S, Beshyah SA, Hasannien M. *J Diabetes Endocrine Practice* 2025; International Diabetes Federation – Diabetes and Ramadan): 14 fasting risk elements (pregnancy, diabetes type, duration, treatment regimen, hypoglycaemia pattern, HbA1c, glucose monitoring/CGM use, hyperglycaemic emergencies, macrovascular disease, nephropathy by eGFR, other microvascular complications, cognitive function/frailty/age, physical labour, fasting-focused education, and planned fasting hours), each scored per the source paper's Fig. 1 point values. The total score updates live and is banded per Fig. 2: **low risk 0–3** (fasting generally safe with medical evaluation and monitoring), **moderate risk 3.5–6** (safety uncertain — strict monitoring and medication adjustment required if fasting proceeds), **high risk >6** (fasting considered unsafe — advise against it). A summary line auto-fills a text box (editable, never overwritten once you've edited it — same "don't clobber manual edits" rule as the MyMAAT summary) that is pulled into both the PHIS and CCMS notes when non-empty. Note that the medical risk band is not itself a religious ruling — the source paper frames the final fasting decision as a shared one between patient, clinician, and, where relevant, religious guidance, and the app's hint text says so explicitly. Click **Reset fasting assessment** to clear just this tool without using Clear All.

## CHO Exchange Calculator — label entry, kcal estimate, and targets

**On the food database.** MyFCD (myfcd.moh.gov.my) has no downloadable dataset — it's a search-only Joomla application covering about 1,100 Malaysian foods — and the Open Food Facts dumps run to gigabytes of mostly non-Malaysian packaged products. Neither can be embedded in an offline single-file app. So rather than chasing a bigger built-in table, the calculator now accepts the figures those databases publish:

**A. From a nutrition label or MyFCD (exact).** Enter carbohydrate g per 100 g and the portion weight in grams. MyFCD and every packaged label give exactly this. `80 g of roti canai at 47.8 g CHO/100 g = 38.2 g carbohydrate = 2.55 exchanges` — no assumption anywhere. This makes the size of the built-in list largely irrelevant, since any food you can look up or read off a packet can be entered.

**B. From calories only (estimate).** You asked for kcal → g → CHO. Worth being direct about the limitation: **calories alone cannot tell you carbohydrate content** — 400 kcal of rice and 400 kcal of fried food contain very different amounts. So this mode asks for the food *type* and applies that type's typical carbohydrate share of energy (rice/noodle 75%, bread/kuih 65%, mixed meal 50%, fried 35%, sweet drink 85%, protein 10%, fruit 90%), divided by 4 kcal per gram. The result is labelled **ESTIMATE**, shown with a plausible range rather than a single figure, marked "est." in the list and in the note, and tells you to use the label figure whenever you have one. 400 kcal comes out as 5 exchanges as a rice dish but 2.3 as a fried one — the tool shows you that difference rather than hiding it.

**Targets by patient group.** A selector applies the ranges from the MDA *Medical Nutrition Therapy Guidelines for Type 2 Diabetes, 2nd Edition*, table "CHO exchanges: adult male & female":

| Group | Per main meal | Per day (3 meals + snacks) |
| --- | --- | --- |
| Inactive woman | 2–4 exchanges (30–60 g) | ~7–14 exchanges |
| Active woman / inactive man | 3–5 exchanges (45–75 g) | ~10–17 exchanges |
| Active man | 4–6 exchanges (60–90 g) | ~13–20 exchanges |

Between-meal snacks are 1–2 exchanges and are checked against **that** range, not the meal range. Each meal is checked as you add foods: over-range meals are flagged in red with the actual figure ("Lunch 5 (above 2–4)"), the daily total is checked separately, and under-range meals are reported too but not styled as a warning. The daily ranges are derived from the per-meal figures (×3 meals plus snacks) rather than separately sourced, which the on-screen hint states.

## CKM syndrome staging (2026 AHA/ACC/ADA/ASN)

Source: **2026 AHA/ACC/ADA/ASN Guideline for the Prevention, Detection, Evaluation, and Management of Cardiovascular-Kidney-Metabolic Syndrome** (Ndumele CE et al., *Circulation* 2026;154:e50–e158).

This guideline was attractive to adapt because it **synthesises data the template already collects** rather than asking for anything new. The CKM stage is derived automatically from the BMI, waist circumference, HbA1c, BP, triglycerides, eGFR/UACR and comorbidities already entered, and appears in the Objective section:

| Stage | Meaning | Triggered here by |
| --- | --- | --- |
| **1** | Excess or dysfunctional adiposity alone | BMI ≥23, waist ≥80 cm (women) / ≥90 cm (men), or HbA1c 5.7–6.4% |
| **2** | Metabolic risk factors and/or moderate-to-high-risk CKD | HbA1c ≥6.5%, BP ≥130/80, TG ≥1.7 mmol/L, or KDIGO moderate/high-risk CKD |
| **3** | Subclinical CVD, or a risk equivalent | KDIGO **very-high-risk** CKD, or 10-year CVD risk ≥20% from the Framingham tool |
| **4a / 4b** | Clinical CVD in CKM | IHD, heart failure, stroke, PAD or AF in the comorbidity/assessment text; **4b** if eGFR <15 |

Each stage carries its **monitoring interval** — stage 1 every 2–3 years for lipids/glycaemia/eGFR, stage 2 onward **yearly including UACR**, anthropometrics and BP annually throughout — plus stage-specific management pointers. The stage and its basis go into both notes.

Three things worth knowing about how it's implemented:

- The guideline's **Asian-ancestry cut-offs** are used (BMI ≥23, waist ≥80/90 cm), which happen to match the Malaysian CPG thresholds already in the app rather than the ≥25 / ≥88/102 cm figures used for other populations.
- Thresholds are **converted to mmol/L** — the guideline is written in mg/dL (TG 150 mg/dL = 1.7 mmol/L; fasting glucose 100–125 mg/dL = 5.6–6.9).
- The subclinical-CVD markers the guideline also lists — **coronary artery calcium ≥100, NT-proBNP ≥125 pg/mL, hs-troponin** — are **not** used, because they aren't routinely available at a district clinic. The reference accordion says so explicitly, so a patient meeting those criteria on hospital testing isn't wrongly assumed to be below stage 3.

Since every DMTAC patient has T2D, all are **at least stage 2** by definition. The tool's value is catching the step up to stage 3 or 4, and setting the right monitoring interval.

## Pharmacotherapy Review always numbers 1–10

Both notes now print the full 1–10 Pharmacotherapy Review sequence with **no gaps**. Previously an item you hadn't filled in was omitted entirely, so a note could read 1, 3, 4, 7 — which looks like a step was forgotten rather than simply not applicable. Unfilled items now show a **`-`**:

```
1. Medication adherence:
Claims good adherence.

2. Medication understanding:
-

3. SMBG review:
-
```

`-` is used deliberately rather than "Nil": writing *Nil* would assert a negative finding for something that was never actually assessed. Two behaviours worth knowing: if **nothing at all** was reviewed (a counselled-but-not-recruited visit, say) the whole block is omitted rather than printing ten dashes; and the PHIS-only extras still attach to their items — the flipchart entry to item 10, the insulin TDD line to item 4.

## Next DMTAC visit (TCA) with Penang holiday check

Beside the follow-up timeframe there is a **Next DMTAC visit (TCA)** date field — a native date input, so tapping it opens the device's calendar. Pick a date and it is checked immediately against the Penang public holiday calendar, and reported with its day of the week (e.g. *11 Nov 2026 (Wednesday)*).

It flags:

- **Public holidays in Penang** — national holidays observed in Penang plus the two Penang-only ones, George Town World Heritage City Day (7 July) and the Penang Governor's Birthday (2nd Saturday of July)
- **Sundays** (clinic closed) and **Saturdays** (check whether your DMTAC session runs)
- **Dates in the past**

If you book on a holiday anyway, the warning is carried **into the note itself** (`[WARNING: public holiday — Christmas Day]`), so it is visible to whoever reads it. The TCA appears in the PHIS note under Pharmacist Plan and in the CCMS follow-up block.

**Be aware of how far the data goes, and how certain it is.** The app is offline, so holidays are baked in rather than fetched:

| Years | Confidence |
| --- | --- |
| **2026** | Gazetted — from the penang.gov.my release |
| **2027–2029** | **Estimates, not yet gazetted.** The tool says so on screen every time you pick a date in these years |
| **2030 onward** | Only the **fixed-date** holidays are checked — New Year, Labour Day, 7 July, Merdeka, Malaysia Day, Christmas, and the Governor's Birthday (computed as the 2nd Saturday of July). The moving Islamic and lunar holidays are **not** checked, and the tool says so |

This matters because Hari Raya Aidilfitri, Hari Raya Haji, Awal Muharram, Maulidur Rasul and Nuzul Al-Quran follow the Islamic calendar and are subject to gazette and moon sighting, while Chinese New Year, Wesak, Deepavali and Thaipusam are lunar — none of these can be stated with certainty years ahead. The tool never presents an ungazetted date as settled. For a TCA more than a year out, confirm against the gazetted calendar before committing the appointment.

## PHIS Pharmacist Notes / Pharmacist Plan layout

The PHIS Reporting block is laid out to be read, not just pasted:

```
Pharmacist Notes:
1. Glycaemic control above individualised target.
   - Reinforced medication adherence.
2. Adherence is the main barrier to control.
   - Provided written/pictorial medication schedule.

Pharmacist Plan:
1. Continue current regimen and reassess next visit.
2. Reinforce adherence before medication intensification.
3. Discussed with MO — recommendation accepted.
   - Next review: 3 months
   - To review: HbA1c, SMBG diary
```

Each **pharmacist assessment** item is numbered, with the matching **intervention/counselling** item indented beneath it as a `-` bullet. **Pharmaceutical care plan**, **referral/discussion**, and any dietitian/physiotherapy or Quit Smoking Clinic referral are numbered under **Pharmacist Plan**, with **follow-up date** and **items to review next visit** appended as bullets — so the PHIS note no longer carries a separate trailing `Follow-up:` block. (The CCMS note is unchanged and keeps its own.)

**How the pairing works — worth knowing.** Assessment and intervention are separate free-text fields, so the app cannot know which intervention answers which issue. It pairs them **by position**: the 1st intervention goes under the 1st assessment, the 2nd under the 2nd, and so on. **Tap the chips in matching order** and it comes out right. If there are more interventions than assessments the extras become further bullets under the last one, so nothing is ever dropped; if there are fewer, some assessments simply have no bullet. Interventions recorded with no assessment at all still appear, as plain bullets.

## Assessment / Plan and Pharmaceutical Care Issue, merged

These used to be two separate sections asking for much the same content twice — the pharmacist assessment duplicated the PCI detail, the care plan duplicated the Pharmacist Recommendation, the MO/FMS discussion duplicated the Status and Outcome. The standalone **Pharmaceutical Care Issue** card has been removed and folded into **Assessment, Intervention & Plan**.

**Issues** and **Plans** are written once and drive the CCMS note (numbered). Pharmaceutical Care Issues are now a **repeatable list** — PHIS records one PCI per entry, so there is a **`+ Add Pharmaceutical Care Issue`** button and each card is emitted as its own PHIS block (`PHARMACEUTICAL CARE ISSUE 1`, `2`, … when there is more than one; the suffix is dropped when there is only one). Each card carries Type of Intervention, a dependent Description, the PCI wording, Pharmacist Recommendation, Status of Intervention, Outcome and Follow-up, plus a **Remove** button; cards renumber themselves.

**Auto-classification.** Issue chips marked **⚖** carry the PHIS classification. Tapping one fills the Issues field *and* spawns a PCI card pre-filled with the issue text, Type of Intervention and Description — so a reportable issue is one tap rather than a re-type plus two dropdowns:

| ⚖ Issue chip | Type of Intervention | Description |
| --- | --- | --- |
| Insulin dose optimised/titrated based on the patient's SMBG readings | Incorrect/Inappropriate/Inadequate Regimen | Dose |
| Insulin dose sub-optimal / excessive for the SMBG pattern | Incorrect/Inappropriate/Inadequate Regimen | Dose |
| Insulin regimen frequency inappropriate for the glycaemic pattern | Incorrect/Inappropriate/Inadequate Regimen | Frequency |
| Dose below max tolerated / not renally adjusted | Incorrect/Inappropriate/Inadequate Regimen | Dose |
| Guideline-indicated agent not prescribed | Incorrect/Inappropriate/Inadequate Regimen | Drug |
| Clinically significant drug interaction | Inappropriate Prescription | Drug Interaction |
| Therapeutic duplication within the same class | Inappropriate Prescription | Polypharmacy |
| Medication contraindicated for this patient | Inappropriate Prescription | Contraindication |
| Required monitoring parameter not done | Miscellaneous | Suggest for Vital/Signs Monitoring/Laboratory Investigation |
| Incorrect administration technique or timing | Miscellaneous | Drug Administration Error |
| Adverse drug reaction suspected | Miscellaneous | Others |
| Required agent not in this facility's formulary | Miscellaneous | Drug Not In Formulary |
| Prescription incomplete — dose / duration not stated | Incomplete Prescriptions | Dose / Duration |

Either dropdown can still be overridden. Cards with **no Type of Intervention are ignored**, and with no cards at all the PHIS note has no PCI section — so an abandoned or empty card never reaches the note. The CCMS note never carries any PCI content.

## Note audit (both notes)

Both generated notes were audited by filling every field with a unique traceable token, generating each note, and checking which tokens arrived where. Four defects were found and fixed:

| Defect | Effect | Fix |
| --- | --- | --- |
| Presenting concerns were CCMS-only | The PHIS note carried no main issue, patient concern, hypo symptoms, lifestyle issue or activity level — ADAF F2.1 expects patient information to be complete | Added a **Presenting Concerns** block to the PHIS ASSESSMENT section |
| Two identical `Follow-up:` headings in the PHIS note | Ambiguous once pasted — one was the PCI follow-up, one the visit follow-up | PCI one renamed **`PCI Follow-up:`** |
| Doubled full stops (`...outside source..`) | Phrase-bank sentences already end in "." and the joiner added another | The joiner now strips a trailing stop from each part and closes the sentence with exactly one |
| Weight/BMI printed unlabelled | Bare `78kg, BMI 27.5` sat between `UACR` and `WC` with no label | Prefixed **`Wt/BMI`** in both notes |

The coverage check now reports **no field reaching neither note**, and **no CCMS-only clinical fields**. Fields that are intentionally PHIS-only remain so: the adherence score, the four Pharmaceutical Care Issue fields, and the audit checklist line. A regression test asserts no duplicated headings and no doubled full stops in either note, so these can't silently come back.

## Conditional fields

Some fields only matter for some patients, so they stay hidden until they apply — keeping the sheet short without losing the prompt when it counts.

**Quit Smoking Clinic referral** appears under Social History as soon as the patient is recorded as a current smoker (via the chip or free text, including *merokok*/*perokok*). It offers three states: referred to Klinik Berhenti Merokok, referral *offered but declined*, or already under follow-up — the declined option exists for the same reason as the POM "none" option, since a blank can't distinguish "not offered" from "refused". Negative phrasings (*Non-smoker*, *Ex-smoker*, *Bukan perokok*) deliberately do **not** trigger it, and if smoking status is later corrected the referral un-ticks itself so no stale line reaches the note. Smoking cessation counselling is SENARAI SEMAK 7.8; the referral is the local pathway for acting on it.

**Weight-loss target** appears at BMI ≥27.5, **FIB-4 prompt** at BMI ≥27.5, **POM detail** only when POM is being reviewed, and the **TDD calculator** stays silent unless insulin doses are entered.

> **Bug found and fixed while building this:** phrase chips wrote to fields with a plain `.value =` assignment, which does *not* fire an `input` event. Any field with dependent logic — BMI driving the obesity class, FIB-4 flag and weight-loss target; Social History driving the smoker referral; SrCreat driving eGFR; TG driving non-HDL-C — went stale when filled by tapping a chip rather than typing. All programmatic writes (chips and the calculators' "Insert" buttons) now go through one helper that dispatches the event, so the derived values always keep up.

## PHIS audit items, split inline

The audit-required items from the MOH **"Senarai Semak Pemantauan Kualiti Perkhidmatan MTAC Diabetes Mellitus (DMTAC)"** (Kemaskini Mei 2025) and the **ADAF** MTAC instrument used to sit as one collapsed 34-item block at the end of the Pharmacotherapy Review. That meant a pharmacist had to remember the block existed, open it, and work through it retrospectively — easy to skip under clinic pressure.

They are now **split into five always-visible groups, each anchored under the clinical section it belongs to**, so you meet them naturally as you clerk rather than as a separate chore at the end:

| Group | Sits under | Items | Source |
| --- | --- | --- | --- |
| CPG medication review | Objective (below Therapeutic targets) | 8 | SENARAI SEMAK 7.1–7.4; ADAF F2.6 |
| Counselling & education topics | 10. DMTAC Patient Education | 10 | SENARAI SEMAK 7.5–7.16 |
| Insulin use | 6. Insulin Injection Technique | 11 | SENARAI SEMAK 8.1–8.11 |
| OGLD / other agent counselling | 2. Medication Understanding | 2 | SENARAI SEMAK 9.1–9.2 |
| Dispensing | Assessment, Intervention & Plan | 1 | ADAF F2 |

Each group carries a live **n/m badge** in its header. A group with nothing ticked shows the badge in amber, so an untouched group is visually obvious rather than silently blank; it turns green when the group is complete. Every ticked item still lands in the **PHIS note only** — the automated tests assert that all 32 phrases appear in the generated PHIS note and that **none** of them leak into the CCMS note.

Two items were deliberately taken out of the tick-list:

**"Communication with prescriber documented" (ADAF F3.3 / SENARAI SEMAK 4.2)** — auditors verify prescriber communication from CCMS itself, so ticking it here would only duplicate documentation. The free-text **Referral / discussion with MO or FMS** field in Assessment, Intervention & Plan still records it clinically, and its phrase bank offers the usual wordings ("Discussed with MO — recommendation accepted", and so on).

**"Patient Own Medicine (POM) reviewed"** — this is a medication-reconciliation fact, not a counselling action, so it now sits as a proper field directly under **Other relevant medications**, where you are already looking at the medication list. It offers two mutually exclusive options: *No Patient Own Medicine — no polypharmacy from an outside source*, or *POM reviewed*, which reveals a detail field plus phrase chips (duplication with clinic supply, expired stock, leftover supply from a previous regimen, private GP or other-facility supply, traditional/complementary product, and so on). Recording "none" explicitly matters: a blank field is ambiguous between "the patient has none" and "nobody asked", whereas the note now says so outright. Because this is clinical medication history rather than an audit tick, it appears in **both** notes, inside the medication block.

A **dietitian / physiotherapy referral** field was added alongside (SENARAI SEMAK 7.6, "Penilaian BMI dan modifikasi gaya hidup (termasuk rujukan kepada pakar dietetik dan fisioterapi jika perlu)"), with tick options for dietitian, physiotherapy, and an explicit *"assessed — not indicated this visit"* so the auditable decision is documented rather than left blank, plus an optional free-text reason. Unlike the audit ticks, this is clinical content and appears in **both** notes.

Items from the two checklists that are facility-level rather than patient-level — staffing and training records (ADAF A/B/C, SENARAI 1–3), statistics and reporting (ADAF G, SENARAI 5), room and logistics — are deliberately **not** in the clerking template, since they are audited from facility records and rosters rather than from an individual patient note.

## Tap-to-fill: reducing typing on a tablet

The template is built to be worked through with a finger on an iPad rather than typed out. Almost every field whose answer is predictable now carries a row of one-tap phrase chips underneath it — **NKDA** sits directly on the allergy field, comorbidities offers HPT/dyslipidaemia/IHD/CKD/retinopathy/neuropathy and the rest, labs offer WNL and Not done, and the assessment, intervention, referral, follow-up and Pharmaceutical Care Issue fields all offer guideline-worded sentences drawn from the same sources as the rest of the app. Tapping a chip **appends** to whatever is already in the field (with a comma or space separator as appropriate), so you can build "HPT, Dyslipidaemia, CKD" in three taps and it never overwrites something you typed by hand. Two fields where appending would be nonsense — T2DM duration and the follow-up interval — are marked `data-mode="replace"` instead, so a second tap simply changes your answer.

Chips are ordered **most-likely-answer-first**, so the common case is usually the first thing your thumb lands on. That ordering assumes a DMTAC follow-up population rather than a general clinic: T2DM duration leads with *>10 years*, comorbidities with *HPT*, family history with *Family history of T2DM*, therapeutic targets with *HbA1c 6.6–7.0%* (the CPG's "all others" tier) and *LDL-C ≤1.8*, the pharmacist assessment with *Glycaemic control above individualised target*, previous-intervention outcome with *Partial improvement*, and follow-up interval with *1 month* (SENARAI SEMAK 6.3 suggests 1–2 months). Fields where "nothing to report" genuinely is the most common answer still lead with it — NKDA, WNL, Nil reported, No change since last visit.

Lab fields carry their own short chip rows for the answer that has no number: **Not done**, **Pending**, *Defaulted lab appointment*, *Not reported by lab* (eGFR), *Outsourced to Hospital Seberang Jaya* (UACR), *Not taken this visit* (BP). These are deliberately non-numeric, so tapping them cannot fool the eGFR, CKD-staging, heat-map or TG logic into scoring a patient off a word — the automated tests assert exactly that.

Touch targets are sized for fingers rather than a mouse: chips are at least 34px tall (40px on touch devices), and on any coarse-pointer device inputs render at 16px with 42px minimum height — 16px specifically because iOS Safari zooms the whole page in when you focus a smaller input, which is disorienting mid-consultation. Checkboxes scale up to 20px, and accordion headers to 44px.

The long guideline reference tables (individualised HbA1c targets, the CKD-EPI formula, LDL-C targets by risk category, BP targets by population group, waist circumference and BMI cut-offs) are now **collapsed accordions** rather than always-visible walls of text — roughly 5,000 characters that used to sit permanently in the Objective section. They are one tap away when you need to check a threshold, and out of the way when you don't.

## CKD tools: heat map, albuminuria converters, and the 4 Pillars

The Objective section's renal block now works as a small suite of connected tools, all feeding off the same eGFR and UACR fields.

A colour-coded **KDIGO CKD heat map** sits under the eGFR/UACR fields, drawn with the standard KDIGO colours (green = low risk, yellow = moderately increased, orange = high, red = very high). Once both eGFR and UACR are entered, the patient's own G×A cell is outlined on the grid so the risk zone is visible at a glance rather than only as text. When the patient lands in the **Yellow or Orange** zone, a highlighted flag appears spelling out the actions that matter most: blood pressure target **<130/80 mmHg**, HbA1c at the individualised target, a **kidney-protective SGLT2 inhibitor** (eGFR permitting), and eGFR + UACR screening 1–2× a year. The Red (very high risk) zone shows the same measures with added urgency plus a prompt to discuss further workup or nephrology input.

Two converters handle the reality that different labs report albuminuria differently. The **albuminuria calculator** takes ACR in mg/g or mg/mmol, or AER in mg/24h, converts to the mg/g-equivalent scale, shows the resulting A category, and offers a button to insert it into the UACR field. The **Urine PCI → UACR A-stage converter** exists because our laboratory reports Urine PCI (uPCR) while UACR has to be outsourced to Hospital Seberang Jaya: it accepts a spot PCI in mg/g, mg/mmol or g/mol, *or* a 24-hour urine protein (PER) in mg/24h or g/24h, and returns the KDIGO albuminuria category. It deliberately returns the **category, not a fabricated ACR number** — KDIGO's published equivalence (spot PCR <150 mg/g or 24-hour PER <150 mg/24h ≈ A1; 150–500 ≈ A2; >500 ≈ A3, per the "Relationship among categories of albuminuria and proteinuria" table, reproduced as Table 22.1 in *Diabetes in America* 3rd Ed., NIDDK 2018) is explicitly approximate, and the published numeric PCR→ACR equations (Sumida K et al., *Ann Intern Med* 2020;173:426–435) are spline-based, need sex/diabetes/hypertension terms, and are unreliable below PCR 50 mg/g. The tool warns you when the value is in that unreliable range, reminds you the PCR bands are *not* the same numbers as the ACR bands, and — for any non-A1 result — advises confirming with a real UACR before acting on an ACR-specific threshold. Note CPG T2DM 6th Ed. 2020 does accept uPCR for monitoring treatment response in established proteinuria on cost-effectiveness grounds, so this is a legitimate local workflow, not a workaround.

A collapsible **CKD 4 Pillars of Protection** tool sequences the four kidney/CV-protective classes in the order they're layered on, reusing the eGFR/UACR already entered and asking only for potassium and what the patient is currently taking. It tells you, per pillar, whether the drug is indicated, already appropriate, or blocked by a threshold: **RAASi** (titrate to max tolerated dose; a creatinine rise up to 30% is acceptable, don't stop; continue below eGFR 30; never combine ACEi+ARB+DRI), **SGLT2i** (eGFR ≥20 + ACR ≥200 or heart failure; expect a reversible early eGFR dip; continue below eGFR 20 until dialysis; hold on sick days), **Finerenone** (T2D + CKD + albuminuria persisting despite pillars 1–2, eGFR ≥25, K⁺ ≤5.0 to start, hold if K⁺ >5.5, restart at ≤5.0), and **GLP-1 RA** (kidney + CV benefit in T2D + albuminuria, with or without baseline SGLT2i, per the FLOW trial). Sources: KDIGO 2024 CKD Guideline (*Kidney Int.* 2024;105[4S]), KDIGO 2022 Diabetes in CKD Guideline (102[5S]), and the KDIGO 2026 Diabetes & CKD Guideline Update (Public Review Draft, March 2026), with the sequencing/guardrail framing following the 4-Pillars summary by Dr Nixon Goyal. The guardrails paragraph reminds you to add one pillar at a time, 2–4 weeks apart, rechecking labs after each. The auto-filled summary feeds both generated notes.

## Insulin TDD (IU/kg/day)

Under **4. Insulin Dose Adjustment** there is now a Total Daily Dose calculator — fill it only if the patient is on insulin, and it stays silent otherwise. Enter basal, bolus and/or premixed units per day and it sums the TDD, divides by body weight (pulled automatically from the Weight/BMI field in Objective if you entered it there), and bands the result against the Malaysian references: **0.5–1.0 IU/kg/day** for most patients, above 1.0 acceptable in obese/insulin-resistant patients, below 0.5 possibly under-titrated if targets are not met.

**Each component is now evaluated on its own line**, against its own figures from the DMTAC teaching slide — so you can see at a glance which part of the regimen is out of range rather than inferring it from the total. Lines that exceed their reference are marked with a ⚠ and shown in red; borderline ones in amber.

| Component | Initiation | Optimal | Flagged when |
| --- | --- | --- | --- |
| **Basal** | 0.2 IU/kg/day | 0.5–0.7 IU/kg/day | >0.7 IU/kg/day (⚠ exceeds); 0.5–0.7 shown as "top of range"; <0.2 as below initiation |
| **Prandial (bolus)** | 0.1 IU/kg/dose | 0.2–0.3 IU/kg/dose | >0.5 IU/kg/dose (⚠ exceeds ceiling); 0.3–0.5 as above optimal but under ceiling |
| **Premixed** | 0.2 IU/kg/dose | 0.5 IU/kg/dose, 0.5–1 IU/kg/day | >0.5 IU/kg/dose (⚠); and separately >1 IU/kg/day total |

The per-dose figures need the number of doses per day, so there are **Bolus doses/day** and **Premix doses/day** inputs. If you leave them blank the tool doesn't go silent — it shows the component's IU/kg/**day** and tells you what to enter to get the per-dose check. Each line also shows the working (e.g. *"Prandial 45 IU/day over 3 doses = 15 IU/dose = 0.21 IU/kg/dose"*).

Alongside the per-component lines, three whole-regimen flags fire:

- **TDD >1.5 IU/kg/day** — prompts a search for an underlying cause: non-adherence, incorrect dosing, incorrect timing, incorrect injection technique, or occult infection.
- **Bolus >50% of TDD** — shows the actual percentage and flags the basal:bolus split for review.
- **Basal >0.5 IU/kg/day** — flags possible **over-basalisation**, advising you to address post-prandial excursions rather than escalating basal further when HbA1c is off target despite acceptable fasting readings.

Sources: Practical Guide to Insulin Therapy in Type 2 Diabetes Mellitus, 2nd Ed. 2024 (Sections 5–6, including optimal basal dosing of 0.2–0.3 IU/kg lean, 0.4–0.5 most patients, up to 0.7 obese) and the DMTAC Pocket Guide to Insulin Optimisation, 1st Ed. 2023. The TDD line, with the basal/bolus split, is written into both notes under section 4.

## Weight-loss target in kilograms

The audit checklist asks for "weight loss counselling (target 10% in 6 months)", but a percentage isn't something you can tell a patient directly. So once the Weight/BMI field contains a BMI of **27.5 or above** (Obese I on the Asian cut-offs), a highlighted box works the percentage out in kilograms for you:

> Weight-loss target from 78 kg: lose **7.8 kg** over 6 months (10% of baseline) → target weight **70.2 kg**. That is about **1.3 kg per month**, or 0.3 kg per week. Minimum clinically meaningful milestone in a patient with CV risk factors (which includes diabetes): **2.3–3.9 kg** (3–5% of baseline) → 74.1 kg or below.

Both figures come from the CPG Management of Obesity, 2nd Ed. 2023 "Weight loss goals" (Section 4, Medical Nutrition Therapy): up to 1 kg per week, up to 10% of baseline body weight, and a total of 3–5% of baseline where cardiovascular risk factors are present — which is essentially every DMTAC patient, so the 3–5% milestone is shown alongside the 10% target rather than instead of it. The hint also notes that a 5–10% loss already improves blood pressure, glycaemia and LDL-C (CPG Section 2).

The weight is read from the same free-text Weight/BMI field and accepts the ways you'd naturally type it — "78kg, BMI 27.5", "BMI 30, BW 90 kg", "100kg BMI 35", "BMI 33, weight 82". If the BMI is obese but no weight has been entered, the box **asks for the weight rather than inventing a number**, and it will not mistake the BMI figure itself for a body weight.

A **"Weight-loss target discussed with patient"** checkbox sits under the box. Tick it and the kg figures go into both notes ("target to lose 7.8 kg over 6 months (10% of 78 kg) to a target weight of 70.2 kg, at about 1.3 kg/month"). Leave it unticked and nothing is written — the calculation is just there for you to read off during the consultation. If the BMI later drops out of the obese range, the line stops appearing even if the box is still ticked.

## FIB-4 / MASLD screening

Because KKM now expects FIB-4 to be calculated for obese patients, the **Weight / BMI** field drives an automatic prompt: enter a BMI at or above **27.5** (Obese I on the Asian cut-offs already used by this app) and a highlighted flag appears beside the LFT field telling you to calculate FIB-4 to screen for MASLD (metabolic dysfunction-associated steatotic liver disease, previously NAFLD/MAFLD). If ALT, AST or platelets are missing — or you tick the "not done in the past 12 months" box — the flag additionally tells you to request FBC + LFT for that patient, citing CPG T2DM 6th Ed. 2020 Recommendation 1 (Grade A), which is that *all* T2DM patients should have platelet count, ALT and AST performed and repeated at least annually.

### Referrals — what the CPG actually says

The FIB-4 tool now generates the referral wording automatically, mapped to the four Grade A recommendations under "Recommendations: Assessment of NAFLD" (CPG T2DM 6th Ed. 2020, Section 3.9.4) and Table 3-37 / Appendix 9:

| Trigger | Action | Source |
| --- | --- | --- |
| **FIB-4 ≥1.3** | Refer for **liver stiffness measurement** (transient elastography/FibroScan) | Rec. 4 (Grade A) |
| **Elevated ALT and/or AST** | Request **ultrasound of the liver** (hepatobiliary/abdominal US) to diagnose fatty liver and exclude a focal liver lesion; repeat ALT/AST in 3–6 months | Rec. 2 (Grade A) |
| **Persistently** elevated ALT/AST | Investigate to exclude other causes of chronic liver disease (alcohol, hepatitis B/C, drug-induced liver injury) | Rec. 3 (Grade A) |
| Persistently elevated ALT/AST **or** elevated liver stiffness | Consider **Gastroenterology/Hepatology** referral | Rec. 5 (Grade A) |

**Important correction:** the ultrasound is tied to **raised transaminases, not to a high FIB-4**. A high FIB-4 on its own points to liver stiffness measurement — the CPG never routes a high FIB-4 straight to ultrasound. The two triggers are therefore kept independent: a patient can have a low FIB-4 with raised ALT (ultrasound, no stiffness referral) or a high FIB-4 with normal ALT (stiffness referral, no ultrasound). Tests assert both directions.

Because "elevated" depends on your own lab's reference range, there are now explicit checkboxes for **ALT/AST above the lab reference range** and **persistently elevated (≥2 occasions)**. The tool will still flag on a generic >40 U/L from the entered values, but when it does so it says outright that the cut-off is generic and asks you to confirm against your lab — that caveat disappears once you tick the box.

The calculator itself uses the CPG's own formula (Appendix 9B): FIB-4 = [age × AST] ÷ [platelets (×10⁹/L) × √ALT], with the CPG's interpretation bands — **<1.3** low risk for advanced fibrosis (repeat FIB-4 every 2–3 years per Table 3-37) and **≥1.3** intermediate-to-high risk, prompting referral for liver stiffness measurement (transient elastography/FibroScan) and consideration of Gastroenterology/Hepatology referral. When ALT or AST is elevated it adds the CPG's follow-on actions: ultrasound to confirm steatosis and exclude a focal lesion, exclusion of other causes (alcohol, hepatitis B/C, drug-induced liver injury from prescribed/OTC/traditional products), and a repeat in 3–6 months. It always carries the caveat that a normal ALT/AST does not exclude NASH or advanced fibrosis. A button copies the age you already entered for the eGFR calculator, and the auto-filled summary feeds both notes. The calculated values were verified against an independent implementation of the formula.

## Lipid-Lowering Therapy Advisor

A collapsible tool sits under the Lipid profile field in Objective, taking the clerking all the way from cardiovascular risk score to a specific facility drug/dose suggestion:

1. **Framingham General CVD risk** (10-year %) computed from sex, age, Total Cholesterol, HDL-C, systolic BP, BP-treatment status, smoking, and diabetes — using the exact point tables reproduced in CPG Management of Dyslipidaemia 6th Ed. 2023 (Tables 1A/1B for men, 2A/2B for women), which are themselves the CPG's own mmol/L re-expression of D'Agostino RB Sr et al., "General Cardiovascular Risk Profile for Use in Primary Care," *Circulation* 2008;117:743–753. All point-table and risk-conversion values were cross-checked against the original D'Agostino paper's Tables 5–8 (page images, not just the extracted text) before being encoded.
2. **Risk category** — Low (<10%), Intermediate (10–20%), or High (>20%) by score, or **Very High** / **Extreme** via the CPG's own categorical overrides (established CVD, diabetes with target-organ damage or ≥3 risk factors, CKD eGFR <30, diabetes with proteinuria/a major risk factor, or recurrent CV events within 2 years despite LDL-C <1.4). These overrides take precedence over the calculated score, per the CPG's own instruction that such individuals "do not need to be risk stratified using the FRS-General CVD Risk Score."
3. **LDL-C / non-HDL-C targets** per category (CPG Table 4): Low <3.0/<3.8, Intermediate <2.6/<3.4, High ≤1.8/≤2.6 (≥50% reduction), Very High ≤1.4/≤2.2 (≥50% reduction), Extreme <1.0.
4. **Required statin intensity** (High/Moderate/Low, per CPG Table 12, cross-checked against the 2026 ACC/AHA/AACVPR/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the Management of Dyslipidemia's Table 6 — identical for every statin this facility stocks) mapped to this facility's actual formulary: High — Atorvastatin 40–80mg or Rosuvastatin 20mg; Moderate — Atorvastatin 20mg or Simvastatin 20–40mg; Low — Simvastatin 10mg or Pravastatin 20mg (this facility's Pravastatin strength is Low-intensity only; Moderate needs 40–80mg, not stocked here as a single tablet).
5. **Suitability check** — pick the patient's current agent from the formulary dropdown (plus current LDL-C if known), and the tool tells you directly whether it's adequate, insufficient (with a specific switch/up-titration suggestion), a non-statin that needs a statin backbone added, or a fibrate that isn't a substitute for one — plus a safety caution against combining Gemfibrozil with a statin (Fenofibrate is the safer fibrate pairing).

A summary line auto-fills into a textarea (never overwritten once you edit it) and feeds into both the PHIS and CCMS notes when non-empty. This tool is a calculation and formulary-matching aid, not a substitute for clinical judgement — always confirm against the source tables for edge cases.

A **Triglycerides (TG)** field sits just above the Advisor, with a live hint (CPG Dyslipidaemia 2023, Section 11.1/11.1.1, cross-checked against the 2026 ACC/AHA/.../PCNA Guideline's materially identical breakpoints): target <1.7 mmol/L; mild-to-moderate hypertriglyceridaemia 1.7–<10 (lifestyle first, then statin intensification, fibrate only if TG still high); severe ≥10 (pancreatitis risk, statins remain first-line, combination therapy from >5.6, fibrate/nicotinic acid specifically for pancreatitis prevention ≥11.3). Per the guideline, Non-HDL-C becomes the **secondary** target once TG >2.3 mmol/L and the **primary** target once TG >4.5 mmol/L (Friedewald-calculated LDL-C becomes unreliable above that) — the hint flags this automatically and calculates Non-HDL-C (= TC − HDL-C) using whatever Total Cholesterol/HDL-C you've entered in the Lipid-Lowering Therapy Advisor above, or prompts you to fill those in if they're still blank. TG is included in both generated notes' Clinical Parameters line.

### 2026 ACC/AHA Dyslipidemia Guideline update — Apo-B, Lp(a), and confirmed LDL-C/non-HDL-C targets

A newer edition of the guideline already cited above (Blumenthal JA et al., "2026 ACC/AHA/AACVPR/ABC/ACPM/ADA/AGS/APhA/ASPC/NLA/PCNA Guideline on the Management of Dyslipidemia," published 13 March 2026, retiring the 2018 Blood Cholesterol guideline) was reviewed specifically for what it adds **on top of** CPG Dyslipidaemia 2023, which this tool was already built from. Once its mg/dL figures are converted to mmol/L, its LDL-C targets (Very High <55→**1.4**, High <70→**1.8**, Intermediate <100→**2.6**) and non-HDL-C targets (Very High <85→**2.2**, High <100→**2.6**, Intermediate <130→**3.4**) turn out to be numerically identical to the CPG Malaysia values already implemented above — no change was needed there, and the Advisor's risk-tier targets stand as cross-confirmed by both sources. What the 2026 update genuinely adds:

- **Explicit Apo-B targets per risk tier** — Very High <65 mg/dL (**<0.65 g/L**), High <80 mg/dL (**<0.80 g/L**), not separately defined for Intermediate/Low risk. These are now shown alongside the LDL-C/non-HDL-C targets in the Advisor's summary box, and an optional **Apo-B, if known** field (with a g/L / mg/dL unit selector, since Malaysian labs typically report g/L) lets you enter a result and see it compared against the target for the patient's tier.
- **When to consider ordering Apo-B** — the guideline frames this as reasonable when LDL-C may be underestimating true atherogenic particle burden: triglycerides ≥2.3 mmol/L (Friedewald-calculated LDL-C becomes unreliable), diabetes mellitus (i.e. essentially every DMTAC patient), or when LDL-C already looks at goal but residual risk may persist. The Advisor now flags this automatically based on the TG field, the Diabetes checkbox, and the current LDL-C entered, with the reasoning spelt out rather than just a yes/no flag.
- **Universal one-off Lp(a) screening** — the guideline recommends every adult have Lp(a) checked at least once in their lifetime (fasting not required, don't repeat unless clinically indicated or the assay changes), since ≥125 nmol/L (≥50 mg/dL) is a risk-enhancing factor and ≥250 nmol/L confers roughly double the cardiovascular risk. CPG Dyslipidaemia 2023 does not mandate this. A new checkbox lets you record a known elevated Lp(a) as a risk-category override (treated as at least High), and a hint explains the screening recommendation and notes that niacin is **not recommended** for Lp(a)-lowering (harm outweighs benefit) — worth knowing since Lp(a) assays are typically hospital-referral only at this facility, not a routine district-clinic test.
- **Not adopted into this tool, flagged for reference only:** the guideline's newer PREVENT risk equation (this Advisor still uses the Framingham-based scoring in CPG Dyslipidaemia 2023, since that remains the currently adopted Malaysian standard and PREVENT needs additional inputs — eGFR, UACR, HbA1c — this tool doesn't currently collect together); "non-sequential therapy" (starting statin + PCSK9 inhibitor together for a large LDL-C gap >30–40 mg/dL) and the newer agents it names (PCSK9 inhibitors, inclisiran, bempedoic acid) are not offered as suggestions since none are in this facility's formulary.

## AI Smart Dictation (optional, beta)

A collapsed "AI Smart Dictation" panel at the top of the page lets you dictate or paste a whole free-form clerking narrative into one box, then click **Parse & Auto-Fill Fields** to have an AI provider extract values and drop them into the matching fields automatically (skipping fields that already have content, unless you tick "Overwrite").

**This is the only part of the app where data leaves your device**, and it's entirely optional — skip it and the rest of the app works exactly as before, fully offline.

There are two ways to use it:

**Option A — PKD SPT Shared Gemini (default in the dropdown).** No personal API key needed. Pharmacists enter a shared *access code* instead, which is checked by a small server-side proxy before it forwards the request to Gemini (model `gemini-3.7-flash`) using the DMTAC lead's own key. The lead's key is never visible in the app's code or to any pharmacist using it — see "Setting Up the Shared AI Proxy" below for how the lead sets this up, and note the honest limits of what it protects against.

**Option B — bring your own key (Anthropic, OpenAI, or Gemini).** Each pharmacist uses their own account and key — get one at [console.anthropic.com](https://console.anthropic.com/), [platform.openai.com](https://platform.openai.com/), or [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (Gemini has a usable free tier). Usage is billed to that pharmacist's own account, not built into this app. The key is kept only in the browser tab for that session (a JS variable behind a password-masked field) — never written to disk, never saved in this site's code or repo, gone when you close the tab. Anthropic's and Gemini's APIs support being called directly from a browser this way; OpenAI's may block it (CORS) depending on their current policy — if it fails, that's the provider's browser security policy, not a bug here.

Either way:
- **Do not dictate patient identifiers into this box** — same rule as the rest of the app, but here it actually matters technically too, since this text is transmitted to an external server.
- Free-form dictation is genuinely understood and routed (this uses a real language model, unlike the rest of the app's offline pattern-matching), but always review every auto-filled field before generating or copying a note — treat it as a draft-filler, not a final answer.

## Setting Up the Shared AI Proxy (for the DMTAC lead only)

This lets pharmacists use AI Smart Dictation via your personal Gemini key, without ever seeing that key or needing their own. It requires deploying one small, free serverless function (a Cloudflare Worker) that holds your key server-side and checks an access code before it will use it.

**What this does and doesn't protect against, honestly:** your raw Gemini key is never shipped in the app's code or network traffic, so viewing page source or the GitHub repo can't leak it — that's the real problem this solves. But the access code itself is sent from the browser on each request, same as any password-protected web form; anyone with physical/screen access to an authorised pharmacist's active browser session (e.g. DevTools Network tab) could see it. Treat the access code like a shared team password: don't post it publicly, and change it (redeploy the secret) if you suspect it's leaked.

Steps:

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up for a free account (no credit card needed for this).
2. In the sidebar, go to **Workers & Pages** → **Create** → **Create Worker**. Give it a name, e.g. `dmtac-ai-proxy`. Deploy the default template first (you'll replace the code next).
3. Click **Edit code**. Delete the default content and paste in the contents of `kksj-ai-proxy-worker.js` (included alongside this README). Click **Deploy**.
4. Go to the Worker's **Settings** → **Variables and Secrets**. Add two secrets (type: Secret, not plain text):
   - `GEMINI_API_KEY` = your personal Gemini API key (from [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
   - `AI_ACCESS_CODE` = a code you choose and share only with authorised pharmacists (e.g. pkdspt). **Do not reuse the site's `pkdspt` unlock code here** — that code is visible to anyone who views the page source, so it would give zero protection if reused for this purpose.
5. Save. Copy the Worker's URL shown at the top of its page — it looks like `https://dmtac-ai-proxy.<your-subdomain>.workers.dev`.
6. Open `script.js` in this app, find the line `var PKDSPT_PROXY_URL = "https://dmtac-ai-proxy.kksjpkdspt.workers.dev";` near the top, and replace it with your actual Worker URL from step 5 (if you're reusing the same Worker that was previously deployed under this URL, you can leave it as-is — just double-check in the Cloudflare dashboard that the Worker and both secrets are still active).
7. Re-publish the updated `index.html`/`script.js`/`README.md` to GitHub Pages (see "Publishing to GitHub Pages" below) so the live site picks up the change.
8. Share the access code (not your Gemini key) with your pharmacists. They select "PKD SPT Shared Gemini" in the AI provider dropdown (it's the default) and enter that code — no account or key of their own required.

**Entering the actual `GEMINI_API_KEY` secret value into the Cloudflare dashboard is something you need to do yourself** in step 4 — that's an API key/credential, so it's not something that gets typed in on your behalf as part of this workflow. Everything else (the Worker code, the app's provider dropdown, the README) is already wired up and ready.

If you'd rather not run a proxy, pharmacists can always fall back to Option B (their own free key) instead — nothing else in the app depends on the proxy being set up.

## Counselled but Not Recruited into MTAC

A checkbox before the Follow-up fields flags visits where the patient was counselled and the visit is reported, but the patient isn't being enrolled as a recruited DMTAC follow-up patient. Ticking it reveals a multi-select reason list (patient unable to attend during medication collection, logistic issue, not fulfilling MTAC recruitment criteria, HbA1c < 10%, insulin technique issue not requiring multiple MTAC follow-up, or Other/specify) — pick as many as apply. This appears in **both** the PHIS and CCMS notes, since it's basic visit classification both systems need, not an audit-only detail.

## Discharged from DMTAC

A second checkbox next to "Counselled but Not recruited into MTAC" flags **Discharged from DMTAC**, with a free-text reason field (e.g. targets achieved and stable, transferred to another facility). Appears in both notes, alongside recruitment status. Reset by Clear All.

## Cross-check against "Checklist DMTAC PKD SPT 20.1.26"

Checked the template against your PKD SPT checklist item by item. Items 2–9 (Assessment history, DFIT/MyMAAT/HbA1c, Insulin Education, the 4 Education Modules via flipchart auto-entry, SMBG Counseling, Therapeutic goals, Pharmacotherapy Review, and Others/Ramadan/Sick Day/Foot Care) all map to existing fields or the PHIS Audit-Required Checklist. Three items had no matching field and were added as a result:

- **Reason for recruitment into DMTAC** (item 1) — new field in Visit & Background.
- **Family history** (item 2) — new field in Visit & Background, alongside Social History and Allergy.
- **Reason for discharge** (item 10) — new field, see "Discharged from DMTAC" above.

One structural difference remains by design: the checklist's visit 1–4 tracking table (date/DFIT/MyMAAT/HbA1c side by side across visits) isn't replicated here, since this app deliberately doesn't store data across visits or sessions — no patient data persistence, by design.

## Access Code

The app shows an unlock screen on load requiring the code **pkdspt**. This is a **soft deterrent only** — it marks the tool as PKD Seberang Perai Tengah's work and discourages the link being casually forwarded around (e.g. in WhatsApp groups), but it is **not real security**: the code is visible to anyone who views the page source, and there's no server to enforce it. Don't rely on it to protect anything sensitive — the app doesn't store patient data anyway, so there's nothing sensitive to protect, only the tool's attribution. Unlock state lasts for the browser tab's session (re-prompts on a fresh tab/next day).

## Publishing to GitHub Pages

### The automated way (recommended)

Two scripts do the whole thing. **Windows:** double-click `publish.bat`, or run `publish.bat "your message"`. **Mac/Linux:** `bash publish.sh "your message"`.

On the first run the script initialises the repository, creates it on GitHub, pushes, and enables GitHub Pages — then prints your live URL. On every run after that it just commits and pushes; the site rebuilds in a minute or two.

Before committing anything it **scans the folder for API keys** (Google `AIza…`, OpenAI `sk-…`, private-key blocks) and refuses to publish if it finds one. This is tested — a planted key does block the run.

The scripts never see your password or token; they use whatever `git`/`gh` authentication is already on your machine. The one-time setup is:

1. Install [git](https://git-scm.com) and the [GitHub CLI](https://cli.github.com).
2. Run `gh auth login` once and follow the prompts (browser sign-in — you enter your credentials with GitHub directly, never into these scripts).
3. Run the publish script.

`.gitignore` keeps editor cruft, `node_modules`, test files, `.env` files and `wrangler.toml` out of the repository.

### The manual way

If you'd rather not install anything:

1. Go to [github.com](https://github.com), sign in, click **+** → **New repository**. Name it e.g. `dmtac-quickclerk`, keep it **Public** (Pages' free tier requires this — no patient data is stored or transmitted by this app, so a public repo exposes only the source code). **Create repository**.
2. Click **uploading an existing file** and drag in `index.html`, `style.css`, `script.js`, `README.md`, `dmtac-logo.png`, and `kksj-ai-proxy-worker.js` (reference only — it is deployed separately to Cloudflare). **Commit changes**.
3. **Settings** → **Pages** → Source **Deploy from a branch**, Branch **main** / **(root)** → **Save**.
4. Wait a minute and refresh; GitHub shows the live URL, like `https://<your-username>.github.io/dmtac-quickclerk/`.
5. Share it. Your colleague enters `pkdspt` at the unlock screen.

To update later, upload again and GitHub will offer to replace the files.

### After publishing — lock the Worker to your site

Once you know your Pages URL, open `kksj-ai-proxy-worker.js`, put that URL into `ALLOWED_ORIGINS`, and redeploy the Worker. Until you do, any website can call your proxy.


## Flipchart auto-entry (PHIS audit requirement)

Visit number 1–4 automatically inserts the matching flipchart name into item 10 (DMTAC Patient Education) of the **Full DMTAC Note (PHIS)** only — never into the Short CCMS Note, which is for MO/FMS communication and doesn't need it. A live indicator under Visit Number shows which flipchart applies as you type.

Mapping (English titles translated from the official MOH flipchart PDFs — Program Perkhidmatan Farmasi, KKM, Modul Pembelajaran Pesakit, MTAC Diabetes):

```
Visit 1 → Flipchart 1: Diabetes and Oral Medications
Visit 2 → Flipchart 2: Insulin and Self-Monitoring of Blood Glucose (SMBG)
Visit 3 → Flipchart 3: Healthy Lifestyle
Visit 4 → Flipchart 4: Diabetes and Complications
Visit 5+ → no flipchart entry
```

## Facility Formulary Medication Quick-Add

"Current diabetes medications" has quick-add controls for oral/non-insulin agents and insulin products, refined to match your current formulary/brand naming.

- **Oral / non-insulin agents** use a strength/frequency picker per drug to minimise typing: pick the dose from the dropdown next to each drug name, click **Add**, and the composed line (e.g. "T. Metformin 1g BD") is appended to the field. Covers: T. Metformin (500mg BD / 1g BD), T. Metformin XR (500mg / 1g / 1.5g / 2g, ON), T. Gliclazide MR (30 / 60 / 90 / 120mg, OD), T. Gliclazide (40 / 80 / 120 / 160mg, BD), T. Vildagliptin (50mg OD or BD), T. Empagliflozin (10mg or 25mg, OM), plus two single-strength quick-add buttons for T. Galvusmet 50/1000 (1 tab BD) and T. Dapagliflozin (10mg OM).
- **Insulin** products are plain quick-add buttons (semicolon-separated); add dose/units/frequency after selecting. Current list: s/c Insulin Aspart 30%/Protamine 70% 100IU/ml, s/c Insulin Aspart 100IU/ml, s/c Insulin Glargine 100IU/ml, s/c Insulin Glargine 300IU/ml, s/c Diabulyn R penfill, s/c Diabulyn 30/70 premixed penfill, s/c Diabulyn N penfill.

"Other relevant medications" has a matching button to flag diabetes medication the patient **self-purchases privately, outside the formulary** — click it, then specify the name/dose.

## MyMAAT in 3 Languages

Each MyMAAT item now shows the full question in English, Bahasa Malaysia (official wording from Borang MyMAAT 2020, KKM & UKM), and Simplified Chinese underneath the score buttons — so you can read it straight to the patient in whichever language they're comfortable with, without needing a separate reference sheet.

## CHO Exchange Calculator (item 9, Carbohydrate Counting)

A collapsible "CHO Exchange Calculator" panel sits under item 9 (Carbohydrate Counting) in Pharmacotherapy Review, with two ways to get a carbohydrate exchange count — use either or both:

- **Structured food picker.** Pick a meal (Breakfast/Lunch/Dinner/Snack), pick a food, choose a unit — **× the listed portion** (e.g. 2 slices, 1 cup) or **weight in grams** for foods with gram-based source data — enter the quantity, click **Add to list**. The list below shows each entry with its exchange count, a live grand total (in exchanges and estimated grams, 1 exchange &asymp; 15g), and a Remove button per entry. Click **Insert breakdown into CHO Counting field** to append a summary (e.g. "Breakfast ~4 exchange(s) (Nasi ×2, Roti putih ×2); Total ≈ 4 exchange(s) (≈60g carbohydrate).") to the CHO Counting textarea &mdash; it appends, never overwrites, same as the phrase banks elsewhere in the app.
- **Free-text keyword scan.** Type your dietary review into the CHO Counting box as free text (e.g. "nasi 1 mangkuk, roti canai 2 keping, pisang 1 biji" or "roti canai 95g"), then click **Scan CHO Counting text for food keywords**. It looks for recognised Malaysian food names plus a nearby quantity — a plain number is read as a portion count, a number with a gram unit (e.g. "150g", "150 gram") is converted via that food's gram-based data if available — and adds each match to the same list above (labelled "From text") so you can review, correct, or remove any misreads before inserting. If a gram weight is mentioned for a food with no gram-based source, it's added as a safe default of ×1 portion with a note to correct it manually (rather than misreading the gram number as a portion count).

**Gram-to-CHO conversion.** Where the primary source below gives an exact serving weight in grams alongside its measured carbohydrate content, choosing "weight in grams" computes the exchange directly (`grams entered ÷ source serving weight × source CHO grams ÷ 15`) instead of relying on a household-measure portion — useful when you have a food label or a weighed amount. This is currently available for: nasi, roti putih/bijirin, roti canai, chapati, curry puff, curry mee, susu tepung, condensed milk, and most of the fruits (pisang, epal, oren, anggur, nanas, tembikai, betik, belimbing, mangga, jambu batu, langsat, longan, durian). Foods without this data (shown in the picker's hint text) only support portion-based entry.

**Sources, in order of preference where they disagree:**

1. **MDA MNT 2nd Ed.** — "Medical Nutrition Therapy Guidelines for Type 2 Diabetes, 2nd Edition" (Malaysian Dietitians' Association) — read directly from the primary guideline PDF you provided (Appendix 3 "CHO Exchange for Sugars and Local Kuih", Appendix 4 "Carbohydrate Content of Common Malaysian Foods" — the gram/CHO-gram table behind the "weight in grams" feature above, itself citing Tee ES, Mohd Ismail N, Mohd Nasir A, et al., *Nutrient Composition of Malaysian Foods*, IMR, 1997 — and Appendix 5 "Food Groups and Exchange Lists"). This is the most authoritative Malaysia-specific source used here, covering nearly all items: cereals/grains/starchy vegetables, sugars & sweets, most fruits, and milk. An earlier version of this calculator only had this guideline indirectly, via a workshop deck summarising it ("Bengkel CPG Mx Zon Selatan Kedah", Hospital Kulim dietetics, 2023) — the primary PDF has since superseded that deck wherever the two differed.
2. **Novo Nordisk educator deck** — "Jangan Berhenti Makan!" CHO counting & insulin-dose (ICR/ISF) teaching slides (Novo Nordisk Pharma (M) Sdn Bhd, diabetes educator Heng Ooi Bee Lee) — used for the handful of fruits the MDA MNT guideline doesn't cover (honeydew) and cornflakes.
3. **HTAR exchange list** — Hospital Tengku Ampuan Rahimah dietetics "Pertukaran Karbohidrat" list, used as a cross-check alternative for bihun/mihun and roti putih.
4. **MOH MyHEALTH** — the MOH MyHEALTH patient education portal.
5. **standard exchange / estimate** — general 15g carbohydrate-exchange convention, not independently verified against a specific Malaysian table (no items currently rely solely on this tier — roti canai now has real primary-source gram data, see below).

**Where sources disagreed or gave genuinely different figures for what looks like the same food**, the higher-preference figure is used as the default portion, with the alternative(s) and the reasoning noted in that food's portion hint:

- **Roti canai** — previously an unsourced estimate of ≈2 exchanges/piece; MDA MNT 2nd Ed. Appendix 4 directly measured a 95g piece at 46g CHO, i.e. **≈3 exchanges/piece** — this replaces the old estimate.
- **Pisang/banana, epal/apple, oren/orange** — Appendix 5's standard fruit exchange list rounds these to a full 1-exchange (15g CHO) serving (banana 1 small, apple/orange 1 medium), which is used as the default portion; but Appendix 4's IMR-measured local fruit data gives noticeably lower CHO for a similarly-sized serving (banana/pisang mas 50g ≈ 9g CHO; apple/orange 114g ≈ 9g CHO) — likely reflecting smaller local varieties versus the generic exchange convention. Use the gram-entry mode for a specific weighed fruit rather than relying on the "whole fruit" default when precision matters.
- **Milk (susu)** — Appendix 5 states CHO content varies by fat type (skimmed ≈15g, low-fat ≈12g, full cream ≈10g per cup), while Appendix 4 separately measured full-cream milk at 18g CHO and low-fat at 12g CHO per 250ml cup — these two tables disagree specifically on full-cream milk, so no gram-entry mode is offered for milk; 1 cup is kept as the default regardless of type.
- **Durian** — Appendix 5's "2 medium seeds" and Appendix 4's "5 small seeds (189g) ≈ 12g CHO" clearly describe different seed sizes; the gram-entry mode uses Appendix 4's figure.
- **Biscuits** — Appendix 5's "3 pieces" (cream cracker/Ryvita-type) is used as the default; no gram-entry mode is offered because Appendix 4's "2 pieces (18g)" figure appears to describe a different, more caloric biscuit rather than the same product weighed.
- **Bihun/mihun** — MDA MNT 2nd Ed.: 1/2 cup (used as primary); HTAR: 3/4 cup (noted as an alternative).

Malaysian foods that the MDA MNT source counts under the carbohydrate-exchange group but which other (e.g. American) exchange systems classify as free/non-starchy vegetables — labu merah (pumpkin) and lobak merah (carrot) — are included here exactly as that source lists them, since local practice is what matters for this app.

**Cheese removed.** An earlier version of this calculator listed "keju" (cheese) as a 1-exchange CHO item. Reading the primary MDA MNT 2nd Ed. guideline directly showed this was wrong: cheese (cheddar, 2 thin slices/30g) is listed under the **Lean Meat & Meat Substitute** group — 0g CHO, 7g protein, 4g fat per exchange — a protein/fat exchange, not a carbohydrate one. Counting it here would have wrongly inflated a patient's CHO total, so it has been removed from the food list and scanner entirely.

**Not built (deliberately, due to risk of misreading):** MDA MNT 2nd Ed. Appendix 4 also lists a "Dhal (raw), ½ cup (98g) = 64g CHO ≈ 4 exchanges" figure — but this is for **raw, dry** lentils, not the cooked dhal curry a patient would actually report eating. Adding it as a scannable keyword risked a patient saying "dhal" (meaning a cooked dish, a small fraction of the CHO) being counted at the full raw-weight figure — a dangerous overcount in a diabetes app. Use "kekacang" (cooked legumes, 1/3 cup) instead for typical dietary review clerking. Appendix 3's local kuih table ("Bingka ubi kayu", "kuih koci", "kuih keria", etc.) was also deliberately not turned into CHO exchange items, because it only measures the **sugar** component of each kuih (in teaspoon-equivalents), not its total carbohydrate (sugar + the underlying flour/starch) — using it as a full CHO exchange would substantially *undercount* actual carbohydrate. Separately, the Novo Nordisk deck's insulin-dose calculation content — Insulin:Carbohydrate Ratio (ICR, "Rule of 500") and Insulin Sensitivity Factor (ISF, "Rule of 100") — remains out of scope, as it calculates an actual insulin dose rather than documenting diet. Ask if you'd like any of these added as their own clearly-labelled, pharmacist-verified features.

The free-text scanner is a simple keyword + nearby-number matcher using word-boundary matching (so, for example, "oren" won't falsely match inside "goreng"), not true language understanding — it can still misread ambiguous phrasing, so always review its matches before trusting them. Treat the whole calculator as a clerking convenience that speeds up documentation, not a dietitian-verified calculation; cross-check against your facility's own Senarai Pertukaran Makanan and refer to a dietitian for formal Medical Nutrition Therapy.

## SGLT2i / GLP-1 RA Quick Counselling Reference

A collapsible reference panel (next to the "newly started" checkboxes) summarises indication, administration, missed-dose rules, storage, side effects and management tips, and sick-day/DKA warning signs for both drug classes — sourced from the official KKM patient pamphlets (Jawatankuasa Kerja Farmasi Klinikal, Pengkhususan Diabetes Mellitus, kemaskini Mei 2025) you uploaded. It's read-only reference text, not a form field — nothing here gets copied into the generated note automatically.

## Newly Started SGLT2i / GLP-1 RA

Two checkboxes in Medication History ("Newly started SGLT2 inhibitor" / "Newly started GLP-1 receptor agonist") drive note-specific wording:

- **CCMS (Short Note) Plan** gets: "Counsel patient on mechanism of action, administration method, and side effect management of [drug class] (newly started)."
- **PHIS (Full Note) DMTAC Patient Education** gets: "Flipchart ([drug class]) used for patient counselling on newly started therapy."

These are independent of the PHIS Audit-Required Checklist's own SGLT2/GLP-1 counselling items (which record the detailed MOA/side-effect counselling content for audit purposes) — tick both if applicable. Reset by Clear All.

## PHIS / CCMS note structure

The two note types now follow different source structures, on purpose:

**Full DMTAC Note (PHIS)** mirrors the live PHIS MTAC Reporting screen section-by-section:

- **ASSESSMENT** — Demographic, Social History, Family History, Drug Allergy, Comorbidity/PMH, Past/Other Medication.
- **SPECIFIC DETAILS – Assessment Form For Diabetes Mellitus** — clinical parameters, therapeutic targets, outcome of previous intervention, the 10 numbered Pharmacotherapy Review items (including the flipchart entry in item 10), then the PHIS Audit-Required Checklist line.
- **REPORTING** — Pharmacist Notes, Pharmacist Plan, Understanding (%), Adherence score, MTAC Status (derived — see below), and recruitment/discharge status.
- **PHARMACEUTICAL CARE ISSUE** — only appears if a Type of Intervention is selected; see below.
- **Follow-up** — next review date/timeframe and items to review.

**Short CCMS Note (CCMS)** reuses the original Dr. Navin-slide-based long-form clinical narrative (brief demography, medical/medication history, presenting concerns, clinical parameters, therapeutic targets, outcome of previous intervention, the same 10 numbered Pharmacotherapy Review items minus the flipchart line, pharmacist's clinical summary, intervention/counselling, pharmaceutical care plan, recruitment/discharge status, follow-up) — for MO/FMS communication. It deliberately excludes the flipchart entry, Audit-Required Checklist, and Pharmaceutical Care Issue block (all PHIS-only), and uses plain clinical headers instead of SOAP labels — no "S:"/"O:"/"Assessment:", abbreviated or spelled out, appears anywhere in this note.

## Pharmaceutical Care Issue (PHIS note only)

A new section mirrors the PHIS "Pharmaceutical Care Issue" screen exactly, including its dependent Type of Intervention → Description dropdown:

| Type of Intervention | Description options |
| --- | --- |
| Inappropriate Prescription | Contraindication, Drug Interaction, Incompatibility, Polypharmacy |
| Incomplete Prescriptions | Dose, Dr's Stamp And Sign, Drug, Duration, Frequency, Patient Data |
| Incorrect/Inappropriate/Inadequate Regimen | Dose, Drug, Duration, Frequency |
| Miscellaneous | Authenticity of Prescription/Prescriber, Drug Administration Error, Drug Not In Formulary, Others, Suggest for Vital/Signs Monitoring/Laboratory Investigation, TDM, TPN, Unclear Handwriting, Wrong Patient |

Selecting a Type of Intervention rebuilds the Description dropdown to match. PCI, Pharmacist Recommendation, Status of Intervention (Accepted / Not Accepted / Not Available), Outcome, and Follow-up fields complete the block. Leave Type of Intervention unset if there's no PCI to document this visit — the whole block is then omitted from the PHIS note, and it never appears in the CCMS note.

## MTAC Status (PHIS Reporting block)

Not a manual field — derived automatically for the PHIS note only, from the existing recruitment/discharge checkboxes: **Need Follow Up** by default, **Discharged** if "Discharged from DMTAC" is ticked, or omitted entirely if "Counselled but Not recruited into MTAC" is ticked (since that patient isn't an active MTAC follow-up).

## PHIS Audit-Required Checklist

The Full DMTAC Note (PHIS) also carries a collapsible **PHIS Audit-Required Checklist** at the end of Pharmacotherapy Review, sourced from two MOH audit documents you provided:

- **Senarai Semak Pemantauan Kualiti Perkhidmatan MTAC Diabetes Mellitus (DMTAC)** (Kemaskini Mei 2025) — categories 7 (general/CPG), 8 (insulin use), 9 (OGLD/other agent counselling).
- **ADAF** (Audit Dokumentasi & Amalan Farmasi) MTAC-Diabetes indicators — sections F (documentation completeness, e.g. drug interaction/statin/ACEI-ARB/antiplatelet review, renal function, communication with prescriber) and H (clinical monitoring, patient education, insulin dose adjustment, dispensing/POM/sharps disposal).

Facility-level/operational items from both documents (staff training, protocols, monthly statistics, meeting minutes, discharge criteria, etc.) are out of scope for a per-visit note and were **not** included — only the ~34 per-encounter documentation/counselling items were pulled in, grouped into General, Insulin Use, OGLD/Other Agent Counselling, and Dispensing & Communication.

Ticked items are compiled into a single audit-trail line added to the **PHIS note only** — like the flipchart entry, this is never added to the Short CCMS note. Clear All resets every checkbox.

Supporting fields were also added to feed both note types where relevant: **social history** (Medical History), and **therapeutic targets / LFT / UFEME** (Objective) — these satisfy documentation-completeness items in both audits. The Medication Understanding section (#2) now explicitly references **DFIT** (Dosage, Frequency, Indication, Time), the named knowledge-assessment criteria used in the ADAF indicators.

**Note on MyMAAT cutoff:** the teaching slide cites ≥54 as the good-adherence cutoff, but the official MOH MyMAAT 2020 form (Bahagian II) states ≥50. The app uses ≥50, matching the official scoring form — flagging this in case your team wants to confirm which cutoff your facility uses.

## Clinical terminology upgrade (KDIGO, insulin titration, dyslipidaemia, local DMTAC protocols)

The clerking language was reviewed and tightened against nine additional clinical sources to move it from generic phrasing towards precise, HCP-specific terminology and Malaysia-specific numeric targets/algorithms. What changed, by source:

- **KDIGO 2026 Diabetes and CKD Guideline Update (Public Review Draft, March 2026).** Added a computed **CKD stage hint** under the eGFR/UACR fields (Clinical Parameters): typing a number into either field auto-derives a KDIGO G(1&ndash;5)/A(1&ndash;3) stage and CV/kidney-progression/mortality risk tier (the standard KDIGO GFR &times; albuminuria "heatmap" grid), plus practice-point flags for metformin dose adjustment (eGFR &lt;45), metformin not generally recommended below eGFR 30, and increased eGFR monitoring frequency below eGFR 60. This is a best-effort text parse of whatever number appears first in each field, not a validated calculator &mdash; always confirm against the actual lab report.
- **Practical Guide to Insulin Therapy in Type 2 Diabetes Mellitus, 2nd Ed. (2024, Malaysian Endocrine & Metabolic Society)** and the **MOH DMTAC Pocket Guide to Insulin Optimisation, 1st Ed. (2023).** Section 4 (Insulin Dose Adjustment) now has a collapsible titration reference with real initiation/optimisation/intensification numbers (10 IU or 0.2 IU/kg bedtime start; &plusmn;2 IU adjustment after 3 consecutive FPG readings; optimal dose 0.2&ndash;0.7 IU/kg by build; basal-plus intensification trigger), plus phrase-bank buttons using the precise language for each dose-adjustment scenario, "over-basalisation," and "therapeutic inertia." Section 5 (Hypoglycaemia Assessment) now has a **Level 1/2/3 severity classification** (glycaemic + clinical criteria) that feeds directly into the generated note, and phrasing for risk-factor identification and treatment (15g simple CHO rule, recheck at 15 minutes). Section 6 (Injection Technique) gained the specific quadrant-rotation technique for preventing lipohypertrophy.
- **DMTAC Protocol (Ministry of Health Malaysia, 3rd Ed. 2022)** and **PROTOCOL FACILITY DMTAC (PKD SPT, v2.0, 20.1.25)** — the actual national and local operational protocols this clinic runs under. Added phrase banks for "Reason for recruitment into DMTAC" (the protocol's exact recruitment criteria) and "Reason for discharge" (the protocol's exact discharge criteria), and a "BW after 10% reduction" target phrasing in Weight/BMI, matching the local PKD SPT clerking checklist (Appendix 8).
- **CPG on Dyslipidaemia, 6th Ed. (2023).** Added an LDL-C target-by-CV-risk-category hint under the lipid field (Low/Intermediate/High/Very High risk tiers, Table 4), cross-linked to the CKD stage hint above since CKD stage directly affects CV risk category.
- **Clinical Practice Guidelines: Management of Type 2 Diabetes Mellitus, 6th Ed. (2020)** and the **DMTAC Protocol 3rd Ed.'s own Table 1** (the two are verbatim the same table) — added the individualised HbA1c target tiers (&le;6.5% tight / 6.6&ndash;7.0% / 7.1&ndash;8.0% less tight, with the specific patient-profile criteria for each) as a hint under Therapeutic Targets. Also added a **Waist circumference (WC)** field in Objective, with a reference hint for the CPG's central-obesity cut-offs (&ge;90 cm men, &ge;80 cm women, Table 2-1) — the same Asian cut-offs used alongside BMI &ge;23 kg/m&sup2; for T2DM/prediabetes screening, and part of the CPG's clinical monitoring schedule (Table 3-24: at initial visit and every follow-up).
- **CKD-EPI 2021 (race-free) eGFR calculator** (Inker LA et al., NEJM 2021 — the equation KDIGO endorses and NKF/ASN currently recommend). Added because the clinic laboratory no longer reports eGFR directly. A **Serum Creatinine (SrCreat)** field (with a &micro;mol/L / mg/dL unit selector) sits just before eGFR in Objective, alongside Age and Sex inputs used only for this calculation. As soon as all three are filled in, a hint shows the calculated eGFR; clicking **"Insert calculated eGFR into eGFR field below"** copies it into the eGFR field (it never overwrites that field automatically). SrCreat itself is also included in both generated notes. This is a calculation aid — always prefer a lab-reported eGFR when one is available, and double-check the inputs before relying on the result.
- **CPG Management of Obesity, 2nd Ed. (2023).** Added an auto-labelling **BMI classification** hint under the Weight/BMI field: type "BMI" followed by the number anywhere in that free-text field (e.g. "72kg, BMI 27.4, target BW...") and the app extracts the number and labels it live &mdash; Underweight &lt;18.5, Normal 18.5&ndash;22.9, Pre-obese/Overweight 23.0&ndash;27.4, Obese I 27.5&ndash;32.4, Obese II 32.5&ndash;37.4, Obese III &ge;37.5 (Asian cut-offs, Table 2-1), each with its associated comorbidity-risk level. This is a best-effort text parse (first "BMI &lt;number&gt;" match), not a validated calculator.
- **MDES Diabetes Education Manual (Malaysian Diabetes Educators Society, 2nd Ed., reviewed June 2024).** Added phrasing around empowering/non-judgemental/stigma-free language, health literacy/numeracy assessment, and shared decision-making to Section 10 (DMTAC Patient Education).
- **NICE Guideline (UK), Type 2 Diabetes in Adults: Management.** Used only as a cross-check reference, noted briefly alongside the HbA1c target hint, since NICE's framework (a default 48/53 mmol/mol target with medication-risk-based relaxation) is structured differently from the Malaysian 3-tier table and is not the primary reference for this Malaysian clinic.
- **CPG Management of Hypertension, 5th Ed. (2018)**, cross-checked against **CPG T2DM 6th Ed. (2020)** and the **MDES Diabetes Education Manual.** Added a BP-target-by-population-group hint under Therapeutic Targets, scoped to diabetes patients only: diabetes general (130&ndash;139/70&ndash;79 mmHg), diabetic kidney disease/CKD (&le;130/80 mmHg regardless of albuminuria), and elderly with diabetes by health complexity (&lt;140/90 healthy/intermediate, &lt;150/90 very complex/poor health).

**Inconsistencies flagged rather than silently resolved** (per your request to surface these instead of picking one silently):

- **Basal insulin titration threshold**: MOH DMTAC Pocket Guide 2023 uses &lt;4.0 / 4.0&ndash;7.0 / &gt;7.0 mmol/L; the Practical Guide to Insulin Therapy 2nd Ed. 2024 uses &lt;4.4 / 4.4&ndash;7.0 / &gt;7.0 mmol/L (0.3 mmol/L higher) and also allows a &plusmn;10&ndash;20% dosing step as an alternative to the flat &plusmn;2 IU. This template defaults to the MOH pocket guide's numbers (it's the DMTAC-specific source) but says so explicitly in the Section 4 reference panel.
- **Discharge criteria — number of HbA1c readings at target**: the national DMTAC Protocol 3rd Ed. 2022 requires &ge;2 consecutive readings at individualised target; the local PKD SPT v2.0 protocol requires only &ge;1 reading, and adds a 5th discharge criterion ("patient request to terminate") not present nationally. The discharge-reason phrase bank now offers only the local PKD SPT wording (&ge;1 reading, since that's this facility's own protocol), with the national protocol's differing &ge;2-reading requirement stated in the hint text for awareness rather than offered as a button.
- **LDL-C/CV-risk source vs CKD source overlap**: the Dyslipidaemia CPG's risk tiers (Low/Intermediate/High/Very High) are a different classification system from KDIGO's G/A staging, but both are cross-referenced in the app since CKD severity pushes a patient into a higher dyslipidaemia risk tier — read both hints together rather than expecting a single number.
- **BP target for diabetes**: the CPG on Hypertension 5th Ed. 2018's own diabetes-specific recommendation is &lt;140/80 mmHg (with &lt;130/80 mmHg considered in younger/higher-CV-risk patients), while CPG T2DM 6th Ed. 2020 (and the MDES manual, citing the same MOH 2020 source) states 130&ndash;139/70&ndash;79 mmHg. Both are current Malaysian guidance; the app defaults to the CPG T2DM figure as the diabetes-specific target since that's this clerking's primary reference, with the Hypertension CPG's figure noted alongside it.
- **BMI classification bands**: CPG T2DM 6th Ed. 2020's own BMI table (Table 3-32) cites the older 2004 Malaysian Obesity CPG's wider Obese I/II/III bands (27.5&ndash;34.9 / 35.0&ndash;39.9 / &ge;40.0), while the CPG Management of Obesity 2nd Ed. 2023 (the dedicated, more recent obesity guideline) uses tighter bands (27.5&ndash;32.4 / 32.5&ndash;37.4 / &ge;37.5). The app's auto-labelling hint uses the 2023 Obesity CPG's bands since that's the guideline referenced for this feature, but be aware CPG T2DM's own table still shows the older, wider ones.

The MOH DMTAC Pocket Guide's own titration tables are rendered as diagrams in that PDF (not machine-readable text), so its numbers here were read directly off the page images; everything else was extracted as text. As before, treat all of this as a clerking convenience that speeds up using the correct terminology — it is not a substitute for clinical judgement, and the underlying guideline documents remain the authority in case of any doubt.

## Dictation

Uses the browser's Web Speech API (Chrome/Edge support it best). Dictation is section-by-section — click the mic next to a specific field, dictate your own summary, click again to stop, then verify. It's designed to capture the pharmacist's spoken summary, not the whole patient conversation, so don't place it between you and the patient. If your browser doesn't support it, a message will say so and you can type or use your OS's built-in dictation instead. A language selector (English–Malaysia, Bahasa Malaysia, English–US) is available near the note-generation section.

## Files

```
index.html               — structure and all form fields
style.css                — styling
script.js                — note generation, MyMAAT scoring, dictation, phrase banks, checklist logic
dmtac-logo.png           — site logo, shown on the lock screen and main header
kksj-ai-proxy-worker.js  — Cloudflare Worker code for the optional Shared Gemini proxy (deploy separately; not loaded by index.html)
README.md                — this file
```

## Roadmap ideas (not built yet)

Print-friendly MyMAAT summary, visit-type templates (first visit / follow-up / insulin / hypo visit), a PRP teaching mode with dummy cases, printable blank template export, and a medication phrase bank by drug class — only worth adding once the current version has been used in real clinic sessions and feels stable.
