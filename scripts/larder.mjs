/**
 * The larder: where generated ingredients are kept (a world compendium or an Items folder),
 * plus handing servings out to characters and the party stash.
 */
import { FLAVOR_KEYS, MODULE_ID } from './flavors.mjs';

export const PACK_NAME = 'hotpot-larder';
const FOLDER_FLAG = 'larder';

const L = key => game.i18n.localize(`DHHOTPOT.${key}`);

export function isIngredient(item) {
    return item?.type === 'loot' && item.system?.category === 'ingredient';
}

export function storageMode() {
    return game.settings.get(MODULE_ID, 'larderStorage');
}

/** Find the larder (compendium or folder), optionally creating it. */
export async function getLarder({ create = false } = {}) {
    if (storageMode() === 'folder') {
        let folder = game.folders.find(f => f.type === 'Item' && f.getFlag(MODULE_ID, FOLDER_FLAG));
        if (!folder && create) {
            folder = await Folder.create({
                name: L('Larder.Name'),
                type: 'Item',
                color: '#a8521a',
                flags: { [MODULE_ID]: { [FOLDER_FLAG]: true } }
            });
        }
        return folder ? { mode: 'folder', folder } : null;
    }
    let pack = game.packs.get(`world.${PACK_NAME}`);
    if (!pack && create) {
        pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
            name: PACK_NAME,
            label: L('Larder.Name'),
            type: 'Item',
            system: game.system.id
        });
    }
    return pack ? { mode: 'compendium', pack } : null;
}

/** Every ingredient in the larder, newest first. */
export async function listLarder() {
    const larder = await getLarder();
    if (!larder) return [];
    const docs = larder.mode === 'folder' ? larder.folder.contents : await larder.pack.getDocuments();
    return docs.filter(isIngredient).sort((a, b) => (b._stats?.createdTime ?? 0) - (a._stats?.createdTime ?? 0));
}

/** Item data for a draft ingredient. */
export function ingredientData(draft) {
    const flavors = Object.fromEntries(FLAVOR_KEYS.map(k => [k, Number(draft.flavors?.[k]) || 0]));
    const desc = String(draft.description ?? '').trim();
    return {
        name: draft.name?.trim() || L('Forge.Unnamed'),
        type: 'loot',
        img: draft.img,
        system: {
            category: 'ingredient',
            categoryData: flavors,
            quantity: 1,
            description: desc ? `<p>${foundry.utils.escapeHTML(desc).replace(/\n/g, '<br>')}</p>` : ''
        },
        flags: { [MODULE_ID]: { generated: { source: draft.source ?? null, from: draft.from ?? null } } }
    };
}

/** Save a draft into the larder and return the stored document. */
export async function saveToLarder(draft) {
    const larder = await getLarder({ create: true });
    const data = ingredientData(draft);
    if (larder.mode === 'folder') return Item.create({ ...data, folder: larder.folder.id });
    return Item.create(data, { pack: larder.pack.collection });
}

function sameIngredient(a, b) {
    if (!isIngredient(a) || a.name !== b.name) return false;
    return FLAVOR_KEYS.every(k => (Number(a.system.categoryData?.[k]) || 0) === (Number(b.system.categoryData?.[k]) || 0));
}

/**
 * Give one serving to an actor: stack onto a matching ingredient they already carry, else add a copy.
 * @param {Item} source  larder item (or any ingredient item)
 * @param {Actor} actor
 */
export async function giveIngredient(source, actor, amount = 1) {
    const existing = actor.items.find(i => sameIngredient(i, source));
    if (existing) {
        await existing.update({ 'system.quantity': (existing.system.quantity ?? 1) + amount });
        return existing;
    }
    const data = source.toObject();
    delete data._id;
    delete data.folder;
    data.system.quantity = amount;
    foundry.utils.setProperty(data, '_stats.compendiumSource', source.uuid);
    const [created] = await actor.createEmbeddedDocuments('Item', [data]);
    return created;
}
