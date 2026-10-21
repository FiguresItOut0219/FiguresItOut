import type { Part } from './sampleAnalysis'
export function moveAnnotation(part: Pick<Part, 'point' | 'label'>, kind: 'point' | 'label' | 'length', value: [number, number]): Pick<Part, 'point' | 'label'> {
  const clamp = (n: number) => Math.max(0, Math.min(1000, n))
  if (kind === 'point') return { point: [clamp(value[0]), clamp(value[1])], label: [part.label[0], clamp(value[1])] }
  if (kind === 'length') return { point: [clamp(value[0]), part.point[1]], label: [part.label[0], part.point[1]] }
  const dx = Math.max(-Math.min(part.point[0], part.label[0]), Math.min(1000 - Math.max(part.point[0], part.label[0]), value[0] - part.label[0]))
  const y = clamp(value[1])
  return { point: [part.point[0] + dx, y], label: [part.label[0] + dx, y] }
}
