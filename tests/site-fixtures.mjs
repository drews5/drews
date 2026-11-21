import {join,resolve} from 'node:path';

const root=process.env.RWIP_TEST_BUILD_ROOT||resolve(import.meta.dirname,'..');
export const siteFixture=path=>join(root,'_site','rewrite',path);
