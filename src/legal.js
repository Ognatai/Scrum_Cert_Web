// src/legal.js
// ---------------------------------------------------------------------------
// Modulare Rechtstexte (Impressum + Datenschutzerklärung).
//
// Prinzip: Der generische Text ist hier fest verdrahtet und darf ins Git.
// Die persönlichen BETREIBERDATEN (Name, Adresse, E-Mail, Aufsichtsbehörde)
// kommen ausschließlich aus Umgebungsvariablen:
//   - lokal:  .env.local            (gitignored, NICHT committen)
//   - Deploy: Cloudflare Pages → Settings → Environment variables
//
// Dadurch landen deine privaten Daten NIE im Repository. Auf der live
// ausgelieferten Seite sind sie sichtbar (das ist beim Impressum auch
// gewünscht) – aber eben erst nach dem Build, nicht im Quellcode.
//
// Übernahme durch eine andere Person: einfach eigene ENV-Variablen setzen,
// dieser Code bleibt gleich.
// ---------------------------------------------------------------------------

const operator = {
  name:      import.meta.env.VITE_OPERATOR_NAME      ?? '',
  street:    import.meta.env.VITE_OPERATOR_STREET    ?? '',
  city:      import.meta.env.VITE_OPERATOR_CITY      ?? '',
  country:   import.meta.env.VITE_OPERATOR_COUNTRY   ?? 'Deutschland',
  email:     import.meta.env.VITE_OPERATOR_EMAIL     ?? '',
  phone:     import.meta.env.VITE_OPERATOR_PHONE     ?? '',   // optional – laut EuGH (C-298/07) reicht E-Mail + zügige Antwortzeit als zweiter Kontaktweg, s. responseTime unten
  responseTime: import.meta.env.VITE_OPERATOR_RESPONSE_TIME ?? 'in der Regel innerhalb von 24–48 Stunden',
  authority: import.meta.env.VITE_OPERATOR_AUTHORITY ?? '',   // Datenschutz-Aufsichtsbehörde
  updated:   import.meta.env.VITE_LEGAL_LAST_UPDATED ?? '',   // z. B. "06/2026"
};

// HTML-Escaping, damit Sonderzeichen in den Daten nichts kaputt machen.
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );

// ---------------------------------------------------------------------------
// E-Mail-Schutz gegen Crawler (ROT13)
//
// Wie es funktioniert:
//   1. Die E-Mail wird per ROT13 verschlüsselt – im HTML-Quelltext steht
//      niemals die echte Adresse oder ein "mailto:"-Link.
//   2. Einfache Crawler (suchen nach "@" oder "mailto:" im Quelltext) finden
//      nichts. Sophistizierte Bots, die JS ausführen, könnten den Decoder
//      aufrufen – das lässt sich clientseitig nicht vollständig verhindern,
//      aber der Aufwand steigt deutlich.
//   3. initEmailProtection() muss einmal nach dem Rendern der Seite aufgerufen
//      werden (z. B. am Ende von mountLegal). Es ersetzt alle
//      <a data-email-r13="..."> im DOM durch echte mailto-Links – aber erst
//      im Browser, nicht im serverseitigen HTML.
// ---------------------------------------------------------------------------

