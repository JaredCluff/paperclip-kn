# Budget Velocity Watchdog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect and circuit-break runaway agent spend by adding rolling-window velocity monitoring to the budget enforcement pipeline.

**Architecture:** Extend the existing budget policy schema with three nullable velocity columns. After each cost event, the budget service computes spend velocity over the rolling window and triggers a circuit breaker (pause + incident + approval) when the hard velocity threshold is crossed. Resolution uses the existing approval flow.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express, React, Vitest, Zod

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `packages/db/src/schema/budget_policies.ts` | Add 3 nullable velocity columns |
| Modify | `packages/shared/src/constants.ts` | Add `budget_velocity` pause reason, `velocity_hard_stop` threshold type, live event type |
| Modify | `packages/shared/src/types/budget.ts` | Add velocity fields to `BudgetPolicy`, `BudgetPolicySummary`, `BudgetPolicyUpsertInput` |
| Modify | `packages/shared/src/validators/budget.ts` | Add velocity fields to `upsertBudgetPolicySchema` |
| Modify | `server/src/services/budgets.ts` | Velocity computation, enforcement in `evaluateCostEvent`, blocking in `getInvocationBlock`, resolution support |
| Modify | `server/src/__tests__/budgets-service.test.ts` | Unit tests for velocity enforcement |
| Modify | `ui/src/components/BudgetPolicyCard.tsx` | Display velocity policy fields and current spend rate |
| Modify | `ui/src/components/ApprovalPayload.tsx` | Display `velocity_hard_stop` incident details |

---

### Task 1: Schema, Constants & Types

Add velocity columns to the budget_policies table, extend shared constants, types, and validators.

**Files:**
- Modify: `packages/db/src/schema/budget_policies.ts:1-43`
- Modify: `packages/shared/src/constants.ts:171-172,265-266,310-321`
- Modify: `packages/shared/src/types/budget.ts:1-100`
- Modify: `packages/shared/src/validators/budget.ts:1-37`

- [ ] **Step 1: Add velocity columns to budget_policies schema**

In `packages/db/src/schema/budget_policies.ts`, add three nullable integer columns after `notifyEnabled` (line 16):

```typescript
velocityWindowMinutes: integer("velocity_window_minutes"),
velocityWarnCents: integer("velocity_warn_cents"),
velocityHardCents: integer("velocity_hard_cents"),
```

The full columns block becomes:

```typescript
{
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  scopeType: text("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  metric: text("metric").notNull().default("billed_cents"),
  windowKind: text("window_kind").notNull(),
  amount: integer("amount").notNull().default(0),
  warnPercent: integer("warn_percent").notNull().default(80),
  hardStopEnabled: boolean("hard_stop_enabled").notNull().default(true),
  notifyEnabled: boolean("notify_enabled").notNull().default(true),
  velocityWindowMinutes: integer("velocity_window_minutes"),
  velocityWarnCents: integer("velocity_warn_cents"),
  velocityHardCents: integer("velocity_hard_cents"),
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: text("created_by_user_id"),
  updatedByUserId: text("updated_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
},
```

- [ ] **Step 2: Add constants for velocity pause reason, threshold type, and live event**

In `packages/shared/src/constants.ts`:

Change `PAUSE_REASONS` (line 171) from:
```typescript
export const PAUSE_REASONS = ["manual", "budget", "system"] as const;
```
to:
```typescript
export const PAUSE_REASONS = ["manual", "budget", "budget_velocity", "system"] as const;
```

Change `BUDGET_THRESHOLD_TYPES` (line 265) from:
```typescript
export const BUDGET_THRESHOLD_TYPES = ["soft", "hard"] as const;
```
to:
```typescript
export const BUDGET_THRESHOLD_TYPES = ["soft", "hard", "velocity_soft", "velocity_hard_stop"] as const;
```

