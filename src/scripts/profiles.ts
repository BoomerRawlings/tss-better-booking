import { enhanceDisclosures } from './profile-disclosures';

const cards = [...document.querySelectorAll<HTMLDetailsElement>('[data-profile-card]')];
const filter = document.querySelector<HTMLSelectElement>('[data-profile-filter]');
const expand = document.querySelector<HTMLButtonElement>('[data-expand-profiles]');
const status = document.querySelector<HTMLElement>('[data-profile-status]');
const collection = document.querySelector<HTMLElement>('#profile-collection');

const visibleCards = () => cards.filter(card => !card.hidden);
const syncExpandLabel = () => {
  if (!expand) return;
  const shown = visibleCards();
  expand.textContent = shown.length > 0 && shown.every(card => disclosures?.isOpen(card) ?? card.open) ? 'Collapse all' : 'Expand all';
};
const disclosures = collection ? enhanceDisclosures(collection, syncExpandLabel) : undefined;
const setOpen = (card: HTMLDetailsElement, open: boolean) => {
  if (disclosures) disclosures.setOpen(card, open);
  else card.open = open;
};

filter?.addEventListener('change', () => {
  const profile = filter.value;
  cards.forEach(card => {
    const hidden = profile !== 'all' && card.dataset.profileId !== profile;
    // Resolve pending intent before hiding, including any nested transitions.
    if (hidden) disclosures?.finishWithin(card);
    card.hidden = hidden;
    if (profile !== 'all' && !card.hidden) setOpen(card, true);
  });
  if (status) {
    status.textContent = profile === 'all'
      ? `Showing all ${cards.length} profiles.`
      : `Showing ${filter.selectedOptions[0].textContent}.`;
  }
  syncExpandLabel();
});

expand?.addEventListener('click', () => {
  const shown = visibleCards();
  const open = shown.some(card => !(disclosures?.isOpen(card) ?? card.open));
  shown.forEach(card => setOpen(card, open));
  syncExpandLabel();
});

cards.forEach(card => card.addEventListener('toggle', syncExpandLabel));
syncExpandLabel();
