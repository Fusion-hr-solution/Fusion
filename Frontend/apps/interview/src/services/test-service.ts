import type { Test, Question } from "@/types";

// ─── Tests ────────────────────────────────────────────────────────────────────

export const MOCK_TESTS: Test[] = [
  {
    id: "1",
    title: "Senior Frontend Engineer Assessment",
    description:
      "Comprehensive evaluation covering React, TypeScript, system design, and CSS architecture for senior-level candidates.",
    discipline: "Engineering",
    status: "Active",
    questionTypes: ["Coding", "Multiple Choice"],
    candidateCount: 48,
    questionCount: 12,
    createdAt: "2026-01-15",
  },
  {
    id: "2",
    title: "Product Manager Core Skills",
    description:
      "Assesses product thinking, prioritization frameworks, and cross-functional communication skills.",
    discipline: "Product",
    status: "Active",
    questionTypes: ["Essay", "Multiple Choice"],
    candidateCount: 31,
    questionCount: 10,
    createdAt: "2026-01-20",
  },
  {
    id: "3",
    title: "UX Designer Portfolio Review",
    description:
      "Evaluates design process, Figma proficiency, and user research methodologies.",
    discipline: "Design",
    status: "Draft",
    questionTypes: ["Design", "Essay"],
    candidateCount: 0,
    questionCount: 8,
    createdAt: "2026-02-01",
  },
  {
    id: "4",
    title: "Backend Engineer — Node.js",
    description:
      "Tests knowledge of Node.js, REST API design, database optimization, and system scalability.",
    discipline: "Engineering",
    status: "Active",
    questionTypes: ["Coding", "SQL"],
    candidateCount: 62,
    questionCount: 15,
    createdAt: "2026-01-10",
  },
  {
    id: "5",
    title: "Growth Marketing Specialist",
    description:
      "Covers performance marketing channels, analytics interpretation, and campaign strategy.",
    discipline: "Marketing",
    status: "Active",
    questionTypes: ["Multiple Choice", "Essay"],
    candidateCount: 19,
    questionCount: 9,
    createdAt: "2026-02-05",
  },
  {
    id: "6",
    title: "Sales Development Representative",
    description:
      "Evaluates cold outreach skills, objection handling, and CRM tool familiarity.",
    discipline: "Sales",
    status: "Archived",
    questionTypes: ["Multiple Choice", "Case Study"],
    candidateCount: 85,
    questionCount: 7,
    createdAt: "2025-11-12",
  },
  {
    id: "7",
    title: "DevOps Engineer — Infrastructure",
    description:
      "Assesses cloud architecture, CI/CD pipelines, containerization, and monitoring best practices.",
    discipline: "Engineering",
    status: "Active",
    questionTypes: ["Coding", "Essay"],
    candidateCount: 27,
    questionCount: 11,
    createdAt: "2026-02-10",
  },
  {
    id: "8",
    title: "HR Business Partner Evaluation",
    description:
      "Tests knowledge of employment law, conflict resolution, and talent acquisition strategies.",
    discipline: "HR",
    status: "Draft",
    questionTypes: ["Essay", "Multiple Choice"],
    candidateCount: 0,
    questionCount: 10,
    createdAt: "2026-02-18",
  },
  {
    id: "9",
    title: "Financial Analyst — Modelling",
    description:
      "Evaluates financial modelling proficiency, valuation techniques, and Excel-based exercises.",
    discipline: "Finance",
    status: "Active",
    questionTypes: ["Excel", "Multiple Choice"],
    candidateCount: 14,
    questionCount: 8,
    createdAt: "2026-01-28",
  },
  {
    id: "10",
    title: "Operations Manager Readiness",
    description:
      "Covers process optimization, team coordination, and KPI-driven decision making.",
    discipline: "Operations",
    status: "Active",
    questionTypes: ["Essay", "Multiple Choice"],
    candidateCount: 22,
    questionCount: 9,
    createdAt: "2026-02-12",
  },
  {
    id: "11",
    title: "Full Stack Engineer — React & Go",
    description:
      "Comprehensive full-stack assessment spanning React, Golang, PostgreSQL, and API integration.",
    discipline: "Engineering",
    status: "Draft",
    questionTypes: ["Coding", "SQL", "Essay"],
    candidateCount: 0,
    questionCount: 18,
    createdAt: "2026-02-22",
  },
  {
    id: "12",
    title: "Brand Designer — Visual Identity",
    description:
      "Evaluates brand strategy understanding, typography choices, and motion design principles.",
    discipline: "Design",
    status: "Active",
    questionTypes: ["Design", "Case Study"],
    candidateCount: 9,
    questionCount: 6,
    createdAt: "2026-02-14",
  },
];

// ─── Questions ────────────────────────────────────────────────────────────────

