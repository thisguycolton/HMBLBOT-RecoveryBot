// POST a FormData with XMLHttpRequest, because fetch can't report upload progress.
//   const job = uploadWithProgress("/api/docs/pages/3/videos", form, ({ loaded, total }) => …);
//   job.promise.then((json) => …); job.abort();
// Rejects with an Error carrying the server's { error } message, or { aborted: true } when
// abort() was called.
const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";

export function uploadWithProgress(url, form, onProgress) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("X-CSRF-Token", csrfToken());
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.({ loaded: e.loaded, total: e.total }); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else if (xhr.status === 413) reject(new Error("That file is bigger than the server takes."));
      else reject(new Error(data.error || (xhr.status === 401 ? "Please sign in first." : "The upload didn't go through.")));
    };
    xhr.onerror = () => reject(new Error("The connection dropped during the upload."));
    xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled."), { aborted: true }));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
