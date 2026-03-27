import type { FastifyPluginAsync } from 'fastify'
import { requireActorMatch, requireAuthenticatedActor } from '../auth.js'
import {
  createDisputeSchema,
  disputeIdParamsSchema,
  submitRevealSchema,
  taskIdParamsSchema,
} from '../schemas.js'

export const disputeRoutes: FastifyPluginAsync = async (app) => {
  app.post('/tasks/:taskId/disputes', async (request, reply) => {
    const { taskId } = taskIdParamsSchema.parse(request.params)
    const body = createDisputeSchema.parse(request.body)
    const assignment = request.store.getAssignment(body.assignmentId)

    if (!assignment || assignment.taskId !== taskId) {
      reply.code(400)
      return { error: 'invalid_assignment_for_task' }
    }

    const actor = requireAuthenticatedActor(request, reply)
    if (!actor) return

    const openerRole = assignment.employerAddress === actor.actorId
      ? 'employer'
      : assignment.workerAddress === actor.actorId
        ? 'worker'
        : null

    if (!openerRole) {
      reply.code(403)
      return { error: 'dispute_party_mismatch' }
    }

    const dispute = request.store.createDispute({
      taskId,
      assignmentId: body.assignmentId,
      openedBy: actor.actorId,
      openerRole,
      reasonCode: body.reasonCode,
      summary: body.summary,
      requestedFields: body.requestedFields,
    })

    reply.code(201)
    return { dispute }
  })

  app.post('/disputes/:disputeId/reveal', async (request, reply) => {
    const { disputeId } = disputeIdParamsSchema.parse(request.params)
    const body = submitRevealSchema.parse(request.body)
    const dispute = request.store.getDispute(disputeId)

    if (!dispute) {
      reply.code(404)
      return { error: 'dispute_not_found' }
    }

    const assignment = request.store.getAssignment(dispute.assignmentId)
    if (!assignment) {
      reply.code(404)
      return { error: 'assignment_not_found' }
    }

    const actor = requireAuthenticatedActor(request, reply)
    if (!actor) return
    const isParty = assignment.employerAddress === actor.actorId || assignment.workerAddress === actor.actorId
    if (!isParty) {
      reply.code(403)
      return { error: 'dispute_party_mismatch' }
    }

    if (
      actor.role !== 'admin'
      && assignment.employerAddress !== actor.actorId
      && !requireActorMatch(reply, actor, assignment.workerAddress, 'worker_identity_mismatch')
    ) {
      return
    }

    const updated = request.store.submitReveal({
      disputeId,
      actorId: actor.actorId,
      revealReason: body.revealReason,
      revealedFields: body.revealedFields,
      revealBundleHash: body.revealBundleHash as `0x${string}`,
      ...(body.revealRef ? { revealRef: body.revealRef } : {}),
    })

    return { dispute: updated }
  })
}
