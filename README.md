# Tabellone Baskin

PWA segnapunti per il **Baskin**, installabile e **utilizzabile completamente offline**, pensata per essere ospitata su **GitHub Pages**.

Due schermate:

- **Principale** — pulsanti per tempo, punti (+1/+2/+3), timeout e falli/bonus.
- **Impostazioni** (matita ✏️) — correzioni e nomi delle squadre con i campi a bordo tratteggiato; si conferma con il segno di spunta ✔️.

Tutto il display a 7 segmenti è disegnato in SVG: nessun font o file esterno, quindi funziona davvero offline.

<p align="center">
  <a href="pwa/"><img src="https://img.shields.io/badge/%E2%96%B6%20Apri%20la%20PWA-2962FF?style=for-the-badge&logoColor=white" alt="Apri la PWA"></a>
</p>

<p align="center"><a href="pwa/">▶ Apri l'app (pwa/)</a></p>

> **Indirizzi una volta pubblicato** (GitHub Pages, "Deploy from a branch"):
> - README (questa pagina): `https://<utente>.github.io/<repository>/`
> - App / PWA: `https://<utente>.github.io/<repository>/pwa/`
>
> Il bottone qui sopra apre l'app **sul sito pubblicato**. Se invece stai leggendo questo README su github.com, il link mostra la cartella dei file (è normale). Il codice dell'app è in **[`pwa/`](pwa/)**.
>
> Perché il README faccia da homepage, **non** aggiungere il file `.nojekyll`.

---

## Funzioni

**Schermata principale (modalità operativa)**
- ▶️ avvia il tempo e diventa ⏸️; premendo ⏸️ il cronometro si ferma e torna ▶️ (anche con la barra spaziatrice).
- A **fine tempo** (dopo la sirena automatica), accanto al play compare il pulsante **⏭ Periodo successivo**: con conferma avanza di un periodo (dopo il 4° parte `1TS`, `2TS`…) e riporta il cronometro al tempo pieno. Alla fine del **4° quarto** e di ogni **supplementare** viene proposto **solo in caso di parità** (altrimenti la partita è finita).
- ✏️ (matita) entra in modalità impostazioni/correzioni; `…` mostra la **versione** con il tasto **Verifica aggiornamenti**.
- `+1` `+2` `+3` a sinistra aumentano il punteggio della **Squadra 1**, a destra quello della **Squadra 2**.
- Tap sulla **pillola timeout**: accende un pallino in più; quando sono tutti accesi, il tocco successivo li azzera. Le due squadre sono indipendenti.
- I falli hanno i tasti `+` (operativa) e `−` (impostazioni) **solo se attivi** dal selettore *Conteggio falli* nel menu `…`. Di **default sono spenti**: restano solo l'etichetta "Falli" e le frecce del bonus (automatico a tempo).
- In basso a destra: **sirena** 📣 e **fischietto**, che riproducono i rispettivi suoni.

**Schermata impostazioni / correzioni** (matita)
- Il tasto **play/pause** resta visibile ma è **bloccato**: entrando in impostazioni il cronometro si ferma.
- Il tasto **✔️ (check)** salva le modifiche e torna alla modalità operativa.
- Tocca il **tempo** (riquadro tratteggiato) per aprire i **rotori** minuti / secondi / decimi.
- Tocca il **periodo** (riquadro tratteggiato) per aprire il **rotore** di selezione: `1` … `4`, poi `1TS` … `9TS` (tempi supplementari).
- Tocca la **squadra 1** o la **squadra 2** (riquadri tratteggiati): compare la tastiera per modificare il **nome**. Sotto al nome, una riga di **colori** (bianco, nero, giallo, magenta, ciano, arancione, verde, viola + colore personalizzato) imposta il colore della scritta; per i colori scuri viene aggiunta automaticamente una lieve **bordatura bianca** per la leggibilità.
- In **basso a sinistra** il pulsante **Reset** (rosso) azzera la partita previa **conferma**: riporta a zero punteggi, falli, timeout, tempo e periodo, mantenendo impostazioni e nomi.
- Usa i tasti `−1` `−2` `−3` ai lati per **abbassare il punteggio** (sinistra = Squadra 1, destra = Squadra 2).
- Tocca i **pallini timeout** per correggerli (stesso comportamento della modalità operativa).
- I falli mostrano i tasti `−` di correzione solo se il *Conteggio falli* è attivo (menu `…`); altrimenti il riquadro falli resta senza contatori.
- **Sirena** e **fischietto** restano disponibili anche qui.

**Impostazioni partita** (dal menu `…`)
- **Conteggio falli** on/off, **Punti colore squadra** on/off (default punti verdi), **Audio**, **Schermo sempre acceso**.
- Durata periodo, numero di periodi, **durata dei supplementari**.
- **Timeout per tempo** (1°/2°) e **timeout per supplementare**.
- Limite falli per il bonus e **bonus automatico negli ultimi 2′**.
- Azzeramento automatico dei falli a ogni periodo (on/off).
- Sirena automatica a fine tempo (on/off).

