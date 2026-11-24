import { MODULE_ID } from './flavors.mjs';
import { HotpotKitchen, THEMES } from './kitchen.mjs';
import { IngredientForge } from './generator.mjs';
import { CookSession, buildDice, profileKey, profileOf } from './cooking.mjs';
import { listen, registerRelay } from './relay.mjs';
import { registerFrameGear } from './frame-gear.mjs';
import { liftHotpotFolder, placeLarder } from './larder.mjs';

let kitchen = null;
let forge = null;

/** Open (or focus) the GM's ingredient generator. */
export function openForge() {
    if (!game.user.isGM) return null;
    forge ??= new IngredientForge();
    forge.render({ force: true });
    return forge;
}

/** Open (or focus) the kitchen. */
export function openKitchen() {
    kitchen ??= new HotpotKitchen();
    kitchen.render({ force: true });
    return kitchen;
}

/**
 * Load the stylesheet with a version query. Foundry links module CSS by bare path, and a caching
 * proxy (e.g. Cloudflare's default 4h max-age) would otherwise keep serving last release's styles.
 * Same cascade layer Foundry uses for module styles.
 */
function loadStyles() {
    const version = game.modules.get(MODULE_ID)?.version ?? Date.now();
    const style = document.createElement('style');
    style.id = `${MODULE_ID}-styles`;
    style.textContent = `@import url("modules/${MODULE_ID}/styles/hotpot.css?v=${encodeURIComponent(version)}") layer(modules);`;
    document.head.append(style);
}

