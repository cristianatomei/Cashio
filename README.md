# Cashio

Aplicație mobilă (Expo / React Native, Android-first) pentru urmărirea cheltuielilor. Ideea: cheltuielile se captează automat din notificările băncilor (ING, Revolut, Salt Bank), fără introducere manuală și fără abonament. Datele rămân local, în SQLite.

## Punct de reluare — 19.10.2026 (actualizat)

Utilizatorul dorește utilizare zilnică fără laptop/Metro și continuarea dezvoltării coordonate de pe telefon, prin GitHub. Începe cu această secțiune; [PLAN.md](PLAN.md) păstrează planul funcțional și limitările. Nu presupune că un build terminat este și instalat/testat.

- **Ultima verificare locală:** `npm run typecheck`, `npm run lint`, 30 de suite / 173 de teste și `npx expo export --platform android` au trecut. Acestea verifică sursa și bundle-ul, nu instalarea APK-ului pe telefon.
- **Interfață recent îmbunătățită:** Acasă arată plățile programate în următoarele 30 de zile (obligații recurente și ratele importate) și cele mai presante bugete; formularul de tranzacție oferă scurtături către categorii, conturi și comercianți folosiți des; Tranzacții filtrează cumulativ după categorie și cont; ecranul Mai mult este grupat pe scop.
- **Scadențare salvate:** se pot edita denumirea și includerea asigurării, cu păstrarea ratelor importate și resincronizarea reminderelor. Ștergerea și comutarea reminderelor existau deja.
- **Ultima versiune APK EAS cunoscută:** buildul indicat mai jos este anterior acestor modificări UI/scadențar. Pentru testarea lor pe telefon trebuie generat și instalat un APK nou din commitul curent.
- **PR #1 integrat în `master`:** [administrarea scadențarelor salvate](https://github.com/cristianatomei/Cashio/pull/1), inclusiv următoarele șase rate, activare/dezactivare remindere, ștergere cu confirmare și mesaje separate pentru erorile de salvare/reprogramare. Commit: `5da139295e92a12ee41ddd1df3f0f1ddbe5c690b`.
- **APK autonom generat cu succes:** profil EAS `preview`, cu PR #1 inclus. [Build-ul de instalat](https://expo.dev/accounts/cristianatomeis-team/projects/cashio/builds/b3ab3d71-3710-47dd-b6da-6f7aef3ed919). Instalarea și pornirea fără Metro **nu au fost încă confirmate de utilizator**.
- **Telefon verificat:** development build-ul vechi a fost recompilat și actualizat fără dezinstalare; Home se afișează cu datele existente, fără eroarea `ExpoPushTokenManager`.
- **Backup verificat:** exportul JSON a trecut prin parserul real de restaurare al aplicației; există și o copie brută a bazelor SQLite, verificată cu `PRAGMA integrity_check`. Fișierele private rămân pe laptop, nu în GitHub.
- **Schema actuală:** 9 migrări; v5 adaugă scadențarele, v6 permite tranzacții fără cont, v7 adaugă repartizarea unei tranzacții între categorii, v8 adaugă IBAN-ul opțional la conturile bancare, iar v9 indexează notificările pe sursă și dată.
- **Următorul pas pe telefon:** generează APK-ul din cel mai nou commit de pe `master`, instalează-l peste aplicația existentă numai dacă semnătura permite și verifică pornirea fără Metro, păstrarea datelor, scadențele/reminderele și noile scurtături. Nu dezinstala aplicația existentă fără backup verificat și acord explicit.
- **Rămân:** validarea PDFBox pe cele două PDF-uri ING reale și a reminderelor pe telefon, integrarea plăților din scadențare în estimări/asocierea plăților, importul pe export Home’Bank actual, widgetul Android și verificarea vizuală pe dispozitiv.

### Modificări UI/UX și funcționale pregătite pentru reluare de pe telefon

