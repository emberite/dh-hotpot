/**
 * Beast Feast adversaries: food-themed foes for the Plover Caves, Tiers 1–4.
 * Source data for tools/build-adversaries.mjs, which turns each entry into a system adversary
 * and stores it in the module's "Beast Feast Adversaries" compendium.
 *
 * Stats follow the medians of the system's own adversaries for each tier and type.
 * `harvest` lists what the beast yields; the Ingredient Generator uses it when you harvest the adversary
 * (how many is still set by max HP). Example ingredients from the rulebook keep their exact flavors.
 *
 * Feature shorthand:
 *   { std: 'relentless', n }   { std: 'minion', n }   { std: 'group' }   { std: 'momentum' }
 *   { std: 'terrifying' }      { std: 'slow' }        { std: 'flying' }
 *   { name, form: 'passive'|'action'|'reaction', img, text, act?: {
 *       type: 'attack'|'damage'|'save'|'effect'|'healing', cost: {stress|fear|hope: n},
 *       damage: '2d6', dtype: 'physical'|'magical', range, save: trait, half: bool, status, resource } }
 */

const I = (name, flavors, text = '') => ({ name, flavors, text });

export const ADVERSARIES = [
    /* ================================================================== */
    /*  TIER 1                                                            */
    /* ================================================================== */
    {
        name: 'Capshroom Creeper',
        tier: 1, type: 'minion', size: 'small',
        img: 'icons/consumables/mushrooms/bell-shiitake-brown.webp',
        description: 'A knee-high mushroom that shuffles along on root-toes, puffing spores whenever it bumps into something.',
        motives: 'Cluster, puff spores, shuffle toward warmth, swarm',
        difficulty: 10, hp: 1, stress: 1,
        attack: { name: 'Spore Bump', range: 'melee', bonus: -1, damage: '2', img: 'icons/magic/nature/root-vine-entangled-humanoid.webp' },
        experiences: [['Blend into the Fungus', 2]],
        features: [
            { std: 'minion', n: 3 },
            { std: 'group' },
            { name: 'Spore Puff', form: 'reaction', img: 'icons/magic/nature/mushroom-glow-red.webp',
              text: '<p>When the @Lookup[@name] is defeated, all creatures within Very Close range must succeed on an Instinct Reaction Roll or sneeze uncontrollably, making their next action roll with disadvantage.</p>',
              act: { type: 'save', save: 'instinct', range: 'veryClose' } }
        ],
        harvest: [I('Mushroom Caps', { bitter: 1, savory: 2 })]
    },
    {
        name: 'Crumbrat Pack',
        tier: 1, type: 'horde', size: 'small',
        img: 'icons/creatures/mammals/rodent-rat-green.webp',
        description: 'A writhing carpet of fat cave rats with crusty, bread-colored fur, drawn to anything that smells baked.',
        motives: 'Nibble, overwhelm, steal food, scatter',
        difficulty: 10, thresholds: [5, 10], hp: 5, stress: 2,
        attack: { name: 'Gnawing Teeth', range: 'melee', bonus: -1, damage: '1d8+2' },
        hordeDamage: '1d4+1', hordeHP: 1,
        experiences: [['Sniff Out Snacks', 3]],
        features: [
            { name: 'Pantry Raid', form: 'action', img: 'icons/consumables/grains/bread-loaf-boule-rustic-brown.webp',
              text: '<p><strong>Mark a Stress</strong> to have the @Lookup[@name] swarm a target within Melee range. The target must succeed on a Finesse Reaction Roll or lose one ingredient of the GM\'s choice from their inventory.</p>',
              act: { type: 'save', save: 'finesse', range: 'melee', cost: { stress: 1 } } }
        ],
        harvest: [I('Crumbrat Tail', { salty: 1, sweet: 1 }, 'It\'s crunchy, like a breadstick.')]
    },
    {
        name: 'Rileroot Shrieker',
        tier: 1, type: 'skulk', size: 'small',
        img: 'icons/consumables/plants/dried-stem-vine-root-bramble-brown.webp',
        description: 'A gnarled root-creature that buries itself in loose soil and screams when pulled up.',
        motives: 'Burrow, ambush, shriek, flee into the dirt',
        difficulty: 12, thresholds: [5, 8], hp: 3, stress: 3,
        attack: { name: 'Lashing Tendrils', range: 'veryClose', bonus: 1, damage: '1d6+2' },
        experiences: [['Hide Underground', 3]],
        features: [
            { name: 'Buried', form: 'passive', img: 'icons/magic/earth/projectile-stone-landslide.webp',
              text: '<p>While buried, the @Lookup[@name] is Hidden. Attacks made against them from hiding are made with advantage, and the first attack they make from hiding deals an extra <strong>1d6</strong> damage.</p>' },
            { name: 'Uprooted Scream', form: 'reaction', img: 'icons/magic/sonic/scream-wail-shout-teal.webp',
              text: '<p>When the @Lookup[@name] takes damage for the first time, they let out a piercing scream. All PCs within Close range must succeed on a Presence Reaction Roll or mark a Stress.</p>',
              act: { type: 'save', save: 'presence', range: 'close', resource: { stress: 1 } } }
        ],
        harvest: [I('Rileroot', { bitter: 1 })]
    },
    {
        name: 'Cave Boar',
        tier: 1, type: 'bruiser', size: 'large',
        img: 'icons/creatures/mammals/livestock-pig-green.webp',
        description: 'A shaggy, tusked boar the size of a cart, nursing its piglets in the warm grottos near the cave mouth.',
        motives: 'Charge, gore, protect the litter, root for mushrooms',
        difficulty: 13, thresholds: [8, 15], hp: 6, stress: 3,
        attack: { name: 'Tusks', range: 'melee', bonus: 1, damage: '1d10+3' },
        experiences: [['Protective Parent', 2]],
        features: [
            { std: 'momentum' },
            { name: 'Bowling Charge', form: 'action', img: 'icons/creatures/mammals/ox-buffalo-horned-green.webp',
              text: '<p><strong>Mark a Stress</strong> to charge through a line of targets within Close range. Each must succeed on an Agility Reaction Roll or take <strong>1d10+2</strong> physical damage and be knocked down, making them Vulnerable until they next act.</p>',
              act: { type: 'save', save: 'agility', range: 'close', cost: { stress: 1 }, damage: '1d10+2', status: 'vulnerable' } }
        ],
        harvest: [I('Cave Boar Milk', { salty: 1, savory: 1 }), I('Boar Belly', { savory: 2, salty: 1 })]
    },
    {
        name: 'Sugarglass Moth',
        tier: 1, type: 'ranged', size: 'small',
        img: 'icons/creatures/invertebrates/dragonfly-teal.webp',
        description: 'A moth with wings like stained candy glass. The dust it sheds is sweet, sticky and makes eyes water.',
        motives: 'Flutter out of reach, dust, lure toward light',
        difficulty: 10, thresholds: [4, 7], hp: 3, stress: 2,
        attack: { name: 'Sticky Dust', range: 'far', bonus: 0, damage: '1d8+2', dtype: 'magical', img: 'icons/magic/air/wind-stream-purple.webp' },
        experiences: [['Fly by Night', 2]],
        features: [
            { std: 'flying' },
            { name: 'Sugar-Glazed', form: 'reaction', img: 'icons/consumables/fruit/berry-leaf-pink.webp',
              text: '<p>When the @Lookup[@name] succeeds on a standard attack, the target is coated in sweet dust. Until they spend an action wiping it off, beasts within Far range treat them as the most delicious-smelling target.</p>' }
        ],
        harvest: [I('Sugarglass Wing', { sweet: 2 }, 'It\'s completely translucent.')]
    },
    {
        name: 'Glutton Ogre',
        tier: 1, type: 'solo', size: 'large',
        img: 'icons/creatures/magical/humanoid-giant-forest-blue.webp',
        description: 'An enormous, perpetually hungry ogre whose belly rumbles loud enough to shake stalactites loose.',
        motives: 'Devour, grab, hoard snacks, nap after eating',
        difficulty: 13, thresholds: [8, 15], hp: 8, stress: 3,
        attack: { name: 'Meaty Fist', range: 'veryClose', bonus: 2, damage: '1d12+2' },
        experiences: [['Smell Food', 3], ['Throw Things', 2]],
        features: [
            { std: 'relentless', n: 2 },
            { name: 'Swallow Whole', form: 'action', img: 'icons/creatures/abilities/mouth-teeth-tongue-purple.webp',
              text: '<p><strong>Spend a Fear</strong> to make an attack against a target within Melee range. On a success, the target is swallowed: they are Restrained, take <strong>1d6</strong> physical damage at the start of each GM turn, and can only attack the @Lookup[@name]. When the @Lookup[@name] takes Severe damage, they spit everyone out.</p>',
              act: { type: 'attack', range: 'melee', cost: { fear: 1 }, damage: '1d6', status: 'restrained' } },
            { name: 'Indigestion', form: 'reaction', img: 'icons/magic/acid/dissolve-bone-white.webp',
              text: '<p>When the @Lookup[@name] marks their last Stress, they belch a cloud of foul air. All creatures within Very Close range must succeed on a Strength Reaction Roll or mark a Stress.</p>',
              act: { type: 'save', save: 'strength', range: 'veryClose', resource: { stress: 1 } } }
        ],
        harvest: [I('Ogre Kidney Stone', { sweet: 1, weird: 1 }), I('Ogre Jowl', { savory: 2, salty: 1 })]
    },

    /* ================================================================== */
    /*  TIER 2                                                            */
    /* ================================================================== */
    {
        name: 'Direbear',
        tier: 2, type: 'bruiser', size: 'large',
        img: 'icons/creatures/abilities/bear-roar-bite-brown.webp',
        description: 'A towering bear with ridged, armor-like fur, prized by every cook in Elmore for its marbled meat.',
        motives: 'Maul, roar, guard the den, eat anything',
        difficulty: 15, thresholds: [14, 28], hp: 7, stress: 3,
        attack: { name: 'Crushing Claws', range: 'melee', bonus: 2, damage: '2d10+3' },
        experiences: [['Ambusher', 2], ['Keen Senses', 2]],
        features: [
            { std: 'momentum' },
            { name: 'Bear Hug', form: 'action', img: 'icons/creatures/claws/claw-bear-paw-swipe-brown.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Melee range. On a success, the target takes <strong>2d8+2</strong> physical damage and is Restrained until they break free with a successful Strength Roll.</p>',
              act: { type: 'attack', range: 'melee', cost: { stress: 1 }, damage: '2d8+2', status: 'restrained' } },
            { name: 'Thick Hide', form: 'passive', img: 'icons/commodities/leather/fur-pelt-bear.webp',
              text: '<p>The @Lookup[@name] reduces all physical damage they take by <strong>2</strong>.</p>' }
        ],
        harvest: [I('Direbear Meat', { savory: 3 })]
    },
    {
        name: 'Marrow Ooze',
        tier: 2, type: 'standard', size: 'medium',
        img: 'icons/creatures/slimes/slime-blob-pseudopods-green.webp',
        description: 'A quivering, translucent ooze with half-dissolved bones drifting inside. It smells faintly of caramel.',
        motives: 'Engulf, dissolve, split, ooze into cracks',
        difficulty: 14, thresholds: [9, 18], hp: 5, stress: 3,
        attack: { name: 'Pseudopod', range: 'veryClose', bonus: 1, damage: '2d6+3', dtype: 'magical' },
        experiences: [['Squeeze Through Gaps', 3]],
        resist: 'physical',
        features: [
            { name: 'Gelatinous Body', form: 'passive', img: 'icons/creatures/slimes/slime-bubble-green.webp',
              text: '<p>The @Lookup[@name] is resistant to physical damage.</p>' },
            { name: 'Engulf', form: 'action', img: 'icons/magic/acid/dissolve-drip-droplet-smoke.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Melee range. On a success, the target is Restrained inside the @Lookup[@name] and takes <strong>1d10</strong> magic damage whenever the @Lookup[@name] is spotlighted.</p>',
              act: { type: 'attack', range: 'melee', cost: { stress: 1 }, damage: '1d10', dtype: 'magical', status: 'restrained' } },
            { name: 'Sweet Spot', form: 'passive', img: 'icons/consumables/fruit/berry-leaf-pink.webp',
              text: '<p>A PC who succeeds on an Instinct Roll can spot the marrow-bone that holds the @Lookup[@name] together. Their next attack against the @Lookup[@name] ignores Gelatinous Body.</p>' }
        ],
        harvest: [I('Ooze Marrow', { sweet: 1, bitter: 2 })]
    },
    {
        name: 'Ghost Scorpion',
        tier: 2, type: 'skulk', size: 'medium',
        img: 'icons/creatures/invertebrates/scorpion-yellow.webp',
        description: 'A pale, half-transparent scorpion that drifts through stone. Its venom is said to set tongues on fire.',
        motives: 'Phase through walls, sting, vanish, stalk the lone',
        difficulty: 14, thresholds: [9, 17], hp: 4, stress: 4,
        attack: { name: 'Pincers', range: 'melee', bonus: 3, damage: '2d8+2' },
        experiences: [['Unseen Hunter', 3]],
        features: [
            { name: 'Phase Shell', form: 'action', img: 'icons/magic/perception/silhouette-stealth-shadow.webp',
              text: '<p><strong>Mark a Stress</strong> to become Hidden and pass through solid stone until the @Lookup[@name] next makes an attack.</p>',
              act: { type: 'effect', cost: { stress: 1 }, status: 'hidden' } },
            { name: 'Spicy Sting', form: 'action', img: 'icons/creatures/abilities/stinger-poison-scorpion-brown.webp',
              text: '<p>Make an attack against a target within Melee range. On a success, the target takes <strong>2d6</strong> physical damage and their mouth burns: they mark a Stress and can\'t speak above a whisper until their next rest.</p>',
              act: { type: 'attack', range: 'melee', damage: '2d6', resource: { stress: 1 } } }
        ],
        harvest: [I('Ghost Scorpion Venom', { sour: 1, savory: 1 }, 'Spicy: If your flavor dice match on results of 8 or higher, you can\'t clear Stress using this dish.')]
    },
    {
        name: 'Cavern Wyvern',
        tier: 2, type: 'solo', size: 'large',
        img: 'icons/creatures/reptiles/dragon-winged-blue.webp',
        description: 'A lean wyvern that nests on the ceilings of the great caverns, tasting the air with a long, forked tongue.',
        motives: 'Dive, snatch, carry off, taste everything',
        difficulty: 15, thresholds: [13, 26], hp: 8, stress: 5,
        attack: { name: 'Raking Talons', range: 'veryClose', bonus: 3, damage: '2d10+2' },
        experiences: [['Aerial Predator', 3]],
        features: [
            { std: 'relentless', n: 2 },
            { std: 'flying' },
            { name: 'Snatch and Soar', form: 'action', img: 'icons/creatures/abilities/wings-birdlike-blue.webp',
              text: '<p><strong>Spend a Fear</strong> to make an attack against a target within Very Close range. On a success, the target takes <strong>2d8</strong> physical damage, is carried to a point within Far range, and is dropped, taking an additional <strong>1d8</strong> physical damage.</p>',
              act: { type: 'attack', range: 'veryClose', cost: { fear: 1 }, damage: '3d8' } },
            { name: 'Tasting Tongue', form: 'passive', img: 'icons/creatures/abilities/mouth-teeth-tongue-purple.webp',
              text: '<p>The @Lookup[@name] always knows the location of any creature carrying ingredients within Far range.</p>' }
        ],
        harvest: [I('Wyvern Tongue', { sour: 1, savory: 1, weird: 1 }), I('Wyvern Wing', { savory: 2 })]
    },
    {
        name: 'Diregazelle Matriarch',
        tier: 2, type: 'leader', size: 'large',
        img: 'icons/creatures/mammals/deer-antlers-green.webp',
        description: 'A swift, long-horned gazelle that leads her herd through the caverns at reckless speed.',
        motives: 'Outrun, rally the herd, trample, lead astray',
        difficulty: 16, thresholds: [12, 25], hp: 6, stress: 4,
        attack: { name: 'Spiral Horns', range: 'veryClose', bonus: 3, damage: '2d8+3' },
        experiences: [['Fleet-Footed', 3], ['Herd Instincts', 2]],
        features: [
            { name: 'Stampede!', form: 'action', img: 'icons/creatures/mammals/spirit-deer-herd-blue.webp',
              text: '<p><strong>Spend a Fear</strong> to spotlight the @Lookup[@name] and up to three allies within Far range. Each can move up to Far range and make a standard attack against a target they moved past.</p>',
              act: { type: 'effect', cost: { fear: 1 } } },
            { name: 'Built for Speed', form: 'passive', img: 'icons/magic/movement/trail-streak-zigzag-yellow.webp',
              text: '<p>The @Lookup[@name] can move up to Far range as part of any action, and attacks against them while they are moving are made with disadvantage.</p>' },
            { std: 'momentum' }
        ],
        harvest: [I('Diregazelle Skull Marrow', { sweet: 1, salty: 1, sour: 1 }, 'Built for Speed: You gain a +1 bonus to your Agility until your next short rest.'), I('Gazelle Haunch', { savory: 2, sweet: 1 })]
    },
    {
        name: 'Pepperjack Imps',
        tier: 2, type: 'horde', size: 'small',
        img: 'icons/creatures/unholy/demon-fire-imp.webp',
        description: 'Cackling little fire-imps that live in the hot springs and season everything with sparks.',
        motives: 'Taunt, set fires, steal spices, mob',
        difficulty: 14, thresholds: [10, 20], hp: 5, stress: 3,
        attack: { name: 'Hot Pokers', range: 'veryClose', bonus: 0, damage: '2d6+3', dtype: 'magical', img: 'icons/magic/fire/flame-burning-hand-orange.webp' },
        hordeDamage: '1d6+2', hordeHP: 2,
        experiences: [['Pranksters', 3]],
        features: [
            { name: 'Over-Seasoned', form: 'reaction', img: 'icons/magic/fire/projectile-fireball-orange.webp',
              text: '<p>When the @Lookup[@name] succeed on a standard attack, the target catches a spark. At the start of their next turn, they take <strong>1d6</strong> magic damage unless they spend their action patting it out.</p>',
              act: { type: 'damage', damage: '1d6', dtype: 'magical' } }
        ],
        harvest: [I('Pepperjack Ember', { sour: 1, savory: 1 }, 'It\'s emitting a colorful gas.')]
    },
    {
        name: 'Fungril Saucier',
        tier: 2, type: 'support', size: 'medium',
        img: 'icons/consumables/mushrooms/campanulate-bell-red-white.webp',
        description: 'A tall fungal chef in a stained apron, convinced every creature in the caves is an ingredient waiting for the right sauce.',
        motives: 'Marinate foes, buff allies, critique cooking, collect recipes',
        difficulty: 14, thresholds: [9, 18], hp: 4, stress: 6,
        attack: { name: 'Ladle', range: 'melee', bonus: 2, damage: '2d6+2' },
        experiences: [['Culinary Lore', 3], ['Spore Speech', 2]],
        features: [
            { name: 'Secret Sauce', form: 'action', img: 'icons/consumables/potions/bottle-bulb-corked-green.webp',
              text: '<p><strong>Mark a Stress</strong> to splash an ally within Close range. They clear a HP and their next attack deals an extra <strong>1d6</strong> damage.</p>',
              act: { type: 'healing', range: 'close', cost: { stress: 1 }, heal: '1' } },
            { name: 'Marinate', form: 'action', img: 'icons/magic/acid/projectile-smoke-glowing.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Close range. On a success, the target is Vulnerable until the end of the scene or until they wash off in water.</p>',
              act: { type: 'attack', range: 'close', cost: { stress: 1 }, status: 'vulnerable' } },
            { name: 'Harsh Critic', form: 'reaction', img: 'icons/sundries/books/book-red-exclamation.webp',
              text: '<p>When a PC within Close range eats a meal or uses an ingredient, the @Lookup[@name] can critique it. That PC must succeed on a Presence Reaction Roll or mark a Stress.</p>',
              act: { type: 'save', save: 'presence', range: 'close', resource: { stress: 1 } } }
        ],
        harvest: [I('Saucier Gills', { savory: 1, sour: 1, bitter: 1 }, 'It smells unbelievably good.')]
    },
    {
        name: 'Brineback Eel',
        tier: 2, type: 'ranged', size: 'large',
        img: 'icons/creatures/fish/fish-fangtooth-skeletal-green.webp',
        description: 'A long, salt-crusted eel that lurks in underground brine pools and spits jets of scalding salt water.',
        motives: 'Lurk, spit, drag into the water, ambush from below',
        difficulty: 14, thresholds: [9, 17], hp: 5, stress: 3,
        attack: { name: 'Brine Jet', range: 'far', bonus: 2, damage: '2d8+3', img: 'icons/magic/water/projectile-water-rings.webp' },
        experiences: [['Water Ambush', 3]],
        features: [
            { name: 'Salt Crust', form: 'reaction', img: 'icons/commodities/materials/bowl-powder-grey.webp',
              text: '<p>When the @Lookup[@name] succeeds on a standard attack, the target\'s eyes sting with salt: their next attack roll is made with disadvantage.</p>' },
            { name: 'Drag Under', form: 'action', img: 'icons/magic/water/wave-water-blue.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Close range of the water. On a success, the target is pulled into the brine pool, Restrained, and takes <strong>2d6</strong> physical damage.</p>',
              act: { type: 'attack', range: 'close', cost: { stress: 1 }, damage: '2d6', status: 'restrained' } }
        ],
        harvest: [I('Brineback Fillet', { salty: 2, savory: 1 })]
    },

    /* ================================================================== */
    /*  TIER 3                                                            */
    /* ================================================================== */
    {
        name: 'Acid Dragon',
        tier: 3, type: 'solo', size: 'huge',
        img: 'icons/creatures/reptiles/dragon-horned-blue.webp',
        description: 'A sinuous dragon whose drool eats through stone. Its saliva is the most prized souring agent in the caves.',
        motives: 'Dissolve, hoard, corrode, ambush from acid pools',
        difficulty: 18, thresholds: [20, 35], hp: 10, stress: 6,
        attack: { name: 'Corroding Bite', range: 'veryClose', bonus: 5, damage: '3d10+2' },
        experiences: [['Ancient Cunning', 3], ['Acid Pools', 3]],
        features: [
            { std: 'relentless', n: 3 },
            { name: 'Acid Breath', form: 'action', img: 'icons/magic/acid/projectile-smoke-glowing.webp',
              text: '<p><strong>Spend a Fear</strong> to exhale acid in front of the @Lookup[@name]. All targets within Close range must succeed on an Agility Reaction Roll or take <strong>3d10+4</strong> physical damage and mark an Armor Slot without its benefits. Targets who succeed take half damage.</p>',
              act: { type: 'save', save: 'agility', range: 'close', cost: { fear: 1 }, damage: '3d10+4', half: true } },
            { name: 'Drool Pools', form: 'passive', img: 'icons/magic/acid/dissolve-pool-bubbles.webp',
              text: '<p>The ground within Very Close range of the @Lookup[@name] is covered in acid. Creatures other than the @Lookup[@name] who start their turn there take <strong>1d10</strong> physical damage.</p>' },
            { std: 'terrifying' }
        ],
        harvest: [I('Acid Dragon Saliva', { sour: 2 }), I('Dragon Brisket', { savory: 3, weird: 1 })]
    },
    {
        name: 'Deathflower Bloom',
        tier: 3, type: 'support', size: 'large',
        img: 'icons/commodities/flowers/buds-black-red.webp',
        description: 'A towering black-petaled flower whose perfume lulls prey to sleep. Cooks whisper that its petals are delicious, if they don\'t kill you.',
        motives: 'Lull, entangle, drain, bloom where something died',
        difficulty: 16, thresholds: [18, 33], hp: 6, stress: 5,
        attack: { name: 'Thorned Vines', range: 'close', bonus: 3, damage: '3d6+5', dtype: 'magical', img: 'icons/magic/nature/root-vine-thorned-coil-green.webp' },
        experiences: [['Patient Predator', 3]],
        features: [
            { std: 'slow' },
            { name: 'Lulling Perfume', form: 'action', img: 'icons/magic/nature/mushroom-glow-red.webp',
              text: '<p><strong>Mark a Stress</strong>. All PCs within Close range must succeed on an Instinct Reaction Roll or fall asleep, becoming Vulnerable and unable to act until they take damage or an ally spends an action to wake them.</p>',
              act: { type: 'save', save: 'instinct', range: 'close', cost: { stress: 1 }, status: 'vulnerable' } },
            { name: 'Death Bloom', form: 'reaction', img: 'icons/magic/death/skull-energy-light-purple.webp',
              text: '<p>When a creature is defeated within Far range of the @Lookup[@name], they clear <strong>2</strong> HP and another Deathflower sprout pushes up through the corpse.</p>',
              act: { type: 'healing', heal: '2' } }
        ],
        harvest: [I('Deathflower', { bitter: 2 }, 'Risky: If you roll no matches on your flavor dice, you clear all Hit Points and Stress and gain 3 Hope. If you roll any matches on your flavor dice, your Meal Rating is 0 and you must make a death move.')]
    },
    {
        name: 'Gingerbread Golem',
        tier: 3, type: 'bruiser', size: 'huge',
        img: 'icons/magic/earth/strike-body-stone-crumble.webp',
        description: 'A hulking construct of baked stone and spiced dough, built by a long-dead baker to guard a recipe vault.',
        motives: 'Guard the vault, crush intruders, crumble and reform',
        difficulty: 17, thresholds: [22, 40], hp: 7, stress: 4,
        attack: { name: 'Doughy Fists', range: 'veryClose', bonus: 3, damage: '3d10+1' },
        experiences: [['Unyielding', 3]],
        features: [
            { name: 'Crumble and Reform', form: 'reaction', img: 'icons/magic/earth/projectile-stone-boulder-brown.webp',
              text: '<p>When the @Lookup[@name] takes Major or greater damage, crumbs scatter within Very Close range. <strong>Spend a Fear</strong> to have them clear <strong>1</strong> HP as the crumbs pull back together.</p>',
              act: { type: 'healing', cost: { fear: 1 }, heal: '1' } },
            { name: 'Icing Slam', form: 'action', img: 'icons/magic/earth/barrier-stone-explosion-red.webp',
              text: '<p><strong>Mark a Stress</strong> to slam the ground. All creatures within Very Close range must succeed on a Strength Reaction Roll or take <strong>3d8+3</strong> physical damage and become stuck in hardening icing (Restrained).</p>',
              act: { type: 'save', save: 'strength', range: 'veryClose', cost: { stress: 1 }, damage: '3d8+3', status: 'restrained' } },
            { std: 'slow' }
        ],
        harvest: [I('Gingerbread Brick', { sweet: 2, salty: 1 }, 'It\'s brittle.')]
    },
    {
        name: 'Stewpot Mimic',
        tier: 3, type: 'skulk', size: 'medium',
        img: 'icons/tools/cooking/cauldron-empty.webp',
        description: 'A creature that looks exactly like an abandoned cookpot full of warm stew, right up until someone leans in for a taste.',
        motives: 'Disguise, lure, bite, swallow ladles',
        difficulty: 15, thresholds: [16, 30], hp: 6, stress: 4,
        attack: { name: 'Lid Bite', range: 'melee', bonus: 3, damage: '3d8+5' },
        experiences: [['Perfect Disguise', 4]],
        features: [
            { name: 'Smells Delicious', form: 'passive', img: 'icons/tools/cooking/bowl-steaming-brown.webp',
              text: '<p>While the @Lookup[@name] hasn\'t moved, it is indistinguishable from a pot of stew. PCs within Close range must succeed on an Instinct Roll (14) to resist approaching it.</p>' },
            { name: 'Gotcha!', form: 'action', img: 'icons/creatures/abilities/mouth-teeth-tongue-purple.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack with advantage against a target within Melee range who didn\'t know it was a mimic. On a success, deal <strong>4d8+5</strong> physical damage and the target is Restrained in the lid.</p>',
              act: { type: 'attack', range: 'melee', cost: { stress: 1 }, damage: '4d8+5', status: 'restrained' } }
        ],
        harvest: [I('Mimic Broth', { savory: 2, weird: 1 }, 'It looks like something it isn\'t.')]
    },
    {
        name: 'Moonrind Mites',
        tier: 3, type: 'horde', size: 'tiny',
        img: 'icons/creatures/invertebrates/tick-cross-glowing-purple.webp',
        description: 'A glittering cloud of cheese mites that hollow out whole caverns of aged mold-rind, glowing faintly like moonlight.',
        motives: 'Burrow into armor, nibble, glow, swarm the warm',
        difficulty: 15, thresholds: [16, 31], hp: 7, stress: 3,
        attack: { name: 'Nibbling Cloud', range: 'veryClose', bonus: 1, damage: '3d6+6' },
        hordeDamage: '2d6+3', hordeHP: 2,
        experiences: [['Get Everywhere', 3]],
        features: [
            { name: 'Into the Cracks', form: 'reaction', img: 'icons/creatures/invertebrates/bug-sixlegged-gray.webp',
              text: '<p>When the @Lookup[@name] succeed on a standard attack, the target must mark an Armor Slot without receiving its benefits.</p>',
              act: { type: 'damage', resource: { armor: 1 } } }
        ],
        harvest: [I('Moonrind', { salty: 2, sour: 1 }, 'It comes apart in layers.')]
    },
    {
        name: 'Toastrench Salamander',
        tier: 3, type: 'standard', size: 'large',
        img: 'icons/creatures/reptiles/lizard-mouth-glowing-red.webp',
        description: 'A glowing salamander that basks in the lava trench, its hide crisp and smoking like fresh toast.',
        motives: 'Bask, scorch, defend the heat, burrow into embers',
        difficulty: 16, thresholds: [18, 35], hp: 7, stress: 5,
        attack: { name: 'Searing Bite', range: 'melee', bonus: 3, damage: '3d8+3', dtype: 'magical' },
        experiences: [['Heat-Seeker', 3]],
        features: [
            { name: 'Smoking Hide', form: 'passive', img: 'icons/magic/fire/beam-jet-stream-embers.webp',
              text: '<p>Creatures that hit the @Lookup[@name] with a melee attack take <strong>1d8</strong> magic damage.</p>' },
            { name: 'Ember Spit', form: 'action', img: 'icons/magic/fire/projectile-fireball-orange.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Far range. On a success, deal <strong>3d6+3</strong> magic damage and the area within Very Close range of the target catches fire.</p>',
              act: { type: 'attack', range: 'far', cost: { stress: 1 }, damage: '3d6+3', dtype: 'magical' } }
        ],
        harvest: [I('Toasted Salamander Tail', { savory: 2, bitter: 1 }), I('Ember Gland', { sour: 1, weird: 1 })]
    },

    /* ================================================================== */
    /*  TIER 4                                                            */
    /* ================================================================== */
    {
        name: 'Stew Sea Leviathan',
        tier: 4, type: 'solo', size: 'huge',
        img: 'icons/creatures/fish/squid-kraken-orange.webp',
        description: 'Something vast moves beneath the thick, simmering waters of the Stew Sea. Its tentacles are lined with suckers the size of cooking pots.',
        motives: 'Drag down, stir the sea, devour ships, simmer',
        difficulty: 20, thresholds: [35, 68], hp: 11, stress: 8,
        attack: { name: 'Crushing Tentacle', range: 'close', bonus: 8, damage: '4d10+10' },
        experiences: [['Lord of the Stew', 4]],
        features: [
            { std: 'relentless', n: 3 },
            { name: 'Boiling Surge', form: 'action', img: 'icons/magic/water/wave-water-blue.webp',
              text: '<p><strong>Spend a Fear</strong> to heave the Stew Sea. All creatures within Far range must succeed on a Strength Reaction Roll or take <strong>4d8+8</strong> magic damage and be swept to a point within Close range of the @Lookup[@name]. Targets who succeed take half damage.</p>',
              act: { type: 'save', save: 'strength', range: 'far', cost: { fear: 1 }, damage: '4d8+8', dtype: 'magical', half: true } },
            { name: 'Into the Pot', form: 'action', img: 'icons/creatures/tentacles/tentacles-octopus-black-pink.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Close range. On a success, the target is Restrained and dragged beneath the surface; they take <strong>2d10</strong> magic damage at the start of each GM turn until freed.</p>',
              act: { type: 'attack', range: 'close', cost: { stress: 1 }, damage: '2d10', dtype: 'magical', status: 'restrained' } },
            { std: 'terrifying' }
        ],
        harvest: [I('Leviathan Roe', { salty: 2, weird: 2 }), I('Leviathan Sucker', { savory: 3 }), I('Stew Sea Brine', { salty: 3 })]
    },
    {
        name: 'Hadral Gourmand',
        tier: 4, type: 'leader', size: 'large',
        img: 'icons/creatures/unholy/demon-winged-cyclops-drooling.webp',
        description: 'An ancient epicure from the deepest cave, who has eaten every creature in the Hadral and now hungers for heroes.',
        motives: 'Taste, command servants, savor fear, collect the rare',
        difficulty: 20, thresholds: [37, 70], hp: 7, stress: 8,
        attack: { name: 'Carving Knives', range: 'veryClose', bonus: 8, damage: '4d10+10' },
        experiences: [['Refined Palate', 4], ['Commanding Presence', 3]],
        features: [
            { name: 'Dinner Bell', form: 'action', img: 'icons/tools/instruments/bell-brass-brown.webp',
              text: '<p><strong>Spend a Fear</strong> to spotlight the @Lookup[@name] and up to three allies within Far range. Each ally can immediately make a standard attack.</p>',
              act: { type: 'effect', cost: { fear: 1 } } },
            { name: 'Savor the Moment', form: 'reaction', img: 'icons/magic/unholy/strike-body-life-soul-purple.webp',
              text: '<p>When a PC within Close range marks their last Hit Point, the @Lookup[@name] clears <strong>2</strong> HP and you gain a Fear.</p>',
              act: { type: 'healing', heal: '2' } },
            { name: 'Exquisite Taste', form: 'action', img: 'icons/creatures/abilities/mouth-teeth-tongue-purple.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against a target within Melee range. On a success, deal <strong>3d10+8</strong> physical damage and the target loses a Hope as the @Lookup[@name] savors their fear.</p>',
              act: { type: 'attack', range: 'melee', cost: { stress: 1 }, damage: '3d10+8', resource: { hope: 1 } } },
            { std: 'momentum' }
        ],
        harvest: [I('Gourmand\'s Bile', { bitter: 2, weird: 2 }), I('Gourmand Tongue', { sour: 1, savory: 2, weird: 1 })]
    },
    {
        name: 'Obelick Horror',
        tier: 4, type: 'bruiser', size: 'huge',
        img: 'icons/creatures/abilities/mouth-teeth-tongue-purple.webp',
        description: 'A colossal tongue-beast coiled around the Obelick, lapping at the minerals that seep from the ancient stone.',
        motives: 'Lick, crush, dissolve, cling to the Obelick',
        difficulty: 20, thresholds: [40, 70], hp: 8, stress: 5,
        attack: { name: 'Papillae Lash', range: 'close', bonus: 4, damage: '4d10+10' },
        experiences: [['Taste the Air', 3]],
        features: [
            { name: 'Sticky Tongue', form: 'action', img: 'icons/magic/nature/root-vine-entangled-humanoid.webp',
              text: '<p><strong>Mark a Stress</strong> to make an attack against all targets in a line within Far range. Targets the @Lookup[@name] succeeds against are pulled into Melee range and Restrained.</p>',
              act: { type: 'attack', range: 'far', cost: { stress: 1 }, status: 'restrained' } },
            { name: 'Digestive Coating', form: 'passive', img: 'icons/magic/acid/dissolve-drip-droplet-smoke.webp',
              text: '<p>While Restrained by the @Lookup[@name], a creature takes <strong>2d10</strong> magic damage at the start of each GM turn.</p>' },
            { std: 'relentless', n: 2 }
        ],
        harvest: [I('Obelick Papillae', { sour: 2, weird: 1 }), I('Horror Tongue Steak', { savory: 3, sour: 1 })]
    },
    {
        name: 'Saffron Phoenix',
        tier: 4, type: 'ranged', size: 'large',
        img: 'icons/creatures/birds/raptor-hawk-flying.webp',
        description: 'A blazing bird whose plumage smolders with the scent of saffron. Every century it burns down to a pile of precious spice.',
        motives: 'Soar, rain fire, be reborn, guard the nest',
        difficulty: 19, thresholds: [25, 45], hp: 4, stress: 3,
        attack: { name: 'Spice Fire', range: 'veryFar', bonus: 5, damage: '4d8+8', dtype: 'magical', img: 'icons/magic/fire/projectile-fireball-orange.webp' },
        experiences: [['Above It All', 3]],
        features: [
            { std: 'flying' },
            { name: 'Rain of Embers', form: 'action', img: 'icons/magic/fire/explosion-fireball-large-orange.webp',
              text: '<p><strong>Mark a Stress</strong>. All targets within Close range of a point within Far range must succeed on an Agility Reaction Roll or take <strong>4d6+6</strong> magic damage. Targets who succeed take half damage.</p>',
              act: { type: 'save', save: 'agility', range: 'far', cost: { stress: 1 }, damage: '4d6+6', dtype: 'magical', half: true } },
            { name: 'From the Ashes', form: 'reaction', img: 'icons/magic/fire/flame-burning-fist-strike.webp',
              text: '<p>The first time the @Lookup[@name] is defeated, <strong>spend a Fear</strong> to have them rise again at the end of the next GM turn with half their HP cleared.</p>',
              act: { type: 'healing', cost: { fear: 1 }, heal: '2' } }
        ],
        harvest: [I('Saffron Ash', { bitter: 1, weird: 2 }, 'It must be prepared in a strange way.'), I('Phoenix Drumstick', { savory: 2, sweet: 1 })]
    },
    {
        name: 'Banquet Revenants',
        tier: 4, type: 'horde', size: 'medium',
        img: 'icons/creatures/magical/spirit-undead-ghost-tan-teal.webp',
        description: 'The restless dead of a feast that never ended, still clutching their forks and demanding another course.',
        motives: 'Demand more, surround, feast, never leave the table',
        difficulty: 17, thresholds: [25, 45], hp: 8, stress: 5,
        attack: { name: 'Grave Forks', range: 'melee', bonus: 2, damage: '4d6+10' },
        hordeDamage: '2d6+5', hordeHP: 2,
        experiences: [['Endless Hunger', 3]],
        features: [
            { name: 'Another Course!', form: 'reaction', img: 'icons/tools/cooking/fork-steel-grey.webp',
              text: '<p>When a PC within Close range uses an ingredient or eats, the @Lookup[@name] are drawn to them. Spotlight the @Lookup[@name]; they must move toward that PC.</p>' },
            { std: 'terrifying' }
        ],
        harvest: [I('Revenant Grave-Salt', { salty: 2, bitter: 1 }, 'It withers in the dark.')]
    },
    {
        name: 'Spun-Sugar Wisp',
        tier: 4, type: 'minion', size: 'small',
        img: 'icons/magic/light/orbs-hand-gray.webp',
        description: 'Floating wisps of caramelized light that drift in the deep caves and burst into scalding sugar when touched.',
        motives: 'Drift, cluster, burst, lure into darkness',
        difficulty: 18, hp: 1, stress: 1,
        attack: { name: 'Caramel Burn', range: 'veryClose', bonus: 3, damage: '11', dtype: 'magical' },
        experiences: [['Drift Unseen', 3]],
        features: [
            { std: 'minion', n: 12 },
            { std: 'group' },
            { name: 'Sugar Burst', form: 'reaction', img: 'icons/magic/light/explosion-star-glow-orange.webp',
              text: '<p>When the @Lookup[@name] is defeated, all creatures within Very Close range must succeed on an Agility Reaction Roll or be coated in hardening sugar, Restrained until they break free with a Strength Roll.</p>',
              act: { type: 'save', save: 'agility', range: 'veryClose', status: 'restrained' } }
        ],
        harvest: [I('Spun-Sugar Wisp', { sweet: 3 }, 'It\'s emitting a colorful gas.')]
    },
    {
        name: 'Holy Cow',
        tier: 4, type: 'social', size: 'large',
        img: 'icons/creatures/mammals/livestock-cow-green.webp',
        description: 'A radiant, unflappable cow revered by the deep-cave dwellers. Its milk is said to bring the dying back from the brink.',
        motives: 'Graze serenely, bless the worthy, judge the greedy, wander',
        difficulty: 18, thresholds: [26, 42], hp: 6, stress: 5,
        attack: { name: 'Divine Headbutt', range: 'melee', bonus: 3, damage: '4d6+8', dtype: 'magical' },
        experiences: [['Sacred Presence', 4]],
        features: [
            { name: 'Halo of Cream', form: 'action', img: 'icons/magic/holy/prayer-hands-glowing-yellow.webp',
              text: '<p><strong>Mark a Stress</strong>. All creatures within Close range who haven\'t attacked the @Lookup[@name] this scene clear <strong>2</strong> HP.</p>',
              act: { type: 'healing', range: 'close', cost: { stress: 1 }, heal: '2' } },
            { name: 'Judgment Moo', form: 'reaction', img: 'icons/magic/sonic/scream-wail-shout-teal.webp',
              text: '<p>When a creature within Close range attacks the @Lookup[@name], the @Lookup[@name] moos. All creatures that attacked them this scene must succeed on a Presence Reaction Roll or lose 2 Hope.</p>',
              act: { type: 'save', save: 'presence', range: 'close', resource: { hope: 2 } } },
            { name: 'Sacred Beast', form: 'passive', img: 'icons/magic/holy/angel-winged-humanoid-blue.webp',
              text: '<p>The @Lookup[@name] is immune to magic damage.</p>' }
        ],
        resist: 'magicalImmune',
        harvest: [I('Holy Cow\'s Milk', { weird: 1 }, 'Last Drop: When you have only one die remaining while cooking, roll it and add the result to your Meal Rating.')]
    }
];
