// =====================================================
// ARCHÍV: PONUKA A SÚPIS PRÁC — čisté funkcie (bez DOM a localStorage)
// =====================================================
// Načítava sa v index.html PRED app.js. Funkcie nemenia vstupy (pracujú
// s kópiami). V Node sa dajú načítať cez require — testy: node testy/archiv.test.js
//
// Formát záznamu archívu: vrchná úroveň je CENOVÁ PONUKA (ako doteraz).
// Súpis prác je v nepovinnom kľúči `supis` — objekt v rovnakom tvare ako
// rozpracované dáta (výstup ulozRozpracovanuPonuku) s rezimSupisPrac: true
// a s datum, sumaZobrazena, modifiedAt. `obsahujeSupis` ostáva príznakom pre
// štítok a filtre. `ponukaPrepisanaSupisom` = vrchnú úroveň prepísal súpis
// ešte v staršej verzii appky (pôvodná ponuka sa už nedá obnoviť).

// Kľúče záznamu, ktoré patria súpisu, nie ponuke.
const SUPISOVE_KLUCE_ZAZNAMU = ['supis', 'obsahujeSupis', 'ponukaPrepisanaSupisom'];

function _kopia(hodnota) {
    return hodnota === undefined ? undefined : JSON.parse(JSON.stringify(hodnota));
}

// Kópia záznamu bez súpisových kľúčov (duplikovanie, otvorenie ponuky).
function odstranSupisoveKluce(zaznam) {
    const kopia = _kopia(zaznam) || {};
    SUPISOVE_KLUCE_ZAZNAMU.forEach(k => { delete kopia[k]; });
    delete kopia.supisZdrojId;
    return kopia;
}

// Starý záznam, ktorého vrchnú úroveň prepísal súpis v staršej verzii appky.
function jePonukaPrepisanaSupisom(zaznam) {
    return !!zaznam && ((!!zaznam.obsahujeSupis && !zaznam.supis) || !!zaznam.ponukaPrepisanaSupisom);
}

function _maZdrojId(rozpracovane) {
    return rozpracovane.supisZdrojId !== undefined && rozpracovane.supisZdrojId !== null && rozpracovane.supisZdrojId !== '';
}

// Uloženie rozpracovaných dát do archívu (tlačidlo "Uložiť do archívu").
// kontext: { rezimSupis, datum, sumaZobrazena, teraz }
// Vráti { archiv: NOVÉ pole, zaznam, rozpracovane (na zápis späť), vysledok }.
// vysledok: 'ponuka-nova' | 'ponuka-prepis' | 'supis-ulozeny' | 'supis-novy-zaznam'
function pripravUlozenieDoArchivu(archiv, rozpracovane, kontext) {
    const pole = Array.isArray(archiv) ? archiv.slice() : [];
    const data = _kopia(rozpracovane) || {};

    if (kontext.rezimSupis) {
        // P2: súpis sa viaže na ponuku cez id záznamu. Rozpracovaný súpis spred
        // aktualizácie (bez supisZdrojId) sa hľadá podľa čísla ako doteraz.
        const index = _maZdrojId(data)
            ? pole.findIndex(z => z && z.id === data.supisZdrojId)
            : pole.findIndex(z => z && z.cislo === data.cislo);

        // P1: obsah súpisu = rozpracované dáta (bez kľúčov záznamu a väzby)
        const supis = odstranSupisoveKluce(data);
        delete supis.id;
        supis.rezimSupisPrac = true;
        supis.datum = kontext.datum;
        supis.sumaZobrazena = kontext.sumaZobrazena;
        supis.modifiedAt = kontext.teraz;

        if (index !== -1) {
            const povodny = pole[index];
            const zaznam = _kopia(povodny);
            // P10: prvé uloženie súpisu do starého prepísaného záznamu
            if (povodny.obsahujeSupis && !povodny.supis) zaznam.ponukaPrepisanaSupisom = true;
            zaznam.supis = supis;
            zaznam.obsahujeSupis = true;
            zaznam.modifiedAt = kontext.teraz;
            pole[index] = zaznam;
            const rozp = _kopia(data);
            rozp.supisZdrojId = zaznam.id;
            return { archiv: pole, zaznam: zaznam, rozpracovane: rozp, vysledok: 'supis-ulozeny' };
        }

        // Zdroj sa nenašiel: nič neprepisovať, súpis uložiť ako nový záznam
        // (vrchná úroveň = jeho údaje, aby sa dal otvoriť aj tlačidlom "Otvoriť").
        const novy = odstranSupisoveKluce(data);
        novy.rezimSupisPrac = false;
        novy.datum = kontext.datum;
        novy.sumaZobrazena = kontext.sumaZobrazena;
        novy.modifiedAt = kontext.teraz;
        novy.id = kontext.teraz;
        novy.obsahujeSupis = true;
        novy.supis = supis;
        pole.unshift(novy);
        const rozp = _kopia(data);
        rozp.supisZdrojId = novy.id;
        return { archiv: pole, zaznam: novy, rozpracovane: rozp, vysledok: 'supis-novy-zaznam' };
    }

    // P6: uloženie ponuky — hľadá sa podľa čísla ako doteraz, ale súpis
    // uložený v zázname sa zachová.
    SUPISOVE_KLUCE_ZAZNAMU.forEach(k => { delete data[k]; });
    delete data.supisZdrojId;
    data.datum = kontext.datum;
    data.sumaZobrazena = kontext.sumaZobrazena;
    data.modifiedAt = kontext.teraz;

    const index = pole.findIndex(z => z && z.cislo === data.cislo);
    if (index !== -1) {
        const povodny = pole[index];
        data.id = povodny.id;
        SUPISOVE_KLUCE_ZAZNAMU.forEach(k => {
            if (povodny[k] !== undefined) data[k] = _kopia(povodny[k]);
        });
        pole[index] = data;
        // do rozpracovaných dát sa súpis nekopíruje
        return { archiv: pole, zaznam: data, rozpracovane: odstranSupisoveKluce(data), vysledok: 'ponuka-prepis' };
    }
    data.id = kontext.teraz;
    pole.unshift(data);
    return { archiv: pole, zaznam: data, rozpracovane: odstranSupisoveKluce(data), vysledok: 'ponuka-nova' };
}

