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
    const task = self as IAsyncTask

    return {
      abort() {
        if (task._abortController) {
          task._abortController.abort()
        }
      },

      reset() {
        if (task.pending) {
          throw new Error('AsyncTask cannot be reset while pending.')
        }
        task.status = AsyncTaskStatus.INIT
        task.error = undefined
      }
    }
  })

export interface IAsyncTask extends Instance<typeof AsyncTask> {
  _abortController?: AbortController
}
