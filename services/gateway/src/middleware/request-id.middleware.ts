import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

/**
 * Injects X-Request-ID into every request for distributed tracing.
 * If the client already sent one, we reuse it; otherwise we generate a UUID.
 * The ID is also added to the reply so the client can correlate responses.
 */
export async function requestIdMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const existing = request.headers['x-request-id'];
  const requestId = Array.isArray(existing)
    ? existing[0]
    : existing ?? randomUUID();

  // Make it available to downstream proxy requests
  request.headers['x-request-id'] = requestId;

  // Echo back to client
  void reply.header('x-request-id', requestId);
}
