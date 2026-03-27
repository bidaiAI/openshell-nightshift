import type { PrivateTaskPayload, PublicTaskView, TaskDraft, TaskCommitment, TaskDraftSplit, PublicTaskPrivacyView } from './types.js'
import { deriveCommitment } from './hashing.js'

const PRIVATE_TASK_KEYS = ['privateBrief', 'instructions', 'attachments', 'privateMetadata'] as const

function buildPublicTaskPrivacyView(task: TaskDraft['privacy']): PublicTaskPrivacyView {
  const privacy: PublicTaskPrivacyView = {
    publicSummary: task.publicSummary,
  }

  if (task.revealOnAcceptance !== undefined) {
    privacy.revealOnAcceptance = task.revealOnAcceptance
  }

  if (task.revealOnDispute !== undefined) {
    privacy.revealOnDispute = task.revealOnDispute
  }

  return privacy
}

function buildPrivateTaskPayload(task: TaskDraft): PrivateTaskPayload {
  const payload: PrivateTaskPayload = {
    taskId: task.taskId,
  }

  if (task.privacy.privateBrief !== undefined) {
    payload.privateBrief = task.privacy.privateBrief
  }

  if (task.privateMetadata !== undefined) {
    payload.privateMetadata = task.privateMetadata
  }

  return payload
}

function buildTaskMetadataCommitmentInput(task: TaskDraft): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    taskId: task.taskId,
    ownerId: task.ownerId,
    title: task.title,
    reward: task.reward,
    status: task.status,
    createdAt: task.createdAt,
    tags: task.tags,
    privacy: task.privacy,
  }

  if (task.deadlineAt !== undefined) {
    payload.deadlineAt = task.deadlineAt
  }

  if (task.publicMetadata !== undefined) {
    payload.publicMetadata = task.publicMetadata
  }

  if (task.privateMetadata !== undefined) {
    payload.privateMetadata = task.privateMetadata
  }

  return payload
}

export function splitTaskDraft(task: TaskDraft): TaskDraftSplit {
  const privatePayload = buildPrivateTaskPayload(task)
  const publicView: PublicTaskView = {
    taskId: task.taskId,
    title: task.title,
    summary: task.privacy.publicSummary,
    reward: task.reward,
    status: task.status,
    createdAt: task.createdAt,
    tags: task.tags,
    privacy: buildPublicTaskPrivacyView(task.privacy),
    metadataCommitment: deriveCommitment('task-metadata', buildTaskMetadataCommitmentInput(task)),
    ...(task.deadlineAt !== undefined ? { deadlineAt: task.deadlineAt } : {}),
  }

  const commitment: TaskCommitment = {
    taskId: task.taskId,
    metadataCommitment: publicView.metadataCommitment,
    payloadCommitment: deriveCommitment('task-private-payload', privatePayload),
    createdAt: task.createdAt,
  }

  return { publicView, privatePayload, commitment }
}

export function redactPrivateTaskFields<T extends Record<string, unknown>>(input: T): Omit<T, typeof PRIVATE_TASK_KEYS[number]> {
  const entries = Object.entries(input).filter(([key]) => !PRIVATE_TASK_KEYS.includes(key as typeof PRIVATE_TASK_KEYS[number]))
  return Object.fromEntries(entries) as Omit<T, typeof PRIVATE_TASK_KEYS[number]>
}

export function getPublicTaskSummary(task: TaskDraft): PublicTaskView {
  return splitTaskDraft(task).publicView
}
