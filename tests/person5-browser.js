// Optional end-to-end UI checks, run by person5.test.js against its disposable fixtures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

module.exports = async function browserChecks(base,{password}) {
  for (const [channel,width] of [['chrome',1280],['msedge',375]]) {
    const browser = await chromium.launch({channel,headless:true});
    try {
      const context = await browser.newContext({viewport:{width,height:850}});
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      page.on('dialog',dialog => dialog.accept());
      async function login(email,slug) {
        await page.goto(base+'/auth?mode=signin',{waitUntil:'domcontentloaded'});
        await page.locator('#auth-email').fill(email+'@example.test');
        await page.locator('#auth-password').fill(password);
        await page.locator('#auth-form .submit').click();
        await page.waitForURL('**/'+slug,{waitUntil:'domcontentloaded'});
        await page.locator('#greeting').filter({hasText:'Signed in'}).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
      async function save() {
        await page.locator('#save').click();
        await page.locator('#editor').waitFor({state:'hidden'});
      }
      await login('owner','consumer-dashboard');
      await page.locator('#add-pet').click();
      await page.getByLabel('Pet name',{exact:true}).fill('Browser pet');
      await page.getByLabel('Breed',{exact:true}).fill('Indie');
      await page.getByLabel('Age in years').fill('2');
      await save();
      const pet = page.locator('#pets article').filter({hasText:'Browser pet'});
      await pet.getByRole('button',{name:'Edit'}).click();
      await page.getByLabel('Age in years').fill('3'); await save();
      await pet.getByText(/3 years/).waitFor();
      await pet.getByRole('button',{name:'Delete'}).click(); await pet.waitFor({state:'hidden'});

      await page.getByRole('button',{name:'Write a review'}).click();
      await page.getByLabel('Rating').fill('4.2');
      assert.equal(await page.locator('[name="rating"]').evaluate(e => e.validity.stepMismatch),true);
      await page.getByLabel('Rating').fill('4.5'); await save();
      const review = page.locator('#reviews article');
      await review.getByRole('button',{name:'Edit'}).click();
      await page.getByLabel('Rating').fill('3.5'); await save();
      await review.getByText('3.5 / 5 stars').waitFor();
      await review.getByRole('button',{name:'Delete'}).click();
      await page.locator('#reviews').getByText(/after a completed walk/).waitFor();
      await page.route('**/api/pets',route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Database temporarily unavailable.'})}));
      await page.reload({waitUntil:'domcontentloaded'});
      await page.locator('#pets').getByText('Database temporarily unavailable.').waitFor();
      await page.unroute('**/api/pets'); await page.locator('#pets').getByRole('button',{name:'Retry'}).click();
      await page.locator('#pets').getByText('Milo',{exact:true}).waitFor();

      await login('walker','walker-dashboard');
      await page.locator('#profile').getByText(/Complete · published/).waitFor();
      await page.locator('#summary').getByText(/1 completed/).waitFor();
      await page.locator('#requests').getByText('No pending requests.').waitFor();
      await page.goto(base+'/walker-availability',{waitUntil:'domcontentloaded'});
      await page.locator('#saved-date-list button').first().waitFor();

      if (channel === 'chrome') {
        await page.goto(base+'/auth?role=walker',{waitUntil:'domcontentloaded'});
        await page.locator('#auth-email').fill('newwalker@example.test');
        await page.locator('#auth-password').fill(password); await page.locator('#auth-form .submit').click();
        await page.waitForURL('**/walker-onboarding',{waitUntil:'domcontentloaded'});
        await page.locator('#name').fill('Evaluation Walker'); await page.locator('#experience').fill('2');
        await page.locator('#about').fill('I walk dogs every day and enjoy providing patient neighbourhood walks.');
        await page.locator('#next-step').click(); await page.locator('[value="walking"]').check();
        await page.locator('#hourlyRate').fill('200'); await page.locator('#next-step').click();
        await page.locator('#area').fill('Central'); await page.locator('#city').fill('Jaipur'); await page.locator('#pincode').fill('302001');
        await page.locator('#profile-image').setInputFiles(require('node:path').join(__dirname,'../assets/snifr-logo.png'));
        await page.locator('#photo-preview:not([hidden])').waitFor();
        await page.locator('#next-step').click(); await page.locator('#next-step').click();
        await page.waitForURL('**/walker-dashboard',{waitUntil:'domcontentloaded'});
        await page.getByRole('link',{name:'Availability',exact:true}).click();
        const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
        await page.locator('#availability-date').fill(date); await page.locator('#add-date-form button').click();
        await page.locator('#start-time').fill('10:00'); await page.locator('#end-time').fill('11:00'); await page.locator('#save-slot').click();
        await page.locator('#slot-list').getByText(/10:00 AM/).waitFor();
        await login('owner','consumer-dashboard');
        await page.locator('#walkers article').filter({hasText:'Evaluation Walker'}).getByRole('link').click();
        await page.locator('#pet-select').selectOption({label:'Milo'});
        await page.locator('.days button').first().click(); await page.locator('.times button').first().click();
        await page.locator('#booking-form [type=submit]').click(); await page.locator('#submit-booking').click();
        await page.waitForURL('**/my-bookings',{waitUntil:'domcontentloaded'});
        await login('newwalker','walker-dashboard');
        await page.locator('#requests').getByRole('button',{name:'Accept'}).click();
        await page.locator('#upcoming').getByRole('button',{name:'Mark completed'}).click();
        await page.locator('#summary').getByText(/1 completed/).waitFor();
        await login('admin','admin');
        await page.locator('#tabs').getByRole('button',{name:'Bookings',exact:true}).click();
        const created=page.locator('#records article').filter({hasText:'Evaluation Walker'});
        await created.getByRole('button',{name:'Delete'}).click(); await created.waitFor({state:'hidden'});
      }
      await login('admin','admin');
      for (const name of ['Users','Walkers','Availability','Bookings','Pets','Reviews']) {
        await page.locator('#tabs').getByRole('button',{name,exact:true}).click();
        await page.waitForFunction(() => !document.getElementById('add').disabled);
        await page.locator('#add').click(); await page.locator('#editor[open]').waitFor();
        assert.ok(await page.locator('#fields label').count() > 0);
        await page.locator('#close').click();
      }
      await page.locator('#tabs').getByRole('button',{name:'Users'}).click();
      await page.locator('#add').click();
      await page.getByLabel('Display name').fill('Browser account');
      await page.getByLabel('Email',{exact:true}).fill('browser@example.test');
      await page.getByLabel('Account type').selectOption('consumer'); await page.getByLabel('Password',{exact:true}).fill(password);
      await save();
      const account = page.locator('#records article').filter({hasText:'browser@example.test'});
      await account.getByRole('button',{name:'Edit'}).click();
      await page.getByLabel('Display name').fill('Renamed account'); await save();
      await account.getByText(/Renamed account/).waitFor();
      await account.getByRole('button',{name:'Delete'}).click(); await account.waitFor({state:'hidden'});
      if (channel === 'chrome') {
        async function tab(name) {
          await page.locator('#tabs').getByRole('button',{name,exact:true}).click();
          await page.waitForFunction(() => !document.getElementById('add').disabled);
        }
        async function form(name,values,existing) {
          await tab(name);
          if (existing) await page.locator('#records article').filter({hasText:existing}).getByRole('button',{name:'Edit'}).click();
          else await page.locator('#add').click();
          for (const [key,value] of Object.entries(values)) {
            const control=page.locator('#fields [name="'+key+'"]');
            if (await control.evaluate(e => e.tagName === 'SELECT')) {
              const option = await control.locator('option').filter({hasText:value}).last().getAttribute('value');
              await control.selectOption(option);
            } else await control.fill(value);
          }
          await save();
        }
        async function erase(name,description) {
          await tab(name);
          const record=page.locator('#records article').filter({hasText:description});
          await record.getByRole('button',{name:'Delete'}).click(); await record.waitFor({state:'hidden'});
        }
        await form('Users',{displayName:'Admin demo walker',email:'demo.walker@example.test',role:'walker',password});
        await form('Walkers',{userId:'demo.walker@example.test',name:'Admin demo walker',about:'I provide attentive and dependable dog walking throughout the Jaipur area.',
          experience:'3',hourlyRate:'290',services:'walking',area:'Central',city:'Jaipur',pincode:'302001',status:'published'});
        await form('Walkers',{hourlyRate:'300'},'Admin demo walker');
        await tab('Availability');
        const walkerOption=page.locator('#parent option').filter({hasText:'Admin demo walker'});
        await page.locator('#parent select').selectOption(await walkerOption.getAttribute('value'));
        const date=new Date(Date.now()+9*86400000).toISOString().slice(0,10);
        await form('Availability',{date,slots:'09:00–10:00'}); await form('Availability',{slots:'09:00–11:00'},date);
        await form('Pets',{consumerId:'owner@example.test',name:'Admin demo pet',breed:'Indie',age:'2'});
        await form('Pets',{age:'3'},'Admin demo pet');
        await form('Bookings',{petId:'Admin demo pet',walkerId:'Admin demo walker',date,time:'9:00 AM',durationMinutes:'60'});
        await form('Bookings',{status:'completed'},'Admin demo pet');
        await form('Reviews',{bookingId:'Admin demo pet',rating:'4.5',comment:'Admin demo review'});
        await form('Reviews',{rating:'4'},'Admin demo review');
        await erase('Reviews','Admin demo review'); await erase('Bookings','Admin demo pet');
        await erase('Pets','Admin demo pet'); await erase('Availability',date);
        await erase('Walkers','Admin demo walker'); await erase('Users','demo.walker@example.test');
      }
      await page.locator('#logout').click(); await page.waitForURL('**/auth?mode=signin',{waitUntil:'domcontentloaded'});
      assert.deepEqual(errors,[]);
      console.log(channel+' browser flows passed at '+width+'px');
    } finally { await browser.close(); }
  }
};
