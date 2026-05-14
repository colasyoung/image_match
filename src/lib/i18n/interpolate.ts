export function interpolate(
  template: string,
  vars?: Record<string, string | number | undefined>
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`
  );
}
