# Records what this process inherited from the way it was started: the attributes a child gets from its parent that
# could change how the NSIS installer behaves (error mode, job object, console, standard handles, STARTUPINFO, parent).
# Usage: pwsh -NoProfile -File probe.ps1 -OutFile out.json   (started through each launch path by probe-launch.mjs)
param([Parameter(Mandatory = $true)][string]$OutFile)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class LaunchProbe {
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO {
    public uint cb; public IntPtr lpReserved, lpDesktop, lpTitle;
    public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public ushort wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern uint GetErrorMode();
  [DllImport("kernel32.dll")] static extern uint GetPriorityClass(IntPtr p);
  [DllImport("kernel32.dll")] static extern bool IsProcessInJob(IntPtr p, IntPtr job, out bool inJob);
  [DllImport("kernel32.dll")] static extern bool QueryInformationJobObject(IntPtr job, int infoClass, IntPtr info, int length, out int returned);
  [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
  [DllImport("kernel32.dll")] static extern uint GetConsoleProcessList(uint[] list, uint count);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int which);
  [DllImport("kernel32.dll")] static extern uint GetFileType(IntPtr handle);
  [DllImport("kernel32.dll")] static extern bool GetConsoleMode(IntPtr handle, out uint mode);
  [DllImport("kernel32.dll")] static extern bool GetProcessDEPPolicy(IntPtr p, out uint flags, out bool permanent);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern void GetStartupInfoW(out STARTUPINFO info);

  public static uint ErrorMode() { return GetErrorMode(); }
  public static uint Priority() { return GetPriorityClass(GetCurrentProcess()); }
  public static bool InJob() { bool r; IsProcessInJob(GetCurrentProcess(), IntPtr.Zero, out r); return r; }
  public static bool HasConsoleWindow() { return GetConsoleWindow() != IntPtr.Zero; }
  public static uint ConsoleProcesses() { return GetConsoleProcessList(new uint[16], 16); }

  /// JOBOBJECT_EXTENDED_LIMIT_INFORMATION.BasicLimitInformation.LimitFlags (offset 16); -1 when the query fails.
  public static int JobLimitFlags() {
    IntPtr buffer = Marshal.AllocHGlobal(512); int returned;
    try { return QueryInformationJobObject(IntPtr.Zero, 9, buffer, 512, out returned) ? Marshal.ReadInt32(buffer, 16) : -1; }
    finally { Marshal.FreeHGlobal(buffer); }
  }

  /// "invalid", "console", "char" (NUL or other device), "disk" or "pipe" for standard handle 0, 1 or 2.
  public static string StdKind(int index) {
    IntPtr h = GetStdHandle(index == 0 ? -10 : index == 1 ? -11 : -12);
    if (h == IntPtr.Zero || h == new IntPtr(-1)) return "invalid";
    uint mode; if (GetConsoleMode(h, out mode)) return "console";
    uint type = GetFileType(h);
    return type == 1 ? "disk" : type == 2 ? "char" : type == 3 ? "pipe" : "unknown";
  }

  public static string DepPolicy() { uint f; bool p; return GetProcessDEPPolicy(GetCurrentProcess(), out f, out p) ? f + "/" + p : "n/a"; }

  public static string Startup() {
    STARTUPINFO si; GetStartupInfoW(out si);
    string desktop = si.lpDesktop == IntPtr.Zero ? "" : Marshal.PtrToStringUni(si.lpDesktop);
    string title = si.lpTitle == IntPtr.Zero ? "" : Marshal.PtrToStringUni(si.lpTitle);
    return "flags=" + si.dwFlags + ";show=" + si.wShowWindow + ";desktop=" + desktop + ";title=" + title +
           ";std=" + (si.hStdInput != IntPtr.Zero) + "/" + (si.hStdOutput != IntPtr.Zero) + "/" + (si.hStdError != IntPtr.Zero);
  }
}
"@

function Get-ProcessName([int]$ProcessId) {
  $p = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction SilentlyContinue
  if ($p) { $p.Name } else { '' }
}

$self = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
$parent = [int]$self.ParentProcessId
$grandparent = Get-CimInstance Win32_Process -Filter "ProcessId=$parent" -ErrorAction SilentlyContinue
$environment = [Environment]::GetEnvironmentVariables()

[ordered]@{
  errorMode        = [LaunchProbe]::ErrorMode()
  priorityClass    = [LaunchProbe]::Priority()
  inJob            = [LaunchProbe]::InJob()
  jobLimitFlags    = [LaunchProbe]::JobLimitFlags()
  hasConsoleWindow = [LaunchProbe]::HasConsoleWindow()
  consoleProcesses = [LaunchProbe]::ConsoleProcesses()
  stdin            = [LaunchProbe]::StdKind(0)
  stdout           = [LaunchProbe]::StdKind(1)
  stderr           = [LaunchProbe]::StdKind(2)
  depPolicy        = [LaunchProbe]::DepPolicy()
  startupInfo      = [LaunchProbe]::Startup()
  parent           = (Get-ProcessName $parent)
  grandparent      = (Get-ProcessName ([int]$grandparent.ParentProcessId))
  sessionId        = (Get-Process -Id $PID).SessionId
  currentDirectory = (Get-Location).Path
  environmentCount = $environment.Count
  environmentNames = (($environment.Keys | Sort-Object) -join ',')
  commandLine      = $self.CommandLine
} | ConvertTo-Json -Compress | Set-Content -Path $OutFile -Encoding utf8
