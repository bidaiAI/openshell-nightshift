import type { FastifyPluginAsync } from 'fastify'
import { requireActorMatch, requireAuthenticatedActor, type AuthenticatedActor } from '../auth.js'
import { buildCompactProjection } from '../compact.js'
import { DEFAULT_WORKSPACE_ID, type InMemoryNightShiftStore } from '../store.js'
import {
  acceptAssignmentSchema,
  createAssignmentSchema,
  createBidSchema,
  createTaskSchema,
  taskIdParamsSchema,
} from '../schemas.js'

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const getTaskRelatedRecords = (store: InMemoryNightShiftStore, taskId: string) => {
    const bids = store.listBids(taskId)
    const assignments = store.listAssignments(taskId)
    const receipts = store.listReceipts(taskId)
    const disputes = store.listDisputes(taskId)
    const activeAssignment = assignments.find((assignment) => assignment.status !== 'completed' && assignment.status !== 'cancelled')
    const selectedBid = activeAssignment
      ? bids.find((bid) => bid.id === activeAssignment.bidId) ?? bids.find((bid) => bid.status === 'selected')
      : bids.find((bid) => bid.status === 'selected')
    const latestReceipt = receipts[0]
    const activeDispute = disputes.find((dispute) => dispute.status === 'open' || dispute.status === 'revealed')

    return {
      bids,
      assignments,
      receipts,
      disputes,
      compactProjection: buildCompactProjection(store.getTask(taskId)!, {
        ...(selectedBid ? { selectedBid } : {}),
        ...(activeAssignment ? { activeAssignment } : {}),
        ...(latestReceipt ? { latestReceipt } : {}),
        ...(activeDispute ? { activeDispute } : {}),
      }),
    }
  }

  const projectExecutionPolicy = (execution: { transport: string; mode: string; networkPolicy: string } | undefined) => (
    execution
      ? {
          transport: execution.transport,
          mode: execution.mode,
          networkPolicy: execution.networkPolicy,
        }
      : undefined
  )

  const projectTaskPublic = (
    task: NonNullable<ReturnType<InMemoryNightShiftStore['getTask']>>,
    compactProjection: ReturnType<typeof buildCompactProjection>,
  ) => ({
    id: task.id,
    title: task.title,
    publicSummary: task.publicSummary,
    rewardAmount: task.rewardAmount,
    rewardAsset: task.rewardAsset,
    visibility: task.visibility,
    taskCommitment: task.taskCommitment,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    compactProjection,
    ...(task.deadlineAt ? { deadlineAt: task.deadlineAt } : {}),
    ...(projectExecutionPolicy(task.execution) ? { execution: projectExecutionPolicy(task.execution) } : {}),
  })

  const canViewFullTask = (
    task: NonNullable<ReturnType<InMemoryNightShiftStore['getTask']>>,
    actor: AuthenticatedActor | null,
    assignments: ReturnType<InMemoryNightShiftStore['listAssignments']>,
  ) => Boolean(
    actor
    && (
      actor.role === 'admin'
      || actor.actorId === task.employerAddress
      || assignments.some((assignment) => assignment.workerAddress === actor.actorId)
    )
  )

  const canViewAnyPrivateRecords = (
    task: NonNullable<ReturnType<InMemoryNightShiftStore['getTask']>>,
    actor: AuthenticatedActor | null,
    assignments: ReturnType<InMemoryNightShiftStore['listAssignments']>,
    bids: ReturnType<InMemoryNightShiftStore['listBids']>,
  ) => Boolean(
    actor
    && (
      actor.role === 'admin'
      || actor.actorId === task.employerAddress
      || assignments.some((assignment) => assignment.workerAddress === actor.actorId)
      || bids.some((bid) => bid.workerAddress === actor.actorId)
    )
  )

  const projectTaskDetail = (
    store: InMemoryNightShiftStore,
    task: NonNullable<ReturnType<InMemoryNightShiftStore['getTask']>>,
    actor: AuthenticatedActor | null,
  ) => {
    const { assignments, bids, receipts, disputes, compactProjection } = getTaskRelatedRecords(store, task.id)
    const fullTaskVisible = canViewFullTask(task, actor, assignments)
    const anyPrivateRecordsVisible = canViewAnyPrivateRecords(task, actor, assignments, bids)
    const visibleAssignmentIds = new Set(
      assignments
        .filter((assignment) => actor && (actor.role === 'admin' || assignment.employerAddress === actor.actorId || assignment.workerAddress === actor.actorId))
        .map((assignment) => assignment.id),
    )

    const visibleBids = !actor
      ? []
      : actor.role === 'admin' || actor.actorId === task.employerAddress
        ? bids
        : bids.filter((bid) => bid.workerAddress === actor.actorId)
    const visibleAssignments = !actor
      ? []
      : actor.role === 'admin' || actor.actorId === task.employerAddress
        ? assignments
        : assignments.filter((assignment) => assignment.workerAddress === actor.actorId)
    const visibleReceipts = !actor
      ? []
      : actor.role === 'admin' || actor.actorId === task.employerAddress
        ? receipts
        : receipts.filter((receipt) => receipt.workerId === actor.actorId || visibleAssignmentIds.has(receipt.assignmentId))
    const visibleDisputes = !actor
      ? []
      : actor.role === 'admin' || actor.actorId === task.employerAddress
        ? disputes
        : disputes.filter((dispute) => visibleAssignmentIds.has(dispute.assignmentId))

    return {
      task: fullTaskVisible
        ? { ...task, compactProjection }
        : projectTaskPublic(task, compactProjection),
      bids: anyPrivateRecordsVisible ? visibleBids : [],
      assignments: anyPrivateRecordsVisible ? visibleAssignments : [],
      receipts: anyPrivateRecordsVisible ? visibleReceipts : [],
      disputes: anyPrivateRecordsVisible ? visibleDisputes : [],
    }
  }

  app.get('/summary', async (request) => ({
    summary: request.store.getDashboardSummary(),
    meta: {
      workspaceId: request.workspaceId,
      isolated: request.workspaceId !== DEFAULT_WORKSPACE_ID,
    },
  }))

  app.get('/tasks', async (request) => ({
    tasks: request.store.listTasks().map((task) => projectTaskPublic(task, getTaskRelatedRecords(request.store, task.id).compactProjection)),
    meta: {
      workspaceId: request.workspaceId,
      isolated: request.workspaceId !== DEFAULT_WORKSPACE_ID,
    },
  }))

  app.post('/tasks', async (request, reply) => {
    const body = createTaskSchema.parse(request.body)
    const actor = requireAuthenticatedActor(request, reply, 'employer')
    if (!actor) return
    if (!requireActorMatch(reply, actor, body.employerAddress, 'employer_identity_mismatch')) return
    const task = request.store.createTask(body as Parameters<typeof request.store.createTask>[0])
    reply.code(201)
    return { task }
  })

  app.get('/tasks/:taskId', async (request, reply) => {
    const { taskId } = taskIdParamsSchema.parse(request.params)
    const task = request.store.getTask(taskId)

    if (task == null) {
      reply.code(404)
      return { error: 'task_not_found' }
    }

    return {
      ...projectTaskDetail(request.store, task, request.actor),
      meta: {
        workspaceId: request.workspaceId,
        isolated: request.workspaceId !== DEFAULT_WORKSPACE_ID,
      },
    }
  })

  app.post('/tasks/:taskId/bids', async (request, reply) => {
    const { taskId } = taskIdParamsSchema.parse(request.params)
    const task = request.store.getTask(taskId)

    if (task == null) {
      reply.code(404)
      return { error: 'task_not_found' }
    }

    const body = createBidSchema.parse(request.body)
    const actor = requireAuthenticatedActor(request, reply, 'worker')
    if (!actor) return
    if (!requireActorMatch(reply, actor, body.workerAddress, 'worker_identity_mismatch')) return
    const bid = request.store.createBid({ ...body, taskId } as Parameters<typeof request.store.createBid>[0])
    reply.code(201)
    return { bid }
  })

  app.get('/tasks/:taskId/bids', async (request, reply) => {
    const { taskId } = taskIdParamsSchema.parse(request.params)
    const task = request.store.getTask(taskId)

    if (task == null) {
      reply.code(404)
      return { error: 'task_not_found' }
    }

    if (!request.actor) {
      return { bids: [] }
    }

    if (request.actor.role === 'admin' || request.actor.actorId === task.employerAddress) {
      return { bids: request.store.listBids(taskId) }
    }

    return {
      bids: request.store.listBids(taskId).filter((bid) => bid.workerAddress === request.actor?.actorId),
    }
  })

  app.post('/tasks/:taskId/assignments', async (request, reply) => {
    const { taskId } = taskIdParamsSchema.parse(request.params)
    const task = request.store.getTask(taskId)

    if (task == null) {
      reply.code(404)
      return { error: 'task_not_found' }
    }

    const body = createAssignmentSchema.parse(request.body)
    const actor = requireAuthenticatedActor(request, reply, 'employer')
    if (!actor) return
    if (!requireActorMatch(reply, actor, task.employerAddress, 'employer_identity_mismatch')) return
    const bid = request.store.getBid(body.bidId)

    if (bid == null || bid.taskId !== taskId) {
      reply.code(400)
      return { error: 'invalid_bid_for_task' }
    }

    const assignment = request.store.createAssignment({
      taskId,
      bidId: bid.id,
      workerAddress: bid.workerAddress,
      employerAddress: task.employerAddress,
    })

    reply.code(201)
    return { assignment }
  })

  app.post('/tasks/:taskId/accept', async (request, reply) => {
    const { taskId } = taskIdParamsSchema.parse(request.params)
    const task = request.store.getTask(taskId)
    if (task == null) {
      reply.code(404)
      return { error: 'task_not_found' }
    }

    const actor = requireAuthenticatedActor(request, reply, 'employer')
    if (!actor) return
    if (!requireActorMatch(reply, actor, task.employerAddress, 'employer_identity_mismatch')) return

    const { assignmentId } = acceptAssignmentSchema.parse(request.body)
    const assignment = request.store.acceptAssignment(taskId, assignmentId)

    if (assignment == null) {
      reply.code(404)
      return { error: 'assignment_not_found' }
    }

    return { assignment }
  })
}
