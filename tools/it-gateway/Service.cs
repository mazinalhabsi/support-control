// تشغيل البوابة كخدمة Windows (أو في نافذة للاختبار عند تشغيلها بدون وسائط)
using System;
using System.IO;
using System.ServiceProcess;
using System.Threading;

public class ItGatewayService : ServiceBase
{
    public static string Prefix = "http://+:80/IT/";
    public static string Target = "http://127.0.0.1:8080";
    Thread worker;

    public ItGatewayService() { ServiceName = "ITGateway"; CanStop = true; CanShutdown = true; }

    public static void Loop()
    {
        while (true)
        {
            try { ItGateway.Run(new[] { Prefix }, Target); }
            catch (Exception ex) { ItGateway.Log("stopped: " + ex.Message); }
            if (stopping) return;
            Thread.Sleep(10000);
        }
    }
    static volatile bool stopping;

    protected override void OnStart(string[] args)
    {
        worker = new Thread(Loop);
        worker.IsBackground = true;
        worker.Start();
    }
    protected override void OnStop() { stopping = true; ItGateway.Stop(); }
    protected override void OnShutdown() { OnStop(); }

    public static void Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        ItGateway.LogFile = Path.Combine(dir, "gateway.log");
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--prefix") Prefix = args[i + 1];
            if (args[i] == "--target") Target = args[i + 1];
        }
        if (Array.IndexOf(args, "--service") >= 0) { ServiceBase.Run(new ItGatewayService()); return; }
        Console.WriteLine("IT Gateway: " + Prefix + " -> " + Target + "   (Ctrl+C to stop)");
        ItGateway.Log = delegate (string s) { Console.WriteLine(s); };
        Loop();
    }
}
