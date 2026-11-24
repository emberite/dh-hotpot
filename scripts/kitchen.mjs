import { FLAVORS, FLAVOR_KEYS, MODULE_ID, dieSVG, flavorLabel, tokenSVG } from './flavors.mjs';
import { CookSession, autoSplit, buildDice, detectFeatures, profileKey, profileOf } from './cooking.mjs';
import { broadcast, run } from './relay.mjs';
import { postMealCard } from './chat.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const DEFAULT_IMG = 'systems/daggerheart/assets/icons/documents/items/open-treasure-chest.svg';
export const CORE_ART = 'modules/daggerheart-core/assets/art';
/** The Core Rulebook's painted Beast Feast pot (transparent background). */
export const POT_ART = `${CORE_ART}/frame-259-beastfeast-meal-cavemushblackbonebroth.webp`;
/** Watchers can't drive the kitchen; this wraps every action that changes the meal. */
const guard = fn =>
    function (event, target) {
        if (this.watching) return;
        return fn.call(this, event, target);
    };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const L = (key, data) => (data ? game.i18n.format(`DHHOTPOT.${key}`, data) : game.i18n.localize(`DHHOTPOT.${key}`));

/** Display art for the rulebook ingredients, which ship with the generic chest icon. Never written to the item. */
const ART = {
    aciddragonsaliva: { core: 'frame-259-beastfeast-ingedient-aciddragonsaliva.webp', icon: 'icons/consumables/potions/bottle-bulb-corked-green.webp' },
    direbearmeat: { core: 'frame-259-beastfeast-ingedient-diremeat.webp', icon: 'icons/consumables/meat/hock-leg-pink-brown.webp' },
    rileroot: { core: 'frame-259-beastfeast-ingedient-rileroot.webp', icon: 'icons/consumables/plants/dried-stem-vine-root-bramble-brown.webp' },
    wyverntongue: { core: 'frame-259-beastfeast-ingedient-wyverntongue.webp', icon: 'icons/commodities/biological/tongue-violet.webp' },
    mushroomcaps: { icon: 'icons/consumables/mushrooms/bell-shiitake-brown.webp' },
    oozemarrow: { icon: 'icons/commodities/materials/slime-green.webp' },
    caveboarmilk: { icon: 'icons/consumables/drinks/pitcher-dripping-white.webp' },
    ogrekidneystone: { icon: 'icons/commodities/stone/boulder-pink.webp' },
    holycowsmilk: { icon: 'icons/consumables/drinks/clay-jar-glowing-orange-blue.webp' },
    deathflower: { icon: 'icons/commodities/flowers/buds-black-red.webp' },
    diregazelleskullmarrow: { icon: 'icons/commodities/bones/skull-tusked-grey.webp' },
    ghostscorpionvenom: { icon: 'icons/creatures/abilities/stinger-poison-scorpion-brown.webp' }
};
const MEAL_ART = [
    'frame-259-beastfeast-meal-cavemushblackbonebroth.webp',
    'frame-259-beastfeast-meal-monsterskewers.webp',
    'frame-259-beastfeast-meal-tushtoothonthornwoodwbloodfruit.webp'
];

export const hasCoreArt = () => !!game.modules.get('daggerheart-core')?.active;

/** Sheet themes shipped by the core rulebook module; the kitchen borrows their palette. */
export const THEMES = ['daggerheart-core', 'beast-feast', 'witherwild', 'five-banners', 'age-of-umbra', 'motherboard', 'colossus'];

/** 'auto' follows the theme picked for the party sheet, falling back to Beast Feast. */
export function resolveTheme(party) {
    const pick = game.settings.get(MODULE_ID, 'theme');
    if (pick !== 'auto') return pick;
    let theme = null;
    try {
        if (party) theme = foundry.applications.apps.DocumentSheetConfig.getThemeForDocument(party);
    } catch (err) {
        /* no sheet theme configured */
    }
    return THEMES.includes(theme) ? theme : 'beast-feast';
}
const slug = s => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

export function isIngredient(item) {
    return item?.type === 'loot' && item.system?.category === 'ingredient';
}

function ingredientImg(item) {
    if (item.img && item.img !== DEFAULT_IMG) return item.img;
    const art = ART[slug(item.name)];
    if (art?.core && hasCoreArt()) return `${CORE_ART}/${art.core}`;
    return art?.icon ?? 'icons/tools/cooking/bowl-steaming-brown.webp';
}

function flavorsOf(item) {
    const data = item.system.categoryData ?? {};
    return Object.fromEntries(FLAVOR_KEYS.map(k => [k, Number(data[k]) || 0]));
}

function flavorChips(flavors) {
    return FLAVOR_KEYS.filter(k => flavors[k] > 0).map(k => ({
        key: k,
        n: flavors[k],
        label: flavorLabel(k),
        color: FLAVORS[k].color,
        faces: FLAVORS[k].faces,
        die: dieSVG(FLAVORS[k].faces, null, k)
    }));
}

