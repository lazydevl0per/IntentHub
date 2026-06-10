export function syncCommitIndexLimit() {
  return Number(
    process.env.GITHUB_SYNC_COMMIT_INDEX_LIMIT ??
      process.env.GITHUB_SYNC_COMMIT_LIMIT ??
      50
  );
}
