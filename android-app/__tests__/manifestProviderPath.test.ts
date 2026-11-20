import {beforeEach, describe, expect, it, jest} from '@jest/globals';

jest.mock('axios', () => ({get: jest.fn()}));

jest.mock('../src/lib/storage/StorageService', () => ({
  mainStorage: {getString: jest.fn(), delete: jest.fn()},
}));

jest.mock('../src/lib/storage/sourceTokenStorage', () => ({
  getSourceAuthHeaders: () => ({}),
  sourceTokenStorage: {has: () => false},
}));

jest.mock('../src/lib/storage/extensionStorage', () => ({
  extensionStorage: {
    getProviderSources: () => [],
    getProviderSource: () => undefined,
    isManifestCacheExpired: () => true,
    getManifestCache: () => [],
    setManifestCache: jest.fn(),
    setAvailableProviders: jest.fn(),
  },
}));

import axios from 'axios';
import {extensionManager} from '../src/lib/services/ExtensionManager';

const mockGet = axios.get as unknown as jest.Mock<any>;
const source = {
  author: 'Zenda-Cross',
  url: 'https://raw.githubusercontent.com/Zenda-Cross/vega-providers/main',
};

const entry = (value: string, extra: Record<string, unknown> = {}) => ({
  value,
  display_name: value,
  version: '1.0.0',
  ...extra,
});

describe('Framewave provider manifest policy', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('keeps only VMovies and rejects unsafe provider paths', async () => {
    mockGet.mockResolvedValue({
      data: [
        entry('vega'),
        entry('otherProvider'),
        entry('vega', {path: null}),
        entry('vega', {path: ''}),
        entry('vega', {path: 'providers/nested'}),
        entry('vega', {path: '../outside'}),
      ],
    });

    const providers = await extensionManager.fetchManifest(source, true);
    expect(providers.map(provider => provider.value)).toEqual([
      'vega',
      'vega',
      'vega',
      'vega',
    ]);
    expect('path' in providers[0]).toBe(false);
    expect('path' in providers[1]).toBe(false);
    expect('path' in providers[2]).toBe(false);
    expect(providers[3].path).toBe('providers/nested');
  });

  it('rejects all extensions from a source other than the pinned Zenda-Cross source', async () => {
    mockGet.mockResolvedValue({data: [entry('vega')]});
    const providers = await extensionManager.fetchManifest(
      {author: 'other', url: 'https://example.com/repo'},
      true,
    );
    expect(providers).toEqual([]);
  });
});
