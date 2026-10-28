# Cashio

Aplicație mobilă (Expo / React Native, Android-first) pentru urmărirea cheltuielilor. Ideea: cheltuielile se captează automat din notificările băncilor (ING, Revolut, Salt Bank), fără introducere manuală și fără abonament. Datele rămân local, în SQLite.

## Progres și punct de reluare — 28.10.2026

Aceasta este situația curentă; secțiunile din 19.10 de mai jos sunt istorice. Actualizăm acest jurnal la integrarea fiecărui task. „Integrat” înseamnă cod în `master`, nu funcționare confirmată pe telefon. Tichetele se închid după integrarea implementării; verificarea nativă rămâne urmărită separat în #3.

| Funcționalitate | Stare | Referință |
| --- | --- | --- |
| Backup JSON zilnic/săptămânal, retenție 5/10/20 copii, ultima copie și avertisment pe Acasă | Integrat | #6, PR #28 |
| Blocare opțională cu biometrie/codul dispozitivului, timeout și acoperirea interfeței la părăsirea aplicației | Integrat; dezactivată implicit | #7, PR #31 |
| Ghid inițial RO/EN: acces notificări, baterie Samsung, conturi, monedă și limbă; redeschidere din Setări | Integrat | #8, PR #29 |
| Banner pentru acces revocat/lipsă notificări și prag de 3/7/14/30 zile | Integrat | #9, PR #30 |
| Rate individuale în estimări, importuri ING separate și sugestii prudente de asociere a plăților | Integrat parțial; confirmarea persistentă și deduplicarea estimării rămân | #4, PR #27 |

### Limite și verificări rămase

- Backupul automat rulează la deschiderea/revenirea în aplicație, nu la o oră garantată în fundal. Pe Android necesită alegerea unui folder; nu reprezintă sincronizare automată cu Google Drive.
- Blocarea folosește biometria sau codul telefonului, nu un PIN separat Cashio. Necesită APK nou cu modulul nativ inclus.
- Estimarea poate număra dublu istoricul sau o regulă recurentă pentru același credit. Potrivirile de plăți sunt sugestii, nu confirmări persistente; #4 rămâne deschis.
- Combinația celor patru funcții din Sprintul 1 a trecut `npm run typecheck`, `npm run lint` și 37 de suite / 197 de teste înainte de integrare. Aceasta nu este o validare pe dispozitiv sau un export Android nou.
- Următorul pas de livrare: generarea unui APK nou și verificarea upgrade-ului fără pierderi de date, pornirii fără Metro, permisiunilor, biometriei, backupului/restaurării și reminderelor, conform #3.

### Backlog și închiderea tichetelor

- Sprintul 1: implementările #6–#9 sunt integrate și tichetele închise. Validarea pe telefon este urmărită în #3; #10 este duplicatul său.
- Sprintul 2: #11–#14 (triere rapidă, reguli, notificări cu acțiuni, filtre salvate/editare în lot) rămân deschise.
- Sprintul 3: #15 și #17–#19 rămân deschise; integrarea completă a ratelor este urmărită în #4, iar #16 este duplicatul său.
- Sprintul 4: #20–#26 rămân deschise.
- Pentru fiecare task: actualizăm jurnalul cu rezultatul, PR-ul și limitele; închidem ca rezolvat numai după integrare. Duplicatele se închid cu trimitere la tichetul păstrat; lucrările parțiale rămân deschise.

### Lucru pornit în paralel

Șase agenți au primit restul backlogului, în worktree-uri separate. Atribuirea nu înseamnă finalizare; rezultatele vor fi verificate împreună înainte de livrare, inclusiv ordinea migrărilor și compatibilitatea backupurilor.

| Grupă | Tichete |
| --- | --- |
| Planificare financiară: rate, disponibil până la salariu, economii, patrimoniu | #4, #15, #22, #24 |
| Fluxuri tranzacții: triere, reguli, filtre, editare în lot și comercianți | #11, #12, #14, #17 |
| Statistici, sugestii și rapoarte | #18, #21, #23 |
| Notificări cu acțiuni și integrare Android | #13, #20 |
| Accesibilitate și componente comune | #19 |
| Cursuri opționale, teste E2E/migrări și pregătirea validării manuale | #25, #26; checklist pentru #3 |

## Istoric — punct de reluare 19.10.2026

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

### În lucru / PR neintegrat — statistici și rapoarte (#18, #21, #23)

