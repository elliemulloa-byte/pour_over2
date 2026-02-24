const DRAFT_KEY = 'beanverdict_review_draft';

export function saveReviewDraft(placeId, data) {
  try {
    const payload = { placeId, ...data };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not save review draft:', e);
  }
}

export function loadReviewDraft(placeId) {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft.placeId !== placeId) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return draft;
  } catch {
    return null;
  }
}
