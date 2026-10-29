import { HttpError } from '../utils/http-error.js';

export function validate(schema, property = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[property]);

    if (!result.success) {
      // On récupère le premier message d'erreur précis (ex: "Le client doit être majeur...")
      const firstError = result.error.issues[0];
      
      next(new HttpError(422, firstError.message, result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))));
      return;
    }

    request[property] = result.data;
    next();
  };
}