import assert from 'node:assert/strict'
import test from 'node:test'
import type { Basemap } from '../types.ts'
import { calibrateTemplate, createTemplate, moveTemplate } from './template.ts'

test('createTemplate centers an uploaded image and preserves alignment metadata', () => {
  const template = createTemplate({
    src: 'data:image/png;base64,abc',
    name: 'venue-plan.png',
    imageWidth: 1500,
    imageHeight: 1000,
    planWidthM: 30,
    planHeightM: 20,
  })

  assert.deepEqual(template, {
    src: 'data:image/png;base64,abc',
    name: 'venue-plan.png',
    widthM: 30,
    aspect: 1.5,
    x: 0,
    y: 0,
    rotation: 0,
    opacity: 0.72,
    locked: false,
  })
})

test('calibrateTemplate rescales around the template center', () => {
  const template: Basemap = {
    src: 'data:image/png;base64,abc',
    widthM: 20,
    aspect: 2,
    x: 5,
    y: 4,
    rotation: 0,
    opacity: 0.72,
  }

  assert.deepEqual(calibrateTemplate(template, 4, 6), {
    ...template,
    widthM: 30,
    x: 0,
    y: 1.5,
  })
})

test('calibrateTemplate rejects missing or invalid measurements', () => {
  const template: Basemap = {
    src: 'data:image/png;base64,abc',
    widthM: 20,
    aspect: 2,
    x: 5,
    y: 4,
    rotation: 0,
    opacity: 0.72,
  }

  assert.equal(calibrateTemplate(template, 0, 6), template)
  assert.equal(calibrateTemplate(template, 4, -1), template)
})

test('moveTemplate applies a precise drag delta unless the template is locked', () => {
  const template: Basemap = {
    src: 'data:image/png;base64,abc',
    widthM: 20,
    aspect: 2,
    x: 5,
    y: 4,
    rotation: 0,
    opacity: 0.72,
  }

  assert.deepEqual(moveTemplate(template, 1.2349, -2.3459), { ...template, x: 6.235, y: 1.654 })
  const locked = { ...template, locked: true }
  assert.equal(moveTemplate(locked, 3, 4), locked)
})
