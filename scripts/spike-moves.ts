import { Dex } from '@pkmn/dex';
import { Generations } from '@pkmn/data';

const gens = new Generations(Dex);
const gen9 = gens.get(9);

const moves = [
  'Earthquake', 'Dragon Claw', 'Scale Shot', 'Stealth Rock', 'Swords Dance',
  'Meteor Mash', 'Bullet Punch', 'Zen Headbutt',
  'Parabolic Charge', 'Thunderbolt', 'Acid Spray', 'Muddy Water',
  'Whirlwind', 'Slack Off', 'Toxic',
  'Play Rough', 'Shadow Sneak', 'Drain Punch', 'Close Combat',
  'Aura Sphere', 'Flash Cannon', 'Extreme Speed',
  'Moonblast', 'Shadow Ball', 'Mystical Fire', 'Perish Song',
  'Sucker Punch', 'Iron Head', 'Kowtow Cleave', 'Swords Dance',
  'Surging Strikes', 'Aqua Jet', 'U-turn', 'Close Combat',
  'Draco Meteor', 'Fire Blast', 'Knock Off', 'Dragon Dance',
];

for (const m of Array.from(new Set(moves))) {
  const mv = gen9.moves.get(m);
  console.log(m.padEnd(20), mv ? `OK power=${mv.basePower} type=${mv.type}` : 'MISSING');
}
