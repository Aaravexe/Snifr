(async () => {
  const profile = window.WalkerProfile;
  const account = profile.session();
  if (!profile.gate(account)) return;
  const form = document.querySelector('#onboarding-form');
  const next = document.querySelector('#next-step');
  const back = document.querySelector('#back-step');
  const draft = document.querySelector('#save-draft');
  const titles = ['About you', 'Services & rate', 'Location & photo', 'Review'];
  const stepFields = [['name', 'about', 'experience'], ['services', 'hourlyRate'], ['area', 'city', 'pincode', 'image']];
  let step = 0;
  let controller;
  form.inert = true;
  profile.message('Loading your profile…');
  try {
    const saved = await profile.initial(account);
    if (saved.completed && !Object.keys(profile.validate(saved.profile)).length) {
      location.replace('walker-settings.html');
      return;
    }
    controller = profile.formController(form, saved.profile);
    step = saved.step;
    // A resumed draft must not skip an incomplete earlier step.
    const errors = profile.validate(saved.profile);
    const firstIncomplete = stepFields.findIndex(fields => fields.some(field => errors[field]));
    if (firstIncomplete >= 0) step = Math.min(step, firstIncomplete);
    profile.message(saved.savedAt ? 'Your saved draft is ready. Pick up where you left off.' : '');
    form.inert = false;
    showStep(false);
  } catch (error) {
    profile.message(error.message || 'Your draft could not be loaded. Check browser storage permissions and reload.', 'error');
    // Keep the error readable while preventing accidental overwrite of an unreadable draft.
    form.inert = false;
    form.querySelectorAll('input, textarea, button').forEach(element => { element.disabled = true; });
    return;
  }

  function showStep(focus = true) {
    form.querySelectorAll('[data-step]').forEach(panel => { panel.hidden = Number(panel.dataset.step) !== step; });
    document.querySelectorAll('.step-list li').forEach((item, index) => {
      item.classList.toggle('complete', index < step);
      if (index === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    document.querySelector('#step-counter').textContent = `Step ${step + 1} of 4`;
    document.querySelector('#progress-label').textContent = titles[step];
    document.querySelector('#setup-progress').value = step + 1;
    back.hidden = step === 0;
    next.textContent = step === 3 ? 'Complete profile draft' : 'Continue';
    if (step === 3) profile.review(controller.read());
    if (focus) {
      const heading = form.querySelector(`[data-step="${step}"] legend, [data-step="${step}"] h2`);
      heading.tabIndex = -1;
      heading.focus();
    }
  }

  back.addEventListener('click', () => { step--; controller.clearErrors(); profile.message(''); showStep(); });
  draft.addEventListener('click', () => {
    if (!controller.imageReady()) return;
    try {
      profile.save(account, controller.read(), false, step);
      controller.markSaved();
      profile.message('Draft saved in this browser. You can come back and continue later.', 'success');
    } catch (error) { profile.message(error.message, 'error'); }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!controller.imageReady()) return;
    const values = controller.read();
    const allErrors = profile.validate(values);
    const relevant = step === 3 ? allErrors : Object.fromEntries(Object.entries(allErrors).filter(([field]) => stepFields[step].includes(field)));
    if (Object.keys(relevant).length) {
      if (step === 3) { step = stepFields.findIndex(fields => fields.some(field => relevant[field])); showStep(false); }
      controller.errors(relevant);
      profile.message('Please check the highlighted fields.', 'error');
      return;
    }
    controller.clearErrors();
    if (step < 3) { step++; profile.message(''); showStep(); return; }
    try {
      profile.save(account, values, true, 3);
      controller.markSaved();
      location.href = 'walker-settings.html?setup=complete';
    } catch (error) { profile.message(error.message, 'error'); }
  });
})();
