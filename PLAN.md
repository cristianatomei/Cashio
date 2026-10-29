# Cashio, plan de dezvoltare

Aplicație Android-first (Expo), local-first, pentru urmărirea cheltuielilor cu captare automată din notificări. Fără backend, fără abonament.

## Pregătire livrare — 29.10.2026

- Bonurile locale (#41) și exportul în calendarul telefonului (#43) sunt integrate în `master`.
- Ramura curentă finalizează confirmarea/asocierea ratelor și deduplicarea estimării (#4),
  plus confirmarea/ignorarea sugestiilor de abonamente și totaluri recurente pe monedă (#42).
- #3 și #26 rămân deschise până la verificările native reale. Mediul curent nu are dispozitiv,
  emulator, Android SDK sau Maestro. Nu închide aceste tichete pe baza testelor unitare.
- APK-ul `preview` este configurat ca autonom, dar generarea este blocată în sesiune de lipsa
  autentificării Expo și de DNS pentru `api.expo.dev`. Comenzile și precauțiile de upgrade
  sunt în prima secțiune din README. Nu există un APK nou sau o instalare confirmată.

## Progres — 28.10.2026

- [README.md](README.md#progres-și-punct-de-reluare--28102026) păstrează jurnalul curent, starea implementărilor și verificările rămase. Se actualizează la integrarea taskurilor; tichetele parțial implementate nu se închid ca rezolvate.
- PR #27, cu modificările din PR #2 și #5, este integrat în `master`.
- Backupul automat (#6 / PR #28), blocarea biometrică (#7 / PR #31), onboardingul (#8 / PR #29) și monitorizarea captării (#9 / PR #30) sunt integrate.
- Backupul rulează la deschiderea/revenirea în aplicație, nu garantat în fundal. Blocarea folosește codul dispozitivului ca alternativă la biometrie, nu un PIN separat.
- Combinația Sprintului 1, inclusiv PR #30, a trecut typecheck, lint și 37 de suite / 197 de teste; validarea pe dispozitiv rămâne deschisă.
- Propus pe `feat/rates-quality`, **neintegrat**: FX public opt-in fără transmiterea datelor financiare și fără migrare; teste reale SQLite v1–v9; flow-uri Maestro izolate într-o aplicație sintetică. Lint/typecheck, exportul JavaScript Android, 213 teste Jest și 17 teste Node/SQLite/siguranță trec local. Maestro/Android SDK lipsesc; #26 rămâne parțial până la execuție, #25 necesită și verificarea directă a termenilor BCE/endpointului live. Checklist-ul fizic din README este neexecutat; #3 rămâne deschis.
- Estimarea include ratele individuale, dar poate număra dublu plățile istorice sau o regulă recurentă pentru același credit. Este necesară asocierea explicită, confirmată, înainte de eliminarea dublurilor; nu considera tichetul #4 finalizat.
- Potrivirile de plăți afișate sunt doar posibile, nu confirmări persistente. Cazurile cu mai multe potriviri nu sunt asociate automat.
- Instalarea APK-ului, actualizarea fără pierderi de date și validarea fluxurilor native pe telefon rămân de verificat conform tichetului #3.
- #10 este duplicatul tichetului #3; #16 este duplicatul tichetului #4. Progresul și criteriile rămase se urmăresc în tichetele originale.

## Actualizare — 19.10.2026

Punctul curent de reluare și jurnalul sesiunii sunt în [README.md](README.md#punct-de-reluare--19102026). Utilizatorul dorește continuarea prin GitHub de pe telefon și utilizarea unui APK autonom.

- PR #1 este integrat în `master`: detalii pentru șase rate salvate, comutator de remindere și ștergere cu confirmare. Editarea completă a scadențarului și integrarea în obligații/estimări rămân.
- APK-ul EAS `preview` cu aceste schimbări a fost generat cu succes; instalarea, restaurarea și pornirea fără Metro nu sunt încă confirmate.
- Development build-ul a fost recompilat cu modulele native actuale și actualizat fără dezinstalare. Home funcționează cu datele existente; eroarea `ExpoPushTokenManager` nu se mai reproduce la pornirea verificată.
- Backup JSON validat cu parserul de restaurare; copii SQLite locale integre. Nu include datele private în GitHub.
- După actualizările UI/UX, `npm run typecheck`, `npm run lint`, 30 de suite / 173 de teste și exportul Android au trecut în 19.10.2026.
- Prioritatea imediată este instalarea sigură și testarea APK-ului autonom; apoi validarea PDF-urilor și a reminderelor pe telefon.

### Actualizare UI/UX și fluxuri — 19.10.2026

- Acasă prezintă plățile programate în următoarele 30 de zile (recurente și rate de credit) și bugetele cele mai aproape de limită.
- Formularul pentru tranzacții noi oferă scurtături pentru categoriile, conturile și comercianții folosiți frecvent; selecțiile rămân explicite și nu salvează automat.
- Lista de tranzacții filtrează simultan după categorie și cont; filtrul de categorie include tranzacțiile repartizate pe mai multe categorii.
- Ecranul „Mai mult” grupează destinațiile după scop.
- Scadențarele salvate permit editarea numelui și includerii asigurării; ratele importate sunt păstrate, iar reminderele sunt resincronizate după modificare.
- Înainte de a continua cu widgetul sau noi funcții, generează un APK din commitul actual și validează upgrade-ul, păstrarea datelor și noile fluxuri pe telefon.

## Punct de reluare istoric — 11.10.2026

Secțiunea de mai jos păstrează situația din 11.10.2026; stările depășite (administrarea scadențarelor, autentificarea și generarea APK-ului) sunt înlocuite de actualizarea din 19.10.2026. Criteriile de testare și limitările funcționale rămân relevante.

### Starea verificată

- `npm.cmd run typecheck`: trecut.
- `npm.cmd run lint`: trecut.
- `npm.cmd test -- --runInBand`: 26 de suite, 142 de teste, toate trecute.
- Aceste rezultate sunt din 11.10.2026; înlocuiesc rapoartele anterioare cu erori de captare/tranzacții. Nu reprezintă validare nativă sau vizuală.
- Schema din cod are **9 migrări**: v5 scadențare PDF, v6 cont opțional la tranzacții, v7 repartizări între categorii, v8 IBAN opțional pentru conturile bancare, v9 indexarea notificărilor. Directorul Android generat există în mediul curent; iOS nu există. Importul PDF nu a fost compilat și verificat pe dispozitiv în această sesiune.

### Ce este deja implementat

- Etapele 3/4/5 cerute anterior: statistici, bugete/recurente/estimare și o parte importantă din finalizare (multi-valută, CSV ING, backup, setări persistente).
- Paleta aleasă: **albastru ocean + turcoaz**, nu mov; selecție Română/English și Sistem/Deschis/Întunecat.
- Flux PDF ING în `src/app/data.tsx`, parser în `src/features/loans/domain/ingSchedule.ts`, stocare locală în `loan_schedules`, modul nativ `modules/loan-pdf` cu PdfBox-Android. Importul plăților din raportul CSV Home’Bank este separat; tranzacțiile de credit recunoscute după descriere sunt asociate orientativ ratelor la ±5 zile, iar diferențele de sumă sunt semnalate.
- Preview: număr de rate, monedă, șase scadențe viitoare și componentele plată/dobândă/principal/asigurare; opțiune de includere a asigurării.
- Remindere individuale cu o zi înainte la 09:00; maximum **50 de scadențe în total** între toate scadențarele, reîmprospătate la pornire/revenire în aplicație.
- Cod pentru tranzacții fără cont, repartizări între categorii, refresh prin gest și indicator de notificări deschise; de validat manual.

### Ordinea de lucru la reluare

1. **Restabilește mediul și baseline-ul.** Activează Node 22 local cu `fnm`, fără schimbarea Node global; verifică worktree-ul și rulează typecheck/lint/teste. Păstrează datele și modificările existente; nu reseta telefonul pentru testarea migrărilor.
2. **Validează importul ING pe Android.** Rebuild al development build-ului pentru modulul PDF; testează cele două scadențare reale (NP și ipotecar). Verifică toate datele, numărul ratelor, sumele, coloanele, asigurarea și ratele variabile față de PDF, nu doar faptul că parserul returnează ceva. Confirmă migrarea unei baze existente prin v5–v7 și persistența după restart.
3. **Închide golurile modulului de scadențare.** În prezent nu există editare/ștergere și control al reminderelor după salvare. Adaugă administrarea cu anularea notificărilor, acces la detaliile ratelor salvate și recuperare după erori de programare. Testează permisiune refuzată, scadențar expirat, scadențe apropiate, mai multe credite și plafonul global de 50.
4. **Finalizează integrarea cerută cu obligațiile/calendarul.** Păstrează suma fiecărei scadențe; nu transforma un grafic variabil într-o recurență fixă. Exportul opțional către calendarul telefonului (#43) este implementat separat de forecast/matching: alegere de calendar, sincronizare manuală pentru următoarele 12 luni și curățare doar a evenimentelor etichetate. Necesită build nativ nou și verificările fizice Android/iOS din README; nu este certificat pe dispozitiv. Nu presupune integrarea ramurii draft de forecast/matching.
5. **Verifică restul pe telefon.** Top-up ING → Revolut și deduplicare, autorizări/refuzuri, trierea/refresh-ul notificărilor, tranzacții fără cont și repartizări, matching recurent și avansarea scadenței, bugete/rollover/alerte, statistici, limbă/temă și paletă.
6. **Validează importul și backupul.** CSV ING pe un export Home’Bank actual; backup/restaurare cu scadențare și repartizări, inclusiv versiunile vechi acceptate explicit de cod. Verifică și reprogramarea/anularea reminderelor după restaurare.
7. **Finalizare.** Widget Android (soluție compatibilă de stabilit), polish și APK release cu EAS. `eas.json` are profiluri APK; autentificarea, configurarea/semnarea și buildul release validat rămân de făcut.

### Limite și date private

- PDF: numai Android, text selectabil; fără OCR. Parserul este testat pe date sintetice, nu pe textul PDFBox real. Antetele/diacriticele, ordinea coloanelor și rândurile parțial citite rămân puncte de verificat. Reconcilierea ratelor folosește cuvinte-cheie din descriere și nu este o confirmare contabilă; tranzacțiile descrise generic pot rămâne neasociate, iar potrivirile trebuie verificate.
- Reminderele sunt notificări locale, **nu evenimente în calendarul telefonului**; plafonul de 50 se reîmprospătează numai când aplicația rulează/revine în prim-plan.
- Cele două extracții text temporare ale scadențarelor au fost șterse. Dacă sunt necesare din nou documentele reale, cere utilizatorului să le furnizeze local; nu salva date financiare sau identificatori în repo, teste, documentație ori loguri.
- Nu marca modulul PDF, faza E sau release-ul drept finalizate doar pentru că verificările TypeScript/Jest trec.

## Decizii

- Limbi: română (implicit) și engleză (i18n); selectorul persistent Română/English este implementat în Setări.
- Temă automată, după telefon (deschis și închis) în prezent; selectorul persistent Sistemă/Luminoasă/Întunecată este implementat în Setări.
- Paleta a fost schimbată la albastru ocean + turcoaz, conform alegerii utilizatorului; mai trebuie verificată vizual pe telefon.
- Conturi cu sold: ING, Revolut, Salt Bank, Cash. Retragerea ATM este transfer către Cash; plata cash scade din Cash.
- Categorii pe 2 niveluri: Grup (Nevoi, Vicii, Distracție...) conține Categorii (Țigări, Dentist...).
- Valuta de bază: RON. Cursurile se introduc manual, cu dată de intrare în vigoare.
- Fără: backend, sincronizare, iOS (captarea automată nu există acolo), Open Banking, OCR.

Inspirație: Oinkoin (tag-uri, recurente, interval personalizat, backup, widget), Firefly III (reguli, recurente, rapoarte, multi-valută), Actual Budget (local-first, reguli, import CSV), Monefy (adăugare foarte rapidă, grafice simple).

## Arhitectură

Monolit modular. Fiecare modul din `src/features/<nume>` are straturile `domain` (TypeScript pur), `data` (repository-uri, Drizzle) și `ui`. Modulele comunică doar prin `index.ts`. Restul infrastructurii e în `src/core` (`db`, `ui`, `i18n`, `utils`).

Reguli: parserele sunt funcții pure pe text brut; sursele, cuvintele-cheie și aliasurile sunt în tabele; migrările sunt doar adăugate, niciodată editate.

## Navigare

Tab-uri: Acasă, Tranzacții, (+) adăugare rapidă, Statistici, Mai mult. „De clasificat" apare ca banner pe Acasă și ca filtru în Tranzacții.

## Design

Paletă albastru ocean + turcoaz: primar `#145DA0` în tema deschisă / `#60A5FA` în tema închisă; venit `#007567` / `#2DD4BF`, cheltuială `#C43140` / `#FF6B6B` în propunerea de accesibilitate #19. Închis: fundal `#0E1116`, suprafețe `#171B22`. Deschis: fundal `#F6F7FB`, suprafețe albe. Fiecare grup de categorii are culoare și icoană proprii. Cifrele folosesc variante tabulare. Alegerea utilizatorului este implementată. Auditul propus, măsurătorile automate AA și verificările native încă necesare sunt în [README — audit accesibilitate](README.md#audit-accesibilitate-19--propunere-din-28102026); nu presupune integrarea PR-ului sau verificarea pe telefon.

## Faze

- [x] **0.** Scaffold, SQLite + Drizzle, lint, teste
- [x] **1.** Modul nativ de captare a notificărilor + listă (testat pe emulator)
- [x] **A. Fundație:** design system, i18n, navigare cu tab-uri, schema v2, date inițiale (rulează pe emulator)
- [ ] **B. Flux manual** (scris, de verificat pe emulator): adăugare rapidă cu calculator, listă tranzacții cu căutare și filtre, conturi, categorii/grupuri, comercianți, tag-uri, transferuri, solduri. Date inițiale aliniate cu categoriile din Oinkoin; Salt Bank dezactivat implicit.
- [ ] **C. Captare inteligentă** (verificat parțial pe Samsung): parsere pe formate presupuse, clasificator pe cuvinte-cheie, sugestii pentru ridesharing/livrări/supermarketuri, corelarea transferurilor între conturile proprii prin IBAN, drafturi, „De clasificat”, asociere comerciant, deduplicare. Confirmat: notificarea ING de top-up (60 RON) a ajuns în istoric, dar a fost clasificată inițial ca plată necunoscută și corectată manual ca transfer ING → Revolut. Rămas: testarea pe notificări reale a regulilor noi, recunoaștere automată top-up/transfer Revolut, Salt Bank și notificări active la prima pornire.
- [ ] **Investiții Revolut:** listă locală de active urmărite și detectarea variațiilor explicite din notificările Revolut, fără sursă externă de preț și fără recomandări. Rămas: validarea pe notificări reale, pentru formatele exacte Revolut.
- [x] **D. Statistici:** Acasă (sold, comparație cu luna trecută), donut pe grupuri/categorii, trend, top comercianți, interval personalizat, plăți recurente și conversie în valuta de bază când există curs salvat. Testele unitare trec; mai necesită verificare vizuală pe telefon.
- [ ] **E. Bugete, recurente și estimare** (implementat, de verificat pe telefon): obligații locale lunare/anuale cu interval, cont, comerciant/categorie, sumă fixă sau variabilă și scadență; matching strict al plății și avansarea scadenței; vedere lunară combinată pentru recurente și scadențare PDF; estimare luna următoare; ecran Recurente și card Acasă; bugete cu rollover și alertă 80%/100%; listă „de plătit” și remindere cu o zi înainte la 09:00. Rămas: verificare manuală pe telefon/emulator, inclusiv permisiuni și notificări.
- [x] **Istoric notificări/lead-uri:** textul original rămâne local; starea de triere (deschis/rezolvat/ignorat) este separată de procesarea parserului; tranzacțiile legate pot fi deschise din istoric.
- [ ] **F. Finalizare:** multi-valută, import CSV ING, backup/restaurare, scadențare PDF ING, widget Android, polish, build release APK. Implementate: cursuri manuale datate și conversie sigură în valuta de bază, import separat al plăților CSV ING cu deduplicare la import repetat și față de notificări compatibile, semnalarea diferențelor de sumă pentru plăți de credit identificabile în apropierea scadenței, export/restaurare JSON cu validare și confirmare, import local al scadențarelor PDF ING pe Android cu previzualizare și remindere individuale pentru următoarele 50 de scadențe (reîmprospătate la pornire/revenirea în aplicație), paletă albastru ocean + turcoaz, profil EAS pentru APK. Rămase: validarea parserului contra PDFBox și a migrării v5 pe dispozitiv, verificarea formatului actual ING pe un export CSV real, widget Android, verificări finale pe dispozitiv și build APK release.

Ordine: A, apoi B, apoi C și D (în paralel), apoi E (implementare parțială), apoi F.

## Sesiune pe Samsung — 07.10.2026

- Samsung Galaxy S25 FE (`SM_S731B`) detectat de ADB după activarea USB debugging; Auto Blocker bloca inițial depanarea USB.
- Build Android reușit cu Java 17 din Android Studio; APK debug instalat și development build conectat la Metro pe portul 8082.
- Notificare ING reală de top-up Revolut pentru 60 RON captată. Clasificată inițial ca plată necunoscută; corectată manual ca transfer ING → Revolut. Soldurile pe conturi s-au actualizat corect și totalul a rămas constant.
- Următoarea verificare: parserul să recunoască top-up-ul ca transfer; apoi testarea notificărilor obișnuite și a fluxului Recurente pe telefon.

## Schema actuală (9 migrări)

`accounts` (IBAN opțional din v8), `category_groups`, `categories` (grup, icoană), `merchants` + `merchant_aliases`, `transactions` (cont opțional din v6, comerciant, notă, transfer, status draft/confirmat, recurent, curs valutar), `transaction_allocations` (repartizări din v7), `tags` + `transaction_tags`, `budgets`, `recurring_rules`, `loan_schedules` (migrarea v5), `exchange_rates`, `capture_rules`, `app_settings` (inclusiv activele urmărite pentru investiții), `raw_notifications`. Sumele sunt întregi, în bani. Migrările se adaugă, nu se rescriu; v6 reconstruiește tabela tranzacțiilor și necesită testare pe o bază cu relații existente.

## Biblioteci

Dependențele instalate sunt în `package.json`: `react-native-svg` (grafice), `i18next` + `react-i18next` + `expo-localization`, `@expo/vector-icons`, `expo-haptics`, selectorul nativ de dată/oră, `expo-notifications` (alerte locale), `expo-file-system` + `expo-sharing` + `expo-document-picker` (backup, CSV, selectarea PDF-ului). Modulele locale Kotlin asigură captarea și extracția PDF cu PdfBox-Android. Bibliotecile propuse inițial pentru grafice/bottom sheet/liste, dar absente din manifest, nu sunt cerințe de instalare.

## Verificare

1. `typecheck`, `lint`, `test` după fiecare fază.
2. Teste unitare: parsere, solduri, bugete, recurente, conversie valutară, structura datelor inițiale, paritatea traducerilor.
3. Test de migrare: o bază veche se actualizează fără pierderi (în afara tabelelor refăcute în migrarea 2, care erau goale).
4. Manual pe emulator, cu notificări trimise prin `adb`: de la notificare la „De clasificat", apoi la tranzacție clasificată, apoi la grafic.

## Întrebări deschise

- Widget Android: nu este implementat. Cercetarea anterioară pentru SDK 57 a identificat `expo-widgets` ca soluție iOS, nu Android; reverifică documentația actuală înainte de a alege un modul Kotlin sau altă soluție compatibilă.
- Import CSV ING: parserul acceptă atât antete simple, cât și structura istorică `Data,Detalii tranzactie,Debit,Credit`, date cu luna în română și rânduri suplimentare de detalii; accesibil atât din Date și backup, cât și din filtrul Cheltuieli al listei de tranzacții. Formatul curent trebuie verificat pe un export Home’Bank real.
