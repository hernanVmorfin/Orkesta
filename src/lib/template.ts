import type { Basemap } from '../types'

export interface TemplateImage {
  src: string
  name: string
  imageWidth: number
  imageHeight: number
  planWidthM: number
  planHeightM: number
}

export function createTemplate(input: TemplateImage): Basemap {
  const aspect = input.imageWidth / input.imageHeight
  const widthM = Math.min(input.planWidthM, input.planHeightM * aspect)
  const heightM = widthM / aspect
  return {
    src: input.src,
    name: input.name,
    widthM: +widthM.toFixed(3),
    aspect,
    x: +((input.planWidthM - widthM) / 2).toFixed(3),
    y: +((input.planHeightM - heightM) / 2).toFixed(3),
    rotation: 0,
    opacity: 0.72,
    locked: false,
  }
}

export function calibrateTemplate(template: Basemap, measuredM: number, knownM: number): Basemap {
  if (measuredM <= 0 || knownM <= 0) return template
  const factor = knownM / measuredM
  const oldHeight = template.widthM / template.aspect
  const widthM = template.widthM * factor
  const heightM = widthM / template.aspect
  return {
    ...template,
    widthM: +widthM.toFixed(3),
    x: +(template.x + (template.widthM - widthM) / 2).toFixed(3),
    y: +(template.y + (oldHeight - heightM) / 2).toFixed(3),
  }
}

export function moveTemplate(template: Basemap, dx: number, dy: number): Basemap {
  if (template.locked) return template
  return { ...template, x: +(template.x + dx).toFixed(3), y: +(template.y + dy).toFixed(3) }
}
