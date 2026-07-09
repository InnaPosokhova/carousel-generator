export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
