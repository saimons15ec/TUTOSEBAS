export function subjectKey(value: unknown) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("es") : "";
}

export function sameSubject(left: unknown, right: unknown) {
  const expected = subjectKey(right);
  return Boolean(expected) && subjectKey(left) === expected;
}

export function removeSubjectFromDistribution(value: unknown, subject: string) {
  const source = Array.isArray(value) ? value : [];
  let changed = false;
  const distribution = source.filter((item) => {
    if (!item || typeof item !== "object") return true;
    if (!sameSubject((item as Record<string, unknown>).subject, subject)) return true;
    changed = true;
    return false;
  });
  const count = distribution.reduce((total, item) => {
    if (!item || typeof item !== "object") return total;
    const itemCount = Number((item as Record<string, unknown>).count);
    return total + (Number.isInteger(itemCount) && itemCount > 0 ? itemCount : 0);
  }, 0);
  return { changed, distribution, count };
}
