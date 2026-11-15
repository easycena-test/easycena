// Testy archívu: ponuka a súpis prác v jednom zázname (archivLogika.js) — bez knižníc.
// Spustenie: node testy/archiv.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require('../archivLogika.js');

// Skutočná funkcia _zlucArchiv z app.js (app.js sa v Node načítať nedá — potrebuje DOM).
// Vyberieme jej text a spustíme ho so zlucZaznamSoSupisom z archivLogika.js.
const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const zhodaZluc = appJs.match(/function _zlucArchiv\([\s\S]*?\r?\n\}\r?\n/);
if (!zhodaZluc) throw new Error('V app.js sa nenašla funkcia _zlucArchiv');
const _zlucArchiv = new Function('zlucZaznamSoSupisom', zhodaZluc[0] + '\nreturn _zlucArchiv;')(L.zlucZaznamSoSupisom);

// --- Pomocné funkcie ---------------------------------------------------------

// Zmrazený vstup: ak by funkcia vstup menila, v 'use strict' to spadne.
function zmraz(o) {
    if (o && typeof o === 'object') { Object.values(o).forEach(zmraz); Object.freeze(o); }
    return o;
}
function kopia(o) { return JSON.parse(JSON.stringify(o)); }
function bez(o, kluce) { const k = kopia(o); kluce.forEach(x => delete k[x]); return k; }

// Napodobenie automatického ukladania ulozRozpracovanuPonuku(): rovnaké kľúče
// v rovnakom poradí; zámok zľavy len keď je zamknutá (P5); supisZdrojId len v súpise.
const KLUCE_ROZPRACOVANYCH = ['rezimSupisPrac', 'cislo', 'supisVazbaTyp', 'supisVazbaCislo',
    'supisVazbaCustom', 'supisNadpis', 'supisPodpisRezim', 'dphZapnute', 'meno', 'ulica', 'mesto',
    'ico', 'dic', 'icdph', 'telefon', 'email', 'znackaId', 'platnostDo', 'miestoVystavenia',
    'datumVystavenia', 'poznamka1', 'informacia2', 'dodacie', 'platobne', 'zarukaZariadenie',
    'zarukaMontaz', 'polozky', 'zlavy'];
function autosave(plocha) {
    const d = {};
    KLUCE_ROZPRACOVANYCH.forEach(k => { d[k] = kopia(plocha[k] === undefined ? '' : plocha[k]); });
    d.zlavy = (plocha.zlavy || []).map(z => {
        const zl = { typ: z.typ, hodnota: z.hodnota };
        if (z.zamknuta === 'ano') zl.zamknuta = 'ano';
        return zl;
    });
    if (d.rezimSupisPrac && plocha.supisZdrojId != null) d.supisZdrojId = plocha.supisZdrojId;
    return d;
}

function novaPonukaNaPloche() {
    return autosave({
        rezimSupisPrac: false, cislo: 'CP-2026-001',
        supisVazbaTyp: 'cp', supisVazbaCislo: '', supisVazbaCustom: '', supisNadpis: '', supisPodpisRezim: 'ciary',
        dphZapnute: true, meno: 'Ján Testovací', ulica: 'Hlavná 1', mesto: 'Bratislava',
        ico: '', dic: '', icdph: '', telefon: '', email: '', znackaId: '',
        platnostDo: '2026-12-12', miestoVystavenia: 'Bratislava', datumVystavenia: '2026-11-12',
        poznamka1: '', informacia2: '', dodacie: 'dohodou', platobne: 'zálohová platba',
        zarukaZariadenie: '36 mesiacov na dodané zariadenia', zarukaMontaz: '36 mesiacov na montáž',
        polozky: [
            { typRiadku: 'polozka', kategoria: 'praca', mj: 'hod', dph: '23', nazov: 'Montáž klimatizácie',
              cena: '10', mnozstvo: '2', popis: '', upozornenie: '', zamknutaCena: '' },
            { typRiadku: 'balik', nazovBalika: 'Montážny balík', nasobic: '1', polozky: [
                { kategoria: 'material', mj: 'ks', dph: '23', zakladneMnozstvo: 1, nazov: 'Konzola',
                  cena: '5', mnozstvo: '1', popis: '', upozornenie: '', zamknutaCena: '' }
            ] }
        ],
        zlavy: [{ typ: 'globalna', hodnota: '5' }]
    });
}

