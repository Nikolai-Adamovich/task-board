export default {
  '*.{ts,js,mjs}': ['eslint --fix', 'prettier --write'],
  '*.{html,json,md,yml,yaml}': ['prettier --write'],
};
