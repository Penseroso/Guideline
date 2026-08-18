const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "for", "to", "in", "on",
  "and", "or", "what", "how", "does", "do", "should", "must", "may", "at",
  "least", "with", "be", "it", "this", "that", "as", "per"
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9%._-]+/i)
    .filter((t) => t && !STOPWORDS.has(t));
}

module.exports = { tokenize, STOPWORDS };
