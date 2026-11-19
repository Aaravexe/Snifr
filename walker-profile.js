/* Shared frontend draft storage and form helpers. Replace the store with the
   authenticated Walker API when that backend is implemented. */
window.WalkerProfile = (() => {
  const services = { walking: 'Dog walking', sitting: 'Pet sitting', 'drop-in': 'Drop-in visits' };
  const fields = ['name', 'about', 'experience', 'hourlyRate', 'area', 'city', 'pincode'];
  const empty = () => ({ name: '', about: '', experience: '', hourlyRate: '', services: [], area: '', city: '', pincode: '', image: '' });

  function session() {
    try {
      const account = JSON.parse(localStorage.getItem('snifrSession'));
      return account?.id && account.role === 'walker' ? account : null;
    } catch { return null; }
  }

  function key(account) { return `snifrWalkerDraft:v1:${account.id}`; }

  function clean(value = {}) {
    const profile = empty();
    fields.forEach(field => { profile[field] = typeof value[field] === 'string' || typeof value[field] === 'number' ? String(value[field]) : ''; });
    profile.services = Array.isArray(value.services) ? [...new Set(value.services.filter(item => Object.hasOwn(services, item)))] : [];
    if (typeof value.image === 'string' && (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image) || /^assets\/[\w-]+\.(png|jpg|jpeg|webp)$/.test(value.image))) profile.image = value.image;
    return profile;
  }

  function load(account) {
    const raw = localStorage.getItem(key(account));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !data.profile || typeof data.profile !== 'object') throw new Error('The saved draft could not be read. Your stored data has not been changed.');
    return { ...data, profile: clean(data.profile), step: Math.max(0, Math.min(3, Math.floor(Number(data.step)) || 0)) };
  }

  function save(account, profile, completed, step = 0) {
    if (session()?.id !== account.id) throw new Error('Your sign-in changed. Sign in to this walker account again before saving.');
    const data = { version: 1, profile: clean(profile), completed, step, savedAt: new Date().toISOString() };
    if (completed && Object.keys(validate(data.profile)).length) throw new Error('Complete the required profile fields before saving.');
    try { localStorage.setItem(key(account), JSON.stringify(data)); }
    catch { throw new Error('Your browser could not save this draft. Free some browser storage or allow site storage, then try again.'); }
    return data;
  }

  function validate(profile) {
    const errors = {};
    if (profile.name.trim().length < 2 || profile.name.trim().length > 80) errors.name = 'Enter a name between 2 and 80 characters.';
    if (profile.about.trim().length < 40 || profile.about.trim().length > 1200) errors.about = 'Write a biography between 40 and 1,200 characters.';
    if (profile.experience === '' || !Number.isInteger(Number(profile.experience)) || Number(profile.experience) < 0 || Number(profile.experience) > 60) errors.experience = 'Enter whole years of experience from 0 to 60.';
    if (profile.hourlyRate === '' || !Number.isFinite(Number(profile.hourlyRate)) || Number(profile.hourlyRate) < 1 || Number(profile.hourlyRate) > 10000 || !/^\d+(\.\d{1,2})?$/.test(String(profile.hourlyRate))) errors.hourlyRate = 'Enter a rate from ₹1 to ₹10,000, with up to two decimal places.';
    if (!profile.services.length) errors.services = 'Choose at least one service.';
    for (const field of ['area', 'city']) {
      if (profile[field].trim().length < 2 || profile[field].trim().length > 80) errors[field] = `Enter a ${field === 'area' ? 'neighbourhood' : 'city'} between 2 and 80 characters.`;
    }
    if (!/^[1-9]\d{5}$/.test(profile.pincode)) errors.pincode = 'Enter a valid 6-digit Indian PIN code.';
    if (!profile.image) errors.image = 'Add a profile photo so pet parents can recognise you.';
    return errors;
  }

  function message(text, type = '') {
    const element = document.querySelector('#form-message');
    element.textContent = text;
    element.className = `form-message ${type}`;
  }

  function gate(account) {
    document.querySelector('#account-gate').hidden = !!account;
    document.querySelector('#walker-workspace').hidden = !account;
    return !!account;
  }

  async function initial(account) {
    const stored = load(account);
    if (stored) return stored;
    const profile = empty();
    profile.name = account.displayName || '';
    if (account.walkerId) {
      const response = await fetch('walkers.json');
      if (!response.ok) throw new Error('Your existing profile could not be loaded. Reload this page to try again.');
      const data = await response.json();
      const walker = data.walkers.find(item => item.id === account.walkerId);
      if (walker) Object.assign(profile, clean({ name: walker.name, about: walker.about, hourlyRate: walker.hourlyRate, image: walker.image }));
    }
    return { profile, completed: false, step: 0 };
  }

  function formController(form, initialProfile) {
    let image = initialProfile.image;
    let dirty = false;
    let pendingImage = false;
    let imageError = '';
    let imageVersion = 0;
    const photo = form.querySelector('#profile-image');
    const preview = form.querySelector('#photo-preview');
    const placeholder = form.querySelector('#photo-placeholder');

    function previewImage() {
      preview.hidden = !image;
      placeholder.hidden = !!image;
      if (image) preview.src = image;
      else preview.removeAttribute('src');
      form.querySelector('#remove-photo').hidden = !image;
    }

    function read() {
      const profile = empty();
      fields.forEach(field => { profile[field] = form.elements.namedItem(field).value.trim(); });
      profile.services = [...form.querySelectorAll('[name="services"]:checked')].map(input => input.value);
      profile.image = image;
      return profile;
    }

    function clearErrors() {
      form.querySelectorAll('[data-error]').forEach(element => { element.textContent = ''; });
      form.querySelectorAll('[aria-invalid]').forEach(element => element.removeAttribute('aria-invalid'));
    }

    function errors(errorMap, focus = true) {
      clearErrors();
      let first;
      Object.entries(errorMap).forEach(([field, text]) => {
        const output = form.querySelector(`[data-error="${field}"]`);
        if (output) output.textContent = text;
        const input = field === 'image' ? photo : form.querySelector(`[name="${field}"]`);
        if (input) { input.setAttribute('aria-invalid', 'true'); first ||= input; }
      });
      if (focus) first?.focus();
      return !Object.keys(errorMap).length;
    }

    function fill(profile) {
      fields.forEach(field => { form.elements.namedItem(field).value = profile[field]; });
      form.querySelectorAll('[name="services"]').forEach(input => { input.checked = profile.services.includes(input.value); });
      image = profile.image;
      imageVersion++;
      pendingImage = false;
      imageError = '';
      photo.value = '';
      dirty = false;
      clearErrors();
      previewImage();
      updateCount();
    }

    function updateCount() { form.querySelector('#bio-count').textContent = `${form.elements.namedItem('about').value.length} / 1,200 characters`; }
    form.addEventListener('input', () => { dirty = true; updateCount(); message('You have unsaved changes.'); });
    form.addEventListener('change', () => { dirty = true; });

    photo.addEventListener('change', async () => {
      const file = photo.files[0];
      if (!file) return;
      const version = ++imageVersion;
      pendingImage = true;
      imageError = '';
      message('Preparing your photo…');
      try {
        const result = await readImage(file);
        if (version !== imageVersion) return;
        image = result;
        dirty = true;
        previewImage();
        form.querySelector('[data-error="image"]').textContent = '';
        photo.removeAttribute('aria-invalid');
        message('Photo ready. Save your changes to keep it.');
      } catch (error) {
        if (version !== imageVersion) return;
        imageError = error.message;
        form.querySelector('[data-error="image"]').textContent = imageError;
        photo.setAttribute('aria-invalid', 'true');
        message('The selected photo could not be used.', 'error');
      } finally {
        if (version === imageVersion) { pendingImage = false; photo.value = ''; }
      }
    });

    form.querySelector('#remove-photo').addEventListener('click', () => {
      imageVersion++;
      pendingImage = false;
      imageError = '';
      image = '';
      photo.value = '';
      dirty = true;
      previewImage();
      message('Photo removed. Add a replacement before completing your profile.');
    });

    window.addEventListener('beforeunload', event => {
      if (dirty) { event.preventDefault(); event.returnValue = ''; }
    });

    fill(initialProfile);
    return {
      read, fill, errors, clearErrors,
      isDirty: () => dirty,
      markSaved: () => { dirty = false; },
      imageReady: () => {
        if (pendingImage || imageError) {
          message(pendingImage ? 'Wait for your photo to finish loading.' : imageError, 'error');
          return false;
        }
        return true;
      }
    };
  }

  async function readImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Choose an image smaller than 2 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error('Image dimensions are too large.');
      const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch { throw new Error('This image could not be read. Try a different JPG, PNG or WebP image.'); }
    finally { URL.revokeObjectURL(url); }
  }

  function review(profile) {
    document.querySelector('#review-name').textContent = profile.name;
    document.querySelector('#review-about').textContent = profile.about;
    document.querySelector('#review-experience').textContent = `${profile.experience} year${Number(profile.experience) === 1 ? '' : 's'} of experience`;
    document.querySelector('#review-rate').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(profile.hourlyRate)) + ' / hour';
    document.querySelector('#review-location').textContent = `${profile.area}, ${profile.city} · ${profile.pincode}`;
    document.querySelector('#review-services').textContent = profile.services.map(service => services[service]).join(' · ');
    const image = document.querySelector('#review-image');
    image.hidden = !profile.image;
    if (profile.image) image.src = profile.image;
  }

  return { session, load, save, validate, initial, gate, formController, message, review };
})();
