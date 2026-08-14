// Repro: an MCP transport that dies WITHOUT a clean close (client crash, kill -9,
// network drop, laptop sleep) leaves the edit session it owns wedged in `drafting`.
//
// The ownerGone recovery added in cf49e62 only fires from transport.onclose, i.e. on
// a graceful shutdown. An abrupt death is reaped solely by pruneMcpSessions, gated by
// MCP_SESSION_IDLE_LIMIT_MS (1 hour) and swept every 10 minutes. Until then no
// cancellation reaches the editor, so the browser never discards the orphan, while
// every other transport is refused: begin_edit_session -> "already active",
// discard_edit_session -> "does not belong to this MCP transport".
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import {
  nextEditorCall,
  nextEditorCancellation,
  registerEditor,
  resetExternalAgentBrokerForTest,
  settleEditorCall,
} from './broker.ts';
import {
  handleMcpRequest,
  MCP_SESSION_IDLE_LIMIT_MS,
  mcpSessionsForTest,
  pruneMcpSessions,
  resetMcpSessionsForTest,
  setMcpSessionLastUsedForTest,
} from './mcp.ts';
import {
  callOutcome,
  callStatus,
  closeClient,
  connectClient,
  waitForPending,
  type ConnectedClient,
} from './mcp-session-verifier.ts';

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address && typeof address !== 'string');
  return address.port;
}

/** Drain one queued editor call and settle it, standing in for the browser editor. */
async function takeAndSettle(
  projectId: string,
  editorId: string,
  revision: string,
  value: unknown,
): Promise<void> {
  const call = await nextEditorCall(
    projectId,
    editorId,
    revision,
    AbortSignal.timeout(2_000),
  );
  assert(call, 'the editor long poll received the queued call');
  settleEditorCall(call.id, 'applied', value);
}

/** Non-blocking peek at the editor cancellation queue. */
async function peekCancellation(
  projectId: string,
  editorId: string,
): Promise<{ ownerGone?: string[] } | null> {
  return nextEditorCancellation(projectId, editorId, AbortSignal.timeout(100));
}

await resetMcpSessionsForTest();
resetExternalAgentBrokerForTest();

const projectId = 'orphan-project';
const editorId = 'orphan-editor';
const revision = 'v1-orphan-project';
const editorTools = [
  { name: 'begin_edit_session', input_schema: { type: 'object' as const, properties: {} } },
  {
    name: 'discard_edit_session',
    input_schema: {
      type: 'object' as const,
      properties: { editSessionId: { type: 'string' } },
      required: ['editSessionId'],
    },
  },
];
registerEditor(projectId, editorId, revision, editorTools);

const server = createServer((req, res) => {
  void handleMcpRequest(req, res, 'http://127.0.0.1').catch((error) => {
    if (!res.headersSent) res.writeHead(500);
    res.end(error instanceof Error ? error.message : String(error));
  });
});
const port = await listen(server);
const mcpUrl = new URL(`http://127.0.0.1:${port}/mcp`);
const clients: ConnectedClient[] = [];

try {
  // --- The doomed transport takes ownership of an edit session ---------------
  const doomed = await connectClient(mcpUrl, 'openchatcut-orphan-doomed');
  clients.push(doomed);
  await doomed.client.callTool({ name: 'target_project', arguments: { projectId } });

  const editSessionId = 'orphaned-edit-session';
  const begin = doomed.client.callTool({ name: 'begin_edit_session', arguments: {} });
  await waitForPending(doomed.sessionId);
  await takeAndSettle(projectId, editorId, revision, { editSessionId, status: 'drafting' });
  assert.equal(callStatus(await begin), 'drafting', 'the doomed transport owns a drafting session');

  // --- The transport dies abruptly: no DELETE, no close, no onclose ----------
  // Nothing is called here on purpose. This is the whole point of the repro.
  assert(
    mcpSessionsForTest().some((session) => session.id === doomed.sessionId),
    'an abrupt death leaves the MCP session registered server-side',
  );
  assert.equal(
    await peekCancellation(projectId, editorId),
    null,
    'REGRESSION TARGET: no ownerGone reaches the editor, so the orphan is never discarded',
  );

  // --- Every other transport is locked out -----------------------------------
  const successor = await connectClient(mcpUrl, 'openchatcut-orphan-successor');
  clients.push(successor);
  await successor.client.callTool({ name: 'target_project', arguments: { projectId } });
  const discard = await successor.client.callTool({
    name: 'discard_edit_session',
    arguments: { editSessionId },
  });
  assert.equal(callOutcome(discard), 'rejected', 'a successor transport cannot discard the orphan');
  assert.equal(
    JSON.stringify(discard).includes(editSessionId),
    false,
    'the rejection never discloses the owning session id, so the user has nothing to act on',
  );

  // --- Recovery exists, but only after the idle limit ------------------------
  assert.equal(MCP_SESSION_IDLE_LIMIT_MS, 60 * 60 * 1000, 'the lockout lasts a full hour');
  pruneMcpSessions();
  assert.equal(
    await peekCancellation(projectId, editorId),
    null,
    'a fresh sweep releases nothing: the dead transport still looks recently used',
  );

  setMcpSessionLastUsedForTest(doomed.sessionId, Date.now() - MCP_SESSION_IDLE_LIMIT_MS - 1);
  pruneMcpSessions();
  const released = await peekCancellation(projectId, editorId);
  assert(released?.ownerGone?.includes(editSessionId), 'the orphan is only released after 1 hour');

  console.log('orphan-session-recovery: reproduced (lockout until the 1h idle sweep)');
} finally {
  await Promise.all(clients.splice(0).map(closeClient));
  await resetMcpSessionsForTest();
  resetExternalAgentBrokerForTest();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
