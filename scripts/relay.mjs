/**
 * Narrow GM relay. Players often cook with ingredients carried by other PCs and feed the whole party,
 * which needs owner rights they don't have. Only these three operations are accepted, and each one
 * checks it is touching ingredients, character resources or the cookbook — nothing else.
 */
import { MODULE_ID } from './flavors.mjs';

const CHANNEL = `module.${MODULE_ID}`;
const pending = new Map();
const listeners = new Map();

/** Subscribe to a broadcast message type (live kitchen sync). */
export function listen(type, fn) {
    listeners.set(type, fn);
}

/** Send a message to every other connected client. */
export function broadcast(type, data) {
    game.socket.emit(CHANNEL, { type, data, from: game.user.id });
}

const OPS = {
    /** @param {{uuid:string, amount:number}[]} list */
    async consume(list) {
        for (const { uuid, amount } of list) {
            const item = await fromUuid(uuid);
            if (!item || item.type !== 'loot' || item.system.category !== 'ingredient') continue;
            const left = (item.system.quantity ?? 1) - amount;
            if (left > 0) await item.update({ 'system.quantity': left });
            else await item.delete();
        }
        return true;
    },

    /** @param {{uuid:string, hp:number, stress:number, hope:number, fullClear?:boolean, builtForSpeed?:object}[]} list */
    async feed(list) {
        for (const d of list) {
            const actor = await fromUuid(d.uuid);
            if (!actor || actor.type !== 'character') continue;
            const r = actor.system.resources;
            const hp = r.hitPoints;
            const st = r.stress;
            const hope = r.hope;
            const update = d.fullClear
                ? {
                      'system.resources.hitPoints.value': 0,
                      'system.resources.stress.value': 0,
                      'system.resources.hope.value': Math.min(hope.max, hope.value + 3)
                  }
                : {
                      'system.resources.hitPoints.value': Math.max(0, hp.value - clamp(d.hp)),
                      'system.resources.stress.value': Math.max(0, st.value - clamp(d.stress)),
                      'system.resources.hope.value': Math.min(hope.max, hope.value + clamp(d.hope))
                  };
            await actor.update(update);
            if (d.builtForSpeed) await actor.createEmbeddedDocuments('ActiveEffect', [builtForSpeedEffect(d.builtForSpeed)]);
        }
        return true;
    },

    /** @param {{key:string, entries:object[]}} data */
    async saveCookbook({ key, entries }) {
        if (typeof key !== 'string' || !Array.isArray(entries)) return false;
        const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, 'cookbooks') ?? {});
        all[key] = entries.slice(0, 500);
        await game.settings.set(MODULE_ID, 'cookbooks', all);
        return true;
    }
};

function clamp(n) {
    return Math.max(0, Math.min(99, Math.floor(Number(n) || 0)));
}

function builtForSpeedEffect({ name, img, description }) {
    return {
        name: String(name || 'Built for Speed'),
        img: img || 'icons/magic/movement/trail-streak-zigzag-yellow.webp',
        type: 'base',
        system: {
            changes: [{ key: 'system.traits.agility.value', type: 'add', value: 1, phase: 'initial', priority: null }],
            duration: { type: 'shortRest', description: String(description ?? '') }
        },
        flags: { [MODULE_ID]: { meal: true } }
    };
}

export function registerRelay() {
    game.socket.on(CHANNEL, async msg => {
        if (msg.type === 'response') {
            const p = pending.get(msg.id);
            if (!p || msg.to !== game.user.id) return;
            pending.delete(msg.id);
            msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result);
            return;
        }
        if (listeners.has(msg.type)) {
            try {
                listeners.get(msg.type)(msg.data, msg.from);
            } catch (err) {
                console.error(`${MODULE_ID} | ${msg.type}`, err);
            }
            return;
        }
        if (msg.type !== 'request' || !game.user.isActiveGM) return;
        let result;
        let error;
        try {
            if (!OPS[msg.op]) throw new Error(`Unknown op ${msg.op}`);
            result = await OPS[msg.op](msg.data);
        } catch (err) {
            console.error(`${MODULE_ID} | relay`, err);
            error = err.message;
        }
        game.socket.emit(CHANNEL, { type: 'response', id: msg.id, to: msg.from, result, error });
    });
}

/**
 * Run an op directly when we may, otherwise ask the active GM.
 * @param {keyof OPS} op
 * @param {any} data
 * @param {boolean} canDirect  whether this user has the rights to do it themselves
 */
export async function run(op, data, canDirect = false) {
    if (canDirect || game.user.isGM) return OPS[op](data);
    if (!game.users.activeGM) throw new Error(game.i18n.localize('DHHOTPOT.Errors.NoGM'));
    const id = foundry.utils.randomID();
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        game.socket.emit(CHANNEL, { type: 'request', id, op, data, from: game.user.id });
        setTimeout(() => {
            if (pending.delete(id)) reject(new Error(game.i18n.localize('DHHOTPOT.Errors.Timeout')));
        }, 15000);
    });
}
