# Cashio

Aplicație mobilă (Expo / React Native, Android-first) pentru urmărirea cheltuielilor. Ideea: cheltuielile se captează automat din notificările băncilor (ING, Revolut, Salt Bank), fără introducere manuală și fără abonament. Datele rămân local, în SQLite.

## Punct de reluare — 11.10.2026

Dezvoltarea este pusă în pauză până la următoarea sesiune. Pentru întrebările „unde am rămas?” sau „ce mai avem de făcut?”, începe cu secțiunea **Punct de reluare** din [PLAN.md](PLAN.md); aceasta conține prioritățile și limitările, nu doar lista funcționalităților.

- **Ultima verificare, 11.10.2026:** `typecheck` și `lint` trec; 26 de suite / 142 de teste trec. Erorile raportate în verificările anterioare nu se mai reproduc în această rulare.
- **Ultima funcționalitate adăugată:** import local de scadențare PDF ING (nevoi personale / ipotecar), previzualizare, salvare și remindere individuale. Codul există, dar extracția PDFBox și livrarea notificărilor nu sunt încă validate pe telefon.
- **Schema actuală:** 7 migrări; v5 adaugă scadențarele, v6 permite tranzacții fără cont, v7 adaugă repartizarea unei tranzacții între categorii.
- **Ce facem întâi la reluare:** Node 22, verificările proiectului, rebuild Android și testarea celor două scadențare reale. Nu considera testele unitare dovadă că importul nativ funcționează.
- **Nu este încă implementat:** exportul ratelor în calendarul telefonului, integrarea completă a scadențarelor în obligații/estimări, widgetul Android și APK-ul release validat.

## Stare pe faze

| Fază | Conținut | Stare |
|---|---|---|
| 0 | Scaffold Expo SDK 57, expo-router, SQLite + Drizzle, migrări, lint/test | Implementat; verificările curente trec |
| 1 | Modul nativ Android care citește notificările + ecran cu lista lor | Gata, testat pe emulator |
| A | Design system, i18n (ro/en), tab-uri, schema v2, date inițiale | Gata, rulează pe emulator |
| B | Adăugare manuală, listă tranzacții, conturi, categorii/grupuri, comercianți, tag-uri, transferuri, solduri | Scris, **de verificat** (vezi „Instalare pentru faza B”) |
| C | Parsere, tipul tranzacției, aliasuri comercianți, „De clasificat”, deduplicare | Verificat parțial pe Samsung; plata ING → Revolut a necesitat corectare manuală ca transfer; parserul trebuie ajustat |
| D | Statistici și grafice, Acasă | Implementat; de verificat vizual pe telefon |
| E | Obligații recurente, asociere plăți, estimare, bugete cu rollover și alerte, remindere | Implementat; de verificat pe telefon, inclusiv permisiunile și avansarea scadenței |
| F | Multi-valută, import CSV/PDF ING, backup, widget, build release APK | Cursuri, CSV, backup și flux PDF implementate; validarea nativă PDF, widgetul și release-ul rămân |

Planul complet (decizii, schema, biblioteci, verificare) e în [PLAN.md](PLAN.md).

## Stack

- Expo SDK 57, React Native 0.86, TypeScript strict
- expo-router (rute în `src/app/`)
- expo-sqlite + Drizzle ORM (baza locală `cashio.db`)
- Module native locale Kotlin: `modules/notification-listener` și `modules/loan-pdf` (PdfBox-Android)
- Jest (`jest-expo`), ESLint, Prettier

## Structura proiectului

```
src/
  app/                     rute expo-router: index (redirect), (tabs)/ (home, transactions, add, stats, more),
                           add-transaction (formular, și editare cu ?id=), captured, recurring, budgets, data, settings,
                           manage/ (accounts, categories, merchants, tags)
  core/
    db/                    schema.ts (Drizzle), migrations.ts, defaults.ts + seed.ts (date inițiale), index.ts (useDb)
    domain/                tipuri comune (transaction.ts)
    i18n/                  ro/en (locales/), inițializare i18next
    ui/                    theme/ (paletă, tokeni, ThemeProvider), components/ (AppText, Card, Screen, Button, SheetModal, ...)
    utils/                 money.ts, dates.ts, calculator.ts (+ teste)
  features/                fiecare modul: domain/ (TypeScript pur), data/ (repository-uri, interogări live), ui/, index.ts
    accounts/  categories/  merchants/  tags/  transactions/  capture/  recurring/
    stats/  budgets/  backup/  loans/  parsing/
modules/
  notification-listener/   modul nativ Android (Kotlin) + index.ts
  loan-pdf/                extracție text PDF locală pe Android (PdfBox-Android) + index.ts
android/                   generat de `expo prebuild`; nu se editează manual
```

