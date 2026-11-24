/**
 * Ingredient Forge: the GM's ingredient generator and larder.
 * Generate ingredients from a beast or a bloom (or from scratch), save them to the larder
 * (world compendium or Items folder) and hand servings out to the party.
 */
import { FLAVORS, FLAVOR_KEYS, MODULE_ID, dieSVG, flavorLabel } from './flavors.mjs';
import { BLOOM_PREFIX, bloomFlavor, bumpFlavor, flavorCount, iconFor, ingredientsForHP, randomProfile } from './generator-rules.mjs';
import { getLarder, giveIngredient, isIngredient, listLarder, saveToLarder, storageMode } from './larder.mjs';
import { CORE_ART, hasCoreArt, resolveTheme } from './kitchen.mjs';

/** Core Rulebook ingredient paintings, used for matching parts when the module is active. */
const CORE_PART_ART = {
    meat: 'frame-259-beastfeast-ingedient-diremeat.webp',
    flesh: 'frame-259-beastfeast-ingedient-diremeat.webp',
    tongue: 'frame-259-beastfeast-ingedient-wyverntongue.webp',
    roots: 'frame-259-beastfeast-ingedient-rileroot.webp',
    secretion: 'frame-259-beastfeast-ingedient-aciddragonsaliva.webp',
    jelly: 'frame-259-beastfeast-ingedient-aciddragonsaliva.webp',
    sap: 'frame-259-beastfeast-ingedient-aciddragonsaliva.webp'
};
const EMPTY_ART = ['diremeat', 'rileroot', 'wyverntongue', 'aciddragonsaliva'].map(n => `${CORE_ART}/frame-259-beastfeast-ingedient-${n}.webp`);

/** Image for a part: the rulebook painting if there is one, otherwise a core icon. */
function artFor(part, flavors) {
    const core = hasCoreArt() && CORE_PART_ART[String(part ?? '').toLowerCase().trim()];
    return core ? `${CORE_ART}/${core}` : iconFor(part, flavors);
}

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const L = (key, data) => (data ? game.i18n.format(`DHHOTPOT.${key}`, data) : game.i18n.localize(`DHHOTPOT.${key}`));
const pick = list => list[Math.floor(Math.random() * list.length)];

/** Rulebook generator tables (read from the Core Rulebook module at runtime). */
const TABLES = { beast: '3Z3BVPXOgy49dcwf', bloom: 'oTI3PWyVbw6pnPjN', property: 'rgTbXm8cFxMeW0cP' };
/** Used only when the Core Rulebook tables aren't available. */
const FALLBACK = {
    beast: ['Meat', 'Tongue', 'Marrow', 'Eyes', 'Organ', 'Scales', 'Horn', 'Eggs'],
    bloom: ['Moss', 'Roots', 'Berries', 'Fungi', 'Sap', 'Leaves'],
    property: []
};

function stripHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = String(html ?? '');
    return div.textContent.trim();
}

function profileChips(profile) {
    return FLAVOR_KEYS.filter(k => profile?.[k] > 0).map(k => ({
        key: k,
        n: profile[k],
        label: flavorLabel(k),
        color: FLAVORS[k].color,
        die: dieSVG(FLAVORS[k].faces, null, k)
    }));
}

function diceSummary(profile) {
    return [...FLAVOR_KEYS]
        .reverse()
        .filter(k => profile?.[k] > 0)
        .map(k => `${profile[k]}d${FLAVORS[k].faces}`)
        .join(' + ');
}

