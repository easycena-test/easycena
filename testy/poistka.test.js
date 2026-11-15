// Testy poistky „neúplná aktualizácia“ (začiatok app.js) — bez knižníc.
// Spustenie: node testy/poistka.test.js
// Stráži, aby poistka nikdy nehlásila chybu pri správne načítanej appke,
// nezabudla na nič z pomocných súborov, čo app.js používa, stála pred prvým
// kódom, ktorý niečo zapína alebo zapisuje, a aby index.html a
// service-worker.js poznali každý pomocný súbor.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

// V repozitári je koreň o priečinok vyššie; pre skúšku na kópii sa dá zadať POISTKA_KOREN.
const KOREN = process.env.POISTKA_KOREN || path.join(__dirname, '..');
const citaj = (s) => fs.readFileSync(path.join(KOREN, s), 'utf8');
const app = citaj('app.js');
const index = citaj('index.html');
const sw = citaj('service-worker.js');

// Bez komentárov (aby zmienka v komentári nebola „použitie“). Komentár // sa
// berie len za začiatkom riadku alebo medzerou, takže 'https://' ostane.
const bezKomentarov = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

// Blok poistky a jej zoznam { súbor: [funkcie] }.
const zac = app.indexOf('// POISTKA: NEÚPLNÁ AKTUALIZÁCIA');
const KONIEC = '\n})();';
const kon = app.indexOf(KONIEC, zac);
const blok = zac > 0 && kon > zac ? app.slice(zac, kon + KONIEC.length) : '';
const zoznam = {};
const od = blok.indexOf('const potrebne = {');
if (od > 0) {
    for (const m of blok.slice(od, blok.indexOf('};', od)).matchAll(/'([\w.-]+\.js)':\s*\[([^\]]*)\]/g)) {
        zoznam[m[1]] = [...m[2].matchAll(/typeof (\w+)/g)].map(x => x[1]);
    }
}
const appBezPoistky = bezKomentarov(app.slice(0, zac) + app.slice(zac + blok.length));

// Pomocné súbory = .js v koreni s module.exports (čisté funkcie s Node testami).
const moduly = fs.readdirSync(KOREN)
    .filter(f => f.endsWith('.js') && f !== 'app.js' && /module\.exports/.test(citaj(f))).sort();

