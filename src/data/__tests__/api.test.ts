import { API, apiBaseOf, DEFAULT_API, originOf, PRIVACY_URL } from '../api';

describe('API base URL from the environment', () => {
  it('uses the env value, without trailing slashes', () => {
    expect(apiBaseOf('https://naiboli.shujau.dev/api')).toBe('https://naiboli.shujau.dev/api');
    expect(apiBaseOf(' https://naiboli.shujau.dev/api/ ')).toBe('https://naiboli.shujau.dev/api');
    expect(apiBaseOf('http://192.168.1.5:8000')).toBe('http://192.168.1.5:8000');
  });

  it('falls back to the default when unset or not a URL', () => {
    for (const v of [undefined, '', '   ', 'naiboli.shujau.dev/api', 'ftp://x']) expect(apiBaseOf(v)).toBe(DEFAULT_API);
  });

  it('privacy policy is always <origin of the API in use>/privacy-policy', () => {
    expect(originOf('https://naiboli.shujau.dev/api')).toBe('https://naiboli.shujau.dev');
    expect(originOf('https://moodhu.dev/api')).toBe('https://moodhu.dev');
    expect(originOf('http://192.168.1.5:8000/v1/api')).toBe('http://192.168.1.5:8000');
    expect(PRIVACY_URL).toBe(originOf(API) + '/privacy-policy');
  });
});