function featureNames(item) {
    const html = item.system.description ?? '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return { keys: detectFeatures(html), text: div.textContent.trim() };
}

export class HotpotKitchen extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'dh-hotpot-kitchen',
        classes: ['dh-hotpot'],
        tag: 'div',
        window: { title: 'DHHOTPOT.Title', icon: 'fa-solid fa-fire-burner', resizable: true },
        position: { width: 1180, height: 800 },
        actions: {
            switchTab: HotpotKitchen.#onTab,
            addToPot: guard(HotpotKitchen.#onAddToPot),
            removeFromPot: guard(HotpotKitchen.#onRemoveFromPot),
            emptyPot: guard(HotpotKitchen.#onEmptyPot),
            toggleDiner: guard(HotpotKitchen.#onToggleDiner),
            gather: guard(HotpotKitchen.#onGather),
            startCooking: guard(HotpotKitchen.#onStartCooking),
            roll: guard(HotpotKitchen.#onRoll),
            discard: guard(HotpotKitchen.#onDiscard),
            autoCook: guard(HotpotKitchen.#onAutoCook),
            toServing: guard(HotpotKitchen.#onToServing),
            alloc: HotpotKitchen.#onAlloc,
            autoAlloc: HotpotKitchen.#onAutoAlloc,
            serve: guard(HotpotKitchen.#onServe),
            reset: guard(HotpotKitchen.#onReset),
            leaveWatch: HotpotKitchen.#onLeaveWatch,
            openSheet: HotpotKitchen.#onOpenSheet,
            cookAgain: guard(HotpotKitchen.#onCookAgain),
            deleteRecipe: guard(HotpotKitchen.#onDeleteRecipe)
        }
    };

    static PARTS = {
        main: {
            template: `modules/${MODULE_ID}/templates/kitchen.hbs`,
            scrollable: ['.hp-pantry-list', '.hp-cookbook-list', '.hp-diners', '.hp-log']
        }
    };

    tab = 'kitchen';
    phase = 'prep';
    pot = [];
    recipe = { name: '', description: '' };
    diners = null;
    tierOverride = null;
    session = null;
    rolling = false;
    autoCooking = false;
    allocation = {};
    served = null;
    /** {id, name} of the user whose kitchen we are watching, or null. */
    watching = null;
    /** True while this client is the cook and everyone else is following along. */
    live = false;
    /** Cook we walked away from; their routine updates are ignored until they summon again. */
    ignoreCook = null;
    #potSeq = 0;
    #hookIds = [];
    #spin = null;
    #sizzlePending = false;
    #inputTimer = null;

    /* ---------------------------------------- */
    /*  Live sync                               */
    /* ---------------------------------------- */

    snapshot() {
        return {
            cook: { id: game.user.id, name: game.user.name },
            phase: this.phase,
            pot: this.pot,
            recipe: this.recipe,
            diners: [...this.dinerIds],
            tierOverride: this.tierOverride,
            session: this.session?.toJSON() ?? null,
            rolling: this.rolling,
            autoCooking: this.autoCooking,
            allocation: this.allocation,
            served: this.served
        };
    }

    /** Send our state to every other client. `summon` pops the kitchen open for them. */
    broadcastState(summon = false) {
        if (!this.live || this.watching) return;
        broadcast('kitchen:state', { snap: this.snapshot(), summon });
    }

    /** Adopt the cook's state and become a read-only watcher. */
    applySnapshot(snap, { summon = false } = {}) {
        const before = this.session?.sets.length ?? 0;
        this.watching = snap.cook;
        this.live = false;
        this.ignoreCook = null;
        this.autoCooking = false;
        this.phase = snap.phase;
        this.pot = snap.pot ?? [];
        this.recipe = snap.recipe ?? { name: '', description: '' };
        this.diners = new Set(snap.diners ?? []);
        this.tierOverride = snap.tierOverride;
        this.session = snap.session ? CookSession.fromJSON(snap.session) : null;
        this.rolling = !!snap.rolling;
        this.allocation = snap.allocation ?? {};
        this.served = snap.served ?? null;
        if (summon) this.tab = 'kitchen';
        this.#sizzlePending = !this.rolling && (this.session?.sets.length ?? 0) > before;
    }

    /** The cook finished or abandoned the feast. */
    endWatch(fromId) {
        if (this.watching?.id !== fromId) return;
        this.watching = null;
        if (this.phase !== 'done') this.#resetLocal();
        if (this.rendered) this.render();
    }

    /** A watcher adjusted their own character's share of the meal. */
    remoteAlloc({ actorId, res, delta, auto }, fromId) {
        if (!this.live || this.watching || this.phase !== 'serving') return;
        const actor = game.actors.get(actorId);
        const user = game.users.get(fromId);
        if (!actor || !user || !actor.testUserPermission(user, 'OWNER') || !this.dinerIds.has(actorId)) return;
        auto ? this.#applyAutoAlloc(actorId) : this.#applyAlloc(actorId, res, Number(delta));
        this.render();
    }

    #resetLocal() {
        this.autoCooking = false;
        this.phase = 'prep';
        this.pot = [];
        this.recipe = { name: '', description: '' };
        this.session = null;
        this.rolling = false;
        this.allocation = {};
        this.served = null;
        this.diners = null;
    }

    /* ---------------------------------------- */
    /*  Data                                    */
    /* ---------------------------------------- */

    get party() {
        return game.actors.party ?? null;
    }

    get members() {
        const party = this.party;
        const list = party
            ? party.system.partyMembers.filter(a => a && a.type === 'character')
            : game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
        return list;
    }

    get cookbookKey() {
        return this.party?.id ?? 'world';
    }

    get cookbook() {
        return game.settings.get(MODULE_ID, 'cookbooks')?.[this.cookbookKey] ?? [];
    }

    get partyTier() {
        if (this.tierOverride) return this.tierOverride;
        const tiers = this.members.map(a => Number(a.system.tier) || 1);
        return tiers.length ? Math.max(...tiers) : 1;
    }

    get dinerIds() {
        if (!this.diners) this.diners = new Set(this.members.map(a => a.id));
        return this.diners;
    }

    get profile() {
        return profileOf(this.pot);
    }

    get familiar() {
        const key = profileKey(this.profile);
        if (!key) return null;
        return this.cookbook.find(r => r.profileKey === key) ?? null;
    }

    get potFeatures() {
        return [...new Set(this.pot.flatMap(e => e.features))];
    }

    #sources() {
        const actors = [...this.members];
        if (this.party) actors.push(this.party);
        return actors.map(actor => {
            const items = actor.items.filter(isIngredient);
            const count = items.reduce((n, i) => n + (i.system.quantity ?? 1), 0);
            const isChar = actor.type === 'character';
            const max = isChar ? Math.max(0, ...Object.values(actor.system.traits ?? {}).map(t => Number(t.value) || 0)) : null;
            return {
                id: actor.id,
                uuid: actor.uuid,
                name: actor.name,
                img: actor.img,
                isParty: !isChar,
                carry: isChar ? { count, max, over: count > max } : null,
                items: items.map(item => this.#pantryItem(item)).sort((a, b) => a.name.localeCompare(b.name))
            };
        });
    }

    #pantryItem(item) {
        const qty = item.system.quantity ?? 1;
        const inPot = this.pot.filter(e => e.uuid === item.uuid).length;
        const { keys, text } = featureNames(item);
        const flavors = flavorsOf(item);
        return {
            uuid: item.uuid,
            name: item.name,
            img: ingredientImg(item),
            qty,
            avail: qty - inPot,
            empty: qty - inPot <= 0,
            chips: flavorChips(flavors),
            bland: !Object.values(flavors).some(Boolean),
            hasFeature: keys.length > 0,
            tooltip: text
        };
    }

    async #addItem(item, { consumable = true } = {}) {
        if (!isIngredient(item)) {
            ui.notifications.warn(L('Errors.NotIngredient', { name: item?.name ?? '?' }));
            return;
        }
        if (consumable) {
            const inPot = this.pot.filter(e => e.uuid === item.uuid).length;
            if (inPot >= (item.system.quantity ?? 1)) return;
        }
        this.pot.push(this.#potEntry(item, consumable));
        this.render();
    }

    #potEntry(item, consumable = true) {
        const { keys, text } = featureNames(item);
        return {
            key: `p${this.#potSeq++}`,
            uuid: item.uuid,
            owner: item.parent?.name ?? null,
            consumable: consumable && !!item.parent,
            name: item.name,
            img: ingredientImg(item),
            flavors: flavorsOf(item),
            features: keys,
            featureText: text
        };
    }

    /**
     * Match a cookbook recipe's ingredients against what the party carries right now.
     * Ingredients are matched by name (the original items were used up), one serving each.
     * @returns {{items: Item[], have: boolean[], missing: string[]}}
     */
    #planRecipe(recipe) {
        const norm = n => String(n ?? '').trim().toLowerCase();
        const pool = new Map();
        const holders = [...this.members, ...(this.party ? [this.party] : [])];
        for (const item of holders.flatMap(a => a.items.filter(isIngredient))) {
            const k = norm(item.name);
            if (!pool.has(k)) pool.set(k, []);
            pool.get(k).push({ item, left: item.system.quantity ?? 1 });
        }
        const items = [];
        const have = [];
        const missing = [];
        for (const ing of recipe.ingredients ?? []) {
            const slot = pool.get(norm(ing.name))?.find(x => x.left > 0);
            if (slot) {
                slot.left--;
                items.push(slot.item);
                have.push(true);
            } else {
                have.push(false);
                missing.push(ing.name);
            }
        }
        return { items, have, missing };
    }

    /* ---------------------------------------- */
    /*  Context                                 */
    /* ---------------------------------------- */

    async _prepareContext(options) {
        const ctx = await super._prepareContext(options);
        const profile = this.profile;
        const totalDice = FLAVOR_KEYS.reduce((n, k) => n + profile[k], 0);
        const familiar = this.familiar;
        const tokens = familiar ? this.partyTier : 0;
        const coreArt = hasCoreArt();

        Object.assign(ctx, {
            tab: { kitchen: this.tab === 'kitchen', cookbook: this.tab === 'cookbook' },
            phase: { [this.phase]: true },
            phaseName: this.phase,
            steps: ['prep', 'cooking', 'serving', 'done'].map((p, i, arr) => ({
                label: L(`Step.${p}`),
                n: i + 1,
                active: p === this.phase,
                complete: arr.indexOf(this.phase) > i
            })),
            isGM: game.user.isGM,
            noParty: !this.party,
            watching: this.watching,
            live: this.live && !this.watching,
            cookbook: this.#cookbookContext()
        });

        if (this.phase === 'prep') {
            const dice = buildDice(this.pot);
            const sources = this.#sources();
            const top = FLAVOR_KEYS.reduce((best, k) => (profile[k] > (profile[best] ?? 0) ? k : best), null);
            Object.assign(ctx, {
                sources,
                hasIngredients: sources.some(s => s.items.length),
                brothColor: top ? FLAVORS[top].color : '#6b4a2b',
                potArt: coreArt ? POT_ART : null,
                pot: this.pot.map(e => ({ ...e, chips: flavorChips(e.flavors), hasFeature: e.features.length > 0 })),
                potEmpty: !this.pot.length,
                previewDice: dice.map(d => ({ html: dieSVG(d.faces, null, d.flavor), flavor: d.flavor })),
                tokens: Array.from({ length: tokens }, () => tokenSVG()),
                totalDice,
                diceSummary: this.#diceSummary(profile),
                profileBar: FLAVOR_KEYS.filter(k => profile[k]).map(k => ({
                    key: k,
                    label: flavorLabel(k),
                    n: profile[k],
                    color: FLAVORS[k].color,
                    pct: (profile[k] / totalDice) * 100
                })),
                familiar,
                tier: this.partyTier,
                tokensCount: tokens,
                features: this.potFeatures.map(k => ({ key: k, label: L(`Feature.${k}.name`), hint: L(`Feature.${k}.hint`) })),
                diners: this.members.map(a => ({ id: a.id, name: a.name, img: a.img, on: this.dinerIds.has(a.id) })),
                recipe: this.recipe,
                canCook: this.pot.length > 0 && this.dinerIds.size > 0,
                oneDie: totalDice === 1,
                bubbleLevel: Math.min(100, totalDice * 6)
            });
        }

        if (this.phase === 'cooking') Object.assign(ctx, this.#cookingContext());
        if (this.phase === 'serving') Object.assign(ctx, this.#servingContext());
        if (this.phase === 'done') {
            Object.assign(ctx, {
                served: this.served,
                mealArt: coreArt ? `${CORE_ART}/${MEAL_ART[(this.served?.rating ?? 0) % MEAL_ART.length]}` : null
            });
        }
        return ctx;
    }

    #diceSummary(profile) {
        return FLAVOR_KEYS.filter(k => profile[k])
            .reverse()
            .map(k => `${profile[k]}d${FLAVORS[k].faces}`)
            .join(' + ');
    }

    #cookingContext() {
        const s = this.session;
        const showRoll = !this.rolling && s.lastRoll.length;
        const tray = (showRoll ? s.lastRoll : s.remaining).map(d => ({
            id: d.id,
            flavor: d.flavor,
            faces: d.faces,
            html: dieSVG(d.faces, this.rolling ? '?' : showRoll ? d.value : null, d.flavor),
            matched: showRoll && d.matched,
            discarded: showRoll && d.discarded,
            pickable: s.awaitingDiscard && !d.matched && !d.discarded
        }));
        if (s.done && s.remaining.length === 1 && s.lastRoll.length) {
            const last = tray.find(d => d.id === s.remaining[0].id);
            if (last) last.lastOne = true;
        }
        const total = s.remaining.length + s.sets.reduce((n, x) => n + x.dice.length, 0) + s.discarded.length;
        return {
            recipe: this.recipe,
            rolling: this.rolling,
            autoCooking: this.autoCooking,
            tray,
            tokens: Array.from({ length: s.tokens }, () => tokenSVG()),
            hasTokens: s.tokens > 0,
            awaitingDiscard: s.awaitingDiscard,
            canRoll: !s.done && !s.awaitingDiscard && !this.rolling && !this.autoCooking,
            done: s.done,
            round: s.round,
            remainingCount: s.remaining.length,
            progress: Math.round(((total - s.remaining.length) / Math.max(1, total - 1)) * 100),
            sets: s.sets.map(set => ({
                value: set.value,
                fresh: set.round === s.round && !this.rolling,
                dice: set.dice.map(d => dieSVG(d.faces, d.value, d.flavor))
            })),
            rating: s.baseRating,
            lastDrop: s.lastDrop,
            discardedDice: s.discarded.map(d => dieSVG(d.faces, d.value, d.flavor)),
            log: [...s.log].reverse().map(l => ({
                round: l.round,
                text: l.matches.length
                    ? L('Log.Matched', { values: l.matches.join(', ') })
                    : l.discarded === 'token'
                      ? L('Log.Token')
                      : l.discarded
                        ? L('Log.Discarded', { die: `d${l.discarded.faces}`, value: l.discarded.value })
                        : L('Log.NoMatch'),
                good: l.matches.length > 0
            })),
            features: [...s.features].map(k => ({ key: k, label: L(`Feature.${k}.name`), hint: L(`Feature.${k}.hint`) }))
        };
    }

    #servingContext() {
        const out = this.session.outcome;
        const diners = this.members
            .filter(a => this.dinerIds.has(a.id))
            .map(a => {
                const r = a.system.resources;
                const caps = this.#caps(a, out);
                const alloc = this.allocation[a.id] ?? { hp: 0, stress: 0, hope: 0 };
                const used = alloc.hp + alloc.stress + alloc.hope;
                const canEdit = !this.watching || a.isOwner;
                const track = (max, marked, heal, kind) =>
                    Array.from({ length: max }, (_, i) => ({
                        state:
                            kind === 'hope'
                                ? i < marked
                                    ? 'filled'
                                    : i < marked + heal
                                      ? 'gain'
                                      : 'empty'
                                : i < marked - heal
                                  ? 'marked'
                                  : i < marked
                                    ? 'heal'
                                    : 'empty'
                    }));
                return {
                    id: a.id,
                    name: a.name,
                    img: a.img,
                    alloc,
                    used,
                    left: out.rating - used,
                    full: used >= out.rating,
                    pct: out.rating ? (used / out.rating) * 100 : 100,
                    canEdit,
                    rows: [
                        { res: 'hp', label: L('Res.hp'), icon: 'fa-solid fa-heart', value: alloc.hp, cap: caps.hp,
                          detail: `${r.hitPoints.value}/${r.hitPoints.max}`, pips: track(r.hitPoints.max, r.hitPoints.value, alloc.hp, 'hp'),
                          canUp: canEdit && used < out.rating && alloc.hp < caps.hp, canDown: canEdit && alloc.hp > 0 },
                        { res: 'stress', label: L('Res.stress'), icon: 'fa-solid fa-bolt', value: alloc.stress, cap: caps.stress,
                          detail: `${r.stress.value}/${r.stress.max}`, pips: track(r.stress.max, r.stress.value, alloc.stress, 'stress'),
                          canUp: canEdit && used < out.rating && alloc.stress < caps.stress, canDown: canEdit && alloc.stress > 0, locked: out.noStress },
                        { res: 'hope', label: L('Res.hope'), icon: 'fa-solid fa-sun', value: alloc.hope, cap: caps.hope,
                          detail: `${r.hope.value}/${r.hope.max}`, pips: track(r.hope.max, r.hope.value, alloc.hope, 'hope'),
                          canUp: canEdit && used < out.rating && alloc.hope < caps.hope, canDown: canEdit && alloc.hope > 0 }
                    ]
                };
            });
        return {
            recipe: this.recipe,
            outcome: out,
            rating: out.rating,
            sets: this.session.sets.map(set => ({ value: set.value, dice: set.dice.map(d => dieSVG(d.faces, d.value, d.flavor)) })),
            lastDrop: out.lastDrop,
            diners,
            noDiners: !diners.length,
            showAlloc: !out.fullClear && out.rating > 0
        };
    }

    #caps(actor, out = this.session.outcome) {
        const r = actor.system.resources;
        return {
            hp: Math.max(0, r.hitPoints.value),
            stress: out.noStress ? 0 : Math.max(0, r.stress.value),
            hope: Math.max(0, r.hope.max - r.hope.value)
        };
    }

    #cookbookContext() {
        const busy = !!this.watching || !['prep', 'done'].includes(this.phase);
        return [...this.cookbook].reverse().map(r => {
            const total = FLAVOR_KEYS.reduce((n, k) => n + (r.profile?.[k] ?? 0), 0) || 1;
            const plan = this.#planRecipe(r);
            const ready = !!r.ingredients?.length && !plan.missing.length;
            return {
                ...r,
                ingredients: (r.ingredients ?? []).map((ing, i) => ({ ...ing, missing: !plan.have[i] })),
                canCookAgain: ready && !busy,
                cookAgainHint: busy
                    ? L('Cookbook.Busy')
                    : ready
                      ? L('Cookbook.CookAgainHint')
                      : L('Cookbook.Missing', { names: [...new Set(plan.missing)].join(', ') }),
                date: new Date(r.date).toLocaleDateString(),
                bar: FLAVOR_KEYS.filter(k => r.profile?.[k]).map(k => ({
                    label: flavorLabel(k),
                    n: r.profile[k],
                    color: FLAVORS[k].color,
                    pct: (r.profile[k] / total) * 100
                })),
                times: this.cookbook.filter(x => x.profileKey === r.profileKey).length
            };
        });
    }

    /* ---------------------------------------- */
    /*  Rendering                               */
    /* ---------------------------------------- */

    _onFirstRender(context, options) {
        super._onFirstRender(context, options);
        const rerender = (doc) => {
            if (this.phase === 'cooking' || this.rolling) return;
            const actor = doc.documentName === 'Actor' ? doc : doc.parent;
            if (!actor || actor.documentName !== 'Actor') return;
            if (actor === this.party || this.members.includes(actor)) this.render();
        };
        for (const hook of ['createItem', 'updateItem', 'deleteItem', 'updateActor']) {
            this.#hookIds.push([hook, Hooks.on(hook, rerender)]);
        }
        this.#hookIds.push([
            'updateSetting',
            Hooks.on('updateSetting', s => s.key === `${MODULE_ID}.cookbooks` && this.render())
        ]);
        // Someone may already be cooking: ask them for their state so we can watch.
        if (!this.live) broadcast('kitchen:hello', {});
    }

    _onClose(options) {
        super._onClose(options);
        for (const [hook, id] of this.#hookIds) Hooks.off(hook, id);
        this.#hookIds = [];
        clearInterval(this.#spin);
        if (!this.watching) this.autoCooking = false;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const el = this.element;
        const theme = resolveTheme(this.party);
        el.classList.remove(...[...el.classList].filter(c => c.startsWith('hp-theme-')));
        el.classList.add(`hp-theme-${theme}`);
        el.classList.toggle('hp-core', hasCoreArt());
        el.classList.toggle('hp-is-watching', !!this.watching);

        clearInterval(this.#spin);
        if (this.watching && this.rolling) this.#spin = this.#flicker();
        if (this.#sizzlePending) {
            this.#sizzlePending = false;
            this.#sizzle();
        }
        this.broadcastState();

        el.querySelectorAll('[data-drag-uuid]').forEach(card => {
            card.addEventListener('dragstart', ev => {
                ev.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Item', uuid: card.dataset.dragUuid }));
                ev.dataTransfer.effectAllowed = 'copy';
                el.querySelector('.hp-pot')?.classList.add('hp-drag-active');
            });
            card.addEventListener('dragend', () => el.querySelector('.hp-pot')?.classList.remove('hp-drag-active'));
        });

        const pot = el.querySelector('.hp-pot');
        if (pot) {
            pot.addEventListener('dragover', ev => {
                ev.preventDefault();
                pot.classList.add('hp-drag-over');
            });
            pot.addEventListener('dragleave', () => pot.classList.remove('hp-drag-over'));
            pot.addEventListener('drop', ev => this.#onDrop(ev));
        }

        el.querySelectorAll('[data-recipe-field]').forEach(input => {
            input.addEventListener('input', ev => {
                this.recipe[input.dataset.recipeField] = ev.target.value;
                clearTimeout(this.#inputTimer);
                this.#inputTimer = setTimeout(() => this.broadcastState(), 400);
            });
        });
        el.querySelector('[data-tier]')?.addEventListener('change', ev => {
            if (this.watching) return;
            this.tierOverride = Math.max(1, Math.min(4, Number(ev.target.value) || 1));
            this.render();
        });
    }

    async #onDrop(ev) {
        ev.preventDefault();
        if (this.watching) return;
        this.element.querySelector('.hp-pot')?.classList.remove('hp-drag-over', 'hp-drag-active');
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (data?.type !== 'Item' || !data.uuid) return;
        const item = await fromUuid(data.uuid);
        // Ingredients dragged from the sidebar or a compendium are "found" food and aren't consumed.
        await this.#addItem(item, { consumable: !!item?.parent });
    }

    /** Roll real Foundry dice (shown in Dice So Nice, tinted by flavor) while the tray flickers. */
    async #rollDice(dice) {
        const roll = new Roll(dice.map(d => `1d${d.faces}`).join(' + '));
        await roll.evaluate();
        roll.dice.forEach((term, i) => {
            const f = FLAVORS[dice[i].flavor];
            term.options.appearance = {
                colorset: 'custom',
                background: f.color,
                foreground: f.ink,
                outline: f.ink,
                edge: f.color,
                texture: 'none'
            };
        });
        const useDSN = game.dice3d && game.settings.get(MODULE_ID, 'diceSoNice');
        const spin = this.#flicker();
        await Promise.all([useDSN ? game.dice3d.showForRoll(roll, game.user, true) : null, sleep(750)]);
        clearInterval(spin);
        return roll.dice.map(t => t.total);
    }

    #flicker() {
        const faces = [...this.element.querySelectorAll('.hp-tray .hp-die.rolling')];
        return setInterval(() => {
            for (const el of faces) {
                const text = el.querySelector('.hp-die-text');
                if (text) text.textContent = 1 + Math.floor(Math.random() * Number(el.dataset.faces));
            }
        }, 70);
    }

    async #doRoll() {
        const s = this.session;
        if (!s || s.done || s.awaitingDiscard || this.rolling) return;
        this.rolling = true;
        await this.render();
        const values = await this.#rollDice(s.remaining);
        s.applyRoll(values);
        this.rolling = false;
        if (s.done) await this.#finishCooking();
        await this.render();
        if (s.sets.length && !s.awaitingDiscard) this.#sizzle();
    }

    async #finishCooking() {
        const s = this.session;
        if (s.wantsLastDrop) {
            const [die] = s.remaining;
            const [value] = await this.#rollDice([die]);
            s.setLastDrop(value);
            ui.notifications.info(L('Feature.lastDrop.rolled', { value }));
        }
    }

    #sizzle() {
        const plate = this.element.querySelector('.hp-plate');
        if (!plate) return;
        plate.classList.remove('hp-sizzle');
        void plate.offsetWidth;
        plate.classList.add('hp-sizzle');
    }

    #initAllocation() {
        const out = this.session.outcome;
        this.allocation = {};
        for (const a of this.members.filter(m => this.dinerIds.has(m.id))) {
            this.allocation[a.id] = autoSplit(out.rating, this.#caps(a, out));
        }
    }

    async #saveRecipe(entry) {
        const entries = [...this.cookbook, entry];
        await run('saveCookbook', { key: this.cookbookKey, entries });
    }

    /* ---------------------------------------- */
    /*  Actions                                 */
    /* ---------------------------------------- */

    static #onTab(event, target) {
        this.tab = target.dataset.tab;
        this.render();
    }

    static async #onAddToPot(event, target) {
        const item = await fromUuid(target.closest('[data-drag-uuid]').dataset.dragUuid);
        await this.#addItem(item);
    }

    static #onRemoveFromPot(event, target) {
        this.pot = this.pot.filter(e => e.key !== target.closest('[data-pot-key]').dataset.potKey);
        this.render();
    }

    static #onEmptyPot() {
        this.pot = [];
        this.render();
    }

    static #onToggleDiner(event, target) {
        const id = target.dataset.actorId;
        this.dinerIds.has(id) ? this.dinerIds.delete(id) : this.dinerIds.add(id);
        this.render();
    }

    static async #onStartCooking() {
        if (!this.pot.length) return;
        const consumed = this.pot.filter(e => e.consumable);
        const lines = consumed.map(e => `<li><img src="${e.img}"> ${e.name} <em>(${e.owner})</em></li>`).join('');
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: L('Confirm.Title'), icon: 'fa-solid fa-fire-burner' },
            content: `<div class="dh-hotpot-confirm"><p>${L('Confirm.Body')}</p>${lines ? `<ul>${lines}</ul>` : `<p><em>${L('Confirm.Nothing')}</em></p>`}</div>`
        });
        if (!ok) return;

        const byUuid = {};
        for (const e of consumed) byUuid[e.uuid] = (byUuid[e.uuid] ?? 0) + 1;
        const list = Object.entries(byUuid).map(([uuid, amount]) => ({ uuid, amount }));
        try {
            if (list.length) {
                const docs = await Promise.all(list.map(x => fromUuid(x.uuid)));
                await run('consume', list, docs.every(d => d?.isOwner));
            }
        } catch (err) {
            ui.notifications.error(err.message);
            return;
        }

        this.recipe.name ||= L('DefaultName');
        this.session = new CookSession({
            dice: buildDice(this.pot),
            tokens: this.familiar ? this.partyTier : 0,
            features: this.potFeatures
        });
        this.session.potSnapshot = this.pot.map(e => ({ name: e.name, img: e.img }));
        this.session.profile = this.profile;
        this.session.familiarName = this.familiar?.name ?? null;
        this.phase = 'cooking';
        this.live = true;
        await this.render();
        this.broadcastState(true);
    }

    static async #onGather() {
        this.live = true;
        await this.render();
        this.broadcastState(true);
        ui.notifications.info(L('Live.Gathered'));
    }

    static #onLeaveWatch() {
        this.ignoreCook = this.watching?.id ?? null;
        this.watching = null;
        this.#resetLocal();
        this.render();
    }

    static async #onRoll() {
        await this.#doRoll();
    }

    static async #onDiscard(event, target) {
        const s = this.session;
        if (!s?.awaitingDiscard) return;
        s.discard(target.dataset.dieId ?? 'token');
        if (s.done) await this.#finishCooking();
        this.render();
    }

    static async #onAutoCook() {
        const s = this.session;
        this.autoCooking = true;
        while (this.autoCooking && this.rendered && !s.done) {
            if (s.awaitingDiscard) {
                await sleep(500);
                s.discard(s.suggestDiscard());
                if (s.done) await this.#finishCooking();
                await this.render();
                await sleep(300);
            } else {
                await this.#doRoll();
                await sleep(450);
            }
        }
        this.autoCooking = false;
        this.render();
    }

    static #onToServing() {
        this.#initAllocation();
        this.phase = 'serving';
        this.render();
    }

    #applyAlloc(actorId, res, delta) {
        const actor = game.actors.get(actorId);
        if (!actor || !['hp', 'stress', 'hope'].includes(res)) return;
        const out = this.session.outcome;
        const caps = this.#caps(actor, out);
        const a = (this.allocation[actorId] ??= { hp: 0, stress: 0, hope: 0 });
        const used = a.hp + a.stress + a.hope;
        if (delta > 0 && (used >= out.rating || a[res] >= caps[res])) return;
        a[res] = Math.max(0, a[res] + Math.sign(delta));
    }

    #applyAutoAlloc(actorId) {
        const actor = game.actors.get(actorId);
        if (!actor) return;
        const out = this.session.outcome;
        this.allocation[actorId] = autoSplit(out.rating, this.#caps(actor, out));
    }

    /** Watchers may tweak their own character's share; the cook applies it. */
    static #onAlloc(event, target) {
        const { actorId, res } = target.dataset;
        const delta = Number(target.dataset.delta);
        if (this.watching) {
            if (game.actors.get(actorId)?.isOwner) broadcast('kitchen:alloc', { actorId, res, delta });
            return;
        }
        this.#applyAlloc(actorId, res, delta);
        this.render();
    }

    static #onAutoAlloc(event, target) {
        const { actorId } = target.dataset;
        if (this.watching) {
            if (game.actors.get(actorId)?.isOwner) broadcast('kitchen:alloc', { actorId, auto: true });
            return;
        }
        this.#applyAutoAlloc(actorId);
        this.render();
    }

    static async #onServe() {
        const s = this.session;
        const out = s.outcome;
        const diners = this.members.filter(a => this.dinerIds.has(a.id));
        const bfs = out.builtForSpeed
            ? { name: L('Feature.builtForSpeed.name'), description: L('Feature.builtForSpeed.hint') }
            : null;
        const feed = diners.map(a => ({
            uuid: a.uuid,
            ...(this.allocation[a.id] ?? { hp: 0, stress: 0, hope: 0 }),
            fullClear: out.fullClear,
            builtForSpeed: bfs
        }));
        try {
            await run('feed', feed, diners.every(a => a.isOwner));
        } catch (err) {
            ui.notifications.error(err.message);
            return;
        }

        const entry = {
            id: foundry.utils.randomID(),
            name: this.recipe.name || L('DefaultName'),
            description: this.recipe.description,
            profile: s.profile,
            profileKey: profileKey(s.profile),
            dice: this.#diceSummary(s.profile),
            ingredients: s.potSnapshot,
            sets: s.sets.map(x => x.value),
            rating: out.rating,
            date: Date.now(),
            cook: game.user.name
        };
        try {
            await this.#saveRecipe(entry);
        } catch (err) {
            ui.notifications.warn(err.message);
        }

        this.served = {
            ...entry,
            outcome: out,
            diners: diners.map(a => ({ name: a.name, img: a.img, ...(this.allocation[a.id] ?? {}) })),
            familiarName: s.familiarName
        };
        await this.#postChat();
        this.phase = 'done';
        this.render();
    }

    async #postChat() {
        await postMealCard(this.served);
    }

    static async #onReset() {
        if (this.phase === 'cooking' && !this.session?.done) {
            const ok = await foundry.applications.api.DialogV2.confirm({
                window: { title: L('Abandon.Title') },
                content: `<p>${L('Abandon.Body')}</p>`
            });
            if (!ok) return;
        }
        if (this.live) broadcast('kitchen:end', {});
        this.live = false;
        this.#resetLocal();
        this.render();
    }

    static #onOpenSheet(event, target) {
        game.actors.get(target.dataset.actorId)?.sheet.render(true);
    }

    /** Refill the pot with the same ingredients and name as a cookbook recipe. */
    static async #onCookAgain(event, target) {
        const recipe = this.cookbook.find(r => r.id === target.dataset.recipeId);
        if (!recipe || !['prep', 'done'].includes(this.phase)) return;
        const plan = this.#planRecipe(recipe);
        if (plan.missing.length) {
            ui.notifications.warn(L('Cookbook.Missing', { names: [...new Set(plan.missing)].join(', ') }));
            return;
        }
        if (this.live) broadcast('kitchen:end', {});
        this.live = false;
        this.#resetLocal();
        this.pot = plan.items.map(item => this.#potEntry(item));
        this.recipe = { name: recipe.name ?? '', description: recipe.description ?? '' };
        this.tab = 'kitchen';
        await this.render();
        ui.notifications.info(L('Cookbook.Loaded', { name: recipe.name }));
    }

    static async #onDeleteRecipe(event, target) {
        const id = target.dataset.recipeId;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: L('Cookbook.DeleteTitle') },
            content: `<p>${L('Cookbook.DeleteBody')}</p>`
        });
        if (!ok) return;
        await run('saveCookbook', { key: this.cookbookKey, entries: this.cookbook.filter(r => r.id !== id) });
    }
}
