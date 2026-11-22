const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { createApp } = require('../server/app');
const User = require('../server/models/User');
const { removeBackup } = require('../server/services/bookingJsonBackup');

test('consumer, walker and admin journeys over HTTP and MongoDB', {skip:!process.env.SNIFR_TEST_MONGO_URI}, async t => {
  const dbName = 'snifr_qa_' + randomUUID().replaceAll('-','');
  await mongoose.connect(process.env.SNIFR_TEST_MONGO_URI,{dbName});
  t.after(async () => { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const app = createApp();
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  function client() {
    let cookie = '';
    return async (path,method='GET',body,status=200) => {
      const res = await fetch(base+path,{method,redirect:'manual',headers:{cookie,'Content-Type':'application/json'},body:body && JSON.stringify(body)});
      cookie = res.headers.getSetCookie()[0]?.split(';')[0] || cookie;
      const raw = await res.text();
      assert.equal(res.status,status,method+' '+path+' '+raw.slice(0,220));
      return res.headers.get('content-type')?.includes('json') ? JSON.parse(raw) : res.headers.get('location') || raw;
    };
  }
  const admin=client(), owner=client(), stranger=client(), walker=client();
  const adminUser = new User({email:'admin@example.test',displayName:'Admin',role:'admin'});
  const password=randomUUID();
  await adminUser.setPassword(password); await adminUser.save();
  await admin('/api/accounts/login','POST',{email:adminUser.email,password});
  const register = (c,email,role) => c('/api/accounts/register','POST',{email,password,role},201).then(r => r.account);
  const consumer = await register(owner,'owner@example.test','owner');
  await register(stranger,'other@example.test','owner');
  const account = await register(walker,'walker@example.test','walker');
  assert.equal(await client()('/admin','GET',undefined,302),'/auth?mode=signin');
  assert.equal(await owner('/admin.html','GET',undefined,302),'/consumer-dashboard');
  assert.equal(await walker('/Dashboard.HTML','GET',undefined,302),'/walker-dashboard');
  await owner('/api/users','GET',undefined,403);
  await client()('/api/reviews','GET',undefined,401);
  await walker('/api/pets','GET',undefined,403);
  const user=(await admin('/api/users','POST',{email:'extra@example.test',displayName:'Extra',role:'consumer',password},201)).data;
  await admin('/api/users/'+user.id,'PATCH',{displayName:'Updated'});
  await admin('/api/users/'+user.id,'DELETE');
  assert.equal((await admin('/api/users')).data.some(u => 'passwordHash' in u || 'passwordSalt' in u),false);

  const profile={userId:account.id,name:'QA Walker',about:'Experienced walker offering friendly daily walks in the local neighbourhood.',
    experience:3,hourlyRate:250,services:['walking'],area:'City Centre',city:'Jaipur',pincode:'302001',image:'assets/walker.png',status:'published'};
  const w=(await admin('/api/walkers','POST',profile,201)).data;
  const wp='/api/walkers/'+w._id, days=wp+'/availability';
  await admin(wp,'PATCH',{hourlyRate:275});
  assert.ok((await owner('/api/walkers')).data.some(row => row._id === w._id));
  assert.equal((await walker('/api/dashboard/walker')).data.profile.profileComplete,true);
  const date=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
  const day=(await admin(days,'POST',{date,slots:[{startTime:'09:00',endTime:'10:00'}]},201)).data;
  await admin(days+'/'+day._id,'PATCH',{slots:[{startTime:'09:00',endTime:'11:00'}]});
  assert.equal((await walker('/api/dashboard/walker')).data.availability.length,1);
  const pet=(await owner('/api/pets','POST',{name:'Milo',breed:'Indie',age:2},201)).data, pp='/api/pets/'+pet._id;
  await stranger(pp,'GET',undefined,404); await stranger(pp,'PATCH',{age:6},404);
  await owner(pp,'PATCH',{age:3}); await owner(pp,'PATCH',{age:-1},400);
  const legacy={name:'Legacy',breed:'Corgi',age:2,importKey:'qa-idempotent'};
  const imported=(await owner('/api/pets','POST',legacy)).data;
  assert.equal((await owner('/api/pets','POST',legacy)).data._id,imported._id);
  await owner('/api/pets/'+imported._id,'DELETE');
  const details={walkerId:w._id,consumerId:consumer.id,petId:pet._id,petName:pet.name,date,time:'9:00 AM',durationMinutes:60};
  const b=(await owner('/api/bookings','POST',details,201)).data, bp='/api/bookings/'+b._id;
  t.after(() => removeBackup(b._id));
  assert.equal(b.rate,275);
  assert.equal((await walker('/api/bookings')).data.length,1);
  assert.equal((await stranger('/api/bookings')).data.length,0);
  await owner('/api/bookings','POST',details,409);
  await owner(pp,'DELETE',undefined,409);
  await owner(bp,'PATCH',{status:'completed'},403);
  await owner('/api/reviews','POST',{bookingId:b._id,rating:4.5},409);
  await walker(bp,'PATCH',{status:'accepted'}); await walker(bp,'PATCH',{status:'completed'});
  await stranger('/api/reviews','POST',{bookingId:b._id,rating:4.5},404);
  await owner('/api/reviews','POST',{bookingId:b._id,rating:4.2},400);
  const review=(await owner('/api/reviews','POST',{bookingId:b._id,rating:4.5,comment:'Great walk'},201)).data;
  const rp='/api/reviews/'+review._id;
  await owner('/api/reviews','POST',{bookingId:b._id,rating:5},409);
  async function rating(value,count) {
    const profile=(await owner(wp)).data;
    assert.equal(profile.rating,value); assert.equal(profile.reviewCount,count);
  }
  await rating(4.5,1); await stranger(rp,'DELETE',undefined,404);
  await owner(rp,'PATCH',{rating:5}); await rating(5,1);
  await admin(rp,'DELETE'); await rating(0,0);
  const second=(await admin(days,'POST',{date:new Date(Date.now()+6*86400000).toISOString().slice(0,10),
    slots:[{startTime:'09:00',endTime:'10:00'}]},201)).data;
  const secondBooking=(await admin('/api/bookings','POST',{...details,date:second.date},201)).data;
  t.after(() => removeBackup(secondBooking._id));
  await admin('/api/bookings/'+secondBooking._id,'PATCH',{status:'completed'});
  const pair=await Promise.all([owner('/api/reviews','POST',{bookingId:b._id,rating:3.5},201),
    admin('/api/reviews','POST',{bookingId:secondBooking._id,rating:5},201)]);
  await rating(4.25,2);
  await Promise.all(pair.map(r => admin('/api/reviews/'+r.data._id,'DELETE')));
  await rating(0,0);
  await admin('/api/bookings/'+secondBooking._id,'DELETE'); await admin(days+'/'+second._id,'DELETE');

  if (process.env.SNIFR_BROWSER_QA) {
    await require('./person5-browser')(base,{password,consumer,account,profile:w,booking:b});
  }
  await admin(bp,'DELETE');
  await admin(days+'/'+day._id,'DELETE'); await admin(wp,'DELETE'); await owner(pp,'DELETE');
  await owner('/api/dashboard/logout','POST'); await owner('/api/pets','GET',undefined,401);
  await owner('/missing-page','GET',undefined,404);
});
