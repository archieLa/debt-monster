/* Geometry for a visual replay; never used to change the ledger. */
(function(root){
  function layout(points){
    const source=points.length?points:[{date:'Starting balance',balance_cents:0}];
    if(source.some(point=>!Number.isSafeInteger(point.balance_cents)))throw Error('Invalid journey balance.');
    const values=source.map(point=>point.balance_cents);
    let low=Math.min(...values),high=Math.max(...values);
    if(low===high){low-=100;high+=100;}
    const padding=(high-low)*.16;low-=padding;high+=padding;
    let length=0;
    const nodes=source.map((point,index)=>{
      const x=85+index*550/Math.max(source.length-1,1),y=80+(high-point.balance_cents)/(high-low)*160;
      return {...point,x,y};
    });
    nodes.forEach((point,index)=>{if(index)length+=Math.hypot(point.x-nodes[index-1].x,point.y-nodes[index-1].y);point.distance=length;});
    return {nodes,low,high,length,path:nodes.map((point,index)=>(index?'L':'M')+point.x+','+point.y).join(' ')};
  }
  function sample(graph,progress){
    const p=Math.max(0,Math.min(1,progress));
    if(graph.nodes.length===1)return {...graph.nodes[0],index:0,t:1,delta:0,revealed:1};
    const position=p*(graph.nodes.length-1),index=Math.min(graph.nodes.length-2,Math.floor(position)),t=position-index;
    const a=graph.nodes[index],b=graph.nodes[index+1];
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,balance_cents:Math.round(a.balance_cents+(b.balance_cents-a.balance_cents)*t),index:index+1,t,delta:b.balance_cents-a.balance_cents,revealed:graph.length?(a.distance+(b.distance-a.distance)*t)/graph.length:1};
  }
  function reaction(mode,delta){
    if(!delta)return 'idle';
    if(mode==='savings')return delta>0?'watering':'harvesting';
    return delta<0?'munching':'climbing';
  }
  function gardenStages(points,goal){
    const awarded=new Set();
    return points.map((point,index)=>{
      const delta=index?point.balance_cents-points[index-1].balance_cents:point.balance_cents;
      let blooms=0;
      if(goal>0)for(const threshold of [10,25,50,75,90,100]){
        if(point.balance_cents*100>=goal*threshold&&!awarded.has(threshold)){awarded.add(threshold);blooms++;}
      }
      return {grow:delta>0,blooms};
    });
  }
  const api={layout,sample,reaction,gardenStages};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.DebtJourney=api;
})(typeof window!=='undefined'?window:this);
