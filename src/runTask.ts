import { flow, isAlive } from 'mobx-state-tree'
import { IAsyncTask } from './AsyncTask'
import { AsyncTaskStatus, AsyncTaskResult, AsyncTaskAbortError } from './lib'

let parentAbortSignal: AbortSignal | null = null

/**
 * Executes a `flow` generator while maintaining lifecycle updates in an AsyncTask.
 * In the generator function, you perform async operations like loading data and
 * updating the store state, similarly to how you would with `flow`. The difference
 * is, you don't need to manage lifecycle state or capture errors explicitly.
 * 
 * The generator function receives an object with two parameters: `signal` and `exec`:
 * 
 * `signal` is an AbortSignal that is useful for canceling requests. For example, you
 * can pass it into `fetch()`, and if the task is aborted, the http request will be
 * aborted as well.
 * 
 * `exec` serves two purposes:
 * 1. If you want your task to be cancelable via `task.abort()` but don't want to deal
 * with signals, you can prevent your task from updating state after it is aborted
 * by wrapping your updates in an `exec()` callback.
 * 2. Calling a task action from another task. See example below.
 * 
 * @example
 * // Basic example:
 * import { types, Instance } from 'mobx-state-tree'
 * import { AsyncTask, runTask } from 'mst-async-task'
 * 
 * export const Store = types
 *  .model({
 *    item: types.maybe(Item),
 *    loadItemTask: types.optional(AsyncTask, {})
 *  })
 *  .actions(self => {
 *    const loadItem = (itemId: string) => runTask(self.loadItemTask, function*() {
 *      const data = yield fetch(`https://example-api.com/items/${itemId}`)
 *      self.item = Item.create(data)
 *    })
 *    return { loadItem }
 *  })
 * 
 * // Using the provided AbortSignal to cancel the http request when the task is aborted:
 * const loadItem = (itemId: string) => runTask(self.loadItemTask, function*({ signal }) {
 *   const data = yield fetch(`https://example-api.com/items/${itemId}`, { signal })
 *   self.item = Item.create(data)
 * })
 *
 * // Wrapping state updates in an `exec()` callback:
 * const loadItem = (itemId: string) => runTask(self.loadItemTask, function*({ exec }) {
 *   const data = yield fetch(`https://example-api.com/items/${itemId}`)
 *   exec(() => {
 *     // This will not be executed if `loadItemTask.abort()` is called while the
 *     // http request is pending.
 *     self.item = Item.create(data)
 *   })
 * })
 * 
 * // Running a task from within another task:
 * const loadUser = () => runTask(self.loadUserTask, function*({ exec }) {
 *   const user = yield fetch(`https://example-api.com/user`)
 *   // If the loadItem task encounters an error, it will propagate up to
 *   // the loadUser task.
 *   exec(self.loadItem, user.itemId)
 * })
 *
 * @param task AsyncTask instance that encapsulates the task status.
 * @param generator Generator function that performs the task operations. It receives
 * an object with 2 parameters: `signal` and `exec`. See `runTask()` description
 * for a detailed explanation.
 * @returns Promise(AsyncTaskResult)
 */
export function runTask(
  task: IAsyncTask,
  generator: (params: { signal: AbortSignal, exec: Function }) => Generator<Promise<any>, any, any>
) {
  return flow(function*() {
    const abortController = new AbortController()
    const { signal } = abortController

    if (parentAbortSignal) {
      parentAbortSignal.addEventListener('abort', () => {
        abortController.abort()
      })
    }

    const exec = async (fn: Function, ...args: any[]) => {
      if (signal.aborted || task.status !== AsyncTaskStatus.PENDING || !isAlive(task)) {
        throw new AsyncTaskAbortError()
      }

      try {
        parentAbortSignal = signal
        const ret = fn(...args)
        parentAbortSignal = null
        const result = await ret

        if (result instanceof AsyncTaskResult) {
          if (result.error) {
            throw result.error
          }
          return undefined
        }

        return result
      } catch (error) {
        parentAbortSignal = null
        throw error
      }
    }

    if (task.pending) {
      task.abort()
    }

    task.status = AsyncTaskStatus.PENDING
    task.error = undefined
    task._abortController = abortController

    let result: AsyncTaskResult

    try {
      yield flow(generator)({ signal, exec })

      if (signal.aborted) {
        const abortError = new AsyncTaskAbortError()
        task.status = AsyncTaskStatus.ABORTED
        task.error = abortError
        result = new AsyncTaskResult(abortError)
      } else {
        task.status = AsyncTaskStatus.COMPLETE
        result = new AsyncTaskResult()
      }
    } catch (error) {
      if (error instanceof AsyncTaskAbortError) {
        task.status = AsyncTaskStatus.ABORTED
        task.error = error
        result = new AsyncTaskResult(error)
      } else if (signal.aborted) {
        const abortError = new AsyncTaskAbortError()
        task.status = AsyncTaskStatus.ABORTED
        task.error = abortError
        result = new AsyncTaskResult(abortError)
      } else {
        task.status = AsyncTaskStatus.FAILED
        task.error = error
        result = new AsyncTaskResult(error)
      }
    }

    delete task._abortController
    return result
  })()
}
