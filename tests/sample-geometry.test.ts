import assert from 'node:assert/strict'
import { test } from 'node:test'
import { moveAnnotation } from '../src/services/sampleGeometry'
const part = { point: [500, 400] as [number, number], label: [100, 400] as [number, number] }
test('line dragging changes only length and ignores vertical movement', () => {
  assert.deepEqual(moveAnnotation(part, 'length', [600, 700]), { point: [600, 400], label: [100, 400] })
})
test('icon dragging translates entire annotation without changing length', () => {
  assert.deepEqual(moveAnnotation(part, 'label', [200, 600]), { point: [600, 600], label: [200, 600] })
})
test('translation clamps both ends to image bounds while retaining length', () => {
  assert.deepEqual(moveAnnotation(part, 'label', [900, -30]), { point: [1000, 0], label: [600, 0] })
})
