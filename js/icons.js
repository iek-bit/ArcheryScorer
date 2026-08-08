const ICONS = {
  target: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
  history: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg>',
  pulse: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2.5-5 4 10 2.5-5H21"></path></svg>',
  settings: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
  stop: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2"></rect></svg>',
  close: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>',
  download: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10"></path><path d="M8 10l4 4 4-4"></path><path d="M5 19h14"></path></svg>',
  upload: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V10"></path><path d="M8 14l4-4 4 4"></path><path d="M5 5h14"></path></svg>',
  trash: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 12h8l1-12"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>',
  bow: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4a10 10 0 0 0 0 16"></path><path d="M17 4a10 10 0 0 1 0 16"></path><path d="M7 12h10"></path><path d="M11 8l6 4-6 4"></path></svg>',
  trophy: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v3a4 4 0 0 1-8 0V4z"></path><path d="M6 5H4a2 2 0 0 0 2 5"></path><path d="M18 5h2a2 2 0 0 1-2 5"></path><path d="M12 11v4"></path><path d="M9 19h6"></path><path d="M8 22h8"></path></svg>',
  location: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11z"></path><circle cx="12" cy="10" r="2.2"></circle></svg>',
  arrowUpRight: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7"></path><path d="M9 7h8v8"></path></svg>',
  search: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M20 20l-4.2-4.2"></path></svg>',
  undo: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5"></path><path d="M5 12h8a6 6 0 1 1 0 12h-2"></path></svg>',
  users: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path><circle cx="9.5" cy="7" r="3"></circle><path d="M20 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 4.13a3 3 0 0 1 0 5.74"></path></svg>',
  edit: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>',
  chevronDown: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>',
  help: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  square: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
  checkSquare: '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><polyline points="9 12 12 15 15 9"></polyline></svg>'
};

function icon(name, extraClass = '') {
  const markup = ICONS[name] || '';
  return extraClass ? markup.replace('class="ui-icon"', `class="ui-icon ${extraClass}"`) : markup;
}

const THREE_D_TARGETS = [
  {key: 'ram', label: 'Ram'},
  {key: 'deer', label: 'Deer'},
  {key: 'antelope', label: 'Antelope'},
  {key: 'bear', label: 'Bear'},
  {key: 'coyote', label: 'Coyote'},
  {key: 'turkey', label: 'Turkey'}
];
const THREE_D_TARGET_LOOKUP = Object.fromEntries(THREE_D_TARGETS.map(target => [target.key, target.label]));
const PRACTICE_TARGET_OPTIONS = [
  {mode: 'bullseye', distance: 10, label: '10m'},
  {mode: 'bullseye', distance: 15, label: '15m'},
  ...THREE_D_TARGETS.map(target => ({mode: '3d', animal: target.key, label: target.label}))
];
