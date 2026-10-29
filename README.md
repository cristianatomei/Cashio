# Cashio

## Pregătire APK — 29.10.2026

Această secțiune înlocuiește stările istorice de integrare de mai jos. Codul pentru bonuri
(#41), calendarul telefonului (#43), planificare, statistici și widget este deja integrat în
`master`. Implementările noi pentru #4 și #42 sunt pregătite în ramura curentă; un APK
nou instalat și verificat pe telefon nu este încă confirmat.

- **Abonamente (#42):** în Statistici, plățile justificative pot fi deschise și sugestia poate
  precompleta un formular revizuibil. Numai confirmarea utilizatorului salvează obligația;
  istoricul nu este modificat. Regulile existente, inclusiv cele suspendate, nu sunt dublate.
  Ignorarea este persistentă și reversibilă. Recurente și Statistici afișează echivalente
  lunare/anuale ale cheltuielilor recurente active, separat pe monedă, nu un calendar de plăți.
  Starea de verificare este locală, în `app_settings.subscription_reviews`, și inclusă în backup.
- **Rate (#4):** în Date și backup, o plată sugerată poate fi asociată explicit unei singure
  scadențe sau disociată. Asocierea nu se deduce din text sau din sume asemănătoare.
  Estimarea păstrează ratele individuale și asigurarea, scade plata confirmată și păstrează
  diferențele neacoperite; regulile recurente legate și istoricul confirmat nu dublează ratele.
  Migrarea v13 adaugă `loan_payment_links`, cu unicitate pe tranzacție și pe scadență.
  Backupul v5 păstrează asocierile și bonurile; formatele v1–v4 rămân acceptate fără asocieri.
  Exportul manual în calendar elimină ratele stinse și păstrează sumele parțial neachitate.
- **Verificări automate:** lint, typecheck, 70 suite Jest / 585 teste și 32 verificări
  SQLite/migrări/siguranță E2E trec pe combinația finală. Exportul JavaScript Android de
  producție trece, dar nu compilează modulele native și nu generează un APK.
- **Validare nativă (#3, #26):** testele SQLite nu înlocuiesc instalarea/upgrade-ul pe telefon
  sau execuția Maestro. Mediul sesiunii nu are Android SDK, adb, emulator ori Maestro și nu
  are acces la un dispozitiv. Nu rula fluxurile distructive pe aplicația personală: profilul
  `e2e` folosește exclusiv `com.cashio.app.e2e` și date sintetice.
- **Blocaj APK:** EAS CLI este disponibil, dar `whoami` raportează lipsa autentificării;
  `EXPO_TOKEN` nu este configurat. Încercarea de build `preview --non-interactive` este
  refuzată fără cont Expo. În plus, `api.expo.dev` nu se rezolvă DNS în acest mediu.
  Nu a fost generat un build ID sau un APK nou.

Dintr-un terminal autentificat Expo, cu acces la internet și sursa actualizată:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Profilul `preview` produce un APK autonom, fără Metro. Refolosește semnătura EAS existentă
pentru `com.cashio.app`; nu genera altă cheie și nu dezinstala aplicația pentru a forța
upgrade-ul. Creează întâi un backup complet, apoi verifică instalarea peste versiunea
existentă, datele păstrate și checklistul nativ de la finalul acestui document.

## Pending merge: capture actions and Android productivity (#13, #20)

This branch implements optional captured-payment notifications (off by default), frequent-category
actions and Open, plus a native Android widget, launcher shortcut and Quick Settings tile.
These changes are **pending merge**, not part of an integrated/released APK.

- Enable notifications in Settings. Permission denial and delivery/action failures are explicit.
  At most five capture alerts per local day are delivered, only when scheduled + presented
  notifications remain below 50; existing loan/reminder limits and schedules are untouched.
  Notification content never includes payment amounts or merchants. App lock hides category
  buttons; authenticated foreground actions re-check records and never silently confirm drafts.
- Capture is processed when Cashio runs/returns to foreground, not continuously in a killed JS
  process. Category actions intentionally foreground the app for reliable cross-platform handling;
  no unsupported headless/background-response guarantee is made.
- Android: add the widget through the launcher, long-press the app icon for Add transaction,
  or add Cashio's tile from Quick Settings editing. All shortcuts target `cashio:///add-transaction`
  through Expo Router and the existing app-lock overlay.
  Disposable `.e2e` application IDs use `cashio-e2e` instead, with an explicit launch component
  resolved from the current application ID so test shortcuts cannot launch the production app.
- The widget shows this local month's **confirmed income minus expenses, separately by currency**,
  not account balances or a misleading mixed-currency total. Drafts/transfers are excluded.
  It refreshes after database changes, foregrounding and while the app runs; an expired month
  shows “Open Cashio to refresh” until a fresh snapshot is available. App lock redacts and clears
  the private native snapshot even while unlocked. Native chrome follows the Android language
  (RO/EN), while the formatted snapshot follows the app language.
- No dependencies or schema migrations added. Preferences/counters/error state use existing
  `app_settings` and existing backup/restore handling; the private widget cache is regenerated.
  The local Kotlin module is autolinked like the notification-listener module; no generated
  `android/` or `ios/` files are edited. `expo-widgets` SDK 57 is officially iOS-only and is not used.
- SDK 57 official docs were verified through the Expo GitHub docs mirror when docs.expo.dev
  DNS was unavailable (`docs/pages/versions/v57.0.0/sdk/{notifications,widgets,sqlite}.mdx`).
  A new Android development/release build is required; Expo Go cannot load this native module.
  **Issue #3 native validation remains open**: Android compilation, widget placement/resize,
  shortcut/tile cold starts, notification permissions/actions, app-lock privacy, reboot/month
  rollover and physical-device behavior must be checked before release. No native success is claimed.

Aplicație mobilă (Expo / React Native, Android-first) pentru urmărirea cheltuielilor. Ideea: cheltuielile se captează automat din notificările băncilor (ING, Revolut, Salt Bank), fără introducere manuală și fără abonament. Datele rămân local, în SQLite.

## Audit accesibilitate #19 — propunere din 28.10.2026

**Stare: implementare pregătită pentru review, nu integrată în `master` și nu livrată în APK-ul existent.** Nu închide automat issue-ul: verificările native de mai jos rămân necesare. Nu adaugă dependențe, migrări sau preferințe noi și nu schimbă culorile personalizate salvate.

- **Ținte reale, nu doar `hitSlop`:** Chip 36→48dp, segmente 38→48dp, culori și clopoțel 40→48dp, închidere modal 24→48dp. Butoanele, rândurile interactive, navigarea lunară și noile `SwitchRow` au minimum 48dp; grila de icoane păstrează țintele existente ≥48dp. Switch-ul are un singur element accesibil, cu etichetă, stare și callback pe întregul rând.
- **Contrast:** textul semantic (inclusiv caption, placeholder, venit, cheltuială și avertizare) este testat la ≥4,5:1 pe fundal, card, suprafață elevată, `primarySoft` și tab bar. `controlBorder` asigură ≥3:1 fără a recolora separatoarele/graficele existente. Feedback-ul de apăsare nu mai reduce contrastul prin opacitate; controalele dezactivate sunt exceptate de WCAG. Bifele culorilor aleg alb/negru, iar icoanele personalizate păstrează nuanța când este lizibilă, altfel folosesc textul temei; culoarea salvată și nuanța fundalului rămân neschimbate.

| Măsurătoare WCAG, raport minim | Deschisă | Închisă |
|---|---:|---:|
| Text semantic pe cele cinci suprafețe | 4,69:1 | 5,05:1 |
| Contur interactiv pe aceleași suprafețe | 3,03:1 | 3,24:1 |
| Text buton primar / pericol | 6,77 / 5,44:1 | 6,97 / 6,39:1 |

Anterior, pe alb, textul estompat avea 3,15:1, venitul 2,93:1, cheltuiala 3,47:1 și avertizarea 2,15:1. Testele folosesc luminanța relativă sRGB WCAG și compunerea alfa exactă `0x26/255` pentru nuanțele transparente; culorile de grafic și orice text colorat arbitrar din afara componentelor comune nu primesc o certificare globală.

- **Cititoare de ecran RO/EN:** roluri și stări pentru butoane, selecții și preferințe; etichete vorbite pentru fiecare culoare/icoană oferită, operatorii calculatorului și lunile precedentă/următoare; acțiune accesibilă de golire a sumei fără apăsare lungă; progres numeric, inclusiv depășirea 100%. Butonul în încărcare își păstrează numele și anunță starea ocupat/dezactivat. Icoanele decorative nu înlocuiesc descrierea rândului; sumele finale rămân în arborele accesibil.
- **Scalare font:** AppText/TextField respectă implicit sistemul și păstrează opțiunile explicite ale apelantului, inclusiv `maxFontSizeMultiplier`. Nu micșorează textul pentru a-l înghesui. Rândurile, segmentele și categoriile se pot rearanja, butoanele/câmpurile/calculatorul au înălțime minimă, nu fixă pentru text. Etichetele tab-urilor se pot împărți pe linii, iar bara crește după înălțimea măsurată; scalarea este explicit activată inclusiv pe iOS.
- **Verificare automată:** 44 de regresii noi în `src/core/ui/components/accessibility.test.tsx` și `theme/contrast.test.ts` verifică stilurile/props, stările, callback-urile și matricea de contrast în ambele teme. Acestea nu măsoară layout-ul nativ. Au trecut `npm run typecheck`, `npm run lint` (fără avertismente) și `npm test -- --runInBand` — total 39 de suite / 241 de teste.
- **Documentație SDK:** `expo ~57.0.27`, RN `0.86.3`. Atât `https://docs.expo.dev/versions/v57.0.0/`, cât și `https://docs.expo.dev/llms.txt` au fost inaccesibile prin DNS în acest mediu; API-urile folosite au fost verificate în tipurile/sursa pachetelor instalate, inclusiv comportamentul fonturilor din Expo Router 57.

**De verificat manual înainte de acceptarea #19:** APK nou pe Android/TalkBack și iOS/VoiceOver; font 100/150/200% și maximul sistemului, zoom afișaj, ecran îngust și landscape, ambele teme și limbi. Parcurge toate tab-urile, formularele, selecțiile și modalele cu tastatura deschisă: lipsă suprapuneri/trunchieri, ordine/focus inițial și revenire după modal, anunțarea sumelor/stărilor/progresului, acțiunea de golire, activarea unică a switch-urilor și ținte reale fără suprapunere. Nu au fost disponibile `adb`/emulatorul pentru aceste verificări. Reauditează împreună PR-urile încă neintegrate pentru Home, tranzacții/inbox și statistici; noul switch din `ProductivitySettings` propus separat trebuie trecut la `SwitchRow` la integrare. Testele unitare sau un PR deschis nu confirmă integrarea, instalarea ori conformitatea tuturor ecranelor pe dispozitiv.

## Progres și punct de reluare — 28.10.2026

### Acasă: disponibil până la salariu (#15)

- Data următorului salariu se introduce explicit în Acasă (`AAAA-LL-ZZ`); nu este dedusă din venituri și nu avansează automat. După ziua salariului trebuie actualizată. Fără o dată viitoare validă sau fără conturi, nu se afișează o sumă zilnică.
- Calcul: soldurile conturilor ne-arhivate minus plățile cunoscute din intervalul `[azi, data salariului)`, împărțit la numărul de zile calendaristice (inclusiv azi). Suma zilnică este rotunjită în jos la bani și limitată la zero; deficitul rămâne vizibil separat. Nu se adaugă venituri viitoare și nu se scad din nou cheltuielile istorice.
- Sunt rezervate doar recurentele de cheltuieli și ratele, cu asigurare dacă este activată. Scadențarul înlocuiește regula asociată prin `recurringId`; asocierea explicită unu-la-unu poate fi setată/eliminată din „Verifică duplicatele rate / recurente” în Acasă. Nu se deduce din sume similare și nu modifică reminderele sau estimarea separată din Recurente. Plățile confirmate cu asociere explicită și aceeași zi/monedă reduc obligația restantă; asocierile ambigue și sugestiile bazate pe text nu reduc rezerva.
- Se folosesc cursurile salvate cele mai recente care nu sunt în viitor și conversia existentă în moneda de bază. Lipsa unui curs pentru un cont sau o obligație blochează suma zilnică, nu este tratată ca zero.
- Estimarea nu include restanțe anterioare zilei curente, cheltuieli variabile nesalvate sau duplicate fără asociere explicită. Pentru recurente variabile se folosește suma salvată. Aceste limite sunt afișate și în interfață; verifică Recurente înainte de a te baza pe estimare.
- Ordinea cardurilor este: sold/disponibil, De clasificat, Scadențe, Bugete. Fără o dată a salariului, Scadențe arată următoarele 30 de zile, fără calcul zilnic. Stările goale oferă acces la configurare; încărcarea inițială folosește un skeleton static, cu etichetă accesibilă și culori din tema activă.

### Planificare: obiective și patrimoniu (#22, #24; pregătit în această ramură)

- Mai mult → Planificare conține **Obiective de economisire** și **Patrimoniu net**, cu carduri pe Acasă și texte RO/EN.
- Obiectivele au nume, valută, țintă și sumă economisită actualizată manual. Progresul se oprește la 100%, dar suma poate depăși ținta. Nu se creează tranzacții și nu se adună din nou economiile la patrimoniu.
- Patrimoniul include soldurile tuturor conturilor (inclusiv arhivate), mișcări confirmate până acum, evaluările manuale ale activelor urmărite și principalul estimat al creditelor. Trackerul Revolut existent conține simboluri/alerte, nu cantități sau valoarea deținerilor; introdu valoarea totală a fiecărei dețineri, fără dublarea sumelor deja incluse în conturi. Se păstrează o singură evaluare, cea mai recent introdusă, per activ; eliminarea activului din tracker îl exclude din calcul.
- Sunt folosite numai cursuri salvate cu dată cel târziu la evaluare (azi pentru conturi/credite, data evaluării pentru investiții). Cursurile viitoare, valorile lipsă și scadențarele fără sold utilizabil produc poziții necunoscute și un subtotal explicit parțial, nu zero implicit. Sumele rămân vizibile în valuta originală când lipsește conversia.
- Soldul ING este capitalul **după** rată: înaintea următoarei scadențe se folosește soldul anterior sau soldul următor + principalul acelei rate, nu dobânda/asigurarea și nu suma ratelor unui fragment de scadențar. Scadența de azi este considerată încă neachitată. Zero după ultima rată este acceptat numai când apare explicit ca sold; lipsa soldului nu dovedește stingerea creditului. Calculul presupune plăți la termen, nu verifică restanțe/rambursări anticipate.
- Migrarea **v11**, adăugată fără modificarea v1–v10, introduce `savings_goals` și `investment_valuations`. Exportul JSON folosește formatul v3, cu ambele tabele; backupurile în formatele v1/v2 (schemele acceptate v5–v10) rămân acceptate și primesc liste goale pentru datele noi. Nu există sincronizare sau acces la servicii financiare.
- Validare: `npm run lint`, `npm run typecheck`, **49 suite / 344 teste**. Testele folosesc exclusiv date sintetice, SQLite în memorie pentru upgrade, CRUD, export/restaurare și rollback, plus randări RO/EN pentru progres, formulare, stări parțiale și navigarea cardurilor. Este necesară verificarea pe Android/iOS a navigării, tastaturii și cititorului de ecran; nu a fost validat un APK nou.

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

## Fluxuri tranzacții — pregătite pentru integrare, 28.10.2026

Branch-ul `feat/transaction-workflows` implementează #11, #12, #14 și #17; această secțiune nu declară modificările integrate în `master` sau validate pe telefon.

- **De clasificat:** listă virtualizată, număr rămas, swipe dreapta pentru confirmare / stânga pentru ignorare, selecție multiplă, categorie în lot și butoane echivalente gesturilor. Asocierea grupurilor de comercianți necunoscuți rămâne disponibilă; grupurile separă tipul și moneda. Confirmarea refuză datele incomplete.
- **Undo real:** operațiile sunt tranzacționale. Anularea reface rândurile, etichetele, repartizările, starea notificării, scadențele recurente schimbate și legăturile explicite cu ratele (dacă modulul de planificare este prezent). Asocierea reface și aliasul/regula/categoria implicită anterioară. Nu suprascrie modificări apărute ulterior.
- **Tranzacții:** vizualizări numite cu căutare, tip, categorie/grup, cont, etichetă, monedă și perioadă; salvarea păstrează și luna afișată. Selecția lucrează numai pe rezultatele afișate. Editare categorie/cont, adăugare de etichete și ștergere cu snackbar Undo, fără confirmare modală. Contul nou trebuie să aibă aceeași monedă; repartizările multiple nu sunt înlocuite prin schimbarea categoriei în lot.
- **Învățare:** formularul oferă explicit regula pentru plățile viitoare ale comerciantului, separat pentru venit/cheltuială. Aplicarea în istoric este un al doilea opt-in, exclude repartizările multiple și nu confirmă drafturi. Regula are prioritate în pipeline față de categoria implicită și cuvintele-cheie; administrare în Organizare → Comercianți. Ștergerea regulii nu elimină vechile categorii implicite/aliasuri.
- **Zile și comercianți:** gruparea existentă este reutilizată într-un `SectionList`; totalurile zilnice și rezumatele lunare sunt separate pe monedă, excluzând drafturi și transferuri. Avatarul are inițiale Unicode și culoare deterministă; nu descarcă logo-uri.
- **Persistență:** o singură migrare adăugată după v9 (v10 pe acest branch), cu `merchant_category_rules` și `saved_transaction_filters`. Backup JSON v2 include obligatoriu ambele; citirea v1 păstrează compatibilitatea cu seturile istorice cunoscute, iar restaurarea acceptă schemele 5 până la schema curentă și refuză versiunile viitoare. Migrările adăugate independent de alte branch-uri trebuie ordonate contiguu înainte de release.
- **Limite/verificare:** Undo păstrează o singură acțiune în memoria ecranului; apasă Undo sau Gata înaintea următoarei operații. Plecarea din ecran/restartul finalizează acțiunea, fără istoric Undo persistent. Lint/typecheck și 39 suite / 219 teste Jest seriale trec; includ SQLite real pentru operații, relații, pipeline, upgrade și backup/restore. Gesturile, haptics, cititorul de ecran și randarea pe Android/iOS nu sunt verificate nativ aici. Documentația oficială Expo v57 nu a putut fi accesată (DNS); API-urile folosite au fost confruntate cu declarațiile instalate Expo 57 / RN 0.86.

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

## Bonuri locale / Local receipts (#41)

- În formularul de adăugare/editare: alege o fotografie sau folosește camera, apoi vezi/elimină/înlocuiește bonul. Modificările se aplică numai la **Salvează**; anularea păstrează bonul existent. Un bon per tranzacție, **JPEG/PNG/WebP, maximum 5 MiB** după selecție. HEIC/alte formate trebuie convertite dacă pickerul nu le convertește; nu există OCR.
- Fișierele sunt copiate în directorul privat persistent `documents/receipts`, nu se referă la locația originală din galerie. Migrarea append-only adaugă asocierea unică la ID-ul tranzacției, cu `ON DELETE CASCADE`. Înlocuirea/ștergerea curăță numai fișierele fără referințe. Ștergerea în lot păstrează fișierele cât timp **Undo** este disponibil; **Gata** sau părăsirea ecranului finalizează curățarea. Oprirea procesului ori erorile de ștergere sunt recuperate prin curățarea fișierelor orfane la următoarea pornire.
- Permisiunea camerei este cerută numai la apăsarea fotografierii; pickerul foto de sistem SDK57 nu cere acces general la galerie. Refuzul, selecția întreruptă, importul/salvarea eșuată și bonul lipsă au mesaje RO/EN. După distrugerea activității Android, fotografia trebuie aleasă din nou; nu este atașată automat unei tranzacții potențial diferite.
- **Backup v4** include toate bonurile în JSON/base64, maximum **20 MiB de imagini în total** (aproximativ 26,7 MiB base64), fișierul JSON complet maximum **64 MiB UTF-8**. Aceleași limite se aplică backupurilor manuale și automate. Un bon lipsă/ilizibil ori o limită depășită **oprește backupul**, fără omisiuni; păstrează un backup anterior și micșorează/înlocuiește imaginile înainte de reîncercare. Nu există opțiune de backup doar financiar cu omisiuni ascunse.
- Restaurarea verifică dimensiunile, formatele și legăturile, scrie întâi fișiere noi, apoi înlocuiește atomic baza; eșecul înainte de commit păstrează datele/bonurile vechi. După commit se curăță fișierele vechi. **Formatele v1/v2/v3 rămân acceptate**; nu conțin bonuri, iar restaurarea lor elimină explicit bonurile curente, conform avertismentului. Aplicațiile vechi nu pot importa v4.
- Cashio nu trimite fotografii în rețea și nu adaugă OCR. Backupurile nu sunt criptate; conțin fotografii și pot păstra metadatele originale. Alege o destinație sigură: un furnizor cloud ales din share sheet poate încărca backupul la cererea utilizatorului. Sincronizarea/backupul sistemului de operare nu este controlat de această funcție.

**English limits:** one local receipt per transaction; JPEG/PNG/WebP only, 5 MiB per image, 20 MiB aggregate images, 64 MiB total UTF-8 JSON. All-or-error portable backups, including scheduled backups; older formats restore without receipts after explicit warning. No image upload/OCR, no encryption or metadata stripping. Android activity loss requires reselecting the image. Large images/backups use bounded synchronous file operations and may briefly block the UI.

**Validare nativă încă în așteptare — Android și iOS:** construire nouă cu `expo-image-picker ~57.0.20` și pluginul CNG (nu este suficient un update JS), dialoguri permisiuni/acord/refuz/revocare, cameră indisponibilă, selecție/anulare și formate reale (inclusiv orientare/HEIC), preview pe telefon/tabletă, restart/upgrade fără pierderea asocierii, ștergere/Undo, Android „Don't keep activities”, spațiu insuficient/fișier lipsă, backup manual/automat și restaurare cross-device offline la limite. Testele folosesc exclusiv date sintetice și filesystem simulat + SQLite real; nu certifică aceste scenarii pe dispozitive.

Documentația oficială SDK57 și tipurile instalate au fost citite din sursele `expo/expo/docs/pages/versions/v57.0.0/sdk/{imagepicker,filesystem}.mdx` (DNS `docs.expo.dev` indisponibil). Dependența a fost selectată cu `npx expo install expo-image-picker`, verificată față de harta SDK57 locală; endpointul online de versiuni nu a fost disponibil.

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

## Export opțional în calendarul telefonului (#43)

Setări → Calendarul telefonului explică acordul și permite alegerea explicită a unui calendar
editabil Android/iOS. Nimic nu se cere sau se exportă înainte de opt-in. Apasă
**Sincronizează acum** pentru export; nu există sincronizare automată/background sau apeluri
backend Cashio. Furnizorul calendarului poate sincroniza evenimentele în cloud, iar persoanele
cu acces la un calendar partajat le pot vedea.

- Intervalul este **azi, ora locală 00:00 inclusiv → aceeași zi peste 12 luni exclusiv**;
  29 februarie se limitează la 28 februarie în anul următor. Reexportă periodic și după modificări,
  dezactivări sau ștergeri în Cashio; acestea se reflectă la următoarea sincronizare manuală.
- Sursa este cea existentă pe `master`: `recurringPaymentsInRange` pentru cheltuielile recurente
  active și `loan_schedules.installmentsJson` pentru **fiecare dată și sumă individuală**.
  Încasările recurente nu sunt obligații exportate. Un scadențar legat de o regulă recurentă
  înlocuiește acea regulă în export, fără dublare. Asigurarea respectă opțiunea scadențarului.
  Sumele recurente variabile sunt marcate ca estimări. Nu se folosește ramura draft de forecast.
- Evenimentele sunt individuale, de o zi întreagă, fără recurențe native și fără alarme
  solicitate de Cashio. Titlul generic conține tipul plății și suma/moneda, nu conturi, nume de
  credite/comercianți, solduri, principal/dobândă sau notițe din tranzacții.
- Tagul tehnic din notițe identifică instalarea și obligația. Jurnalul local păstrează ID-urile
  evenimentelor și intervalele înainte de scriere. Reexportul actualizează evenimentele,
  elimină duplicatele etichetate și șterge evenimentele gestionate care nu mai sunt în selecție.
  Un export întrerupt poate fi reluat. Evenimentele personale sau ale altei instalări nu sunt
  adoptate ori șterse. Nu modifica tagul dacă dorești administrarea ulterioară din Cashio.
- **Dezactivează și șterge evenimentele Cashio** oprește exportul înainte de curățare.
  Refuzul/revocarea permisiunii sau indisponibilitatea calendarului lasă jurnalul pentru
  reîncercare, fără pierderea evidenței. După curățare poți alege alt calendar.
  Dacă ai mutat un eveniment în alt calendar sau i-ai eliminat tagul, gestionează-l manual.
  Curăță înainte de dezinstalare/ștergerea datelor aplicației: fără jurnalul local, acea
  instalare nu mai poate gestiona evenimentele vechi.
- Acordul și ID-urile native nu intră în backupuri; restaurarea ignoră astfel de setări
  importate și păstrează jurnalul local existent pentru curățare. Reminderele locale existente
  și programarea lor nu sunt modificate de export.

### Build și verificări native încă necesare

`expo-calendar` **57.0.6** (interval SDK `~57.0.5`, instalat cu `npx expo install expo-calendar`)
necesită **un build nou de dezvoltare/producție**, nu Expo Go și nu doar un update OTA.
Pluginul cere acces complet (citire/scriere, nu doar adăugare) și configurează permisiunile
Android și mesajele iOS RO/EN; nu au fost editate directoare native generate.
Build: `npx eas-cli@latest build --platform android --profile development`, respectiv
`--platform ios --profile development` pentru iOS, cu profilul EAS potrivit dispozitivului.

Documentație oficială SDK57 consultată:
`https://raw.githubusercontent.com/expo/expo/main/docs/pages/versions/v57.0.0/sdk/calendar.mdx`
(domeniul docs.expo.dev nu se rezolvă în acest mediu). API-urile au fost verificate în
tipurile/sursele instalate: `requestCalendarPermissions(false)`, `getCalendars(EVENT)`,
`calendar.listEvents/createEvent`, `ExpoCalendarEvent.get`, `event.update/delete`.
Adaptorul tratează și cazul SDK57 Android „ID inexistent”: returnare nativă `null` urmată de
eroarea specifică `setPrototypeOf` a wrapperului; alte erori nu sunt interpretate ca ștergere.

**Nerulate aici — necesită telefoane fizice și exclusiv date sintetice:**

- [ ] Android și iOS (inclusiv iOS 17+): instalare/upgrade cu modulul nou, interfață RO/EN,
  VoiceOver/TalkBack, font mare, confirmarea și mesajele native localizate.
- [ ] Înainte de opt-in: zero prompturi și evenimente. Refuz/acord/revocare, acces limitat iOS,
  listă fără calendare editabile, calendar read-only sau selectat dispărut: eroare explicită,
  fără fallback către alt calendar.
- [ ] Calendar local și calendar sincronizat (Google/iCloud), calendare cu nume identice:
  alegere corectă, vizibilitate/partajare, nicio atingere a evenimentelor personale.
- [ ] Recurente active/inactive/încasări, scadențar sintetic cu rate variabile și date neregulate,
  asigurare pornită/oprită, limita exactă a intervalului. Compară fiecare dată/sumă.
- [ ] Reexport fără duplicate; modifică sume/date, șterge/dezactivează obligații, schimbă limba,
  repornește aplicația și reexportă. Șterge manual un eveniment, mută altul în afara intervalului,
  întrerupe procesul în timpul exportului și verifică reluarea fără duplicate.
- [ ] Fusuri Europe/Bucharest și America/Los_Angeles, schimbare DST și călătorie între fusuri:
  evenimente de o zi pe scadența corectă. Android folosește UTC pentru all-day, iOS zile locale.
- [ ] Dezactivare și curățare, inclusiv refuz/revocare în timpul operației și reîncercare.
  Verifică păstrarea evenimentelor personale/reminderelor existente și schimbarea destinației
  numai după curățare. Restore pe aceeași instalare păstrează jurnalul; pe alta nu activează exportul.

Testele Jest verifică proiecția, selecția sigură și adaptorul cu API nativ simulat, inclusiv
relansare după eșec și backup/restore. Nu dovedesc livrarea nativă sau sincronizarea furnizorului.
Validare locală pe această ramură: lint/typecheck trecute, **60 suite Jest / 479 teste**
trecute, **17 teste Node/SQLite** trecute; proiecția datelor trece cu
`TZ=Europe/Bucharest` și `TZ=America/Los_Angeles`. `expo config --type introspect` confirmă
mesajele de acces complet iOS și permisiunile READ_CALENDAR/WRITE_CALENDAR Android.

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