const PROFIL = zmraz({ supisVazbaTyp: 'cp', supisVazbaCustom: '', supisNadpis: '', supisPodpisRezim: 'ciary' });
const PROFIL_INY = zmraz({ supisVazbaTyp: 'faktura', supisVazbaCustom: 'z profilu', supisNadpis: 'NADPIS Z PROFILU', supisPodpisRezim: 'nic' });

function uloz(archiv, plocha, rezimSupis, teraz, suma) {
    return L.pripravUlozenieDoArchivu(zmraz(archiv), zmraz(plocha), {
        rezimSupis: rezimSupis, datum: '12. 11. 2026', sumaZobrazena: suma, teraz: teraz
    });
}

// Scenár: ponuka (množstvo 2) → súpis (množstvo 5, pridaný riadok, vlastná hlavička)
function scenarPonukaASupis() {
    const r1 = uloz([], novaPonukaNaPloche(), false, 1000, '19.00');
    const povodny = kopia(r1.zaznam);
    const plochaSupis = L.otvorSupisZoZaznamu(zmraz(kopia(r1.zaznam)), PROFIL, 'CP-2026-001');
    plochaSupis.polozky[0].mnozstvo = '5';
    plochaSupis.polozky.push({ typRiadku: 'polozka', kategoria: 'praca', mj: 'hod', dph: '23',
        nazov: 'Práca naviac', cena: '20', mnozstvo: '1', popis: '', upozornenie: '', zamknutaCena: '' });
    plochaSupis.supisNadpis = 'SÚPIS VYKONANÝCH PRÁC';
    plochaSupis.supisVazbaTyp = 'zakazka';
    plochaSupis.supisVazbaCislo = 'Z-77';
    plochaSupis.supisPodpisRezim = 'podpis';
    const r2 = uloz(r1.archiv, autosave(plochaSupis), true, 2000, '76.00');
    return { r1, r2, povodny };
}

// --- Testy ---------------------------------------------------------------------
const testy = [];
function test(nazov, fn) { testy.push([nazov, fn]); }

test('A1 súpis nezmení vrchnú úroveň záznamu (okrem obsahujeSupis, supis, modifiedAt)', () => {
    const { r2, povodny } = scenarPonukaASupis();
    assert.strictEqual(r2.vysledok, 'supis-ulozeny');
    assert.strictEqual(r2.archiv.length, 1);
    const zaznam = r2.archiv[0];
    assert.deepStrictEqual(bez(zaznam, ['obsahujeSupis', 'supis', 'modifiedAt']), bez(povodny, ['modifiedAt']));
    assert.strictEqual(zaznam.datum, povodny.datum);
    assert.strictEqual(zaznam.sumaZobrazena, '19.00');
    assert.strictEqual(zaznam.polozky[0].mnozstvo, '2');
    assert.strictEqual(zaznam.obsahujeSupis, true);
    assert.strictEqual(zaznam.modifiedAt, 2000);
    assert.strictEqual(zaznam.supis.rezimSupisPrac, true);
    assert.strictEqual(zaznam.supis.sumaZobrazena, '76.00');
    assert.strictEqual(zaznam.supis.datum, '12. 11. 2026');
    assert.strictEqual(zaznam.supis.modifiedAt, 2000);
    assert.strictEqual(zaznam.supis.polozky[0].mnozstvo, '5');
    assert.strictEqual(zaznam.supis.polozky.length, 3);
    assert.ok(!('supisZdrojId' in zaznam.supis), 'súpis v zázname nemá väzbu supisZdrojId');
    assert.ok(!('id' in zaznam.supis), 'súpis v zázname nemá vlastné id');
    assert.ok(!('ponukaPrepisanaSupisom' in zaznam), 'nový záznam nie je označený ako prepísaný');
    assert.strictEqual(L.jePonukaPrepisanaSupisom(zaznam), false);
});

test('A2 Otvoriť po uložení súpisu: pôvodné množstvá, bez kľúča supis', () => {
    const { r2 } = scenarPonukaASupis();
    const plocha = L.otvorPonukuZoZaznamu(zmraz(r2.archiv[0]));
    assert.strictEqual(plocha.rezimSupisPrac, false);
    assert.strictEqual(plocha.polozky.length, 2);
    assert.strictEqual(plocha.polozky[0].mnozstvo, '2');
    ['supis', 'obsahujeSupis', 'ponukaPrepisanaSupisom', 'supisZdrojId'].forEach(k =>
        assert.ok(!(k in plocha), `v dátach ponuky nie je kľúč ${k}`));
    assert.ok(!('zamknutaCena' in plocha.polozky[0]));
    assert.ok(!('zamknuta' in plocha.zlavy[0]));
});