Change `LIVE_EVENT_TYPES` (lines 310-320) from:
```typescript
export const LIVE_EVENT_TYPES = [
  "heartbeat.run.queued",
  "heartbeat.run.status",
  "heartbeat.run.event",
  "heartbeat.run.log",
  "agent.status",
  "activity.logged",
  "plugin.ui.updated",
  "plugin.worker.crashed",
  "plugin.worker.restarted",
] as const;
```
to:
```typescript
export const LIVE_EVENT_TYPES = [
  "heartbeat.run.queued",
  "heartbeat.run.status",
  "heartbeat.run.event",
  "heartbeat.run.log",
  "agent.status",
  "activity.logged",
  "budget.velocity_threshold_crossed",
  "plugin.ui.updated",
  "plugin.worker.crashed",
  "plugin.worker.restarted",
] as const;
```

- [ ] **Step 3: Add velocity fields to shared types**

In `packages/shared/src/types/budget.ts`, add velocity fields to three interfaces:

In `BudgetPolicy` (after `notifyEnabled: boolean;` on line 22):
```typescript
velocityWindowMinutes: number | null;
velocityWarnCents: number | null;
velocityHardCents: number | null;
```

In `BudgetPolicySummary` (after `notifyEnabled: boolean;` on line 43):
```typescript
velocityWindowMinutes: number | null;
velocityWarnCents: number | null;
velocityHardCents: number | null;
velocityCurrentCents: number | null;
```

(`velocityCurrentCents` is a computed field — the actual spend in the current velocity window, populated by the server at query time.)

In `BudgetPolicyUpsertInput` (after `notifyEnabled?: boolean;` on line 91):
```typescript
velocityWindowMinutes?: number | null;
velocityWarnCents?: number | null;
velocityHardCents?: number | null;
```

- [ ] **Step 4: Add velocity fields to Zod validator**

In `packages/shared/src/validators/budget.ts`, add velocity fields to `upsertBudgetPolicySchema` (after `isActive` on line 18):

```typescript
velocityWindowMinutes: z.number().int().min(1).max(1440).optional().nullable().default(null),
velocityWarnCents: z.number().int().nonnegative().optional().nullable().default(null),
velocityHardCents: z.number().int().nonnegative().optional().nullable().default(null),
```

- [ ] **Step 5: Verify the shared package compiles**

Run:
```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm --filter @paperclipai/shared build
```
Expected: Build succeeds

