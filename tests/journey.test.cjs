const {test}=require('node:test');
const assert=require('node:assert/strict');
const {layout,sample}=require('../debtmonster/static/journey.js');
const points=values=>values.map((value,index)=>({id:index,date:String(index),balance_cents:value}));
test('payments descend visually and charges climb without hiding increases',()=>{
  const graph=layout(points([1800000,1500000,1600000,1000000]));
  assert.ok(graph.nodes[1].y>graph.nodes[0].y);
  assert.ok(graph.nodes[2].y<graph.nodes[1].y);
  assert.ok(graph.nodes[3].y>graph.nodes[2].y);
  assert.equal(sample(graph,.5).balance_cents,1550000);
  assert.equal(sample(graph,.5).delta,100000);
});
test('replay starts and finishes at exact recorded balances',()=>{
  const graph=layout(points([10000,8000,9000,-3000]));
  assert.equal(sample(graph,0).balance_cents,10000);
  assert.equal(sample(graph,1).balance_cents,-3000);
  assert.equal(sample(graph,1).revealed,1);
  assert.equal(sample(graph,-1).revealed,0);
  assert.equal(sample(graph,2).balance_cents,-3000);
});
test('clicking each point selects its exact ledger value',()=>{
  const graph=layout(points([10000,9000,11000,7000]));
  graph.nodes.forEach((point,index)=>assert.equal(sample(graph,index/3).balance_cents,point.balance_cents));
});
test('empty and single-point histories are finite',()=>{
  for(const values of [[],[0],[50000]]){
    const graph=layout(points(values));
    assert.ok(Number.isFinite(sample(graph,1).y));
    assert.equal(sample(graph,1).balance_cents,values[0]||0);
  }
});
test('flat histories, negative savings, and credits remain visible',()=>{
  for(const values of [[0,0,0],[-10000,-5000,-8000],[5000,-2000]]){
    const graph=layout(points(values));
    assert.ok(graph.nodes.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)));
    assert.equal(sample(graph,1).balance_cents,values.at(-1));
  }
});
test('geometry never mutates the source ledger points',()=>{
  const source=points([10000,5000]);const before=JSON.stringify(source);
  sample(layout(source),.5);
  assert.equal(JSON.stringify(source),before);
  assert.throws(()=>layout([{balance_cents:NaN}]));
});

test('savings deposits water and withdrawals harvest; neither chomps or sweats',()=>{
  const {reaction}=require('../debtmonster/static/journey.js');
  assert.equal(reaction('savings',50000),'watering');
  assert.equal(reaction('savings',-10000),'harvesting');
  assert.equal(reaction('savings',0),'idle');
  assert.equal(reaction('debt',-50000),'munching');
  assert.equal(reaction('debt',10000),'climbing');
});
test('goal flowers grow at first crossings and do not bloom repeatedly after withdrawals',()=>{
  const {gardenStages}=require('../debtmonster/static/journey.js');
  const stages=gardenStages(points([0,10000,25000,10000,25000,100000]),100000);
  assert.deepEqual(stages.map(stage=>stage.blooms),[0,1,1,0,0,4]);
  assert.equal(stages[3].grow,false);
});
test('a garden without a goal still sprouts on deposits including recovery from negative savings',()=>{
  const {gardenStages}=require('../debtmonster/static/journey.js');
  assert.deepEqual(gardenStages(points([-5000,0,10000,8000]),null),[{grow:false,blooms:0},{grow:true,blooms:0},{grow:true,blooms:0},{grow:false,blooms:0}]);
});
