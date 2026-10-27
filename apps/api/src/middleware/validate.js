export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request data.', details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
    }
    req[source] = parsed.data;
    next();
  };
}
