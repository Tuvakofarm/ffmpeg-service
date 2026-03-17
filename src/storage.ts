import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

export function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const request = proto.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error('Download failed: HTTP ' + response.statusCode));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    request.on('error', (err) => {
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(new Error('Download error: ' + err.message));
    });
    request.setTimeout(300000, () => {
      request.destroy();
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(new Error('Download timed out'));
    });
  });
}