Lo stato (punteggi, falli, timeout, tempo, nomi, impostazioni) viene salvato in locale **ad ogni comando** e anche quando l'app va in background o viene chiusa: in caso di chiusura imprevista o crash, alla riapertura si riprende esattamente da dove eri (a orologio fermo, per sicurezza, così basta premere ▶️ per ripartire). Anche le opzioni — conteggio falli, audio, schermo sempre acceso — vengono ricordate.

---

## Pubblicazione su GitHub Pages

1. Crea un repository (es. `baskin-tabellone`) e carica **tutti i file mantenendo la struttura** (README e `.gitignore` nella root, l'app nella cartella `pwa/`).
2. Vai su **Settings → Pages**.
3. In *Build and deployment* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, poi **Save**.
4. Dopo qualche minuto l'app sarà su `https://<utente>.github.io/baskin-tabellone/pwa/`.
5. Apri il link da smartphone/tablet e usa **"Aggiungi a schermata Home" / "Installa app"**: da quel momento funziona anche senza rete.

> I percorsi sono tutti relativi, quindi l'app funziona dalla cartella `pwa/` (o da qualunque altra sottocartella) senza modifiche.

### Uso in locale
Aprendo `pwa/index.html` con doppio clic (`file://`) l'app funziona, ma **il service worker e l'installazione PWA richiedono `http(s)`**. Per provarli in locale:

```bash
# dalla cartella pwa/
cd pwa
python3 -m http.server 8080
# poi apri http://localhost:8080
```

---

## Struttura

```
baskin-tabellone/
├── README.md
├── .gitignore
└── pwa/
    ├── index.html
    ├── manifest.webmanifest
    ├── service-worker.js
    ├── css/styles.css
    ├── js/app.js
    ├── sounds/
    │   ├── horn.wav        (sirena - audio originale, CC0)
    │   ├── whistle.wav     (fischietto - audio originale, CC0)
    │   └── CREDITS.txt
    └── icons/
        ├── icon-192.png
        ├── icon-512.png
        └── icon-maskable-512.png
```

---

## Personalizzazione rapida

- **Colori**: variabili `--green`, `--red`, `--yellow` in `pwa/css/styles.css`.
- **Valori predefiniti** (minuti, periodi, timeout, bonus): oggetto `DEFAULT_CONFIG` in `pwa/js/app.js`.
- **Aggiornamenti offline**: a ogni rilascio incrementa `CACHE_NAME` in `pwa/service-worker.js` (e la versione in `app.js`/manifest) per forzare l'aggiornamento della cache sui dispositivi.

---

## Regole implementate

- **Tempi** → quarti da **8 minuti**, **4 periodi**, tempi supplementari da **4 minuti** (siglati da `1TS` a `9TS`).
- **Decimi di secondo** → negli ultimi **60 secondi** di ogni periodo o supplementare il cronometro passa al formato `SS:d` (regolamento FIBA), con gli stessi due punti dei minuti.
- **Bonus automatico** → **dopo** che scocca il **2:00** del **4° quarto** e di **ogni supplementare** il bonus scatta per entrambe le squadre **senza conteggio falli** (a 2:00.0 esatti ancora niente bonus; entrambe le frecce si accendono e lampeggiano). Disattivabile da Impostazioni.
- **Timeout** → in operativa si assegnano **solo a cronometro fermo** (a crono in movimento un tap mostra *"Cronometro in movimento"*, senza fischio). **1° quarto: 1** (chiamandone uno il secondo si blocca); **2° quarto:** entrambi se non hai usato quello del 1°, altrimenti solo il secondo (monte di **2** condiviso nei quarti 1‑2). I quarti 3‑4 funzionano come 1‑2; ogni **supplementare** ha **1** timeout. Un tap quando non ci sono timeout disponibili viene segnalato con **fischio** e avviso *"Timeout non disponibile"*. La correzione/azzeramento si fa nella schermata **Impostazioni**.
- **Periodo** → mostrato con cifra a **LED bianca** (alta il 75% del cronometro) e due spie: **°** (quarti ordinari) o **TS** (supplementari); se ne accende una sola.
- **Suoni** → sirena e fischietto sono file audio originali (sintetizzati, rilasciati come **CC0**) inclusi in `sounds/`; la sirena suona **automaticamente a fine quarto** oltre che con il pulsante. Se i file non fossero disponibili, un sintetizzatore WebAudio fa da riserva.

## Note sulle scelte ancora da confermare

- **Icona 🏀 in alto a sinistra** → azzera il cronometro. Modificabile se preferisci un'altra azione.
- **Frecce ◀ ▶ "Falli"** (bonus da falli) → si accende quella verso la squadra che beneficia del bonus (avversaria di chi ha raggiunto il limite). Convenzione invertibile.
- **Timeout dei supplementari** → impostati a **1** per ogni supplementare (assunzione: dimmi se la regola Baskin prevede altro).
- I supplementari si raggiungono toccando il **periodo** in modifica (fino a 5); posso aggiungere un pulsante dedicato se preferisci.

---

## Licenza

Codice rilasciato sotto licenza **MIT** (vedi [`LICENSE`](LICENSE)) — open source e
pienamente compatibile con F-Droid. I suoni in `pwa/sounds/` sono CC0.

Dal menu **…** dell'app è disponibile il link diretto al **repository GitHub** del codice.

---

**Autore:** Daniele Lolli (UncleDan)
**Versione:** 1.12.2
