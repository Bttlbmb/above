
  const aboveCinematicSolar=(()=>{
    const rad=Math.PI/180,au=149597870.7;
    function position(time,latitude,longitude){
      const jd=time/86400000+2440587.5,n=jd-2451545,mean=(357.529+.98560028*n)*rad;
      const ecliptic=(280.459+.98564736*n+1.915*Math.sin(mean)+.020*Math.sin(2*mean))*rad,obliquity=(23.439-.00000036*n)*rad;
      const distance=1.00014-.01671*Math.cos(mean)-.00014*Math.cos(2*mean),x=distance*Math.cos(ecliptic),y=distance*Math.cos(obliquity)*Math.sin(ecliptic),z=distance*Math.sin(obliquity)*Math.sin(ecliptic);
      const t=n/36525,g=((-6.2e-6*t*t*t+.093104*t*t+((876600*3600)+8640184.812866)*t+67310.54841)*rad/240)%(2*Math.PI);
      const sx=(x*Math.cos(g)+y*Math.sin(g))*au,sy=(-x*Math.sin(g)+y*Math.cos(g))*au,sz=z*au;
      const phi=latitude*rad,lambda=longitude*rad,c=6378.137/Math.sqrt(1-.00669437999014*Math.sin(phi)**2);
      const rx=sx-c*Math.cos(phi)*Math.cos(lambda),ry=sy-c*Math.cos(phi)*Math.sin(lambda),rz=sz-c*(1-.00669437999014)*Math.sin(phi);
      const east=-Math.sin(lambda)*rx+Math.cos(lambda)*ry,north=-Math.sin(phi)*Math.cos(lambda)*rx-Math.sin(phi)*Math.sin(lambda)*ry+Math.cos(phi)*rz,up=Math.cos(phi)*Math.cos(lambda)*rx+Math.cos(phi)*Math.sin(lambda)*ry+Math.sin(phi)*rz;
      return {elevation:Math.atan2(up,Math.hypot(east,north))/rad,azimuth:(Math.atan2(east,north)/rad+360)%360,longitude:Math.atan2(sy,sx)/rad,latitude:Math.atan2(sz,Math.hypot(sx,sy))/rad};
    }
    function events(start,latitude,longitude){
      const found={sunrise:null,sunset:null};let previous=position(start,latitude,longitude).elevation+.8333333333;
      for(let offset=60000;offset<=86400000;offset+=60000){
        const time=start+offset,current=position(time,latitude,longitude).elevation+.8333333333;
        if((previous<0&&current>=0)||(previous>=0&&current<0)){
          let low=time-60000,high=time;const rising=current>previous;
          for(let i=0;i<16;i++){const mid=(low+high)/2,value=position(mid,latitude,longitude).elevation+.8333333333;if((value<0)===rising)low=mid;else high=mid;}
          found[rising?'sunrise':'sunset']=(low+high)/2;
        }
        previous=current;
      }
      return found;
    }
    return {position,events};
  })();
  
export const {position,events}=aboveCinematicSolar;