- Ramura `feat/insights-reporting`: segmente donut și legendă accesibilă deschid lista filtrată; cardurile de venituri/cheltuieli/sold au sparklines pe cele șase intervale ale perioadei. Contractul de rutare către Tranzacții (`categoryId`/`groupId`, inclusiv `uncategorized`, `from`/`to` locale inclusive, `type=expense`, `currency` opțional) necesită și PR-ul separat pentru fluxurile de tranzacții; nu este încă integrat în `master`.
- În Statistici, sugestiile sunt locale și numai informative: o plată egală la același comerciant în trei luni consecutive poate sugera abonament; o plată cu peste 5% mai mare decât trei plăți lunare stabile poate semnala prețul; o plată de cel puțin două ori mediana comerciantului din cele trei luni precedente poate semnala cheltuială neobișnuită. Fiecare afișează motivul și ID-urile dovezilor. Nu se creează automat reguli. Monedele nu se amestecă; transferurile, veniturile, ciornele, sumele nepozitive și tranzacțiile viitoare sunt excluse. Rambursările trebuie înregistrate ca venit sau sumă negativă pentru a fi excluse din detecție.
- Raport lunar PDF **și** CSV, cu selecția lunii și comparație față de aceeași lună din anul anterior. Zero/fără istoric nu produce un procent inventat; luna în curs este marcată incompletă. RON folosește conversiile deja salvate; sumele fără curs rămân vizibile în export, dar sunt excluse explicit din totaluri. Alte monede includ numai tranzacțiile în moneda selectată. Convenția existentă Cashio pentru sume este în sutimi de unitate monetară.
- Generarea este pe dispozitiv, fără upload automat. Distribuirea se face numai prin aplicația aleasă în foaia sistemului; fișierele cache sunt șterse după închiderea distribuirii. CSV UTF-8 protejează formulele din numele comercianților/categoriilor; HTML-ul PDF escapează datele importate și nu încarcă resurse externe. Notele, conturile și IBAN-urile nu sunt exportate.
- Dependență nouă: `expo-print`, rezolvată prin `expo install` pentru SDK 57; fără migrări sau date persistente noi. Documentația SDK 57 și indexul Expo nu au fost accesibile (DNS); API-urile au fost verificate în tipurile instalate efectiv. Este necesar un **build nativ nou**, apoi validare Android/iOS a atingerilor, scalării textului, PDF-ului multipagină/diacriticelor, CSV-ului, anulării și erorilor de distribuire. Exportul în browser afișează explicit că nu este suportat. Testele unitare nu substituie aceste verificări pe telefon.

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
                           add-transaction (formular, și editare cu ?id=), captured, recurring, budgets, data, settings, onboarding,
                           manage/ (accounts, categories, merchants, tags)
  core/
    db/                    schema.ts (Drizzle), migrations.ts, defaults.ts + seed.ts (date inițiale), index.ts (useDb)
    domain/                tipuri comune (transaction.ts)
    i18n/                  ro/en (locales/), inițializare i18next
    ui/                    theme/ (paletă, tokeni, ThemeProvider), components/ (AppText, Card, Screen, Button, SheetModal, ...)
    utils/                 money.ts, dates.ts, calculator.ts (+ teste)
  features/                fiecare modul: domain/ (TypeScript pur), data/ (repository-uri, interogări live), ui/, index.ts
    accounts/  categories/  merchants/  tags/  transactions/  capture/  onboarding/  recurring/
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
- **La prima pornire:** ghid RO/EN pentru accesul la notificări, optimizarea bateriei Samsung, conturile active, moneda de bază și limbă; configurarea se poate relua din Setări și este salvată local.
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
- **Date și backup:** cursuri valutare manuale datate, import CSV ING cu deduplicare, export/restaurare JSON cu validare și confirmare, plus backup automat zilnic/săptămânal la deschiderea aplicației. Frecvența și retenția se configurează în Setări; destinația poate fi aleasă prin SAF pe Android, iar pe iOS se folosește folderul Documents al aplicației. Date și backup afișează data ultimului backup, iar Acasă avertizează dacă acesta lipsește sau are peste 14 zile. Formatul CSV actual Home’Bank trebuie confirmat pe un export real.
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

## Cursuri opționale și verificări automate — propuse, neintegrate

Implementarea din `feat/rates-quality` este în așteptarea revizuirii/integrării; această secțiune nu certifică un APK instalat.

### Cursuri publice (#25)