/** ROT13-Encoder/Decoder (symmetrisch: encode = decode). */
function rot13(str) {
  return String(str).replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/**
 * Gibt einen <a>-Tag zurück, dessen href NICHT im HTML steht.
 * Das data-Attribut enthält die ROT13-kodierte Adresse.
 * initEmailProtection() setzt den echten mailto-Link erst im Browser.
 *
 * Das sichtbare Label wird als HTML-Entities dargestellt, damit auch
 * einfache Regex-Crawler kein "@" im Klartext finden.
 */
function obfuscatedEmailLink(email) {
  const encoded = rot13(esc(email));
  // "@" und "." im Anzeigetext als HTML-Entities – kein Klartext-@ im HTML.
  const label = esc(email)
    .replace(/@/g, '&#64;')
    .replace(/\./g, '&#46;');
  return `<a data-email-r13="${encoded}" href="#email-protected">${label}</a>`;
}

/**
 * Muss nach dem Rendern der Rechtstexte aufgerufen werden.
 * Ersetzt alle geschützten Links durch funktionierende mailto-Links.
 * Läuft nur im Browser (DOM-Zugriff) – nicht beim serverseitigen Rendern.
 */
export function initEmailProtection() {
  document.querySelectorAll('a[data-email-r13]').forEach((el) => {
    const real = rot13(el.dataset.emailR13);
    el.href = `mailto:${real}`;
    el.removeAttribute('data-email-r13');
  });
}

// Warnt im Dev-Modus, falls Pflichtangaben fehlen (verhindert leere Rechtsseiten).
function checkComplete() {
  const required = ['name', 'street', 'city', 'email'];
  const missing = required.filter((k) => !operator[k]);
  if (missing.length && import.meta.env.DEV) {
    console.warn(
      '[legal] Fehlende Betreiber-Angaben:',
      missing.join(', '),
      '\n→ in .env.local (lokal) bzw. in den Cloudflare-Pages-Variablen eintragen.'
    );
  }
  return missing;
}

const addressBlock = () => `
  ${esc(operator.name)}<br>
  ${esc(operator.street)}<br>
  ${esc(operator.city)}<br>
  ${esc(operator.country)}
`;

// ---------------------------------------------------------------------------
// IMPRESSUM (§ 5 DDG, § 18 MStV)
// ---------------------------------------------------------------------------
export function renderImpressum() {
  checkComplete();
  const phoneLine = operator.phone
    ? `<p>Telefon: ${esc(operator.phone)}</p>`
    : `<p>Erreichbarkeit per E-Mail: ${esc(operator.responseTime)}</p>`;

  return `
    <section class="legal">
      <h1>Impressum</h1>

      <h2>Angaben gemäß § 5 DDG</h2>
      <p>${addressBlock()}</p>

      <h2>Kontakt</h2>
      <p>E-Mail: ${obfuscatedEmailLink(operator.email)}</p>
      ${phoneLine}

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>${esc(operator.name)}, Anschrift wie oben.</p>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// DATENSCHUTZERKLÄRUNG (DSGVO / TDDDG)
// Zugeschnitten auf: Supabase (EU/Frankfurt) + Cloudflare Pages + E-Mail-Login,
// technisch notwendige Cookies, KEIN Tracking.
// ---------------------------------------------------------------------------
export function renderDatenschutz() {
  checkComplete();
  const stand = operator.updated ? `<p><strong>Stand:</strong> ${esc(operator.updated)}</p>` : '';
  const authority = operator.authority
    ? `<p>Zuständige Aufsichtsbehörde: ${esc(operator.authority)}</p>`
    : `<p>Zuständig ist u. a. die Datenschutz-Aufsichtsbehörde deines üblichen Aufenthaltsorts.</p>`;

  return `
    <section class="legal">
      <h1>Datenschutzerklärung</h1>
      ${stand}

      <h2>1. Verantwortlicher</h2>
      <p>${addressBlock()}</p>
      <p>E-Mail: ${obfuscatedEmailLink(operator.email)}</p>

      <h2>2. Allgemeines zur Datenverarbeitung</h2>
      <p>
        Diese Website ist ein Lern-Quiz mit Nutzerkonten. Personenbezogene Daten
        werden nur verarbeitet, soweit dies für die Bereitstellung der Funktionen
        (Konto, Lernfortschritt, Statistik) erforderlich ist – im Einklang mit der
        DSGVO, dem BDSG und dem TDDDG.
      </p>
      <p>
        Wir weisen darauf hin, dass die Datenübertragung im Internet (z. B. bei der
        Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser
        Schutz der Daten vor dem Zugriff durch Dritte ist nicht möglich.
      </p>
      <h3>Rechtsgrundlagen im Überblick</h3>
      <p>
        Soweit Daten zur Vertragserfüllung bzw. zur Durchführung vorvertraglicher
        Maßnahmen erforderlich sind (z. B. Anlegen und Betrieb deines Kontos),
        verarbeiten wir sie auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO. Soweit die
        Verarbeitung auf unserem berechtigten Interesse beruht (z. B. technisch
        notwendige Server-Logs zur Sicherheit), stützen wir uns auf Art. 6 Abs. 1
        lit. f DSGVO. Welche Rechtsgrundlage im Einzelfall einschlägig ist, wird in
        den jeweiligen Abschnitten genannt. Eine Einwilligung (Art. 6 Abs. 1 lit. a
        DSGVO) holen wir nur dort ein, wo dies ausdrücklich beschrieben ist – derzeit
        ist das auf dieser Website nicht der Fall, da wir kein Tracking und keine
        einwilligungspflichtigen Cookies einsetzen.
      </p>

      <h2>3. Aufruf der Website (Server-Logs)</h2>
      <p>
        Beim Aufruf verarbeitet der Hosting-Anbieter technisch notwendige Daten
        (IP-Adresse, Datum/Uhrzeit, abgerufene Seite, Browser/Betriebssystem) zur
        Auslieferung, Stabilität und Sicherheit.
        <br>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
      </p>
      <h3>Hosting: Cloudflare Pages</h3>
      <p>
        Die Website wird bei der Cloudflare, Inc. (101 Townsend St, San Francisco,
        CA 94107, USA) gehostet. Cloudflare verarbeitet die Zugriffsdaten in unserem
        Auftrag (Auftragsverarbeitung nach Art. 28 DSGVO). Eine Übermittlung in die
        USA wird auf das EU-U.S. Data Privacy Framework sowie EU-Standardvertrags-
        klauseln gestützt.
      </p>
      <h3>SSL- bzw. TLS-Verschlüsselung</h3>
      <p>
        Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung
        vertraulicher Inhalte, wie zum Beispiel deiner Login-Daten, eine SSL- bzw.
        TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du daran, dass
        die Adresszeile des Browsers von „http://" auf „https://" wechselt und am
        Schloss-Symbol in der Browserzeile.
      </p>

      <h2>4. Nutzerkonto (Registrierung und Login)</h2>
      <p>
        Für die Nutzung legst du ein Konto an. Verarbeitet werden: E-Mail-Adresse,
        Passwort (ausschließlich verschlüsselt/gehasht gespeichert) sowie ggf. ein
        Benutzername. Zur Bestätigung der Registrierung wird eine E-Mail mit
        Bestätigungslink versendet.
        <br>Zweck: Erstellung und Verwaltung des Kontos, Authentifizierung.
        <br>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>5. Lernfortschritt und Statistik</h2>
      <p>
        Gespeichert wird, welche Fragen beantwortet wurden, ob die Antwort richtig
        war, die Themenkategorie sowie der Fortschritt. Daraus entsteht eine
        persönliche Auswertung, die nur du in deinem Konto siehst.
        <br>Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>6. Datenbank und Authentifizierung: Supabase</h2>
      <p>
        Für Speicherung und Authentifizierung nutzen wir Supabase (Supabase, Inc.,
        970 Toa Payoh North #07-04, Singapore 318992). Die Datenhaltung erfolgt in
        der EU-Region (Frankfurt am Main). Es besteht ein Auftragsverarbeitungs-
        vertrag nach Art. 28 DSGVO.
        <br>Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO i. V. m. Art. 28 DSGVO.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Es werden ausschließlich technisch notwendige Cookies für Login und Sitzung
        gesetzt (Auth-/Session-Token von Supabase), und zwar erst nach dem Login.
        Rechtsgrundlage: § 25 Abs. 2 Nr. 2 TDDDG i. V. m. Art. 6 Abs. 1 lit. b DSGVO.
        Es findet kein Tracking, kein Profiling und kein Einsatz von Analyse- oder
        Werbe-Cookies statt; ein Einwilligungsbanner ist daher nicht erforderlich.
      </p>

      <h2>8. Speicherdauer</h2>
      <p>
        Daten werden gespeichert, solange dein Konto besteht. Beim Löschen des
        Kontos werden Profil, Antworten und Fortschritt automatisch und
        unwiderruflich mitgelöscht. Server-Logs werden kurzfristig automatisch
        gelöscht bzw. anonymisiert.
      </p>

      <h2>9. Empfänger / Auftragsverarbeiter</h2>
      <p>
        Wir geben personenbezogene Daten nur dann an externe Stellen weiter, wenn
        dies zur Bereitstellung der App-Funktionen erforderlich ist oder wir
        gesetzlich dazu verpflichtet sind. Beim Einsatz von Auftragsverarbeitern
        geben wir Daten nur auf Grundlage eines gültigen Vertrags über
        Auftragsverarbeitung (Art. 28 DSGVO) weiter. Eine Weitergabe zu eigenen,
        darüberhinausgehenden Zwecken erfolgt nicht. Im Rahmen der technischen
        Bereitstellung verarbeiten folgende Auftragsverarbeiter Daten:
        Cloudflare, Inc. (Hosting) und Supabase, Inc. (Datenbank/Auth, EU-Region).
      </p>

      <h2>10. Deine Rechte</h2>
      <p>
        Du hast im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das
        Recht auf unentgeltliche Auskunft über deine bei uns gespeicherten
        personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der
        Datenverarbeitung (Art. 15 DSGVO) sowie ggf. ein Recht auf Berichtigung
        (Art. 16 DSGVO) oder Löschung (Art. 17 DSGVO) dieser Daten. Eine formlose
        Nachricht an die oben genannte E-Mail-Adresse genügt. Dein Konto und alle
        zugehörigen Daten kannst du außerdem jederzeit selbst über die Funktion
        „Konto löschen" entfernen.
      </p>
      <h3>Recht auf Einschränkung der Verarbeitung</h3>
      <p>
        Du hast das Recht, die Einschränkung der Verarbeitung deiner
        personenbezogenen Daten zu verlangen (Art. 18 DSGVO) – etwa wenn du die
        Richtigkeit der gespeicherten Daten bestreitest oder die Verarbeitung
        deiner Ansicht nach unrechtmäßig war. Für die Dauer einer Prüfung kannst du
        statt der Löschung die Einschränkung verlangen. Wende dich hierzu an die
        oben genannte E-Mail-Adresse.
      </p>
      <h3>Recht auf Datenübertragbarkeit</h3>
      <p>
        Du hast das Recht, Daten, die wir auf Grundlage eines Vertrags automatisiert
        verarbeiten (z. B. deinen Lernfortschritt), an dich oder an einen Dritten in
        einem gängigen, maschinenlesbaren Format aushändigen zu lassen (Art. 20
        DSGVO).
      </p>
      <h3>Widerspruchsrecht</h3>
      <p>
        Soweit eine Verarbeitung ausnahmsweise auf unserem berechtigten Interesse
        (Art. 6 Abs. 1 lit. f DSGVO) beruht – etwa bei den technisch notwendigen
        Server-Logs –, hast du das Recht, aus Gründen, die sich aus deiner
        besonderen Situation ergeben, jederzeit Widerspruch gegen diese
        Verarbeitung einzulegen (Art. 21 Abs. 1 DSGVO). Profiling, Tracking oder
        Direktwerbung finden auf dieser Website nicht statt, sodass ein
        entsprechender Widerspruch hier nicht erforderlich ist.
      </p>

      <h2>11. Beschwerderecht bei der Aufsichtsbehörde</h2>
      <p>
        Im Falle von Verstößen gegen die DSGVO steht dir ein Beschwerderecht bei
        einer Aufsichtsbehörde zu, insbesondere in dem Mitgliedstaat deines
        gewöhnlichen Aufenthalts, deines Arbeitsplatzes oder des Orts des
        mutmaßlichen Verstoßes. Das Beschwerderecht besteht unbeschadet
        anderweitiger verwaltungsrechtlicher oder gerichtlicher Rechtsbehelfe.
      </p>
      ${authority}

      <h2>12. Änderungen</h2>
      <p>
        Diese Datenschutzerklärung wird angepasst, sobald sich die Verarbeitung
        ändert oder neue rechtliche Vorgaben dies erfordern. Es gilt die hier
        abrufbare aktuelle Fassung.
      </p>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Hilfsfunktion zum Einhängen in einen Container.
//   mountLegal(document.getElementById('legal-view'), 'impressum');
//   mountLegal(document.getElementById('legal-view'), 'datenschutz');
// ---------------------------------------------------------------------------
export function mountLegal(container, page) {
  if (!container) return;
  container.innerHTML =
    page === 'impressum' ? renderImpressum() : renderDatenschutz();
  initEmailProtection(); // mailto-Links erst jetzt im Browser aktivieren
}
