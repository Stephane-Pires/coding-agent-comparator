import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';

import type { contract } from '@comparator/contracts';

/** The typed client of the API. It calls this app's own origin, which forwards `/rpc` to the API. */
export const api: ContractRouterClient<typeof contract> = createORPCClient(
  new RPCLink({ url: () => `${window.location.origin}/rpc` }),
);
