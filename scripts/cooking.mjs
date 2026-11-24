/**
 * Pure Beast Feast cooking rules. No Foundry globals in here so it can be tested in node.
 *
 * Rules (Core Rulebook, Beast Feast, "Making a Feast!"):
 *  - Every ingredient adds (strength) dice of each of its flavors' die size.
 *  - Roll the pool. Dice showing a value that appears 2+ times are set aside as a matched set.
 *  - No matches: discard one die (or a familiarity token) and roll again.
 *  - When one die (or none) remains, the meal is done.
 *  - Meal Rating = sum of each matched set's value (a set of 4s is worth 4, however many dice).
 *  - Cooking a flavor profile already in the cookbook adds tokens equal to party tier.
 */
import { FLAVORS, FLAVOR_KEYS } from './flavors.mjs';

/** Ingredient features from "Next Level Feast!" detected by name in the item description. */
export const FEATURES = {
    lastDrop: /last\s*drop/i,
    risky: /risky/i,
    spicy: /spicy/i,
    builtForSpeed: /built\s*for\s*speed/i
};

export function detectFeatures(descriptionHTML = '') {
    const text = String(descriptionHTML);
    return Object.entries(FEATURES)
        .filter(([, re]) => re.test(text))
        .map(([k]) => k);
}

/** Sum the flavor strengths of every serving in the pot. */
export function profileOf(entries) {
    const profile = Object.fromEntries(FLAVOR_KEYS.map(k => [k, 0]));
    for (const e of entries) for (const k of FLAVOR_KEYS) profile[k] += Number(e.flavors?.[k]) || 0;
    return profile;
}

/** Stable key so two dishes with the same flavor profile compare equal. */
export function profileKey(profile) {
    return FLAVOR_KEYS.filter(k => profile[k] > 0)
        .map(k => `${k}${profile[k]}`)
        .join('-');
}

/** Turn the pot into flavor dice, sorted largest first. */
export function buildDice(entries) {
    const profile = profileOf(entries);
    const dice = [];
    let n = 0;
    for (const k of [...FLAVOR_KEYS].reverse()) {
        for (let i = 0; i < profile[k]; i++) dice.push({ id: `d${n++}`, flavor: k, faces: FLAVORS[k].faces });
    }
    return dice;
}

/** Group dice by rolled value; only values shown by 2+ dice form a set. */
export function findMatches(dice) {
    const byValue = new Map();
    for (const d of dice) {
        if (!byValue.has(d.value)) byValue.set(d.value, []);
        byValue.get(d.value).push(d);
    }
    return [...byValue.entries()]
        .filter(([, ds]) => ds.length >= 2)
        .map(([value, ds]) => ({ value, dice: ds }))
        .sort((a, b) => b.value - a.value);
}

/**
 * One cooking session. Drive it with roll() → (discard() if needed) → … until done.
 * Rolling itself is injected so the app can use Foundry Rolls and tests can use fixed values.
 */
export class CookSession {
    constructor({ dice, tokens = 0, features = [] }) {
        this.remaining = dice.map(d => ({ ...d, value: null }));
        this.tokens = tokens;
        this.startTokens = tokens;
        this.features = new Set(features);
        this.sets = [];
        this.discarded = [];
        this.log = [];
        this.round = 0;
        this.anyMatch = false;
        this.awaitingDiscard = false;
        this.lastRoll = [];
        this.lastDrop = null;
        this.done = this.remaining.length <= 1;
    }

    /** Plain-object copy for sending to watching clients. */
    toJSON() {
        return { ...this, features: [...this.features] };
    }

    static fromJSON(data) {
        const s = new CookSession({ dice: [] });
        Object.assign(s, structuredClone(data), { features: new Set(data.features ?? []) });
        return s;
    }

    /** Dice that would be rolled next. */
    get pool() {
        return this.remaining;
    }

    /**
     * Apply rolled values (array aligned with this.remaining).
     * @returns {{matches: Array, needDiscard: boolean}}
     */
    applyRoll(values) {
        if (this.done || this.awaitingDiscard) throw new Error('Cannot roll now');
        this.round++;
        this.remaining.forEach((d, i) => (d.value = values[i]));
        this.lastRoll = this.remaining.map(d => ({ ...d }));
        const matches = findMatches(this.remaining);
        if (matches.length) {
            this.anyMatch = true;
            const matchedIds = new Set();
            for (const m of matches) {
                this.sets.push({ value: m.value, dice: m.dice.map(d => ({ ...d })), round: this.round });
                m.dice.forEach(d => matchedIds.add(d.id));
            }
            this.lastRoll.forEach(d => (d.matched = matchedIds.has(d.id)));
            this.remaining = this.remaining.filter(d => !matchedIds.has(d.id));
            this.log.push({ round: this.round, rolled: this.lastRoll, matches: matches.map(m => m.value) });
            this.#checkDone();
            return { matches, needDiscard: false };
        }
        this.awaitingDiscard = true;
        this.log.push({ round: this.round, rolled: this.lastRoll, matches: [] });
        return { matches: [], needDiscard: true };
    }

    /** Discard a die by id, or 'token' to spend a familiarity token instead. */
    discard(id) {
        if (!this.awaitingDiscard) throw new Error('Nothing to discard');
        if (id === 'token') {
            if (this.tokens <= 0) throw new Error('No tokens');
            this.tokens--;
            this.log.at(-1).discarded = 'token';
        } else {
            const idx = this.remaining.findIndex(d => d.id === id);
            if (idx < 0) throw new Error(`No die ${id}`);
            const [die] = this.remaining.splice(idx, 1);
            this.discarded.push(die);
            this.log.at(-1).discarded = die;
            const shown = this.lastRoll.find(d => d.id === id);
            if (shown) shown.discarded = true;
        }
        this.awaitingDiscard = false;
        this.#checkDone();
    }

    /** Auto-pick: spend a token first, otherwise drop the biggest die (smaller pools match more often). */
    suggestDiscard() {
        if (this.tokens > 0) return 'token';
        return [...this.remaining].sort((a, b) => b.faces - a.faces)[0]?.id;
    }

    #checkDone() {
        if (this.remaining.length <= 1) this.done = true;
    }

    /** True when Last Drop should roll the final die. */
    get wantsLastDrop() {
        return this.done && this.features.has('lastDrop') && this.remaining.length === 1 && this.lastDrop === null;
    }

    setLastDrop(value) {
        this.lastDrop = value;
    }

    get baseRating() {
        return this.sets.reduce((sum, s) => sum + s.value, 0);
    }

    /** Final outcome after features. */
    get outcome() {
        const risky = this.features.has('risky');
        const out = {
            base: this.baseRating,
            lastDrop: this.lastDrop ?? 0,
            rating: this.baseRating + (this.lastDrop ?? 0),
            noStress: this.features.has('spicy') && this.sets.some(s => s.value >= 8),
            fullClear: false,
            deathMove: false,
            builtForSpeed: this.features.has('builtForSpeed')
        };
        if (risky) {
            if (this.anyMatch) {
                out.rating = 0;
                out.deathMove = true;
            } else {
                out.fullClear = true;
            }
        }
        return out;
    }
}

/**
 * Split a Meal Rating across HP → Stress → Hope, capped by what each can actually use.
 * @param {number} rating
 * @param {{hp:number, stress:number, hope:number}} caps
 */
export function autoSplit(rating, caps) {
    let left = rating;
    const take = cap => {
        const n = Math.max(0, Math.min(left, cap));
        left -= n;
        return n;
    };
    return { hp: take(caps.hp), stress: take(caps.stress), hope: take(caps.hope) };
}
