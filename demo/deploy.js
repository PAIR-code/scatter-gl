const ghPages = require('gh-pages');

ghPages.publish('demo_build', () => {
  console.log('🚀 published to github pages!');
});
