import { describe, expect, it } from 'vite-plus/test';

import {
  RUN_REVIEW_INSTRUCTIONS,
  TASK_CHECK_INSTRUCTIONS,
  taskAsData,
  workAsData,
} from '@comparator/application';
import { Task } from '@comparator/domain';

import { anthropicQuestions, type Messages } from './index.ts';

const task = Task.parse('write a function');
const signal = new AbortController().signal;

/** A stand-in for the SDK: it records each request and gives every one the same answer. */
function answering(parsed_output: unknown, stop_reason = 'end_turn') {
  const requests: { model?: unknown; system?: unknown; messages?: unknown; output_config?: unknown }[] = [];
  const messages = {
    parse: (request: (typeof requests)[number]) => {
      requests.push(request);
      return Promise.resolve({ parsed_output, stop_reason });
    },
  } as unknown as Messages;
  return { requests, questions: anthropicQuestions({ apiKey: 'a-key', model: 'a-model' }, messages) };
}

describe('anthropicQuestions', () => {
  it('asks whether a task is a coding task: the shared instructions, and the task as data', async () => {
    const assessment = { reason: 'A function.', isCodingTask: true, resultIsFiles: true };
    const { requests, questions } = answering(assessment);
    expect(await questions.classifier.assess(task, signal)).toEqual(assessment);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: 'a-model',
      system: TASK_CHECK_INSTRUCTIONS,
      messages: [{ role: 'user', content: taskAsData(task) }],
      output_config: { effort: 'low' },
    });
  });

  it('asks whether a run did its task: the shared instructions, and the work as data', async () => {
    const review = { reason: 'It asked a question.', taskDone: false };
    const work = { task, answer: 'What should it do?', files: [], toolCalls: 0 };
    const { requests, questions } = answering(review);
    expect(await questions.reviewer.review(work, signal)).toEqual(review);
    expect(requests[0]).toMatchObject({
      system: RUN_REVIEW_INSTRUCTIONS,
      messages: [{ role: 'user', content: workAsData(work) }],
    });
  });

  it('fails when the model gives no answer in shape, as when it declines', async () => {
    const { questions } = answering(null, 'refusal');
    await expect(questions.classifier.assess(task, signal)).rejects.toThrow('refusal');
  });
});
