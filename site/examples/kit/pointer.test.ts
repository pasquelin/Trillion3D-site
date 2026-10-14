import assert from 'node:assert/strict'
import { test } from 'node:test'
import { onClick, type Press } from './pointer.ts'

/** A canvas that hands its pointer events straight to its listeners, and the clicks they make. */
function canvasClicked() {
  const listeners = new Map<string, (event: Press) => void>()
  const clicks: number[][] = []
  onClick({ addEventListener: (type, listener) => void listeners.set(type, listener) }, (event) =>
    clicks.push([event.offsetX, event.offsetY]),
  )
  const send = (type: string, offsetX: number, offsetY: number, isPrimary = true, button = 0) =>
    listeners.get(type)?.({ offsetX, offsetY, isPrimary, button })
  return { send, clicks }
}

test('a press released where it went down clicks there', () => {
  const { send, clicks } = canvasClicked()
  send('pointerdown', 10, 20)
  send('pointerup', 12, 21)
  assert.deepEqual(clicks, [[12, 21]])
})

test('a drag of the camera clicks nothing, nor a release with no press', () => {
  const { send, clicks } = canvasClicked()
  send('pointerdown', 10, 20)
  send('pointerup', 40, 20)
  send('pointerup', 40, 20)
  assert.deepEqual(clicks, [])
})

test('a pinch clicks nothing: neither finger’s release counts', () => {
  const { send, clicks } = canvasClicked()
  send('pointerdown', 10, 20)
  send('pointerdown', 60, 20, false)
  send('pointerup', 60, 20, false)
  send('pointerup', 10, 20)
  assert.deepEqual(clicks, [])
})

test('a second finger’s release alone is no click', () => {
  const { send, clicks } = canvasClicked()
  send('pointerdown', 10, 20)
  send('pointerup', 10, 20, false)
  assert.deepEqual(clicks, [])
})

test('a still press of another button than the main one is no click', () => {
  const { send, clicks } = canvasClicked()
  send('pointerdown', 10, 20, true, 2)
  send('pointerup', 10, 20, true, 2)
  assert.deepEqual(clicks, [])
})