export const MOCK_QUESTIONS: Question[] = [
  {
    id: "q1",
    title: "Implement a debounce function in TypeScript",
    description:
      "Write a generic debounce utility that delays function execution and supports cancellation.",
    type: "Coding",
    difficulty: "Medium",
    gradingMethod: "Auto-graded",
    points: 20,
    durationMinutes: 20,
    tags: ["TypeScript", "Utilities", "Functions"],
    usageCount: 34,
  },
  {
    id: "q2",
    title: "Describe your approach to component architecture in large React apps",
    description:
      "Explain how you structure components, manage state, and handle shared logic at scale.",
    type: "Essay",
    difficulty: "Hard",
    gradingMethod: "Manual",
    points: 15,
    durationMinutes: 10,
    tags: ["React", "Architecture", "Senior"],
    usageCount: 21,
  },
  {
    id: "q3",
    title: "What is the difference between useMemo and useCallback?",
    description:
      "Select all correct statements about React's memoization hooks.",
    type: "Multiple Choice",
    difficulty: "Easy",
    gradingMethod: "Auto-graded",
    points: 5,
    durationMinutes: 3,
    tags: ["React", "Hooks", "Performance"],
    usageCount: 87,
  },
  {
    id: "q4",
    title: "Design a rate limiter for a REST API",
    description:
      "Implement a token-bucket or sliding window rate limiter in Node.js with Redis.",
    type: "Coding",
    difficulty: "Expert",
    gradingMethod: "Hybrid",
    points: 30,
    durationMinutes: 35,
    tags: ["Node.js", "Redis", "System Design"],
    usageCount: 15,
  },
  {
    id: "q5",
    title: "Analyze a go-to-market strategy case study",
    description:
      "Review the provided case and outline a structured GTM approach with success metrics.",
    type: "Case Study",
    difficulty: "Hard",
    gradingMethod: "Manual",
    points: 25,
    durationMinutes: 20,
    tags: ["Product", "Strategy", "GTM"],
    usageCount: 29,
  },
  {
    id: "q6",
    title: "SQL: Write a query to find the second highest salary",
    description:
      "Using a sample employees table, return the employee with the second highest salary.",
    type: "SQL",
    difficulty: "Easy",
    gradingMethod: "Auto-graded",
    points: 10,
    durationMinutes: 8,
    tags: ["SQL", "Databases", "Analytics"],
    usageCount: 66,
  },
  {
    id: "q7",
    title: "Build a pivot table for quarterly revenue",
    description:
      "Using the provided dataset, create a pivot table summarising revenue by region and quarter.",
    type: "Excel",
    difficulty: "Medium",
    gradingMethod: "Hybrid",
    points: 20,
    durationMinutes: 15,
    tags: ["Excel", "Finance", "Data"],
    usageCount: 8,
  },
  {
    id: "q8",
    title: "Explain CSS specificity with examples",
    description:
      "Describe how the cascade resolves conflicts and provide concrete examples.",
    type: "Essay",
    difficulty: "Easy",
    gradingMethod: "Auto-graded",
    points: 8,
    durationMinutes: 6,
    tags: ["CSS", "Frontend", "Fundamentals"],
    usageCount: 43,
  },
  {
    id: "q9",
    title: "Build a paginated table component",
    description:
      "Create a React component with sorting, filtering, and server-side pagination.",
    type: "Coding",
    difficulty: "Hard",
    gradingMethod: "Hybrid",
    points: 35,
    durationMinutes: 45,
    tags: ["React", "TypeScript", "Components"],
    usageCount: 19,
  },
  {
    id: "q10",
    title: "Is recursion always more efficient than iteration?",
    description:
      "Select the correct answer: True or False.",
    type: "True/False",
    difficulty: "Easy",
    gradingMethod: "Auto-graded",
    points: 5,
    durationMinutes: 2,
    tags: ["Algorithms", "Fundamentals"],
    usageCount: 37,
  },
  {
    id: "q11",
    title: "Which HTTP status codes indicate client errors?",
    description:
      "Select all that apply from the list below.",
    type: "Multiple Choice",
    difficulty: "Easy",
    gradingMethod: "Auto-graded",
    points: 5,
    durationMinutes: 2,
    tags: ["HTTP", "APIs", "Fundamentals"],
    usageCount: 112,
  },
  {
    id: "q12",
    title: "Implement a LRU Cache in Python",
    description:
      "Build an LRU cache supporting O(1) get and put operations.",
    type: "Coding",
    difficulty: "Expert",
    gradingMethod: "Auto-graded",
    points: 30,
    durationMinutes: 30,
    tags: ["Python", "Data Structures", "Algorithms"],
    usageCount: 24,
  },
  {
    id: "q13",
    title: "Design a dashboard for an e-commerce analytics platform",
    description:
      "Produce wireframes or a high-fidelity mockup covering key metrics and user flows.",
    type: "Design",
    difficulty: "Hard",
    gradingMethod: "Manual",
    points: 25,
    durationMinutes: 30,
    tags: ["UI/UX", "Figma", "Dashboard"],
    usageCount: 11,
  },
  {
    id: "q14",
    title: "Write a Dockerfile for a Node.js microservice",
    description:
      "Include multi-stage build, non-root user, and health check configuration.",
    type: "Coding",
    difficulty: "Medium",
    gradingMethod: "Hybrid",
    points: 20,
    durationMinutes: 20,
    tags: ["Docker", "DevOps", "Node.js"],
    usageCount: 18,
  },
  {
    id: "q15",
    title: "SQL Window Functions: Rank employees by department salary",
    description:
      "Using RANK() and PARTITION BY, return each employee's salary rank within their department.",
    type: "SQL",
    difficulty: "Medium",
    gradingMethod: "Auto-graded",
    points: 15,
    durationMinutes: 12,
    tags: ["SQL", "Window Functions", "Analytics"],
    usageCount: 33,
  },
];

// ─── Async accessors ──────────────────────────────────────────────────────────

export async function getTests(): Promise<Test[]> {
  return MOCK_TESTS;
}

export async function getQuestions(): Promise<Question[]> {
  return MOCK_QUESTIONS;
}