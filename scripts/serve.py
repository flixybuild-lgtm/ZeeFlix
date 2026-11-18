#!/usr/bin/env python3
"""Preview dist only. Implements HTTP byte ranges used by media and resumable transfers."""
import os,re,mimetypes,shutil,sys
from pathlib import Path
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import unquote,urlsplit

ROOT=Path(__file__).resolve().parents[1]/'dist'
class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path=unquote(urlsplit(self.path).path)
        if path.startswith('/ZeeFlix/'):path=path[8:]
        f=(ROOT/path.lstrip('/')).resolve()
        if not f.is_relative_to(ROOT):self.send_error(403);return
        if f.is_dir():f=f/'index.html'
        if not f.is_file():self.send_error(404);return
        stat=f.stat();size=stat.st_size;etag=f'"{stat.st_mtime_ns:x}-{size:x}"';r=self.headers.get('Range','');bounds=None
        if self.headers.get('If-Range',etag)==etag and r:
            m=re.fullmatch(r'bytes=(\d*)-(\d*)',r)
            if m and any(m.groups()):
                a,b=m.groups();start=int(a) if a else max(0,size-int(b));end=min(size-1,int(b)) if b and a else size-1
                if start<=end and start<size:bounds=(start,end)
                else:self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return
        if not bounds and self.headers.get('If-None-Match')==etag:self.send_response(304);self.end_headers();return
        start,end=bounds or (0,size-1);self.send_response(206 if bounds else 200)
        if bounds:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Content-Type',mimetypes.guess_type(str(f))[0] or 'application/octet-stream');self.send_header('Content-Length',str(end-start+1));self.send_header('ETag',etag);self.send_header('Accept-Ranges','bytes');self.send_header('Cache-Control','no-cache');self.send_header('X-Content-Type-Options','nosniff');self.end_headers()
        self.remaining=end-start+1;fp=f.open('rb');fp.seek(start);return fp
    def copyfile(self,src,dst):
        try:
            while self.remaining>0:
                chunk=src.read(min(self.remaining,65536))
                if not chunk:break
                dst.write(chunk);self.remaining-=len(chunk)
        except (BrokenPipeError,ConnectionResetError):pass
    def log_message(self,fmt,*args):
        if len(args)>1 and str(args[1])[0] in '45':super().log_message(fmt,*args)
if __name__=='__main__':
    if not (ROOT/'index.html').is_file():sys.exit('Run npm ci && npm run build first.')
    port=int(os.getenv('PORT','4173'));print('ZeeFlix preview on 0.0.0.0:'+str(port),flush=True);ThreadingHTTPServer(('0.0.0.0',port),Handler).serve_forever()
