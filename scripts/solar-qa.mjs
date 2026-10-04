import assert from 'node:assert/strict';
import * as solar from '../source/solar.mjs';
const rad=Math.PI/180;

// Independent Meeus / NOAA apparent-Sun calculation. Reference:
// https://gml.noaa.gov/grad/solcalc/calcdetails.html
// https://gml.noaa.gov/grad/solcalc/main.js
function referenceSun(time){
  const t=(time/86400000+2440587.5-2451545)/36525;
  const longitude=280.46646+t*(36000.76983+.0003032*t);
  const anomaly=357.52911+t*(35999.05029-.0001537*t),m=anomaly*rad;
  const eccentricity=.016708634-t*(.000042037+.0000001267*t);
  const center=Math.sin(m)*(1.914602-t*(.004817+.000014*t))+Math.sin(2*m)*(.019993-.000101*t)+Math.sin(3*m)*.000289;
  const omega=(125.04-1934.136*t)*rad;
  const apparent=(longitude+center-.00569-.00478*Math.sin(omega))*rad;
  const obliquity=(23+(26+(21.448-t*(46.815+t*(.00059-.001813*t)))/60)/60+.00256*Math.cos(omega))*rad;
  const y=Math.tan(obliquity/2)**2,l=longitude*rad;
  const equation=(y*Math.sin(2*l)-2*eccentricity*Math.sin(m)+4*eccentricity*y*Math.sin(m)*Math.cos(2*l)-.5*y*y*Math.sin(4*l)-1.25*eccentricity**2*Math.sin(2*m))/rad*4;
  const utcMinutes=((time%86400000)+86400000)%86400000/60000;
  return {latitude:Math.asin(Math.sin(obliquity)*Math.sin(apparent))/rad,longitude:180-utcMinutes/4-equation/4};
}

let maximum=0,samples=0;
for(const day of ['2026-03-20','2026-06-21','2026-09-22','2026-12-21','2026-10-04'])for(let hour=0;hour<24;hour++){
  const time=Date.parse(day+'T00:00:00Z')+hour*3600000,a=solar.position(time,37.5665,126.978),b=referenceSun(time);
  const cosine=Math.sin(a.latitude*rad)*Math.sin(b.latitude*rad)+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.cos((a.longitude-b.longitude)*rad);
  const difference=Math.acos(Math.min(1,Math.max(-1,cosine)))/rad;
  assert.ok(difference<.02,`${day} ${hour}: solar-direction difference ${difference}°`);
  maximum=Math.max(maximum,difference);samples++;
}

const start=Date.parse('2026-10-03T15:00:00Z'),events=solar.events(start,37.5665,126.978);
for(const [kind,time] of Object.entries(events)){
  assert.ok(time>start&&time<start+86400000);
  assert.ok(Math.abs(solar.position(time,37.5665,126.978).elevation+.8333333333)<.0001);
  const before=solar.position(time-60000,37.5665,126.978).elevation,after=solar.position(time+60000,37.5665,126.978).elevation;
  assert.equal(after>before,kind==='sunrise');
}
assert.equal(solar.events(Date.parse('2026-06-21T00:00:00Z'),89,0).sunset,null);
assert.equal(solar.events(Date.parse('2026-12-21T00:00:00Z'),89,0).sunrise,null);
console.log(JSON.stringify({samples,maxSunDirectionDifferenceDegrees:maximum,eventCrossings:'passed',polarNoEventStates:'passed'},null,2));
