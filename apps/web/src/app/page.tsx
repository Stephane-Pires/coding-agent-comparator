import { AccessGate } from '../access/access-gate.tsx';
import { ChatPage } from '../chat/chat-page.tsx';

export default function Page() {
  return (
    <AccessGate>
      <ChatPage />
    </AccessGate>
  );
}
