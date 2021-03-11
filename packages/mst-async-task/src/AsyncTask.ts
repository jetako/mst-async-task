import { Instance, types } from 'mobx-state-tree'
import { AsyncTaskStatus } from './lib'

/**
 * AsyncTask encapsulates the lifecycle of an asychronous action.
 * See `runTask()` for usage.
 */
export const AsyncTask = types
  .model({
    status: types.optional(
      types.enumeration([
        AsyncTaskStatus.INIT,
        AsyncTaskStatus.PENDING,
        AsyncTaskStatus.COMPLETE,
        AsyncTaskStatus.FAILED,
        AsyncTaskStatus.ABORTED
      ]),
      AsyncTaskStatus.INIT
    ),
    error: types.maybe(types.frozen<Error>())
  })
  .views(self => {
    return {
      get clean() {
        return self.status === AsyncTaskStatus.INIT
      },
      
      get pending() {
        return self.status === AsyncTaskStatus.PENDING
      },
    
      get complete() {
        return self.status === AsyncTaskStatus.COMPLETE
      },
    
      get failed() {
        return self.status === AsyncTaskStatus.FAILED
      },
    
      get aborted() {
        return self.status === AsyncTaskStatus.ABORTED
      },
    
      get unresolved() {
        return self.status === AsyncTaskStatus.INIT || self.status === AsyncTaskStatus.PENDING
      },
    
      get resolved() {
        return self.status !== AsyncTaskStatus.INIT && self.status !== AsyncTaskStatus.PENDING
      }
    }
  })
  .actions(self => {
    const abort = () => {
      const task = self as IAsyncTask
      if (task._abortController) {
        task._abortController.abort()
      }
    }

    const reset = () => {
      abort()
      self.status = AsyncTaskStatus.INIT
      self.error = undefined
    }
    
    /**
     * Used internally by `runTask()`. This should not be called directly.
     */
    const _resolve = (status: AsyncTaskStatus, error?: Error) => {
      self.status = status
      self.error = error
      delete (self as IAsyncTask)._abortController
    }

    return { abort, reset, _resolve }
  })

export interface IAsyncTask extends Instance<typeof AsyncTask> {
  _abortController?: AbortController
}
