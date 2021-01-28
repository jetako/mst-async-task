export enum AsyncTaskStatus {
  INIT = 'init',
  PENDING = 'pending',
  COMPLETE = 'complete',
  FAILED = 'failed',
  ABORTED = 'aborted'
}

export class AsyncTaskResult {
  error?: Error

  constructor(error?: Error) {
    this.error = error
  }
}

export class AsyncTaskAbortError extends Error {
  constructor() {
    super("Task was aborted.")
    this.name = 'AsyncTaskAbortError'
    Object.setPrototypeOf(this, AsyncTaskAbortError.prototype)
  }
}
