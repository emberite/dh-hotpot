/**
 * Dev tool (not loaded by the module): builds data/adversaries.mjs into real Daggerheart adversaries
 * and writes them to the module's "Beast Feast Adversaries" compendium.
 *
 * Run inside a Foundry world (GM) with the Daggerheart system and this module active:
 *   const { buildAdversaries } = await import('/modules/dh-hotpot/tools/build-adversaries.mjs');
 *   await buildAdversaries();
 *
 * Standard features (Relentless, Minion, Group Attack, Momentum, Terrifying, Slow, Flying) are cloned from the
 * system's own adversaries so they keep the system's automation.
 */
import { ADVERSARIES } from '../data/adversaries.mjs';

const PACK = 'dh-hotpot.beast-feast-adversaries';
const SYSTEM_PACK = 'daggerheart.adversaries';
const STD = {
    relentless: ['Acid Burrower', 'Relentless'],
    minion: ['Apprentice Assassin', 'Minion'],
    group: ['Apprentice Assassin', 'Group Attack'],
    momentum: ['Bear', 'Momentum'],
    terrifying: ['Banshee', 'Terrifying'],
    slow: ['Brawny Zombie', 'Slow'],
    flying: ['Dire Bat', 'Flying']
};
const WORDS = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
const TOKEN = { tiny: 0.5, small: 1, medium: 1, large: 2, huge: 3 };
const id = () => foundry.utils.randomID();

/** "2d10+3" → system damage value; plain numbers become a flat custom formula. */
function damageValue(formula) {
    const m = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(String(formula).trim());
    if (!m) return { custom: { enabled: true, formula: String(formula) }, multiplier: 'flat', flatMultiplier: 1, dice: 'd6', bonus: null };
    const bonus = m[4] ? Number(m[3] === '-' ? -m[4] : m[4]) : null;
    return { custom: { enabled: false, formula: '' }, multiplier: 'flat', flatMultiplier: Number(m[1]), dice: `d${m[2]}`, bonus };
}

function damagePart(formula, dtype = 'physical', applyTo = 'hitPoints') {
    return {
        value: { ...damageValue(formula), custom: { enabled: true, formula: String(formula) } },
        applyTo,
        type: applyTo === 'hitPoints' && dtype ? [dtype] : [],
        base: false,
        resultBased: false,
        valueAlt: null,
        includeBase: false,
        direct: false,
        fullRestore: false,
        itemId: null
    };
}

function resourcePart(key, amount) {
    return {
        value: { custom: { enabled: true, formula: String(amount) }, multiplier: 'flat', flatMultiplier: 1, dice: 'd6', bonus: null },
        applyTo: key,
        base: false,
        resultBased: false,
        valueAlt: null,
        fullRestore: false,
        itemId: null
    };
}

const costs = cost =>
    Object.entries(cost ?? {}).map(([key, value]) => ({ scalable: false, key, value, step: null, itemId: null, consumeOnSuccess: false }));

/** Build one action (+ an optional status effect on the item) for a custom feature. */
function buildAction(feature, a, itemEffects) {
    const actionId = id();
    const action = {
        _id: actionId,
        type: a.type === 'save' ? 'attack' : a.type,
        systemPath: 'actions',
        name: feature.name,
        img: feature.img,
        description: '',
        chatDisplay: true,
        actionType: feature.form === 'reaction' ? 'reaction' : 'action',
        cost: costs(a.cost),
        uses: { value: null, max: '', recovery: null, consumeOnSuccess: false },
        target: { type: 'any', amount: null },
        effects: [],
        range: a.range ?? '',
        areas: [],
        baseAction: false,
        originItem: { type: 'itemCollection' },
        triggers: []
    };
    if (['attack', 'save', 'damage', 'healing'].includes(a.type)) {
        const resources = {};
        for (const [key, n] of Object.entries(a.resource ?? {})) resources[key] = resourcePart(key, n);
        const main = a.type === 'healing'
            ? damagePart(a.heal ?? '1', null, 'hitPoints')
            : a.damage ? damagePart(a.damage, a.dtype ?? 'physical') : null;
        action.damage = { main, resources };
    }
    if (a.type === 'attack' || a.type === 'save') {
        action.roll = {
            type: a.type === 'attack' ? 'attack' : null,
            trait: null, difficulty: null, bonus: null, advState: 'neutral',
            diceRolling: { multiplier: 'prof', flatMultiplier: 1, dice: 'd6', compare: null, treshold: null },
            useDefault: false
        };
        action.save = { trait: a.type === 'save' ? a.save : null, difficulty: null, damageMod: a.half ? 'half' : 'none' };
    }
    if (a.status) {
        const effectId = id();
        itemEffects.push({
            _id: effectId,
            name: feature.name,
            img: feature.img,
            type: 'base',
            transfer: false,
            statuses: [a.status],
            system: { changes: [], duration: { type: 'act', description: '' } }
        });
        action.effects = [{ _id: effectId, onSave: false }];
    }
    return action;
}

function customFeature(f) {
    const effects = [];
    const actions = {};
    if (f.act) {
        const action = buildAction(f, f.act, effects);
        actions[action._id] = action;
    }
    return {
        _id: id(),
        name: f.name,
        type: 'feature',
        img: f.img,
        system: { description: f.text, featureForm: f.form, actions, resource: null, attribution: {} },
        effects
    };
}

