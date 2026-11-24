/**
 * Pure rules for generating Beast Feast ingredients (Core Rulebook, Beast Feast frame).
 * No Foundry globals here so it can be tested in node.
 *
 *  - Hunting Beasts: an adversary's max HP sets how many ingredients it yields.
 *    The GM picks flavors: weaker adversaries lean toward small dice (Sweet, Salty, Bitter),
 *    stronger ones toward big dice (Sour, Savory, Weird).
 *  - Gathering Blooms: roll the Hope Die (d12) → one bloom with a single flavor at strength 1.
 *  - An ingredient has 1–3 flavors, each with strength 1–3.
 */
import { FLAVOR_KEYS } from './flavors.mjs';

/** HP guide. The book skips 11; it's treated as the 8–10 band. */
export function ingredientsForHP(maxHP) {
    const hp = Number(maxHP) || 0;
    if (hp <= 4) return 1;
    if (hp <= 7) return 2;
    if (hp <= 11) return 3;
    return 4;
}

/** Gathering Blooms table: Hope Die result → flavor. */
export function bloomFlavor(d12) {
    const r = Math.min(12, Math.max(1, Math.floor(Number(d12) || 1)));
    return FLAVOR_KEYS[Math.ceil(r / 2) - 1];
}

/** Flavor weights by adversary tier (small dice for weak beasts, big dice for strong ones). */
const TIER_WEIGHTS = {
    1: { sweet: 4, salty: 4, bitter: 3, sour: 1, savory: 0, weird: 0 },
    2: { sweet: 1, salty: 3, bitter: 4, sour: 3, savory: 1, weird: 0 },
    3: { sweet: 0, salty: 1, bitter: 2, sour: 4, savory: 4, weird: 1 },
    4: { sweet: 0, salty: 0, bitter: 1, sour: 2, savory: 4, weird: 4 }
};

function pickWeighted(weights, rng, exclude = new Set()) {
    const entries = Object.entries(weights).filter(([k, w]) => w > 0 && !exclude.has(k));
    const total = entries.reduce((n, [, w]) => n + w, 0);
    if (!total) return null;
    let roll = rng() * total;
    for (const [k, w] of entries) {
        roll -= w;
        if (roll < 0) return k;
    }
    return entries.at(-1)[0];
}

/**
 * Random flavor profile suited to an adversary.
 * @param {number} tier       1–4
 * @param {() => number} rng  returns [0, 1)
 * @param {{elite?: boolean}} opts  Leaders/Solos get a little stronger and weirder
 */
export function randomProfile(tier = 1, rng = Math.random, { elite = false } = {}) {
    const t = Math.min(4, Math.max(1, Math.floor(Number(tier) || 1)));
    const weights = { ...TIER_WEIGHTS[t] };
    if (elite) weights.weird += 2;
    const count = rng() < 0.4 ? 1 : rng() < 0.75 ? 2 : 3;
    const maxStrength = t >= 3 || elite ? 3 : 2;
    const profile = Object.fromEntries(FLAVOR_KEYS.map(k => [k, 0]));
    const used = new Set();
    for (let i = 0; i < count; i++) {
        const k = pickWeighted(weights, rng, used);
        if (!k) break;
        used.add(k);
        profile[k] = 1 + Math.floor(rng() * maxStrength);
    }
    // a lone flavor at strength 1 is a bit thin for a beast; give it some heft
    if (count === 1) {
        const [only] = used;
        profile[only] = Math.max(profile[only], 1 + Math.floor(rng() * maxStrength));
    }
    return profile;
}

/** Keep a profile within the rules: strengths 0–3 and no more than 3 flavors. */
export function clampProfile(profile) {
    const out = Object.fromEntries(FLAVOR_KEYS.map(k => [k, Math.min(3, Math.max(0, Math.floor(Number(profile?.[k]) || 0)))]));
    return out;
}

export function flavorCount(profile) {
    return FLAVOR_KEYS.filter(k => profile[k] > 0).length;
}

/** Adjust one flavor by delta, refusing a 4th flavor. Returns the new profile or null if refused. */
export function bumpFlavor(profile, key, delta) {
    const p = clampProfile(profile);
    const next = Math.min(3, Math.max(0, p[key] + delta));
    if (p[key] === 0 && next > 0 && flavorCount(p) >= 3) return null;
    p[key] = next;
    return p;
}

