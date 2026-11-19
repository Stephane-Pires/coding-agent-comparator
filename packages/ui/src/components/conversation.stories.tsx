import type { Meta, StoryObj } from '@storybook/react-vite';

import { Conversation, ConversationContent, ConversationScrollButton } from './ai-elements/conversation.tsx';
import { Message, MessageContent, MessageResponse } from './ai-elements/message.tsx';

const ANSWER = `I created \`hello.mjs\` and ran it.

\`\`\`js
console.log('hi');
\`\`\`

It printed **hi**. Next steps you could ask for:

- add a test
- accept a name as an argument`;

/** The chat primitives from AI Elements, as one agent's column uses them. */
const meta = { title: 'Chat/Conversation' } satisfies Meta;
export default meta;
type Story = StoryObj;

export const TaskAndAnswer: Story = {
  render: () => (
    <Conversation className="h-96 rounded-lg border">
      <ConversationContent>
        <Message from="user">
          <MessageContent>Create hello.mjs that prints "hi", then run it with node.</MessageContent>
        </Message>
        <Message from="assistant">
          <MessageContent>
            <MessageResponse>{ANSWER}</MessageResponse>
          </MessageContent>
        </Message>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  ),
};
