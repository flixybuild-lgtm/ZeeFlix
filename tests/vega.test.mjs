import assert from 'node:assert/strict';
import test from 'node:test';
import {manifestURL, validateManifest, streamURL, parseStreams, parseDirectory} from '../public/vega.js';

const manifest = 'https://bridge.example/config-key/manifest.json';
test('Vega manifests must use HTTPS and preserve configured bridge paths', () => {
  assert.equal(manifestURL(` ${manifest} `), manifest);
  for (const url of ['http://bridge.example/manifest.json', 'https://user:pass@bridge.example/manifest.json', 'https://github.com/Zenda-Cross/vega-providers', 'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/main/manifest.json', `${manifest}#local`, `${manifest}?token=secret`]) {
    assert.throws(() => manifestURL(url), /running Vega bridge/);
  }
  assert.doesNotThrow(() => validateManifest({id:'community.vega.stremio', resources:[{name:'stream'}], types:['movie','series']}));
  assert.throws(() => validateManifest([{display_name:'Plugin',value:'example'}]), /not a compatible/);
});

test('Vega stream routes distinguish movies and series episodes', () => {
  assert.equal(streamURL(manifest, 'tt1234567'), 'https://bridge.example/config-key/stream/movie/tt1234567.json');
  assert.equal(streamURL(manifest, '  tt1234567:1:2  '), 'https://bridge.example/config-key/stream/series/tt1234567:1:2.json');
  for (const id of ['tt1234567:1', 'tt1234567:1:0', 'tt1234567?foo', '../tt1234567']) assert.throws(() => streamURL(manifest, id), /IMDb/);
});

test('stream results are bounded, deduplicated and limited to direct HTTPS playback', () => {
  const stream = {name:'Demo\nprovider', title:'1080p', url:'https://media.example/example.m3u8?sig=abc'};
  assert.deepEqual(parseStreams({streams:[null, {infoHash:'hash'}, {externalUrl:'https://example.test'},
    {...stream, url:'http://media.example/demo.mp4'}, {...stream, url:'https://media.example/embed/test'},
    {...stream, behaviorHints:{notWebReady:true}}, {...stream, behaviorHints:{proxyHeaders:{request:{Referer:'test'}}}},
    {...stream, drm:{type:'widevine'}}, stream, stream]}), [{name:'Demo provider',title:'1080p',url:stream.url}]);
  assert.equal(parseStreams({streams:Array.from({length:60}, (_, i) => ({url:`https://example.test/${i}.mp4`}))}).length, 30);
  assert.throws(() => parseStreams({message:'error'}), /list/);
});

test('extension manifests are read as metadata, including disabled entries', () => {
  const content = Buffer.from(JSON.stringify([{display_name:'Cinéma',value:'cinema',version:'2.0',disabled:true}, null])).toString('base64');
  assert.deepEqual(parseDirectory({encoding:'base64', content}), [{name:'Cinéma',version:'2.0',disabled:true}]);
  assert.throws(() => parseDirectory({encoding:'text', content}), /format/);
});
