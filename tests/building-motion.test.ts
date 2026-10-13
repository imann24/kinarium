import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/simulation/engine';
import { cabinFloor, ELEVATOR_PAUSE_MS, ELEVATOR_TRAVEL_MS, planBuildingMotion, residentPosition } from '../src/client/building-motion';

function fixture() {
  const world = createWorld({ slug: 'motion', name: 'Motion', populationCap: 1 }, 0, 42);
  const c = world.characters[0]; c.floor = 0; c.destination = 1; c.inElevator = true;
  return { world, c };
}
describe('elevator presentation', () => {
  it('keeps passengers exactly on the cabin throughout eased travel', () => {
    const {world,c} = fixture(); let motion = planBuildingMotion(undefined,world,0);
    world.minute += 2; world.elevatorFloor = c.floor = 1;
    motion = planBuildingMotion(motion,world,100);
    const times = [100,101,500,1500,2700,2900];
    for (const time of times) {
      expect(residentPosition(motion,c.id,time)).toEqual({x:757,floor:cabinFloor(motion,time),aboard:true});
    }
    expect(cabinFloor(motion,101)).toBeLessThan(.00001);
    expect(cabinFloor(motion,1500)).toBeCloseTo(.5);
    expect(cabinFloor(motion,2900)).toBe(1);
  });
  it('holds an early exit snapshot in the cabin until arrival plus a pause', () => {
    const {world,c} = fixture(); let motion = planBuildingMotion(undefined,world,0);
    world.minute += 2; world.elevatorFloor = c.floor = 1;
    motion = planBuildingMotion(motion,world,100);
    c.inElevator = false; c.x = 84; world.minute += 2;
    motion = planBuildingMotion(motion,world,900);
    const exitAt = 100 + ELEVATOR_TRAVEL_MS + ELEVATOR_PAUSE_MS;
    for (const time of [900,2000,2900,exitAt-1]) {
      const p = residentPosition(motion,c.id,time);
      expect(p.x).toBe(757); expect(p.floor).toBe(cabinFloor(motion,time)); expect(p.aboard).toBe(true);
    }
    expect(residentPosition(motion,c.id,exitAt+350)).toEqual({x:(757+135+84*5.85)/2,floor:1,aboard:false});
    expect(residentPosition(motion,c.id,exitAt+700).x).toBeCloseTo(135+84*5.85);
  });
  it('does not restart travel or exit timers for duplicate snapshots', () => {
    const {world,c} = fixture(); let motion = planBuildingMotion(undefined,world,0);
    world.minute += 2; world.elevatorFloor = c.floor = 1;
    motion = planBuildingMotion(motion,world,100);
    const repeated = planBuildingMotion(motion,structuredClone(world),900);
    expect(repeated.cabin).toBe(motion.cabin); expect(repeated.residents[c.id]).toBe(motion.residents[c.id]);
    c.inElevator = false; c.x = 84;
    motion = planBuildingMotion(repeated,world,1000);
    expect(planBuildingMotion(motion,world,2000).residents[c.id].exitAt).toBe(motion.residents[c.id].exitAt);
  });
  it('boards on the landing before the next departure, and exits horizontally after a normal stop', () => {
    const {world,c} = fixture(); c.inElevator = false; c.x = 94;
    let motion = planBuildingMotion(undefined,world,0); c.inElevator = true;
    motion = planBuildingMotion(motion,world,100);
    expect(residentPosition(motion,c.id,800)).toEqual({x:757,floor:0,aboard:true});
    world.minute += 2; world.elevatorFloor = c.floor = 1;
    motion = planBuildingMotion(motion,world,4100);
    world.minute += 2; c.inElevator = false; c.x = 84;
    motion = planBuildingMotion(motion,world,8100);
    expect(residentPosition(motion,c.id,8450).floor).toBe(1);
    expect(cabinFloor(motion,8450)).toBe(1);
    expect(residentPosition(motion,c.id,8800).x).toBeCloseTo(135+84*5.85);
  });
  it('reconciles catch-up, new worlds, and reduced motion immediately', () => {
    const {world,c} = fixture(); const initial = planBuildingMotion(undefined,world,0);
    c.floor = 2; c.inElevator = false; c.x = 60; world.elevatorFloor = 2;
    for (const updated of [{...world,minute:world.minute+20},{...world,slug:'other'}]) {
      const motion = planBuildingMotion(initial,updated,100);
      expect(residentPosition(motion,c.id,100)).toEqual({x:486,floor:2,aboard:false});
      expect(cabinFloor(motion,100)).toBe(2);
    }
    const reduced = planBuildingMotion(initial,world,100,true);
    expect(cabinFloor(reduced,100)).toBe(2);
    expect(residentPosition(reduced,c.id,100).x).toBe(486);
  });
});
