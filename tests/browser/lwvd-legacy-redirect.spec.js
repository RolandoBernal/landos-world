import {test,expect} from '@playwright/test';
// Safeguard 3 for the in-shell restructure (PR 2): the legacy standalone
// URL must keep working as a redirect into the shell route, and the
// redirect must not trap history. (The offline leg is covered where a
// real deployed service worker runs: pwa-real-service-worker.spec.js
// navigates to this URL with the network unavailable.)
const key='lando-world:lwvd:v1';
const seed={firstName:'Violet',balanceCents:10000,payday:'',frequency:'',onboarded:true};
async function startSeeded(page){
 await page.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('landos_world_appearance_preference_v1','light');},{key,seed});
}

test('legacy standalone URL replaces itself with the shell route',async({page})=>{
 await startSeeded(page);
 await page.goto('/violet-dineros/index.html');
 await expect(page).toHaveURL(/\/index\.html#\/violet-dineros$/);
 await expect(page.getByRole('heading',{name:'Hey, Violet!'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.LandoLWVD?.isActive())).toBe(true);
});

test('the redirect does not trap the back button',async({page})=>{
 await startSeeded(page);
 await page.goto('/#/');
 await expect(page.locator('#lando-home-view')).toBeVisible();
 await page.goto('/violet-dineros/index.html');
 await expect(page).toHaveURL(/#\/violet-dineros$/);
 await expect(page.getByRole('heading',{name:'Hey, Violet!'})).toBeVisible();
 await page.goBack();
 await expect(page).not.toHaveURL(/violet-dineros\/index\.html/);
 await expect(page.locator('#lando-home-view')).toBeVisible();
 await expect(page.locator('#violet-dineros-view')).toBeHidden();
});
