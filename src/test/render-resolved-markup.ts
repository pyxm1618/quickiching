import type { ReactNode } from "react";
import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";

export function renderToResolvedMarkup(node: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    let firstError: unknown = null;
    let settled = false;

    const output = new Writable({
      write(chunk, _encoding, callback) {
        html += chunk.toString();
        callback();
      },
    });

    output.on("finish", () => {
      if (settled) return;
      settled = true;
      resolve(html);
    });
    output.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    const stream = renderToPipeableStream(node, {
      onAllReady() {
        if (firstError) {
          settled = true;
          reject(firstError);
          stream.abort();
          return;
        }
        stream.pipe(output);
      },
      onShellError(error) {
        if (settled) return;
        settled = true;
        reject(error);
      },
      onError(error) {
        firstError ??= error;
      },
    });
  });
}
