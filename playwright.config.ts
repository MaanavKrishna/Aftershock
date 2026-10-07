import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e', timeout:90000, workers:1, fullyParallel:false,
 use:{baseURL:'http://127.0.0.1:3000',headless:true,trace:'retain-on-failure'},
 reporter:'list', projects:[{name:'chromium',use:{browserName:'chromium'}}]
});