test('A3 Opätovné otvorenie súpisu: uložená hlavička, zámky riadkov a zľavy', () => {
    const { r2 } = scenarPonukaASupis();
    const zaznam = r2.archiv[0];
    const plocha = L.otvorSupisZoZaznamu(zmraz(zaznam), PROFIL_INY, 'CP-2026-001');
    assert.strictEqual(plocha.rezimSupisPrac, true);
    assert.strictEqual(plocha.supisZdrojId, zaznam.id);
    assert.strictEqual(plocha.supisNadpis, 'SÚPIS VYKONANÝCH PRÁC');
    assert.strictEqual(plocha.supisVazbaTyp, 'zakazka');
    assert.strictEqual(plocha.supisVazbaCislo, 'Z-77');
    assert.strictEqual(plocha.supisPodpisRezim, 'podpis');
    assert.strictEqual(plocha.polozky[0].mnozstvo, '5');
    assert.strictEqual(plocha.polozky[0].zamknutaCena, 'ano', 'pôvodný riadok zamknutý');
    assert.strictEqual(plocha.polozky[1].polozky[0].zamknutaCena, 'ano', 'pôvodný riadok balíka zamknutý');
    assert.strictEqual(plocha.polozky[2].zamknutaCena, '', 'pridaný riadok odomknutý');
    assert.strictEqual(plocha.zlavy[0].zamknuta, 'ano', 'pôvodná zľava zamknutá');
    ['supis', 'obsahujeSupis', 'ponukaPrepisanaSupisom'].forEach(k => assert.ok(!(k in plocha)));
    // po automatickom uložení ostáva väzba aj zámok zľavy
    const poAutosave = autosave(plocha);
    assert.strictEqual(poAutosave.supisZdrojId, zaznam.id);
    assert.strictEqual(poAutosave.zlavy[0].zamknuta, 'ano');
});

test('A3b Vytvorenie nového súpisu z ponuky: predvoľby z profilu, všetko zamknuté', () => {
    const r1 = uloz([], novaPonukaNaPloche(), false, 1000, '19.00');
    const plocha = L.otvorSupisZoZaznamu(zmraz(r1.zaznam), PROFIL_INY, 'CP-2026-001');
    assert.strictEqual(plocha.supisZdrojId, r1.zaznam.id);
    assert.strictEqual(plocha.supisVazbaTyp, 'faktura');
    assert.strictEqual(plocha.supisVazbaCislo, '', 'pri inej väzbe ako CP sa číslo nepredvypĺňa');
    assert.strictEqual(plocha.supisNadpis, 'NADPIS Z PROFILU');
    assert.strictEqual(plocha.supisPodpisRezim, 'nic');
    assert.strictEqual(plocha.polozky[0].zamknutaCena, 'ano');
    assert.strictEqual(plocha.polozky[1].polozky[0].zamknutaCena, 'ano');
    assert.strictEqual(plocha.zlavy[0].zamknuta, 'ano');
    const sCp = L.otvorSupisZoZaznamu(zmraz(r1.zaznam), PROFIL, 'CP-2026-001');
    assert.strictEqual(sCp.supisVazbaCislo, 'CP-2026-001');
});

test('A4 Opätovné uloženie ponuky s rovnakým číslom: súpis ostane', () => {
    const { r2 } = scenarPonukaASupis();
    const supisPred = kopia(r2.archiv[0].supis);
    const plocha = autosave(L.otvorPonukuZoZaznamu(zmraz(r2.archiv[0])));
    plocha.polozky[0].mnozstvo = '3';
    const r3 = uloz(r2.archiv, plocha, false, 3000, '29.00');
    assert.strictEqual(r3.vysledok, 'ponuka-prepis');
    assert.strictEqual(r3.archiv.length, 1);
    const zaznam = r3.archiv[0];
    assert.strictEqual(zaznam.id, r2.archiv[0].id);
    assert.strictEqual(zaznam.polozky[0].mnozstvo, '3');
    assert.strictEqual(zaznam.sumaZobrazena, '29.00');
    assert.strictEqual(zaznam.obsahujeSupis, true);
    assert.deepStrictEqual(zaznam.supis, supisPred);
    assert.ok(!('supis' in r3.rozpracovane), 'do rozpracovaných dát sa súpis nekopíruje');
    assert.ok(!('obsahujeSupis' in r3.rozpracovane));
    // príznak prepísania sa pri uložení ponuky tiež zachová (P6)
    const sPriznakom = kopia(r3.archiv); sPriznakom[0].ponukaPrepisanaSupisom = true;
    const r4 = uloz(sPriznakom, plocha, false, 4000, '29.00');
    assert.strictEqual(r4.archiv[0].ponukaPrepisanaSupisom, true);
});