Hooks.once('init', () => {
    loadStyles();
    game.settings.register(MODULE_ID, 'cookbooks', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });
    game.settings.register(MODULE_ID, 'diceSoNice', {
        name: 'DHHOTPOT.Settings.DiceSoNice.Name',
        hint: 'DHHOTPOT.Settings.DiceSoNice.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });
    game.settings.register(MODULE_ID, 'beastFeastGear', {
        name: 'DHHOTPOT.Settings.BeastFeastGear.Name',
        hint: 'DHHOTPOT.Settings.BeastFeastGear.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    game.settings.register(MODULE_ID, 'hideRestButtons', {
        name: 'DHHOTPOT.Settings.HideRestButtons.Name',
        hint: 'DHHOTPOT.Settings.HideRestButtons.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true,
        onChange: value => toggleRestButtons(value)
    });
    game.settings.register(MODULE_ID, 'larderStorage', {
        name: 'DHHOTPOT.Settings.LarderStorage.Name',
        hint: 'DHHOTPOT.Settings.LarderStorage.Hint',
        scope: 'world',
        config: true,
        type: String,
        default: 'compendium',
        choices: { compendium: 'DHHOTPOT.Settings.LarderStorage.compendium', folder: 'DHHOTPOT.Settings.LarderStorage.folder' },
        onChange: () => forge?.rendered && forge.render()
    });
    game.settings.register(MODULE_ID, 'theme', {
        name: 'DHHOTPOT.Settings.Theme.Name',
        hint: 'DHHOTPOT.Settings.Theme.Hint',
        scope: 'client',
        config: true,
        type: String,
        default: 'auto',
        choices: Object.fromEntries([['auto', 'DHHOTPOT.Settings.Theme.Auto'], ...THEMES.map(t => [t, `DHHOTPOT.Theme.${t}`])]),
        onChange: () => kitchen?.rendered && kitchen.render()
    });

    game.modules.get(MODULE_ID).api = { open: openKitchen, openForge, resetSettings, CookSession, buildDice, profileOf, profileKey };
});

Hooks.once('setup', () => registerFrameGear());

/** Beast Feast replaces rest downtime with Make a Feast: hide the rest buttons on character and party sheets. */
function toggleRestButtons(hidden = game.settings.get(MODULE_ID, 'hideRestButtons')) {
    document.body.classList.toggle('dh-hotpot-no-rest', !!hidden);
}
Hooks.once('ready', () => toggleRestButtons());

/**
 * When the module is disabled, put every Hotpot option back to its default, so re-enabling starts fresh.
 * Foundry saves the new module list before reloading, while this code is still loaded on every client:
 * the GM resets world options and each client resets its own. Data (the party cookbooks) is kept.
 */
Hooks.on('updateSetting', setting => {
    if (setting.key !== 'core.moduleConfiguration') return;
    if (game.settings.get('core', 'moduleConfiguration')?.[MODULE_ID] !== false) return;
    resetSettings().catch(err => console.warn(`${MODULE_ID} | could not reset settings`, err));
});

export async function resetSettings() {
    for (const s of game.settings.settings.values()) {
        if (s.namespace !== MODULE_ID || !s.config) continue;
        if (s.scope === CONST.SETTING_SCOPES.WORLD && !game.user.isActiveGM) continue;
        await game.settings.set(MODULE_ID, s.key, s.default);
    }
}

Hooks.once('ready', () => {
    registerRelay();
    liftHotpotFolder()
        .then(() => placeLarder())
        .catch(err => console.warn('dh-hotpot | could not file the compendiums', err));

    // A cook's kitchen is live: follow along.
    listen('kitchen:state', ({ snap, summon }, from) => {
        if (kitchen?.live) return; // we're cooking our own feast
        kitchen ??= new HotpotKitchen();
        const following = kitchen.watching?.id === from;
        // Routine updates only reach people already following, or who opened the kitchen and asked to join.
        if (!summon && !following && !(kitchen.rendered && !kitchen.watching && kitchen.ignoreCook !== from)) return;
        kitchen.applySnapshot(snap, { summon });
        if (summon) kitchen.render({ force: true });
        else if (kitchen.rendered) kitchen.render();
    });
    listen('kitchen:end', (data, from) => kitchen?.endWatch(from));
    listen('kitchen:hello', () => kitchen?.broadcastState());
    listen('kitchen:alloc', (data, from) => kitchen?.remoteAlloc(data, from));
});

/** "Make a Feast" button in the party sheet's actions row, next to the rest buttons. */
Hooks.on('renderPartySheet', (app, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    const row = root?.querySelector('.tab.partyMembers .actions-section');
    if (!row || row.querySelector('.dh-hotpot-open')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dh-hotpot-open';
    btn.innerHTML = `<i class="fa-solid fa-fire-burner"></i><span>${game.i18n.localize('DHHOTPOT.MakeAFeast')}</span>`;
    btn.addEventListener('click', ev => {
        ev.preventDefault();
        openKitchen();
    });
    row.append(btn);
});

/** GM-only "Beast Feast" section in the Daggerheart sidebar menu. */
Hooks.on('renderDaggerheartMenu', (app, html) => {
    if (!game.user.isGM) return;
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root || root.querySelector('.dh-hotpot-menu')) return;
    const anchor = root.querySelectorAll('fieldset');
    const last = anchor[anchor.length - 1];
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'dh-hotpot-menu';
    fieldset.innerHTML = `
        <legend>${game.i18n.localize('DHHOTPOT.Menu.Legend')}</legend>
        <div class="menu-options-container">
            <div class="menu-options-inner-container">
                <button type="button" data-hotpot="forge"><i class="fa-solid fa-drumstick-bite"></i> ${game.i18n.localize('DHHOTPOT.Menu.Forge')}</button>
                <button type="button" data-hotpot="kitchen"><i class="fa-solid fa-fire-burner"></i> ${game.i18n.localize('DHHOTPOT.Menu.Kitchen')}</button>
            </div>
        </div>`;
    fieldset.querySelector('[data-hotpot="forge"]').addEventListener('click', () => openForge());
    fieldset.querySelector('[data-hotpot="kitchen"]').addEventListener('click', () => openKitchen());
    if (last) last.after(fieldset);
    else root.append(fieldset);
});
