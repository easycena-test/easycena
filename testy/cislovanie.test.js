// Testy číslovania cenových ponúk (cislovanie.js) — bez knižníc.
// Spustenie: node testy/cislovanie.test.js
const assert = require('assert');
const { najdiMaxPoradie, zostavCislo, dalsieCislo } = require('../cislovanie.js');

// šablóna | rok | čísla v archíve | posledné použité | očakávané nové číslo
const pripady = [
    ['CP-{ROK}-{CISLO}', 2026, ['CP-2026-035'], 0, 'CP-2026-036'],
    ['CP-{ROK}-{CISLO}', 2027, ['CP-2026-035'], 0, 'CP-2027-001'],
    ['P{ROK}{CISLO}', 2027, ['P2026035 - Mitsubishi Electric'], 0, 'P2027001'],
    ['P{ROK}{CISLO}', 2026, ['P2026035 - Mitsubishi Electric'], 0, 'P2026036'],
    ['CP-{ROK}-{CISLO}', 2026, ['CP-2026-035', 'CP-2026-036 - MDV 12000 BTU'], 0, 'CP-2026-037'],
    ['CP-{ROK}-{CISLO}', 2026, ['CP-2026-036'], 50, 'CP-2026-051'],
    ['CP-{ROK}-{CISLO}', 2026, ['CP-2026-036'], 0, 'CP-2026-037'],
    ['CP-{CISLO}', 2027, ['CP-035'], 0, 'CP-036'],
    ['{CISLO}/{ROK}', 2027, ['035/2026', '004/2027'], 0, '005/2027'],
    ['CP.{ROK}+{CISLO}', 2027, ['CP.2027+007', 'CPX2027+099'], 0, 'CP.2027+008'],
    ['CP-{ROK}-{CISLO}', 2027, ['', undefined, 'ABC'], 0, 'CP-2027-001'],
    ['CP-{ROK}-{CISLO}', 2027, ['CP-2027-999'], 0, 'CP-2027-1000'],
    ['CP-{ROK}-{CISLO}', 2027, ['CP-2027-001', 'CP-2026-035'], 0, 'CP-2027-002'],
    ['CP-{ROK}-{CISLO}', 2026, ['CP-2026-035 - byt 2026'], 0, 'CP-2026-036'],
    ['CP-{ROK}-{CISLO}', 2026, ['  CP-2026-035'], 0, 'CP-2026-036'],
    ['CP-{ROK}', 2027, ['CP-2026', 'CP-2027'], 0, 'CP-2027'],
    ['P{ROK}{CISLO}', 2026, ['P2026035', 'P2026036 - Daikin 2027'], 0, 'P2026037'],
    // Doplnené: používateľ si v januári ručne nastavil formát s novým rokom
    ['P2027{CISLO}', 2027, ['P2026035 - Mitsubishi Electric'], 0, 'P2027001'],
    ['CP-2027-{CISLO}', 2027, ['CP-2026-034', 'CP-2026-035'], 0, 'CP-2027-001'],
    ['P2026{CISLO}', 2027, ['P2026035'], 0, 'P2026036'],
    ['CP26-{CISLO}', 2026, ['CP26-001'], 0, 'CP26-002'],
];

let preslo = 0;
const chyby = [];
pripady.forEach(([sablona, rok, cisla, posledne, ocakavane], i) => {
    const popis = `#${i + 1} ${sablona} | ${rok} | ${JSON.stringify(cisla)} | ${posledne}`;
    try {
        assert.strictEqual(dalsieCislo(sablona, rok, cisla, posledne), ocakavane);
        preslo++;
        console.log(`OK    ${popis} → ${ocakavane}`);
    } catch (e) {
        chyby.push(popis);
        console.log(`CHYBA ${popis} → čakalo sa ${ocakavane}, vyšlo ${e.actual}`);
    }
});

// Okrajové vstupy: nič nesmie spadnúť, výsledok je 0.
const okrajove = [
    () => assert.strictEqual(najdiMaxPoradie('CP-{ROK}', 2027, ['CP-2027']), 0),
    () => assert.strictEqual(najdiMaxPoradie(undefined, 2027, ['CP-2027-001']), 0),
    () => assert.strictEqual(najdiMaxPoradie('CP-{ROK}-{CISLO}', 2027, undefined), 0),
    () => assert.strictEqual(najdiMaxPoradie('CP-{ROK}-{CISLO}', 2027, [null, {}, 12]), 0),
    () => assert.strictEqual(najdiMaxPoradie('', 2027, ['']), 0),
    () => assert.strictEqual(zostavCislo('CP-{ROK}-{CISLO}', 2027, 7), 'CP-2027-007'),
    () => assert.strictEqual(zostavCislo('CP-{ROK}-{CISLO}', 2027, 1234), 'CP-2027-1234'),
    // nahrádza sa len prvý výskyt (ako doteraz)
    () => assert.strictEqual(zostavCislo('{ROK}-{CISLO}-{ROK}', 2027, 5), '2027-005-{ROK}'),
];
okrajove.forEach((t, i) => {
    try { t(); preslo++; console.log(`OK    okrajový prípad ${i + 1}`); }
    catch (e) { chyby.push('okrajový ' + (i + 1)); console.log(`CHYBA okrajový prípad ${i + 1}: ${e.message}`); }
});

console.log(`\nVýsledok: ${preslo} prešlo, ${chyby.length} zlyhalo.`);
if (chyby.length) process.exit(1);
