using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

[assembly: AssemblyTitle("Nakliye Defterim")]
[assembly: AssemblyProduct("Nakliye Defterim v4.5")]
[assembly: AssemblyCompany("Nakliye Defterim")]
[assembly: AssemblyVersion("4.5.0.0")]

class Program {
    [STAThread]
    static void Main() {
        string[] candidates = new string[] {
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45-fix6\win-unpacked\Nakliye Defterim.exe",
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45-fix5\win-unpacked\Nakliye Defterim.exe",
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45-fix4\win-unpacked\Nakliye Defterim.exe",
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45-fix3\win-unpacked\Nakliye Defterim.exe",
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45-fix2\win-unpacked\Nakliye Defterim.exe",
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45-fix1\win-unpacked\Nakliye Defterim.exe",
            @"C:\Users\LENOVO\.gemini\antigravity\scratch\nakliye-defterim\build-out-v45\win-unpacked\Nakliye Defterim.exe"
        };
        foreach (string exe in candidates) {
            if (File.Exists(exe)) {
                ProcessStartInfo psi = new ProcessStartInfo(exe);
                psi.WorkingDirectory = Path.GetDirectoryName(exe);
                psi.UseShellExecute = false;
                Process.Start(psi);
                return;
            }
        }
    }
}