- Acasă prioritizează scadențele apropiate și bugetele aproape de limită, cu acces la listele complete.
- La o tranzacție nouă apar până la trei categorii, conturi și comercianți folosiți des; selecțiile sunt doar scurtături, iar nimic nu se salvează fără acțiunea utilizatorului.
- Tranzacțiile pot fi filtrate simultan după categorie și cont, inclusiv după categoriile folosite în repartizările tranzacțiilor împărțite.
- „Mai mult” este grupat în Verificare, Organizare, Planificare și Date/Preferințe.
- Setările scadențarului permit redenumirea și includerea/excluderea asigurării din valoarea plății; graficul ratelor importate nu se modifică.
- Pentru lucru de pe telefon, pornește din `master`, verifică commiturile recente și creează un PR pentru schimbări noi. APK-ul nu se actualizează automat la push.

### Ce s-a făcut în sesiunea din 19.10.2026

1. S-au identificat cauzele pornirii dificile: terminalul folosea implicit Node 18 în loc de Node 22, iar aplicația instalată era un development build dependent de Metro. Expo Go nu include modulele native locale Cashio.
2. Autentificarea Expo/EAS a fost făcută de utilizator. Proiectul local este legat în [app.json](app.json) de `@cristianatomeis-team/cashio`, ID `5d4d8267-dc8c-42c1-a3b1-be78066a59fc`; slug-ul este `cashio`, nu `Cashio`.
3. La legare a fost creat accidental un proiect Expo suplimentar `Cashio` (cu majusculă). Configurația a fost corectată către proiectul original `cashio`. Nu folosi proiectul suplimentar pentru build-uri; eliminarea lui nu a fost făcută în această sesiune.
4. Primul build, `2450c975-c599-4cf1-8985-20945f67684f`, nu conținea PR #1 și a fost **anulat**. Ambele commituri din PR au fost integrate prin fast-forward și trimise în `master`; GitHub confirmă PR-ul ca merged.
5. Build-ul nou, `b3ab3d71-3710-47dd-b6da-6f7aef3ed919`, a terminat cu succes. Expo a creat o cheie Android nouă, reutilizată de acest build. Semnătura poate diferi de cea a development build-ului instalat; un conflict la instalare nu se rezolvă prin ștergerea imediată a aplicației.
6. Pentru backup a fost pornit Metro pe portul **8082**, accesibil telefonului prin `adb reverse`. Varianta localhost de pe 8081 asculta pe IPv6; 8082 cu `--host lan` a fost verificat accesibil și prin IPv4.
7. A apărut `Cannot find native module 'ExpoPushTokenManager'`, cu avertismente secundare despre exporturile rutelor. Cauza era aplicația nativă veche, nu lipsa exporturilor. S-a regenerat proiectul Android cu `expo prebuild`, apoi s-a compilat `app:assembleDebug` pentru `arm64-v8a` cu Node 22 și Java 17 din Android Studio. `adb install -r` a actualizat aplicația fără ștergerea datelor. Pornirea Home a fost verificată pe Samsung Galaxy S25 FE.
8. Au fost salvate bazele SQLite înainte de intervenție, apoi exportul JSON. Fișierul `cashio-backup-1792427409798.json` este în Descărcări; copia suplimentară și arhiva brută sunt în subfolderul local `Cashio-backup-2026-10-19`. JSON-ul a fost validat cu `parseCashioBackup`, iar copia indicată de utilizator este identică. Testul temporar de validare a fost eliminat.
9. Utilizatorul a primit pașii pentru transferul APK-ului și backup-ului printr-un folder Drive privat. **Încă nu există confirmarea instalării APK-ului, restaurării sau funcționării offline.**

### Reluare de pe telefon / GitHub

