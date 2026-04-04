import { beforeEach, describe, expect, it, vi } from "vitest";
import { issueService } from "../services/issues.ts";

vi.mock("../services/activity-log.js", () => ({
  logActivity: vi.fn(),
}));

vi.mock("../services/instance-settings.js", () => ({
  instanceSettingsService: vi.fn(() => ({
    getGeneral: vi.fn(async () => ({ censorUsernameInLogs: false })),
    getExperimental: vi.fn(async () => ({ enableIsolatedWorkspaces: false })),
  })),
}));

vi.mock("../log-redaction.js", () => ({
  redactCurrentUserText: vi.fn((text: string) => text),
}));

vi.mock("../services/issue-goal-fallback.js", () => ({
  resolveIssueGoalId: vi.fn(),
  resolveNextIssueGoalId: vi.fn(),
}));

vi.mock("../services/goals.js", () => ({
  getDefaultCompanyGoal: vi.fn(async () => null),
}));

vi.mock("../services/execution-workspace-policy.js", () => ({
  defaultIssueExecutionWorkspaceSettingsForProject: vi.fn(),
  gateProjectExecutionWorkspacePolicy: vi.fn(),
  parseProjectExecutionWorkspacePolicy: vi.fn(),
}));

vi.mock("@paperclipai/shared", () => ({
  extractAgentMentionIds: vi.fn(() => []),
  extractProjectMentionIds: vi.fn(() => []),
}));

type SelectResult = unknown[];

function createDbStub(selectResults: SelectResult[]) {
  const pendingSelects = [...selectResults];
  const selectLimit = vi.fn(() => Promise.resolve(pendingSelects.shift() ?? []));
  const selectWhere = vi.fn(() => {
    const data = pendingSelects.shift() ?? [];
    return {
      limit: vi.fn(() => Promise.resolve(data)),
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(data)),
    };
  });
  const selectThen = vi.fn((resolve: (value: unknown[]) => unknown) =>
    Promise.resolve(resolve(pendingSelects.shift() ?? [])),
  );
  const selectOrderBy = vi.fn(async () => pendingSelects.shift() ?? []);
  const selectFrom = vi.fn(() => ({
    where: selectWhere,
    then: selectThen,
    orderBy: selectOrderBy,
  }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const insertValues = vi.fn();
  const insertOnConflictDoNothing = vi.fn(async () => []);
  const pendingInserts: unknown[][] = [];
  const insertReturning = vi.fn(async () => pendingInserts.shift() ?? []);
  const insert = vi.fn(() => ({
    values: insertValues.mockImplementation(() => ({
      onConflictDoNothing: insertOnConflictDoNothing,
      returning: insertReturning,
    })),
  }));

  const updateSet = vi.fn();
  const pendingUpdates: unknown[][] = [];
  const updateWhere = vi.fn(async () => pendingUpdates.shift() ?? []);
  const update = vi.fn(() => ({
    set: updateSet.mockImplementation(() => ({ where: updateWhere })),
  }));

  const deleteReturning = vi.fn(async () => []);
  const deleteWhere = vi.fn(() => ({ returning: deleteReturning }));
  const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
  const del = vi.fn(() => ({
    from: deleteFrom,
    where: deleteWhere,
  }));

  const queueInsert = (rows: unknown[]) => pendingInserts.push(rows);

  return {
    db: { select, insert, update, delete: del },
    selectWhere,
    selectLimit,
    insertValues,
    insertOnConflictDoNothing,
    deleteWhere,
    queueInsert,
  };
}

describe("issueService agent archive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sweepAgentArchives inserts archive records for eligible done tickets", async () => {
    const dbStub = createDbStub([
      [
        { id: "issue-1", companyId: "company-1", assigneeAgentId: "agent-1" },
        { id: "issue-2", companyId: "company-1", assigneeAgentId: "agent-2" },
      ],
    ]);

    const svc = issueService(dbStub.db as any);
    const result = await svc.sweepAgentArchives();

    expect(result).toEqual({ archived: 2 });
    expect(dbStub.insertValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ issueId: "issue-1", agentId: "agent-1", companyId: "company-1" }),
        expect.objectContaining({ issueId: "issue-2", agentId: "agent-2", companyId: "company-1" }),
      ]),
    );
    expect(dbStub.insertOnConflictDoNothing).toHaveBeenCalled();
  });

  it("sweepAgentArchives returns zero and skips insert when no eligible tickets", async () => {
    const dbStub = createDbStub([[]]);

    const svc = issueService(dbStub.db as any);
    const result = await svc.sweepAgentArchives();

    expect(result).toEqual({ archived: 0 });
    expect(dbStub.insertValues).not.toHaveBeenCalled();
  });

  it("unarchiveAgent deletes the archive record for the given issue and agent", async () => {
    const dbStub = createDbStub([]);

    const svc = issueService(dbStub.db as any);
    await svc.unarchiveAgent("company-1", "issue-1", "agent-1");

    expect(dbStub.deleteWhere).toHaveBeenCalled();
  });
});
