import {spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const cwd=resolve(import.meta.dirname,'..');
const fixtureRoot=await mkdtemp(join(tmpdir(),'rwip-tests-'));
const env={...process.env,RWIP_TEST_BUILD_ROOT:fixtureRoot};

try{
 const build=spawnSync(process.execPath,['scripts/build.mjs'],{
  cwd,env:{...env,SKIP_LIVE_CONTENT:'1'},stdio:'inherit',
 });
 if(build.error)throw build.error;
 process.exitCode=build.status??1;
 if(process.exitCode===0){
  const tests=spawnSync(process.execPath,['--test',...process.argv.slice(2),'tests/*.test.mjs'],{
   cwd,env,stdio:'inherit',
  });
  if(tests.error)throw tests.error;
  process.exitCode=tests.status??1;
 }
}finally{
 await rm(fixtureRoot,{recursive:true,force:true});
}
