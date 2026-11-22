'use client';

import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Task, TASK_MAX_CHARACTERS } from '@comparator/contracts';
import { Button } from '@comparator/ui/components/ui/button';
import { Textarea } from '@comparator/ui/components/ui/textarea';
import { ICONS } from '@comparator/ui/icons';

interface TaskInputProps {
  /** While runs are in progress the one button is Stop; otherwise it is Send. They are never shown together. */
  readonly running: boolean;
  readonly onSend: (task: Task) => void;
  readonly onStop: () => void;
}

/** Where the user writes the task that goes to every agent. */
export function TaskInput({ running, onSend, onStop }: TaskInputProps) {
  const [text, setText] = useState('');
  const fieldId = useId();
  // What makes a task valid is the domain's rule, read through the contract: the field never restates it.
  const task = Task.safeParse(text);
  const canSend = !running && task.success;

  const send = () => {
    if (running || !task.success) return;
    onSend(task.data);
    setText('');
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  // Enter sends, Shift+Enter starts a new line.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-end gap-2">
      <label htmlFor={fieldId} className="sr-only">
        Task for the agents
      </label>
      <Textarea
        id={fieldId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Describe a task to send to every agent"
        rows={2}
        maxLength={TASK_MAX_CHARACTERS}
        className="max-h-48"
      />
      {running ? (
        <Button type="button" variant="outline" onClick={onStop}>
          <ICONS.stop aria-hidden="true" />
          Stop
        </Button>
      ) : (
        <Button type="submit" disabled={!canSend}>
          <ICONS.send aria-hidden="true" />
          Send
        </Button>
      )}
    </form>
  );
}
