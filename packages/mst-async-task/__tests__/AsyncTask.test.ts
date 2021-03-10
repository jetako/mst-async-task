import { AsyncTask, AsyncTaskStatus } from '../src'

describe('AsyncTask', () => {
  describe('views', () => {
    test('init', () => {
      const task = AsyncTask.create()
      expect(task.clean).toBe(true)
      expect(task.pending).toBe(false)
      expect(task.complete).toBe(false)
      expect(task.failed).toBe(false)
      expect(task.aborted).toBe(false)
      expect(task.unresolved).toBe(true)
      expect(task.resolved).toBe(false)
    })
  
    test('pending', () => {
      const task = AsyncTask.create({ status: AsyncTaskStatus.PENDING })
      expect(task.clean).toBe(false)
      expect(task.pending).toBe(true)
      expect(task.complete).toBe(false)
      expect(task.failed).toBe(false)
      expect(task.aborted).toBe(false)
      expect(task.unresolved).toBe(true)
      expect(task.resolved).toBe(false)
    })
  
    test('complete', () => {
      const task = AsyncTask.create({ status: AsyncTaskStatus.COMPLETE })
      expect(task.clean).toBe(false)
      expect(task.pending).toBe(false)
      expect(task.complete).toBe(true)
      expect(task.failed).toBe(false)
      expect(task.aborted).toBe(false)
      expect(task.unresolved).toBe(false)
      expect(task.resolved).toBe(true)
    })
  
    test('failed', () => {
      const task = AsyncTask.create({ status: AsyncTaskStatus.FAILED })
      expect(task.clean).toBe(false)
      expect(task.pending).toBe(false)
      expect(task.complete).toBe(false)
      expect(task.failed).toBe(true)
      expect(task.aborted).toBe(false)
      expect(task.unresolved).toBe(false)
      expect(task.resolved).toBe(true)
    })
  
    test('aborted', () => {
      const task = AsyncTask.create({ status: AsyncTaskStatus.ABORTED })
      expect(task.clean).toBe(false)
      expect(task.pending).toBe(false)
      expect(task.complete).toBe(false)
      expect(task.failed).toBe(false)
      expect(task.aborted).toBe(true)
      expect(task.unresolved).toBe(false)
      expect(task.resolved).toBe(true)
    })
  })
})
