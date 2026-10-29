const { test } = require('node:test');
const assert = require('node:assert/strict');
const { youtubeId } = require('../src/util');

test('youtubeId aceita links válidos', () => {
  for (const u of [
    'https://youtu.be/aqz-KE-bpKQ',
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    'https://youtu.be/aqz-KE-bpKQ?t=10',
    'https://www.youtube.com/watch?feature=x&v=aqz-KE-bpKQ',
  ]) assert.equal(youtubeId(u), 'aqz-KE-bpKQ', u);
});

test('youtubeId rejeita lixo depois do id e outros domínios', () => {
  for (const u of ['https://youtu.be/aaaaaaaaaaa"><script>', 'https://youtu.be/aaaaaaaaaaaX', 'http://site.com/x'])
    assert.equal(youtubeId(u), null, u);
});
