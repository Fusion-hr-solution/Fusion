import { describe, it, expect } from "vitest";
import type {
  AdminTraining,
  AdminTrainingDetail,
  AdminChapter,
  AdminAssignment,
  CreateTrainingInput,
  CreateChapterInput,
  AssignTrainingInput,
} from "@/types/admin";

describe("Admin type contracts", () => {
  it("AdminTraining has all required fields", () => {
    const training: AdminTraining = {
      id: "t1",
      title: "Test",
      description: "desc",
      credits: 10,
      isMandatory: false,
      badgeLevel: "Bronze",
      duration: "2h",
      categoryId: "c1",
      categoryName: "Tech",
      chapterCount: 1,
      enrollmentCount: 5,
      isDeleted: false,
      createdAt: "2025-01-01",
    };
    expect(training.id).toBeDefined();
    expect(training.updatedAt).toBeUndefined();
  });

  it("AdminTrainingDetail extends AdminTraining with chapters and exams", () => {
    const detail: AdminTrainingDetail = {
      id: "t1",
      title: "Test",
      description: "",
      credits: 10,
      isMandatory: false,
      badgeLevel: "Bronze",
      duration: "",
      categoryId: "c1",
      categoryName: "Tech",
      chapterCount: 0,
      enrollmentCount: 0,
      isDeleted: false,
      createdAt: "2025-01-01",
      chapters: [],
      exams: [],
    };
    expect(detail.chapters).toEqual([]);
    expect(detail.exams).toEqual([]);
  });

  it("AdminChapter supports optional fields", () => {
    const chapter: AdminChapter = {
      id: "ch1",
      title: "Basics",
      contentType: "Video",
      orderIndex: 1,
      createdAt: "2025-01-01",
    };
    expect(chapter.contentUri).toBeUndefined();
    expect(chapter.textContent).toBeUndefined();
    expect(chapter.videoUrl).toBeUndefined();
    expect(chapter.estimatedDurationMinutes).toBeUndefined();
  });

  it("AdminAssignment has status default", () => {
    const assignment: AdminAssignment = {
      id: "a1",
      trainingId: "t1",
      trainingTitle: "Test",
      employeeId: "emp1",
      assignmentType: "HrAssigned",
      assignedAt: "2025-01-01",
      status: "NotStarted",
      progressPercentage: 0,
    };
    expect(assignment.dueDate).toBeUndefined();
  });

  it("CreateTrainingInput requires mandatory fields", () => {
    const input: CreateTrainingInput = {
      title: "New",
      credits: 5,
      isMandatory: false,
      badgeLevel: "Bronze",
      categoryId: "c1",
      chapters: [],
    };
    expect(input.title).toBe("New");
    expect(input.description).toBeUndefined();
  });

  it("CreateChapterInput requires core fields", () => {
    const input: CreateChapterInput = {
      title: "Chapter 1",
      contentType: "Article",
      orderIndex: 0,
    };
    expect(input.title).toBe("Chapter 1");
  });

  it("AssignTrainingInput requires employeeId", () => {
    const input: AssignTrainingInput = {
      employeeId: "emp1",
    };
    expect(input.employeeId).toBe("emp1");
    expect(input.dueDate).toBeUndefined();
  });
});