test('A5 Zmenené číslo dokladu v súpise: uloží sa do zdrojového záznamu', () => {
    const { r2 } = scenarPonukaASupis();
    const plocha = L.otvorSupisZoZaznamu(zmraz(r2.archiv[0]), PROFIL, 'CP-2026-001');
    plocha.cislo = 'SP-2026-099';
    const r3 = uloz(r2.archiv, autosave(plocha), true, 3000, '76.00');
    assert.strictEqual(r3.vysledok, 'supis-ulozeny');
    assert.strictEqual(r3.archiv.length, 1, 'nový záznam nevznikol');
    assert.strictEqual(r3.archiv[0].id, r2.archiv[0].id);
    assert.strictEqual(r3.archiv[0].cislo, 'CP-2026-001', 'číslo ponuky ostalo');
    assert.strictEqual(r3.archiv[0].supis.cislo, 'SP-2026-099');
    assert.strictEqual(r3.rozpracovane.supisZdrojId, r2.archiv[0].id);
});

test('A6 Rozpracovaný súpis bez supisZdrojId: nájde záznam podľa čísla', () => {
    const r1 = uloz([], novaPonukaNaPloche(), false, 1000, '19.00');
    const druha = novaPonukaNaPloche(); druha.cislo = 'CP-2026-002';
    const r1b = uloz(r1.archiv, druha, false, 1500, '19.00');
    // rozpracovaný súpis spred aktualizácie: celý záznam na ploche, bez väzby
    const staraPlocha = kopia(r1.zaznam);
    staraPlocha.rezimSupisPrac = true;
    staraPlocha.polozky[0].mnozstvo = '5';
    const plocha = autosave(staraPlocha);
    assert.ok(!('supisZdrojId' in plocha));
    const r2 = uloz(r1b.archiv, plocha, true, 2000, '52.25');
    assert.strictEqual(r2.vysledok, 'supis-ulozeny');
    assert.strictEqual(r2.archiv.length, 2);
    const ciel = r2.archiv.find(z => z.cislo === 'CP-2026-001');
    assert.strictEqual(ciel.supis.polozky[0].mnozstvo, '5');
    assert.strictEqual(ciel.polozky[0].mnozstvo, '2');
    assert.deepStrictEqual(r2.archiv.find(z => z.cislo === 'CP-2026-002'), r1b.archiv.find(z => z.cislo === 'CP-2026-002'));
    assert.strictEqual(r2.rozpracovane.supisZdrojId, r1.zaznam.id, 'od teraz si súpis pamätá id');
});

test('A6b Zdroj sa nenašiel: nič sa neprepíše, súpis je nový záznam', () => {
    const r1 = uloz([], novaPonukaNaPloche(), false, 1000, '19.00');
    // a) väzba na zmazaný záznam
    const plocha = autosave(L.otvorSupisZoZaznamu(zmraz(kopia(r1.zaznam)), PROFIL, 'CP-2026-001'));
    plocha.supisZdrojId = 424242;
    const r2 = uloz(r1.archiv, plocha, true, 2000, '19.00');
    assert.strictEqual(r2.vysledok, 'supis-novy-zaznam');
    assert.strictEqual(r2.archiv.length, 2);
    assert.deepStrictEqual(r2.archiv[1], r1.archiv[0], 'pôvodný záznam sa nezmenil');
    const novy = r2.archiv[0];
    assert.strictEqual(novy.id, 2000);
    assert.strictEqual(novy.obsahujeSupis, true);
    assert.strictEqual(novy.supis.rezimSupisPrac, true);
    assert.strictEqual(novy.rezimSupisPrac, false);
    assert.strictEqual(r2.rozpracovane.supisZdrojId, 2000);
    // b) bez väzby a bez zhodného čísla
    const bezVazby = autosave(Object.assign(kopia(plocha), { cislo: 'XY-1' }));
    delete bezVazby.supisZdrojId;
    const r3 = uloz(r1.archiv, bezVazby, true, 3000, '19.00');
    assert.strictEqual(r3.vysledok, 'supis-novy-zaznam');
    assert.deepStrictEqual(r3.archiv[1], r1.archiv[0]);
});

