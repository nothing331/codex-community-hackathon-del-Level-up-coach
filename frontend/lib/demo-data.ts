export const suggestedTopics = [
  { label: "Mechanics", value: "JEE Physics - Mechanics" },
  { label: "Electrostatics", value: "JEE Physics - Electrostatics" },
  { label: "Organic Basics", value: "JEE Chemistry - Organic Basics" },
  { label: "Calculus", value: "JEE Math - Calculus" },
  { label: "Coordinate Geometry", value: "JEE Math - Coordinate Geometry" },
  { label: "Current Electricity", value: "Boards - Current Electricity" },
];

export const entryJourney = [
  {
    title: "Choose a focus",
    copy: "Type a study goal or tap a chapter shortcut. The first action is visible immediately.",
  },
  {
    title: "Generate a short mock",
    copy: "The system should extract context, build a blueprint, and return a realistic question set.",
  },
  {
    title: "Attempt and measure",
    copy: "Timing, accuracy, revisits, and topic patterns all stay attached to the attempt.",
  },
  {
    title: "Get a plan",
    copy: "The report should explain strengths, weak chapters, time behavior, and the next fix.",
  },
];

export const generationFlow = [
  {
    title: "Curriculum agent",
    badge: "Input parsing",
    description:
      "Normalizes subject, chapter, and syllabus hints into a reliable exam context with topic weights.",
    output: "Output: subject, exam type, topic list, focus area, source confidence.",
  },
  {
    title: "Blueprint agent",
    badge: "Test design",
    description:
      "Turns curriculum context into a constrained test plan with duration, topic distribution, and difficulty mix.",
    output: "Output: question count, duration, difficulty mix, topic distribution.",
  },
  {
    title: "Question agent",
    badge: "Question set",
    description:
      "Generates structured MCQs only after the blueprint is stable, so evaluation can stay deterministic.",
    output: "Output: options, correct answer, topic, difficulty, explanation, expected time.",
  },
];

export const questionOptions = [
  { id: "A", label: "A straight line with positive slope", active: false },
  { id: "B", label: "A parabola opening upward", active: true },
  { id: "C", label: "A parabola opening downward", active: false },
  { id: "D", label: "A horizontal line for all time values", active: false },
];

export const testSidebarStats = [
  { label: "Topic", value: "Electrostatics" },
  { label: "Difficulty", value: "Medium" },
  { label: "Visited count", value: "02" },
  { label: "Expected time", value: "90 sec" },
];

export const reportSummary = [
  { label: "Score", value: "6 / 10", note: "Enough base accuracy to improve fast." },
  { label: "Strongest topic", value: "Mechanics", note: "Converted 75% correctly." },
  { label: "Behavior flag", value: "Late drop", note: "Accuracy softened after question 6." },
];

export const reportBars = [
  {
    title: "Topic accuracy",
    caption: "Sample breakdown",
    items: [
      { label: "Mechanics", value: "75%", valueLabel: "75%" },
      { label: "Electrostatics", value: "25%", valueLabel: "25%" },
      { label: "Modern Physics", value: "50%", valueLabel: "50%" },
    ],
  },
  {
    title: "Time behavior",
    caption: "Average pace",
    items: [
      { label: "Wrong answers", value: "82%", valueLabel: "124 sec avg" },
      { label: "Hard questions", value: "90%", valueLabel: "168 sec avg" },
      { label: "Late-stage accuracy", value: "44%", valueLabel: "44%" },
    ],
  },
];