// P3: "Otvoriť" — rozpracované dáta z vrchnej úrovne záznamu (ponuka),
// bez súpisových kľúčov, bez zámkov a mimo režimu súpisu.
function otvorPonukuZoZaznamu(zaznam) {
    const data = odstranSupisoveKluce(zaznam);
    data.rezimSupisPrac = false;
    if (Array.isArray(data.polozky)) {
        data.polozky.forEach(p => {
            if (p.typRiadku === 'balik' && Array.isArray(p.polozky)) {
                p.polozky.forEach(bp => { delete bp.zamknutaCena; });
            } else {
                delete p.zamknutaCena;
            }
        });
    }
    if (Array.isArray(data.zlavy)) {
        data.zlavy.forEach(z => { delete z.zamknuta; });
    }
    return data;
}

// P4 + P10: "Otvoriť / Vytvoriť Súpis prác" — rozpracované dáta súpisu.
//  - záznam má `supis` → presne tak, ako bol uložený;
//  - starý prepísaný záznam (obsahujeSupis bez `supis`) → z vrchnej úrovne,
//    uložená hlavička aj zámky riadkov ostanú, zľavy sa zamknú všetky
//    (ich zámok sa doteraz neukladal);
//  - ponuka bez súpisu → nový súpis z ponuky: hlavička z profilu, zamknuté
//    všetky riadky aj zľavy (ako doteraz).
// vazbaCisloCP = čisté číslo cenovej ponuky (pri väzbe na CP).
function otvorSupisZoZaznamu(zaznam, profil, vazbaCisloCP) {
    let data;
    if (zaznam && zaznam.supis) {
        data = odstranSupisoveKluce(zaznam.supis);
        delete data.id;
        data.rezimSupisPrac = true;
        data.supisZdrojId = zaznam.id;
        return data;
    }

    data = odstranSupisoveKluce(zaznam);
    delete data.id;
    data.rezimSupisPrac = true;
    data.supisZdrojId = zaznam ? zaznam.id : null;

    if (zaznam && zaznam.obsahujeSupis) {
        if (Array.isArray(data.zlavy)) data.zlavy.forEach(z => { z.zamknuta = 'ano'; });
        return data;
    }

    const p = profil || {};
    data.supisVazbaTyp    = p.supisVazbaTyp || 'cp';
    data.supisVazbaCustom = p.supisVazbaCustom || '';
    data.supisNadpis      = p.supisNadpis || '';
    data.supisPodpisRezim = p.supisPodpisRezim || 'ciary';
    data.supisVazbaCislo  = (data.supisVazbaTyp === 'cp') ? (vazbaCisloCP || '') : '';
    if (Array.isArray(data.polozky)) {
        data.polozky.forEach(r => {
            if (r.typRiadku === 'balik') {
                if (Array.isArray(r.polozky)) r.polozky.forEach(bp => { bp.zamknutaCena = 'ano'; });
            } else {
                r.zamknutaCena = 'ano';
            }
        });
    }
    if (Array.isArray(data.zlavy)) data.zlavy.forEach(z => { z.zamknuta = 'ano'; });
    return data;
}

// P11: zlúčenie dvoch verzií toho istého záznamu (rovnaké id) pri synchronizácii.
// Víťaz je určený ako doteraz (novší modifiedAt). Súpis sa však nestratí:
//  - víťaz súpis nemá a porazený áno → súpis (a príznaky) sa prenesú;
//  - oba majú súpis → ostane ten s novším supis.modifiedAt.
// Dôvod: staršia verzia appky vnorený súpis pri uložení ponuky zahodí.
function zlucZaznamSoSupisom(vitaz, porazeny) {
    if (!porazeny || !porazeny.supis) return vitaz;
    const vysledok = _kopia(vitaz);
    if (!vysledok.supis) {
        vysledok.supis = _kopia(porazeny.supis);
        vysledok.obsahujeSupis = true;
        if (porazeny.ponukaPrepisanaSupisom) vysledok.ponukaPrepisanaSupisom = true;
        return vysledok;
    }
    const tVitaz = Number(vysledok.supis.modifiedAt) || 0;
    const tPorazeny = Number(porazeny.supis.modifiedAt) || 0;
    if (tPorazeny > tVitaz) vysledok.supis = _kopia(porazeny.supis);
    vysledok.obsahujeSupis = true;
    if (porazeny.ponukaPrepisanaSupisom) vysledok.ponukaPrepisanaSupisom = true;
    return vysledok;
}

if (typeof module !== 'undefined') module.exports = {
    odstranSupisoveKluce, jePonukaPrepisanaSupisom, pripravUlozenieDoArchivu,
    otvorPonukuZoZaznamu, otvorSupisZoZaznamu, zlucZaznamSoSupisom
};
