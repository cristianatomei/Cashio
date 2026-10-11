# Cashio, plan de dezvoltare

Aplicație Android-first (Expo), local-first, pentru urmărirea cheltuielilor cu captare automată din notificări. Fără backend, fără abonament.

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

Paletă „Aurora": primar violet `#7C5CFF`, venit mint `#2DD4BF`, cheltuială coral `#FF6B6B`, avertisment chihlimbar `#FFB84D`. Închis: fundal `#0E1116`, suprafețe `#171B22`. Deschis: fundal `#F6F7FB`, suprafețe albe. Fiecare grup de categorii are culoare și icoană proprii. Cifrele folosesc variante tabulare. Paleta se ajustează după ce vezi ecranul Acasă pe telefon.

## Faze

- [x] **0.** Scaffold, SQLite + Drizzle, lint, teste
- [x] **1.** Modul nativ de captare a notificărilor + listă (testat pe emulator)
- [x] **A. Fundație:** design system, i18n, navigare cu tab-uri, schema v2, date inițiale (rulează pe emulator)
- [ ] **B. Flux manual** (scris, de verificat pe emulator): adăugare rapidă cu calculator, listă tranzacții cu căutare și filtre, conturi, categorii/grupuri, comercianți, tag-uri, transferuri, solduri. Date inițiale aliniate cu categoriile din Oinkoin; Salt Bank dezactivat implicit.
- [ ] **C. Captare inteligentă** (verificat parțial pe Samsung): parsere pe formate presupuse, clasificator pe cuvinte-cheie, drafturi, „De clasificat”, asociere comerciant, deduplicare. Confirmat: notificarea ING de top-up (60 RON) a ajuns în istoric, dar a fost clasificată inițial ca plată necunoscută și corectată manual ca transfer ING → Revolut. Rămas: recunoaștere automată top-up/transfer Revolut, parser pe mai multe notificări reale, Salt Bank și notificări active la prima pornire.
- [x] **D. Statistici:** Acasă (sold, comparație cu luna trecută), donut pe grupuri/categorii, trend, top comercianți, interval personalizat, plăți recurente și conversie în valuta de bază când există curs salvat. Testele unitare trec; mai necesită verificare vizuală pe telefon.
- [ ] **E. Bugete, recurente și estimare** (implementat, de verificat pe telefon): obligații locale lunare/anuale cu interval, cont, comerciant/categorie, sumă fixă sau variabilă și scadență; matching strict al plății și avansarea scadenței; estimare luna următoare; ecran Recurente și card Acasă; bugete cu rollover și alertă 80%/100%; listă „de plătit” și remindere cu o zi înainte la 09:00. Rămas: verificare manuală pe telefon/emulator, inclusiv permisiuni și notificări.
- [x] **Istoric notificări/lead-uri:** textul original rămâne local; starea de triere (deschis/rezolvat/ignorat) este separată de procesarea parserului; tranzacțiile legate pot fi deschise din istoric.
- [ ] **F. Finalizare:** multi-valută, import CSV ING, backup/restaurare, scadențare PDF ING, widget Android, polish, build release APK. Implementate: cursuri manuale datate și conversie sigură în valuta de bază, import CSV ING cu deduplicare, export/restaurare JSON cu validare și confirmare, import local al scadențarelor PDF ING pe Android cu previzualizare și remindere individuale pentru următoarele 50 de scadențe (reîmprospătate la pornire/revenirea în aplicație), paletă albastru ocean + turcoaz, profil EAS pentru APK. Rămase: validarea parserului contra PDFBox și a migrării v5 pe dispozitiv, verificarea formatului actual ING pe un export CSV real, widget Android, verificări finale pe dispozitiv și build APK release.

Ordine: A, apoi B, apoi C și D (în paralel), apoi E (implementare parțială), apoi F.

## Sesiune pe Samsung — 07.10.2026

- Samsung Galaxy S25 FE (`SM_S731B`) detectat de ADB după activarea USB debugging; Auto Blocker bloca inițial depanarea USB.
- Build Android reușit cu Java 17 din Android Studio; APK debug instalat și development build conectat la Metro pe portul 8082.
- Notificare ING reală de top-up Revolut pentru 60 RON captată. Clasificată inițial ca plată necunoscută; corectată manual ca transfer ING → Revolut. Soldurile pe conturi s-au actualizat corect și totalul a rămas constant.
- Următoarea verificare: parserul să recunoască top-up-ul ca transfer; apoi testarea notificărilor obișnuite și a fluxului Recurente pe telefon.

## Schema v2 (migrarea 2)

`accounts`, `category_groups`, `categories` (grup, icoană), `merchants` + `merchant_aliases`, `transactions` (cont, comerciant, notă, transfer, status draft/confirmat, recurent, curs valutar), `tags` + `transaction_tags`, `budgets`, `recurring_rules`, `loan_schedules` (migrarea v5), `exchange_rates`, `capture_rules`, `app_settings`. Sumele sunt întregi, în bani.

## Biblioteci

`react-native-svg` + `react-native-gifted-charts` (grafice), `i18next` + `react-i18next` + `expo-localization`, `@expo/vector-icons`, `expo-haptics`, `react-native-reanimated` + `react-native-gesture-handler` + `@gorhom/bottom-sheet` (în B), `@shopify/flash-list` (liste lungi), `expo-notifications` (alerte locale), `expo-file-system` + `expo-sharing` + `expo-document-picker` (backup, CSV).

## Verificare

1. `typecheck`, `lint`, `test` după fiecare fază.
2. Teste unitare: parsere, solduri, bugete, recurente, conversie valutară, structura datelor inițiale, paritatea traducerilor.
3. Test de migrare: o bază veche se actualizează fără pierderi (în afara tabelelor refăcute în migrarea 2, care erau goale).
4. Manual pe emulator, cu notificări trimise prin `adb`: de la notificare la „De clasificat", apoi la tranzacție clasificată, apoi la grafic.

## Întrebări deschise

- Widget Android: `expo-widgets` nu este încă validat pentru Android; de implementat ca modul Kotlin dacă nu apare o soluție Expo compatibilă.
- Import CSV ING: parserul acceptă atât antete simple, cât și structura istorică `Data,Detalii tranzactie,Debit,Credit`, date cu luna în română și rânduri suplimentare de detalii; formatul curent trebuie verificat pe un export Home’Bank real.
