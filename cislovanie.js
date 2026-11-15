// =====================================================
// ČÍSLOVANIE CENOVÝCH PONÚK — čisté funkcie (bez DOM a localStorage)
// =====================================================
// Načítava sa v index.html PRED app.js (generujNoveCislo ich volá).
// V Node sa dajú načítať cez require — testy: node testy/cislovanie.test.js
//
// Šablóna čísla je text z Nastavení, napr. 'CP-{ROK}-{CISLO}'. Poradové číslo
// sa číta LEN z čísel, ktoré šablóne a danému roku zodpovedajú od začiatku
// reťazca. Iné roky, iné formáty a ďalšie číslice v texte za číslom (napr.
// „- MDV 12000 BTU“) sa ignorujú.

// Text šablóny berieme doslovne — špeciálne znaky regulárneho výrazu escapujeme.
function _escapujPreRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Najväčšie poradové číslo spomedzi čísel, ktoré zodpovedajú šablóne v danom
// roku. Nič nezodpovedá, chýba {CISLO} alebo zlý vstup → 0.
function najdiMaxPoradie(sablona, rok, zoznamCisel) {
    if (typeof sablona !== 'string' || sablona.indexOf('{CISLO}') === -1) return 0;

    // Prvý výskyt {ROK} a {CISLO} nahradíme značkami, zvyšok escapujeme
    // a značky potom nahradíme rokom a skupinou (\d+).
    const ZNACKA_ROK = '\u0000R\u0000';
    const ZNACKA_CISLO = '\u0000C\u0000';
    let vzor = sablona.replace('{ROK}', ZNACKA_ROK).replace('{CISLO}', ZNACKA_CISLO);
    vzor = _escapujPreRegex(vzor)
        .replace(ZNACKA_ROK, _escapujPreRegex(String(rok)))
        .replace(ZNACKA_CISLO, '(\\d+)');
    // Ukotvené na začiatok (úvodné medzery povolené); text za číslom neprekáža.
    const regex = new RegExp('^\\s*' + vzor);

    let max = 0;
    (Array.isArray(zoznamCisel) ? zoznamCisel : []).forEach(cislo => {
        if (typeof cislo === 'number') cislo = String(cislo);
        if (typeof cislo !== 'string') return;
        const zhoda = cislo.match(regex);
        if (!zhoda) return;
        const poradie = parseInt(zhoda[1], 10);
        if (poradie > max) max = poradie;
    });
    return max;
}

// Zloží číslo ponuky zo šablóny. Poradie doplní nulami na 3 miesta, väčšie
// čísla neskracuje. Nahrádza prvý výskyt {ROK} a {CISLO} (ako doteraz).
function zostavCislo(sablona, rok, poradie) {
    const naformatovane = String(poradie).padStart(3, '0');
    return String(sablona).replace('{ROK}', rok).replace('{CISLO}', naformatovane);
}

// Ďalšie číslo ponuky: o 1 vyššie než väčšie z (posledné použité poradie,
// najvyššie poradie v archíve pre túto šablónu a rok).
function dalsieCislo(sablona, rok, zoznamCisel, poslednePouzite) {
    const posledne = Math.max(parseInt(poslednePouzite, 10) || 0, najdiMaxPoradie(sablona, rok, zoznamCisel));
    return zostavCislo(sablona, rok, posledne + 1);
}

if (typeof module !== 'undefined') module.exports = { najdiMaxPoradie, zostavCislo, dalsieCislo };
