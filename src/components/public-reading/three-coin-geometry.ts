import {ExtrudeGeometry,Path,Shape} from 'three';

export function createCoinGeometry() {
  const shape=new Shape();shape.absarc(0,0,1,0,Math.PI*2,false);
  const hole=new Path();
  hole.moveTo(-.21,-.21);hole.lineTo(-.21,.21);hole.lineTo(.21,.21);hole.lineTo(.21,-.21);hole.closePath();
  shape.holes.push(hole);
  const geometry=new ExtrudeGeometry(shape,{depth:.20,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.012,bevelThickness:.012,curveSegments:192});
  geometry.translate(0,0,-.10);
  const caps=geometry.groups.find(group=>group.materialIndex===0);
  const walls=geometry.groups.find(group=>group.materialIndex===1);
  if(!caps||!walls||caps.count%2!==0)throw new Error('RITUAL_COIN_GEOMETRY_GROUPS_INVALID');
  const normals=geometry.getAttribute('normal');
  const positions=geometry.getAttribute('position');
  const uv=geometry.getAttribute('uv');
  geometry.clearGroups();
  let runStart=caps.start;
  let runMaterial=normals.getZ(runStart)>0?0:1;
  for(let index=caps.start;index<caps.start+caps.count;index++) {
    const material=normals.getZ(index)>0?0:1;
    if(material!==runMaterial) {
      geometry.addGroup(runStart,index-runStart,runMaterial);runStart=index;runMaterial=material;
    }
    uv.setXY(index,.5+positions.getX(index)*.425,.5+positions.getY(index)*.425*(material===0?1:-1));
  }
  geometry.addGroup(runStart,caps.start+caps.count-runStart,runMaterial);
  geometry.addGroup(walls.start,walls.count,2);
  // Reuse only the approved master's worn bronze rim on the physical outer/inner walls.
  for(let index=walls.start;index<walls.start+walls.count;index++) {
    const angle=Math.atan2(positions.getY(index),positions.getX(index));
    const depth=(positions.getZ(index)+.112)/.224;
    const radius=.425*(.90+.085*depth);
    uv.setXY(index,.5+Math.cos(angle)*radius,.5+Math.sin(angle)*radius);
  }
  uv.needsUpdate=true;
  return {shape,geometry};
}