Run:
```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm --filter @paperclipai/db build
```
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add packages/db/src/schema/budget_policies.ts packages/shared/src/constants.ts packages/shared/src/types/budget.ts packages/shared/src/validators/budget.ts
git commit -m "feat(budget): add velocity schema columns, constants, types, and validators"
```

---

### Task 2: Velocity Computation & Enforcement in Budget Service

Add velocity spend computation and integrate velocity checking into the `evaluateCostEvent` pipeline. Parameterize pause/resume functions to support `budget_velocity` reason.

**Files:**
- Modify: `server/src/services/budgets.ts:1-959`

- [ ] **Step 1: Parameterize `pauseScopeForBudget` and `resumeScopeFromBudget`**

In `server/src/services/budgets.ts`, change the `pauseScopeForBudget` function signature (line 213) from:
```typescript
async function pauseScopeForBudget(policy: PolicyRow) {
```
to:
```typescript
async function pauseScopeForBudget(policy: PolicyRow, reason: "budget" | "budget_velocity" = "budget") {
```

And in the function body, replace all three `pauseReason: "budget"` occurrences (lines 220, 232, 244) with `pauseReason: reason`.

Change `pauseAndCancelScopeForBudget` (line 251) from:
```typescript
async function pauseAndCancelScopeForBudget(policy: PolicyRow) {
  await pauseScopeForBudget(policy);
```
to:
```typescript
async function pauseAndCancelScopeForBudget(policy: PolicyRow, reason: "budget" | "budget_velocity" = "budget") {
  await pauseScopeForBudget(policy, reason);
```

Change `resumeScopeFromBudget` (line 260) from:
```typescript
async function resumeScopeFromBudget(policy: PolicyRow) {
```
to:
```typescript
async function resumeScopeFromBudget(policy: PolicyRow, reason: "budget" | "budget_velocity" = "budget") {
```

And in the function body, replace all three `eq(xxx.pauseReason, "budget")` filter conditions (lines 271, 283, 295) with `eq(xxx.pauseReason, reason)`.

- [ ] **Step 2: Add `computeVelocitySpend` function**

Add the following function right after the existing `computeObservedAmount` function (after line 165):

```typescript
async function computeVelocitySpend(
  db: Db,
  policy: Pick<PolicyRow, "companyId" | "scopeType" | "scopeId">,
  windowMinutes: number,
) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const conditions = [
    eq(costEvents.companyId, policy.companyId),
    gte(costEvents.occurredAt, since),
  ];
  if (policy.scopeType === "agent") conditions.push(eq(costEvents.agentId, policy.scopeId));
  if (policy.scopeType === "project") conditions.push(eq(costEvents.projectId, policy.scopeId));

  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
    })
    .from(costEvents)
    .where(and(...conditions));

  return Number(row?.total ?? 0);
}
```

- [ ] **Step 3: Add velocity enforcement to `evaluateCostEvent`**

At the end of the `for (const policy of relevantPolicies)` loop in `evaluateCostEvent` (after line 713, before the closing `}` of the loop), add the velocity check:

```typescript
      // ── velocity check ──────────────────────────────────────────────
      const velWindow = policy.velocityWindowMinutes;
      const velHard = policy.velocityHardCents;
      const velWarn = policy.velocityWarnCents;

      if (velWindow && velWindow > 0) {
        const velocitySpend = await computeVelocitySpend(db, policy, velWindow);

        if (velWarn && velWarn > 0 && velocitySpend >= velWarn) {
          const softIncident = await createIncidentIfNeeded(policy, "velocity_soft", velocitySpend);
          if (softIncident) {
            await logActivity(db, {
              companyId: policy.companyId,
              actorType: "system",
              actorId: "budget_service",
              action: "budget.velocity_threshold_crossed",
              entityType: "budget_incident",
              entityId: softIncident.id,
              details: {
                scopeType: policy.scopeType,
                scopeId: policy.scopeId,
                velocitySpendCents: velocitySpend,
                velocityWarnCents: velWarn,
                velocityWindowMinutes: velWindow,
              },
            });
          }
        }

        if (velHard && velHard > 0 && velocitySpend >= velHard) {
          await resolveOpenVelocitySoftIncidents(policy.id);
          const hardIncident = await createIncidentIfNeeded(policy, "velocity_hard_stop", velocitySpend);
          await pauseAndCancelScopeForBudget(policy, "budget_velocity");
          if (hardIncident) {
            publishLiveEvent({
              companyId: policy.companyId,
              type: "budget.velocity_threshold_crossed",
              payload: {
                scopeType: policy.scopeType,
                scopeId: policy.scopeId,
                velocitySpendCents: velocitySpend,
                velocityHardCents: velHard,
                velocityWindowMinutes: velWindow,
                incidentId: hardIncident.id,
              },
            });
            await logActivity(db, {
              companyId: policy.companyId,
              actorType: "system",
              actorId: "budget_service",
              action: "budget.velocity_threshold_crossed",
              entityType: "budget_incident",
              entityId: hardIncident.id,
              details: {
                scopeType: policy.scopeType,
                scopeId: policy.scopeId,
                velocitySpendCents: velocitySpend,
                velocityHardCents: velHard,
                velocityWindowMinutes: velWindow,
                approvalId: hardIncident.approvalId ?? null,
              },
            });
          }
        }
      }
```

- [ ] **Step 4: Add import for `publishLiveEvent` and `resolveOpenVelocitySoftIncidents` helper**

At the top of `budgets.ts`, add the import (after line 25):
```typescript
import { publishLiveEvent } from "./live-events.js";
```

Inside the `budgetService` function, add the helper right after `resolveOpenSoftIncidents` (after line 430):
```typescript
  async function resolveOpenVelocitySoftIncidents(policyId: string) {
    await db
      .update(budgetIncidents)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(budgetIncidents.policyId, policyId),
          eq(budgetIncidents.thresholdType, "velocity_soft"),
          eq(budgetIncidents.status, "open"),
        ),
      );
  }
