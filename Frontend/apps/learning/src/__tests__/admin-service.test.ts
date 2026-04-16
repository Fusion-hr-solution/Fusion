import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the API client — vi.hoisted runs before vi.mock hoisting
const { mockGet, mockPost, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
  }),
}));

// Import after mock setup
import {
  getAdminTrainings,
  getAdminTrainingDetail,
  createTraining,
  updateTraining,
  deleteTraining,
  addChapter,
  updateChapter,
  deleteChapter,
  getTrainingAssignments,
  assignTraining,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/services/admin-service";

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Sample backend DTOs ---

const backendTrainingDto = {
  id: "t1",
  title: "Test Training",
  description: null,
  credits: 10,
  isMandatory: false,
  badgeLevel: "Bronze",
  duration: null,
  categoryId: "cat1",
  categoryName: "Tech",
  chapterCount: 2,
  enrollmentCount: 5,
  trainingType: "ELearning",
  scheduledDate: null,
  isDeleted: false,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
};

const backendChapterDto = {
  id: "ch1",
  title: "Chapter 1",
  layout: "SingleContent",
  orderIndex: 1,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: null,
  contentBlocks: [
    {
      id: "b1",
      type: "Video",
      orderIndex: 0,
      title: "Block 1",
      textContent: null,
      contentUri: null,
      videoUrl: "https://example.com/video",
      estimatedDurationMinutes: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: null,
    },
  ],
};

const backendAssignmentDto = {
  id: "a1",
  trainingId: "t1",
  trainingTitle: "Test Training",
  employeeId: "emp1",
  assignmentType: "HrAssigned",
  assignedAt: "2025-01-15T00:00:00Z",
  dueDate: null,
  status: null,
  progressPercentage: 0,
};

const backendCategoryDto = {
  id: "cat1",
  name: "Tech",
  description: null,
  trainingCount: 5,
};

// ===== Training CRUD =====

describe("getAdminTrainings", () => {
  it("calls correct endpoint and maps response", async () => {
    mockGet.mockResolvedValue({
      items: [backendTrainingDto],
      totalCount: 1,
      page: 1,
      pageSize: 10,
    });

    const result = await getAdminTrainings({ page: 1, pageSize: 10 });

    expect(mockGet).toHaveBeenCalledWith("/training/admin/trainings", {
      params: { page: 1, pageSize: 10 },
    });
    expect(result.totalCount).toBe(1);
    expect(result.trainings).toHaveLength(1);
    expect(result.trainings[0]!.title).toBe("Test Training");
    // null → default mapping
    expect(result.trainings[0]!.description).toBe("");
    expect(result.trainings[0]!.duration).toBe("");
    expect(result.trainings[0]!.updatedAt).toBeUndefined();
  });

  it("passes search and filter params", async () => {
    mockGet.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 10 });

    await getAdminTrainings({ search: "net", categoryId: "cat1", includeDeleted: true });

    expect(mockGet).toHaveBeenCalledWith("/training/admin/trainings", {
      params: { search: "net", categoryId: "cat1", includeDeleted: true },
    });
  });
});

describe("getAdminTrainingDetail", () => {
  it("calls correct endpoint and maps chapters and exams", async () => {
    mockGet.mockResolvedValue({
      ...backendTrainingDto,
      chapters: [backendChapterDto],
      exams: [{ id: "e1", title: "Exam", passingScore: 70, questionCount: 10 }],
    });

    const result = await getAdminTrainingDetail("t1");

    expect(mockGet).toHaveBeenCalledWith("/training/admin/trainings/t1");
    expect(result.title).toBe("Test Training");
    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0]!.videoUrl).toBe("https://example.com/video");
    expect(result.chapters[0]!.textContent).toBeUndefined();
    expect(result.exams).toHaveLength(1);
    expect(result.exams[0]!.passingScore).toBe(70);
  });

  it("encodes trainingId in URL", async () => {
    mockGet.mockResolvedValue({
      ...backendTrainingDto,
      chapters: [],
      exams: [],
    });

    await getAdminTrainingDetail("id with spaces");

    expect(mockGet).toHaveBeenCalledWith(
      "/training/admin/trainings/id%20with%20spaces"
    );
  });
});

describe("createTraining", () => {
  it("posts to correct endpoint", async () => {
    mockPost.mockResolvedValue("new-id");

    const input = {
      title: "New",
      credits: 5,
      isMandatory: false,
      badgeLevel: "Bronze",
      categoryId: "cat1",
      chapters: [],
    };
    const id = await createTraining(input);

    expect(mockPost).toHaveBeenCalledWith("/training/admin/trainings", input);
    expect(id).toBe("new-id");
  });
});