test('A7 Starý prepísaný záznam: otvorenie aj uloženie súpisu', () => {
    // Záznam zo staršej verzie: súpis prepísal vrchnú úroveň, kľúč supis chýba
    const stary = kopia(uloz([], novaPonukaNaPloche(), false, 1000, '19.00').zaznam);
    stary.rezimSupisPrac = true;
    stary.obsahujeSupis = true;
    stary.supisNadpis = 'STARÝ NADPIS';
    stary.supisVazbaTyp = 'ine';
    stary.supisVazbaCustom = 'k zmluve č. 7';
    stary.supisVazbaCislo = '';
    stary.supisPodpisRezim = 'nic';
    stary.polozky[0].mnozstvo = '5';
    stary.polozky[0].zamknutaCena = 'ano';
    stary.polozky[1].polozky[0].zamknutaCena = 'ano';
    stary.polozky.push({ typRiadku: 'polozka', kategoria: 'praca', mj: 'hod', dph: '23',
        nazov: 'Práca naviac', cena: '20', mnozstvo: '1', popis: '', upozornenie: '', zamknutaCena: '' });
    stary.sumaZobrazena = '76.00';
    zmraz(stary);
    assert.strictEqual(L.jePonukaPrepisanaSupisom(stary), true, 'karta ukáže poznámku');

    const plocha = L.otvorSupisZoZaznamu(stary, PROFIL_INY, 'CP-2026-001');
    assert.strictEqual(plocha.supisNadpis, 'STARÝ NADPIS', 'nie predvoľba z profilu');
    assert.strictEqual(plocha.supisVazbaTyp, 'ine');
    assert.strictEqual(plocha.supisVazbaCustom, 'k zmluve č. 7');
    assert.strictEqual(plocha.supisPodpisRezim, 'nic');
    assert.strictEqual(plocha.polozky[0].zamknutaCena, 'ano');
    assert.strictEqual(plocha.polozky[1].polozky[0].zamknutaCena, 'ano');
    assert.strictEqual(plocha.polozky[2].zamknutaCena, '', 'uložený odomknutý riadok ostane odomknutý');
    assert.strictEqual(plocha.zlavy[0].zamknuta, 'ano', 'zľavy sa zamknú všetky');
    assert.strictEqual(plocha.supisZdrojId, stary.id);

    const r = uloz([stary], autosave(plocha), true, 5000, '76.00');
    assert.strictEqual(r.vysledok, 'supis-ulozeny');
    const zaznam = r.archiv[0];
    assert.ok(zaznam.supis, 'vznikol kľúč supis');
    assert.strictEqual(zaznam.ponukaPrepisanaSupisom, true);
    assert.deepStrictEqual(bez(zaznam, ['supis', 'ponukaPrepisanaSupisom', 'modifiedAt']), bez(stary, ['modifiedAt']),
        'vrchná úroveň sa nezmenila');
    assert.strictEqual(L.jePonukaPrepisanaSupisom(zaznam), true, 'poznámka ostáva');
    // ďalšie otvorenie súpisu už ide z kľúča supis
    const znova = L.otvorSupisZoZaznamu(zmraz(zaznam), PROFIL_INY, 'CP-2026-001');
    assert.strictEqual(znova.supisNadpis, 'STARÝ NADPIS');
    assert.strictEqual(znova.zlavy[0].zamknuta, 'ano');
});

test('A8 Duplikát: bez supis, obsahujeSupis a ponukaPrepisanaSupisom', () => {
    const { r2 } = scenarPonukaASupis();
    const zdroj = kopia(r2.archiv[0]);
    zdroj.ponukaPrepisanaSupisom = true;
    zmraz(zdroj);
    const dup = L.odstranSupisoveKluce(zdroj);
    ['supis', 'obsahujeSupis', 'ponukaPrepisanaSupisom', 'supisZdrojId'].forEach(k =>
        assert.ok(!(k in dup), `duplikát nemá ${k}`));
    assert.strictEqual(dup.polozky[0].mnozstvo, '2', 'duplikuje sa ponuka');
    assert.ok(zdroj.supis && zdroj.obsahujeSupis, 'zdroj ostal bez zmeny');
});

