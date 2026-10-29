import { describe,it,expect } from 'vitest';
import { createCoinGeometry } from './three-coin-geometry';

describe('one physical coin with two textured caps and shared walls',()=>{
 it('uses one square-hole contour through the full thickness',()=>{
  const {shape,geometry}=createCoinGeometry();
  expect(shape.holes).toHaveLength(1);
  const points=shape.holes[0].getPoints();
  expect(new Set(points.map(point=>point.x))).toEqual(new Set([-.21,.21]));
  expect(new Set(points.map(point=>point.y))).toEqual(new Set([-.21,.21]));
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.max.z-geometry.boundingBox!.min.z).toBeCloseTo(.224,5);
  geometry.dispose();
 });
 it('assigns each cap to its own material without a second coplanar face mesh',()=>{
  const {geometry}=createCoinGeometry();
  expect(new Set(geometry.groups.map(group=>group.materialIndex))).toEqual(new Set([0,1,2]));
  const normals=geometry.getAttribute('normal');
  for(const group of geometry.groups) {
   if(group.materialIndex===2)continue;
   for(let index=group.start;index<group.start+group.count;index++) {
    expect(normals.getZ(index)).toBe(group.materialIndex===0?1:-1);
   }
  }
  const coverage=geometry.groups.reduce((total,group)=>total+group.count,0);
  expect(coverage).toBe(geometry.getAttribute('position').count);
  geometry.dispose();
 });
});
