/**
 * The meal chat card posted when a feast is served.
 */
import { FLAVORS, FLAVOR_KEYS, MODULE_ID, flavorLabel } from './flavors.mjs';

const CORE_ART = 'modules/daggerheart-core/assets/art';
/** Core Rulebook paintings of finished Beast Feast dishes, used as the card banner. */
const MEAL_ART = [
    'frame-259-beastfeast-meal-cavemushblackbonebroth.webp',
    'frame-259-beastfeast-meal-monsterskewers.webp',
    'frame-259-beastfeast-meal-tushtoothonthornwoodwbloodfruit.webp'
];
const L = (key, data) => (data ? game.i18n.format(`DHHOTPOT.${key}`, data) : game.i18n.localize(`DHHOTPOT.${key}`));

/** Same painting the kitchen's "Bon appétit" screen shows for this meal. */
export function mealArt(rating = 0) {
    if (!game.modules.get('daggerheart-core')?.active) return null;
    // absolute route: a relative url() inside a CSS variable resolves against the stylesheet, not the page
    return foundry.utils.getRoute(`${CORE_ART}/${MEAL_ART[rating % MEAL_ART.length]}`);
}

/**
 * Post the meal card for a served feast.
 * @param {object} served  the kitchen's served record (name, description, profile, dice, ingredients, sets,
 *                         rating, cook, outcome, diners, familiarName)
 */
export async function postMealCard(served) {
    const out = served.outcome ?? {};
    const total = FLAVOR_KEYS.reduce((n, k) => n + (served.profile?.[k] ?? 0), 0) || 1;
    const content = await foundry.applications.handlebars.renderTemplate(`modules/${MODULE_ID}/templates/chat-card.hbs`, {
        ...served,
        art: mealArt(served.rating),
        bar: FLAVOR_KEYS.filter(k => served.profile?.[k]).map(k => ({
            label: flavorLabel(k),
            n: served.profile[k],
            color: FLAVORS[k].color,
            pct: (served.profile[k] / total) * 100
        })),
        sets: (served.sets ?? []).map(value => ({ value })),
        fullClear: out.fullClear,
        deathMove: out.deathMove,
        noStress: out.noStress,
        builtForSpeed: out.builtForSpeed,
        lastDrop: out.lastDrop
    });
    return ChatMessage.create({
        content,
        speaker: ChatMessage.getSpeaker({ alias: L('ChatSpeaker') }),
        flags: { [MODULE_ID]: { meal: true, recipe: served.id } }
    });
}

/** Give the whole chat message (not just its content) the Hotpot look. */
export function registerChatStyling() {
    Hooks.on('renderChatMessageHTML', (message, html) => {
        if (!message.getFlag(MODULE_ID, 'meal') && !message.getFlag(MODULE_ID, 'recipe')) return;
        html.classList.add('dh-hotpot-message');
    });
}
