import { flow, isAlive } from 'mobx-state-tree'
import { IAsyncTask } from './AsyncTask'
import { AsyncTaskStatus, AsyncTaskResult, AsyncTaskAbortError } from './lib'

type Exec = <T extends (...args: any[]) => any>(callback: T, ...args: Parameters<T>) => any

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
 *     // This will not be executed if the task is aborted.
 *     self.item = Item.create(data)
 *   })
 * })
 * 
 * // Running a task from within another task:
 * const loadUser = () => runTask(self.loadUserTask, function*({ exec }) {
 *   const user = yield fetch(`https://example-api.com/user`)
 *   // If the loadItem task encounters an error, it will propagate up to
 *   // the loadUser task.
 *   yield exec(self.loadItem, user.itemId)
 * })
 *
 * @param task AsyncTask instance that encapsulates the task status.
 * @param generator Generator function that performs the task operations. It receives
 * an object with 2 parameters: `signal` and `exec`. See `runTask()` description
 * for a detailed explanation.
 * @returns Promise(AsyncTaskResult)
 */
export async function runTask(
  task: IAsyncTask,
  generator: (params: { signal: AbortSignal, exec: Exec }) => Generator<Promise<any>, any, any>
): Promise<AsyncTaskResult> {
  const abortController = new AbortController()
  const { signal } = abortController

  if (task._abortController) {
    task._abortController.abort()
    delete task._abortController
  }

  if (parentAbortSignal) {
    parentAbortSignal.addEventListener('abort', () => {
      abortController.abort()
    })
  }

  const exec: Exec = (callback, ...args) => {
    if (!isAlive(task) || !task.pending || signal.aborted) {
      throw new AsyncTaskAbortError()
    }
    
    const execAsync = async () => {
      try {
        parentAbortSignal = signal
        const ret = callback(...args)
        parentAbortSignal = null
        const result = await ret

        if (result instanceof AsyncTaskResult) {
          if (result.error) {
            throw result.error
          }
          return undefined
        }

        return result
      } catch (err) {
        parentAbortSignal = null
        throw err
      }
    }
    
    return execAsync()
  }

  task.status = AsyncTaskStatus.PENDING
  task.error = undefined
  task._abortController = abortController

  const [status, error, result]: [AsyncTaskStatus, Error?, any?] = await new Promise(async resolve => {
    const done = (args: [AsyncTaskStatus, Error?, any?]) => {
      signal.removeEventListener('abort', abortHandler)
      resolve(args)
    }

    const abortHandler = () => {
      const status = AsyncTaskStatus.ABORTED
      const error = new AsyncTaskAbortError()
      // To ensure that the effect of aborting is synchronous,
      // set task properties immediately instead of on next tick.
      if (isAlive(task) && task.pending) {
        task._resolve(status, error)
      }
      done([status, error])
    }

    signal.addEventListener('abort', abortHandler)

    try {
      const result = await flow(generator)({ signal, exec })
      done([AsyncTaskStatus.COMPLETE, undefined, result])
    } catch (err) {
      if (err instanceof AsyncTaskAbortError) {
        done([AsyncTaskStatus.ABORTED, err])
      } else {
        done([AsyncTaskStatus.FAILED, err])
      }
    }
  })

  if (isAlive(task) && task.pending && !signal.aborted) {
    task._resolve(status, error, result)
  }

  return new AsyncTaskResult(status, error, result)
}
