import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatSampleReport } from '../src/services/sampleReport'
const parts = [{ material: 'Metal', color: '银色', style: '珠链', description: 'Metal (bead chain)', descriptionZh: '金属（珠链）', point: [100, 100] as [number, number], label: [50, 100] as [number, number], confirmed: true }]
test('exports exact report format and selected language with matching numbers', () => {
  assert.equal(formatSampleReport(parts, 'en'), 'Tested part(s) description\n1 Metal (bead chain)')
  assert.equal(formatSampleReport(parts, 'zh'), '测试部件描述\n1 金属（珠链）')
  assert.equal(formatSampleReport([...parts, ...parts], 'en').split('\n')[2], '2 Metal (bead chain)')
})
