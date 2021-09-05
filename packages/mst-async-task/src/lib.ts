export enum AsyncTaskStatus {
  INIT = 'init',
  PENDING = 'pending',
  COMPLETE = 'complete',
  FAILED = 'failed',
  ABORTED = 'aborted'
}

export class AsyncTaskResult {
  status: AsyncTaskStatus
  error?: Error
  value?: any

  constructor(status: AsyncTaskStatus, error?: Error, value?: any) {
    this.status = status
    this.error = error
    this.value = value
  }
}

export class AsyncTaskAbortError extends Error {
  constructor() {
    super("Task was aborted.")
    this.name = 'AsyncTaskAbortError'
    Object.setPrototypeOf(this, AsyncTaskAbortError.prototype)
  }
}
