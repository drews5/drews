import test from 'node:test';
import assert from 'node:assert/strict';
import {draftChanges,mergeDraft,resetToLive} from '../public/rewrite/admin/draft-control.js';

test('review reports exactly what areas changed and a page reset leaves unrelated draft changes alone',()=>{
 const published={pages:{'/team':{heading:'Live'},'/impact':{heading:'Live'}},collections:{'/team':{layout:{order:['old']}}},teamRoster:{records:{old:{}}},shared:{title:'Live'},values:{}};
 const draft={...published,pages:{'/team':{heading:'Draft'},'/impact':{heading:'Draft'}},collections:{'/team':{layout:{order:['new']}},'/impact':{updates:{records:{new:{}}}}},teamRoster:{records:{new:{}}},shared:{title:'Draft'}};
 assert.deepEqual(draftChanges(draft,published),[
  {route:'/impact',details:['Text, links or photos','Page updates']},
  {route:'/team',details:['Text, links or photos','Section order','Team roster']},
  {route:null,details:['Header or footer']},
 ]);
 const restored=resetToLive(draft,published,'/team');
 assert.deepEqual(restored.teamRoster,published.teamRoster);
 assert.deepEqual(restored.pages['/team'],published.pages['/team']);
 assert.deepEqual(restored.collections['/team'],published.collections['/team']);
 assert.deepEqual(restored.collections['/impact'],draft.collections['/impact']);
 assert.deepEqual(restored.shared,draft.shared);
});

test('simultaneous edits to different fields merge, while editing or deleting the same profile conflicts',()=>{
 const base={teamRoster:{records:{a:{name:'A',role:'Volunteer'}}},pages:{}};
 const own={...base,teamRoster:{records:{a:{name:'A',role:'Director'}}}};
 const remote={...base,teamRoster:{records:{a:{name:'Alex',role:'Volunteer'}}},pages:{'/about':{x:{text:'About update'}}}};
 const combined=mergeDraft(base,own,remote);
 assert.deepEqual(combined.conflicts,[]);
 assert.deepEqual(combined.document.teamRoster.records.a,{name:'Alex',role:'Director'});
 assert.deepEqual(combined.document.pages,remote.pages);
 assert.deepEqual(mergeDraft(base,own,{...base,teamRoster:{records:{}}}).conflicts,[['teamRoster','records','a']]);
});