test('A9 Zlúčenie pri synchronizácii (_zlucArchiv z app.js)', () => {
    const { r2 } = scenarPonukaASupis();
    const soSupisom = zmraz(kopia(r2.archiv[0]));                    // modifiedAt 2000
    const novsiBezSupisu = zmraz(Object.assign(L.odstranSupisoveKluce(soSupisom), { modifiedAt: 9000, meno: 'Nové meno' }));

    // a) novší bez súpisu (lokálne), starší so súpisom (cloud) → výsledok so súpisom
    let v = _zlucArchiv([novsiBezSupisu], [soSupisom], 0, 0);
    assert.strictEqual(v.length, 1);
    assert.strictEqual(v[0].meno, 'Nové meno', 'vyhral novší záznam');
    assert.deepStrictEqual(v[0].supis, soSupisom.supis);
    assert.strictEqual(v[0].obsahujeSupis, true);
    // b) to isté opačne (novší je v cloude)
    v = _zlucArchiv([soSupisom], [novsiBezSupisu], 0, 0);
    assert.strictEqual(v[0].meno, 'Nové meno');
    assert.deepStrictEqual(v[0].supis, soSupisom.supis);
    // c) prenesie sa aj príznak prepísania
    const sPriznakom = zmraz(Object.assign(kopia(soSupisom), { ponukaPrepisanaSupisom: true }));
    v = _zlucArchiv([novsiBezSupisu], [sPriznakom], 0, 0);
    assert.strictEqual(v[0].ponukaPrepisanaSupisom, true);

    // d) oba so súpisom → ostane súpis s novším supis.modifiedAt (aj keď je záznam starší)
    const zaznamNovsi = kopia(soSupisom); zaznamNovsi.modifiedAt = 9000; zaznamNovsi.supis.modifiedAt = 3000; zaznamNovsi.supis.cislo = 'STARŠÍ SÚPIS';
    const zaznamStarsi = kopia(soSupisom); zaznamStarsi.modifiedAt = 8000; zaznamStarsi.supis.modifiedAt = 7000; zaznamStarsi.supis.cislo = 'NOVŠÍ SÚPIS';
    zmraz(zaznamNovsi); zmraz(zaznamStarsi);
    v = _zlucArchiv([zaznamNovsi], [zaznamStarsi], 0, 0);
    assert.strictEqual(v[0].modifiedAt, 9000, 'vrchná úroveň z novšieho záznamu');
    assert.strictEqual(v[0].supis.cislo, 'NOVŠÍ SÚPIS');
    v = _zlucArchiv([zaznamStarsi], [zaznamNovsi], 0, 0);
    assert.strictEqual(v[0].modifiedAt, 9000);
    assert.strictEqual(v[0].supis.cislo, 'NOVŠÍ SÚPIS');

    // e) záznam len na jednej strane ostáva (aj so súpisom)
    const lenLokal = zmraz(Object.assign(kopia(soSupisom), { id: 111 }));
    const lenCloud = zmraz(Object.assign(L.odstranSupisoveKluce(soSupisom), { id: 222 }));
    v = _zlucArchiv([lenLokal], [lenCloud], 0, 0);
    assert.strictEqual(v.length, 2);
    assert.deepStrictEqual(v.find(z => z.id === 111), lenLokal);
    assert.deepStrictEqual(v.find(z => z.id === 222), lenCloud);

    // f) bez súpisu na oboch stranách: ako doteraz (víťaz bez zmeny)
    const a = zmraz({ id: 5, modifiedAt: 10, cislo: 'A' });
    const b = zmraz({ id: 5, modifiedAt: 20, cislo: 'B' });
    v = _zlucArchiv([a], [b], 0, 0);
    assert.strictEqual(v[0], b);
    v = _zlucArchiv([b], [a], 0, 0);
    assert.strictEqual(v[0], b);
});

test('Zmrazené vstupy: funkcie nemenia vstup', () => {
    const { r2 } = scenarPonukaASupis();
    const z = zmraz(kopia(r2.archiv[0]));
    L.otvorPonukuZoZaznamu(z);
    L.otvorSupisZoZaznamu(z, PROFIL, 'CP');
    L.odstranSupisoveKluce(z);
    L.zlucZaznamSoSupisom(z, z);
    uloz([z], autosave(L.otvorSupisZoZaznamu(z, PROFIL, 'CP')), true, 1, '0');
    uloz([z], autosave(L.otvorPonukuZoZaznamu(z)), false, 1, '0');
});

let preslo = 0;
const chyby = [];
testy.forEach(([nazov, fn]) => {
    try { fn(); preslo++; console.log(`OK    ${nazov}`); }
    catch (e) { chyby.push(nazov); console.log(`CHYBA ${nazov}\n      ${e.message}`); }
});
console.log(`\nVýsledok: ${preslo} prešlo, ${chyby.length} zlyhalo.`);
if (chyby.length) process.exit(1);