Alias-uri TypeScript: `@/*` → `src/*`, `@modules/*` → `modules/*`. Modulele se importă între ele doar prin `index.ts`.

## Instalare și date existente

Activează Node 22 conform secțiunii „Mediu de lucru”, apoi folosește `npm.cmd ci` pentru o instalare curată pe baza lockfile-ului. Nu reinstala dependențele la fiecare reluare dacă sunt deja disponibile.

Modulele locale de captare și PDF necesită un development build Android; Expo Go nu le include. După modificări native trebuie reconstruită aplicația. Directoarele native generate nu se editează manual.

Datele inițiale se creează la prima inițializare. Migrările ulterioare trebuie să păstreze datele existente. **Nu șterge datele aplicației de pe telefon pentru a testa o migrare.** Testarea unui reset se face numai pe un emulator de test, cu acord explicit și după backup dacă datele trebuie păstrate.

## Ce conține aplicația acum

- **Setări (Mai mult → Setări):** temă Sistem / Deschis / Întunecat și limbă Română / English, persistente. Paleta aleasă este albastru ocean + turcoaz; culorile deja personalizate pentru conturi/categorii nu sunt modificate.
- **Acasă:** sold total, rezumatul lunii, comparație cu luna trecută, conturi cu sold real, ultimele tranzacții și estimarea obligațiilor.
- **Tranzacții:** lună cu săgetăi, rezumat, căutare (comerciant, categorie, etichetă, notă), filtre pe tip, grupare pe zile cu total pe zi; atingere = editare.
- **Adaugare/editare (butonul +):** Cheltuială / Venit / Transfer, sumă cu calculator (+ − × ÷), categorie (grupuri cu iconițe), cont, comerciant (creat din căutare; completează categoria implicită), dată și oră, etichete (create din selector), notă.
- **Transfer:** între conturi (retragere ATM = ING → Numerar); nu intră în cheltuieli.
- **Tranzacții fără cont și repartizări:** codul permite tranzacții nealocate unui cont și împărțirea sumei între categorii. Aceste fluxuri și migrările v6/v7 trebuie verificate pe dispozitiv.
- **Mai mult:** Conturi (sold inițial, monedă, culoare, icoană, arhivare), Categorii și grupuri, Comercianți, Etichete, Notificări captate (istoric cu stare deschisă/rezolvată/ignorată și acces la tranzacția legată), Recurente.
- **Recurente:** obligații lunare/anuale cu interval, sumă estimată, cont, comerciant, categorie și următoarea scadență; tranzacțiile compatibile se asociază automat, iar următoarea scadență avansează. Estimarea de pe Acasă/Recurente adună obligațiile scadente luna următoare și media cheltuielilor variabile din ultimele 3 luni complete (separat pe monedă).
- **Statistici:** distribuție pe grupuri/categorii, trend, top comercianți, intervale predefinite/personalizate și plăți recurente.
- **Bugete:** limite lunare pe categorie/grup, rollover și notificări la 80%/100%.
- **Date și backup:** cursuri valutare manuale datate, import CSV ING cu deduplicare, export/restaurare JSON cu validare și confirmare. Formatul CSV actual Home’Bank trebuie confirmat pe un export real.
- **Istoric notificări:** triere separată de parsare, acces la tranzacția legată; în cod există și refresh prin gest și indicator pentru notificările deschise, de verificat pe telefon.
- Categoriile „Retrageri cash” din Oinkoin sunt înlocuite aici de transferul către contul Numerar.

## Cum funcționează captarea

1. Serviciul Kotlin `CashioNotificationListenerService` primește notificările și le păstrează doar pe cele din pachetele permise.
2. Le scrie într-o coadă SQLite proprie (`notification_inbox.db`), ca să nu se piardă când aplicația e închisă.
3. La pornire și la revenirea în prim-plan, JS mută coada în tabela `raw_notifications` și o golește.
4. Pachetele permise sunt în `src/features/capture/domain/sources.ts`. Numele pachetelor ING/Revolut sunt presupuneri, de verificat pe notificări reale. Salt Bank lipsește încă.
5. Doar în build-uri de dezvoltare se acceptă și `com.android.shell`, ca să se poată simula notificări cu `adb`.

Baza de date: schema stă în `src/core/db/schema.ts`, iar migrările (doar de adăugat, niciodată editate) în `src/core/db/migrations.ts`. Versiunea e urmărită prin `PRAGMA user_version`. Orice schimbare de schemă se face în ambele fișiere. Sumele se stochează ca întregi, în bani (`amount_minor`).

