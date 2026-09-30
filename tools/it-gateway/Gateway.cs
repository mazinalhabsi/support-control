// بوابة نظام تقنية المعلومات: تحجز المسار /IT/ على المنفذ 80 داخل طبقة http.sys في Windows
// (المشتركة مع Configuration Manager) وتمرر الطلبات إلى Apache على المنفذ 8080.
using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

public static class ItGateway
{
    static HttpClient client;
    static string target;
    static readonly string[] skipReq = { "Host", "Connection", "Content-Length", "Transfer-Encoding", "Keep-Alive", "Expect", "Proxy-Connection", "Upgrade" };
    static readonly string[] skipRes = { "Connection", "Content-Length", "Transfer-Encoding", "Keep-Alive", "Content-Type", "Server" };
    static HttpListener listener;
    public static string LogFile;
    static readonly object logLock = new object();
    public static Action<string> Log = delegate (string s)
    {
        if (LogFile == null) return;
        lock (logLock)
        {
            try
            {
                var fi = new FileInfo(LogFile);
                if (fi.Exists && fi.Length > 5 * 1024 * 1024) File.Copy(LogFile, LogFile + ".old", true);
                if (fi.Exists && fi.Length > 5 * 1024 * 1024) File.Delete(LogFile);
                File.AppendAllText(LogFile, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + s + Environment.NewLine);
            }
            catch (Exception) { }
        }
    };

    public static void Stop()
    {
        try { if (listener != null) listener.Stop(); } catch (Exception) { }
    }

    public static void Run(string[] prefixes, string targetBase)
    {
        target = targetBase.TrimEnd('/');
        var handler = new HttpClientHandler();
        handler.AllowAutoRedirect = false;
        handler.UseCookies = false;
        handler.AutomaticDecompression = DecompressionMethods.None;
        handler.UseProxy = false;
        client = new HttpClient(handler);
        client.Timeout = TimeSpan.FromMinutes(10);
        ServicePointManager.DefaultConnectionLimit = 256;

        listener = new HttpListener();
        foreach (var p in prefixes) listener.Prefixes.Add(p);
        listener.Start();
        Log("listening on " + string.Join(", ", prefixes) + " -> " + target);
        while (listener.IsListening)
        {
            HttpListenerContext ctx;
            try { ctx = listener.GetContext(); }
            catch (Exception) { if (!listener.IsListening) break; continue; }
            Task.Run(() => Handle(ctx));
        }
    }

    static bool In(string[] list, string name)
    {
        foreach (var x in list) if (string.Equals(x, name, StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    static async Task Handle(HttpListenerContext ctx)
    {
        var req = ctx.Request;
        var res = ctx.Response;
        try
        {
            var msg = new HttpRequestMessage(new HttpMethod(req.HttpMethod), target + req.RawUrl);
            if (req.HasEntityBody)
            {
                msg.Content = new StreamContent(req.InputStream);
                if (req.ContentLength64 >= 0) msg.Content.Headers.ContentLength = req.ContentLength64;
            }
            foreach (string name in req.Headers.AllKeys)
            {
                if (In(skipReq, name)) continue;
                string value = req.Headers[name];
                if (!msg.Headers.TryAddWithoutValidation(name, value) && msg.Content != null)
                    msg.Content.Headers.TryAddWithoutValidation(name, value);
            }
            msg.Headers.TryAddWithoutValidation("X-Forwarded-For", req.RemoteEndPoint == null ? "" : req.RemoteEndPoint.Address.ToString());
            msg.Headers.TryAddWithoutValidation("X-Forwarded-Host", req.UserHostName ?? "");

            using (var up = await client.SendAsync(msg, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false))
            {
                res.StatusCode = (int)up.StatusCode;
                res.StatusDescription = up.ReasonPhrase ?? "";
                foreach (var h in up.Headers) Copy(res, h.Key, h.Value);
                if (up.Content != null)
                {
                    foreach (var h in up.Content.Headers) Copy(res, h.Key, h.Value);
                    if (up.Content.Headers.ContentType != null) res.ContentType = up.Content.Headers.ContentType.ToString();
                    long? len = up.Content.Headers.ContentLength;
                    if (len.HasValue) res.ContentLength64 = len.Value; else res.SendChunked = true;
                    if (req.HttpMethod != "HEAD" && res.StatusCode != 304 && res.StatusCode != 204)
                    {
                        using (var s = await up.Content.ReadAsStreamAsync().ConfigureAwait(false))
                            await s.CopyToAsync(res.OutputStream, 81920).ConfigureAwait(false);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log("error " + req.HttpMethod + " " + req.RawUrl + ": " + ex.Message);
            try
            {
                res.StatusCode = 502;
                res.ContentType = "text/html; charset=utf-8";
                var body = System.Text.Encoding.UTF8.GetBytes("<!doctype html><meta charset=utf-8><body dir=rtl style='font-family:sans-serif;padding:40px'><h2>الخادم غير متاح مؤقتاً</h2><p>تأكد أن Apache يعمل في XAMPP على المنفذ 8080، ثم أعد تحميل الصفحة.</p></body>");
                res.ContentLength64 = body.Length;
                res.OutputStream.Write(body, 0, body.Length);
            }
            catch (Exception) { }
        }
        finally
        {
            try { res.Close(); } catch (Exception) { }
        }
    }

    static void Copy(HttpListenerResponse res, string name, System.Collections.Generic.IEnumerable<string> values)
    {
        if (In(skipRes, name) || string.Equals(name, "Content-Length", StringComparison.OrdinalIgnoreCase)) return;
        foreach (var v in values)
        {
            try { res.Headers.Add(name, v); } catch (Exception) { }
        }
    }
}