Setări → Cursuri publice opționale este **dezactivat implicit**. Activarea salvează acordul; numai apăsarea „Actualizează” face o cerere. Nu există polling, cereri la pornire sau serviciu obligatoriu. Dezactivarea oprește cererile viitoare, nu șterge istoricul. Introducerea manuală datată din Date și backup rămâne disponibilă offline.

- Cererea este fixă pentru toți utilizatorii: `https://api.frankfurter.dev/v2/rates?base=EUR&quotes=RON,USD,GBP&providers=ECB`. Nu trimite conturi, sume, tranzacții, monede selectate de utilizator sau identificatori; furnizorul vede în mod normal IP-ul și metadatele HTTP. Fără chei API sau secrete CI.
- Sursa este Frankfurter v2, filtrată explicit la BCE, **nu** amestecul implicit de furnizori. Schema verificată este un array de `{ date, base, quote, rate }`. Conversia în RON/EUR/USD/GBP se calculează local; alte monede de bază produc o eroare fără cerere.
- Se păstrează data publicării, sursa `frankfurter:ECB:MONEDA_DE_BAZĂ` și toate cursurile existente. Conflictele nu suprascriu cursuri manuale. Un curs manual are prioritate pentru aceeași dată calendaristică (manual: ziua locală existentă; public: ziua publicată UTC); cursurile automate pentru altă monedă de bază nu se reutilizează. Conversiile salvate în tranzacții nu se rescriu retroactiv.
- Cursurile BCE sunt orientative, nu cotații de execuție. Data efectivă automată este sfârșitul zilei publicate UTC (conservator, fără utilizare înaintea publicării). Interfața arată data/sursa, lipsa cursurilor, erorile și vechimea peste patru zile, inclusiv în weekend. Eșecurile păstrează datele locale.
- Contract/sursă/licență verificate online în repo-ul oficial Frankfurter, commit `3607db718b2a7c228c40d5d590b7bf5e95c3c462`: [OpenAPI v2](https://github.com/lineofflight/frankfurter/blob/3607db718b2a7c228c40d5d590b7bf5e95c3c462/lib/public/v2/openapi.json), [metadate BCE și adresa termenilor](https://github.com/lineofflight/frankfurter/blob/3607db718b2a7c228c40d5d590b7bf5e95c3c462/db/seeds/providers/ecb.json), [licență software MIT](https://github.com/lineofflight/frankfurter/blob/3607db718b2a7c228c40d5d590b7bf5e95c3c462/LICENSE). Licența software nu înlocuiește termenii datelor BCE: [aviz juridic BCE](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html).
- **Rămas înainte de release:** recuperarea/revizuirea directă a textului juridic BCE și un smoke test al endpointului live. În acest mediu domeniile Expo/Frankfurter/BCE nu se rezolvă DNS; contractul și licența software au fost citite prin API-ul GitHub, nu s-a pretins verificarea răspunsului live sau a textului juridic BCE. Documentația oficială Expo SDK57 SQLite/Constants/config a fost citită din mirror-ul oficial `expo/expo/docs/pages/versions/v57.0.0`.

Nu se adaugă migrări sau dependențe. `exchange_rates` și `app_settings` existente sunt incluse deja în backup/restaurare.

### SQLite real și Maestro (#26)

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:migrations
```

`test:migrations` necesită Node **22.13+** cu `node:sqlite` (rulat aici cu Node 26.12.1). Execută funcția de migrare de producție și SQL-ul nemodificat într-un SQLite real, în memorie, numai cu date sintetice. Acoperă instalare nouă și fiecare versiune anterioară v1–v9 → versiunea curentă, valorile/legăturile existente, backfill-ul repartizărilor v7, `foreign_key_check`, `integrity_check`, cascade, idempotență și rollback-ul reconstruirii v6. Pentru v1 se testează păstrarea notificărilor: tabelele financiare originale **niciodată populate de aplicație** sunt reconstruite intenționat de v2; nu se promite păstrarea unor date financiare v1 arbitrare. Intrările istorice de migrare nu sunt editate.

Testele suplimentare SQLite verifică salvarea FX, conflictele manuale, eșecurile offline și schimbarea acordului/monedei în timpul cererii. Nu reprezintă execuție pe `expo-sqlite` Android; după integrarea oricăror migrări noi, rerulați pe ordinea finală și completați fixture-urile noilor tabele.

Maestro este local, fără cont cloud, token sau serviciu obligatoriu:

1. Folosește **numai un emulator Android de test**, fără date private. Instalează Android SDK/emulator, Java 17+ și Maestro CLI din documentația oficială.
2. Construiește varianta separată: `npx eas-cli@latest build --platform android --profile e2e`. Pentru build local cu SDK disponibil: `CASHIO_E2E=1 npx expo run:android --variant release`. Nu folosi Expo Go.
3. Confirmă că APK-ul este **Cashio Synthetic E2E**, ID **`com.cashio.app.e2e`**, apoi instalează-l pe emulator. Configul de producție rămâne `com.cashio.app`. Varianta de test are și baza separată `cashio.e2e.synthetic.db`, activată numai dacă ambele marcaje de config coincid.
4. Rulează `npm run test:e2e`. Setup-ul șterge **exclusiv starea aplicației sintetice** și parcurge onboarding-ul în engleză. Nu modifica `appId` în flow-uri și nu rula `clearState`, `pm clear` sau dezinstalare pentru aplicația utilizatorului.

Flow-urile acoperă onboarding fără acord nativ, cheltuială creare/restart/editare/ștergere, transfer/restart, acord FX pornit/oprit fără accesarea rețelei, navigare în inbox/capturi și salvarea/persistența unui curs manual datat. Nu automatizează PDFBox, permisiuni native, picker-ul de backup sau livrarea reminderelor.

**Dovezi locale pe această ramură:** 38 suite Jest / 213 teste trecute; 17 teste Node/SQLite și siguranță E2E trecute (inclusiv backup FX și prioritate manuală cu fus orar); lint/typecheck și exportul JavaScript Android trecute; `expo config --type public` confirmă ID-urile distincte cu/fără `CASHIO_E2E=1`. **Maestro nu a rulat**: `npm run test:e2e` returnează `maestro: not found`; `adb`, emulatorul și Android SDK nu sunt disponibile. Flow-urile sunt pregătite, dar acceptarea E2E rămâne în așteptare. Nu marca #26 finalizat până la rulare.

### Checklist de validare Android fizică (#3 — deschis, fără dovezi noi)

Toate punctele de mai jos sunt **în așteptare**. Testele unitare/SQLite, validarea configului și un build EAS nu sunt dovezi de instalare sau teste fizice.

- [ ] Înregistrează commitul, EAS build ID, versiunea APK/versionCode, modelul telefonului și versiunea Android. Nu include identificatori ai dispozitivului sau date financiare.
- [ ] Păstrează un backup local verificat înainte de upgrade. Notează instalarea/versiunea anterioară. Nu șterge datele și nu dezinstala aplicația utilizatorului pentru a „repara” migrarea.
- [ ] Instalează APK-ul standalone și pornește-l cu Metro/laptopul oprite și fără Wi-Fi. Verifică onboarding-ul pentru instalare nouă, apoi navigarea Acasă/Tranzacții/Mai mult și repornirea procesului.
- [ ] Fă upgrade **peste** instalarea existentă, fără reset. Compară local conturi, solduri, tranzacții/repartizări/etichete, cursuri datate, scadențare, preferințe și permisiuni. În GitHub publică numai „păstrat/eroare”, nu valori sau fișiere private.
- [ ] Importă local scadențare ING reprezentative (NP/ipotecar, rate variabile și asigurare). Compară **fiecare** dată, sumă și componentă cu PDF-ul; verifică preview, salvare, editare și restart. Nu încărca PDF-uri/extracții în repo sau loguri.
- [ ] Testează permisiune notificări refuzată/acordată/revocată; programarea, anularea și editarea reminderelor, scadențe apropiate/expirate, mai multe credite și limita de 50. Verifică livrarea cu aplicația oprită și după repornirea telefonului.
- [ ] Verifică restaurarea backupului și reconstruirea reminderelor **întâi într-o instalare sintetică separată**. Confirmă anularea reminderelor vechi și lipsa duplicatelor, nu doar mesajul de succes.
- [ ] Confirmă captarea notificărilor sintetice, draft → confirmare, transfer ING → Revolut fără cheltuială falsă; verifică fluxurile zilnice și funcționarea offline.
- [ ] Verifică FX dezactivat fără cereri, acord explicit, eroare offline, dată/sursă/vechime, prioritate manuală și păstrarea cursurilor după restart/upgrade.
- [ ] Adaugă rezultatele și defectele rămase în tichetul #3 folosind formatul: `build/commit | model + Android | scenariu | așteptat | observat | PASS/FAIL/BLOCAT | dovadă redactată`. Închide #3 numai după dovezi reale și remedierea/documentarea criteriilor rămase.