Migrarea 3 adaugă `review_status` la notificările istorice, separat de `processed_at`: faptul că parserul a verificat notificarea nu înseamnă că utilizatorul a rezolvat lead-ul.

Migrarea 4 adaugă suma variabilă la recurente; v5 adaugă `loan_schedules`; v6 reconstruiește tranzacțiile pentru cont opțional; v7 adaugă `transaction_allocations`. Înainte de release, verifică actualizarea unei baze existente și restaurarea backupurilor acceptate de cod.

## Scadențare ING PDF — implementat, de validat nativ

În **Mai mult → Date și backup → Scadențare de credit**:

1. Alegi un PDF ING cu text selectabil; extracția este locală, prin modulul Android `loan-pdf`.
2. Vezi moneda, numărul ratelor și următoarele șase scadențe, cu plată, dobândă, principal și asigurare.
3. Alegi denumirea, includerea asigurării și activarea reminderelor, apoi salvezi scadențarul.
4. Lista salvată afișează următoarea rată; scadențarul este inclus în backup.

Reminderele sunt notificări locale cu o zi înainte la 09:00. Se programează cele mai apropiate **50 de scadențe în total, pentru toate scadențarele**, nu 50 per credit. Lista se reîmprospătează la pornire și la revenirea în prim-plan; nu există reîmprospătare continuă garantată cu aplicația închisă.

Limitări importante:

- Nu există OCR sau suport PDF pe iOS; formatele ING nerecunoscute sunt respinse.
- Parserul este testat pe texte sintetice. Ordinea coloanelor, diacriticele și toate ratele trebuie comparate cu PDF-urile reale după extracția PDFBox pe Android.
- Ratele variabile sunt păstrate individual; importul **nu creează o obligație recurentă fixă** și nu este încă integrat complet în estimări/asocierea plăților.
- Nu se creează evenimente în calendarul telefonului.
- Editarea/ștergerea scadențarelor și controlul reminderelor după salvare rămân de completat. Acestea sunt necesare înainte de a considera modulul finalizat.
- Nu publica PDF-uri, sume, solduri, identificatori sau extracții reale în repo/loguri. Extracțiile text temporare ale celor două documente furnizate au fost șterse; testele folosesc date sintetice.

## Mediu de lucru (Windows)

Pe PC, Node global e 18 și **nu se modifică**. Proiectul cere Node 22, prin `fnm` (instalat doar pentru utilizatorul curent).

- Folosește un terminal **normal**, nu cu administrator. Un PowerShell cu administrator are alt profil și nu găsește `fnm`.
- Folosește `npm.cmd` și `npx.cmd`, pentru că politica de execuție PowerShell blochează `npm.ps1`. (Alternativ: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.)
- La fiecare terminal nou:

```powershell
cd D:\Projects\Cashio
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression; fnm use 22
node -v    # trebuie să arate v22.x
```

Dacă `fnm` nu e găsit, închide și redeschide VS Code complet. Dacă tot nu apare: `winget install Schniz.fnm --scope user`, apoi `fnm install 22`.

## Comenzi uzuale

```powershell
npm.cmd install                 # instalare dependențe
npm.cmd run typecheck           # tsc --noEmit
npm.cmd run lint                # eslint .
npm.cmd test -- --watchAll=false
npm.cmd run format              # prettier
npx.cmd expo run:android        # build nativ + instalare pe emulator/telefon
npx.cmd expo start --dev-client # server Metro, după ce aplicația e instalată
```

Rulează `typecheck`, `lint` și `test` înainte de a considera un task terminat.

Adăugarea de pachete: `npx.cmd expo install <pachet>` (alege versiunea compatibilă cu SDK-ul). Fixează `react-dom` la aceeași versiune cu `react` (19.2.3), altfel `npm` dă ERESOLVE.

După modificări de cod **nativ** (Kotlin, manifest, `expo-module.config.json`) trebuie reconstruită aplicația cu `npx.cmd expo run:android`. Modificările din TypeScript se reîncarcă singure (Fast Refresh).

## Rulare pe Android

### Emulator

Emulatorul `Medium_Phone_API_33` e mutat pe `D:\android-avd` (pe `C:` nu era destul spațiu, iar partiția de date cere ~7,3 GB). Pe acest PC randarea pe placa video (Intel Iris Xe, Vulkan) face emulatorul să se prăbușească, deci se pornește cu randare software.

Terminalul 1 (emulatorul, rămâne deschis):

```powershell
$env:ANDROID_AVD_HOME = "D:\android-avd"
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Medium_Phone_API_33 -gpu swiftshader_indirect
```

