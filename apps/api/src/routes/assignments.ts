import type { FastifyPluginAsync } from 'fastify'
import type { AssignmentSubmission, WorkerExecutionOffer } from '@nightshift/common'
import { requireActorMatch, requireAuthenticatedActor } from '../auth.js'
import { assignmentIdParamsSchema, assignmentSubmissionSchema, pollAssignmentsQuerySchema } from '../schemas.js'

export const assignmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/assignments/poll', async (request, reply) => {
    const query = pollAssignmentsQuerySchema.parse(request.query)
    const actor = requireAuthenticatedActor(request, reply, 'worker')
    if (!actor) return
    if (!requireActorMatch(reply, actor, query.workerId, 'worker_identity_mismatch')) return
    return request.store.buildPollResponse(query.workerId, query.maxItems ?? 1, {
      providers: (query.providerCatalog ?? []) as WorkerExecutionOffer['providers'],
      transports: (query.transports ?? ['http-poller']) as WorkerExecutionOffer['transports'],
      ...(query.capabilities ? { supportedTools: query.capabilities } : {}),
    })
  })

  app.post('/assignments/:assignmentId/ack', async (request, reply) => {
    const { assignmentId } = assignmentIdParamsSchema.parse(request.params)
    const actor = requireAuthenticatedActor(request, reply, 'worker')
    if (!actor) return
    const current = request.store.getAssignment(assignmentId)
    if (!current) {
      reply.code(404)
      return { error: 'assignment_not_found' }
    }
    if (!requireActorMatch(reply, actor, current.workerAddress, 'worker_identity_mismatch')) return
    const assignment = request.store.acknowledgeAssignment(assignmentId)

    if (!assignment) {
      reply.code(404)
      return { error: 'assignment_not_found' }
    }

    return { assignment }
  })

  app.post('/assignments/:assignmentId/submit', async (request, reply) => {
    const { assignmentId } = assignmentIdParamsSchema.parse(request.params)
    const submission = assignmentSubmissionSchema.parse(request.body)
    const actor = requireAuthenticatedActor(request, reply, 'worker')
    if (!actor) return

    if (submission.assignmentId !== assignmentId || submission.receipt.assignmentId !== assignmentId || submission.receiptCommitment.assignmentId !== assignmentId) {
      reply.code(400)
      return { error: 'assignment_id_mismatch' }
    }

    const assignment = request.store.getAssignment(assignmentId)
    if (!assignment) {
      reply.code(404)
      return { error: 'assignment_not_found' }
    }

    if (!requireActorMatch(reply, actor, assignment.workerAddress, 'worker_identity_mismatch')) return
    if (!requireActorMatch(reply, actor, submission.workerId, 'worker_submission_mismatch')) return

    return request.store.recordWorkerSubmission(submission as AssignmentSubmission)
  })
}