/** Name prefixes for blooms, by flavor. */
export const BLOOM_PREFIX = {
    sweet: ['Honeyed', 'Sugarglass', 'Candied', 'Syrup'],
    salty: ['Brine', 'Saltcrust', 'Tidewater', 'Crystal'],
    bitter: ['Gall', 'Ashen', 'Bitterroot', 'Charred'],
    sour: ['Tartling', 'Sharpleaf', 'Pucker', 'Vinegar'],
    savory: ['Umber', 'Smoky', 'Hearty', 'Marrowbright'],
    weird: ['Wyrd', 'Glimmer', 'Whispering', 'Inside-Out']
};

/** Core icons by ingredient part (names from the rulebook's generator tables). */
export const PART_ICONS = {
    feet: 'icons/commodities/biological/foot-black-grey.webp',
    powder: 'icons/commodities/materials/bowl-powder-teal.webp',
    limb: 'icons/consumables/meat/drumstick-bone-pink.webp',
    belly: 'icons/commodities/biological/organ-stomach.webp',
    fat: 'icons/consumables/meat/hock-fatty-skin-brown-red.webp',
    eggs: 'icons/consumables/eggs/egg-speckled-green.webp',
    marrow: 'icons/commodities/bones/bones-broken-marrow-white-red.webp',
    tongue: 'icons/commodities/biological/tongue-violet.webp',
    brain: 'icons/commodities/biological/organ-brain-pink.webp',
    ribs: 'icons/commodities/bones/bones-rib-tan.webp',
    organ: 'icons/commodities/biological/organ-liver-red.webp',
    flesh: 'icons/consumables/meat/hock-leg-pink-brown.webp',
    stones: 'icons/commodities/stone/boulder-pink.webp',
    eyes: 'icons/commodities/biological/eye-lizard-orange.webp',
    jelly: 'icons/commodities/materials/slime-thick-blue.webp',
    horn: 'icons/commodities/bones/horn-curved-orange.webp',
    meat: 'icons/consumables/meat/hock-bones-skin-red.webp',
    scales: 'icons/commodities/biological/shell-ridged-green.webp',
    wings: 'icons/commodities/materials/feather-colored-red.webp',
    secretion: 'icons/commodities/materials/slime-yellow.webp',
    flower: 'icons/commodities/flowers/blooms-purple.webp',
    roots: 'icons/consumables/plants/dried-stem-vine-root-bramble-brown.webp',
    stems: 'icons/consumables/plants/fern-stem-curved-green.webp',
    leaves: 'icons/consumables/plants/leaf-broad-blue.webp',
    bulbs: 'icons/commodities/materials/plant-seed-pod.webp',
    nuts: 'icons/consumables/nuts/hazelnuts-group-orange.webp',
    seeds: 'icons/consumables/nuts/mapleseed-green.webp',
    bark: 'icons/commodities/materials/plant-branch-brown-green.webp',
    berries: 'icons/consumables/fruit/berry-bunch-red-green.webp',
    fruit: 'icons/consumables/fruit/dragonfruit-red-green.webp',
    sap: 'icons/commodities/materials/liquid-orange.webp',
    pollen: 'icons/commodities/materials/bowl-powder-yellow.webp',
    fungi: 'icons/consumables/mushrooms/alien-spotted-blue.webp',
    nectar: 'icons/commodities/materials/liquid-purple.webp',
    pods: 'icons/commodities/materials/plant-seed-pod.webp',
    herbs: 'icons/consumables/plants/herb-tied-bundle-green.webp',
    algae: 'icons/consumables/plants/kelp-fern-glowing-green.webp',
    moss: 'icons/consumables/plants/grass-bundle-green.webp',
    grain: 'icons/consumables/grains/wheat-gold.webp',
    rind: 'icons/consumables/fruit/grapefruit-citrus-cut-orange.webp'
};

/** Fallback icon per dominant flavor. */
export const FLAVOR_ICONS = {
    sweet: 'icons/consumables/fruit/berry-leaf-pink.webp',
    salty: 'icons/commodities/materials/bowl-powder-grey.webp',
    bitter: 'icons/consumables/plants/herb-tied-bundle-green.webp',
    sour: 'icons/consumables/fruit/grapefruit-citrus-cut-orange.webp',
    savory: 'icons/consumables/meat/hock-leg-pink-brown.webp',
    weird: 'icons/commodities/materials/slime-purple.webp'
};

export function iconFor(part, profile) {
    const byPart = PART_ICONS[String(part ?? '').toLowerCase().trim()];
    if (byPart) return byPart;
    const top = FLAVOR_KEYS.reduce((best, k) => ((profile?.[k] ?? 0) > (profile?.[best] ?? 0) ? k : best), FLAVOR_KEYS[0]);
    return FLAVOR_ICONS[top];
}
