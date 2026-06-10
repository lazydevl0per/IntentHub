import { omitWebhookSecret, omitWebhookSecretFromList } from '../../src/lib/repository-serializer';

describe('repository-serializer', () => {
  it('should omit webhookSecret from object', () => {
    const repo = { id: 1, name: 'test', webhookSecret: 'secret' };
    const result = omitWebhookSecret(repo);
    expect(result).not.toHaveProperty('webhookSecret');
    expect(result.id).toBe(1);
  });

  it('should omit webhookSecret from list', () => {
    const repos = [{ id: 1, webhookSecret: 's1' }, { id: 2, webhookSecret: 's2' }];
    const result = omitWebhookSecretFromList(repos);
    expect(result.every(r => !('webhookSecret' in r))).toBe(true);
  });
});