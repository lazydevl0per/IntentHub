export function expandRetrievalQuery(
  message: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>
) {
  const trimmed = message.trim();
  if (!history?.length) {
    return trimmed;
  }

  const recent = history.slice(-4).map((item) => item.content.trim());
  const combined = [...recent, trimmed].join("\n");
  return combined.slice(0, 2000);
}
