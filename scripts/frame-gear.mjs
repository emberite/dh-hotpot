/**
 * Beast Feast equipment: while enabled, the system's compendium browser starts filtered to the
 * Beast Feast campaign frame, and the character creation wizard suggests Beast Feast gear in place
 * of each class's standard suggestions ("PCs must choose their Tier 1 starting equipment from the
 * following tables instead of the equipment tables in chapter 2").
 */
import { MODULE_ID } from './flavors.mjs';

export const FRAME = 'Beast Feast';
const FRAME_KEY = 'system.attribution.campaignFrame';
const EQUIPMENT_TYPES = ['weapon', 'armor', 'loot', 'consumable'];
const RANGES = ['melee', 'veryClose', 'close', 'far', 'veryFar'];

/* ------------------------------------------------------------------ */
/*  Pure matching                                                     */
/* ------------------------------------------------------------------ */

/** Plain description of a weapon or armor item for matching. */
export function describe(item) {
    const s = item?.system ?? {};
    if (item?.type === 'armor') {
        return {
            kind: 'armor',
            score: Number(s.armor?.max ?? s.baseScore ?? 0) || 0,
            major: Number(s.baseThresholds?.major ?? 0) || 0,
            severe: Number(s.baseThresholds?.severe ?? 0) || 0
        };
    }
    const attack = s.attack ?? {};
    const parts = attack.damage?.parts;
    const main = parts?.main ?? (Array.isArray(parts) ? parts[0] : parts ? Object.values(parts)[0] : null);
    const type = [main?.type].flat().filter(Boolean)[0] ?? 'physical';
    return {
        kind: 'weapon',
        secondary: !!s.secondary || /secondary/i.test(item?.folder?.name ?? ''),
        trait: attack.roll?.trait ?? null,
        range: attack.range ?? null,
        type,
        burden: s.burden ?? null
    };
}

/** How well a candidate stands in for the reference. Higher is better. */
export function similarity(ref, cand) {
    if (ref.kind !== cand.kind) return -Infinity;
    if (ref.kind === 'armor') return -(Math.abs(ref.major - cand.major) + Math.abs(ref.severe - cand.severe) + 2 * Math.abs(ref.score - cand.score));
    let n = 0;
    if (ref.type === cand.type) n += 4;
    if (ref.trait && ref.trait === cand.trait) n += 3;
    const ri = RANGES.indexOf(ref.range);
    const ci = RANGES.indexOf(cand.range);
    if (ri >= 0 && ci >= 0) n += Math.max(0, 2 - Math.abs(ri - ci));
    if (ref.burden && ref.burden === cand.burden) n += 1;
    return n;
}

/**
 * Best Beast Feast replacement for a suggested item.
 * @param {object} ref          describe(...) of the class's suggestion
 * @param {{item:any, d:object}[]} pool  candidates with their descriptions
 */
export function bestMatch(ref, pool) {
    let best = null;
    let bestScore = -Infinity;
    for (const c of pool) {
        if (c.d.kind !== ref.kind) continue;
        if (ref.kind === 'weapon' && c.d.secondary !== ref.secondary) continue;
        const sc = similarity(ref, c.d);
        if (sc > bestScore) {
            best = c;
            bestScore = sc;
        }
    }
    return best?.item ?? null;
}

/* ------------------------------------------------------------------ */
/*  Runtime                                                           */
/* ------------------------------------------------------------------ */

export const enabled = () => game.settings.get(MODULE_ID, 'beastFeastGear');

let gearCache = null;
/** Beast Feast weapons and armor from the Core Rulebook module's campaign frame pack. */
async function frameGear() {
    if (gearCache) return gearCache;
    const pack = game.packs.get('daggerheart-core.campaign-frame-items');
    if (!pack) return [];
    const docs = await pack.getDocuments();
    gearCache = docs
        .filter(i => ['weapon', 'armor'].includes(i.type) && i.system?.attribution?.campaignFrame === FRAME)
        .map(item => ({ item, d: describe(item) }));
    return gearCache;
}

function patchItemBrowser(ItemBrowser) {
    const proto = ItemBrowser.prototype;
    const createFieldFilter = proto._createFieldFilter;
    proto._createFieldFilter = async function (...args) {
        const filters = await createFieldFilter.apply(this, args);
        try {
            const types = [this.selectedMenu?.data?.type ?? []].flat();
            const items = this.items ?? [];
            const frames = [...new Set(items.map(i => i.system?.attribution?.campaignFrame).filter(Boolean))].sort();
            if (!types.some(t => EQUIPMENT_TYPES.includes(t)) || !frames.length || filters.some(f => f.key === FRAME_KEY)) return filters;
            const preset = this.presets?.filter?.campaignFrame;
            const value = preset ? preset.value : enabled() && frames.includes(FRAME) ? FRAME : undefined;
            filters.push({
                key: FRAME_KEY,
                name: 'campaignFrame',
                label: 'DHHOTPOT.Gear.FilterLabel',
                choices: frames.map((s, index) => ({ value: s, label: s, index })),
                value
            });
        } catch (err) {
            console.error(`${MODULE_ID} | campaign frame filter`, err);
        }
        return filters;
    };

    // The filter template marks the selected option by index; sync our preset into the dropdown.
    const createFilterInputs = proto._createFilterInputs;
    proto._createFilterInputs = function (...args) {
        const f = this.fieldFilter?.find(x => x.name === 'campaignFrame');
        const select = this.element?.querySelector('select[name="campaignFrame"]');
        if (f && select) {
            const idx = f.choices.findIndex(c => c.value === f.value);
            select.value = idx >= 0 ? String(idx) : '';
        }
        return createFilterInputs.apply(this, args);
    };
}

function patchCharacterCreation(CharacterCreation) {
    const proto = CharacterCreation.prototype;
    const getSuggestions = proto.getEquipmentSuggestions;
    proto.getEquipmentSuggestions = async function (...args) {
        const out = await getSuggestions.apply(this, args);
        if (!enabled()) return out;
        try {
            const pool = await frameGear();
            if (!pool.length) return out;
            for (const key of ['armor', 'primaryWeapon', 'secondaryWeapon']) {
                const ref = out?.[key];
                if (!ref) continue;
                const d = describe(ref);
                if (key === 'secondaryWeapon') d.secondary = true;
                if (key === 'primaryWeapon') d.secondary = false;
                const swap = bestMatch(d, pool);
                if (swap) out[key] = swap;
            }
        } catch (err) {
            console.error(`${MODULE_ID} | Beast Feast starting gear`, err);
        }
        return out;
    };
}

export function registerFrameGear() {
    const apps = game.system.api?.applications;
    if (apps?.ui?.ItemBrowser) patchItemBrowser(apps.ui.ItemBrowser);
    if (apps?.characterCreation?.CharacterCreation) patchCharacterCreation(apps.characterCreation.CharacterCreation);
}
