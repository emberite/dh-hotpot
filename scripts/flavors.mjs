/**
 * Flavor definitions for the Beast Feast campaign frame (Core Rulebook p. 279).
 * Each flavor maps to one die size; a flavor's strength (1–3) is how many of those dice it adds.
 */
export const MODULE_ID = 'dh-hotpot';

export const FLAVORS = {
    sweet: { faces: 4, color: '#f08fb6', ink: '#3b1022', icon: 'fa-solid fa-candy-cane' },
    salty: { faces: 6, color: '#7cbbe9', ink: '#0d2638', icon: 'fa-solid fa-cubes-stacked' },
    bitter: { faces: 8, color: '#8db75f', ink: '#16260a', icon: 'fa-solid fa-leaf' },
    sour: { faces: 10, color: '#ead451', ink: '#2e2805', icon: 'fa-solid fa-lemon' },
    savory: { faces: 12, color: '#e08a3c', ink: '#2e1504', icon: 'fa-solid fa-drumstick-bite' },
    weird: { faces: 20, color: '#ae78ec', ink: '#1f0b36', icon: 'fa-solid fa-eye' }
};

export const FLAVOR_KEYS = Object.keys(FLAVORS);

/** Localized flavor name, preferring the core module's own strings. */
export function flavorLabel(key) {
    const core = `DAGGERHEARTCORE.ItemCategories.ingredient.Flavor.${key}`;
    if (globalThis.game?.i18n?.has(core)) return game.i18n.localize(core);
    const own = `DHHOTPOT.Flavor.${key}`;
    if (globalThis.game?.i18n?.has(own)) return game.i18n.localize(own);
    return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Polygon outlines (viewBox 0 0 100 100) that read as each die type at a glance. */
const SHAPES = {
    4: '50,7 95,89 5,89',
    6: '14,14 86,14 86,86 14,86',
    8: '50,4 95,50 50,96 5,50',
    10: '50,4 95,40 50,96 5,40',
    12: '50,4 96,37 79,94 21,94 4,37',
    20: '50,3 93,27 93,73 50,97 7,73 7,27'
};
const TEXT_Y = { 4: 70, 6: 52, 8: 52, 10: 48, 12: 56, 20: 52 };
const INNER = {
    10: '<polyline points="5,40 50,58 95,40" class="hp-die-facet"/><line x1="50" y1="58" x2="50" y2="96" class="hp-die-facet"/>',
    20: '<polygon points="50,22 76,66 24,66" class="hp-die-facet"/>',
    8: '<line x1="5" y1="50" x2="95" y2="50" class="hp-die-facet"/>'
};

/**
 * Inline SVG for one die.
 * @param {number} faces
 * @param {string|number|null} value  shown in the middle; blank shows the die size
 * @param {string} [flavor]           colors the die
 */
export function dieSVG(faces, value = null, flavor = null) {
    const f = flavor ? FLAVORS[flavor] : Object.values(FLAVORS).find(x => x.faces === faces);
    const fill = f?.color ?? '#ccc';
    const ink = f?.ink ?? '#111';
    const label = value ?? `d${faces}`;
    const size = value === null ? (faces >= 10 ? 26 : 28) : String(value).length > 1 ? 36 : 42;
    return `<svg class="hp-die-svg" viewBox="0 0 100 100" aria-hidden="true">
<polygon points="${SHAPES[faces] ?? SHAPES[6]}" fill="${fill}" class="hp-die-body"/>${INNER[faces] ?? ''}
<text x="50" y="${TEXT_Y[faces] ?? 52}" fill="${ink}" font-size="${size}" class="hp-die-text">${label}</text>
</svg>`;
}

/** Token that can be discarded instead of a die (familiar recipes). */
export function tokenSVG() {
    return `<svg class="hp-die-svg" viewBox="0 0 100 100" aria-hidden="true">
<circle cx="50" cy="50" r="42" class="hp-token-body"/><circle cx="50" cy="50" r="31" class="hp-token-ring"/>
<text x="50" y="52" font-size="30" class="hp-die-text hp-token-text">&#9733;</text></svg>`;
}
