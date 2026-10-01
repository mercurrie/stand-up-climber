// The one (and only, for now) course. Every client loads this same data, so the
// level is identical for all players — nothing here is randomised.
//
// Coordinates are friendly to edit:
//   x       = platform centre, 0..480 (screen width)
//   height  = platform top surface, in px above the ground (bigger = higher)
//   width   = platform width in px
//
// Difficulty ramps by section: platforms shrink and vertical gaps grow
// (~130 → 165 → 190 → 205 px). Max jump height is ~240 px (see gameplay.js).

export const LEVEL_1 = {
  name: 'The Office Tower',

  // Empty sky above the goal, so obstacles can spawn off-screen.
  skyHeight: 520,
  groundThickness: 40,
  playerStartX: 240,

  sections: [
    { id: 'easy', color: 0x7ee081 },
    { id: 'medium', color: 0x4cc9f0 },
    { id: 'hard', color: 0xb388ff },
    { id: 'final', color: 0xff9f43 },
    { id: 'goal', color: 0xffd166 },
  ],

  platforms: [
    // Lower: big platforms, easy hops. They alternate sides and leave the
    // spawn column (x≈240) clear, so standing still doesn't climb for you.
    { section: 'easy', x: 125, height: 130, width: 170 },
    { section: 'easy', x: 345, height: 260, width: 170 },
    { section: 'easy', x: 140, height: 390, width: 160 },
    { section: 'easy', x: 340, height: 520, width: 160 },

    // Middle: smaller, further apart
    { section: 'medium', x: 130, height: 685, width: 150 },
    { section: 'medium', x: 340, height: 850, width: 150 },
    { section: 'medium', x: 200, height: 1015, width: 140 },
    { section: 'medium', x: 380, height: 1180, width: 130 },

    // Upper: long diagonal jumps
    { section: 'hard', x: 150, height: 1370, width: 115 },
    { section: 'hard', x: 340, height: 1560, width: 110 },
    { section: 'hard', x: 110, height: 1750, width: 105 },

    // Final: tight, but every jump is within reach
    { section: 'final', x: 330, height: 1955, width: 95 },
    { section: 'final', x: 140, height: 2160, width: 90 },

    // Goal: small and tucked against the right wall, so the last jump is a
    // long diagonal from the left-hand platform below. Still reachable: it
    // needs ~160px of sideways travel and a full jump gives ~220px.
    { section: 'goal', x: 405, height: 2365, width: 70, goal: true },
  ],
};