describe("updateTraining", () => {
  it("puts to correct endpoint", async () => {
    mockPut.mockResolvedValue(undefined);

    const input = {
      title: "Updated",
      credits: 15,
      isMandatory: true,
      badgeLevel: "Gold",
      categoryId: "cat1",
    };
    await updateTraining("t1", input);

    expect(mockPut).toHaveBeenCalledWith("/training/admin/trainings/t1", input);
  });
});

describe("deleteTraining", () => {
  it("deletes correct endpoint", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteTraining("t1");

    expect(mockDelete).toHaveBeenCalledWith("/training/admin/trainings/t1");
  });
});

// ===== Chapter CRUD =====

describe("addChapter", () => {
  it("posts to correct endpoint", async () => {
    mockPost.mockResolvedValue("ch-new");

    const input = {
      title: "New Chapter",
      contentType: "Article",
      orderIndex: 1,
    };
    const id = await addChapter("t1", input);

    expect(mockPost).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/chapters",
      {
        title: "New Chapter",
        layout: "SingleContent",
        orderIndex: 1,
        contentBlocks: [
          {
            type: "Article",
            orderIndex: 0,
            title: "New Chapter",
            textContent: undefined,
            contentUri: undefined,
            videoUrl: undefined,
            estimatedDurationMinutes: undefined,
          },
        ],
      }
    );
    expect(id).toBe("ch-new");
  });
});

describe("updateChapter", () => {
  it("puts to correct endpoint", async () => {
    mockPut.mockResolvedValue(undefined);

    const input = { title: "Updated", contentType: "Pdf", orderIndex: 2 };
    await updateChapter("t1", "ch1", input);

    expect(mockPut).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/chapters/ch1",
      {
        title: "Updated",
        layout: "SingleContent",
      }
    );
  });
});

describe("deleteChapter", () => {
  it("deletes correct endpoint", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteChapter("t1", "ch1");

    expect(mockDelete).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/chapters/ch1"
    );
  });
});

// ===== Assignments =====

describe("getTrainingAssignments", () => {
  it("maps assignments with null defaults", async () => {
    mockGet.mockResolvedValue([backendAssignmentDto]);

    const result = await getTrainingAssignments("t1");

    expect(mockGet).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/assignments"
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.dueDate).toBeUndefined();
    expect(result[0]!.status).toBe("NotStarted"); // null → "NotStarted"
    expect(result[0]!.progressPercentage).toBe(0);
  });
});

describe("assignTraining", () => {
  it("posts with trainingId merged", async () => {
    mockPost.mockResolvedValue("assign-id");

    const input = { employeeId: "emp1" };
    const id = await assignTraining("t1", input);

    expect(mockPost).toHaveBeenCalledWith(
      "/training/admin/trainings/t1/assignments",
      { trainingId: "t1", employeeId: "emp1" }
    );
    expect(id).toBe("assign-id");
  });
});

// ===== Categories =====

describe("getAdminCategories", () => {
  it("maps categories with null defaults", async () => {
    mockGet.mockResolvedValue([backendCategoryDto]);

    const result = await getAdminCategories();

    expect(mockGet).toHaveBeenCalledWith("/training/admin/categories");
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe(""); // null → ""
    expect(result[0]!.trainingCount).toBe(5);
  });
});

describe("createCategory", () => {
  it("posts to correct endpoint", async () => {
    mockPost.mockResolvedValue("cat-new");

    const id = await createCategory({ name: "New Cat" });

    expect(mockPost).toHaveBeenCalledWith("/training/admin/categories", {
      name: "New Cat",
    });
    expect(id).toBe("cat-new");
  });
});

describe("updateCategory", () => {
  it("puts to correct endpoint", async () => {
    mockPut.mockResolvedValue(undefined);

    await updateCategory("cat1", { name: "Updated", description: "desc" });

    expect(mockPut).toHaveBeenCalledWith("/training/admin/categories/cat1", {
      name: "Updated",
      description: "desc",
    });
  });
});

describe("deleteCategory", () => {
  it("deletes correct endpoint", async () => {
    mockDelete.mockResolvedValue(undefined);

    await deleteCategory("cat1");

    expect(mockDelete).toHaveBeenCalledWith("/training/admin/categories/cat1");
  });
});