export class IngredientForge extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: 'dh-hotpot-forge',
        classes: ['dh-hotpot', 'dh-hotpot-forge'],
        window: { title: 'DHHOTPOT.Forge.Title', icon: 'fa-solid fa-drumstick-bite', resizable: true },
        position: { width: 1100, height: 780 },
        actions: {
            mode: IngredientForge.#onMode,
            clearBeast: IngredientForge.#onClearBeast,
            generateBeast: IngredientForge.#onGenerateBeast,
            rollBloom: IngredientForge.#onRollBloom,
            newCustom: IngredientForge.#onNewCustom,
            rerollName: IngredientForge.#onRerollName,
            rerollProfile: IngredientForge.#onRerollProfile,
            rerollProperty: IngredientForge.#onRerollProperty,
            flavor: IngredientForge.#onFlavor,
            pickImage: IngredientForge.#onPickImage,
            discardDraft: IngredientForge.#onDiscardDraft,
            saveDraft: IngredientForge.#onSaveDraft,
            saveAll: IngredientForge.#onSaveAll,
            giveDraft: IngredientForge.#onGiveDraft,
            give: IngredientForge.#onGive,
            openItem: IngredientForge.#onOpenItem,
            deleteItem: IngredientForge.#onDeleteItem,
            openLarder: IngredientForge.#onOpenLarder
        }
    };

    static PARTS = {
        main: {
            template: `modules/${MODULE_ID}/templates/generator.hbs`,
            scrollable: ['.hp-drafts', '.hp-larder-list']
        }
    };

    mode = 'beast';
    beast = null;
    drafts = [];
    bloomRoll = null;
    filter = '';
    #seq = 0;
    #tables = null;
    #hookIds = [];

    /* ---------------------------------------- */
    /*  Data                                    */
    /* ---------------------------------------- */

    get party() {
        return game.actors.party ?? null;
    }

    /** Characters plus the party stash: everyone who can receive ingredients. */
    get recipients() {
        const members = this.party
            ? this.party.system.partyMembers.filter(a => a?.type === 'character')
            : game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
        return this.party ? [...members, this.party] : members;
    }

    async #loadTables() {
        if (this.#tables) return this.#tables;
        const out = { ...FALLBACK };
        const pack = game.packs.get('daggerheart-core.tables');
        if (pack) {
            for (const [key, id] of Object.entries(TABLES)) {
                try {
                    const table = await pack.getDocument(id);
                    const words = table?.results.contents.map(r => stripHTML(r.description || r.name || r.text)).filter(Boolean);
                    if (words?.length) out[key] = words;
                } catch (err) {
                    console.warn(`${MODULE_ID} | table ${key}`, err);
                }
            }
        }
        return (this.#tables = out);
    }

    async #beastName(beastName) {
        const t = await this.#loadTables();
        const part = pick(t.beast);
        return { part, name: beastName ? `${beastName} ${part}` : part };
    }

    async #bloomName(flavor) {
        const t = await this.#loadTables();
        const part = pick(t.bloom);
        return { part, name: `${pick(BLOOM_PREFIX[flavor] ?? BLOOM_PREFIX.weird)} ${part}` };
    }

    async #property() {
        const t = await this.#loadTables();
        return t.property.length ? pick(t.property) : '';
    }

    #newDraft({ name, part, flavors, description = '', source, from = null }) {
        return {
            key: `g${this.#seq++}`,
            name,
            part,
            flavors,
            description,
            source,
            from,
            img: artFor(part, flavors),
            saved: null
        };
    }

    #carry(actor) {
        const count = actor.items.filter(isIngredient).reduce((n, i) => n + (i.system.quantity ?? 1), 0);
        if (actor.type !== 'character') return { count, max: null, over: false };
        const max = Math.max(0, ...Object.values(actor.system.traits ?? {}).map(t => Number(t.value) || 0));
        return { count, max, over: count >= max };
    }

    async setBeast(actor) {
        if (actor?.type !== 'adversary') {
            ui.notifications.warn(L('Forge.NotAdversary'));
            return;
        }
        const hp = actor.system.resources?.hitPoints?.max ?? 0;
        this.beast = {
            uuid: actor.uuid,
            name: actor.name,
            img: actor.img,
            tier: actor.system.tier ?? 1,
            type: actor.system.type ?? '',
            elite: ['leader', 'solo'].includes(actor.system.type),
            hp,
            count: ingredientsForHP(hp),
            // Beast Feast adversaries from this module carry their own harvest list
            harvest: (actor.getFlag(MODULE_ID, 'harvest') ?? []).filter(h => h?.name)
        };
        this.mode = 'beast';
        this.render();
    }

    /* ---------------------------------------- */
    /*  Context                                 */
    /* ---------------------------------------- */

    async _prepareContext(options) {
        const ctx = await super._prepareContext(options);
        const larder = await getLarder();
        const items = await listLarder();
        const recipients = this.recipients.map(a => ({
            id: a.id,
            uuid: a.uuid,
            name: a.type === 'party' ? L('Pantry.PartyStash') : a.name,
            img: a.img,
            isParty: a.type === 'party',
            carry: this.#carry(a)
        }));
        const q = this.filter.trim().toLowerCase();
        const adversaries = game.actors
            .filter(a => a.type === 'adversary')
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(a => ({ uuid: a.uuid, name: a.name, selected: a.uuid === this.beast?.uuid }));

        return Object.assign(ctx, {
            mode: { [this.mode]: true },
            beast: this.beast,
            beastTier: this.beast ? L('Forge.Tier', { n: this.beast.tier }) : '',
            beastSingle: this.beast?.count === 1,
            beastYields: this.beast?.harvest?.length ? [...new Set(this.beast.harvest.map(h => h.name))].join(', ') : '',
            adversaries,
            bloomRoll: this.bloomRoll,
            bloomDie: this.bloomRoll ? dieSVG(12, this.bloomRoll.value, null) : dieSVG(12, null, null),
            bloomFlavorDie: this.bloomRoll ? dieSVG(FLAVORS[this.bloomRoll.flavor].faces, null, this.bloomRoll.flavor) : null,
            bloomFlavorLabel: this.bloomRoll ? flavorLabel(this.bloomRoll.flavor) : '',
            bloomTable: FLAVOR_KEYS.map((k, i) => ({
                range: `${i * 2 + 1}–${i * 2 + 2}`,
                label: flavorLabel(k),
                color: FLAVORS[k].color,
                hit: this.bloomRoll?.flavor === k
            })),
            drafts: this.drafts.map(d => ({
                ...d,
                dice: diceSummary(d.flavors),
                full: flavorCount(d.flavors) >= 3,
                steppers: FLAVOR_KEYS.map(k => ({
                    key: k,
                    n: d.flavors[k],
                    on: d.flavors[k] > 0,
                    color: FLAVORS[k].color,
                    label: flavorLabel(k),
                    die: dieSVG(FLAVORS[k].faces, d.flavors[k] || null, k)
                }))
            })),
            hasDrafts: this.drafts.length > 0,
            emptyArt: hasCoreArt() ? EMPTY_ART : [],
            unsavedCount: this.drafts.filter(d => !d.saved).length,
            recipients,
            larder: items
                .filter(i => !q || i.name.toLowerCase().includes(q))
                .map(i => ({
                    uuid: i.uuid,
                    name: i.name,
                    img: i.img,
                    chips: profileChips(i.system.categoryData),
                    dice: diceSummary(i.system.categoryData),
                    description: stripHTML(i.system.description)
                })),
            larderCount: items.length,
            larderLabel: larder
                ? larder.mode === 'folder'
                    ? L('Larder.InFolder', { name: larder.folder.name })
                    : L('Larder.InCompendium', { name: larder.pack.title })
                : L('Larder.NotCreated'),
            hasLarder: !!larder,
            filter: this.filter
        });
    }

    /* ---------------------------------------- */
    /*  Rendering                               */
    /* ---------------------------------------- */

    _onFirstRender(context, options) {
        super._onFirstRender(context, options);
        const rerender = doc => {
            const parent = doc.parent;
            if (doc.pack === `world.hotpot-larder` || doc.folder?.getFlag?.(MODULE_ID, 'larder') || (parent && this.recipients.includes(parent))) {
                this.render();
            }
        };
        for (const hook of ['createItem', 'updateItem', 'deleteItem']) this.#hookIds.push([hook, Hooks.on(hook, rerender)]);
    }

    _onClose(options) {
        super._onClose(options);
        for (const [hook, id] of this.#hookIds) Hooks.off(hook, id);
        this.#hookIds = [];
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const el = this.element;
        el.classList.remove(...[...el.classList].filter(c => c.startsWith('hp-theme-')));
        el.classList.add(`hp-theme-${resolveTheme(this.party)}`);
        el.classList.toggle('hp-core', hasCoreArt());

        // draft fields update state without re-rendering
        el.querySelectorAll('[data-draft-field]').forEach(input => {
            input.addEventListener('input', ev => {
                const draft = this.#draft(input);
                if (draft) draft[input.dataset.draftField] = ev.target.value;
            });
        });
        el.querySelector('[data-adversary-select]')?.addEventListener('change', async ev => {
            if (!ev.target.value) return;
            await this.setBeast(await fromUuid(ev.target.value));
        });
        const search = el.querySelector('[data-larder-search]');
        search?.addEventListener('input', ev => {
            this.filter = ev.target.value;
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(async () => {
                await this.render();
                const box = this.element.querySelector('[data-larder-search]');
                box?.focus();
                box?.setSelectionRange(box.value.length, box.value.length);
            }, 250);
        });

        // right-click a flavor die to lower it
        el.querySelectorAll('[data-action="flavor"]').forEach(btn =>
            btn.addEventListener('contextmenu', ev => {
                ev.preventDefault();
                this.#bump(btn, -1);
            })
        );

        // drop an adversary onto the beast panel
        const zone = el.querySelector('.hp-beast-drop');
        if (zone) {
            zone.addEventListener('dragover', ev => {
                ev.preventDefault();
                zone.classList.add('hp-drag-over');
            });
            zone.addEventListener('dragleave', () => zone.classList.remove('hp-drag-over'));
            zone.addEventListener('drop', async ev => {
                ev.preventDefault();
                zone.classList.remove('hp-drag-over');
                const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
                if (data?.type === 'Actor' && data.uuid) await this.setBeast(await fromUuid(data.uuid));
            });
        }

        // larder items can be dragged onto any actor sheet
        el.querySelectorAll('[data-larder-uuid]').forEach(row =>
            row.addEventListener('dragstart', ev => {
                ev.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Item', uuid: row.dataset.larderUuid }));
            })
        );
    }

    #draft(target) {
        const key = target.closest('[data-draft-key]')?.dataset.draftKey;
        return this.drafts.find(d => d.key === key);
    }

    #bump(target, delta) {
        const draft = this.#draft(target);
        if (!draft) return;
        const next = bumpFlavor(draft.flavors, target.dataset.flavor, delta);
        if (!next) {
            ui.notifications.warn(L('Forge.MaxFlavors'));
            return;
        }
        draft.flavors = next;
        if (!draft.imgLocked) draft.img = artFor(draft.part, next);
        draft.saved = null;
        this.render();
    }

    async #pop(selector) {
        const node = this.element.querySelector(selector);
        if (!node) return;
        node.classList.remove('hp-given');
        void node.offsetWidth;
        node.classList.add('hp-given');
    }

    /** Save a draft if needed, returning its larder item. */
    async #ensureSaved(draft) {
        if (draft.saved) {
            const doc = await fromUuid(draft.saved);
            if (doc) return doc;
        }
        const doc = await saveToLarder(draft);
        draft.saved = doc.uuid;
        return doc;
    }

    /* ---------------------------------------- */
    /*  Actions                                 */
    /* ---------------------------------------- */

    static #onMode(event, target) {
        this.mode = target.dataset.mode;
        this.render();
    }

    static #onClearBeast() {
        this.beast = null;
        this.render();
    }

    static async #onGenerateBeast() {
        const b = this.beast;
        if (!b) return;
        for (let i = 0; i < b.count; i++) {
            const known = b.harvest?.length ? b.harvest[i % b.harvest.length] : null;
            if (known) {
                const flavors = Object.fromEntries(FLAVOR_KEYS.map(k => [k, Number(known.flavors?.[k]) || 0]));
                const part = known.name.split(/\s+/).at(-1);
                this.drafts.unshift(
                    this.#newDraft({ name: known.name, part, flavors, description: known.text || (await this.#property()), source: 'beast', from: b.name })
                );
                continue;
            }
            const flavors = randomProfile(b.tier, Math.random, { elite: b.elite });
            const { name, part } = await this.#beastName(b.name);
            this.drafts.unshift(
                this.#newDraft({ name, part, flavors, description: await this.#property(), source: 'beast', from: b.name })
            );
        }
        this.render();
    }

    static async #onRollBloom() {
        const roll = await new Roll('1d12').evaluate();
        if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
        const value = roll.total;
        const flavor = bloomFlavor(value);
        this.bloomRoll = { value, flavor };
        const flavors = Object.fromEntries(FLAVOR_KEYS.map(k => [k, k === flavor ? 1 : 0]));
        const { name, part } = await this.#bloomName(flavor);
        this.drafts.unshift(this.#newDraft({ name, part, flavors, description: await this.#property(), source: 'bloom' }));
        this.render();
    }

    static #onNewCustom() {
        const flavors = Object.fromEntries(FLAVOR_KEYS.map(k => [k, 0]));
        flavors.savory = 1;
        this.drafts.unshift(this.#newDraft({ name: '', part: '', flavors, source: 'custom' }));
        this.render();
    }

    static async #onRerollName(event, target) {
        const draft = this.#draft(target);
        if (!draft) return;
        const top = FLAVOR_KEYS.reduce((best, k) => (draft.flavors[k] > draft.flavors[best] ? k : best), FLAVOR_KEYS[0]);
        const next = draft.source === 'bloom' ? await this.#bloomName(top) : await this.#beastName(draft.from);
        Object.assign(draft, next, { saved: null });
        if (!draft.imgLocked) draft.img = artFor(draft.part, draft.flavors);
        this.render();
    }

    static #onRerollProfile(event, target) {
        const draft = this.#draft(target);
        if (!draft) return;
        draft.flavors = randomProfile(this.beast?.tier ?? 2, Math.random, { elite: !!this.beast?.elite });
        if (!draft.imgLocked) draft.img = artFor(draft.part, draft.flavors);
        draft.saved = null;
        this.render();
    }

    static async #onRerollProperty(event, target) {
        const draft = this.#draft(target);
        if (!draft) return;
        draft.description = await this.#property();
        draft.saved = null;
        this.render();
    }

    static #onFlavor(event, target) {
        this.#bump(target, 1);
    }

    static #onPickImage(event, target) {
        const draft = this.#draft(target);
        if (!draft) return;
        new foundry.applications.apps.FilePicker.implementation({
            type: 'image',
            current: draft.img,
            callback: path => {
                draft.img = path;
                draft.imgLocked = true;
                draft.saved = null;
                this.render();
            }
        }).render(true);
    }

    static #onDiscardDraft(event, target) {
        const draft = this.#draft(target);
        this.drafts = this.drafts.filter(d => d !== draft);
        this.render();
    }

    static async #onSaveDraft(event, target) {
        const draft = this.#draft(target);
        if (!draft) return;
        await this.#ensureSaved(draft);
        this.drafts = this.drafts.filter(d => d !== draft);
        ui.notifications.info(L('Forge.Saved', { name: draft.name || L('Forge.Unnamed') }));
        this.render();
    }

    static async #onSaveAll() {
        const n = this.drafts.length;
        for (const draft of this.drafts) await this.#ensureSaved(draft);
        this.drafts = [];
        ui.notifications.info(L('Forge.SavedAll', { n }));
        this.render();
    }

    /** Give a draft straight to someone: it's saved to the larder too. */
    static async #onGiveDraft(event, target) {
        const draft = this.#draft(target);
        const actor = game.actors.get(target.dataset.actorId);
        if (!draft || !actor) return;
        const doc = await this.#ensureSaved(draft);
        await giveIngredient(doc, actor);
        this.drafts = this.drafts.filter(d => d !== draft);
        ui.notifications.info(L('Forge.Given', { name: doc.name, actor: actor.type === 'party' ? L('Pantry.PartyStash') : actor.name }));
        await this.render();
        this.#pop(`.hp-recipients [data-actor-id="${actor.id}"]`);
    }

    static async #onGive(event, target) {
        const source = await fromUuid(target.closest('[data-larder-uuid]').dataset.larderUuid);
        const actor = game.actors.get(target.dataset.actorId);
        if (!source || !actor) return;
        await giveIngredient(source, actor);
        ui.notifications.info(L('Forge.Given', { name: source.name, actor: actor.type === 'party' ? L('Pantry.PartyStash') : actor.name }));
        await this.render();
        this.#pop(`.hp-recipients [data-actor-id="${actor.id}"]`);
    }

    static async #onOpenItem(event, target) {
        (await fromUuid(target.closest('[data-larder-uuid]').dataset.larderUuid))?.sheet.render(true);
    }

    static async #onDeleteItem(event, target) {
        const item = await fromUuid(target.closest('[data-larder-uuid]').dataset.larderUuid);
        if (!item) return;
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: L('Larder.DeleteTitle') },
            content: `<p>${L('Larder.DeleteBody', { name: foundry.utils.escapeHTML(item.name) })}</p>`
        });
        if (ok) await item.delete();
        this.render();
    }

    static async #onOpenLarder() {
        const larder = await getLarder({ create: true });
        if (larder.mode === 'folder') {
            ui.items.activate();
            larder.folder.expand?.();
        } else larder.pack.render(true);
        this.render();
    }
}

export { storageMode };
