import { types, Instance, destroy, applySnapshot } from 'mobx-state-tree'
import {
  AsyncTask,
  AsyncTaskStatus,
  AsyncTaskResult,
  AsyncTaskAbortError,
  runTask,
} from '../src'

const sleep = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal) {
    signal.addEventListener('abort', () => {
      reject(new Error('Aborted'))
    })
  }
  setTimeout(resolve, 10)
})

const runTimers = async (count = 1) => {
  for (let i = 0; i < count; i++) {
    jest.runAllTimers()
    await Promise.resolve()
  }
}

describe('runTask()', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('single task', () => {
    const TestStore = types
      .model({
        value: types.maybe(types.string),
        task: types.optional(AsyncTask, {})
      })
      .actions(self => {
        return {
          run: (fail = false) => runTask(self.task, function*({ signal, exec }) {
            yield sleep(signal)
            if (fail) {
              throw new Error('failed')
            }
            exec(() => self.value = 'ok')
            return 'result'
          }),
          runNoSignal: () => runTask(self.task, function*({ exec }) {
            yield sleep()
            exec(() => self.value = 'ok')
          })
        }
      })

    let store: Instance<typeof TestStore>

    beforeEach(() => {
      store = TestStore.create()
    })

    it('sets status to pending immediately', () => {
      store.run()
      expect(store.task.status).toBe(AsyncTaskStatus.PENDING)
    })

    it('sets status to complete and returns result', async () => {
      const promise = store.run()
      await runTimers()
      const result = await promise
      expect(result).toBeInstanceOf(AsyncTaskResult)
      expect(result.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(result.error).toBeUndefined()
      expect(result.value).toBe('result')
      expect(store.task.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task.result).toBe('result')
      expect(store.value).toBe('ok')
    })

    it('sets status to failed when an error is thrown', async () => {
      const promise = store.run(true)
      await runTimers()
      const result = await promise
      expect(result.status).toBe(AsyncTaskStatus.FAILED)
      expect(result.error?.message).toBe('failed')
      expect(store.task.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task.error?.message).toBe('failed')
    })

    it('resets state when reset() is called', async () => {
      const promise = store.run()
      await runTimers()
      await promise
      store.task.reset()
      expect(store.task.status).toBe(AsyncTaskStatus.INIT)
      expect(store.task.result).toBeUndefined()
    })

    it('aborts the task when abort() is called while pending', async () => {
      const promise = store.run()
      store.task.abort()
      await runTimers()
      const result = await promise
      expect(result.status).toBe(AsyncTaskStatus.ABORTED)
      expect(result.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task.status).toBe(AsyncTaskStatus.ABORTED)
    })

    it('aborts and resets state when reset() is called while pending', async () => {
      const promise = store.run()
      store.task.reset()
      await runTimers()
      await promise
      expect(store.task.status).toBe(AsyncTaskStatus.INIT)
      expect(store.task.error).toBeUndefined()
      expect(store.value).toBeUndefined()
    })

    it('aborts previous task when run again while pending', async () => {
      const promise1 = store.run()
      const promise2 = store.run()
      await runTimers()
      const result1 = await promise1
      expect(result1.error).toBeInstanceOf(AsyncTaskAbortError)
      const result2 = await promise2
      expect(result2.error).toBeUndefined()
      expect(store.task.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value).toBe('ok')
    })

    it('aborts previous task when run again while pending with no signal', async () => {
      const promise1 = store.runNoSignal()
      const promise2 = store.runNoSignal()
      await runTimers()
      const result1 = await promise1
      expect(result1.error).toBeInstanceOf(AsyncTaskAbortError)
      const result2 = await promise2
      expect(result2.error).toBeUndefined()
      expect(store.task.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value).toBe('ok')
    })

    it('only updates state after flow is complete if the task is alive in the state tree', async () => {
      const promise = store.run()
      destroy(store)
      await runTimers()
      const result = await promise
      expect(result.status).toBe(AsyncTaskStatus.ABORTED)
      expect(result.error).toBeInstanceOf(AsyncTaskAbortError)
    })

    it('does not update state after flow is complete if state was reset', async () => {
      // Can't figure out how to test this with fake timers...
      jest.useRealTimers()
      const promise1 = store.run()
      applySnapshot(store, {})
      await new Promise(r => setTimeout(r, 5))
      const promise2 = store.run()
      await new Promise(r => setTimeout(r, 5))
      expect(store.task.status).toBe(AsyncTaskStatus.PENDING)
      await new Promise(r => setTimeout(r, 10))
      const result1 = await promise1
      expect(result1.status).toBe(AsyncTaskStatus.ABORTED)
      const result2 = await promise2
      expect(result2.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task.status).toBe(AsyncTaskStatus.COMPLETE)
    })
  })

  describe('chained tasks', () => {
    const TestStore = types
      .model({
        value1: types.maybe(types.string),
        value2: types.maybe(types.string),
        value3: types.maybe(types.string),
        task1: types.optional(AsyncTask, {}),
        task2: types.optional(AsyncTask, {}),
        task3: types.optional(AsyncTask, {})
      })
      .actions(self => {
        const run = (fail = false) => runTask(self.task1, function*({ signal, exec }) {
          yield sleep(signal)
          yield exec(() => {
            self.value1 = 'ok'
            return run2(fail)
          })
        })
        
        const run2 = (fail = false) => runTask(self.task2, function*({ signal, exec }) {
          yield sleep(signal)
          if (fail) {
            throw new Error('failed')
          }
          yield exec(() => {
            self.value2 = 'ok'
            return run3()
          })
        })

        const run3 = () => runTask(self.task3, function*({ signal, exec }) {
          yield sleep(signal)
          exec(() => self.value3 = 'ok')
        })
        
        return { run, run2, run3 }
      })

    let store: Instance<typeof TestStore>

    beforeEach(() => {
      store = TestStore.create()
    })

    it('runs all tasks', async () => {
      const promise = store.run()
      await runTimers(3)
      const result = await promise
      expect(result.error).toBeUndefined()
      expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task2.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task3.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBe('ok')
      expect(store.value3).toBe('ok')
    })

    it('bubbles up nested failures to the initial task', async () => {
      const promise = store.run(true)
      await runTimers(3)
      const result = await promise
      expect(result.error?.message).toBe('failed')
      expect(store.task1.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task1.error?.message).toBe('failed')
      expect(store.task2.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task2.error?.message).toBe('failed')
      expect(store.task3.status).toBe(AsyncTaskStatus.INIT)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBeUndefined()
      expect(store.value3).toBeUndefined()
    })

    it('bubbles up nested abort errors to the initial task', async () => {
      const promise = store.run()
      await runTimers(2)
      store.task3.abort()
      await runTimers()
      const result = await promise
      expect(result.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task1.status).toBe(AsyncTaskStatus.ABORTED)
      expect(store.task1.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task2.status).toBe(AsyncTaskStatus.ABORTED)
      expect(store.task2.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task3.status).toBe(AsyncTaskStatus.ABORTED)
      expect(store.task3.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBe('ok')
      expect(store.value3).toBeUndefined()
    })
  })

  describe('sequential/parallel tasks', () => {
    const TestStore = types
      .model({
        value1: types.maybe(types.string),
        value2: types.maybe(types.string),
        runAllSeqTask: types.optional(AsyncTask, {}),
        runAllParallelTask: types.optional(AsyncTask, {}),
        task1: types.optional(AsyncTask, {}),
        task2: types.optional(AsyncTask, {}),
      })
      .actions(self => {
        const runAllSeq = (fail = false) => runTask(self.runAllSeqTask, function*({ exec }) {
          yield exec(run1)
          yield exec(run2, fail)
        })

        const runAllParallel = (fail = false) => runTask(self.runAllParallelTask, function*({ exec }) {
          yield Promise.all([
            exec(run1),
            exec(run2, fail)
          ])
        })
        
        const run1 = () => runTask(self.task1, function*({ signal, exec }) {
          yield sleep(signal)
          exec(() => self.value1 = 'ok')
        })

        const run2 = (fail = false) => runTask(self.task2, function*({ signal, exec }) {
          yield sleep(signal)
          if (fail) {
            throw new Error('failed')
          }
          exec(() => self.value2 = 'ok')
        })
        
        return { runAllSeq, runAllParallel }
      })

    let store: Instance<typeof TestStore>

    beforeEach(() => {
      store = TestStore.create()
    })

    describe('sequential', () => {
      it('runs all tasks', async () => {
        const promise = store.runAllSeq()
        await runTimers(6)
        const result = await promise
        expect(result.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.runAllSeqTask.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.task2.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.value1).toBe('ok')
        expect(store.value2).toBe('ok')
      })

      it('does not modify resolved child tasks when parent task is aborted', async () => {
        const promise = store.runAllSeq()
        await runTimers(5)
        store.runAllSeqTask.abort()
        await runTimers()
        const result = await promise
        expect(result.status).toBe(AsyncTaskStatus.ABORTED)
        expect(store.runAllSeqTask.status).toBe(AsyncTaskStatus.ABORTED)
        expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.task2.status).toBe(AsyncTaskStatus.ABORTED)
      })
    })

    describe('parallel', () => {
      it('runs all tasks', async () => {
        const promise = store.runAllParallel()
        await runTimers()
        const result = await promise
        expect(result.error).toBeUndefined()
        expect(store.runAllParallelTask.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.task2.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.value1).toBe('ok')
        expect(store.value2).toBe('ok')
      })
      
      it('bubbles up failures to the parent task', async () => {
        const promise = store.runAllParallel(true)
        await runTimers()
        const result = await promise
        expect(result.error?.message).toBe('failed')
        expect(store.runAllParallelTask.status).toBe(AsyncTaskStatus.FAILED)
        expect(store.runAllParallelTask.error?.message).toBe('failed')
        expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
        expect(store.task2.status).toBe(AsyncTaskStatus.FAILED)
        expect(store.value1).toBe('ok')
        expect(store.value2).toBeUndefined()
      })

      it('aborts child tasks when parent task is aborted', async () => {
        const promise = store.runAllParallel()
        store.runAllParallelTask.abort()
        await runTimers()
        const result = await promise
        expect(result.status).toBe(AsyncTaskStatus.ABORTED)
        expect(store.runAllParallelTask.status).toBe(AsyncTaskStatus.ABORTED)
        expect(store.task1.status).toBe(AsyncTaskStatus.ABORTED)
        expect(store.task2.status).toBe(AsyncTaskStatus.ABORTED)
        expect(store.value1).toBeUndefined()
        expect(store.value2).toBeUndefined()
      })
    })
  })
})
