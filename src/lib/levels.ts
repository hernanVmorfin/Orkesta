import type { Basemap, Level, Plan, PlanElement } from '../types'

/**
 * Levels (floors or rooms). A plan without `levels` has one implicit level. Once a second level is
 * added, every element carries its level's id, so reordering levels never moves objects between them.
 * The first level created ('base') always uses the venue's own footprint and drawing.
 */

export const BASE_LEVEL = 'base'

export const levelsOf = (plan: Plan): Level[] => plan.levels?.length ? plan.levels : [{ id: BASE_LEVEL, name: 'Level 1' }]

/** The level being shown: the stored choice if it still exists, else the first. */
export function activeLevel(plan: Plan, levelId: string | null) {
  const levels = levelsOf(plan)
  return levels.find((l) => l.id === levelId) ?? levels[0]
}

/** Level id to stamp on new elements (none while the plan has a single level). */
export const currentLevel = (plan: Plan, levelId: string | null) => (plan.levels?.length ? activeLevel(plan, levelId).id : undefined)

export const onLevel = (e: PlanElement, levelId: string) => (e.levelId ?? BASE_LEVEL) === levelId

/** Objects drawn on the plan: on the shown level, in a visible layer and folder, and not hidden. */
export function visibleOnLevel(plan: Plan, levelId: string | null) {
  const lv = activeLevel(plan, levelId).id
  const hiddenGroups = new Set((plan.groups ?? []).filter((g) => !g.visible).map((g) => g.id))
  return plan.elements.filter((e) => onLevel(e, lv) && plan.layers[e.layer]?.visible !== false && !e.hidden && !(e.groupId && hiddenGroups.has(e.groupId)))
}

/** Locked on its own, by its layer, or by its folder. */
export const isLockedEl = (plan: Plan, e: PlanElement) =>
  !!e.locked || !!plan.layers[e.layer]?.locked || (!!e.groupId && !!plan.groups?.find((g) => g.id === e.groupId)?.locked)

/** Every unlocked object on the shown level (Select all). */
export const selectableIds = (plan: Plan, levelId: string | null) =>
  visibleOnLevel(plan, levelId).filter((e) => !isLockedEl(plan, e)).map((e) => e.id)

/** Footprint and drawing of a level, falling back to the venue's. */
export function venueOf(plan: Plan, levelId: string | null): { widthM: number; heightM: number; basemap?: Basemap } {
  const l = activeLevel(plan, levelId)
  if (l.id === BASE_LEVEL) return { widthM: plan.widthM, heightM: plan.heightM, basemap: plan.basemap }
  return { widthM: l.widthM ?? plan.widthM, heightM: l.heightM ?? plan.heightM, basemap: l.basemap }
}

/** Writes footprint/drawing changes to the venue (first level) or the level's own overrides. */
export function setVenue(plan: Plan, levelId: string | null, patch: { widthM?: number; heightM?: number; basemap?: Basemap | undefined }): Plan {
  const l = activeLevel(plan, levelId)
  if (l.id === BASE_LEVEL) return { ...plan, ...patch }
  return { ...plan, levels: levelsOf(plan).map((x) => (x.id === l.id ? { ...x, ...patch } : x)) }
}