```

- [ ] **Step 5: Extend `getInvocationBlock` to check for `budget_velocity` pause**

In `getInvocationBlock`, change the agent pause check (line 780) from:
```typescript
if (agent.status === "paused" && agent.pauseReason === "budget") {
  return {
    scopeType: "agent" as const,
    scopeId: agentId,
    scopeName: agent.name,
    reason: "Agent is paused because its budget hard-stop was reached.",
  };
}
```
to:
```typescript
if (agent.status === "paused" && agent.pauseReason === "budget") {
  return {
    scopeType: "agent" as const,
    scopeId: agentId,
    scopeName: agent.name,
    reason: "Agent is paused because its budget hard-stop was reached.",
  };
}
if (agent.status === "paused" && agent.pauseReason === "budget_velocity") {
  return {
    scopeType: "agent" as const,
    scopeId: agentId,
    scopeName: agent.name,
    reason: "Agent is paused because its spend velocity exceeded the safety threshold.",
  };
}
```

Also update the company pause check (line 743). Change:
```typescript
if (company.status === "paused") {
  return {
    scopeType: "company" as const,
    scopeId: companyId,
    scopeName: company.name,
    reason:
      company.pauseReason === "budget"
        ? "Company is paused because its budget hard-stop was reached."
        : "Company is paused and cannot start new work.",
  };
}
```
to:
```typescript
if (company.status === "paused") {
  const reasonMap: Record<string, string> = {
    budget: "Company is paused because its budget hard-stop was reached.",
    budget_velocity: "Company is paused because its spend velocity exceeded the safety threshold.",
  };
  return {
    scopeType: "company" as const,
    scopeId: companyId,
    scopeName: company.name,
    reason: reasonMap[company.pauseReason ?? ""] ?? "Company is paused and cannot start new work.",
  };
}
```

- [ ] **Step 6: Extend `resolveIncident` for velocity incidents**

In `resolveIncident`, after fetching the incident (line 878), determine if this is a velocity incident. Add this line:
```typescript
const isVelocityIncident = incident.thresholdType === "velocity_hard_stop" || incident.thresholdType === "velocity_soft";
```

Then modify the `"raise_budget_and_resume"` branch. Change the validation (lines 880-884) from:
```typescript
if (input.action === "raise_budget_and_resume") {
  const nextAmount = Math.max(0, Math.floor(input.amount ?? 0));
  const currentObserved = await computeObservedAmount(db, policy);
  if (nextAmount <= currentObserved) {
    throw unprocessable("New budget must exceed current observed spend");
  }
```
to:
```typescript
if (input.action === "raise_budget_and_resume") {
  if (isVelocityIncident) {
    // For velocity incidents, resume the scope without requiring a new budget amount.
    // The board acknowledges the velocity spike and resumes execution.
    const pauseReason = "budget_velocity" as const;

    await resumeScopeFromBudget(policy, pauseReason);
    const now = new Date();
    await db
      .update(budgetIncidents)
      .set({ status: "resolved", resolvedAt: now, updatedAt: now })
      .where(and(eq(budgetIncidents.policyId, policy.id), eq(budgetIncidents.status, "open")));
    await markApprovalStatus(db, incident.approvalId ?? null, "approved", input.decisionNote, actorUserId);

    await logActivity(db, {
      companyId: incident.companyId,
      actorType: "user",
      actorId: actorUserId,
      action: "budget.incident_resolved",
      entityType: "budget_incident",
      entityId: incident.id,
      details: {
        action: input.action,
        thresholdType: incident.thresholdType,
        scopeType: incident.scopeType,
        scopeId: incident.scopeId,
      },
    });

    const [updated] = await hydrateIncidentRows([{
      ...incident,
      status: "resolved" as const,
      resolvedAt: now,
      updatedAt: now,
    }]);
    return updated!;
  }

  const nextAmount = Math.max(0, Math.floor(input.amount ?? 0));
  const currentObserved = await computeObservedAmount(db, policy);
  if (nextAmount <= currentObserved) {
    throw unprocessable("New budget must exceed current observed spend");
  }
```

- [ ] **Step 7: Extend `buildPolicySummary` to include velocity fields**

In `buildPolicySummary` (line 316), add velocity fields to the returned object. After `pauseReason: scope.pauseReason,` (line 347):
```typescript
velocityWindowMinutes: policy.velocityWindowMinutes ?? null,
velocityWarnCents: policy.velocityWarnCents ?? null,
velocityHardCents: policy.velocityHardCents ?? null,
velocityCurrentCents:
  policy.velocityWindowMinutes && policy.velocityWindowMinutes > 0
    ? await computeVelocitySpend(db, policy, policy.velocityWindowMinutes)
    : null,
```

- [ ] **Step 8: Extend `upsertPolicy` to persist velocity fields**

In `upsertPolicy`, when updating an existing policy (line 538), add velocity fields to the `.set()` call:
```typescript
velocityWindowMinutes: input.velocityWindowMinutes ?? existing.velocityWindowMinutes,
velocityWarnCents: input.velocityWarnCents ?? existing.velocityWarnCents,
velocityHardCents: input.velocityHardCents ?? existing.velocityHardCents,
```

When inserting a new policy (line 552), add:
```typescript
velocityWindowMinutes: input.velocityWindowMinutes ?? null,
velocityWarnCents: input.velocityWarnCents ?? null,
velocityHardCents: input.velocityHardCents ?? null,
```

- [ ] **Step 9: Extend `listPolicies` to include velocity fields**

In `listPolicies` (lines 496-504), the policy rows are mapped. The velocity columns are already in the row from the schema. Verify the spread `...row` on line 499 includes them — it should, since `PolicyRow` is inferred from the schema. No code change needed if the spread already captures all columns. Confirm by checking the return type matches `BudgetPolicy`.

- [ ] **Step 10: Commit**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add server/src/services/budgets.ts
git commit -m "feat(budget): add velocity computation, enforcement, and invocation blocking"
```

---

### Task 3: Unit Tests

Add tests covering the velocity enforcement pipeline: threshold crossed → agent paused → invocation blocked → incident resolution.

**Files:**
- Modify: `server/src/__tests__/budgets-service.test.ts:1-312`

- [ ] **Step 1: Add test for velocity hard threshold → agent paused**

Add this test after the last existing test (before the closing `});` of the `describe` block, around line 311):

```typescript
it("pauses an agent when velocity spend exceeds the hard velocity threshold", async () => {
  const policy = {
    id: "policy-vel-1",
    companyId: "company-1",
    scopeType: "agent",
    scopeId: "agent-1",
    metric: "billed_cents",
    windowKind: "calendar_month_utc",
    amount: 1000,
    warnPercent: 80,
    hardStopEnabled: true,
    notifyEnabled: false,
    isActive: true,
    velocityWindowMinutes: 5,
    velocityWarnCents: null,
    velocityHardCents: 50,
  };

  const dbStub = createDbStub([
    // evaluateCostEvent → find active policies
    [policy],
    // computeObservedAmount → cumulative spend (under budget, so cumulative check passes)
    [{ total: 200 }],
    // computeVelocitySpend → velocity spend (over velocity hard threshold)
    [{ total: 60 }],
    // createIncidentIfNeeded → check existing velocity_hard_stop incident
    [],
    // resolveScopeRecord for incident creation
    [{
      companyId: "company-1",
      name: "Budget Agent",
      status: "running",
      pauseReason: null,
    }],
  ]);

  // approval insert
  dbStub.queueInsert([{
    id: "approval-vel-1",
    companyId: "company-1",
    status: "pending",
  }]);
  // incident insert
  dbStub.queueInsert([{
    id: "incident-vel-1",
    companyId: "company-1",
    policyId: "policy-vel-1",
    thresholdType: "velocity_hard_stop",
    approvalId: "approval-vel-1",
  }]);
  // pause agent update
  dbStub.queueUpdate([]);
  const cancelWorkForScope = vi.fn().mockResolvedValue(undefined);

  const service = budgetService(dbStub.db as any, { cancelWorkForScope });
  await service.evaluateCostEvent({
    companyId: "company-1",
    agentId: "agent-1",
    projectId: null,
  } as any);

  // Verify agent was paused with budget_velocity reason
  expect(dbStub.updateSet).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "paused",
      pauseReason: "budget_velocity",
      pausedAt: expect.any(Date),
    }),
  );
  // Verify incident was created with velocity_hard_stop type
  expect(dbStub.insertValues).toHaveBeenCalledWith(
    expect.objectContaining({
      thresholdType: "velocity_hard_stop",
      amountObserved: 60,
    }),
  );
  // Verify cancel hook was called
  expect(cancelWorkForScope).toHaveBeenCalledWith({
    companyId: "company-1",
    scopeType: "agent",
    scopeId: "agent-1",
  });
  // Verify activity was logged
  expect(mockLogActivity).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      action: "budget.velocity_threshold_crossed",
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm --filter paperclip-server test -- --run budgets-service
```
Expected: All tests pass including the new velocity test.

- [ ] **Step 3: Add test for velocity invocation blocking**

Add this test:

```typescript
it("blocks invocation when agent is paused due to budget_velocity", async () => {
  const dbStub = createDbStub([
    // getInvocationBlock → fetch agent
    [{
      status: "paused",
      pauseReason: "budget_velocity",
      companyId: "company-1",
      name: "Runaway Agent",
    }],
    // getInvocationBlock → fetch company
    [{
      status: "active",
      pauseReason: null,
      name: "Paperclip",
    }],
  ]);

  const service = budgetService(dbStub.db as any);
  const block = await service.getInvocationBlock("company-1", "agent-1");

  expect(block).toEqual({
    scopeType: "agent",
    scopeId: "agent-1",
    scopeName: "Runaway Agent",
    reason: "Agent is paused because its spend velocity exceeded the safety threshold.",
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm --filter paperclip-server test -- --run budgets-service
```
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add server/src/__tests__/budgets-service.test.ts
git commit -m "test(budget): add velocity threshold and invocation blocking tests"
```

---

### Task 4: UI — BudgetPolicyCard Velocity Display

Surface velocity policy fields in the BudgetPolicyCard component. Show the velocity window, thresholds, and current spend rate when velocity is configured.

**Files:**
- Modify: `ui/src/components/BudgetPolicyCard.tsx:1-219`

- [ ] **Step 1: Add velocity section to BudgetPolicyCard**

In `BudgetPolicyCard.tsx`, add a velocity info section. After the `pausedPane` variable (after line 127), add:

```typescript
const velocityEnabled = summary.velocityWindowMinutes != null && summary.velocityWindowMinutes > 0;
const velocityPane = velocityEnabled ? (
  <div className={cn("rounded-xl border px-3 py-2 text-sm", isPlain ? "border-border/50" : "border-border/70 bg-black/[0.12]")}>
    <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
      Spend velocity ({summary.velocityWindowMinutes}min window)
    </div>
    <div className="grid gap-2 sm:grid-cols-3 text-xs">
      <div>
        <span className="text-muted-foreground">Current: </span>
        <span className="font-semibold tabular-nums">
          {summary.velocityCurrentCents != null ? formatCents(summary.velocityCurrentCents) : "—"}
        </span>
      </div>
      {summary.velocityWarnCents != null && (
        <div>
          <span className="text-muted-foreground">Warn: </span>
          <span className="tabular-nums text-amber-200">{formatCents(summary.velocityWarnCents)}</span>
        </div>
      )}
      {summary.velocityHardCents != null && (
        <div>
          <span className="text-muted-foreground">Hard: </span>
          <span className="tabular-nums text-red-300">{formatCents(summary.velocityHardCents)}</span>
        </div>
      )}
    </div>
  </div>
) : null;
```

- [ ] **Step 2: Render the velocity pane in both card variants**

In the `isPlain` return block (line 156), insert `{velocityPane}` after `{pausedPane}`:

```tsx
{pausedPane}
{velocityPane}
{saveSection}
```

In the card return block (line 208), insert `{velocityPane}` after `{pausedPane}`:

```tsx
{pausedPane}
{velocityPane}
{saveSection}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add ui/src/components/BudgetPolicyCard.tsx
git commit -m "feat(ui): display velocity policy fields in BudgetPolicyCard"
```

---

### Task 5: UI — ApprovalPayload Velocity Display

Show `velocity_hard_stop` incident details in the `BudgetOverridePayload` component.

**Files:**
- Modify: `ui/src/components/ApprovalPayload.tsx:110-128`

- [ ] **Step 1: Extend BudgetOverridePayload for velocity incidents**

In `ApprovalPayload.tsx`, update `BudgetOverridePayload` (line 110) to show velocity-specific information when the threshold type is a velocity type:

```typescript
export function BudgetOverridePayload({ payload }: { payload: Record<string, unknown> }) {
  const budgetAmount = typeof payload.budgetAmount === "number" ? payload.budgetAmount : null;
  const observedAmount = typeof payload.observedAmount === "number" ? payload.observedAmount : null;
  const isVelocity = typeof payload.thresholdType === "string" && payload.thresholdType.startsWith("velocity_");
  const velocityWindowMinutes = typeof payload.velocityWindowMinutes === "number" ? payload.velocityWindowMinutes : null;
  const velocitySpendCents = typeof payload.velocitySpendCents === "number" ? payload.velocitySpendCents : null;
  const velocityHardCents = typeof payload.velocityHardCents === "number" ? payload.velocityHardCents : null;

  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Scope" value={payload.scopeName ?? payload.scopeType} />
      {isVelocity && (
        <PayloadField label="Type" value="Velocity circuit breaker" />
      )}
      <PayloadField label="Window" value={isVelocity && velocityWindowMinutes ? `${velocityWindowMinutes} min rolling` : payload.windowKind} />
      <PayloadField label="Metric" value={payload.metric} />
      {isVelocity ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Velocity {velocitySpendCents != null ? formatCents(velocitySpendCents) : "—"} / {velocityWindowMinutes ?? "?"}min · Hard limit {velocityHardCents != null ? formatCents(velocityHardCents) : "—"}
        </div>
      ) : (budgetAmount !== null || observedAmount !== null) ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Limit {budgetAmount !== null ? formatCents(budgetAmount) : "—"} · Observed {observedAmount !== null ? formatCents(observedAmount) : "—"}
        </div>
      ) : null}
      {!!payload.guidance && (
        <p className="text-muted-foreground">{String(payload.guidance)}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add "Budget Velocity" to typeLabel map**

At the top of `ApprovalPayload.tsx`, the `typeLabel` map (line 4) is used for display names. The budget velocity incidents still use `budget_override_required` approval type, so no new label entry is needed — the existing label applies. No change required.

- [ ] **Step 3: Commit**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add ui/src/components/ApprovalPayload.tsx
git commit -m "feat(ui): show velocity circuit breaker details in ApprovalPayload"
```

---

### Task 6: Extend Approval Payload for Velocity Incidents

Update `buildApprovalPayload` in `budgets.ts` to include velocity details in the approval payload when creating velocity incidents.

**Files:**
- Modify: `server/src/services/budgets.ts` (the `buildApprovalPayload` function)

- [ ] **Step 1: Add velocity fields to the approval payload builder**

Change the `buildApprovalPayload` function (lines 167-190). Add an optional `velocityDetails` parameter and include it in the payload:

```typescript
function buildApprovalPayload(input: {
  policy: PolicyRow;
  scopeName: string;
  thresholdType: BudgetThresholdType;
  amountObserved: number;
  windowStart: Date;
  windowEnd: Date;
  velocityDetails?: {
    velocitySpendCents: number;
    velocityHardCents: number;
    velocityWindowMinutes: number;
  };
}) {
  const isVelocity = input.thresholdType === "velocity_hard_stop" || input.thresholdType === "velocity_soft";
  return {
    scopeType: input.policy.scopeType,
    scopeId: input.policy.scopeId,
    scopeName: input.scopeName,
    metric: input.policy.metric,
    windowKind: input.policy.windowKind,
    thresholdType: input.thresholdType,
    budgetAmount: input.policy.amount,
    observedAmount: input.amountObserved,
    warnPercent: input.policy.warnPercent,
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    policyId: input.policy.id,
    guidance: isVelocity
      ? "This agent's spend velocity has exceeded the safety threshold. Review and resume, or keep paused."
      : "Raise the budget and resume the scope, or keep the scope paused.",
    ...(input.velocityDetails ?? {}),
  };
}
```

- [ ] **Step 2: Pass velocity details when creating velocity incidents**

In `createIncidentIfNeeded`, the `buildApprovalPayload` call (line 370) already passes the standard fields. Since velocity details aren't available in `createIncidentIfNeeded` (it only knows threshold type and observed amount), we need to pass them through.

Add an optional `velocityDetails` parameter to `createIncidentIfNeeded`:

```typescript
async function createIncidentIfNeeded(
  policy: PolicyRow,
  thresholdType: BudgetThresholdType,
  amountObserved: number,
  velocityDetails?: {
    velocitySpendCents: number;
    velocityHardCents: number;
    velocityWindowMinutes: number;
  },
) {
```

And pass it to `buildApprovalPayload`:

```typescript
const payload = buildApprovalPayload({
  policy,
  scopeName: normalizeScopeName(policy.scopeType as BudgetScopeType, scope.name),
  thresholdType,
  amountObserved,
  windowStart: start,
  windowEnd: end,
  velocityDetails,
});
```

- [ ] **Step 3: Update velocity enforcement code to pass velocity details**

In the velocity enforcement section added in Task 2, update the `createIncidentIfNeeded` calls to pass velocity details:

For the soft velocity incident:
```typescript
const softIncident = await createIncidentIfNeeded(policy, "velocity_soft", velocitySpend, {
  velocitySpendCents: velocitySpend,
  velocityHardCents: velHard ?? 0,
  velocityWindowMinutes: velWindow,
});
```

For the hard velocity incident:
```typescript
const hardIncident = await createIncidentIfNeeded(policy, "velocity_hard_stop", velocitySpend, {
  velocitySpendCents: velocitySpend,
  velocityHardCents: velHard,
  velocityWindowMinutes: velWindow,
});
```

- [ ] **Step 4: Commit**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add server/src/services/budgets.ts
git commit -m "feat(budget): include velocity details in approval payload"
```

---

### Task 7: Database Migration & Final Verification

Generate the Drizzle migration for the new velocity columns and verify the full build pipeline.

**Files:**
- Create: `packages/db/src/migrations/0046_*.sql` (auto-generated by drizzle-kit)

- [ ] **Step 1: Build the db package**

```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm --filter @paperclipai/db build
```
Expected: Build succeeds

- [ ] **Step 2: Generate the drizzle migration**

```bash
cd /Users/jared.cluff/gitrepos/paperclip/packages/db && pnpm drizzle-kit generate
```
Expected: A new migration file is generated in `src/migrations/` with `ALTER TABLE "budget_policies" ADD COLUMN "velocity_window_minutes" integer; ADD COLUMN "velocity_warn_cents" integer; ADD COLUMN "velocity_hard_cents" integer;`

- [ ] **Step 3: Verify the migration file**

Read the generated migration SQL file and confirm it only adds the three nullable columns. No destructive changes should be present.

- [ ] **Step 4: Full typecheck**

```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm typecheck
```
Expected: No type errors

- [ ] **Step 5: Run server tests**

```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm --filter paperclip-server test -- --run
```
Expected: All tests pass

- [ ] **Step 6: Build all packages**

```bash
cd /Users/jared.cluff/gitrepos/paperclip && pnpm build
```
Expected: All packages build successfully

- [ ] **Step 7: Commit migration**

```bash
cd /Users/jared.cluff/gitrepos/paperclip
git add packages/db/src/migrations/
git commit -m "chore(db): add migration for budget velocity columns"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Budget policy supports velocity window + thresholds → Task 1 (schema, types, validators)
- ✅ Cost event evaluation checks velocity after recording spend → Task 2 (evaluateCostEvent velocity check)
- ✅ Velocity hard threshold auto-pauses agent and blocks invocations → Task 2 (pauseAndCancelScopeForBudget + getInvocationBlock)
- ✅ `budget.velocity_threshold_crossed` live event fires → Task 2 (publishLiveEvent call)
- ✅ Board can resolve velocity incident via existing approval flow → Task 2 (resolveIncident velocity branch)
- ✅ Unit tests cover: velocity threshold crossed → agent paused, invocation blocked → Task 3
- ✅ Typecheck, test, and build pass → Task 7
- ✅ UI: velocity fields in BudgetPolicyCard → Task 4
- ✅ UI: velocity_hard_stop in ApprovalPayload → Task 5

**Placeholder scan:** No TBD, TODO, or "implement later" found.

**Type consistency:** `velocityWindowMinutes`, `velocityWarnCents`, `velocityHardCents`, `velocityCurrentCents` used consistently across schema, types, validators, service, and UI.