// Mená deklarované na najvyššej úrovni súboru (riadok začína deklaráciou).
const menaNaVrchu = (t) => [...t.matchAll(/^(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

const testy = [];
const test = (nazov, fn) => testy.push([nazov, fn]);

test('Poistka je v app.js a má zoznam súborov', () => {
    assert.ok(blok, 'V app.js sa nenašla poistka ukončená })();');
    assert.ok(od > 0, 'V poistke sa nenašiel zoznam potrebne');
    assert.ok(moduly.includes('cislovanie.js'), 'chýba cislovanie.js');
    assert.deepStrictEqual(Object.keys(zoznam).sort(), moduly,
        'Poistka musí poznať presne pomocné súbory tejto zostavy: ' + moduly.join(', '));
});

test('Žiadny falošný poplach: každá kontrolovaná funkcia v súbore naozaj je', () => {
    for (const subor of moduly) {
        const exporty = require(path.join(KOREN, subor));
        const vrch = menaNaVrchu(citaj(subor));
        for (const f of zoznam[subor] || []) {
            assert.strictEqual(typeof exporty[f], 'function', `${subor}: funkcia ${f} neexistuje — poistka by hlásila chybu pri každom otvorení`);
            assert.ok(vrch.includes(f), `${subor}: ${f} musí byť deklarovaná na najvyššej úrovni súboru`);
        }
    }
});

test('Nič nechýba: všetko z pomocných súborov, čo app.js používa, je v zozname', () => {
    for (const subor of moduly) {
        for (const meno of menaNaVrchu(citaj(subor))) {
            if (!new RegExp('(^|[^\\w$.])' + meno.replace(/\$/g, '\\$') + '(?![\\w$])').test(appBezPoistky)) continue;
            assert.ok((zoznam[subor] || []).includes(meno),
                `app.js používa ${meno} z ${subor}, ale poistka ho nekontroluje — dopíš ho (ak nejde o funkciu, sprav z neho funkciu)`);
        }
    }
});

test('app.js neprekrýva mená z pomocných súborov', () => {
    const vrchApp = new Set(menaNaVrchu(app));
    for (const subor of moduly) {
        for (const meno of menaNaVrchu(citaj(subor))) {
            assert.ok(!vrchApp.has(meno), `app.js deklaruje ${meno}, ktoré je aj v ${subor} — poistka by chýbajúci súbor neodhalila`);
        }
    }
});

test('index.html načíta každý pomocný súbor PRED app.js (bez async/defer)', () => {
    const ZNACKA_APP = '<script src="app.js"></script>';
    assert.ok(index.includes(ZNACKA_APP), 'index.html: chýba ' + ZNACKA_APP);
    for (const subor of moduly) {
        const znacka = `<script src="${subor}"></script>`;
        const p = index.indexOf(znacka);
        assert.ok(p > 0 && p < index.indexOf(ZNACKA_APP), `index.html: ${znacka} musí byť pred app.js (bez async/defer)`);
    }
});

test('Service worker má každý pomocný súbor v ASSETS_TO_CACHE aj medzi network-first', () => {
    for (const subor of moduly) {
        assert.ok(sw.includes(`'./${subor}'`), `service-worker.js: ${subor} chýba v ASSETS_TO_CACHE`);
        assert.ok(sw.includes(`path.endsWith('/${subor}')`), `service-worker.js: ${subor} chýba v jeDynamickyAsset`);
    }
});

// Inak by inštalácia nového service workera (cache.addAll = všetko alebo nič)
// zlyhala na každom zariadení a poistka by sa offline ukazovala stále.
// Porovnáva sa s gitom (presná veľkosť písmen, súbor musí byť v repozitári);
// mimo gitu s presnými menami v priečinku.
test('Každý vlastný súbor z ASSETS_TO_CACHE existuje (presne tak napísaný)', () => {
    const zac = sw.indexOf('ASSETS_TO_CACHE = [');
    const assets = sw.slice(zac, sw.indexOf('];', zac));
    let vGite = null;
    try { vGite = new Set(execSync('git ls-files', { cwd: KOREN, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n')); } catch (e) { /* nie je git */ }
    for (const m of assets.matchAll(/'\.\/([^']+)'/g)) {
        const s = m[1];
        if (vGite) {
            assert.ok(vGite.has(s), `service-worker.js: súbor ${s} z ASSETS_TO_CACHE nie je v gite (alebo má inú veľkosť písmen)`);
        } else {
            let priecinok = KOREN;
            for (const cast of s.split('/')) {
                assert.ok(fs.readdirSync(priecinok).includes(cast), `service-worker.js: súbor ${s} z ASSETS_TO_CACHE neexistuje`);
                priecinok = path.join(priecinok, cast);
            }
        }
    }
});

test('Pred poistkou je len registrácia service workera a VERZIA_APPKY', () => {
    const pred = bezKomentarov(app.slice(0, zac)).replace(/\s+/g, '');
    assert.ok(/^if\('serviceWorker'innavigator\)\{navigator\.serviceWorker\.register\('\.\/service-worker\.js'\);\}constVERZIA_APPKY='[^']+';$/.test(pred),
        'Pred poistkou smie byť iba registrácia service workera a const VERZIA_APPKY — poistka musí byť skôr než čokoľvek iné');
});

// Správanie bloku v izolovanom prostredí s jednoduchým falošným DOM.
function spusti(nacitane, { pokazeneHlasenie = false, doplnok = '' } = {}) {
    const log = { pripojene: [], reload: 0, alert: 0, klik: null, skryteVsetko: false, technicky: '' };
    const prvok = () => {
        if (pokazeneHlasenie) throw new Error('DOM nefunguje');
        const p = { style: {}, setAttribute() {}, children: [],
            appendChild(c) { this.children.push(c); },
            querySelector: () => ({ addEventListener: (typ, fn) => { log.klik = fn; } }) };
        return p;
    };
    const ctx = {
        VERZIA_APPKY: 'test',
        location: { hostname: 'skuska.local', reload() { log.reload++; } },
        alert() { log.alert++; },
        document: { createElement: prvok,
            documentElement: { style: { set display(v) { if (v === 'none') log.skryteVsetko = true; } } },
            head: { appendChild() { log.pripojene.push('style'); } },
            body: { appendChild(c) { log.pripojene.push(c.id); log.technicky = (c.children[0] || {}).textContent || ''; } } }
    };
    vm.createContext(ctx);
    for (const s of nacitane) vm.runInContext(citaj(s), ctx);
    let chyba = null;
    try { vm.runInContext(blok + doplnok, ctx); } catch (e) { chyba = e; }
    return { chyba, log };
}

test('Správne načítaná appka: poistka nič neurobí', () => {
    const r = spusti(moduly);
    assert.strictEqual(r.chyba, null, 'správne načítaná appka nesmie spustiť poistku');
    assert.deepStrictEqual(r.log.pripojene, [], 'správne načítaná appka nesmie nič pridať na stránku');
    assert.strictEqual(r.log.alert, 0);
});

test('Bez pomocných súborov: skrytie, hlásenie, „Skúsiť znova“ a zastavenie', () => {
    const r = spusti([]);
    assert.ok(r.chyba && /EasyCena poistka/.test(r.chyba.message), 'bez pomocných súborov sa app.js musí zastaviť');
    assert.deepStrictEqual(r.log.pripojene, ['style', 'poistka-hlasenie'], 'má pribudnúť skrytie appky a hlásenie');
    assert.strictEqual(r.log.alert, 0, 'náhradný alert len keď hlásenie zlyhá');
    assert.ok(r.log.technicky.includes('verzia test') && r.log.technicky.includes('skuska.local'), 'technický riadok má verziu a adresu');
    r.log.klik();
    assert.strictEqual(r.log.reload, 1, '„Skúsiť znova“ musí obnoviť stránku');
});

test('Chýba jeden pomocný súbor: zastavenie a jeho meno v hlásení', () => {
    for (const chyba of moduly) {
        const r = spusti(moduly.filter(m => m !== chyba));
        assert.ok(r.chyba && r.chyba.message.includes(chyba), `chýbajúci ${chyba} musí zastaviť app.js a byť v hlásení`);
        assert.ok(r.log.technicky.includes(chyba), `technický riadok musí menovať ${chyba}`);
    }
});

test('Keď sa hlásenie nedá zobraziť: skryť celú stránku, alert a aj tak zastaviť', () => {
    const r = spusti([], { pokazeneHlasenie: true });
    assert.ok(r.chyba && /EasyCena poistka/.test(r.chyba.message), 'app.js sa musí zastaviť aj bez hlásenia');
    assert.ok(r.log.skryteVsetko, 'celá stránka sa má skryť');
    assert.strictEqual(r.log.alert, 1, 'náhradný alert');
});

test('Keď spadne samotná kontrola: tiež zastaviť', () => {
    // Funkcia deklarovaná ako const neskôr v tom istom skripte → typeof na ňu spadne (TDZ).
    const meno = (zoznam['cislovanie.js'] || [])[0];
    const r = spusti([], { doplnok: `\nconst ${meno} = function () {};` });
    assert.ok(r.chyba && /EasyCena poistka/.test(r.chyba.message), 'kontrola, ktorá spadne, musí appku zastaviť');
    assert.deepStrictEqual(r.log.pripojene, ['style', 'poistka-hlasenie']);
});

let preslo = 0;
const chyby = [];
testy.forEach(([nazov, fn]) => {
    try { fn(); preslo++; console.log(`OK    ${nazov}`); }
    catch (e) { chyby.push(nazov); console.log(`CHYBA ${nazov}\n      ${e.message}`); }
});
console.log(`\nPomocné súbory: ${moduly.join(', ')}; kontrolovaných funkcií: ${Object.values(zoznam).flat().length}`);
console.log(`Výsledok: ${preslo} prešlo, ${chyby.length} zlyhalo.`);
if (chyby.length) process.exit(1);
