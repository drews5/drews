'use strict';
const form=document.querySelector('.password-form');
form?.addEventListener('submit',event=>{
  event.preventDefault();
  const status=document.querySelector('.password-status');
  // Empty placeholders: no password or private project has been published.
  status.textContent="This project isn't open yet. Check back soon.";
  form.reset();
});
