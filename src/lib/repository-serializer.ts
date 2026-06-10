type RepositoryWithSecret = {
  webhookSecret?: string | null;
  [key: string]: unknown;
};

export function omitWebhookSecret<T extends RepositoryWithSecret>(
  repository: T
): Omit<T, "webhookSecret"> {
  const { webhookSecret: _, ...rest } = repository;
  return rest;
}

export function omitWebhookSecretFromList<T extends RepositoryWithSecret>(
  repositories: T[]
) {
  return repositories.map(omitWebhookSecret);
}