- Lucrează în [repository-ul GitHub](https://github.com/cristianatomei/Cashio), pornind din `master`, și propune modificările prin PR-uri.
- Un PR deschis nu intră automat în APK. Verifică, integrează în `master`, apoi generează un build din versiunea actualizată.
- APK-ul existent nu se actualizează singur la modificări pe GitHub. Pentru schimbări livrate utilizatorului trebuie generat și instalat un APK nou; EAS Update nu a fost configurat.
- Păstrează `com.cashio.app`, asocierea EAS și cheia de semnare pentru actualizări compatibile. Nu genera altă cheie pentru fiecare build.
- Mai întâi confirmă cu utilizatorul ce versiune are instalată și dacă mai are nevoie de restaurare. După instalare, testează deschiderea cu laptopul/Metro oprit, datele, accesul la notificări și reminderele.
- Nu încărca în repository backup-uri, baze SQLite, PDF-uri personale, chei sau parole. Backup-ul JSON conține date financiare și nu este criptat de fluxul de export.

## Stare pe faze

| Fază | Conținut | Stare |
|---|---|---|
| 0 | Scaffold Expo SDK 57, expo-router, SQLite + Drizzle, migrări, lint/test | Implementat; verificările curente trec |
| 1 | Modul nativ Android care citește notificările + ecran cu lista lor | Gata, testat pe emulator |
| A | Design system, i18n (ro/en), tab-uri, schema v2, date inițiale | Gata, rulează pe emulator |
| B | Adăugare manuală, listă tranzacții, conturi, categorii/grupuri, comercianți, tag-uri, transferuri, solduri | Implementat, **de verificat pe telefon** |
| C | Parsere, tipul tranzacției, aliasuri comercianți, „De clasificat”, deduplicare | Verificat parțial pe Samsung; plata ING → Revolut a necesitat corectare manuală ca transfer; parserul trebuie ajustat |
| D | Statistici și grafice, Acasă | Implementat; de verificat vizual pe telefon |
| E | Obligații recurente, asociere plăți, estimare, bugete cu rollover și alerte, remindere | Implementat; de verificat pe telefon, inclusiv permisiunile și avansarea scadenței |
| F | Multi-valută, import CSV/PDF ING, backup, widget, build release APK | APK autonom generat; export backup verificat; instalarea/restaurarea, PDF-ul real și widgetul rămân de validat/finalizat |

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

Modulele locale de captare și PDF necesită un build Android propriu (development sau release); Expo Go nu le include. După modificări native trebuie reconstruită aplicația. Directoarele native generate nu se editează manual.

Datele inițiale se creează la prima inițializare. Migrările ulterioare trebuie să păstreze datele existente. **Nu șterge datele aplicației de pe telefon pentru a testa o migrare.** Testarea unui reset se face numai pe un emulator de test, cu acord explicit și după backup dacă datele trebuie păstrate.

## Ce conține aplicația acum

- **Acasă:** sold total, rezumatul lunii, comparație cu luna trecută, conturi cu sold real, ultimele tranzacții și estimarea obligațiilor; un banner semnalează accesul revocat sau lipsa notificărilor bancare, cu prag configurabil în Setări (3/7/14/30 zile).
- **Setări (Mai mult → Setări):** temă Sistem / Deschis / Întunecat și limbă Română / English, persistente; blocare opțională cu biometrie sau codul telefonului la pornire și după un timeout de 0, 1, 5 sau 15 minute în fundal. Dezactivată implicit. Paleta aleasă este albastru ocean + turcoaz; culorile deja personalizate pentru conturi/categorii nu sunt modificate.
- **Tranzacții:** lună cu săgetăi, rezumat, căutare (comerciant, categorie, etichetă, notă), filtre pe tip, grupare pe zile cu total pe zi; atingere = editare. La filtrul Cheltuieli este disponibil și importul CSV ING, cu previzualizare și selectarea contului.
- **Adaugare/editare (butonul +):** Cheltuială / Venit / Transfer, sumă cu calculator (+ − × ÷), categorie (grupuri cu iconițe), cont, comerciant (creat din căutare; completează categoria implicită), dată și oră, etichete (create din selector), notă.
- **Transfer:** între conturi (retragere ATM = ING → Numerar); nu intră în cheltuieli.
- **Tranzacții fără cont și repartizări:** codul permite tranzacții nealocate unui cont și împărțirea sumei între categorii. Aceste fluxuri și migrările v6/v7 trebuie verificate pe dispozitiv.
- **Mai mult:** Conturi (sold inițial, monedă, IBAN opțional pentru recunoașterea transferurilor între conturile proprii, culoare, icoană, arhivare), Categorii și grupuri, Comercianți, Etichete, Notificări captate (istoric cu stare deschisă/rezolvată/ignorată și acces la tranzacția legată), Recurente.
- **Recurente:** obligații lunare/anuale cu interval, sumă estimată, cont, comerciant, categorie și următoarea scadență; tranzacțiile compatibile se asociază automat, iar următoarea scadență avansează. Vederea lunară Recurente reunește obligațiile recurente și scadențele importate din PDF, cu total separat pe monedă. Estimarea de pe Acasă/Recurente adună obligațiile scadente luna viitoare și media cheltuielilor variabile din ultimele 3 luni complete (separat pe monedă).
- **Statistici:** distribuție pe grupuri/categorii, trend, top comercianți, intervale predefinite/personalizate și plăți recurente.
- **Investiții Revolut:** activele deținute se adaugă manual (nume și simbol); mișcările explicite de creștere/scădere găsite în notificările Revolut sunt evidențiate în aplicație, iar aceste notificări nu sunt importate accidental ca cheltuieli. Nu se preiau cotații externe și nu se oferă recomandări de investiții.
- **Bugete:** limite lunare pe categorie/grup, rollover și notificări la 80%/100%.
- **Date și backup:** cursuri valutare manuale datate, import CSV ING cu deduplicare, export/restaurare JSON cu validare și confirmare. Formatul CSV actual Home’Bank trebuie confirmat pe un export real.
- **Scadențare salvate (Date și backup):** detaliile următoarelor șase rate (dobândă, principal și asigurare), activarea/dezactivarea reminderelor și ștergerea cu confirmare. Erorile de salvare și de reprogramare a reminderelor sunt afișate separat; verificarea pe telefon rămâne necesară.
- **Istoric notificări:** triere separată de parsare, acces la tranzacția legată; în cod există și refresh prin gest și indicator pentru notificările deschise, de verificat pe telefon.
- Categoriile „Retrageri cash” din Oinkoin sunt înlocuite aici de transferul către contul Numerar.

## Cum funcționează captarea

1. Serviciul Kotlin `CashioNotificationListenerService` primește notificările și le păstrează doar pe cele din pachetele permise.
2. Le scrie într-o coadă SQLite proprie (`notification_inbox.db`), ca să nu se piardă când aplicația e închisă.
3. La pornire și la revenirea în prim-plan, JS mută coada în tabela `raw_notifications` și o golește.
4. Pachetele permise sunt în `src/features/capture/domain/sources.ts`. Numele pachetelor ING/Revolut sunt presupuneri, de verificat pe notificări reale. Salt Bank lipsește încă.
5. Doar în build-uri de dezvoltare se acceptă și `com.android.shell`, ca să se poată simula notificări cu `adb`.
6. Procesarea sugerează categorii pentru ridesharing, livrări de mâncare și supermarketuri. IBAN-urile conturilor bancare proprii pot lega notificările de transfer către/de la un alt cont configurat; direcția neclară sau IBAN-urile ambigue nu sunt ghicite.

Baza de date: schema stă în `src/core/db/schema.ts`, iar migrările (doar de adăugat, niciodată editate) în `src/core/db/migrations.ts`. Versiunea e urmărită prin `PRAGMA user_version`. Orice schimbare de schemă se face în ambele fișiere. Sumele se stochează ca întregi, în bani (`amount_minor`).

Migrarea 3 adaugă `review_status` la notificările istorice, separat de `processed_at`: faptul că parserul a verificat notificarea nu înseamnă că utilizatorul a rezolvat lead-ul.

Migrarea 4 adaugă suma variabilă la recurente; v5 adaugă `loan_schedules`; v6 reconstruiește tranzacțiile pentru cont opțional; v7 adaugă `transaction_allocations`; v8 adaugă IBAN-ul opțional la `accounts`; v9 adaugă indexul pentru căutarea notificărilor pe sursă și dată. Înainte de release, verifică actualizarea unei baze existente și restaurarea backupurilor acceptate de cod.

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

### Utilizare pe telefon fără laptop (APK autonom)

Development build-ul instalat pentru programare depinde de Metro. Pentru utilizare
zilnică fără laptop se folosește un APK release, cu JavaScript inclus în instalare.
Proiectul EAS asociat este `@cristianatomeis-team/cashio`; profilul `preview` din
`eas.json` genereaza un APK, nu un development client.

Din folderul proiectului, dupa activarea Node 22:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest build --platform android --profile preview
```

Descarca APK-ul din linkul build-ului si instaleaza-l pe telefon. Inainte de
inlocuirea versiunii existente, exporta un backup din Date si backup. Actualizarea
peste aplicatia existenta necesita acelasi identificator Android si aceeasi cheie
de semnare. Daca Android refuza instalarea din cauza semnaturii, nu dezinstala
aplicatia si nu sterge datele; verifica intai backup-ul si calea de migrare.

Dupa instalare, verifica pornirea cu Metro oprit si telefonul deconectat de la PC.
Modificarile ulterioare ale aplicatiei necesita generarea si instalarea unui APK
nou; nu se mai aplica prin Fast Refresh.

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

### Task-uri VS Code salvate pentru acest PC

În [.vscode/tasks.json](.vscode/tasks.json), prin **Terminal → Run Task**:

- **Cashio: Metro pentru telefon USB** pornește Metro pe 8082 cu Node 22.
- **Cashio: reparare development build USB** compilează debug pentru `arm64-v8a`
  cu Java 17 din Android Studio și instalează prin `adb -d install -r`, fără
  dezinstalare. Necesită proiectul `android` generat, dependențele instalate și un
  singur telefon USB autorizat. Nu produce APK-ul autonom EAS.

După schimbări de module/configurație, regenerează întâi proiectul nativ cu
`npx.cmd expo prebuild --platform android --no-install`. Calea Java din task este
specifică acestui PC: `C:\Program Files\Android\Android Studio\jbr`.

Pentru legătura USB, după pornirea Metro și conectarea telefonului:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb -d reverse tcp:8082 tcp:8082
& $adb -d shell am start -a android.intent.action.VIEW -d "exp+cashio://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082" com.cashio.app
```

Această variantă este pentru dezvoltare/recuperare. Pentru utilizare zilnică
fără laptop se instalează APK-ul autonom, nu se pornește Metro.

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
| `Cannot find native module 'ExpoPushTokenManager'`, urmat de avertismente despre exporturile rutelor | Development build instalat înainte de adăugarea modulului nativ de notificări | Salvează datele, apoi reconstruiește development build-ul cu modulele actuale; repornirea Metro nu adaugă module native. Nu dezinstala aplicația pentru această eroare. |

## Sesiunea de testare pe telefon — 07.10.2026

- Telefon: Samsung Galaxy S25 FE (`SM_S731B`). ADB a început să-l vadă după activarea USB debugging și dezactivarea temporară a blocării Auto Blocker; driverul Samsung Composite Device era vizibil în Windows.
- Build-ul Android a reușit și aplicația s-a instalat pe telefon. A fost nevoie de Java 17 din Android Studio; Metro a pornit pe portul 8082, deoarece 8081 era ocupat.
- Este un development build: Metro trebuie să rămână pornit pentru a încărca/reîncărca JavaScript. Telefonul și laptopul trebuie să fie în aceeași rețea Wi-Fi după scoaterea cablului. Captura nativă pune notificările în coada locală, iar Cashio le preia când aplicația revine în prim-plan.
- Accesul la notificări este activ. O notificare ING reală pentru un top-up Revolut de 60 RON a ajuns în istoricul Cashio. Parserul a interpretat inițial `Revolut**...` ca comerciant necunoscut/cheltuială; tranzacția a fost corectată manual în transfer ING → Revolut. Soldurile au afișat ING −60 RON și Revolut +60 RON; soldul total a rămas neschimbat. Soldurile inițiale sunt zero până la configurarea lor.
- De îmbunătățit: recunoașterea automată a top-up-urilor/transferurilor către Revolut. Notificările afișate doar în inboxul intern ING nu pot fi captate de Android; sunt accesibile numai notificările publicate în sistem.
- Pentru capturile trimise la depanare, maschează numerele de cont/card și soldurile.

## Pașii următori

Începe cu [punctul de reluare actual](#punct-de-reluare--19102026), apoi cu [PLAN.md](PLAN.md) pentru criteriile funcționale.

1. Confirmarea instalării APK-ului autonom, păstrarea/restaurarea datelor și pornirea fără laptop/Metro. Backup-ul este valid, dar restaurarea pe release nu este încă verificată.
2. Testarea celor două PDF-uri ING reale și a administrării scadențarelor din PR #1: detalii, remindere, ștergere/anularea notificărilor și recuperare după erori.
3. Integrarea scadențarelor în obligații/estimări și clarificarea calendarului telefonului.
4. Verificări reale pentru captare/top-up, recurente, bugete, repartizări, CSV, backup/restaurare și paletă.
5. Widget Android și polish. Pentru fiecare versiune nouă, build APK după integrarea schimbărilor; nu confunda generarea reușită cu validarea pe telefon.
