import { type BatchMessage, type BatchRequest, renderBatch } from './batch';

self.onmessage = async ({ data }: MessageEvent<BatchRequest>) => {
  const send = (message: BatchMessage) => self.postMessage(message);
  try {
    send(await renderBatch(data, (index, ok) => send({ type: 'progress', index, ok })));
  } catch {
    send({ type: 'error' });
  } finally {
    data.logo?.close();
  }
};
