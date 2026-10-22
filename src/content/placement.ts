import type { PlacementQuestion } from './types';

/**
 * Placement bank: 5 questions per CEFR level, ordered A1 → C2.
 * The correct answer is listed first; options are shuffled when displayed.
 */
export const PLACEMENT: PlacementQuestion[] = [
  // A1
  { level: 'A1', skill: 'grammar', prompt: 'She ___ a teacher.', options: ['is', 'are', 'am'], answer: 0 },
  { level: 'A1', skill: 'grammar', prompt: 'They ___ two children.', options: ['have', 'has', 'are'], answer: 0 },
  { level: 'A1', skill: 'grammar', prompt: 'What ___ your name?', options: ['is', 'are', 'do'], answer: 0 },
  { level: 'A1', skill: 'grammar', prompt: 'There ___ three books on the table.', options: ['are', 'is', 'be'], answer: 0 },
  { level: 'A1', skill: 'vocabulary', prompt: 'The opposite of "hot" is…', options: ['cold', 'warm', 'big'], answer: 0 },
  // A2
  { level: 'A2', skill: 'grammar', prompt: 'I ___ to the cinema last night.', options: ['went', 'go', 'have gone'], answer: 0 },
  { level: 'A2', skill: 'grammar', prompt: 'My brother is ___ than me.', options: ['taller', 'more tall', 'tallest'], answer: 0 },
  { level: 'A2', skill: 'grammar', prompt: 'Look outside! It ___.', options: ['is raining', 'rains', 'rained'], answer: 0 },
  { level: 'A2', skill: 'grammar', prompt: 'How ___ sugar do you want in your tea?', options: ['much', 'many', 'lot'], answer: 0 },
  { level: 'A2', skill: 'vocabulary', prompt: 'I have a terrible ___. I need some medicine for my head.', options: ['headache', 'stomach', 'fever'], answer: 0 },
  // B1
  { level: 'B1', skill: 'grammar', prompt: "I've lived in this city ___ 2015.", options: ['since', 'for', 'from'], answer: 0 },
  { level: 'B1', skill: 'grammar', prompt: "If it rains tomorrow, we ___ at home.", options: ['will stay', 'would stay', 'stayed'], answer: 0 },
  { level: 'B1', skill: 'grammar', prompt: 'This bridge ___ in 1990.', options: ['was built', 'built', 'is building'], answer: 0 },
  { level: 'B1', skill: 'grammar', prompt: 'He asked me where ___.', options: ['I lived', 'did I live', 'do I live'], answer: 0 },
  { level: 'B1', skill: 'vocabulary', prompt: "I'm looking forward to ___ you next week.", options: ['seeing', 'see', 'saw'], answer: 0 },
  // B2
  { level: 'B2', skill: 'grammar', prompt: 'If I had known about the meeting, I ___.', options: ['would have come', 'would come', 'came'], answer: 0 },
  { level: 'B2', skill: 'grammar', prompt: "He ___ have left already — his car isn't here.", options: ['must', "can't", 'should'], answer: 0 },
  { level: 'B2', skill: 'grammar', prompt: 'I had my car ___ yesterday.', options: ['repaired', 'repair', 'repairing'], answer: 0 },
  { level: 'B2', skill: 'grammar', prompt: '___ the heavy rain, we enjoyed the trip.', options: ['Despite', 'Although', 'However'], answer: 0 },
  { level: 'B2', skill: 'vocabulary', prompt: "We've run ___ of milk. Can you buy some?", options: ['out', 'off', 'over'], answer: 0 },
  // C1
  { level: 'C1', skill: 'grammar', prompt: 'Never ___ such a beautiful view.', options: ['have I seen', 'I have seen', 'I saw'], answer: 0 },
  { level: 'C1', skill: 'grammar', prompt: '___ the report, she left the office.', options: ['Having finished', 'Finished', 'Having finish'], answer: 0 },
  { level: 'C1', skill: 'grammar', prompt: 'What I really need ___ a long holiday.', options: ['is', 'it is', 'are'], answer: 0 },
  {
    level: 'C1',
    skill: 'writing',
    prompt: 'Which sentence is most appropriate in academic writing?',
    options: ['The findings suggest that diet may influence sleep.', 'The findings prove diet always affects sleep.', 'Everyone knows diet affects sleep.'],
    answer: 0,
  },
  { level: 'C1', skill: 'vocabulary', prompt: 'Rising sea levels ___ a serious threat to coastal cities.', options: ['pose', 'make', 'do'], answer: 0 },
  // C2
  { level: 'C2', skill: 'grammar', prompt: 'It is essential that he ___ informed immediately.', options: ['be', 'is', 'will be'], answer: 0 },
  { level: 'C2', skill: 'grammar', prompt: '___ you require further assistance, please contact reception.', options: ['Should', 'Would', 'Had'], answer: 0 },
  { level: 'C2', skill: 'vocabulary', prompt: "He isn't stingy — he's just ___ with his money.", options: ['frugal', 'notorious', 'nosy'], answer: 0 },
  {
    level: 'C2',
    skill: 'vocabulary',
    prompt: '"Losing that job turned out to be a blessing in disguise." This means it…',
    options: ['seemed bad but had a good result', 'was kept secret', 'was the final problem'],
    answer: 0,
  },
  { level: 'C2', skill: 'grammar', prompt: '___ it not for her quick thinking, the accident would have been far worse.', options: ['Were', 'Had', 'Should'], answer: 0 },
];