async function loadStandardFeatures() {
    const pack = game.packs.get(SYSTEM_PACK);
    const actors = await pack.getDocuments();
    const out = {};
    for (const [key, [actorName, prefix]] of Object.entries(STD)) {
        const actor = actors.find(a => a.name === actorName);
        const item = actor?.items.find(i => i.name.startsWith(prefix));
        if (!item) throw new Error(`Standard feature ${prefix} not found on ${actorName}`);
        out[key] = item.toObject();
    }
    return out;
}

function standardFeature(std, f) {
    const data = foundry.utils.deepClone(std[f.std]);
    data._id = id();
    delete data._stats;
    const rename = (from, to) => {
        data.system.description = data.system.description.replaceAll(from, to);
    };
    if (f.std === 'relentless') {
        data.name = `Relentless (${f.n})`;
        rename(/up to \w+ times/g, `up to ${WORDS[f.n] ?? f.n} times`);
        for (const a of Object.values(data.system.actions)) if (a.uses) a.uses.max = String(f.n - 1);
    }
    if (f.std === 'minion') {
        data.name = `Minion (${f.n})`;
        rename(/For every \d+ damage/g, `For every ${f.n} damage`);
    }
    if (f.std === 'momentum') rename(/the Bear/g, 'the @Lookup[@name]');
    return data;
}

function harvestHTML(list) {
    const items = list
        .map(i => {
            const flavors = Object.entries(i.flavors).map(([k, n]) => `${k[0].toUpperCase()}${k.slice(1)} (${n})`).join(', ');
            return `<li><strong>${i.name}</strong>: ${flavors}${i.text ? `. <em>${i.text}</em>` : ''}</li>`;
        })
        .join('');
    return `<h3>Harvest</h3><ul>${items}</ul>`;
}

function actorData(def, std) {
    const items = def.features.map(f => (f.std ? standardFeature(std, f) : customFeature(f)));
    const atk = def.attack;
    const isMinion = def.type === 'minion';
    const experiences = Object.fromEntries((def.experiences ?? []).map(([name, value]) => [id(), { name, value, description: '' }]));
    const size = TOKEN[def.size] ?? 1;
    const resistance = {
        physical: { resistance: def.resist === 'physical', immunity: false, reduction: 0 },
        magical: { resistance: def.resist === 'magical', immunity: def.resist === 'magicalImmune', reduction: 0 }
    };
    return {
        name: def.name,
        type: 'adversary',
        img: def.img,
        system: {
            tier: def.tier,
            type: 'standard', // switched to the real type after creation so the system adds horde automation
            size: def.size,
            difficulty: def.difficulty,
            damageThresholds: isMinion ? { major: null, severe: null } : { major: def.thresholds[0], severe: def.thresholds[1] },
            resources: { hitPoints: { value: 0, max: def.hp }, stress: { value: 0, max: def.stress } },
            motivesAndTactics: def.motives,
            description: `<p>${def.description}</p>${harvestHTML(def.harvest)}`,
            experiences,
            resistance,
            attribution: { source: 'Hotpot: Beast Feast Cooking', page: null, artist: '' }
        },
        prototypeToken: {
            name: def.name,
            texture: { src: def.img },
            width: size,
            height: size,
            disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
            displayName: CONST.TOKEN_DISPLAY_MODES.HOVER,
            actorLink: false
        },
        items,
        flags: { 'dh-hotpot': { harvest: def.harvest } },
        _attack: atk
    };
}

async function applyAttack(actor, atk) {
    const isFlat = !/d/.test(String(atk.damage));
    const upd = {
        'system.attack.name': atk.name,
        'system.attack.range': atk.range,
        'system.attack.roll.bonus': atk.bonus,
        'system.attack.damage.main.type': [atk.dtype ?? 'physical'],
        'system.attack.damage.main.value': isFlat
            ? { custom: { enabled: true, formula: String(atk.damage) }, multiplier: 'flat', flatMultiplier: 1, dice: 'd6', bonus: null }
            : damageValue(atk.damage)
    };
    if (atk.img) upd['system.attack.img'] = atk.img;
    await actor.update(upd);
}

/**
 * Build everything into the module compendium (replacing what's there).
 * @returns {Promise<string[]>} summary lines
 */
export async function buildAdversaries({ pack: packId = PACK } = {}) {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error(`Missing pack ${packId}`);
    await pack.configure({ locked: false });
    const old = await pack.getDocuments();
    if (old.length) await Actor.deleteDocuments(old.map(a => a.id), { pack: packId });
    for (const f of pack.folders.contents) await f.delete();

    const folders = {};
    for (const t of [1, 2, 3, 4]) {
        folders[t] = await Folder.create({ name: `Tier ${t}`, type: 'Actor', sorting: 'a' }, { pack: packId });
    }

    const std = await loadStandardFeatures();
    const summary = [];
    for (const def of ADVERSARIES) {
        const data = actorData(def, std);
        const atk = data._attack;
        delete data._attack;
        // build in the world first so type changes run the system's automation, then copy into the pack
        const actor = await Actor.create(data);
        await applyAttack(actor, atk);
        if (def.type !== 'standard') await actor.update({ 'system.type': def.type });
        if (def.type === 'horde') {
            await new Promise(r => setTimeout(r, 300));
            await actor.update({ 'system.typeData.hordeDamage': def.hordeDamage, 'system.typeData.hordeHP': def.hordeHP ?? 1 });
        }
        const copy = actor.toObject();
        delete copy._id;
        copy.folder = folders[def.tier].id;
        await Actor.create(copy, { pack: packId });
        await actor.delete();
        summary.push(`T${def.tier} ${def.type.padEnd(8)} ${def.name}: ${copy.items.length} features`);
    }
    await pack.configure({ locked: true });
    return summary;
}
