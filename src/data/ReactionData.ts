import type { Reaction } from '../types';

export const REACTIONS: Record<string, Reaction> = {};

const reactionDefs: [string, string, string, string, number][] = [
  ['Pyro', 'Hydro', 'Vaporize', '#ff9944', 2],
  ['Hydro', 'Pyro', 'Vaporize', '#ff9944', 1.5],
  ['Pyro', 'Cryo', 'Melt', '#ffd070', 2],
  ['Cryo', 'Pyro', 'Melt', '#ffd070', 1.5],
  ['Pyro', 'Electro', 'Overloaded', '#ff4466', 1.8],
  ['Electro', 'Pyro', 'Overloaded', '#ff4466', 1.8],
  ['Cryo', 'Electro', 'Superconduct', '#bb88ff', 1.6],
  ['Electro', 'Cryo', 'Superconduct', '#bb88ff', 1.6],
  ['Cryo', 'Hydro', 'Frozen', '#aaeeff', 1.3],
  ['Hydro', 'Cryo', 'Frozen', '#aaeeff', 1.3],
  ['Electro', 'Hydro', 'Electro-Charged', '#8855ff', 1.5],
  ['Hydro', 'Electro', 'Electro-Charged', '#8855ff', 1.5],
  ['Anemo', 'Pyro', 'Swirl', '#72ffbf', 1.4],
  ['Anemo', 'Cryo', 'Swirl', '#72ffbf', 1.4],
  ['Anemo', 'Electro', 'Swirl', '#72ffbf', 1.4],
  ['Anemo', 'Hydro', 'Swirl', '#72ffbf', 1.4],
];

reactionDefs.forEach(([a, b, n, c, m]) => {
  REACTIONS[a + '+' + b] = { n, c, m };
});