Terminalul 2 (build și instalare):

```powershell
cd D:\Projects\Cashio
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression; fnm use 22
$env:ANDROID_AVD_HOME = "D:\android-avd"
npx.cmd expo run:android
```

Variantă permanentă pentru `ANDROID_AVD_HOME`: `setx ANDROID_AVD_HOME "D:\android-avd"`, apoi redeschide VS Code. Variabila `ANDROID_SDK_HOME` e setată pe sistem la folderul SDK și încurcă emulatorul; în sesiunea curentă se anulează cu `$env:ANDROID_SDK_HOME = $null`.

### Telefon real (alternativă)

1. Activează „Depanare USB" (Opțiuni dezvoltatori), conectează telefonul prin USB și acceptă promptul.
2. Verifică: `& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices`
3. Rulează `npx.cmd expo run:android`.

### Permisiuni la prima rulare

- În aplicație: „Grant notification access" și activează Cashio.
- Exclude Cashio din optimizarea bateriei.
- Pe emulator, dacă opțiunea e dezactivată: Setări, Aplicații, Cashio, meniul cu 3 puncte, „Permite setări restricționate".

## Testare cu notificări simulate

Se folosește `adb` (Android 11+). Folosește un tag diferit pentru fiecare notificare:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "cmd notification post -S bigtext -t 'ING' t1 'Plata cu cardul: 45,20 RON la KAUFLAND BUC'"
```

Apoi „Refresh” în aplicație: notificarea trebuie să apară în lista din Mai mult, Notificări captate. De la faza C, ea devine și tranzacție (vezi mai jos).

### Faza C: de la notificare la tranzacție

Flux: notificarea ajunge în `raw_notifications`, parserul scoate suma, moneda, direcția și comerciantul, iar pipeline-ul creează o tranzacție:

- **Confirmat automat:** comerciant cunoscut cu categorie implicită, o regulă pe cuvinte-cheie („rata” → Rate, „salariu” → Salariu, „asigurare auto”, „RCA”, „rovinietă”) sau retragere ATM (transfer către Numerar).
- **De clasificat (draft):** comerciant necunoscut. Apare pe Acasă, ca banner, și la Mai mult, De clasificat, grupat pe nume. Atingi grupul, alegi comerciantul (existent sau nou) și categoria, iar toate plățile cu acel nume se confirmă; cu „Reine pentru viitor”, următoarele se clasifică singure (de exemplu `xulescu` → Mega Image).
- **Deduplicare:** aceeași plăți în același minut nu se dublează.
- Contul se alege după aplicația sursei (ING, Revolut); notificările simulate cu `adb` se tratează ca ING.

Exemple de test (rulează cu tag diferit și `Refresh` sau redeschide aplicația):

```powershell
& $adb shell "cmd notification post -S bigtext -t 'ING' g1 'Ai platit 31,50 RON la GRAFRELY S.R.L. cu cardul ****1234.'"
& $adb shell "cmd notification post -S bigtext -t 'ING' g2 'Plata cu cardul: 12,00 RON la GRAFRELY SRL'"
& $adb shell "cmd notification post -S bigtext -t 'ING' a1 'Retragere numerar ATM 200,00 RON'"
& $adb shell "cmd notification post -S bigtext -t 'ING' r1 'Rata credit 1.234,56 RON a fost debitata'"
```

Parserele (`src/features/parsing`) sunt scrise pe formate presupuse. Cu texte reale ING/Revolut ajustezi `parseNotification` și cuvintele-cheie, și adăugi teste în `parsing.test.ts`.

### Legenda notificărilor reale

Exemple primite de la ING (07.10.2026), pentru calibrarea parserului:

- **Plată autorizată:** „Ai autorizat tranzactia de 51.5 RON la GRAFRELY S R L din contul [mascat] in 07-10-2026. Sold: 20.4 RON.” → cheltuială de 51,50 RON, comerciant Grafrely.
- **Plată refuzată:** „Nu ai fonduri suficiente pentru autorizarea tranzactiei in valoare de 29.00 USD efectuata la comerciantul GITHUB, INC..” → rămâne notificare/lead în istoric; nu este tranzacție, fiindcă autorizarea nu a reușit.
- **Google Wallet:** „GRAFRELY S R L — RON51.50 with ING Card Complet - Visa RON ••[mascat]” → sursă Google Wallet; posibilă notificare duplicată a aceleiași plăți. Nu o adăugăm ca sursă până nu verificăm pachetul și deduplicarea între surse.

Istoricul din Mai mult → Notificări captate păstrează textul original pe dispozitiv. Fiecare element are starea „deschis”, „rezolvat” sau „ignorat”; procesarea automată și trierea de către utilizator sunt stări separate.

### Etapa E: recurente și estimare

Din Mai mult → Recurente poți adăuga o obligație precum RCA, rovinietă, asigurarea de credit sau rata: sumă estimată, cont, comerciant/categorie, periodicitate lunară/anuală și următoarea scadență. Intervalul permite, de exemplu, fiecare 2 luni sau la fiecare 2 ani. O plată confirmată se leagă automat dacă suma și moneda coincid, contul și comerciantul/categoria se potrivesc, iar data e la cel mult 14 zile de scadență. Regulile nu postează tranzacții automat.

Estimarea lunii următoare este suma obligațiilor scadente în acea lună plus media cheltuielilor confirmate din ultimele 3 luni complete; plățile recurente sunt excluse din media variabilă. Bugetele cu rollover și praguri 80%/100%, lista „de plătit” și reminderele locale sunt implementate. Verificarea pe telefon rămâne necesară: permisiuni, notificări, asocierea plății și avansarea scadenței.

## Probleme întâlnite

| Simptom | Cauză | Soluție |
|---|---|---|
| `File is not defined` la `create-expo-app` | Node 18 | Node 22 prin `fnm` |
| `npm.ps1 cannot be loaded` | Politica de execuție | `npm.cmd` / `npx.cmd` |
| ERESOLVE la `npm install` | `react-dom` 19.3 vs React 19.2.3 | `npm.cmd install react-dom@19.2.3` |
| TS: `Cannot find name 'describe'` | TS 6 nu mai include automat `@types/*` | `"types": ["jest"]` în `tsconfig.json` |
| `expo lint` cere prompt interactiv | Config ESLint lipsă la prima rulare | Scriptul `lint` rulează `eslint .` |
| `Unknown AVD name` | `ANDROID_SDK_HOME` setat greșit | Setează `ANDROID_AVD_HOME` |
| `Not enough space to create userdata partition` | `C:` aproape plin | AVD mutat pe `D:` |
| `Failed to find memory type for ColorBuffers` | Driver Vulkan Intel | `-gpu swiftshader_indirect` |
| `fnm` nu e găsit | Terminal cu administrator sau pornit înainte de instalare | Terminal normal; redeschide VS Code |

## Sesiunea de testare pe telefon — 07.10.2026

- Telefon: Samsung Galaxy S25 FE (`SM_S731B`). ADB a început să-l vadă după activarea USB debugging și dezactivarea temporară a blocării Auto Blocker; driverul Samsung Composite Device era vizibil în Windows.
- Build-ul Android a reușit și aplicația s-a instalat pe telefon. A fost nevoie de Java 17 din Android Studio; Metro a pornit pe portul 8082, deoarece 8081 era ocupat.
- Este un development build: Metro trebuie să rămână pornit pentru a încărca/reîncărca JavaScript. Telefonul și laptopul trebuie să fie în aceeași rețea Wi-Fi după scoaterea cablului. Captura nativă pune notificările în coada locală, iar Cashio le preia când aplicația revine în prim-plan.
- Accesul la notificări este activ. O notificare ING reală pentru un top-up Revolut de 60 RON a ajuns în istoricul Cashio. Parserul a interpretat inițial `Revolut**...` ca comerciant necunoscut/cheltuială; tranzacția a fost corectată manual în transfer ING → Revolut. Soldurile au afișat ING −60 RON și Revolut +60 RON; soldul total a rămas neschimbat. Soldurile inițiale sunt zero până la configurarea lor.
- De îmbunătățit: recunoașterea automată a top-up-urilor/transferurilor către Revolut. Notificările afișate doar în inboxul intern ING nu pot fi captate de Android; sunt accesibile numai notificările publicate în sistem.
- Pentru capturile trimise la depanare, maschează numerele de cont/card și soldurile.

## Pașii următori

Ordinea detaliată și criteriile de acceptare sunt în [PLAN.md — Punct de reluare](PLAN.md#punct-de-reluare--11102026).

1. Node 22, verificări, rebuild Android și validarea celor două PDF-uri ING pe telefon, fără pierderi la migrare.
2. Finalizarea modulului de scadențare: administrare, remindere, integrare în obligații/estimări; clarificarea calendarului telefonului.
3. Verificări reale pentru captare/top-up, recurente, bugete, repartizări, CSV, backup și paletă.
4. Widget Android, polish și build APK release. Profilurile `preview` și `production` din [eas.json](eas.json) sunt configurate pentru APK, dar configurarea profilurilor nu reprezintă un build release verificat.
